/**
 * BACKEND FRAUDGUARD SAAS WITH RESEND
 * Email System: Resend API
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const https = require("https");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { Resend } = require("resend");

admin.initializeApp();
const db = getFirestore();

// --- RESEND API KEY ---
const RESEND_API_KEY = "re_Wiu4xU4c_ELdXgCYQNw9DoXgaDJb4KDYF";
const resend = new Resend(RESEND_API_KEY);

// --- EMAIL SENDERS ---
const EMAIL_SENDERS = {
  business: "no-reply@hiregood.one",
  interview: "interview@hiregood.one"
};

// --- AI SECRETS ---
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// --- DIDIT CONFIG ---
const DIDIT_WEBHOOK_SECRET = "wU3IKNEZeXakCk1uYidDcEXlaob5mFPQOWSL1vdTl6I";
const DIDIT_API_KEY = 'D4zB7mddYLCa_4gCnifsFg3iU3BoMzVQBg3k2_Te910';
const DIDIT_FLOW_ID = 'f6eb1a67-47c4-4668-960a-1baab821f388';

// ==========================================
// EMAIL TEMPLATES
// ==========================================

const EMAIL_TEMPLATES = {
  // Template untuk undangan bisnis/company
  businessInvitation: (companyName, adminEmail, tier, password) => ({
    from: EMAIL_SENDERS.business,
    subject: `Undangan Bergabung - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #CC5500 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">HireGood</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95;">Integrity-First Hiring Platform</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Selamat Datang, ${companyName}!</h2>

                    <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Akun Enterprise Anda telah berhasil didaftarkan di platform <strong>HireGood</strong>.
                      Berikut adalah detail langganan dan kredensial login Anda:
                    </p>

                    <!-- Info Table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                      <tr style="background-color: #f9f9f9;">
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #333333; width: 40%;">Paket</td>
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; color: #555555;">${tier}</td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #333333;">Status</td>
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; color: #10B981; font-weight: 600;">✅ Aktif</td>
                      </tr>
                      <tr style="background-color: #f9f9f9;">
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #333333;">Admin Email</td>
                        <td style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; color: #555555;">${adminEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 20px; font-weight: 600; color: #333333;">Password</td>
                        <td style="padding: 15px 20px; color: #CC5500; font-weight: 700; font-family: 'Courier New', monospace; font-size: 18px; letter-spacing: 1px;">${password}</td>
                      </tr>
                    </table>

                    <!-- Security Notice -->
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; color: #92400E; font-size: 14px; font-weight: 600;">🔒 Penting - Keamanan Akun:</p>
                      <ul style="margin: 0; padding-left: 20px; color: #78350F; font-size: 14px; line-height: 1.8;">
                        <li>Segera ubah password setelah login pertama</li>
                        <li>Jangan bagikan kredensial ini kepada siapapun</li>
                        <li>Simpan password di tempat yang aman</li>
                      </ul>
                    </div>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="https://app.hiregood.one" style="display: inline-block; background: linear-gradient(135deg, #CC5500 0%, #FF6B35 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(204, 85, 0, 0.3);">
                            Masuk ke Dashboard →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 30px 0 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                      Jika Anda memiliki pertanyaan, silakan hubungi tim support kami melalui email ini.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                      Email ini dikirim otomatis oleh sistem HireGood<br>
                      © ${new Date().getFullYear()} HireGood. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  // Template untuk undangan interview kandidat
  candidateInvitation: (candidateName, candidateEmail, companyName, accessCode, assessmentLink, role = "") => ({
    from: EMAIL_SENDERS.interview,
    subject: `Undangan Assessment - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${companyName}</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95;">Integrity Assessment Invitation</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Halo, ${candidateName}! 👋</h2>

                    <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Anda telah diundang untuk mengikuti <strong>Integrity Assessment</strong> sebagai bagian dari proses rekrutmen di <strong>${companyName}</strong>${role ? ` untuk posisi <strong>${role}</strong>` : ''}.
                    </p>

                    <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Assessment ini dirancang untuk mengevaluasi kesesuaian kandidat dengan nilai-nilai integritas perusahaan kami.
                    </p>

                    <!-- Access Code Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #F0F9FF; border: 2px solid #2563EB; border-radius: 8px;">
                      <tr>
                        <td style="padding: 25px 20px; text-align: center;">
                          <p style="margin: 0 0 10px 0; color: #1E40AF; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kode Akses Anda</p>
                          <p style="margin: 0; color: #2563EB; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 4px;">${accessCode}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Instructions -->
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; color: #92400E; font-size: 14px; font-weight: 600;">📋 Instruksi:</p>
                      <ol style="margin: 0; padding-left: 20px; color: #78350F; font-size: 14px; line-height: 1.8;">
                        <li>Klik tombol "Mulai Assessment" di bawah</li>
                        <li>Masukkan <strong>Kode Akses</strong> di atas</li>
                        <li>Jawab semua pertanyaan dengan jujur dan teliti</li>
                        <li>Assessment memakan waktu sekitar <strong>20-30 menit</strong></li>
                      </ol>
                    </div>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${assessmentLink}" style="display: inline-block; background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                            🚀 Mulai Assessment Sekarang
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Additional Info -->
                    <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin-top: 25px;">
                      <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px; font-weight: 600;">ℹ️ Informasi Penting:</p>
                      <ul style="margin: 0; padding-left: 20px; color: #6B7280; font-size: 13px; line-height: 1.8;">
                        <li>Link assessment berlaku untuk <strong>1x akses</strong> per kode</li>
                        <li>Pastikan koneksi internet stabil selama assessment</li>
                        <li>Kerjakan di lingkungan yang tenang dan fokus</li>
                        <li>Tidak ada jawaban benar atau salah - jawab sejujurnya</li>
                      </ul>
                    </div>

                    <p style="margin: 30px 0 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                      Jika Anda mengalami kendala teknis, silakan balas email ini atau hubungi tim HR kami.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0 0 5px 0; color: #999999; font-size: 12px;">
                      <strong>${companyName}</strong> menggunakan platform HireGood untuk proses rekrutmen
                    </p>
                    <p style="margin: 0; color: #CCCCCC; font-size: 11px;">
                      © ${new Date().getFullYear()} Powered by HireGood - Integrity-First Hiring
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  // Template untuk password reset
  passwordReset: (candidateName, tempPassword, loginUrl) => ({
    from: EMAIL_SENDERS.business,
    subject: `Reset Password - HireGood`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); padding: 40px 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Reset Password</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Halo, ${candidateName}!</h2>

                    <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Kami telah menerima permintaan reset password untuk akun Anda di <strong>HireGood</strong>.
                    </p>

                    <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Berikut adalah password sementara Anda:
                    </p>

                    <!-- Password Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #FEF2F2; border: 2px solid #DC2626; border-radius: 8px;">
                      <tr>
                        <td style="padding: 25px 20px; text-align: center;">
                          <p style="margin: 0 0 10px 0; color: #991B1B; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Password Sementara</p>
                          <p style="margin: 0; color: #DC2626; font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${tempPassword}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Instructions -->
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; color: #92400E; font-size: 14px; font-weight: 600;">⚠️ Penting:</p>
                      <ul style="margin: 0; padding-left: 20px; color: #78350F; font-size: 14px; line-height: 1.8;">
                        <li>Gunakan password sementara di atas untuk login</li>
                        <li>Segera ubah password setelah login pertama</li>
                        <li>Jangan bagikan password ini kepada siapapun</li>
                        <li>Password ini berlaku untuk 1x login pertama</li>
                      </ul>
                    </div>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
                            🔓 Login Sekarang
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 30px 0 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                      Jika Anda tidak meminta reset password, abaikan email ini atau hubungi tim support kami.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                      Email ini dikirim otomatis oleh sistem HireGood<br>
                      © ${new Date().getFullYear()} HireGood. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  // Template untuk assessment complete
  assessmentComplete: (candidateName, candidateEmail, companyName) => ({
    from: EMAIL_SENDERS.interview,
    subject: `Terima Kasih - Assessment Selesai`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10B981 0%, #34D399 100%); padding: 40px 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Assessment Selesai!</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Terima kasih, ${candidateName}!</h2>

                    <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Anda telah berhasil menyelesaikan Integrity Assessment untuk <strong>${companyName}</strong>.
                    </p>

                    <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                      Hasil assessment Anda telah tersimpan dengan aman dan saat ini sedang dalam proses review oleh tim HR kami.
                    </p>

                    <!-- Status Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #ECFDF5; border: 2px solid #10B981; border-radius: 8px;">
                      <tr>
                        <td style="padding: 25px 20px; text-align: center;">
                          <p style="margin: 0 0 10px 0; color: #065F46; font-size: 14px; font-weight: 600;">Status Rekrutmen</p>
                          <p style="margin: 0; color: #10B981; font-size: 18px; font-weight: 700;">✓ Assessment Completed - Under Review</p>
                        </td>
                      </tr>
                    </table>

                    <div style="background-color: #F0F9FF; border-left: 4px solid #2563EB; padding: 20px; margin: 25px 0; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">🔔 Langkah Selanjutnya:</p>
                      <ul style="margin: 0; padding-left: 20px; color: #1E40AF; font-size: 14px; line-height: 1.8;">
                        <li>Tim HR akan meninjau hasil assessment Anda</li>
                        <li>Kami akan menghubungi Anda melalui email dalam <strong>2-3 hari kerja</strong></li>
                        <li>Pastikan untuk memeriksa kotak masuk email secara berkala</li>
                      </ul>
                    </div>

                    <p style="margin: 30px 0 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                      Terima kasih atas partisipasi Anda. Semoga sukses! 🎉
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0 0 5px 0; color: #999999; font-size: 12px;">
                      <strong>${companyName}</strong>
                    </p>
                    <p style="margin: 0; color: #CCCCCC; font-size: 11px;">
                      © ${new Date().getFullYear()} Powered by HireGood
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  })
};

// ==========================================
// FUNGSI 1: SEND EMAIL (UNIVERSAL)
// ==========================================
exports.sendEmail = onCall({ region: "europe-west1", cors: true }, async (request) => {
  const { type, to, data } = request.data;

  if (!type || !to) {
    throw new HttpsError('invalid-argument', 'Parameter type dan to wajib diisi');
  }

  try {
    let emailTemplate;

    switch(type) {
      case 'business_invitation':
        emailTemplate = EMAIL_TEMPLATES.businessInvitation(
          data.companyName,
          data.adminEmail,
          data.tier,
          data.password
        );
        break;

      case 'candidate_invitation':
        emailTemplate = EMAIL_TEMPLATES.candidateInvitation(
          data.candidateName,
          data.candidateEmail,
          data.companyName,
          data.accessCode,
          data.assessmentLink,
          data.role
        );
        break;

      case 'assessment_complete':
        emailTemplate = EMAIL_TEMPLATES.assessmentComplete(
          data.candidateName,
          data.candidateEmail,
          data.companyName
        );
        break;

      case 'password_reset':
        emailTemplate = EMAIL_TEMPLATES.passwordReset(
          data.candidateName,
          data.tempPassword,
          data.loginUrl
        );
        break;

      default:
        throw new HttpsError('invalid-argument', `Email type '${type}' tidak dikenal`);
    }

    logger.info(`[EMAIL] Sending ${type} to ${to}`);

    const result = await resend.emails.send({
      from: emailTemplate.from,
      to: to,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });

    logger.info(`[EMAIL] Success! ID: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
      message: 'Email berhasil dikirim'
    };

  } catch (error) {
    logger.error('[EMAIL] Error:', error);
    throw new HttpsError('internal', `Gagal mengirim email: ${error.message}`);
  }
});

// ==========================================
// HELPER: AI FALLBACK (Gemini 2.0 -> GPT-4o)
// ==========================================
async function generateWithFallback(prompt, secrets, options = {}) {
  let responseText = "";
  let usedModel = "gemini-2.0-flash-exp";

  try {
    const genAI = new GoogleGenerativeAI(secrets.gemini.value());
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    responseText = response.text();
    responseText = responseText.replace(/^AI:/i, "").replace(/^Interviewer:/i, "").trim();

  } catch (geminiError) {
    logger.warn(`Gemini Gagal (${geminiError.message}). Beralih ke GPT-4o...`);

    try {
      usedModel = "GPT-4o";
      const { OpenAI } = require("openai");
      const openai = new OpenAI({ apiKey: secrets.openai.value() });

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o",
        max_tokens: options.maxTokens || 1500,
        temperature: options.temperature || 0.7
      });

      responseText = completion.choices[0].message.content;

    } catch (openaiError) {
      logger.error("Semua AI gagal:", openaiError.message);
      throw new Error("Sistem AI sedang sibuk. Silakan coba sesaat lagi.");
    }
  }

  return { text: responseText, model: usedModel };
}

// ==========================================
// FUNGSI 2: CHAT AI (PERSONA: NATURAL PROBING)
// ==========================================
exports.generateAIResponse = onCall(
  {
    region: "europe-west1",
    cors: true,
    secrets: [geminiApiKey, openaiApiKey]
  },
  async (request) => {
    const { prompt, assessmentData, history, role } = request.data;

    if (!prompt) throw new HttpsError('invalid-argument', 'Prompt kosong');

    let assessmentContext = "";

    if (assessmentData) {
        const { structuredAssessment, sjtResults, financialStrainResults } = assessmentData;

        if (structuredAssessment?.length > 0) {
            assessmentContext += 'FRAUD RISK INDICATORS (Pressure/Opportunity/Rationalization):\n';
            structuredAssessment.forEach(item => {
                const score = typeof item.response === 'number' ? item.response : 0;
                if (score >= 4 || score <= 2) {
                   assessmentContext += `- Topik: "${item.category}" | Skor: ${score}/5 (Perlu digali)\n`;
                }
            });
        }

        if (sjtResults?.length > 0) {
            assessmentContext += '\nBEHAVIORAL CHOICES (Studi Kasus):\n';
            sjtResults.forEach((item, idx) => {
                const selected = item.options[item.selectedOptionIndex || 0];
                if (selected) {
                    assessmentContext += `- Skenario ${idx+1}: Memilih "${selected.label}" (Risk: ${selected.riskWeight})\n`;
                }
            });
        }
    }

    if (!assessmentContext) assessmentContext = "Data assessment tidak tersedia. Lakukan interview behavioral standar.";

    const contextHistory = (history || []).slice(-6).map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');

    const systemPrompt = `
PERAN: Anda adalah "Alex", HR Interviewer untuk posisi ${role || 'Karyawan'}.
TUJUAN: Menggali integritas kandidat secara natural (seperti ngobrol) tapi tajam.

ATURAN UTAMA (DILARANG KERAS):
1. JANGAN PERNAH menyebutkan kata "Assessment", "Skor", "Fraud Triangle", "Hasil Tes", atau "Data Anda". Data di bawah ini RAHASIA.
2. JANGAN intro panjang lebar ("Terima kasih", "Mari kita mulai", "Pertanyaan saya adalah"). LANGSUNG TANYA.
3. MAKSIMAL 2 KALIMAT. Pendek, padat, menohok.
4. Gunakan Bahasa Indonesia yang natural dan mengalir (tidak kaku).

DATA RAHASIA KANDIDAT (GUNAKAN SEBAGAI ALASAN BERTANYA, TAPI JANGAN DIUCAPKAN):
${assessmentContext}

STRATEGI BERTANYA:
- Gunakan data rahasia sebagai *landasan* kecurigaan, tapi bungkus pertanyaannya seolah-olah topik umum.
- Jika skor Pressure tinggi -> Tanya soal manajemen keuangan/gaya hidup saat krisis.
- Jika skor Opportunity tinggi -> Tanya soal celah aturan/pengawasan.
- Jika SJT memilih opsi abu-abu -> Tanya soal dilema etika vs target.

CONTOH UBAHAN GAYA BICARA:
❌ SALAH: "Karena skor pressure Anda 5/5, apakah Anda punya hutang?" (Terlalu kaku & membocorkan data)
✅ BENAR: "Bicara soal tekanan hidup, pernahkah Anda berada di situasi mendesak di mana gaji bulanan saja tidak cukup? Apa yang Anda lakukan saat itu?" (Natural & Probing)

❌ SALAH: "Di skenario 2 Anda memilih memalsukan data. Jelaskan."
✅ BENAR: "Terkadang aturan perusahaan terasa kaku demi mengejar target tim. Jika atasan meminta sedikit 'penyesuaian' laporan agar semua aman, bagaimana respon Anda?"

RIWAYAT OBROLAN TERAKHIR:
${contextHistory}

JAWABAN TERAKHIR KANDIDAT:
"${prompt}"

RESPON ALEX (Anda):
    `;

    try {
      const result = await generateWithFallback(systemPrompt, {
        gemini: geminiApiKey,
        openai: openaiApiKey
      });

      return { success: true, response: result.text, provider: result.model };
    } catch (error) {
      throw new HttpsError('internal', error.message);
    }
  }
);

// ==========================================
// FUNGSI 3: ANALISIS FRAUD (FIXED - SPESIFIK PER KANDIDAT)
// ==========================================
exports.analyzeFraudRisk = onCall(
  {
    region: "europe-west1",
    cors: true,
    secrets: [geminiApiKey, openaiApiKey]
  },
  async (request) => {
    const { role, history, structuredAssessment, sjtResults, financialStrainResults } = request.data;

    if (!role || !history || !structuredAssessment) {
      throw new HttpsError('invalid-argument', 'Parameter role, history, dan structuredAssessment wajib diisi.');
    }

    const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');

    const assessmentSummary = structuredAssessment.map(item =>
      `[${item.category.toUpperCase()}] "${item.question}" -> Jawaban: ${item.response}/5`
    ).join('\n');

    const sjtSummary = (sjtResults || []).map((item, idx) => {
      const selected = item.options[item.selectedOptionIndex || 0] || {};
      return `[SJT #${idx+1}] Skenario: "${item.scenario.substring(0,60)}..." -> Pilihan: "${selected.label}" (Risk: ${selected.riskWeight})`;
    }).join('\n');

    const financialSummary = (financialStrainResults || []).map(item =>
      `[FINANCIAL] "${item.question}" -> Skor: ${item.response}/5`
    ).join('\n');

    const analysisPrompt = `
SISTEM: Anda adalah Senior Fraud Analyst yang ahli dalam analisis behavioral dan integrity assessment.

=== DATA KANDIDAT: ${role} ===

1. JAWABAN ASSESSMENT TERSTRUKTUR:
${assessmentSummary}

2. SITUATIONAL JUDGMENT TEST (SJT):
${sjtSummary}

3. FINANCIAL STRAIN INDICATORS:
${financialSummary || 'Data tidak tersedia'}

4. TRANSKRIP WAWANCARA:
${context}

=== INSTRUKSI ANALISIS KRITIS ===

ANDA HARUS MENGANALISIS DATA **SPESIFIK** KANDIDAT INI. JANGAN GUNAKAN RED FLAGS GENERIC!

**LANGKAH WAJIB:**

1. **SCORES CALCULATION (0-100 untuk setiap kategori):**
   - **Pressure**: Hitung berdasarkan jawaban financial strain, tekanan hidup, urgensi dalam jawaban interview
   - **Opportunity**: Nilai pemahaman kandidat terhadap celah sistem, akses ke sumber daya, kesadaran kontrol internal
   - **Rationalization**: Identifikasi pola justifikasi perilaku tidak etis, moral disengagement, blame attribution

2. **RED FLAGS - HARUS SPESIFIK KE KANDIDAT INI:**

   ✅ **CONTOH RED FLAGS YANG BENAR (SPESIFIK):**
   - "Kandidat menjawab 5/5 pada pertanyaan tentang tekanan target - menunjukkan stress tinggi terkait performance"
   - "Dalam transkrip baris 12, kandidat menyebutkan 'kadang aturan terlalu kaku untuk situasi darurat' - pola rasionalisasi"
   - "Di SJT #2 tentang conflict of interest, kandidat memilih opsi 'critical risk' - menunjukkan fleksibilitas etika berlebihan"
   - "Kandidat mengaku pernah 'meminjam uang perusahaan sementara' di jawaban interview - red flag langsung"

   ❌ **CONTOH RED FLAGS YANG SALAH (GENERIC - JANGAN SEPERTI INI):**
   - "Kandidat menunjukkan potensi ketidakjujuran" (Tidak spesifik! Dari mana?)
   - "Terdapat indikasi tekanan finansial" (Generic! Berdasarkan jawaban yang mana?)
   - "Pola jawaban tidak konsisten" (Harus sebutkan inkonsistensi SPESIFIK yang mana!)
   - "Kandidat berisiko melakukan fraud" (Terlalu vague!)

3. **JIKA KANDIDAT TIDAK BERMASALAH:**
   - Jika tidak ada perilaku mencurigakan, kembalikan **redFlags: []** (array kosong)
   - Berikan skor rendah (20-35 range)
   - Summary harus positif dan objektif

4. **CONSISTENCY SCORE (0-100):**
   Bandingkan jawaban assessment vs interview. Cari kontradiksi atau konfirmasi.
   - 90-100: Sangat konsisten
   - 70-89: Konsisten dengan minor discrepancy
   - 50-69: Ada beberapa inkonsistensi
   - 0-49: Banyak kontradiksi

5. **SENTIMENT BREAKDOWN:**
   Analisis tone interview: positive (kooperatif, optimis), neutral (faktual), negative (defensif, hostile)

=== OUTPUT FORMAT (VALID JSON ONLY) ===

{
  "scores": {
    "pressure": <number 0-100>,
    "opportunity": <number 0-100>,
    "rationalization": <number 0-100>
  },
  "riskLevel": "Low|Medium|High|Critical",
  "summary": "<2-3 paragraf dalam Bahasa Indonesia yang menjelaskan analisis SPESIFIK kandidat ini, bukan template generic>",
  "redFlags": [<array of SPECIFIC red flags dalam Bahasa Indonesia, ATAU [] jika tidak ada>],
  "recommendation": "<rekomendasi spesifik dalam Bahasa Indonesia berdasarkan temuan>",
  "consistencyScore": <number 0-100>,
  "euphemismScore": <number 0-100 - deteksi penggunaan bahasa euphemistic untuk menutupi perilaku tidak etis>,
  "sentimentBreakdown": {
    "positive": <number>,
    "neutral": <number>,
    "negative": <number>
  },
  "benchmarkComparison": {
    "candidateAvg": <rata-rata scores>,
    "companyAvg": <45-55>,
    "industryAvg": <40-50>
  }
}

**PENTING:** Response Anda HARUS HANYA berisi JSON yang valid, tanpa markdown wrapper (\`\`\`json), tanpa penjelasan tambahan.
`;

    try {
      const result = await generateWithFallback(analysisPrompt, {
        gemini: geminiApiKey,
        openai: openaiApiKey
      }, { maxTokens: 2000, temperature: 0.5 });

      let cleanJson = result.text.replace(/```json\s*|\s*```/g, '').trim();
      const analysis = JSON.parse(cleanJson);

      logger.info(`[ANALYSIS] Completed using ${result.model} for role: ${role}`);

      return {
        success: true,
        analysis: analysis,
        provider: result.model
      };

    } catch (error) {
      logger.error("[ANALYSIS] Error:", error);

      // FALLBACK MANUAL CALCULATION
      const categoryScores = { pressure: 0, opportunity: 0, rationalization: 0 };
      const categoryCounts = { pressure: 0, opportunity: 0, rationalization: 0 };

      structuredAssessment.forEach((item) => {
        const score = typeof item.response === 'number' ? item.response :
                      item.response === 'high' ? 5 :
                      item.response === 'medium' ? 3 : 1;

        if (item.category === 'pressure' || item.category === 'opportunity' || item.category === 'rationalization') {
          categoryScores[item.category] += score;
          categoryCounts[item.category]++;
        }
      });

      const pressureScore = categoryCounts.pressure ? (categoryScores.pressure / (categoryCounts.pressure * 5)) * 100 : 50;
      const opportunityScore = categoryCounts.opportunity ? (categoryScores.opportunity / (categoryCounts.opportunity * 5)) * 100 : 50;
      const rationalizationScore = categoryCounts.rationalization ? (categoryScores.rationalization / (categoryCounts.rationalization * 5)) * 100 : 50;

      const scores = {
        pressure: Math.round(pressureScore),
        opportunity: Math.round(opportunityScore),
        rationalization: Math.round(rationalizationScore)
      };

      const avgScore = Math.round((scores.pressure + scores.opportunity + scores.rationalization) / 3);

      const redFlags = [];
      if (scores.pressure > 60) {
        redFlags.push("Kandidat menunjukkan indikator tekanan finansial tinggi berdasarkan jawaban assessment.");
      }
      if (scores.opportunity > 60) {
        redFlags.push("Terdapat indikasi pemahaman kandidat terhadap celah dalam sistem kontrol internal.");
      }
      if (scores.rationalization > 60) {
        redFlags.push("Pola jawaban menunjukkan kecenderungan rasionalisasi perilaku tidak etis.");
      }

      if (sjtResults && sjtResults.length > 0) {
        let highRiskChoices = 0;
        sjtResults.forEach(item => {
          if (item.selectedOptionIndex !== null) {
            const risk = item.options[item.selectedOptionIndex].riskWeight;
            if (risk === 'critical' || risk === 'high') {
              highRiskChoices++;
            }
          }
        });
        if (highRiskChoices > 0) {
          redFlags.push(`Kandidat memilih ${highRiskChoices} opsi berisiko tinggi dalam skenario situational judgment.`);
        }
      }

      if (redFlags.length === 0) {
        redFlags.push("Profil risiko dalam batas wajar berdasarkan kalkulasi manual.");
      }

      redFlags.push("⚠️ Analisis AI tidak tersedia - hasil berdasarkan kalkulasi manual.");

      let riskLevel = "Low";
      if (avgScore > 70) riskLevel = "Critical";
      else if (avgScore > 55) riskLevel = "High";
      else if (avgScore > 35) riskLevel = "Medium";

      const summary = `Kandidat menunjukkan profil risiko ${riskLevel.toLowerCase()} dengan skor tekanan ${scores.pressure}, peluang ${scores.opportunity}, dan rasionalisasi ${scores.rationalization}. Analisis AI gagal, hasil ini berdasarkan kalkulasi manual. Disarankan review manual transkrip wawancara.`;

      return {
        success: true,
        analysis: {
          scores: scores,
          riskLevel: riskLevel,
          summary: summary,
          redFlags: redFlags,
          recommendation: "Review manual diperlukan. Verifikasi latar belakang dan referensi kerja sebelumnya.",
          consistencyScore: 0,
          euphemismScore: 0,
          sentimentBreakdown: { positive: 33, neutral: 34, negative: 33 },
          benchmarkComparison: { candidateAvg: avgScore, companyAvg: 48, industryAvg: 45 }
        },
        provider: 'manual-fallback'
      };
    }
  }
);

// ==========================================
// FUNGSI 4: DIDIT WEBHOOK
// ==========================================
exports.diditWebhook = onRequest({ region: "europe-west1", cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-signature'] || req.headers['X-Signature'];
    const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];

    if (!signature || !timestamp) {
      logger.error('[DIDIT-WEBHOOK] Missing signature');
      res.status(401).send('Missing signature');
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', DIDIT_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.error('[DIDIT-WEBHOOK] Invalid signature');
      res.status(401).send('Invalid signature');
      return;
    }

    const { session_id, status, webhook_type, vendor_data, decision } = req.body;

    if (webhook_type === 'status.updated') {
      let mappedStatus = 'pending';
      if (status === 'Approved') mappedStatus = 'approved';
      else if (status === 'Declined' || status === 'Abandoned') mappedStatus = 'declined';
      else if (status === 'In Review') mappedStatus = 'in_review';
      else if (status === 'In Progress') mappedStatus = 'in_progress';

      if (vendor_data) {
        logger.info(`[DIDIT-WEBHOOK] Updating session: ${vendor_data} -> ${mappedStatus}`);

        const updateData = {
          'backgroundCheck.status': mappedStatus,
          'backgroundCheck.lastUpdated': new Date().toISOString(),
          'backgroundCheck.diditSessionId': session_id,
          'backgroundCheckStatus': mappedStatus
        };

        if (decision) updateData['backgroundCheck.decision'] = decision;
        if (['approved', 'declined'].includes(mappedStatus)) {
          updateData['backgroundCheckCompletedAt'] = new Date().toISOString();
        }

        await db.collection('interview-sessions').doc(vendor_data).update(updateData);
      }
    } else if (webhook_type === 'data.updated') {
       if (vendor_data) {
        await db.collection('interview-sessions').doc(vendor_data).update({
          'backgroundCheck.dataUpdated': true,
          'backgroundCheck.lastDataUpdate': new Date().toISOString(),
          'backgroundCheck.decision': decision || null
        });
      }
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    logger.error('[DIDIT-WEBHOOK] Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// FUNGSI 5: CREATE DIDIT SESSION
// ==========================================
exports.createDiditSession = onCall({ region: "europe-west1" }, async (request) => {
  const { sessionId, candidateName, candidateEmail } = request.data;
  if (!sessionId || !candidateName || !candidateEmail) {
    throw new HttpsError('invalid-argument', 'Data tidak lengkap.');
  }

  try {
    const payload = JSON.stringify({
      workflow_id: DIDIT_FLOW_ID,
      vendor_data: sessionId,
      callback: 'https://tirtana888-fraudguar-68hf.bolt.host/background-check-callback',
      metadata: { candidate_name: candidateName, candidate_email: candidateEmail, session_id: sessionId }
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'verification.didit.me',
        path: '/v2/session/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DIDIT_API_KEY}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
           if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
           else reject(new Error(`Didit API error: ${res.statusCode} - ${data}`));
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    await db.collection('interview-sessions').doc(sessionId).update({
      'backgroundCheck.diditSessionId': response.session_id,
      'backgroundCheck.status': 'pending',
      'backgroundCheck.createdAt': new Date().toISOString()
    });

    return { success: true, sessionUrl: response.url, sessionId: response.session_id };

  } catch (error) {
    throw new HttpsError('internal', `Failed to create Didit session: ${error.message}`);
  }
});
