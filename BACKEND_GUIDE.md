
# Panduan Backend FraudGuard SaaS (Real Email)

File ini berisi kode backend yang perlu Anda deploy ke Firebase Cloud Functions agar fitur Invite Company benar-benar mengirim email.

## Prasyarat Wajib
1.  **Firebase Plan**: Harus upgrade ke **Blaze (Pay as you go)**. (Spark Plan memblokir pengiriman email).
2.  **Gmail App Password**: Jika menggunakan Gmail, aktifkan 2FA dan buat App Password.

## 1. Kode Backend (functions/index.js)

Salin kode di bawah ini ke dalam file `functions/index.js` di komputer lokal Anda:

```javascript
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = getFirestore();

// KONFIGURASI SMTP EMAIL (Ganti dengan milik Anda)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "email-anda@gmail.com", // Ganti dengan email pengirim
    pass: "app-password-anda"     // Ganti dengan App Password (Bukan password login biasa)
  }
});

exports.inviteCompany = onCall(async (request) => {
  // 1. Ambil data dari Frontend
  const { name, adminEmail, tier } = request.data;

  // Validasi
  if (!name || !adminEmail) {
    throw new HttpsError('invalid-argument', 'Nama Perusahaan dan Email Admin wajib diisi.');
  }

  try {
    // 2. Simpan ke Firestore
    const docRef = db.collection("companies").doc();
    const companyData = {
      name,
      adminEmail,
      tier: tier || "Basic",
      status: "Pending",
      joinedDate: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await docRef.set(companyData);

    // 3. Kirim Email Sungguhan (Real Scenario)
    const mailOptions = {
      from: '"FraudGuard SaaS" <no-reply@fraudguard.id>',
      to: adminEmail,
      subject: `Undangan Aktivasi Akun - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #CC5500;">Selamat Datang di FraudGuard</h2>
          <p>Halo Admin <strong>${name}</strong>,</p>
          <p>Akun Enterprise Anda telah dibuat oleh Super Admin.</p>
          
          <table style="width: 100%; margin: 20px 0;">
            <tr><td><strong>Paket:</strong></td><td>${tier}</td></tr>
            <tr><td><strong>Status:</strong></td><td>Menunggu Aktivasi</td></tr>
          </table>

          <p>Silakan login menggunakan email ini untuk mengakses dashboard audit Anda.</p>
          
          <a href="https://fraudguard.id/login" style="background-color: #CC5500; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Masuk ke Dashboard</a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #888;">Ini adalah email otomatis dari sistem FraudGuard SaaS.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SUCCESS] Email sent to ${adminEmail}`);

    return { 
      success: true, 
      id: docRef.id, 
      message: "Perusahaan disimpan & Email undangan TERKIRIM via SMTP." 
    };

  } catch (error) {
    console.error("[ERROR]", error);
    // Kita tetap return success true jika DB berhasil tapi email gagal, tapi beri info pesan
    return { 
      success: true, // Data tersimpan
      id: "saved-but-email-failed", 
      message: "Data tersimpan, namun GAGAL mengirim email (Cek kuota/SMTP)." 
    };
  }
});
```

## 2. Cara Deploy

Buka terminal di folder proyek Firebase Anda:

1.  Masuk ke folder functions: `cd functions`
2.  Install nodemailer: `npm install nodemailer`
3.  Kembali ke root: `cd ..`
4.  Deploy: `firebase deploy --only functions`

