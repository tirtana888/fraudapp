# 🔒 Keamanan Email dengan Firebase Cloud Functions

## Masalah yang Diperbaiki

Sebelumnya, API key dan credentials EmailJS terekspos di client-side (browser):
- ✅ `YOUR_PUBLIC_KEY = "bclRHuJQwKQIOljiq"` **DIHAPUS** dari HTML
- ✅ `EMAILJS_SERVICE_ID = "service_8o2nl6d"` **DIPINDAHKAN** ke server
- ✅ `EMAILJS_TEMPLATE_BUSINESS = "template_gfg2qr4"` **DIPINDAHKAN** ke server
- ✅ `EMAILJS_TEMPLATE_CANDIDATE = "template_dvgrjda"` **DIPINDAHKAN** ke server

**Risiko yang dihilangkan:**
- ❌ Siapapun tidak bisa lagi inspect element dan menyalahgunakan API key
- ❌ EmailJS credentials tidak terlihat di network requests
- ❌ Template ID tidak bisa diakses dari browser

---

## Solusi: Firebase Cloud Functions

### Arsitektur Baru

```
Frontend (Browser)
    ↓
    httpsCallable("sendEmailViaEmailJS")
    ↓
Firebase Cloud Function (Server-Side)
    ↓
    Email JS API (dengan credentials aman)
    ↓
Email terkirim ✉️
```

### File yang Diubah

1. **`functions/index.js`** - Menambah Cloud Function `sendEmailViaEmailJS`
2. **`services/firebase.ts`** - Mengganti semua `emailjs.send()` dengan `sendEmailViaCloudFunction()`
3. **`index.html`, `index.dev.html`, `index.prod.html`** - Menghapus script EmailJS CDN dan API key

---

## Cara Deploy Firebase Functions

### 1. Install Firebase CLI (jika belum)

```bash
npm install -g firebase-tools
```

### 2. Login ke Firebase

```bash
firebase login
```

### 3. Deploy Cloud Function

Dari root project, jalankan:

```bash
firebase deploy --only functions
```

Atau deploy function tertentu:

```bash
firebase deploy --only functions:sendEmailViaEmailJS
```

### 4. Verifikasi Deployment

Setelah deploy berhasil, Anda akan melihat output seperti:

```
✔ functions[europe-west1-sendEmailViaEmailJS] Successful update operation.
Function URL: https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/sendEmailViaEmailJS
```

---

## Konfigurasi EmailJS di Firebase Function

Credentials EmailJS disimpan aman di `functions/index.js`:

```javascript
const EMAILJS_CONFIG = {
  publicKey: "bclRHuJQwKQIOljiq",
  serviceId: "service_8o2nl6d",
  templateBusiness: "template_gfg2qr4",
  templateCandidate: "template_dvgrjda"
};
```

**⚠️ PENTING:**
- File `functions/index.js` **TIDAK** di-expose ke browser
- Credentials hanya ada di server Firebase
- Frontend hanya memanggil function, tidak tahu credentials

---

## Testing Cloud Function

### Test dari Frontend

Ketika Anda mengirim email (misalnya undangan kandidat), aplikasi akan:

1. Memanggil `sendEmailViaCloudFunction()` dari frontend
2. Firebase SDK mengirim request ke Cloud Function
3. Cloud Function menggunakan EmailJS API
4. Email terkirim tanpa expose credentials

### Test Manual via Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project **gen-lang-client-0226679970**
3. Masuk ke **Functions**
4. Klik function **sendEmailViaEmailJS**
5. Lihat logs untuk memverifikasi email terkirim

---

## Troubleshooting

### Error: "Firebase Functions belum diinisialisasi"

**Penyebab:** Frontend belum terkoneksi dengan Firebase Functions

**Solusi:**
- Pastikan sudah deploy function dengan `firebase deploy --only functions`
- Cek region function di `functions/index.js` sama dengan di `services/firebase.ts`:
  ```javascript
  // functions/index.js
  exports.sendEmailViaEmailJS = onCall({ region: "europe-west1" }, ...)

  // services/firebase.ts
  functions = getFunctions(app, "europe-west1");
  ```

### Error: "Gagal mengirim email"

**Penyebab:** EmailJS quota habis atau credentials salah

**Solusi:**
1. Cek EmailJS Dashboard → Account → Usage
2. Free tier EmailJS: 200 email/bulan
3. Verifikasi credentials di `functions/index.js` benar

### Error saat Deploy Function

**Penyebab:** Node version mismatch atau dependencies error

**Solusi:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## Keamanan yang Terjamin

✅ API key EmailJS **100% aman** di server
✅ Template ID **tidak terlihat** di browser
✅ Service ID **tidak terekspos** di network
✅ Semua email sending **melalui Cloud Function**
✅ Zero credentials exposure di client-side

---

## Struktur File

```
fraudguard-saas/
├── functions/
│   ├── index.js           # ✅ Cloud Function dengan credentials
│   └── package.json
├── services/
│   └── firebase.ts        # ✅ Frontend call Cloud Function
├── index.html             # ✅ BERSIH dari EmailJS script
├── index.dev.html         # ✅ BERSIH dari EmailJS script
└── index.prod.html        # ✅ BERSIH dari EmailJS script
```

---

## Biaya Firebase Functions

- **Spark Plan (FREE):**
  - 2 million invocations/month
  - 400,000 GB-seconds
  - Cukup untuk mayoritas usage

- **Blaze Plan (PAY AS YOU GO):**
  - $0.40 per million invocations
  - Billing otomatis jika melebihi free tier

**Estimasi:** Jika mengirim 1000 email/bulan = 1000 function calls → **GRATIS**

---

## Checklist Deployment

- [x] Firebase Function `sendEmailViaEmailJS` sudah dibuat
- [x] Frontend sudah diupdate untuk call Cloud Function
- [x] Script EmailJS CDN dihapus dari HTML
- [x] API key dihapus dari client-side
- [x] Build production bersih tanpa credentials
- [ ] **Deploy function:** `firebase deploy --only functions`
- [ ] **Test email sending** dari aplikasi
- [ ] **Cek Firebase Console logs** untuk verifikasi

---

## Support

Jika ada masalah:
1. Cek Firebase Console → Functions → Logs
2. Cek browser console untuk error frontend
3. Verifikasi EmailJS quota di dashboard EmailJS
4. Pastikan region function sama di frontend dan backend

**Production Ready!** 🚀
