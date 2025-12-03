# ✅ Fix Upload Logo Perusahaan

## 🔍 Masalah yang Dilaporkan

User sudah upload logo, tapi logo **tidak tersimpan** atau **tidak muncul** di halaman assessment.

## 🎯 Perbaikan yang Sudah Dilakukan

### 1. **Enhanced Error Handling & Logging**

Sekarang sistem akan memberikan feedback yang jelas di setiap tahap:

**Saat Upload Logo:**
```typescript
✅ Logo berhasil di-upload (245KB).
   Jangan lupa klik tombol "Simpan Perubahan" untuk menyimpan!
```

**Saat Simpan:**
```typescript
✅ Pengaturan Link Asesmen berhasil disimpan!
```

**Jika Ada Error:**
```typescript
❌ Gagal menyimpan: Ukuran Logo terlalu besar (maksimal 1MB di Firestore).
❌ Gagal menyimpan: Izin akses ditolak. Pastikan Anda login sebagai admin perusahaan ini.
```

### 2. **Visual Indicator untuk Perubahan Belum Disimpan**

**Button "Simpan Perubahan":**
- 🟠 **Orange + Animasi Pulse** = Ada perubahan yang belum disimpan
- 🟢 **Gray + "✓ Tersimpan"** = Semua perubahan sudah tersimpan
- 🔒 **Disabled** = Tidak ada perubahan atau sedang menyimpan

### 3. **Console Logging untuk Debug**

Setiap aksi akan log ke Browser Console (F12):
```javascript
Starting logo upload: { fileName, fileSize, fileType }
Compressing image...
Image compressed: { originalSize, optimizedLength, estimatedSizeKB }
✅ Logo ready to save
Saving company settings: { companyId, logoLength, brandColor }
Save successful!
```

---

## 🧪 Cara Test Upload Logo

### Step 1: Login & Buka Settings
1. Login ke aplikasi sebagai **Company Admin** atau **System Admin**
2. Klik tab **"Pengaturan Link Asesmen"**
3. Pastikan perusahaan menggunakan **tier Enterprise** (white label feature)

### Step 2: Upload Logo
1. Klik tombol **"Upload Logo"**
2. Pilih file logo (PNG/JPG, maksimal 5MB)
3. Tunggu proses kompresi (1-2 detik)
4. **Alert muncul**: "✅ Logo berhasil di-upload (XXX KB). Jangan lupa klik tombol 'Simpan Perubahan'!"
5. Logo preview akan muncul di kotak sebelah kiri

### Step 3: Simpan Perubahan
1. **PENTING**: Tombol **"Simpan Perubahan"** akan menjadi **orange dan berkedip-kedip**
2. Klik tombol **"⚠️ Simpan Perubahan"**
3. Tunggu proses save (1-2 detik)
4. **Alert muncul**: "✅ Pengaturan Link Asesmen berhasil disimpan!"
5. Tombol berubah menjadi **gray** dengan teks **"✓ Tersimpan"**

### Step 4: Verifikasi
1. **Refresh halaman** (F5)
2. Logo harus tetap muncul di preview
3. Buka link assessment publik: `https://your-app.com?mode=assess&cid=COMPANY_ID`
4. Logo harus muncul di header halaman kandidat

---

## 🔍 Troubleshooting

### ❌ Logo Tidak Muncul Setelah Upload

**Kemungkinan 1: Lupa Klik "Simpan Perubahan"**

**Gejala:**
- Logo muncul di preview
- Tapi hilang setelah refresh halaman

**Solusi:**
- Setelah upload logo, **WAJIB klik tombol "Simpan Perubahan"**
- Tombol akan berubah warna orange + berkedip jika ada perubahan belum disimpan

---

**Kemungkinan 2: Ukuran Logo Terlalu Besar**

**Gejala:**
- Error: "Gagal menyimpan: Ukuran Logo terlalu besar"
- File size > 1MB setelah dioptimasi

**Solusi:**
```
1. Gunakan logo yang lebih sederhana
2. Kurangi kompleksitas gambar (gradient, shadow, dll)
3. Gunakan format PNG dengan transparansi
4. Atau resize manual ke 500x500px sebelum upload
```

**Batasan Firestore:**
- Maksimal **1MB per document**
- Logo disimpan sebagai **base64 string** dalam document

---

**Kemungkinan 3: Tier Tidak Mendukung White Label**

**Gejala:**
- Logo upload section **tampak abu-abu (disabled)**
- Ada label "Khusus Enterprise"

**Solusi:**
- Fitur white label (custom logo & branding) **hanya tersedia di tier Enterprise**
- Upgrade company tier dari **Admin Dashboard** → **Manage Subscription**

---

**Kemungkinan 4: Permission Denied**

**Gejala:**
- Error: "Izin akses ditolak"
- Firestore permission error

**Solusi:**
- Pastikan Anda login sebagai **admin perusahaan tersebut**
- Cek Firebase Console → Firestore → Rules
- Pastikan rule mengizinkan update pada collection companies

**Firestore Rules yang Benar:**
```javascript
match /companies/{companyId} {
  allow read: if isAuthenticated();
  allow update: if isAuthenticated() &&
                   request.auth.token.companyId == companyId;
}
```

---

**Kemungkinan 5: Format File Tidak Didukung**

**Gejala:**
- Error: "Gagal memproses gambar"
- File tidak dapat di-compress

**Solusi:**
- Gunakan **PNG, JPG, atau JPEG**
- Hindari format: SVG, GIF, WebP, HEIC
- Pastikan file tidak corrupt

---

### ✅ Cara Cek Browser Console untuk Debug

1. **Buka Browser Console**
   - Chrome/Edge: `F12` atau `Ctrl + Shift + J`
   - Mac: `Cmd + Option + J`

2. **Upload Logo**
   - Lihat logs:
   ```
   Starting logo upload: { fileName: "logo.png", fileSize: 128450, fileType: "image/png" }
   Compressing image...
   Image compressed: { originalSize: 128450, optimizedLength: 89234, estimatedSizeKB: 245 }
   ✅ Logo ready to save. Remember to click 'Simpan Perubahan' button!
   ```

3. **Klik Simpan**
   - Lihat logs:
   ```
   Saving company settings: { companyId: "c1", logoLength: 89234, brandColor: "#CC5500" }
   Save successful!
   ```

4. **Jika Ada Error**
   - Logs akan menampilkan error detail:
   ```
   Gagal menyimpan: Error message here
   ```
   - Screenshot error dan kirim untuk troubleshooting

---

## 📊 Technical Details

### Proses Upload Logo

```
┌──────────────────┐
│  User Pick File  │
│  (PNG/JPG)       │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────┐
│  Validation              │
│  - File size < 5MB       │
│  - File type = PNG/JPG   │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│  Compress & Resize       │
│  - Max width: 500px      │
│  - Convert to PNG        │
│  - Convert to base64     │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│  Check Optimized Size    │
│  - Must be < 900KB       │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│  Update State            │
│  formData.logoUrl = base64│
│  hasUnsavedChanges = true│
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│  🟠 Button Turns Orange  │
│  "⚠️ Simpan Perubahan"   │
└──────────────────────────┘
         │
         ↓ USER MUST CLICK!
         │
┌──────────────────────────┐
│  updateCompany()         │
│  Save to Firestore       │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│  ✅ Success              │
│  Logo tersimpan          │
└──────────────────────────┘
```

### Data Structure

Logo disimpan di Firestore sebagai:
```typescript
{
  id: "c1",
  name: "PT Example",
  logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  brandColor: "#CC5500",
  // ... other fields
}
```

---

## 💡 Best Practices

### 1. **Logo yang Baik**
- **Format:** PNG dengan transparansi
- **Ukuran:** 500x500px atau lebih kecil
- **File size:** < 200KB (sebelum upload)
- **Desain:** Sederhana, tidak terlalu banyak gradient/shadow

### 2. **Testing**
- Upload logo di development
- Test di different browsers (Chrome, Firefox, Safari)
- Test di mobile browser
- Verify logo muncul di halaman kandidat

### 3. **Fallback**
- Jika logo tidak bisa di-upload karena ukuran, gunakan:
  - **Header Title** saja (text-based branding)
  - **Brand Color** untuk consistent branding
  - External URL hosting (simpan URL image hosting)

---

## 🎯 Summary Perbaikan

**Before:**
- ❌ Upload logo, logo hilang setelah refresh
- ❌ Tidak ada feedback jelas apakah tersimpan atau tidak
- ❌ Susah debug karena tidak ada error message

**After:**
- ✅ Alert notification di setiap tahap
- ✅ Visual indicator (orange button) jika ada perubahan belum disimpan
- ✅ Console logging untuk debug
- ✅ Better error messages
- ✅ Save button disabled jika tidak ada perubahan

---

## 📞 Support

**Jika masih ada masalah:**
1. Screenshot error message (alert & console)
2. Kirim info:
   - File logo (nama, size, format)
   - Browser & OS
   - Company tier (Basic/Premium/Enterprise)
   - Console logs (F12)

**Common Fixes:**
```bash
# Clear browser cache
Ctrl + Shift + Delete → Clear cached images and files

# Hard refresh page
Ctrl + F5 (Windows)
Cmd + Shift + R (Mac)
```

---

**Status:** ✅ FIXED
**Build:** ✅ SUCCESS
**Ready for Testing:** ✅
**Next:** Test dengan logo real di production
