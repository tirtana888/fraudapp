/**
 * BACKEND FRAUDGUARD SAAS
 * Lokasi: functions/index.js
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = getFirestore();

// ==========================================
// KONFIGURASI SMTP (WAJIB DIGANTI SEBELUM DEPLOY)
// ==========================================
const SMTP_CONFIG = {
  user: "email.anda@gmail.com",      // GANTI DENGAN EMAIL GMAIL ASLI ANDA
  pass: "xxxx xxxx xxxx xxxx"        // GANTI DENGAN APP PASSWORD (16 digit)
};
// ==========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_CONFIG.user,
    pass: SMTP_CONFIG.pass
  }
});

/**
 * Fungsi: inviteCompany
 * Trigger: Frontend (ActiveInterview / AdminDashboard)
 * Deskripsi: Menyimpan data perusahaan ke Firestore & Mengirim Email Undangan
 * Region: europe-west1 (Sesuai dengan frontend)
 */
exports.inviteCompany = onCall({ region: "europe-west1" }, async (request) => {
  // 1. Ambil data dari Frontend
  const { name, adminEmail, tier } = request.data;

  // Validasi Input
  if (!name || !adminEmail) {
    throw new HttpsError('invalid-argument', 'Nama Perusahaan dan Email Admin wajib diisi.');
  }

  // Cek apakah email/password masih default (Pencegahan error)
  if (SMTP_CONFIG.pass.includes("xxxx")) {
     throw new HttpsError('failed-precondition', 'Server belum dikonfigurasi dengan App Password Gmail yang benar.');
  }

  try {
    console.log(`[START] Processing Invite for: ${name} (${adminEmail})`);

    // 2. Simpan ke Firestore (Server Side)
    const companyRef = db.collection("companies").doc();
    const companyData = {
      name: name,
      adminEmail: adminEmail,
      tier: tier || "Basic",
      status: "Pending", // Default pending sampai diaktivasi
      joinedDate: new Date().toISOString(),
      usersCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth ? request.auth.uid : 'system'
    };
    
    await companyRef.set(companyData);
    console.log(`[DB] Company saved with ID: ${companyRef.id}`);

    // 3. Kirim Email via Nodemailer
    const mailOptions = {
      from: `"FraudGuard Admin" <${SMTP_CONFIG.user}>`,
      to: adminEmail,
      subject: `Undangan Bergabung - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #CC5500; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">FraudGuard SaaS</h2>
          </div>
          <div style="padding: 30px;">
            <h3 style="color: #333;">Selamat Datang, ${name}!</h3>
            <p style="color: #555; line-height: 1.6;">
              Akun Enterprise Anda telah berhasil didaftarkan di platform FraudGuard.
              Berikut adalah detail langganan Anda:
            </p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Paket</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${tier}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; color: orange; font-weight: bold;">Menunggu Aktivasi</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Admin</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${adminEmail}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://fraudguard.id/login" style="background-color: #CC5500; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Masuk ke Dashboard</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
              Email ini dikirim otomatis oleh sistem FraudGuard SaaS (Firebase Functions).
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent successfully to ${adminEmail}`);

    return { 
      success: true, 
      companyId: companyRef.id, 
      message: `Perusahaan ${name} berhasil didaftarkan dan email undangan telah dikirim ke ${adminEmail}.` 
    };

  } catch (error) {
    console.error("[ERROR] Invite Failed:", error);
    // Lempar error agar frontend tahu kalau gagal
    throw new HttpsError('internal', `Gagal memproses undangan: ${error.message}`);
  }
});