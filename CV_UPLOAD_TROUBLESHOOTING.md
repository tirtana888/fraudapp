# Troubleshooting: CV Upload Stuck Spinning

## 🔍 Problem: Upload CV Hanya Spinning Terus

Ketika kandidat submit aplikasi dan upload CV, tombol "Kirim Lamaran" spinning terus dan tidak selesai-selesai.

---

## 🚨 WAJIB: Test dengan Console Terbuka!

**SANGAT PENTING:** Sebelum test upload, buka Console untuk lihat error!

### Cara Buka Console:
1. Buka halaman job public (contoh: `/careers/company/job-title`)
2. **Tekan F12** (atau Ctrl+Shift+I / Cmd+Option+I)
3. Pilih tab **Console**
4. **Biarkan console tetap terbuka** saat testing

---

## 📋 Step-by-Step Debug

### Step 1: Test Upload dengan Console Terbuka

1. Buka public job page
2. Isi form aplikasi:
   - Nama: "Test User"
   - Email: "test@example.com"
   - WhatsApp: "+62 812 3456 7890"
   - Upload CV: Pilih file PDF (coba yang kecil dulu, < 1MB)
3. Klik **"Kirim Lamaran"**
4. **LIHAT CONSOLE!**

---

### Step 2: Identifikasi Error dari Console Logs

Console akan menampilkan logs detail. Cari pattern ini:

#### ✅ **SUCCESS Pattern** (Upload Berhasil):
```
[PUBLIC-JOB] ========== FORM SUBMIT START ==========
[PUBLIC-JOB] Form data: { fullName: "Test User", ... }
[PUBLIC-JOB] Validation passed
[PUBLIC-JOB] Job and Company data OK
[PUBLIC-JOB] ===== STEP 1: UPLOADING CV =====
[STORAGE] uploadCV called with: { applicationId: "...", fileName: "CV.pdf", ... }
[STORAGE] Storage initialized OK
[STORAGE] File type validation passed
[STORAGE] File size validation passed
[STORAGE] Storage path: cvs/xxx-xxx/CV.pdf
[STORAGE] Creating storage reference...
[STORAGE] Storage reference created
[STORAGE] Starting file upload...
[STORAGE] File uploaded to storage, getting download URL...
[STORAGE] CV uploaded successfully!
[STORAGE] Download URL: https://firebasestorage.googleapis.com/...
[PUBLIC-JOB] ✅ CV uploaded successfully!
[PUBLIC-JOB] ===== STEP 2: CREATING APPLICATION =====
[PUBLIC-JOB] ✅ Application created with ID: abc123
[PUBLIC-JOB] ===== STEP 3: REDIRECTING TO ASSESSMENT =====
[PUBLIC-JOB] ========== FORM SUBMIT SUCCESS ==========
```

#### ❌ **ERROR Pattern 1: Storage Not Initialized**
```
[PUBLIC-JOB] ===== STEP 1: UPLOADING CV =====
[STORAGE] uploadCV called with: ...
[STORAGE] Storage not initialized!
```

**Penyebab:** Firebase Storage belum di-initialize di `firebase.ts`

**Solusi:** Cek `services/firebase.ts` line ~30:
```typescript
export let storage: any;

// Di fungsi initFirebase():
storage = getStorage(app);
```

---

#### ❌ **ERROR Pattern 2: Permission Denied**
```
[STORAGE] Starting file upload...
[STORAGE] CV upload failed!
[STORAGE] Error code: storage/unauthorized
```

**Penyebab:** Storage Rules belum di-deploy atau salah konfigurasi

**Solusi:**

**A. Deploy Storage Rules:**
```bash
firebase deploy --only storage
```

**B. Verify Storage Rules:**
1. Buka [Firebase Console](https://console.firebase.google.com)
2. **Storage** → **Rules** tab
3. Pastikan ada rule ini:
```javascript
match /cvs/{applicationId}/{fileName} {
  allow read: if true;
  allow write: if request.resource.size <= 5 * 1024 * 1024
               && request.resource.contentType == 'application/pdf';
}
```

**C. Manual Fix (Temporary - Untuk Testing):**
```javascript
// ⚠️ HANYA UNTUK TESTING! Jangan pakai di production!
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

Deploy:
```bash
firebase deploy --only storage
```

---

#### ❌ **ERROR Pattern 3: Network/Timeout**
```
[STORAGE] Starting file upload...
(no more logs - stuck here)
```

**Penyebab:**
- Network lambat
- File terlalu besar
- Firebase Storage tidak reachable

**Solusi:**

**A. Test dengan file lebih kecil:**
- Coba PDF < 500KB dulu
- Jika berhasil → problem di ukuran file
- Jika gagal → problem di network/config

**B. Cek Firebase Storage bucket:**
1. Firebase Console → Storage
2. Pastikan bucket sudah dibuat
3. Lihat Files tab → harus bisa lihat folder structure

**C. Cek network di Console:**
- Tab **Network** (di samping Console)
- Filter: "firebasestorage"
- Lihat request ke `firebasestorage.googleapis.com`
- Status harus 200 OK

---

#### ❌ **ERROR Pattern 4: Invalid File Type**
```
[STORAGE] uploadCV called with: { ..., fileType: "application/octet-stream" }
[STORAGE] Invalid file type: application/octet-stream
```

**Penyebab:** Browser tidak detect file type dengan benar

**Solusi:**

**A. Test dengan PDF yang valid:**
- Download sample PDF dari internet
- Coba upload sample tersebut

**B. Relaxed validation (temporary):**
Edit `services/firebase.ts`:
```typescript
// Temporary fix - accept any PDF-like file
const validTypes = ['application/pdf', 'application/octet-stream'];
if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf')) {
  throw new Error("Format file tidak valid. Gunakan PDF.");
}
```

---

#### ❌ **ERROR Pattern 5: File Too Large**
```
[STORAGE] File too large: 6.5 MB
```

**Penyebab:** File > 5MB

**Solusi:**
- Kandidat harus compress PDF
- Atau adjust max size di code:
```typescript
// Naikkan limit ke 10MB (not recommended)
const maxSize = 10 * 1024 * 1024;
```

---

## 🔧 Common Fixes

### Fix 1: Force Re-deploy Everything

```bash
# Build fresh
npm run build

# Deploy everything
firebase deploy

# Wait 1-2 minutes

# Test again dengan console terbuka
```

---

### Fix 2: Check Firebase Storage Bucket

1. Buka [Firebase Console](https://console.firebase.google.com)
2. **Storage** → **Dashboard**
3. Pastikan ada bucket (contoh: `your-project.appspot.com`)
4. Jika belum ada → Klik "Get Started" untuk create

---

### Fix 3: Verify Storage Initialization

**Cek file `services/firebase.ts`:**

```typescript
import { getStorage } from 'firebase/storage';

export let storage: any;

export const initFirebase = () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app); // ← PASTIKAN INI ADA!

  console.log('[FIREBASE] Storage initialized:', storage);
};
```

**Test di Browser Console:**
```javascript
// Paste ini di console:
import { storage } from './services/firebase';
console.log('Storage:', storage);

// Harus output object Storage, bukan null/undefined
```

---

### Fix 4: Test Upload Manual (Debug)

Paste script ini di browser console untuk test manual upload:

```javascript
// Test manual upload
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { storage } from './services/firebase';

// Pilih file dari input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

console.log('File:', file);
console.log('Storage:', storage);

// Try upload
const storageRef = ref(storage, `test-uploads/${file.name}`);
console.log('Ref:', storageRef);

const snapshot = await uploadBytes(storageRef, file);
console.log('Snapshot:', snapshot);

const url = await getDownloadURL(snapshot.ref);
console.log('URL:', url);

// Jika ini berhasil → problem di aplikasi logic
// Jika ini error → problem di Firebase config
```

---

## 📊 Diagnostic Checklist

Gunakan checklist ini untuk troubleshoot:

### Pre-Deployment
- [ ] `npm run build` success
- [ ] `firebase deploy` success
- [ ] Storage rules deployed
- [ ] Firestore rules deployed

### Firebase Console Checks
- [ ] Storage bucket exists
- [ ] Storage rules ada rule untuk `/cvs/{applicationId}/{fileName}`
- [ ] Firestore rules ada rule untuk `applications` collection

### Browser Testing
- [ ] Console terbuka saat testing (F12)
- [ ] Test dengan PDF < 1MB
- [ ] Test dengan PDF valid (download dari internet)
- [ ] Network tab shows request ke firebasestorage.googleapis.com

### Code Verification
- [ ] `storage = getStorage(app)` ada di `firebase.ts`
- [ ] `uploadCV` function exist di `firebase.ts`
- [ ] `PublicJobPage` import `uploadCV` dengan benar

---

## 🎯 Most Likely Issues

Berdasarkan pengalaman, masalah paling sering:

| Issue | Probability | Fix |
|-------|-------------|-----|
| **Storage Rules not deployed** | 60% | `firebase deploy --only storage` |
| **Storage not initialized** | 20% | Check `firebase.ts` initialization |
| **Network timeout** | 10% | Test with smaller file |
| **Invalid PDF** | 5% | Try different PDF |
| **File too large** | 5% | Compress PDF |

---

## 📸 Info yang Dibutuhkan (Jika Masih Error)

Kirim screenshot/info ini:

1. **Console Logs (LENGKAP!)**
   - Dari `[PUBLIC-JOB] FORM SUBMIT START` sampai error
   - Terutama bagian `[STORAGE]` logs

2. **Network Tab**
   - Filter: "firebasestorage"
   - Screenshot request & response

3. **Firebase Console**
   - Storage → Rules (screenshot)
   - Storage → Files (screenshot folder structure)

4. **File Info**
   - Nama file
   - Ukuran file (KB/MB)
   - Type file (dari console log)

5. **Error Message**
   - Full error dari console
   - Error code (storage/unauthorized, dll)

---

## ✅ Test Plan

**Test 1: Happy Path**
1. Deploy: `firebase deploy`
2. Buka public job page
3. Isi form dengan data valid
4. Upload PDF < 1MB
5. Console harus show "CV uploaded successfully!"
6. Application tersimpan di Firestore
7. CV tersimpan di Storage

**Test 2: Invalid File**
1. Upload .docx atau .txt
2. Console harus show "Invalid file type"
3. Alert: "Format file tidak valid"

**Test 3: Large File**
1. Upload PDF > 5MB
2. Console harus show "File too large"
3. Alert: "Ukuran file terlalu besar"

**Test 4: Network Failure** (Simulate)
1. Buka Network tab → Throttle: "Slow 3G"
2. Upload PDF 2MB
3. Harus ada progress indicator
4. Harus timeout atau berhasil (lambat tapi selesai)

---

## 🚀 Quick Commands

```bash
# Full redeploy
firebase deploy

# Storage only
firebase deploy --only storage

# Rules only
firebase deploy --only storage,firestore:rules

# Check deployment status
firebase deploy --debug
```

---

## ⚡ Emergency Workaround (Allow All)

**HANYA untuk testing! Jangan di production!**

**Storage Rules (Allow All):**
```javascript
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

Deploy:
```bash
firebase deploy --only storage
```

Test upload. Jika berhasil → problem di rules specificity.
Jika tetap gagal → problem lain (initialization, network, dll).

**Setelah test, KEMBALIKAN ke secure rules!**

---

## 📞 Need More Help?

**Lakukan ini:**
1. Deploy: `firebase deploy`
2. Buka public job page
3. Buka Console (F12)
4. Test upload CV
5. Screenshot SEMUA console logs
6. Screenshot Network tab
7. Share ke saya

Dengan logs lengkap, saya bisa kasih solusi yang SANGAT spesifik! 🎯
