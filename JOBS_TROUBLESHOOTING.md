# Troubleshooting: Lowongan Tidak Muncul Setelah Dibuat

## 🔍 Diagnosis Step-by-Step

### Step 1: Buka Browser Console (WAJIB!)

**Cara:**
1. Buka aplikasi di browser
2. Tekan **F12** (atau Ctrl+Shift+I / Cmd+Option+I)
3. Pilih tab **Console**
4. Biarkan console terbuka saat testing

### Step 2: Test Buat Lowongan

1. Login ke aplikasi
2. Klik menu **"Kelola Lowongan"**
3. Lihat console → harus muncul:
   ```
   [JOBS] Loading jobs for company: c1
   [FIREBASE] Fetching jobs for companyId: c1
   [FIREBASE] Executing query...
   ```

4. Klik **"Buat Lowongan Baru"**
5. Isi semua field:
   - Judul: "Test Engineer"
   - Lokasi: "Jakarta"
   - Tipe: "Full-time"
   - Deskripsi: "Test deskripsi"
   - Toggle Instant Assessment: ON
   - Status: Active

6. Klik **"Buat Lowongan"**
7. **Lihat console** → harus muncul:
   ```
   [JOBS] Starting save process...
   [JOBS] Form data: { title: "Test Engineer", ... }
   [JOBS] Company ID: c1
   [JOBS] Generated slug: test-engineer
   [JOBS] Creating new job...
   [JOBS] Job data to create: { ... }
   [JOBS] Job created with ID: xyz123
   [JOBS] Reloading jobs list...
   [FIREBASE] Fetching jobs for companyId: c1
   [FIREBASE] Query result - documents count: 1
   [FIREBASE] Job document: { id: "xyz123", ... }
   [JOBS] Fetched jobs: [...]
   [JOBS] Number of jobs: 1
   [JOBS] Jobs list reloaded
   ```

---

## 🚨 Error Case 1: Firestore Index Missing

**Gejala di Console:**
```
[JOBS] Error code: failed-precondition
[JOBS] ⚠️ FIRESTORE INDEX REQUIRED!
[JOBS] Collection: jobs
[JOBS] Fields: companyId (asc), datePosted (desc)
```

**Penyebab:**
Firestore membutuhkan composite index untuk query dengan `where` + `orderBy`.

**Solusi:**

**Opsi A: Auto-create via Firebase Console Link**
1. Lihat console → akan ada link seperti:
   ```
   https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes?create_composite=...
   ```
2. Klik link tersebut
3. Firestore akan auto-generate index definition
4. Klik **"Create Index"**
5. Tunggu 2-5 menit sampai status = "Enabled"

**Opsi B: Manual di Firebase Console**
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. **Firestore Database** → **Indexes** tab
4. Klik **"Create Index"**
5. Isi:
   - Collection ID: `jobs`
   - Field 1: `companyId` → Ascending
   - Field 2: `datePosted` → Descending
6. Klik **"Create"**
7. Tunggu sampai status = "Enabled"

**Opsi C: Fallback Query (Temporary)**
Saya sudah tambahkan fallback otomatis di code. Jika index belum ada, sistem akan:
1. Mencoba query tanpa `orderBy`
2. Sort di client-side (JavaScript)
3. Console akan tampil:
   ```
   [JOBS] Trying fallback query without orderBy...
   [JOBS] Fallback query succeeded, found X jobs
   ```

**Setelah Index Dibuat:**
- Refresh halaman
- Buat lowongan baru
- Sekarang harus muncul

---

## 🚨 Error Case 2: Data Tidak Tersimpan di Firestore

**Gejala di Console:**
```
[JOBS] Job created with ID: xyz123
[JOBS] Reloading jobs list...
[FIREBASE] Query result - documents count: 0
```

**Diagnosis:**
Job berhasil dibuat tapi query tidak menemukan data.

**Cek di Firebase Console:**
1. Buka [Firebase Console](https://console.firebase.google.com)
2. **Firestore Database** → **Data** tab
3. Cari collection: `jobs`
4. Apakah ada document di sana?

**Skenario A: Collection `jobs` Ada & Berisi Data**
→ Masalah di query (kemungkinan companyId tidak match)

**Fix:**
```javascript
// Cek di console
console.log('Current Company ID:', currentCompany.id);

// Bandingkan dengan companyId di Firestore document
```

**Skenario B: Collection `jobs` Tidak Ada**
→ Firestore rules mungkin memblokir write

**Cek Firestore Rules:**
```javascript
// File: firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write untuk jobs collection
    match /jobs/{jobId} {
      allow read, write: if true; // Untuk testing
    }
  }
}
```

**Deploy Rules:**
```bash
firebase deploy --only firestore:rules
```

---

## 🚨 Error Case 3: Permission Denied

**Gejala di Console:**
```
[JOBS] Error code: permission-denied
[JOBS] Error message: Missing or insufficient permissions
```

**Penyebab:**
Firestore Security Rules memblokir akses.

**Solusi:**

**Step 1: Cek Firestore Rules**
```javascript
// firestore.rules
match /jobs/{jobId} {
  allow read: if true; // Public read
  allow create: if request.auth != null; // Hanya authenticated user bisa create
  allow update, delete: if request.auth != null;
}
```

**Step 2: Deploy Rules**
```bash
firebase deploy --only firestore:rules
```

**Step 3: Test Lagi**
- Refresh halaman
- Login ulang (jika perlu)
- Buat lowongan baru

---

## 🚨 Error Case 4: Loading Terus (Stuck)

**Gejala:**
- Setelah klik "Buat Lowongan", modal hilang
- Loading spinner muncul terus
- Tidak ada lowongan yang muncul

**Diagnosis di Console:**
```
[JOBS] Job created with ID: xyz123
[JOBS] Reloading jobs list...
[FIREBASE] Fetching jobs for companyId: c1
(stuck here - no more logs)
```

**Penyebab:**
Query `getJobsByCompany` hang atau error.

**Fix:**
Cek error di console:
- Jika ada error → ikuti panduan error tersebut
- Jika tidak ada error → refresh halaman manual (F5)

---

## 🚨 Error Case 5: Alert "Gagal menyimpan lowongan"

**Gejala:**
Alert error muncul dengan pesan error.

**Diagnosis:**
Lihat console untuk detail error:
```
[JOBS] Error saving job: FirebaseError: ...
[JOBS] Error details: { message: "...", code: "...", ... }
```

**Common Errors:**

| Error Code | Penyebab | Solusi |
|------------|----------|--------|
| `permission-denied` | Firestore rules memblokir | Deploy firestore rules |
| `failed-precondition` | Index belum dibuat | Create index di Firebase Console |
| `not-found` | Collection tidak ditemukan | Cek nama collection = "jobs" |
| `invalid-argument` | Data format salah | Cek console log "Job data to create" |

---

## ✅ Verification Checklist

Gunakan checklist ini untuk memastikan semuanya bekerja:

### Before Testing
- [ ] Firebase deployed (`firebase deploy`)
- [ ] Browser console terbuka (F12)
- [ ] Login sebagai company admin

### Create Job Test
- [ ] Navigate to "Kelola Lowongan"
- [ ] Console: `[JOBS] Loading jobs...` muncul
- [ ] Click "Buat Lowongan Baru"
- [ ] Fill all fields
- [ ] Click "Buat Lowongan"
- [ ] Console: `[JOBS] Job created with ID: ...` muncul
- [ ] Alert: "Lowongan berhasil dibuat!" muncul
- [ ] Modal closes automatically
- [ ] Console: `[JOBS] Jobs list reloaded` muncul
- [ ] Job appears in table

### Verify in Firestore
- [ ] Open Firebase Console
- [ ] Navigate to Firestore → Data
- [ ] Collection `jobs` exists
- [ ] Document with correct data exists
- [ ] Fields include: companyId, slug, title, location, etc.

---

## 🔧 Quick Fixes

### Fix 1: Reset & Retry
```javascript
// Di browser console, jalankan:
localStorage.clear();
location.reload();
```

### Fix 2: Check Company ID
```javascript
// Di browser console, jalankan:
console.log('Current Company:', currentCompany);
```

### Fix 3: Manual Firestore Check
1. Buka Firebase Console
2. Firestore → Data
3. Cari collection `jobs`
4. Cek apakah ada document dengan `companyId` yang sama

### Fix 4: Test Query Manual
```javascript
// Di browser console, jalankan:
import { getJobsByCompany } from './services/firebase';
const jobs = await getJobsByCompany('YOUR_COMPANY_ID');
console.log('Jobs:', jobs);
```

---

## 📞 Debug Information to Share

Jika masih bermasalah, kirimkan informasi berikut:

1. **Screenshot Console Logs**
   - Buka F12 → Console
   - Screenshot semua log dengan prefix `[JOBS]` atau `[FIREBASE]`

2. **Error Message**
   - Copy-paste full error dari console

3. **Firestore Screenshot**
   - Buka Firebase Console → Firestore → Data
   - Screenshot collection `jobs`

4. **Steps Taken**
   - Apa yang Anda lakukan (step-by-step)
   - Apa hasil yang diharapkan
   - Apa hasil yang terjadi

---

## 🎯 Most Likely Issues

Berdasarkan pengalaman, masalah paling sering adalah:

1. **Firestore Index Missing (80%)** → Create index di Firebase Console
2. **Firestore Rules Blocking (15%)** → Deploy firestore rules
3. **Wrong Company ID (5%)** → Cek console log

---

## ✅ Next Steps

**Sekarang, lakukan ini:**

1. **Buka browser console** (F12)
2. **Refresh halaman** (Ctrl+R / Cmd+R)
3. **Navigate ke "Kelola Lowongan"**
4. **Buat lowongan test**
5. **Lihat console logs**
6. **Kirim screenshot console ke saya**

Dengan console logs, saya bisa langsung tahu masalahnya dan kasih solusi spesifik! 🚀
