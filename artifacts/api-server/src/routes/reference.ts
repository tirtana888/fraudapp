import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_REFCHECK_CONTENT_SID = process.env.TWILIO_REFCHECK_CONTENT_SID || "";
const TWILIO_CANDIDATE_FORM_CONTENT_SID =
  process.env.TWILIO_CANDIDATE_FORM_CONTENT_SID || "";
const TWILIO_WEBHOOK_AUTH_TOKEN =
  process.env.TWILIO_WEBHOOK_AUTH_TOKEN || TWILIO_AUTH_TOKEN;
const TWILIO_WEBHOOK_STRICT =
  (process.env.TWILIO_WEBHOOK_STRICT ?? "true").toLowerCase() !== "false";

const REFCHECK_CREDIT_COST = 10; // credits per outgoing reference check
const REQUEST_TTL_HOURS = 7 * 24;
const RESEND_MIN_HOURS = 48;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function genToken(len = 24): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
}

function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+62" + digits.substring(1);
  if (digits.startsWith("62")) return "+" + digits;
  if (digits.startsWith("8")) return "+62" + digits;
  return digits.startsWith("+") ? digits : "+" + digits;
}

function whatsappAddress(phoneE164: string): string {
  const p = phoneE164.startsWith("whatsapp:") ? phoneE164 : `whatsapp:${phoneE164}`;
  return p;
}

interface AuthCtx {
  userId: string;
  companyId: string | null;
}

async function requireSupabaseAuth(req: Request, res: Response): Promise<AuthCtx | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.VITE_SUPABASE_ANON_KEY || "",
      },
    });
    if (!r.ok) {
      res.status(401).json({ success: false, error: "Invalid session" });
      return null;
    }
    const user = (await r.json()) as { id?: string };
    if (!user?.id) {
      res.status(401).json({ success: false, error: "Invalid session" });
      return null;
    }
    // Look up companyId for tenant scoping
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("_users")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    return { userId: user.id, companyId: (profile?.company_id as string) ?? null };
  } catch (err) {
    logger.error({ err }, "refcheck auth check failed");
    res.status(401).json({ success: false, error: "Auth check failed" });
    return null;
  }
}

function denyTenant(res: Response): null {
  res.status(403).json({ success: false, error: "Forbidden" });
  return null;
}

// Typed DB row shapes (camelCase view + snake_case base tables)
interface SessionRow {
  id: string;
  companyId: string;
  candidate: { id?: string; name?: string; email?: string } | null;
}
interface RequestRow {
  id: string;
  session_id: string;
  company_id: string | null;
  request_token: string;
  status: "pending" | "submitted" | "expired" | "cancelled";
  expires_at: string;
}
interface ResponseRow {
  id: string;
  request_id: string;
  prev_company_name: string;
  prev_role: string | null;
  prev_period: string | null;
  prev_hr_phone: string;
  status: "pending" | "confirmed" | "denied" | "no_response";
  sent_at: string | null;
  resend_count: number;
  twilio_message_sid: string | null;
}
interface UserProfileRow { company_id: string | null }
interface CompanyRow { name: string | null }

async function tryDeductCredits(companyId: string, amount: number): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("deduct_credits", {
      p_company_id: companyId,
      p_amount: amount,
    });
    return !error;
  } catch (err) {
    logger.warn({ err }, "deduct_credits failed");
    return false;
  }
}

function createNewSpend(createdNew: boolean): boolean {
  return createdNew;
}

async function refundCredits(companyId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    const supabase = getSupabase();
    // Add credits back (no built-in refund RPC — direct update with audit row)
    const { data: c } = await supabase
      .from("_companies")
      .select("credits")
      .eq("id", companyId)
      .maybeSingle();
    const current = ((c as { credits?: number } | null)?.credits) ?? 0;
    await supabase.from("_companies").update({ credits: current + amount }).eq("id", companyId);
    await supabase.from("_credit_transactions").insert({
      company_id: companyId,
      type: "credit",
      amount,
      action: "REFUND",
      description: "Refund — reference check WA send failed",
      balance_before: current,
      balance_after: current + amount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn({ err }, "refundCredits failed");
  }
}

// ── Twilio HTTP helpers ──────────────────────────────────────────────────────

async function twilioSendContentTemplate(args: {
  to: string;
  contentSid: string;
  contentVariables: Record<string, string>;
  statusCallback?: string;
}): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "Twilio not configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams();
  params.set("From", whatsappAddress(TWILIO_WHATSAPP_FROM));
  params.set("To", whatsappAddress(args.to));
  params.set("ContentSid", args.contentSid);
  params.set("ContentVariables", JSON.stringify(args.contentVariables));
  if (args.statusCallback) params.set("StatusCallback", args.statusCallback);

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const txt = await r.text();
  let body: any;
  try { body = JSON.parse(txt); } catch { body = { raw: txt }; }
  if (!r.ok) {
    logger.error({ status: r.status, body }, "Twilio send template failed");
    return { ok: false, error: body?.message || `Twilio ${r.status}` };
  }
  return { ok: true, sid: body.sid };
}

async function twilioSendText(args: { to: string; body: string }): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "Twilio not configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams();
  params.set("From", whatsappAddress(TWILIO_WHATSAPP_FROM));
  params.set("To", whatsappAddress(args.to));
  params.set("Body", args.body);

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const txt = await r.text();
  let body: any;
  try { body = JSON.parse(txt); } catch { body = { raw: txt }; }
  if (!r.ok) {
    return { ok: false, error: body?.message || `Twilio ${r.status}` };
  }
  return { ok: true, sid: body.sid };
}

function getPublicBaseUrl(req: Request): string {
  const envUrl = process.env.PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return `${proto}://${host}`;
}

// ── POST /api/reference/create-request ───────────────────────────────────────
// HR-auth. Generates a token, deducts credit, sends candidate the form link via
// email + WhatsApp.

router.post("/create-request", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;

  const { sessionId, candidateName, candidateEmail, candidatePhone, companyName, forceNew } = req.body as {
    sessionId: string;
    candidateName: string;
    candidateEmail?: string;
    candidatePhone?: string;
    companyName?: string;
    forceNew?: boolean;
  };

  if (!sessionId || !candidateName) {
    res.status(400).json({ success: false, error: "sessionId and candidateName required" });
    return;
  }

  try {
    const supabase = getSupabase();

    // Look up session to get companyId
    const { data: sessionRaw, error: sessErr } = await supabase
      .from("interview_sessions")
      .select('id, "companyId", candidate')
      .eq("id", sessionId)
      .maybeSingle<SessionRow>();

    if (sessErr || !sessionRaw) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }
    const session = sessionRaw;

    // Tenant authorization: caller's company must own this session
    if (!auth.companyId || session.companyId !== auth.companyId) {
      denyTenant(res);
      return;
    }

    // Reuse existing pending request if any (idempotent), unless `forceNew`
    // is set — used by the "Tambah Referensi" flow to issue a fresh form
    // after a prior submission.
    let existing: Pick<RequestRow, "id" | "request_token" | "expires_at" | "status"> | null = null;
    if (!forceNew) {
      const { data } = await supabase
        .from("_reference_check_requests")
        .select("id, request_token, expires_at, status")
        .eq("session_id", sessionId)
        .in("status", ["pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Pick<RequestRow, "id" | "request_token" | "expires_at" | "status">>();
      existing = data ?? null;
    }

    let requestId: string;
    let requestToken: string;
    let expiresAt: string;
    let createdNew = false;

    if (existing && new Date(existing.expires_at) > new Date()) {
      requestId = existing.id;
      requestToken = existing.request_token;
      expiresAt = existing.expires_at;
    } else {
      requestToken = genToken(24);
      expiresAt = new Date(Date.now() + REQUEST_TTL_HOURS * 3600 * 1000).toISOString();
      const candidateId = session.candidate?.id ?? null;
      const { data: inserted, error: insErr } = await supabase
        .from("_reference_check_requests")
        .insert({
          session_id: sessionId,
          candidate_id: candidateId,
          company_id: session.companyId,
          request_token: requestToken,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("id")
        .single<{ id: string }>();
      if (insErr || !inserted) {
        logger.error({ insErr }, "Failed to insert reference check request");
        res.status(500).json({ success: false, error: "Failed to create request" });
        return;
      }
      requestId = inserted.id;
      createdNew = true;
    }

    // Pre-deduct 1 credit for kicking off a NEW request — fail-closed.
    if (createNewSpend(createdNew)) {
      const ok = await tryDeductCredits(session.companyId, 1);
      if (!ok) {
        // Rollback the just-inserted request row to avoid orphaned data
        await supabase.from("_reference_check_requests").delete().eq("id", requestId);
        res.status(402).json({ success: false, error: "Kredit tidak cukup untuk memulai cek referensi" });
        return;
      }
    }

    const baseUrl = getPublicBaseUrl(req);
    const formLink = `${baseUrl}/reference/${requestToken}`;

    // Send email to candidate (if candidateEmail provided)
    let emailSent = false;
    if (candidateEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const subj = `Verifikasi Riwayat Kerja — ${companyName || "HireGood"}`;
        const html = `<!DOCTYPE html><html lang="id"><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px;">
<table width="580" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <tr><td style="background:#1e293b;padding:24px 32px;color:#fff;font-weight:bold;font-size:22px;">
    <span style="color:#f97316;">Hire</span>Good
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1e293b;margin-top:0;">Halo, ${candidateName}!</h2>
    <p style="color:#475569;line-height:1.6;">
      Sebagai bagian dari proses seleksi di <strong>${companyName || "perusahaan"}</strong>,
      kami melakukan <strong>verifikasi riwayat kerja</strong> dengan menghubungi HR/atasan
      di tempat kerja kamu sebelumnya via WhatsApp.
    </p>
    <p style="color:#475569;line-height:1.6;">
      Mohon isi data kontak HR/atasan dari pengalaman kerja kamu sebelumnya melalui form berikut:
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${formLink}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Isi Form Verifikasi →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:13px;">Link berlaku 7 hari. Mohon jangan dibagikan ke orang lain.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
    © ${new Date().getFullYear()} HireGood · hiregood.one
  </td></tr>
</table>
</body></html>`;
        const r = await resend.emails.send({
          from: "HireGood <noreply@hiregood.one>",
          to: [candidateEmail],
          subject: subj,
          html,
        });
        emailSent = !r.error;
      } catch (err) {
        logger.warn({ err }, "Failed to send refcheck email to candidate");
      }
    }

    // Send WhatsApp to candidate. Prefer approved Content Template (works
    // outside 24h session window); fall back to free-form text only if no
    // template SID is configured.
    let waSent = false;
    if (candidatePhone) {
      const norm = normalizePhone(candidatePhone);
      if (TWILIO_CANDIDATE_FORM_CONTENT_SID) {
        const r = await twilioSendContentTemplate({
          to: norm,
          contentSid: TWILIO_CANDIDATE_FORM_CONTENT_SID,
          contentVariables: {
            "1": candidateName,
            "2": companyName || "perusahaan",
            "3": formLink,
          },
        });
        waSent = r.ok;
        if (!r.ok) logger.warn({ err: r.error }, "WA template to candidate failed");
      } else {
        const body = `Halo ${candidateName}, kami HireGood.one melakukan verifikasi riwayat kerja kamu untuk ${companyName || "perusahaan"}. Mohon isi data kontak HR sebelumnya melalui link ini (berlaku 7 hari): ${formLink}`;
        const r = await twilioSendText({ to: norm, body });
        waSent = r.ok;
        if (!r.ok) logger.info({ err: r.error }, "WA free-form to candidate failed (likely outside 24h session)");
      }
    }

    res.json({
      success: true,
      requestId,
      requestToken,
      formLink,
      expiresAt,
      emailSent,
      waSent,
    });
  } catch (err) {
    logger.error({ err }, "create-request error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── GET /api/reference/:token ────────────────────────────────────────────────
// Public — returns minimal data for the form.

router.get("/:token", async (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token) {
    res.status(400).json({ success: false, error: "Token required" });
    return;
  }
  try {
    const supabase = getSupabase();
    const { data: request, error } = await supabase
      .from("_reference_check_requests")
      .select("id, session_id, status, expires_at, company_id")
      .eq("request_token", token)
      .maybeSingle<RequestRow>();
    if (error || !request) {
      res.status(404).json({ success: false, error: "Token tidak valid" });
      return;
    }
    if (new Date(request.expires_at) < new Date()) {
      res.status(410).json({ success: false, error: "Link sudah kadaluarsa" });
      return;
    }

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("candidate")
      .eq("id", request.session_id)
      .maybeSingle<{ candidate: { name?: string; role?: string } | null }>();

    let companyName = "";
    if (request.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", request.company_id)
        .maybeSingle<CompanyRow>();
      companyName = company?.name || "";
    }

    res.json({
      success: true,
      candidateName: session?.candidate?.name || "",
      candidateRole: session?.candidate?.role || "",
      companyName,
      status: request.status,
    });
  } catch (err) {
    logger.error({ err }, "GET /reference/:token error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// ── POST /api/reference/:token/submit ────────────────────────────────────────
// Public — candidate submits up to 3 references. Server sends template WA to each.

interface SubmittedReference {
  prevCompanyName: string;
  prevRole?: string;
  prevPeriod?: string;
  prevHrName?: string;
  prevHrPhone: string;
}

router.post("/:token/submit", async (req: Request, res: Response) => {
  const token = req.params.token;
  const { references } = req.body as { references: SubmittedReference[] };

  if (!token) {
    res.status(400).json({ success: false, error: "Token required" });
    return;
  }
  if (!Array.isArray(references) || references.length === 0) {
    res.status(400).json({ success: false, error: "Referensi harus diisi minimal 1" });
    return;
  }
  if (references.length > 3) {
    res.status(400).json({ success: false, error: "Maksimal 3 referensi" });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: request, error } = await supabase
      .from("_reference_check_requests")
      .select("id, session_id, status, expires_at, company_id")
      .eq("request_token", token)
      .maybeSingle<RequestRow>();
    if (error || !request) {
      res.status(404).json({ success: false, error: "Token tidak valid" });
      return;
    }
    if (new Date(request.expires_at) < new Date()) {
      res.status(410).json({ success: false, error: "Link kadaluarsa" });
      return;
    }
    if (request.status !== "pending") {
      res.status(409).json({ success: false, error: "Form sudah pernah disubmit" });
      return;
    }

    const { data: sessionRow } = await supabase
      .from("interview_sessions")
      .select("candidate")
      .eq("id", request.session_id)
      .maybeSingle<{ candidate: { name?: string } | null }>();
    const candidateName = sessionRow?.candidate?.name || "Kandidat";

    // Insert response rows
    const rows = references.map((r) => ({
      request_id: request.id,
      prev_company_name: (r.prevCompanyName || "").trim(),
      prev_role: (r.prevRole || "").trim() || null,
      prev_period: (r.prevPeriod || "").trim() || null,
      prev_hr_name: (r.prevHrName || "").trim() || null,
      prev_hr_phone: normalizePhone(r.prevHrPhone || ""),
      status: "pending" as const,
    }));

    // Validate
    for (const row of rows) {
      if (!row.prev_company_name || !row.prev_hr_phone) {
        res.status(400).json({ success: false, error: "Nama perusahaan dan nomor HR wajib diisi" });
        return;
      }
    }

    // Pre-charge total cost — fail closed if insufficient credits.
    const totalCost = REFCHECK_CREDIT_COST * rows.length;
    if (request.company_id) {
      const ok = await tryDeductCredits(request.company_id, totalCost);
      if (!ok) {
        res.status(402).json({
          success: false,
          error: `Kredit tidak cukup. Dibutuhkan ${totalCost} kredit untuk ${rows.length} referensi.`,
        });
        return;
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("_reference_check_responses")
      .insert(rows)
      .select("id, prev_company_name, prev_role, prev_period, prev_hr_phone")
      .returns<Pick<ResponseRow, "id" | "prev_company_name" | "prev_role" | "prev_period" | "prev_hr_phone">[]>();

    if (insErr || !inserted) {
      // Refund the just-deducted credits since we couldn't even insert.
      if (request.company_id) await refundCredits(request.company_id, totalCost);
      logger.error({ insErr }, "Failed to insert refcheck responses");
      res.status(500).json({ success: false, error: "Gagal menyimpan referensi" });
      return;
    }

    // Mark request submitted
    await supabase
      .from("_reference_check_requests")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    // Send template WA to each HR. Refund 1 unit per failed send.
    const sendResults: Array<{ id: string; ok: boolean; sid?: string; error?: string }> = [];
    let failedCount = 0;
    for (const row of inserted) {
      let sendOk = false;
      let sid: string | undefined;
      let errMsg: string | undefined;

      const variables = {
        "1": candidateName,
        "2": row.prev_company_name,
        "3": row.prev_role || "-",
        "4": row.prev_period || "-",
      };

      if (TWILIO_REFCHECK_CONTENT_SID) {
        const r = await twilioSendContentTemplate({
          to: row.prev_hr_phone,
          contentSid: TWILIO_REFCHECK_CONTENT_SID,
          contentVariables: variables,
        });
        sendOk = r.ok; sid = r.sid; errMsg = r.error;
      } else {
        const body =
          `Halo, kami HireGood.one. Mohon konfirmasi: apakah ${candidateName} pernah bekerja di ${row.prev_company_name}` +
          (row.prev_role ? ` sebagai ${row.prev_role}` : "") +
          (row.prev_period ? ` periode ${row.prev_period}` : "") +
          `? Balas YA, TIDAK, atau ketik catatan.`;
        const r = await twilioSendText({ to: row.prev_hr_phone, body });
        sendOk = r.ok; sid = r.sid; errMsg = r.error;
      }

      await supabase
        .from("_reference_check_responses")
        .update({
          twilio_message_sid: sid || null,
          sent_at: sendOk ? new Date().toISOString() : null,
          status: sendOk ? "pending" : "no_response",
        })
        .eq("id", row.id);

      if (!sendOk) failedCount += 1;
      sendResults.push({ id: row.id, ok: sendOk, sid, error: errMsg });
    }

    if (failedCount > 0 && request.company_id) {
      await refundCredits(request.company_id, REFCHECK_CREDIT_COST * failedCount);
    }

    res.json({ success: true, requestId: request.id, sent: sendResults });
  } catch (err) {
    logger.error({ err }, "submit error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── POST /api/reference/twilio-webhook ───────────────────────────────────────
// Inbound message handler. Twilio POSTs application/x-www-form-urlencoded.

router.post(
  "/twilio-webhook",
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    try {
      // Verify X-Twilio-Signature strictly. PUBLIC_APP_URL must match what
      // Twilio is configured to call (no proxy rewrite). On mismatch we
      // reject with 401 in strict mode; non-strict only logs.
      const signature = req.headers["x-twilio-signature"] as string | undefined;
      if (!TWILIO_WEBHOOK_AUTH_TOKEN) {
        logger.error("Twilio webhook auth token not configured");
        res.status(500).send("Webhook not configured");
        return;
      }
      if (!signature) {
        logger.warn("Twilio webhook missing signature header");
        res.status(401).send("Missing signature");
        return;
      }
      const baseUrl = (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
      const fullUrl = baseUrl + (req.originalUrl || req.url);
      const params = (req.body || {}) as Record<string, string>;
      const sortedKeys = Object.keys(params).sort();
      const concatenated = sortedKeys.reduce((acc, k) => acc + k + params[k], fullUrl);
      const expected = crypto
        .createHmac("sha1", TWILIO_WEBHOOK_AUTH_TOKEN)
        .update(Buffer.from(concatenated, "utf-8"))
        .digest("base64");
      const ok =
        expected.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      if (!ok) {
        logger.warn({ fullUrl }, "Twilio webhook signature mismatch");
        if (TWILIO_WEBHOOK_STRICT) {
          res.status(401).send("Invalid signature");
          return;
        }
      }

      const wb = (req.body || {}) as Record<string, string | undefined>;
      const from = (wb.From || "").toString();
      const body = (wb.Body || "").toString().trim();
      const buttonText = (wb.ButtonText || "").toString().trim();
      const buttonPayload = (wb.ButtonPayload || "").toString().trim();
      const originalSid = (wb.OriginalRepliedMessageSid || "").toString().trim();

      const phoneE164 = from.replace(/^whatsapp:/, "");
      if (!phoneE164) {
        res.status(200).type("text/xml").send("<Response/>");
        return;
      }

      const text = (buttonText || body || "").toLowerCase();
      let status: "confirmed" | "denied" | "no_response" | "pending" = "pending";
      const positive = /(^|\W)(ya|y|iya|benar|betul|true|confirm|yes)(\W|$)/i;
      const negative = /(^|\W)(tidak|tdk|no|salah|bukan|gak|enggak|false)(\W|$)/i;
      if (positive.test(text) || /ya[, ]*benar/i.test(buttonText)) status = "confirmed";
      else if (negative.test(text) || /tidak[, ]*tidak pernah/i.test(buttonText)) status = "denied";
      else if (text.length > 0) status = "confirmed"; // free-text reply counts as a response; HR can review note

      const supabase = getSupabase();

      // Find target response row: prefer original message SID match, fallback to most recent pending row for this phone.
      let target: { id: string } | null = null;
      if (originalSid) {
        const { data } = await supabase
          .from("_reference_check_responses")
          .select("id")
          .eq("twilio_message_sid", originalSid)
          .maybeSingle();
        target = data;
      }
      if (!target) {
        const { data } = await supabase
          .from("_reference_check_responses")
          .select("id")
          .eq("prev_hr_phone", phoneE164)
          .eq("status", "pending")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        target = data;
      }

      if (!target) {
        logger.info({ phoneE164, originalSid }, "No matching refcheck response for inbound WA");
        res.status(200).type("text/xml").send("<Response/>");
        return;
      }

      await supabase
        .from("_reference_check_responses")
        .update({
          status,
          response_text: buttonText ? `[${buttonText}] ${body}`.trim() : body,
          responded_at: new Date().toISOString(),
        })
        .eq("id", target.id);

      // Reply to HR with thanks (free-form ok within 24h of inbound)
      try {
        await twilioSendText({
          to: phoneE164,
          body: "Terima kasih atas konfirmasinya. Tim HR penerima sudah menerima jawaban Anda.",
        });
      } catch {
        /* ignore */
      }

      res.status(200).type("text/xml").send("<Response/>");
    } catch (err) {
      logger.error({ err }, "twilio-webhook error");
      res.status(200).type("text/xml").send("<Response/>");
    }
  },
);

// ── POST /api/reference/:requestId/resend/:responseId ────────────────────────
router.post("/:requestId/resend/:responseId", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;
  const { requestId, responseId } = req.params;
  try {
    const supabase = getSupabase();
    const { data: response, error } = await supabase
      .from("_reference_check_responses")
      .select("id, request_id, prev_company_name, prev_role, prev_period, prev_hr_phone, status, sent_at, resend_count")
      .eq("id", responseId)
      .eq("request_id", requestId)
      .maybeSingle<Pick<ResponseRow, "id" | "request_id" | "prev_company_name" | "prev_role" | "prev_period" | "prev_hr_phone" | "status" | "sent_at" | "resend_count">>();
    if (error || !response) {
      res.status(404).json({ success: false, error: "Response not found" });
      return;
    }
    if (response.status !== "pending" && response.status !== "no_response") {
      res.status(409).json({ success: false, error: "Referensi sudah dijawab" });
      return;
    }
    // Enforce 48h-since-last-send rule server-side
    const sentAt = response.sent_at ? new Date(response.sent_at).getTime() : 0;
    if (sentAt > 0 && Date.now() - sentAt < RESEND_MIN_HOURS * 3600 * 1000) {
      const hoursLeft = Math.ceil((RESEND_MIN_HOURS * 3600 * 1000 - (Date.now() - sentAt)) / 3600000);
      res.status(429).json({
        success: false,
        error: `Tunggu ${hoursLeft} jam lagi sebelum mengirim ulang (minimal ${RESEND_MIN_HOURS} jam)`,
      });
      return;
    }

    const { data: reqRow } = await supabase
      .from("_reference_check_requests")
      .select("session_id, company_id")
      .eq("id", requestId)
      .maybeSingle<Pick<RequestRow, "session_id" | "company_id">>();
    // Tenant authorization
    if (!reqRow || !auth.companyId || reqRow.company_id !== auth.companyId) {
      denyTenant(res);
      return;
    }
    let candidateName = "Kandidat";
    if (reqRow.session_id) {
      const { data: s } = await supabase
        .from("interview_sessions")
        .select("candidate")
        .eq("id", reqRow.session_id)
        .maybeSingle<{ candidate: { name?: string } | null }>();
      candidateName = s?.candidate?.name || candidateName;
    }

    // Pre-charge 1 unit (REFCHECK_CREDIT_COST) for the resend — fail closed.
    if (reqRow.company_id) {
      const ok = await tryDeductCredits(reqRow.company_id, REFCHECK_CREDIT_COST);
      if (!ok) {
        res.status(402).json({ success: false, error: "Kredit tidak cukup untuk mengirim ulang" });
        return;
      }
    }

    const variables = {
      "1": candidateName,
      "2": response.prev_company_name,
      "3": response.prev_role || "-",
      "4": response.prev_period || "-",
    };

    let sendOk = false;
    let sid: string | undefined;
    let errMsg: string | undefined;
    if (TWILIO_REFCHECK_CONTENT_SID) {
      const r = await twilioSendContentTemplate({
        to: response.prev_hr_phone,
        contentSid: TWILIO_REFCHECK_CONTENT_SID,
        contentVariables: variables,
      });
      sendOk = r.ok; sid = r.sid; errMsg = r.error;
    } else {
      const body =
        `Halo, kami HireGood.one. Mohon konfirmasi: apakah ${candidateName} pernah bekerja di ${response.prev_company_name}` +
        (response.prev_role ? ` sebagai ${response.prev_role}` : "") +
        (response.prev_period ? ` periode ${response.prev_period}` : "") +
        `? Balas YA, TIDAK, atau ketik catatan.`;
      const r = await twilioSendText({ to: response.prev_hr_phone, body });
      sendOk = r.ok; sid = r.sid; errMsg = r.error;
    }

    // Refund credit if the send failed
    if (!sendOk && reqRow.company_id) {
      await refundCredits(reqRow.company_id, REFCHECK_CREDIT_COST);
    }

    await supabase
      .from("_reference_check_responses")
      .update({
        twilio_message_sid: sid || null,
        sent_at: sendOk ? new Date().toISOString() : response.sent_at,
        status: sendOk ? "pending" : "no_response",
        resend_count: (response.resend_count ?? 0) + 1,
        last_resend_at: new Date().toISOString(),
      })
      .eq("id", response.id);

    res.json({ success: sendOk, sid, error: errMsg });
  } catch (err) {
    logger.error({ err }, "resend error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── GET /api/reference/by-session/:sessionId ─────────────────────────────────
// HR-auth. Lists requests + responses for a session (consumed by ReferenceCheckCard).
router.get("/by-session/:sessionId", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;
  const { sessionId } = req.params;
  try {
    const supabase = getSupabase();
    // Tenant authz: ensure session belongs to caller's company
    const { data: session } = await supabase
      .from("interview_sessions")
      .select('"companyId"')
      .eq("id", sessionId)
      .maybeSingle();
    const sess = session as { companyId?: string } | null;
    if (!sess || !auth.companyId || sess.companyId !== auth.companyId) {
      denyTenant(res);
      return;
    }
    const { data, error } = await supabase
      .from("reference_check_requests")
      .select("*")
      .eq("sessionId", sessionId)
      .order("createdAt", { ascending: false });
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    res.json({ success: true, requests: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
