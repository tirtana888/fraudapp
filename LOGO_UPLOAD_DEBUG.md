# 🔍 Debug: Logo Hilang di Invite Link Setelah Simpan

## 🚨 Masalah

**Gejala:**
1. Upload logo di "Pengaturan Link Asesmen" ✅
2. Logo muncul di preview ✅
3. Klik "Simpan Perubahan" ✅
4. Buka invite link assessment ❌
5. **Logo hilang / tidak muncul di halaman kandidat**

---

## ✅ Perbaikan & Enhanced Debugging

### 1. **Verification After Save**

Sekarang sistem akan **memverifikasi** apakah logo benar-benar tersimpan ke Firestore:

```typescript
// Setelah save, read back dari Firestore
const verifyData = await getCompanyById(companyId);

if (formData.logoUrl && !verifyData.logoUrl) {
  // Logo TIDAK tersimpan!
  alert("⚠️ Logo gagal tersimpan. Ukuran terlalu besar (max 1MB)");
  return;
}
```

**Jika logo gagal tersimpan:**
- Alert muncul: "⚠️ Logo gagal tersimpan"
- Browser Console: "❌ VERIFICATION FAILED"
- User harus coba logo yang lebih kecil

**Jika logo berhasil tersimpan:**
- Alert: "✅ Pengaturan berhasil disimpan dan terverifikasi!"
- Browser Console: "✅ Verification successful"

### 2. **Detailed Logging - Settings Page**

Console logs saat save:
```javascript
Saving company settings: {
  companyId: "c1",
  logoLength: 245632,  // Size in characters
  brandColor: "#CC5500",
  headerTitle: "PT Maju Bersama"
}

Save successful!
Verifying saved data...

Verified data from Firestore: {
  logoUrlLength: 245632,  // MUST match logoLength above
  brandColor: "#CC5500",
  headerTitle: "PT Maju Bersama"
}

✅ Verification successful - all data saved correctly
```

### 3. **Detailed Logging - Public Assessment**

Console logs saat buka invite link:
```javascript
[PUBLIC-ASSESSMENT] Fetching company data for ID: c1

[PUBLIC-ASSESSMENT] Company data loaded: {
  name: "PT Maju Bersama",
  tier: "Enterprise",
  hasLogo: true,       // HARUS true jika logo ada
  logoLength: 245632,  // HARUS match dengan saved length
  brandColor: "#CC5500",
  headerTitle: "PT Maju Bersama"
}

[PUBLIC-ASSESSMENT] ✅ Company data set successfully

[HEADER] Rendering header with logoUrl: {
  hasLogoUrl: true,
  logoLength: 245632,
  companyName: "PT Maju Bersama",
  headerTitle: "PT Maju Bersama"
}

[HEADER] ✅ Logo image loaded successfully
```

---

## 🧪 Cara Debug Step-by-Step

### Step 1: Upload & Save Logo

1. Login ke aplikasi sebagai Company Admin
2. Tab "Pengaturan Link Asesmen"
3. Upload logo (PNG/JPG, < 5MB)
4. Tunggu alert: "✅ Logo berhasil di-upload (XXX KB). Jangan lupa klik 'Simpan Perubahan'!"
5. **BUKA BROWSER CONSOLE (F12)** sebelum klik simpan
6. Klik tombol "Simpan Perubahan"
7. **Lihat console logs:**

**Logs yang Bagus (Logo Tersimpan):**
```
Saving company settings: { companyId: "c1", logoLength: 245632, ... }
Save successful!
Verifying saved data...
Verified data from Firestore: { logoUrlLength: 245632, ... }
✅ Verification successful - all data saved correctly
```

**Logs Jika Logo Gagal Tersimpan:**
```
Saving company settings: { companyId: "c1", logoLength: 245632, ... }
Save successful!
Verifying saved data...
Verified data from Firestore: { logoUrlLength: 0, ... }
❌ VERIFICATION FAILED: Logo was not saved to Firestore!
```

8. Jika verification failed → Logo terlalu besar untuk Firestore (max 1MB document)
9. Jika verification success → Lanjut ke Step 2

### Step 2: Test di Invite Link

1. Copy invite link dari "Pengaturan Link Asesmen"
2. **Buka Browser Console (F12)** di tab/window baru
3. Buka invite link (atau incognito mode untuk test fresh)
4. **Lihat console logs:**

**Logs yang Bagus (Logo Muncul):**
```
[PUBLIC-ASSESSMENT] Fetching company data for ID: c1
[PUBLIC-ASSESSMENT] Company data loaded: {
  name: "PT Maju Bersama",
  hasLogo: true,          ← HARUS true
  logoLength: 245632,     ← HARUS sama dengan Step 1
  ...
}
[PUBLIC-ASSESSMENT] ✅ Company data set successfully
[HEADER] Rendering header with logoUrl: { hasLogoUrl: true, logoLength: 245632 }
[HEADER] ✅ Logo image loaded successfully
```

**Logs Jika Logo Tidak Ada:**
```
[PUBLIC-ASSESSMENT] Company data loaded: {
  hasLogo: false,         ← Logo tidak ada di Firestore!
  logoLength: 0,
  ...
}
[HEADER] Rendering header with logoUrl: { hasLogoUrl: false, logoLength: 0 }
```

**Logs Jika Logo Ada Tapi Gagal Load:**
```
[HEADER] Rendering header with logoUrl: { hasLogoUrl: true, logoLength: 245632 }
[HEADER] ❌ Logo image failed to load  ← Browser gagal render base64 image
```

---

## 🔍 Troubleshooting Scenarios

### Scenario 1: Verification Failed - Logo Tidak Tersimpan

**Gejala:**
```
❌ VERIFICATION FAILED: Logo was not saved to Firestore!
Alert: "⚠️ Logo gagal tersimpan. Ukuran terlalu besar (max 1MB)"
```

**Penyebab:**
- Logo size (base64) > **1MB** setelah kompresi
- Firestore document max size = 1MB total

**Solusi:**
```
1. Coba logo yang lebih sederhana (less gradient, less details)
2. Resize logo ke 300x300px atau lebih kecil
3. Convert ke PNG dengan compression
4. Or use external image hosting (Cloudinary, ImgBB)
```

**Estimasi Size:**
- Logo 500x500px PNG sederhana: ~100-300KB base64 ✅
- Logo 1000x1000px PNG kompleks: ~800KB-2MB base64 ❌
- Logo dengan banyak gradient/shadow: Lebih besar

---

### Scenario 2: Logo Tersimpan Tapi Tidak Muncul di Link

**Gejala:**
```
Step 1: logoLength: 245632 ✅ Verified
Step 2: hasLogo: false ❌ Logo tidak ada
```

**Penyebab:**
- Company ID berbeda antara settings dan invite link
- Cache browser

**Debug:**
```javascript
// Cek Company ID di Settings:
console.log("Current Company ID:", currentCompany.id);

// Cek Company ID di Invite Link:
// URL: https://app.com?mode=assess&cid=c1
//                                      ^^^^ Company ID
console.log("[PUBLIC-ASSESSMENT] Fetching company data for ID: ???");
```

**Solusi:**
- Pastikan Company ID sama
- Hard refresh (Ctrl+F5) di invite link
- Clear browser cache
- Test di incognito mode

---

### Scenario 3: Logo Ada di Firestore Tapi Gagal Render

**Gejala:**
```
[HEADER] hasLogoUrl: true, logoLength: 245632
[HEADER] ❌ Logo image failed to load
```

**Penyebab:**
- Base64 string corrupt
- Invalid data URI format
- Browser security restrictions

**Debug:**
```javascript
// Di Browser Console:
console.log("Logo URL:", logoUrl.substring(0, 100));
// Expected: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
```

**Solusi:**
1. Pastikan format: `data:image/png;base64,XXXXX`
2. Re-upload logo
3. Try different logo file

---

### Scenario 4: Logo Muncul di Settings Tapi Tidak di Link (Cache)

**Gejala:**
- Logo muncul di preview settings ✅
- Logo tidak muncul di invite link ❌
- Logs show hasLogo: false

**Penyebab:**
- Browser cache
- Firebase cache
- React state not updated

**Solusi:**
```bash
# Clear browser cache
Ctrl + Shift + Delete → Clear images & files

# Hard refresh
Ctrl + F5 (Windows)
Cmd + Shift + R (Mac)

# Test di incognito
Ctrl + Shift + N

# Force re-fetch
Add timestamp to URL: ?mode=assess&cid=c1&t=123456789
```

---

## 📊 Complete Debugging Flow

```
┌─────────────────────────────────────┐
│  1. Upload Logo                     │
│     - File < 5MB                    │
│     - Compression happens           │
│     - Preview shows logo ✅         │
└─────────┬───────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│  2. Click "Simpan Perubahan"        │
│     - updateCompany(id, formData)   │
│     - Logo saved to Firestore       │
└─────────┬───────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│  3. VERIFICATION (NEW)              │
│     - getCompanyById(id)            │
│     - Compare saved vs original     │
│     - If mismatch → Alert error     │
└─────────┬───────────────────────────┘
          │
          ↓ (If verified ✅)
          │
┌─────────────────────────────────────┐
│  4. Open Invite Link                │
│     - Parse cid from URL            │
│     - fetchCompany(cid)             │
│     - getCompanyById(cid)           │
└─────────┬───────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│  5. Company Data Loaded             │
│     - setCompany(data)              │
│     - logoUrl = data.logoUrl        │
│     - If no logoUrl → Icon          │
└─────────┬───────────────────────────┘
          │
          ↓
┌─────────────────────────────────────┐
│  6. Header Renders                  │
│     - Check if logoUrl exists       │
│     - If yes: <img src={logoUrl} /> │
│     - If no: <ShieldCheck icon />   │
└─────────────────────────────────────┘
```

**Setiap step sekarang memiliki console logs untuk tracking!**

---

## 🎯 Quick Diagnostic Commands

### Check Logo in Firestore (Firebase Console)

1. Buka: https://console.firebase.google.com
2. Pilih project: **gen-lang-client-0226679970**
3. Firestore Database → `companies` collection
4. Find company document (e.g., `c1`)
5. Check field: `logoUrl`
   - Should start with: `data:image/png;base64,`
   - Length should be > 1000 characters

### Check Logo in Browser Console

```javascript
// Di Settings Page:
console.log("Form Logo Length:", formData.logoUrl.length);
console.log("Saved Logo Length:", currentCompany.logoUrl?.length);

// Di Public Assessment:
console.log("Company Logo Length:", company?.logoUrl?.length);
console.log("Logo URL (first 100 chars):", logoUrl?.substring(0, 100));
```

### Test Logo Base64

```javascript
// Copy logo base64 dari Firestore
const testLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...";

// Create image element
const img = new Image();
img.src = testLogo;
img.onload = () => console.log("✅ Logo valid");
img.onerror = () => console.log("❌ Logo invalid");
```

---

## 💡 Best Practices

### 1. **Optimal Logo Size**
```
Dimensions: 300x300px - 500x500px
File Format: PNG with transparency
File Size: < 200KB (before upload)
Compression: Automatic (done by app)
Result: ~100-300KB base64 in Firestore ✅
```

### 2. **Testing Workflow**
```
1. Upload logo → Check preview ✅
2. Save changes → Check verification logs ✅
3. Refresh settings page → Logo should persist ✅
4. Open invite link (incognito) → Logo should appear ✅
5. Check console logs at each step
```

### 3. **Firestore Limits**
```
Document max size: 1MB total
Logo recommendation: < 500KB base64
Other fields (text): ~5-10KB
Safe margin: Logo < 800KB base64
```

---

## 🆘 Still Not Working?

**Provide this info:**

1. **Settings Page Console Logs:**
   - Saving company settings: {...}
   - Verified data from Firestore: {...}
   - Verification status

2. **Public Assessment Console Logs:**
   - [PUBLIC-ASSESSMENT] Company data loaded: {...}
   - [HEADER] Rendering header: {...}
   - [HEADER] Logo load status

3. **Screenshots:**
   - Logo preview in settings
   - Invite link (without logo)
   - Browser Console (F12)

4. **Info:**
   - Logo file: size, format
   - Company ID
   - Browser & OS

---

## 🎉 Summary

**Changes Made:**
- ✅ Added verification after save (read-back from Firestore)
- ✅ Enhanced logging in Settings component
- ✅ Enhanced logging in PublicAssessment component
- ✅ Logo load success/error tracking
- ✅ Better error messages

**How to Use:**
1. Open Browser Console (F12) before any action
2. Upload & Save logo → Monitor logs
3. Open invite link → Monitor logs
4. Compare logs between steps
5. Identify where logo data is lost

**Common Issues:**
- Logo > 1MB → Won't save to Firestore
- Company ID mismatch → Wrong data loaded
- Browser cache → Clear cache / incognito
- Invalid base64 → Re-upload logo

**Build Status:** ✅ SUCCESS
**Ready for Testing:** ✅
**Next:** Test dengan logo real & monitor console logs
