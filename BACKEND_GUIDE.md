# Panduan Backend FraudGuard SaaS

File ini berisi kode backend yang perlu Anda deploy ke Firebase Cloud Functions.
Frontend React Anda sudah dikonfigurasi untuk memanggil fungsi ini.

## 1. Kode Backend (functions/index.js)

Salin kode di bawah ini ke dalam file `functions/index.js` di komputer lokal Anda:

```javascript
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = getFirestore();

exports.inviteCompany = onCall(async (request) => {
  // Ambil data
  const { name, adminEmail, tier } = request.data;

  // Validasi
  if (!name || !adminEmail) {
    throw new HttpsError('invalid-argument', 'Data tidak lengkap.');
  }

  try {
    // Simpan ke Firestore
    const docRef = db.collection("companies").doc();
    await docRef.set({
      name,
      adminEmail,
      tier: tier || "Starter",
      status: "Pending",
      joinedDate: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Simulasi Kirim Email (Log server)
    console.log(`Sending email to ${adminEmail} for company ${name}`);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(error);
    throw new HttpsError('internal', 'Gagal menyimpan data');
  }
});
```

## 2. Cara Deploy

Buka terminal di folder proyek Anda:

1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init functions` (Pilih project: gen-lang-client-0226679970)
4. Copy kode di atas ke `functions/index.js`
5. `firebase deploy --only functions`

## Catatan Penting
- Untuk menggunakan fitur Cloud Functions yang melakukan request keluar (seperti kirim email via API pihak ketiga), project Firebase Anda harus menggunakan paket **Blaze (Pay as you go)**.
- Jika masih paket Free (Spark), fungsi di atas tetap berjalan tapi hanya untuk log console, tidak bisa kirim email via SMTP eksternal.
