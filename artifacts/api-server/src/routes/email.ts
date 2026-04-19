import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { Resend } from "resend";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = "HireGood <noreply@hiregood.one>";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function requireSupabaseAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.warn("Supabase env vars not set — email endpoint blocked");
    res.status(503).json({ success: false, error: "Email service misconfigured" });
    return;
  }
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!userRes.ok) {
      res.status(401).json({ success: false, error: "Invalid or expired session" });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "Failed to verify Supabase token");
    res.status(401).json({ success: false, error: "Auth check failed" });
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>HireGood</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e293b;padding:24px 32px;">
        <span style="color:#f97316;font-size:22px;font-weight:bold;">Hire</span><span style="color:#ffffff;font-size:22px;font-weight:bold;">Good</span>
      </td></tr>
      <tr><td style="padding:32px;">
        ${content}
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
        © ${new Date().getFullYear()} HireGood · hiregood.one
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btnStyle(color = "#f97316"): string {
  return `display:inline-block;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;`;
}

const templates: Record<string, (data: Record<string, string>) => { subject: string; html: string }> = {
  assessment_invite: ({ candidateName, companyName, inviteLink, roleName = "posisi yang tersedia" }) => ({
    subject: `Undangan Assessment dari ${companyName}`,
    html: baseLayout(`
      <h2 style="color:#1e293b;margin-top:0;">Halo, ${candidateName}! 👋</h2>
      <p style="color:#475569;line-height:1.6;">
        Kamu diundang oleh <strong>${companyName}</strong> untuk mengikuti <strong>assessment integritas</strong>
        sebagai bagian dari proses seleksi untuk posisi <strong>${roleName}</strong>.
      </p>
      <p style="color:#475569;line-height:1.6;">
        Assessment ini dirancang untuk mengenal kamu lebih baik dan memastikan kamu adalah kandidat yang tepat.
        Silakan klik tombol di bawah untuk memulai.
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${inviteLink}" style="${btnStyle()}">Mulai Assessment →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px;">
        Link ini bersifat pribadi — mohon jangan dibagikan ke orang lain.
        Jika kamu tidak mendaftar ke posisi ini, abaikan email ini.
      </p>
    `, `${companyName} mengundangmu untuk assessment integritas`),
  }),

  candidate_welcome: ({ candidateName, companyName, assessmentLink }) => ({
    subject: `Lamaran Diterima — ${companyName}`,
    html: baseLayout(`
      <h2 style="color:#1e293b;margin-top:0;">Halo, ${candidateName}! 🎉</h2>
      <p style="color:#475569;line-height:1.6;">
        Lamaran kamu di <strong>${companyName}</strong> telah kami terima.
        Kami akan segera meninjau profil dan CV kamu.
      </p>
      <p style="color:#475569;line-height:1.6;">
        Sebagai langkah selanjutnya, kami meminta kamu untuk menyelesaikan
        <strong>assessment integritas singkat</strong> agar kami dapat mengenal kamu lebih baik.
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${assessmentLink}" style="${btnStyle()}">Mulai Assessment →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px;">Semangat dan sukses! Tim rekrutmen ${companyName}.</p>
    `, `Lamaran kamu di ${companyName} telah diterima`),
  }),

  assessment_complete: ({ candidateName, companyName }) => ({
    subject: `Assessment Selesai — Terima Kasih, ${candidateName}!`,
    html: baseLayout(`
      <h2 style="color:#1e293b;margin-top:0;">Assessment Selesai ✅</h2>
      <p style="color:#475569;line-height:1.6;">
        Halo <strong>${candidateName}</strong>, terima kasih telah menyelesaikan assessment untuk
        <strong>${companyName}</strong>.
      </p>
      <p style="color:#475569;line-height:1.6;">
        Hasilmu sedang kami proses. Tim rekrutmen akan menghubungimu dalam waktu dekat
        mengenai langkah selanjutnya.
      </p>
      <p style="color:#94a3b8;font-size:13px;">Terima kasih atas waktumu. Semoga berhasil! 🙏</p>
    `, `Assessment kamu di ${companyName} telah selesai`),
  }),

  hire_notification: ({ candidateName, companyName, hireDate, hireTime, contactPerson }) => ({
    subject: `Selamat! Kamu Diterima di ${companyName} 🎊`,
    html: baseLayout(`
      <h2 style="color:#1e293b;margin-top:0;">Selamat, ${candidateName}! 🎊</h2>
      <p style="color:#475569;line-height:1.6;">
        Kami dengan senang hati mengumumkan bahwa kamu <strong>diterima</strong> untuk bergabung
        bersama <strong>${companyName}</strong>!
      </p>
      ${hireDate ? `
      <table style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:24px 0;width:100%;box-sizing:border-box;" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 8px;color:#166534;font-weight:bold;">Detail Bergabung</p>
          <p style="margin:0;color:#15803d;">📅 Tanggal: <strong>${hireDate}</strong></p>
          ${hireTime ? `<p style="margin:4px 0 0;color:#15803d;">🕐 Waktu: <strong>${hireTime}</strong></p>` : ""}
          ${contactPerson ? `<p style="margin:4px 0 0;color:#15803d;">👤 Contact Person: <strong>${contactPerson}</strong></p>` : ""}
        </td></tr>
      </table>` : ""}
      <p style="color:#94a3b8;font-size:13px;">Selamat bergabung! Kami tidak sabar untuk bertemu denganmu. 🙌</p>
    `, `Selamat! Kamu diterima di ${companyName}`),
  }),

  rejection_notification: ({ candidateName, companyName }) => ({
    subject: `Hasil Seleksi — ${companyName}`,
    html: baseLayout(`
      <h2 style="color:#1e293b;margin-top:0;">Halo, ${candidateName}</h2>
      <p style="color:#475569;line-height:1.6;">
        Terima kasih telah meluangkan waktu untuk mengikuti proses seleksi di <strong>${companyName}</strong>.
      </p>
      <p style="color:#475569;line-height:1.6;">
        Setelah melalui proses evaluasi yang cermat, kami memutuskan untuk melanjutkan proses
        dengan kandidat lain yang lebih sesuai dengan kebutuhan kami saat ini.
      </p>
      <p style="color:#475569;line-height:1.6;">
        Kami menghargai antusiasme dan upaya yang telah kamu tunjukkan, dan mendoakan yang terbaik
        untuk perjalanan kariermu ke depan.
      </p>
      <p style="color:#94a3b8;font-size:13px;">Terima kasih, Tim Rekrutmen ${companyName}.</p>
    `, `Hasil seleksi dari ${companyName}`),
  }),
};

// ─── POST /api/send-email ──────────────────────────────────────────────────────

router.post("/send-email", requireSupabaseAuth, async (req: Request, res: Response) => {
  const { emailType, to_email, emailData = {} } = req.body as {
    emailType: string;
    to_email: string;
    emailData: Record<string, string>;
  };

  if (!to_email || !emailType) {
    res.status(400).json({ success: false, error: "Missing required fields: emailType, to_email" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    logger.warn({ emailType, to_email }, "RESEND_API_KEY not configured — email not sent");
    res.status(200).json({ success: false, error: "RESEND_API_KEY not configured" });
    return;
  }

  const templateFn = templates[emailType];
  if (!templateFn) {
    logger.warn({ emailType }, "Unknown email type");
    res.status(400).json({ success: false, error: `Unknown emailType: ${emailType}` });
    return;
  }

  try {
    const { subject, html } = templateFn(emailData);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to_email],
      subject,
      html,
    });

    if (error) {
      logger.error({ emailType, to_email, error }, "Resend API error");
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    logger.info({ emailType, to_email, id: data?.id }, "Email sent");
    res.json({ success: true, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ emailType, to_email, message }, "Failed to send email");
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
