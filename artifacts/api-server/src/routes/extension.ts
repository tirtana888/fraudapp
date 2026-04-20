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

    const tokenUpper = extensionToken.toUpperCase().trim();
    const { data: record, error } = await supabase
      .from("extension_tokens")
      .select("token, session_id, candidate_email, expires_at, used")
      .eq("token", tokenUpper)
      .maybeSingle();

    if (error) {
      logger.error({ err: error, tokenUpper }, "validate-token db query error");
      res.json({ valid: false, message: `DB error: ${error.message}` });
      return;
    }
    if (!record) {
      logger.info({ tokenUpper }, "Token not found in extension_tokens");
      res.json({ valid: false, message: "Token tidak ditemukan di server ini" });
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

    // Look up the access code for this session (for proctoring) and the candidate URL
    let accessCode = "";
    let candidateUrl = "";
    try {
      const { data: invite } = await supabase
        .from("interview_invites")
        .select("access_code")
        .eq("session_id", record.session_id)
        .maybeSingle();
      if (invite?.access_code) accessCode = invite.access_code;

      const { data: session } = await supabase
        .from("interview_sessions")
        .select('"companyId"')
        .eq("id", record.session_id)
        .maybeSingle();
      if (session?.companyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("slug, customDomain")
          .eq("id", session.companyId)
          .maybeSingle();
        const slug = company?.slug;
        const domain = (company as { customDomain?: string } | null)?.customDomain;
        const base = domain ? `https://${domain}` : "https://hiregood.one";
        if (slug) candidateUrl = `${base}/c/${slug}`;
      }
    } catch (err) {
      logger.warn({ err }, "validate-token: failed to resolve access code / URL");
    }

    res.json({
      valid: true,
      sessionId: record.session_id,
      accessCode,
      candidateUrl,
      config: { candidateEmail: record.candidate_email }
    });
  } catch (err) {
    logger.error({ err }, "validate-token error");
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROCTORING (Task #15): start, event, snapshot, finish
// ─────────────────────────────────────────────────────────────────────────────

async function authProctorToken(extensionToken: string, sessionId: string) {
  const supabase = getSupabase();
  const { data: record } = await supabase
    .from("extension_tokens")
    .select("session_id, expires_at")
    .eq("token", extensionToken.toUpperCase())
    .single();
  if (!record || record.session_id !== sessionId) return { ok: false, reason: "Token tidak valid untuk sesi ini" };
  if (new Date(record.expires_at) < new Date()) return { ok: false, reason: "Token kadaluarsa" };
  return { ok: true, supabase };
}

// POST /api/extension/proctoring/start — record consent + start time
router.post("/proctoring/start", async (req: Request, res: Response) => {
  const { extensionToken, sessionId } = req.body as { extensionToken: string; sessionId: string };
  if (!extensionToken || !sessionId) {
    res.status(400).json({ success: false, error: "extensionToken and sessionId required" });
    return;
  }
  const auth = await authProctorToken(extensionToken, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason });
    return;
  }
  const supabase = auth.supabase!;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("_interview_sessions")
    .update({
      proctoring_consent_at: now,
      proctoring_started_at: now,
      updated_at: now,
    })
    .eq("id", sessionId);
  if (error) logger.warn({ error }, "proctoring/start update failed");
  logger.info({ sessionId }, "Proctoring started");
  res.json({ success: true });
});

// POST /api/extension/proctoring/event — log a single event (tab_switch, blur, etc.)
router.post("/proctoring/event", async (req: Request, res: Response) => {
  const { extensionToken, sessionId, event } = req.body as {
    extensionToken: string;
    sessionId: string;
    event: { type: string; severity?: string; details?: string; timestamp?: string; metadata?: unknown };
  };
  if (!extensionToken || !sessionId || !event?.type) {
    res.status(400).json({ success: false, error: "extensionToken, sessionId, event.type required" });
    return;
  }
  const auth = await authProctorToken(extensionToken, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason });
    return;
  }
  const supabase = auth.supabase!;
  const { error } = await supabase.from("_proctoring_events").insert({
    session_id: sessionId,
    token: extensionToken.toUpperCase(),
    event_type: event.type,
    severity: event.severity || "info",
    details: event.details || null,
    metadata: event.metadata || null,
    occurred_at: event.timestamp || new Date().toISOString(),
  });
  if (error) {
    logger.warn({ error }, "proctoring/event insert failed");
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true });
});

// POST /api/extension/proctoring/snapshot — accept JPEG base64, upload to Supabase Storage
router.post("/proctoring/snapshot", async (req: Request, res: Response) => {
  const { extensionToken, sessionId, imageBase64, width, height } = req.body as {
    extensionToken: string;
    sessionId: string;
    imageBase64: string;
    width?: number;
    height?: number;
  };
  if (!extensionToken || !sessionId || !imageBase64) {
    res.status(400).json({ success: false, error: "extensionToken, sessionId, imageBase64 required" });
    return;
  }
  const auth = await authProctorToken(extensionToken, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason });
    return;
  }
  const supabase = auth.supabase!;
  try {
    const buffer = Buffer.from(imageBase64, "base64");
    const filename = `${sessionId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase
      .storage
      .from("proctoring-snapshots")
      .upload(filename, buffer, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      logger.warn({ upErr }, "snapshot storage upload failed");
      res.status(500).json({ success: false, error: upErr.message });
      return;
    }
    const { error: insErr } = await supabase.from("_proctoring_snapshots").insert({
      session_id: sessionId,
      token: extensionToken.toUpperCase(),
      storage_path: filename,
      width: width || null,
      height: height || null,
      bytes: buffer.byteLength,
    });
    if (insErr) logger.warn({ insErr }, "snapshot row insert failed");
    res.json({ success: true, path: filename });
  } catch (err) {
    logger.error({ err }, "proctoring/snapshot error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// POST /api/extension/proctoring/finish — mark proctoring finished
router.post("/proctoring/finish", async (req: Request, res: Response) => {
  const { extensionToken, sessionId } = req.body as { extensionToken: string; sessionId: string };
  if (!extensionToken || !sessionId) {
    res.status(400).json({ success: false, error: "extensionToken and sessionId required" });
    return;
  }
  const auth = await authProctorToken(extensionToken, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason });
    return;
  }
  const supabase = auth.supabase!;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("_interview_sessions")
    .update({ proctoring_finished_at: now, updated_at: now })
    .eq("id", sessionId);
  if (error) logger.warn({ error }, "proctoring/finish update failed");
  logger.info({ sessionId }, "Proctoring finished");
  res.json({ success: true });
});

// GET /api/extension/proctoring/data?sessionId=… — HR fetches events + signed snapshot URLs
router.get("/proctoring/data", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ success: false, error: "sessionId required" });
    return;
  }
  try {
    const supabase = getSupabase();
    const [eventsRes, snapsRes] = await Promise.all([
      supabase.from("_proctoring_events")
        .select("event_type, severity, details, occurred_at")
        .eq("session_id", sessionId)
        .order("occurred_at", { ascending: true })
        .limit(500),
      supabase.from("_proctoring_snapshots")
        .select("storage_path, taken_at, width, height")
        .eq("session_id", sessionId)
        .order("taken_at", { ascending: true })
        .limit(200),
    ]);

    const events = eventsRes.data || [];
    const snaps = snapsRes.data || [];

    // Generate signed URLs (1 hour) for each snapshot
    const snapshots = await Promise.all(snaps.map(async (s) => {
      const { data } = await supabase.storage
        .from("proctoring-snapshots")
        .createSignedUrl(s.storage_path, 60 * 60);
      return { ...s, url: data?.signedUrl || null };
    }));

    res.json({ success: true, events, snapshots });
  } catch (err) {
    logger.error({ err }, "proctoring/data error");
    res.status(500).json({ success: false, error: "Internal error" });
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
        .from("_interview_sessions")
        .update({ gambling_analysis: gamblingAnalysis, updated_at: new Date().toISOString() })
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
      .from("_interview_sessions")
      .update({ proctoring_data: proctoring, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) logger.warn({ error }, "Failed to update proctoring_data");

    logger.info({ sessionId, score: proctoringData.suspiciousActivityScore }, "Proctoring submitted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "submit-proctoring error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// ── POST /api/extension/send-token-email ─────────────────────────────────────
// Combined: generates a token AND sends the gambling_extension_invite email.
// Called by the frontend when the gambling_screening workflow step activates.

router.post("/send-token-email", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const { sessionId, candidateEmail, candidateName, companyName } = req.body as {
    sessionId: string;
    candidateEmail: string;
    candidateName: string;
    companyName: string;
  };

  if (!sessionId || !candidateEmail || !candidateName || !companyName) {
    res.status(400).json({ success: false, error: "sessionId, candidateEmail, candidateName, companyName required" });
    return;
  }

  try {
    const supabase = getSupabase();

    // Verify session exists
    const { data: session, error: sessionErr } = await supabase
      .from("interview_sessions")
      .select("id, companyId")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    // Check if token already exists for this session (avoid duplicates)
    const { data: existingToken } = await supabase
      .from("extension_tokens")
      .select("token, expires_at, used")
      .eq("session_id", sessionId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token: string;
    let expiresAt: string;

    if (existingToken && new Date(existingToken.expires_at) > new Date()) {
      // Reuse valid existing token
      token = existingToken.token;
      expiresAt = existingToken.expires_at;
      logger.info({ sessionId, token }, "Reusing existing extension token for email");
    } else {
      // Generate a new 6-char uppercase token
      token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
        .join("");
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
      logger.info({ sessionId, token }, "Extension token generated for email");
    }

    // Send the email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      // Token created but email not sent — still return success so frontend knows token exists
      logger.warn("RESEND_API_KEY not configured — token created but email not sent");
      res.json({ success: true, token, expiresAt, emailSent: false });
      return;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const FROM_ADDRESS = "HireGood <noreply@hiregood.one>";
    const subject = `Screening Browser History — ${companyName}`;

    // Build email HTML inline (same template as gambling_extension_invite)
    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>HireGood</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${companyName} mengundangmu untuk screening browser history</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e293b;padding:24px 32px;">
        <span style="color:#f97316;font-size:22px;font-weight:bold;">Hire</span><span style="color:#ffffff;font-size:22px;font-weight:bold;">Good</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#1e293b;margin-top:0;">Halo, ${candidateName}! 🔍</h2>
        <p style="color:#475569;line-height:1.6;">Sebagai bagian dari proses seleksi di <strong>${companyName}</strong>, kami meminta kamu untuk menyelesaikan <strong>screening riwayat browser</strong>.</p>
        <p style="color:#475569;line-height:1.6;">Screening ini menggunakan Chrome Extension <strong>FraudGuard</strong> untuk menganalisis riwayat browsing 30 hari terakhir. Data dienkripsi dan hanya ringkasan risiko yang dikirim ke HR.</p>
        <table style="background:#f0f9ff;border-radius:8px;padding:20px;margin:24px 0;width:100%;box-sizing:border-box;" cellpadding="0" cellspacing="0">
          <tr><td>
            <p style="margin:0 0 12px;color:#0369a1;font-weight:bold;font-size:14px;">📋 Langkah-langkah:</p>
            <ol style="margin:0;padding-left:20px;color:#0c4a6e;font-size:14px;line-height:2;">
              <li>Install Chrome Extension <strong>FraudGuard Screening</strong></li>
              <li>Klik ikon extension di browser Chrome</li>
              <li>Masukkan token di bawah ini</li>
              <li>Baca dan setujui ketentuan, lalu klik <strong>Lanjutkan</strong></li>
            </ol>
          </td></tr>
        </table>
        <div style="text-align:center;margin:28px 0;">
          <p style="color:#64748b;font-size:13px;margin-bottom:8px;">Token Screening Kamu:</p>
          <div style="display:inline-block;padding:14px 32px;background:#1e293b;color:#f97316;font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:6px;border-radius:8px;">${token}</div>
          <p style="color:#94a3b8;font-size:12px;margin-top:8px;">Token berlaku 24 jam</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Token ini bersifat pribadi — mohon jangan dibagikan ke orang lain.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
        © ${new Date().getFullYear()} HireGood · hiregood.one
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [candidateEmail],
      subject,
      html,
    });

    if (emailError) {
      logger.error({ emailError }, "Resend error sending gambling invite");
      // Token is created even if email fails
      res.json({ success: true, token, expiresAt, emailSent: false, emailError: emailError.message });
      return;
    }

    logger.info({ sessionId, emailId: emailData?.id, candidateEmail }, "Gambling extension invite email sent");
    res.json({ success: true, token, expiresAt, emailSent: true, emailId: emailData?.id });
  } catch (err) {
    logger.error({ err }, "send-token-email error");
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

export default router;
