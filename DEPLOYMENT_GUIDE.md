# Panduan Deploy Live ke Custom Domain (Firebase Hosting)

Panduan ini akan membantu Anda menaikkan aplikasi FraudGuard SaaS dari lingkungan pengembangan (lokal/AI) ke internet publik dengan domain Anda sendiri (contoh: `app.fraudguard.id`).

## Prasyarat
1.  Pastikan Anda memiliki **Node.js** terinstall di komputer.
2.  Pastikan Anda memiliki akses ke **Firebase Console** project ini.
3.  Pastikan Anda sudah membeli domain (misal di Niagahoster, GoDaddy, Namecheap, dll).

---

## Langkah 1: Persiapan Kode (Build)

Di terminal komputer Anda (VS Code / CMD), jalankan perintah ini untuk mengubah kode React menjadi file statis siap tayang:

```bash
npm run build
```

*Ini akan membuat folder baru bernama `dist` atau `build` yang berisi file HTML, CSS, dan JS yang sudah dikompresi.*

---

## Langkah 2: Install & Login Firebase

Jika belum pernah menginstall Firebase Tools:

```bash
npm install -g firebase-tools
```

Lalu login ke akun Google Anda:

```bash
firebase login
```

---

## Langkah 3: Inisialisasi Hosting

Jalankan perintah ini di folder root proyek Anda:

```bash
firebase init hosting
```

**Jawab pertanyaan konfigurasi seperti ini:**

1.  **Project Setup**: Pilih `Use an existing project`.
2.  **Select Project**: Pilih `gen-lang-client-0226679970` (Project Anda).
3.  **Public directory**: Ketik `dist` (Jika Anda menggunakan Vite) atau `build` (Jika Create React App). *Cek folder mana yang muncul setelah Langkah 1*.
4.  **Configure as a single-page app?**: Ketik `y` (Yes). **Penting!** Ini agar routing React berfungsi saat di-refresh.
5.  **Set up automatic builds and deploys with GitHub?**: Ketik `n` (No) untuk sekarang.
6.  **File index.html already exists. Overwrite?**: Ketik `n` (No).

---

## Langkah 4: Deploy (Upload)

Sekarang, upload aplikasi Anda ke internet:

```bash
firebase deploy --only hosting
```

Setelah selesai, Firebase akan memberikan URL sementara, biasanya: `https://gen-lang-client-0226679970.web.app`.
Coba buka link tersebut. Jika aplikasi berjalan lancar, lanjut ke langkah domain.

---

## Langkah 5: Sambungkan Domain Sendiri

1.  Buka [Firebase Console Hosting](https://console.firebase.google.com/project/gen-lang-client-0226679970/hosting).
2.  Klik tombol **"Add Custom Domain"**.
3.  Masukkan nama domain yang sudah Anda beli (misal: `fraudguard.id` atau `app.fraudguard.id`).
4.  Klik **Continue**.
5.  Firebase akan memberikan **TXT Record** atau **A Record**.

**Setting di Penyedia Domain (Niagahoster/GoDaddy/dll):**
1.  Login ke panel domain Anda, cari menu **DNS Management**.
2.  Tambahkan Record baru sesuai instruksi Firebase.
    *   Tipe: `TXT` atau `A`
    *   Host: `@` (untuk domain utama) atau `app` (untuk subdomain)
    *   Value: (Salin kode dari Firebase)
3.  Tunggu propagasi (bisa 10 menit hingga 24 jam).
4.  Kembali ke Firebase Console dan klik **Verify**.

Setelah terverifikasi, Firebase akan otomatis menerbitkan **Sertifikat SSL (Gembok Hijau)** untuk domain Anda. Ini memakan waktu sekitar 15-60 menit.

---

## Langkah 6: Keamanan (Wajib untuk SaaS Live)

Agar API Key Anda tidak dicuri orang lain saat aplikasi live:

1.  Buka [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2.  Pilih Project Anda.
3.  Klik pada **API Key** yang Anda gunakan.
4.  Di bagian **Application restrictions**, pilih **Websites (HTTP referrers)**.
5.  Masukkan domain Anda:
    *   `https://fraudguard.id/*`
    *   `https://www.fraudguard.id/*`
    *   `https://gen-lang-client-0226679970.web.app/*`
6.  Klik **Save**.

Sekarang SaaS Anda sudah live, aman, dan menggunakan domain profesional!
