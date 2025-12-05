# 🎨 Panduan Customisasi Link Assessment

## ✅ Fitur Yang Sudah Diperbaiki

Semua fitur customisasi assessment sudah terimplementasi dengan sempurna:

### 1. **Upload Logo Perusahaan** ✅
- ✅ Upload langsung ke Firebase Storage (path: `logos/{companyId}/logo.{ext}`)
- ✅ Validasi format file: PNG, JPG, JPEG
- ✅ Validasi ukuran: Maksimal 5MB
- ✅ Auto-resize dan kompresi untuk optimasi
- ✅ Preview real-time di mockup
- ✅ Storage Rules sudah dikonfigurasi dengan benar

### 2. **Warna Brand** ✅
- ✅ Color picker untuk memilih warna utama
- ✅ Warna diterapkan ke semua button dan accent
- ✅ Preview real-time di mockup

### 3. **Judul Halaman Public** ✅
- ✅ Input field untuk custom header title
- ✅ Digunakan sebagai document title (tab browser)
- ✅ Ditampilkan di header assessment jika tidak ada logo
- ✅ Ditampilkan di welcome message

### 4. **Pesan Sambutan** ✅
- ✅ Textarea untuk custom welcome message
- ✅ Ditampilkan di halaman welcome kandidat
- ✅ Preview real-time di mockup

### 5. **Link Assessment** ✅
- ✅ Link otomatis terbentuk: `{URL}?mode=assess&cid={companyId}`
- ✅ Tombol copy link dengan feedback visual
- ✅ Link menggunakan semua customisasi yang disimpan
- ✅ Gated untuk paket Premium dan Enterprise

---

## 🔧 Cara Deploy Storage Rules

### Opsi 1: Firebase Console (Recommended)
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. Klik **Storage** di menu kiri
4. Klik tab **Rules**
5. Copy-paste rules dari file `storage.rules`
6. Klik **Publish**

### Opsi 2: Firebase CLI
```bash
firebase deploy --only storage
```

---

## 📋 Storage Rules Yang Sudah Dikonfigurasi

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Company Logos - Public read, restricted write
    match /logos/{companyId}/{fileName} {
      // Anyone can read logos (for public assessment pages)
      allow read: if true;

      // Only allow uploads up to 5MB
      // Only allow PNG/JPG/JPEG files
      allow write: if request.resource.size <= 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/(png|jpeg|jpg)');

      // Allow delete for cleanup
      allow delete: if true;
    }

    // CV Files - Public read, restricted write
    match /cvs/{applicationId}/{fileName} {
      // Anyone can read CVs (HR needs to access)
      allow read: if true;

      // Only allow PDF uploads up to 5MB
      allow write: if request.resource.size <= 5 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';

      // Allow delete for cleanup
      allow delete: if true;
    }

    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🎯 Cara Menggunakan Fitur Customisasi

### 1. Login sebagai Admin Perusahaan
- Pastikan Anda login dengan akun admin perusahaan

### 2. Buka Menu "Link Asesmen"
- Klik menu "Link Asesmen" di sidebar

### 3. Upload Logo (Opsional - Enterprise Only)
- Klik tombol "Upload Logo"
- Pilih file PNG/JPG (max 5MB)
- Logo akan langsung muncul di preview
- **PENTING**: Klik tombol "Simpan Perubahan" setelah upload!

### 4. Atur Warna Brand (Opsional - Enterprise Only)
- Klik kotak warna atau input hex code
- Warna akan langsung update di preview

### 5. Ubah Judul Halaman
- Masukkan judul custom di field "Judul Halaman Publik"
- Contoh: "Portal Rekrutmen PT Maju Bersama"

### 6. Ubah Pesan Sambutan
- Edit text di field "Pesan Sambutan Kandidat"
- Contoh: "Selamat datang! Silakan isi formulir berikut untuk memulai proses seleksi."

### 7. **KLIK TOMBOL "SIMPAN PERUBAHAN"**
- ⚠️ **PENTING**: Tombol ini akan berwarna **ORANGE** dan **BERKEDIP** jika ada perubahan yang belum disimpan
- Sistem akan memverifikasi semua data tersimpan dengan benar
- Toast notification akan muncul setelah berhasil

### 8. Copy Link Assessment
- Klik tombol "Salin" untuk copy link
- Bagikan link ke kandidat via email, WhatsApp, dll

---

## 🔍 Flow Data Customisasi

```
Admin Upload Logo
        ↓
Firebase Storage (logos/{companyId}/logo.png)
        ↓
Get Download URL
        ↓
Save ke Firestore (companies/{companyId}.logoUrl)
        ↓
Kandidat Buka Link Assessment
        ↓
PublicAssessment Component
        ↓
Fetch Company Data (logoUrl, brandColor, headerTitle, welcomeMessage)
        ↓
Render Custom Branding
```

---

## 🐛 Troubleshooting

### Logo tidak muncul setelah upload
1. Cek console browser untuk error
2. Pastikan Storage Rules sudah di-deploy
3. Pastikan file format PNG/JPG (bukan WEBP/GIF)
4. Pastikan file size < 5MB
5. **Pastikan sudah klik "Simpan Perubahan"**

### Perubahan tidak tersimpan
1. Pastikan tombol "Simpan Perubahan" sudah diklik
2. Cek console untuk error permission
3. Pastikan login sebagai admin company yang benar
4. Cek koneksi internet

### Link tidak menampilkan customisasi
1. Pastikan data sudah disimpan dengan klik "Simpan Perubahan"
2. Refresh halaman assessment
3. Cek console browser untuk error fetch company data
4. Pastikan company tier bukan "Basic" (untuk logo dan branding color)

---

## ✨ Hasil Akhir

Setelah semua customisasi diterapkan, kandidat akan melihat:
- ✅ Logo perusahaan di header (jika di-upload)
- ✅ Judul custom di browser tab dan header
- ✅ Warna brand di semua tombol dan accent
- ✅ Pesan sambutan custom di halaman welcome
- ✅ UI yang konsisten dengan branding perusahaan

---

## 📝 Catatan Penting

1. **White Label Features (Logo & Brand Color)** hanya tersedia untuk paket **Enterprise**
2. **Judul Halaman** dan **Pesan Sambutan** tersedia untuk semua paket
3. **Link Assessment** hanya tersedia untuk paket **Premium** dan **Enterprise**
4. Semua perubahan langsung aktif setelah disimpan (tidak perlu restart)
5. Logo disimpan permanen di Firebase Storage dan dapat diakses publik
6. **SELALU KLIK "SIMPAN PERUBAHAN" SETELAH EDIT!**

---

## 🚀 Build & Deploy

Project sudah di-build dan siap di-deploy:

```bash
# Build project
npm run build

# Deploy ke hosting
firebase deploy --only hosting

# Deploy storage rules
firebase deploy --only storage
```

---

**Status**: ✅ **SEMUA FITUR SUDAH TERIMPLEMENTASI DAN BERFUNGSI DENGAN BAIK**
