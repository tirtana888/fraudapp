
# Panduan Upload ke GitHub

Ikuti langkah-langkah berikut di terminal (Command Prompt / VS Code Terminal) untuk meng-upload kode ini ke GitHub.

## 1. Buat Repositori Baru di GitHub
1. Buka [GitHub.com](https://github.com) dan login.
2. Klik tombol **New** (atau ikon `+` di pojok kanan atas -> New repository).
3. Beri nama repositori, misal: `fraudguard-saas`.
4. Pilih **Public** atau **Private**.
5. **JANGAN** centang "Add a README file" (kita sudah membuatnya).
6. Klik **Create repository**.

## 2. Inisialisasi Git di Komputer (Jika belum)
Jalankan perintah ini di terminal folder proyek Anda:

```bash
# Inisialisasi git
git init

# Tambahkan semua file ke staging area
git add .

# Buat commit pertama
git commit -m "Initial commit: FraudGuard SaaS Production Ready"
```

## 3. Hubungkan ke GitHub
Salin URL repositori dari halaman GitHub yang baru Anda buat (contoh: `https://github.com/username/fraudguard-saas.git`).

Lalu jalankan:

```bash
# Ganti URL_REPO_ANDA dengan link yang Anda copy dari GitHub
git remote add origin URL_REPO_ANDA

# Verifikasi remote
git remote -v
```

## 4. Push Kode
```bash
git branch -M main
git push -u origin main
```

---

## ⚠️ Catatan Keamanan Penting

File `services/firebase.ts` saat ini berisi konfigurasi Firebase (`apiKey`, `appId`, dll) secara hardcoded. 
- Untuk repositori **Private**: Ini biasanya aman untuk tim internal terbatas.
- Untuk repositori **Public**: Sangat disarankan untuk memindahkan konfigurasi ini ke Environment Variables (`.env`) agar tidak disalahgunakan orang lain.

Namun, karena Firebase Client SDK Keys umumnya aman untuk diekspos (selama Security Rules database Anda kuat), risiko utamanya ada pada penggunaan kuota.
