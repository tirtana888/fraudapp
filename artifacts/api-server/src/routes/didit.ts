import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DIDIT_API_BASE =
  process.env.DIDIT_API_BASE || "https://verification.didit.me";
const DIDIT_API_KEY = process.env.DIDIT_API_KEY || "";
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || "";
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET || "";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function mapDiditStatus(
  status: string,
): "pending" | "in_progress" | "approved" | "declined" | "in_review" {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "declined" || s === "rejected") return "declined";
  if (s === "in review" || s === "in_review" || s === "review") return "in_review";
  if (s === "in progress" || s === "in_progress" || s === "processing") return "in_progress";
  return "pending";
}

router.post("/create-session", async (req: Request, res: Response) => {
  try {
    if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
      return res
        .status(500)
        .json({ success: false, error: "Didit not configured on server" });
    }

    const { sessionId, candidateName, candidateEmail, callbackUrl } = req.body as {
      sessionId?: string;
      candidateName?: string;
      candidateEmail?: string;
      callbackUrl?: string;
    };

    if (!sessionId) {
      return res.status(400).json({ success: false, error: "sessionId required" });
    }

    const payload: Record<string, unknown> = {
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: sessionId,
      metadata: { candidateName, candidateEmail },
    };
    if (callbackUrl) payload.callback = callbackUrl;
    if (candidateEmail) {
      payload.contact_details = { email: candidateEmail, email_lang: "en" };
    }

    const diditRes = await fetch(`${DIDIT_API_BASE}/v2/session/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DIDIT_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await diditRes.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!diditRes.ok) {
      logger.error({ status: diditRes.status, data }, "Didit create-session failed");
      return res.status(502).json({
        success: false,
        error: data?.detail || data?.message || `Didit error ${diditRes.status}`,
      });
    }

    const verificationSessionId: string =
      data.session_id || data.id || data.session?.id || "";
    const verificationUrl: string = data.url || data.session_url || "";
    const status = mapDiditStatus(data.status || "pending");

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("_interview_sessions")
      .update({
        background_check: {
          status,
          diditSessionId: verificationSessionId,
          verificationLink: verificationUrl,
          createdAt: now,
          lastUpdated: now,
        },
        background_check_status: status,
      })
      .eq("id", sessionId);

    if (updateErr) {
      logger.warn({ err: updateErr }, "Failed to persist Didit session to interview_sessions");
    }

    return res.json({
      success: true,
      verificationSessionId,
      verification_url: verificationUrl,
      status,
    });
  } catch (err) {
    logger.error({ err }, "create-session unexpected error");
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

router.get("/session/:id", async (req: Request, res: Response) => {
  try {
    if (!DIDIT_API_KEY) {
      return res.status(500).json({ success: false, error: "Didit not configured" });
    }
    const id = req.params.id;
    const diditRes = await fetch(
      `${DIDIT_API_BASE}/v2/session/${encodeURIComponent(id)}/decision/`,
      {
        method: "GET",
        headers: { "x-api-key": DIDIT_API_KEY },
      },
    );
    const text = await diditRes.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!diditRes.ok) {
      return res
        .status(502)
        .json({ success: false, error: data?.detail || `Didit ${diditRes.status}` });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

router.post(
  "/webhook",
  express.raw({ type: "*/*", limit: "5mb" }),
  async (req: Request, res: Response) => {
    try {
      const signature = (req.headers["x-signature"] ||
        req.headers["x-didit-signature"]) as string | undefined;
      const timestamp = (req.headers["x-timestamp"] ||
        req.headers["x-didit-timestamp"]) as string | undefined;

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}));

      if (DIDIT_WEBHOOK_SECRET && signature) {
        const expected = crypto
          .createHmac("sha256", DIDIT_WEBHOOK_SECRET)
          .update(rawBody)
          .digest("hex");
        const sigOk =
          expected === signature ||
          (() => {
            try {
              return crypto.timingSafeEqual(
                Buffer.from(expected, "hex"),
                Buffer.from(signature, "hex"),
              );
            } catch {
              return false;
            }
          })();
        if (!sigOk) {
          logger.warn({ signature }, "Didit webhook signature mismatch");
          return res.status(401).json({ success: false, error: "Invalid signature" });
        }
        if (timestamp) {
          const tsNum = Number(timestamp);
          const ageSec = Math.abs(Date.now() / 1000 - tsNum);
          if (Number.isFinite(tsNum) && ageSec > 300) {
            return res.status(401).json({ success: false, error: "Stale timestamp" });
          }
        }
      } else if (DIDIT_WEBHOOK_SECRET) {
        logger.warn("Didit webhook missing signature header");
      }

      const body = JSON.parse(rawBody.toString("utf-8") || "{}");
      const verificationSessionId: string =
        body.session_id || body.id || body.session?.id || "";
      const sessionId: string =
        body.vendor_data || body.session?.vendor_data || "";
      const status = mapDiditStatus(body.status || body.decision?.status || "pending");
      const decision = body.decision || body.verification || null;

      if (!sessionId) {
        logger.warn({ body }, "Didit webhook missing vendor_data; cannot map session");
        return res.json({ success: true, ignored: true });
      }

      const supabase = getSupabase();
      const now = new Date().toISOString();

      const { data: existing } = await supabase
        .from("interview_sessions")
        .select("background_check")
        .eq("id", sessionId)
        .maybeSingle<{ background_check: Record<string, unknown> | null }>();

      const merged = {
        ...(existing?.background_check || {}),
        status,
        diditSessionId: verificationSessionId,
        decision: decision?.status || status,
        lastUpdated: now,
        kycData: decision?.kyc || decision?.id_verification || (existing?.background_check as any)?.kycData,
        idVerification: decision?.id_verification || (existing?.background_check as any)?.idVerification,
        faceMatch: decision?.face_match || (existing?.background_check as any)?.faceMatch,
        ipAnalysis: decision?.ip_analysis || (existing?.background_check as any)?.ipAnalysis,
        warnings: decision?.warnings || (existing?.background_check as any)?.warnings,
        rawWebhookData: {
          status: body.status,
          webhook_type: body.webhook_type || body.event_type,
          session_number: body.session_number,
        },
      };

      const update: Record<string, unknown> = {
        background_check: merged,
        background_check_status: status,
      };
      if (status === "approved" || status === "declined") {
        update.background_check_completed_at = now;
      }

      const { error } = await supabase
        .from("_interview_sessions")
        .update(update)
        .eq("id", sessionId);

      if (error) {
        logger.error({ err: error }, "Failed to update interview_session from webhook");
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Didit webhook handler error");
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  },
);

export default router;
