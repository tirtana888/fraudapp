# 🐛 Logo Upload & Save Debugging Guide

## ✅ Perbaikan Yang Sudah Diterapkan

### 1. Enhanced Logging
Semua fungsi kritis sekarang memiliki logging yang detail:

- **`[LOGO-UPLOAD]`** - Proses upload logo ke Firebase Storage
- **`[SAVE]`** - Proses save customisasi ke Firestore
- **`[UPDATE-COMPANY]`** - Update document di Firestore
- **`[GET-COMPANY]`** - Fetch company data dari Firestore

### 2. Improved Save Verification
- Delay diperpanjang dari 500ms ke 1000ms
- Retry logic: jika verifikasi pertama gagal, sistem retry 1x setelah 1 detik
- Logging comparison antara data yang dikirim vs data yang diverifikasi

### 3. Better Error Messages
- Error messages lebih spesifik
- Console logs menunjukkan exact data yang tersimpan vs expected

---

## 🔍 Cara Debug Jika Logo Tidak Tersimpan

### Step 1: Buka Browser Console
Tekan `F12` atau `Ctrl+Shift+I` untuk membuka Developer Tools

### Step 2: Upload Logo
Klik "Upload Logo" dan pilih file PNG/JPG (max 5MB)

**Expected Logs:**
```
[LOGO-UPLOAD] Starting logo upload: {fileName, fileSize, fileType}
[STORAGE] uploadCompanyLogo called with: {...}
[STORAGE] Validation passed. Uploading logo...
[STORAGE] Upload complete! Snapshot: {...}
[STORAGE] ✅ Logo uploaded successfully!
```

**Jika Gagal:**
- Cek error message di console
- Pastikan file format PNG/JPG
- Pastikan file size < 5MB
- Pastikan Firebase Storage Rules sudah di-deploy

### Step 3: Klik "Simpan Perubahan"
Setelah logo ter-upload, HARUS klik tombol "Simpan Perubahan"

**Expected Logs:**
```
[SAVE] Starting save process: {companyId, hasLogo: true, logoUrlLength: ...}
[SAVE] Saving to Firestore...
[UPDATE-COMPANY] Updating company: {id, dataKeys: [...], hasLogoUrl: true, logoUrlLength: ...}
[UPDATE-COMPANY] ✅ Update successful
[SAVE] ✅ Save to Firestore successful
[SAVE] Waiting for Firestore propagation...
[SAVE] Verifying saved data...
[GET-COMPANY] Fetching company with ID: ...
[GET-COMPANY] Company found: {hasLogoUrl: true, logoUrlLength: ..., logoUrlPreview: ...}
[SAVE] Verification result: {hasLogo: true, ...}
[SAVE] Form data comparison: {formHasLogo: true, verifyHasLogo: true, ...}
[SAVE] ✅ All data verified successfully
```

### Step 4: Analisis Logs

#### ✅ Jika Semua Log Hijau (Success)
Logo berhasil tersimpan! Refresh halaman untuk melihat hasilnya.

#### ❌ Jika `[SAVE] ❌ Logo not saved to Firestore`

**Cek logs berikut:**

1. **`[UPDATE-COMPANY]` logs**
   - Apakah `hasLogoUrl: true`?
   - Apakah `logoUrlLength` > 0?
   - Jika tidak, berarti data tidak dikirim dengan benar

2. **`[GET-COMPANY]` logs**
   - Apakah `hasLogoUrl: true`?
   - Apakah `logoUrlLength` > 0?
   - Jika tidak, berarti data tidak tersimpan di Firestore

3. **`[SAVE] Form data comparison`**
   - Compare `formLogoLength` vs `verifyLogoLength`
   - Jika berbeda, ada masalah propagation atau save

---

## 🔧 Common Issues & Solutions

### Issue 1: "Logo gagal tersimpan" setelah klik Simpan

**Penyebab Mungkin:**
- Firestore propagation delay
- Network latency
- Firestore rules blocking write

**Solusi:**
1. Tunggu beberapa detik, sistem akan retry otomatis
2. Jika masih gagal, cek Firestore Rules:
   ```
   allow write: if request.auth != null;
   ```
3. Cek koneksi internet

### Issue 2: Logo hilang setelah refresh

**Penyebab:**
- Logo tidak di-save (hanya uploaded ke Storage)
- Lupa klik "Simpan Perubahan"

**Solusi:**
- SELALU klik tombol "Simpan Perubahan" setelah upload logo
- Tunggu sampai muncul notifikasi "Pengaturan berhasil disimpan!"

### Issue 3: Upload berhasil tapi tombol Simpan disabled

**Penyebab:**
- `hasUnsavedChanges` state tidak terupdate

**Solusi:**
- Ubah field lain (contoh: judul halaman) untuk trigger state change
- Atau edit lagi logo-nya

### Issue 4: "Storage Rules tidak ter-deploy"

**Penyebab:**
- Storage rules belum di-deploy ke Firebase

**Solusi:**
```bash
# Via Firebase Console
1. Buka https://console.firebase.google.com
2. Pilih project → Storage → Rules
3. Paste rules dari storage.rules
4. Klik Publish

# Via Firebase CLI (jika ada)
firebase deploy --only storage
```

---

## 📊 Expected Data Flow

```
User Upload Logo
       ↓
[LOGO-UPLOAD] Validate file (type, size)
       ↓
Upload to Firebase Storage
       ↓
Get Download URL (https://firebasestorage.googleapis.com/...)
       ↓
Update formData.logoUrl
       ↓
User Click "Simpan Perubahan"
       ↓
[SAVE] Prepare dataToSave {logoUrl, brandColor, headerTitle, welcomeMessage}
       ↓
[UPDATE-COMPANY] updateDoc(companyRef, dataToSave)
       ↓
Wait 1000ms for propagation
       ↓
[GET-COMPANY] Fetch company data
       ↓
[SAVE] Verify logoUrl exists and matches
       ↓
✅ Success or Retry once if failed
```

---

## 🧪 Manual Testing Checklist

- [ ] Upload logo PNG (< 5MB)
- [ ] Lihat preview logo di mockup
- [ ] Logo URL muncul di formData
- [ ] Klik "Simpan Perubahan"
- [ ] Tunggu toast "Pengaturan berhasil disimpan!"
- [ ] Refresh halaman
- [ ] Logo masih ada di form
- [ ] Buka link assessment public
- [ ] Logo muncul di header public

---

## 📝 Firestore Document Structure

Company document di Firestore harus memiliki fields:

```javascript
{
  id: "c1",
  name: "PT Maju Bersama",
  tier: "Enterprise",
  status: "Active",
  adminEmail: "admin@company.com",

  // Customization fields
  logoUrl: "https://firebasestorage.googleapis.com/.../logo.png", // ← HARUS ADA
  brandColor: "#CC5500",
  headerTitle: "Portal Rekrutmen PT Maju Bersama",
  welcomeMessage: "Selamat datang di portal kami!",

  // Other fields...
  joinedDate: "2024-01-01T00:00:00.000Z",
  subscription_ends_at: "2025-01-01T00:00:00.000Z"
}
```

---

## 🚨 Emergency Fallback

Jika save terus gagal, debug manual via Firebase Console:

1. Buka https://console.firebase.google.com
2. Pilih project → Firestore Database
3. Cari collection `companies`
4. Buka document dengan ID company Anda
5. Edit manual field `logoUrl` dengan URL logo dari Storage
6. Save
7. Refresh aplikasi

---

## 📞 Bantuan Tambahan

Jika issue masih berlanjut:

1. **Export Console Logs:**
   - Right-click di console → Save as...
   - Kirim file log untuk analisis

2. **Screenshot:**
   - Screenshot browser console saat upload & save
   - Screenshot Firebase Console (Firestore & Storage)

3. **Check Firebase Console:**
   - Firestore: Pastikan document company ada dan field logoUrl ter-update
   - Storage: Pastikan file logo ter-upload di `logos/{companyId}/logo.png`

---

**Status**: ✅ Logging system sudah diperbaiki dan siap untuk debugging
