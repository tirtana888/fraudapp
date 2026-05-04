import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { Resend } from "resend";

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

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

const REFCHECK_CREDIT_COST = 10; // credits per outgoing reference check
const REQUEST_TTL_HOURS = 7 * 24;
const RESEND_MIN_HOURS = 48;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

// Log Twilio configuration readiness once at module load so operators can
// see at a glance whether the reference-check WhatsApp flow is wired up.
// Sensitive values (account SID, auth token, webhook auth token) are never
// logged. Non-sensitive operational values — the WhatsApp sender number,
// a 6-char prefix of the Content Template SID, and the computed webhook
// URL — are logged to make misconfiguration easy to spot.
{
  const missing: string[] = [];
  if (!TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!TWILIO_WHATSAPP_FROM) missing.push("TWILIO_WHATSAPP_FROM");
  if (!TWILIO_REFCHECK_CONTENT_SID) missing.push("TWILIO_REFCHECK_CONTENT_SID");
  if (!process.env.PUBLIC_APP_URL) missing.push("PUBLIC_APP_URL");
  if (missing.length === 0) {
    logger.info(
      {
        from: TWILIO_WHATSAPP_FROM,
        contentSid: TWILIO_REFCHECK_CONTENT_SID.slice(0, 6) + "…",
        webhookStrict: TWILIO_WEBHOOK_STRICT,
        webhookUrl: `${(process.env.PUBLIC_APP_URL || "").replace(/\/$/, "")}/api/reference/twilio-webhook`,
      },
      "[refcheck] Twilio WhatsApp configured",
    );
  } else {
    logger.warn(
      { missing },
      "[refcheck] Twilio WhatsApp NOT fully configured — outgoing template sends will fail until these env vars are set",
    );
  }
}

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

// ══════════════════════════════════════════════════════════════════════════════
// FITUR 1: WhatsApp Referensi Langsung (Direct WA to reference without form)
// ══════════════════════════════════════════════════════════════════════════════

interface DirectReference {
  name: string;
  phone: string;
  company: string;
  role?: string;
  period?: string;
  email?: string;
}

router.post("/direct-whatsapp", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;

  const { sessionId, references } = req.body as {
    sessionId: string;
    references: DirectReference[];
  };

  if (!sessionId || !Array.isArray(references) || references.length === 0) {
    res.status(400).json({ success: false, error: "sessionId dan references wajib diisi" });
    return;
  }
  if (references.length > 5) {
    res.status(400).json({ success: false, error: "Maksimal 5 referensi per pengiriman" });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: sessionRaw } = await supabase
      .from("interview_sessions")
      .select('id, "companyId", candidate')
      .eq("id", sessionId)
      .maybeSingle<SessionRow>();

    if (!sessionRaw) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }
    if (!auth.companyId || sessionRaw.companyId !== auth.companyId) {
      denyTenant(res);
      return;
    }

    const candidateName = sessionRaw.candidate?.name || "Kandidat";

    // Create or reuse a request record
    const requestToken = genToken(24);
    const expiresAt = new Date(Date.now() + REQUEST_TTL_HOURS * 3600 * 1000).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("_reference_check_requests")
      .insert({
        session_id: sessionId,
        candidate_id: sessionRaw.candidate?.id ?? null,
        company_id: sessionRaw.companyId,
        request_token: requestToken,
        status: "submitted",
        expires_at: expiresAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (insErr || !inserted) {
      res.status(500).json({ success: false, error: "Gagal membuat request" });
      return;
    }
    const requestId = inserted.id;

    // Deduct credits
    const totalCost = REFCHECK_CREDIT_COST * references.length;
    if (sessionRaw.companyId) {
      const ok = await tryDeductCredits(sessionRaw.companyId, totalCost);
      if (!ok) {
        await supabase.from("_reference_check_requests").delete().eq("id", requestId);
        res.status(402).json({ success: false, error: `Kredit tidak cukup (butuh ${totalCost})` });
        return;
      }
    }

    // Insert response rows and send WA
    const results: Array<{ id: string; name: string; ok: boolean; sid?: string; error?: string }> = [];
    let failedCount = 0;

    for (const ref of references) {
      const phone = normalizePhone(ref.phone);
      const row = {
        request_id: requestId,
        prev_company_name: ref.company.trim(),
        prev_role: ref.role?.trim() || null,
        prev_period: ref.period?.trim() || null,
        prev_hr_name: ref.name.trim(),
        prev_hr_phone: phone,
        ref_email: ref.email?.trim() || null,
        status: "pending" as const,
      };

      const { data: resp, error: respErr } = await supabase
        .from("_reference_check_responses")
        .insert(row)
        .select("id")
        .single<{ id: string }>();

      if (respErr || !resp) {
        failedCount += 1;
        results.push({ id: "", name: ref.name, ok: false, error: "DB insert failed" });
        continue;
      }

      // Send WhatsApp
      let sendOk = false;
      let sid: string | undefined;
      let errMsg: string | undefined;

      const variables = {
        "1": candidateName,
        "2": ref.company,
        "3": ref.role || "-",
        "4": ref.period || "-",
      };

      if (TWILIO_REFCHECK_CONTENT_SID) {
        const r = await twilioSendContentTemplate({
          to: phone,
          contentSid: TWILIO_REFCHECK_CONTENT_SID,
          contentVariables: variables,
        });
        sendOk = r.ok; sid = r.sid; errMsg = r.error;
      } else {
        const body =
          `Halo ${ref.name}, kami HireGood.one. Mohon konfirmasi: apakah ${candidateName} pernah bekerja di ${ref.company}` +
          (ref.role ? ` sebagai ${ref.role}` : "") +
          (ref.period ? ` periode ${ref.period}` : "") +
          `? Balas YA, TIDAK, atau ketik catatan.`;
        const r = await twilioSendText({ to: phone, body });
        sendOk = r.ok; sid = r.sid; errMsg = r.error;
      }

      await supabase
        .from("_reference_check_responses")
        .update({
          twilio_message_sid: sid || null,
          sent_at: sendOk ? new Date().toISOString() : null,
          status: sendOk ? "pending" : "no_response",
        })
        .eq("id", resp.id);

      if (!sendOk) failedCount += 1;
      results.push({ id: resp.id, name: ref.name, ok: sendOk, sid, error: errMsg });
    }

    // Refund failed sends
    if (failedCount > 0 && sessionRaw.companyId) {
      await refundCredits(sessionRaw.companyId, REFCHECK_CREDIT_COST * failedCount);
    }

    res.json({ success: true, requestId, results });
  } catch (err) {
    logger.error({ err }, "direct-whatsapp error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FITUR 2: Email Referensi dari hiregood.one
// ══════════════════════════════════════════════════════════════════════════════

function buildReferenceEmailHtml(args: {
  refName: string;
  candidateName: string;
  company: string;
  role: string;
  period: string;
  confirmUrl: string;
  denyUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e293b;padding:24px 32px;">
        <span style="color:#f97316;font-size:22px;font-weight:bold;">Hire</span><span style="color:#ffffff;font-size:22px;font-weight:bold;">Good</span>
        <span style="color:#94a3b8;font-size:14px;margin-left:12px;">Verification Request</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#1e293b;margin-top:0;">Konfirmasi Riwayat Kerja</h2>
        <p style="color:#475569;line-height:1.6;">
          Yth. <strong>${args.refName}</strong>,
        </p>
        <p style="color:#475569;line-height:1.6;">
          Kami dari <strong>HireGood.one</strong>, platform verifikasi rekrutmen terpercaya di Indonesia.
          Kami ingin mengonfirmasi informasi berikut terkait calon karyawan:
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f8fafc;">
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#64748b;font-size:13px;width:140px;">Nama Kandidat</td>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#1e293b;font-weight:bold;">${args.candidateName}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Perusahaan</td>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#1e293b;">${args.company}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Jabatan</td>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#1e293b;">${args.role || "-"}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#64748b;font-size:13px;">Periode</td>
            <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#1e293b;">${args.period || "-"}</td>
          </tr>
        </table>
        <p style="color:#475569;line-height:1.6;">
          Apakah informasi di atas benar? Silakan klik salah satu tombol di bawah:
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:28px auto;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${args.confirmUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
                Ya, Benar
              </a>
            </td>
            <td>
              <a href="${args.denyUrl}" style="display:inline-block;padding:14px 32px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
                Tidak Benar
              </a>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:12px;text-align:center;">
          Email ini dikirim secara otomatis oleh sistem HireGood.one.<br/>
          Jika Anda tidak mengenali permintaan ini, silakan abaikan email ini.
        </p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
        &copy; ${new Date().getFullYear()} HireGood &middot; hiregood.one
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Send reference check email to a specific response's HR
router.post("/send-email", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;

  const { responseId, requestId } = req.body as {
    responseId: string;
    requestId: string;
  };

  if (!responseId || !requestId) {
    res.status(400).json({ success: false, error: "responseId dan requestId wajib" });
    return;
  }

  try {
    const supabase = getSupabase();

    // Fetch response
    const { data: refResp } = await supabase
      .from("_reference_check_responses")
      .select("id, request_id, prev_company_name, prev_role, prev_period, prev_hr_name, prev_hr_phone, ref_email")
      .eq("id", responseId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (!refResp) {
      res.status(404).json({ success: false, error: "Response not found" });
      return;
    }

    const resp = refResp as {
      id: string; request_id: string; prev_company_name: string;
      prev_role: string | null; prev_period: string | null;
      prev_hr_name: string | null; prev_hr_phone: string; ref_email: string | null;
    };

    if (!resp.ref_email) {
      res.status(400).json({ success: false, error: "Email referensi belum diisi" });
      return;
    }

    // Tenant check
    const { data: reqRow } = await supabase
      .from("_reference_check_requests")
      .select("session_id, company_id")
      .eq("id", requestId)
      .maybeSingle<Pick<RequestRow, "session_id" | "company_id">>();

    if (!reqRow || !auth.companyId || reqRow.company_id !== auth.companyId) {
      denyTenant(res);
      return;
    }

    // Get candidate name
    let candidateName = "Kandidat";
    if (reqRow.session_id) {
      const { data: s } = await supabase
        .from("interview_sessions")
        .select("candidate")
        .eq("id", reqRow.session_id)
        .maybeSingle<{ candidate: { name?: string } | null }>();
      candidateName = s?.candidate?.name || candidateName;
    }

    // Generate unique email response tokens
    const confirmToken = genToken(32);
    const denyToken = genToken(32);

    // Store tokens in DB
    await supabase.from("_reference_check_responses").update({
      email_confirm_token: confirmToken,
      email_deny_token: denyToken,
      email_sent_at: new Date().toISOString(),
    }).eq("id", resp.id);

    const baseUrl = getPublicBaseUrl(req);
    const confirmUrl = `${baseUrl}/api/reference/email-respond/${confirmToken}/confirm`;
    const denyUrl = `${baseUrl}/api/reference/email-respond/${denyToken}/deny`;

    // Send email via Resend
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ success: false, error: "Email service belum dikonfigurasi (RESEND_API_KEY)" });
      return;
    }

    const resendClient = new Resend(process.env.RESEND_API_KEY);
    const html = buildReferenceEmailHtml({
      refName: resp.prev_hr_name || "Bapak/Ibu",
      candidateName,
      company: resp.prev_company_name,
      role: resp.prev_role || "",
      period: resp.prev_period || "",
      confirmUrl,
      denyUrl,
    });

    const emailResult = await resendClient.emails.send({
      from: "HireGood <noreply@hiregood.one>",
      replyTo: "verification@hiregood.one",
      to: [resp.ref_email],
      subject: `Konfirmasi Riwayat Kerja — ${candidateName} di ${resp.prev_company_name}`,
      html,
    });

    if (emailResult.error) {
      logger.error({ error: emailResult.error }, "Failed to send reference email");
      res.status(500).json({ success: false, error: "Gagal mengirim email" });
      return;
    }

    logger.info({ responseId: resp.id, to: resp.ref_email }, "Reference email sent");
    res.json({ success: true, emailId: emailResult.data?.id });
  } catch (err) {
    logger.error({ err }, "send-email error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Email response handler (public — clicked from email)
router.get("/email-respond/:token/:action", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const action = req.params.action as string;
  if (!token || !["confirm", "deny"].includes(action)) {
    res.status(400).send("Invalid link");
    return;
  }

  try {
    const supabase = getSupabase();

    const column = action === "confirm" ? "email_confirm_token" : "email_deny_token";
    const { data: resp } = await supabase
      .from("_reference_check_responses")
      .select("id, status")
      .eq(column, token)
      .maybeSingle<{ id: string; status: string }>();

    if (!resp) {
      res.status(404).send(htmlPage("Link Tidak Valid", "Link konfirmasi tidak ditemukan atau sudah digunakan."));
      return;
    }

    if (resp.status !== "pending") {
      res.status(200).send(htmlPage("Sudah Dikonfirmasi", "Anda sudah pernah memberikan konfirmasi sebelumnya. Terima kasih!"));
      return;
    }

    const newStatus = action === "confirm" ? "confirmed" : "denied";
    await supabase.from("_reference_check_responses").update({
      status: newStatus,
      response_text: action === "confirm" ? "[EMAIL] Dikonfirmasi via email" : "[EMAIL] Ditolak via email",
      responded_at: new Date().toISOString(),
      email_confirm_token: null,
      email_deny_token: null,
    }).eq("id", resp.id);

    const title = action === "confirm" ? "Terima Kasih!" : "Terima Kasih";
    const message = action === "confirm"
      ? "Anda telah <strong>mengonfirmasi</strong> bahwa informasi riwayat kerja tersebut benar. Terima kasih atas waktunya!"
      : "Anda telah menyatakan bahwa informasi riwayat kerja tersebut <strong>tidak benar</strong>. Terima kasih atas klarifikasinya.";

    res.status(200).send(htmlPage(title, message));
  } catch (err) {
    logger.error({ err }, "email-respond error");
    res.status(500).send(htmlPage("Error", "Terjadi kesalahan. Silakan coba lagi nanti."));
  }
});

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} — HireGood</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#fff;padding:48px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:480px;text-align:center;">
  <div style="margin-bottom:16px;"><span style="color:#f97316;font-size:28px;font-weight:bold;">Hire</span><span style="color:#1e293b;font-size:28px;font-weight:bold;">Good</span></div>
  <h2 style="color:#1e293b;margin-bottom:16px;">${title}</h2>
  <p style="color:#475569;line-height:1.6;">${body}</p>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">&copy; ${new Date().getFullYear()} HireGood &middot; hiregood.one</p>
</div></body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FITUR 3: AI Voice Call ke Referensi (Twilio Voice + Gemini)
// ══════════════════════════════════════════════════════════════════════════════

async function aiAnalyzeCallResponse(
  candidateName: string,
  company: string,
  role: string,
  period: string,
  speechResult: string,
  conversationHistory: Array<{ speaker: string; text: string }>,
): Promise<{ status: "confirmed" | "denied" | "unclear"; followUp: string | null; reasoning: string }> {
  const prompt = `Kamu adalah analis percakapan telepon verifikasi kerja untuk HireGood.one.

Data kandidat:
- Nama: ${candidateName}
- Perusahaan: ${company}
- Jabatan: ${role || "tidak disebutkan"}
- Periode: ${period || "tidak disebutkan"}

Percakapan sejauh ini:
${conversationHistory.map((c) => `${c.speaker}: ${c.text}`).join("\n")}

Respons terakhir dari referensi:
"${speechResult}"

Tugas:
1. Analisis apakah referensi mengonfirmasi, menolak, atau belum jelas
2. Jika belum jelas atau perlu informasi lebih, buat pertanyaan follow-up yang natural dalam bahasa Indonesia
3. Jika sudah cukup jelas (konfirmasi atau tolak), set followUp = null

Jawab dalam JSON format:
{
  "status": "confirmed" | "denied" | "unclear",
  "followUp": "pertanyaan lanjutan" | null,
  "reasoning": "penjelasan singkat"
}`;

  const apiUrl = GEMINI_API_KEY
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
    : null;
  const deepseekUrl = DEEPSEEK_API_KEY ? "https://api.deepseek.com/v1/chat/completions" : null;

  let raw = "";

  if (apiUrl) {
    try {
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
        }),
      });
      const data = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      logger.warn({ err }, "Gemini call analysis failed, trying DeepSeek");
    }
  }

  if (!raw && deepseekUrl) {
    try {
      const r = await fetch(deepseekUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
      const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      raw = data.choices?.[0]?.message?.content || "";
    } catch (err) {
      logger.warn({ err }, "DeepSeek call analysis also failed");
    }
  }

  if (!raw) {
    return { status: "unclear", followUp: null, reasoning: "AI analysis unavailable" };
  }

  try {
    const parsed = JSON.parse(raw) as { status: string; followUp: string | null; reasoning: string };
    return {
      status: (["confirmed", "denied", "unclear"].includes(parsed.status) ? parsed.status : "unclear") as "confirmed" | "denied" | "unclear",
      followUp: parsed.followUp || null,
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return { status: "unclear", followUp: null, reasoning: raw.slice(0, 200) };
  }
}

// Initiate AI voice call to a reference
router.post("/ai-call", async (req: Request, res: Response) => {
  const auth = await requireSupabaseAuth(req, res);
  if (!auth) return;

  const { responseId, requestId } = req.body as { responseId: string; requestId: string };

  if (!responseId || !requestId) {
    res.status(400).json({ success: false, error: "responseId dan requestId wajib" });
    return;
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    res.status(503).json({ success: false, error: "Twilio Voice belum dikonfigurasi (TWILIO_PHONE_NUMBER)" });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: refResp } = await supabase
      .from("_reference_check_responses")
      .select("id, request_id, prev_company_name, prev_role, prev_period, prev_hr_name, prev_hr_phone, call_status")
      .eq("id", responseId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (!refResp) {
      res.status(404).json({ success: false, error: "Response not found" });
      return;
    }

    const resp = refResp as {
      id: string; request_id: string; prev_company_name: string;
      prev_role: string | null; prev_period: string | null;
      prev_hr_name: string | null; prev_hr_phone: string; call_status: string | null;
    };

    if (resp.call_status === "in_progress") {
      res.status(409).json({ success: false, error: "Panggilan sedang berlangsung" });
      return;
    }

    // Tenant check
    const { data: reqRow } = await supabase
      .from("_reference_check_requests")
      .select("session_id, company_id")
      .eq("id", requestId)
      .maybeSingle<Pick<RequestRow, "session_id" | "company_id">>();

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

    // Deduct credits for voice call
    if (reqRow.company_id) {
      const ok = await tryDeductCredits(reqRow.company_id, REFCHECK_CREDIT_COST);
      if (!ok) {
        res.status(402).json({ success: false, error: "Kredit tidak cukup" });
        return;
      }
    }

    const baseUrl = getPublicBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/reference/ai-call-webhook`;

    // Build TwiML for the initial greeting
    const greeting =
      `Selamat siang, saya dari HireGood titik one, platform verifikasi rekrutmen. ` +
      `Kami ingin mengonfirmasi, apakah ${candidateName} pernah bekerja di ${resp.prev_company_name}` +
      (resp.prev_role ? ` sebagai ${resp.prev_role}` : "") +
      `? Mohon jawab ya atau tidak.`;

    // Initiate Twilio outbound call
    const callUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const params = new URLSearchParams();
    params.set("From", TWILIO_PHONE_NUMBER);
    params.set("To", resp.prev_hr_phone);
    params.set("Twiml", `<Response><Say language="id-ID" voice="Google.id-ID-Standard-A">${greeting}</Say><Gather input="speech" language="id-ID" speechTimeout="auto" action="${webhookUrl}?responseId=${resp.id}&amp;step=1&amp;candidateName=${encodeURIComponent(candidateName)}&amp;company=${encodeURIComponent(resp.prev_company_name)}&amp;role=${encodeURIComponent(resp.prev_role || "")}&amp;period=${encodeURIComponent(resp.prev_period || "")}"><Say language="id-ID">Silakan jawab sekarang.</Say></Gather><Say language="id-ID">Maaf, kami tidak menerima jawaban. Terima kasih atas waktunya. Selamat siang.</Say></Response>`);
    params.set("StatusCallback", `${webhookUrl}?responseId=${resp.id}&statusCallback=true`);
    params.set("Record", "true");
    params.set("RecordingStatusCallback", `${webhookUrl}?responseId=${resp.id}&recordingCallback=true`);
    params.set("Timeout", "30");

    const twilioAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const callResp = await fetch(callUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const callData = await callResp.json() as { sid?: string; message?: string };

    if (!callResp.ok || !callData.sid) {
      logger.error({ status: callResp.status, callData }, "Failed to initiate AI call");
      if (reqRow.company_id) await refundCredits(reqRow.company_id, REFCHECK_CREDIT_COST);
      res.status(500).json({ success: false, error: callData.message || "Gagal memulai panggilan" });
      return;
    }

    // Update response record. NOTE: call_transcript is a JSONB column — pass
    // the array directly. Wrapping with JSON.stringify(...) double-encodes the
    // value (Postgres stores it as a JSON string, not an array), which then
    // crashes the frontend with `callTranscript.map is not a function`.
    await supabase.from("_reference_check_responses").update({
      call_status: "in_progress",
      call_sid: callData.sid,
      call_transcript: [{ speaker: "AI", text: greeting, timestamp: new Date().toISOString() }],
    }).eq("id", resp.id);

    logger.info({ responseId: resp.id, callSid: callData.sid }, "AI call initiated");
    res.json({ success: true, callSid: callData.sid });
  } catch (err) {
    logger.error({ err }, "ai-call error");
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Internal error" });
  }
});

// AI call webhook — handles speech results and call status updates
router.post(
  "/ai-call-webhook",
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    const responseId = req.query.responseId as string;
    const isStatusCallback = req.query.statusCallback === "true";
    const isRecordingCallback = req.query.recordingCallback === "true";

    if (!responseId) {
      res.status(200).type("text/xml").send("<Response/>");
      return;
    }

    try {
      const supabase = getSupabase();

      // Handle call status callback (completed, no-answer, busy, failed)
      if (isStatusCallback) {
        const callStatus = (req.body as Record<string, string>).CallStatus || "";
        const duration = parseInt((req.body as Record<string, string>).CallDuration || "0", 10);

        if (["completed", "no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
          const dbStatus = callStatus === "completed" ? "completed"
            : callStatus === "no-answer" ? "no_answer"
            : "failed";

          await supabase.from("_reference_check_responses").update({
            call_status: dbStatus,
            call_duration: duration || null,
          }).eq("id", responseId);

          logger.info({ responseId, callStatus, duration }, "AI call status update");
        }
        res.status(200).type("text/xml").send("<Response/>");
        return;
      }

      // Handle recording callback
      if (isRecordingCallback) {
        const recordingUrl = (req.body as Record<string, string>).RecordingUrl || "";
        if (recordingUrl) {
          await supabase.from("_reference_check_responses").update({
            call_recording_url: recordingUrl,
          }).eq("id", responseId);
        }
        res.status(200).type("text/xml").send("<Response/>");
        return;
      }

      // Handle speech result
      const speechResult = (req.body as Record<string, string>).SpeechResult || "";
      const step = parseInt(req.query.step as string || "1", 10);
      const candidateName = decodeURIComponent(req.query.candidateName as string || "Kandidat");
      const company = decodeURIComponent(req.query.company as string || "");
      const role = decodeURIComponent(req.query.role as string || "");
      const period = decodeURIComponent(req.query.period as string || "");

      if (!speechResult) {
        res.status(200).type("text/xml").send(
          `<Response><Say language="id-ID">Maaf, kami tidak mendengar jawaban. Terima kasih atas waktunya. Selamat siang.</Say></Response>`,
        );
        return;
      }

      // Get existing transcript
      const { data: existing } = await supabase
        .from("_reference_check_responses")
        .select("call_transcript")
        .eq("id", responseId)
        .maybeSingle();

      // Tolerant read: column is JSONB, so supabase-js returns a parsed value.
      // Older rows that were double-stringified (pre-fix) come back as a JSON
      // string — fall back to JSON.parse for those.
      let transcript: Array<{ speaker: string; text: string; timestamp: string }> = [];
      const rawTranscript = (existing as { call_transcript: unknown } | null)?.call_transcript;
      if (Array.isArray(rawTranscript)) {
        transcript = rawTranscript as Array<{ speaker: string; text: string; timestamp: string }>;
      } else if (typeof rawTranscript === "string" && rawTranscript.length > 0) {
        try {
          const parsed = JSON.parse(rawTranscript);
          if (Array.isArray(parsed)) transcript = parsed;
        } catch { /* empty */ }
      }

      transcript.push({ speaker: "Referensi", text: speechResult, timestamp: new Date().toISOString() });

      // AI analysis
      const analysis = await aiAnalyzeCallResponse(
        candidateName, company, role, period, speechResult,
        transcript.map((t) => ({ speaker: t.speaker, text: t.text })),
      );

      // Max 3 steps of conversation
      if (analysis.followUp && step < 3) {
        transcript.push({ speaker: "AI", text: analysis.followUp, timestamp: new Date().toISOString() });

        await supabase.from("_reference_check_responses").update({
          call_transcript: transcript,
        }).eq("id", responseId);

        const baseUrl = getPublicBaseUrl(req);
        const nextUrl = `${baseUrl}/api/reference/ai-call-webhook?responseId=${responseId}&step=${step + 1}&candidateName=${encodeURIComponent(candidateName)}&company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&period=${encodeURIComponent(period)}`;

        res.status(200).type("text/xml").send(
          `<Response><Say language="id-ID" voice="Google.id-ID-Standard-A">${analysis.followUp}</Say><Gather input="speech" language="id-ID" speechTimeout="auto" action="${nextUrl}"><Say language="id-ID">Silakan jawab.</Say></Gather><Say language="id-ID">Terima kasih atas waktunya. Selamat siang.</Say></Response>`,
        );
      } else {
        // Conversation done
        const closing = analysis.status === "confirmed"
          ? "Terima kasih atas konfirmasinya. Informasi ini sangat membantu. Selamat siang."
          : analysis.status === "denied"
          ? "Terima kasih atas informasinya. Kami akan meninjau lebih lanjut. Selamat siang."
          : "Terima kasih atas waktunya. Selamat siang.";

        transcript.push({ speaker: "AI", text: closing, timestamp: new Date().toISOString() });

        const refStatus = analysis.status === "confirmed" ? "confirmed"
          : analysis.status === "denied" ? "denied"
          : "pending";

        await supabase.from("_reference_check_responses").update({
          call_transcript: transcript,
          call_analysis: {
            confirmed: analysis.status === "confirmed",
            status: analysis.status,
            reasoning: analysis.reasoning,
          },
          call_status: "completed",
          status: refStatus,
          response_text: `[AI CALL] ${analysis.reasoning}`,
          responded_at: new Date().toISOString(),
        }).eq("id", responseId);

        res.status(200).type("text/xml").send(
          `<Response><Say language="id-ID" voice="Google.id-ID-Standard-A">${closing}</Say></Response>`,
        );
      }
    } catch (err) {
      logger.error({ err }, "ai-call-webhook error");
      res.status(200).type("text/xml").send("<Response><Say language=\"id-ID\">Maaf terjadi kesalahan. Selamat siang.</Say></Response>");
    }
  },
);

export default router;
