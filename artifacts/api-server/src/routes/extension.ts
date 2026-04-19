import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── POST /api/extension/generate-token ───────────────────────────────────────
// Called by HR dashboard (requires Supabase JWT).
// Creates a short token in extension_tokens, deducts 50 credits.

router.post("/generate-token", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const { sessionId, candidateEmail } = req.body as { sessionId: string; candidateEmail: string };
  if (!sessionId || !candidateEmail) {
    res.status(400).json({ success: false, error: "sessionId and candidateEmail required" });
    return;
  }

  try {
    const supabase = getSupabase();

    // Verify the session exists
    const { data: session, error: sessionErr } = await supabase
      .from("interview_sessions")
      .select("id, companyId")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    // Generate a short 8-char uppercase token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
      .join("");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Upsert token record
    const { error: insertErr } = await supabase
      .from("extension_tokens")
      .insert({
        token,
        session_id: sessionId,
        candidate_email: candidateEmail,
        company_id: session.companyId,
        expires_at: expiresAt,
        used: false,
      });

    if (insertErr) {
      logger.error({ insertErr }, "Failed to insert extension token");
      res.status(500).json({ success: false, error: "Failed to create token" });
      return;
    }

    logger.info({ sessionId, token }, "Extension token generated");
    res.json({ success: true, token, expiresAt });
  } catch (err) {
    logger.error({ err }, "generate-token error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// ── POST /api/extension/validate-token ───────────────────────────────────────
// Called by the Chrome extension (unauthenticated). Returns session config.

router.post("/validate-token", async (req: Request, res: Response) => {
  const { extensionToken } = req.body as { extensionToken: string };
  if (!extensionToken) {
    res.status(400).json({ valid: false, message: "Token required" });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: record, error } = await supabase
      .from("extension_tokens")
      .select("token, session_id, candidate_email, expires_at, used")
      .eq("token", extensionToken.toUpperCase())
      .single();

    if (error || !record) {
      res.json({ valid: false, message: "Token tidak ditemukan" });
      return;
    }

    if (record.used) {
      res.json({ valid: false, message: "Token sudah digunakan" });
      return;
    }

    if (new Date(record.expires_at) < new Date()) {
      res.json({ valid: false, message: "Token sudah kadaluarsa (lebih dari 24 jam)" });
      return;
    }

    res.json({
      valid: true,
      sessionId: record.session_id,
      config: { candidateEmail: record.candidate_email }
    });
  } catch (err) {
    logger.error({ err }, "validate-token error");
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

// ── POST /api/extension/submit-gambling ──────────────────────────────────────
// Called by Chrome extension after history analysis. Stores results on session.

router.post("/submit-gambling", async (req: Request, res: Response) => {
  const { extensionToken, summary } = req.body as {
    extensionToken: string;
    summary: Record<string, unknown>;
    encryptedData?: string;
    signature?: string;
  };

  if (!extensionToken || !summary) {
    res.status(400).json({ success: false, error: "extensionToken and summary required" });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: record, error } = await supabase
      .from("extension_tokens")
      .select("session_id, used, expires_at")
      .eq("token", extensionToken.toUpperCase())
      .single();

    if (error || !record) {
      res.status(401).json({ success: false, error: "Token tidak valid" });
      return;
    }
    if (record.used) {
      res.status(409).json({ success: false, error: "Token sudah digunakan" });
      return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(401).json({ success: false, error: "Token kadaluarsa" });
      return;
    }

    const gamblingAnalysis = {
      ...summary,
      completedAt: new Date().toISOString(),
    };

    // Store on session + mark token used
    const [updateErr, tokenErr] = await Promise.all([
      supabase
        .from("interview_sessions")
        .update({ gambling_analysis: gamblingAnalysis, updatedAt: new Date().toISOString() })
        .eq("id", record.session_id)
        .then(r => r.error),
      supabase
        .from("extension_tokens")
        .update({ used: true })
        .eq("token", extensionToken.toUpperCase())
        .then(r => r.error),
    ]);

    if (updateErr) logger.warn({ updateErr }, "Failed to update session gambling_analysis");
    if (tokenErr) logger.warn({ tokenErr }, "Failed to mark token used");

    const reportId = `ga_${record.session_id.slice(0, 8)}_${Date.now()}`;
    logger.info({ sessionId: record.session_id, risk: summary.overallRisk }, "Gambling analysis submitted");

    res.json({ success: true, reportId });
  } catch (err) {
    logger.error({ err }, "submit-gambling error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// ── POST /api/extension/submit-proctoring ────────────────────────────────────
// Called by Chrome extension when assessment ends. Stores proctoring log.

router.post("/submit-proctoring", async (req: Request, res: Response) => {
  const { extensionToken, sessionId, ...proctoringData } = req.body as {
    extensionToken: string;
    sessionId: string;
    [key: string]: unknown;
  };

  if (!extensionToken || !sessionId) {
    res.status(400).json({ success: false, error: "extensionToken and sessionId required" });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: record } = await supabase
      .from("extension_tokens")
      .select("session_id, expires_at")
      .eq("token", extensionToken.toUpperCase())
      .single();

    // Token must match the session
    if (!record || record.session_id !== sessionId) {
      res.status(401).json({ success: false, error: "Token tidak valid untuk sesi ini" });
      return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(401).json({ success: false, error: "Token kadaluarsa" });
      return;
    }

    const proctoring = {
      ...proctoringData,
      isFlagged: (proctoringData.suspiciousActivityScore as number) >= 50,
      submittedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("interview_sessions")
      .update({ proctoring_data: proctoring, updatedAt: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) logger.warn({ error }, "Failed to update proctoring_data");

    logger.info({ sessionId, score: proctoringData.suspiciousActivityScore }, "Proctoring submitted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "submit-proctoring error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

export default router;
