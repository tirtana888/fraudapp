# Deployment Guide: Zero-Touch Recruitment Module

## 🚀 Deploy Step-by-Step

### Step 1: Build Project

```bash
npm run build
```

**Expected Output:**
```
✓ 2305 modules transformed.
✓ built in 12.65s
```

✅ **Jika berhasil**, lanjut ke Step 2
❌ **Jika error**, perbaiki dulu sebelum deploy

---

### Step 2: Deploy ke Firebase

```bash
firebase deploy
```

**Proses deploy akan:**
1. ✅ Upload Firestore Rules (jobs & applications permissions)
2. ✅ Upload Storage Rules (CV upload permissions)
3. ✅ Create Firestore Indexes (for jobs queries)
4. ✅ Upload Hosting (website files)
5. ✅ Deploy Functions (email blast, etc)

**Expected Output:**
```
=== Deploying to 'your-project'...

i  deploying firestore, storage, hosting
✔  firestore: deployed rules firestore.rules
✔  firestore: deployed indexes from firestore.indexes.json
✔  storage: deployed rules storage.rules
✔  hosting: file upload complete
✔  Deploy complete!

Hosting URL: https://your-project.web.app
```

---

### Step 3: Verify Firestore Indexes

**Kenapa penting?**
Tanpa index, query `getJobsByCompany` akan error!

**Cara cek:**

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. **Firestore Database** → **Indexes** tab
4. Pastikan ada index:

| Collection | Fields | Status |
|------------|--------|--------|
| `jobs` | `companyId` (asc), `datePosted` (desc) | ✅ Enabled |
| `jobs` | `companyId` (asc), `slug` (asc) | ✅ Enabled |
| `applications` | `companyId` (asc), `appliedAt` (desc) | ✅ Enabled |

**Status:**
- 🟢 **Enabled** = Ready to use
- 🟡 **Building** = Wait 2-5 minutes
- 🔴 **Error** = Check error message

**Jika index missing:**
```bash
firebase deploy --only firestore:indexes
```

---

### Step 4: Verify Firestore Rules

**Cara cek:**

1. Firebase Console → Firestore → **Rules** tab
2. Pastikan ada rules untuk:

```javascript
match /jobs/{jobId} {
  allow read: if true;
  allow create, update, delete: if true;
}

match /applications/{applicationId} {
  allow read: if true;
  allow create: if true;
  allow update, delete: if true;
}
```

**Test rules:**
```bash
firebase deploy --only firestore:rules
```

---

### Step 5: Verify Storage Rules

**Cara cek:**

1. Firebase Console → Storage → **Rules** tab
2. Pastikan ada rules untuk CVs:

```javascript
match /cvs/{applicationId}/{fileName} {
  allow read: if true;
  allow write: if request.resource.size <= 5 * 1024 * 1024
               && request.resource.contentType == 'application/pdf';
}
```

**Test rules:**
```bash
firebase deploy --only storage
```

---

## ✅ Post-Deployment Testing

### Test 1: Access Job Manager

1. Buka aplikasi: `https://your-project.web.app`
2. Login dengan akun company admin
3. Navigate ke **"Kelola Lowongan"** di sidebar
4. **Buka Console** (F12)
5. Lihat logs:
   ```
   [JOBS] Loading jobs for company: c1
   [FIREBASE] Fetching jobs for companyId: c1
   ```

✅ **Expected:** Loading spinner → Empty state atau job list
❌ **Error:** Lihat console untuk error message

---

### Test 2: Create Job

1. Masih di "Kelola Lowongan"
2. Click **"Buat Lowongan Baru"**
3. Isi form:
   - Judul: "Software Engineer"
   - Lokasi: "Jakarta, Indonesia"
   - Tipe: "Full-time"
   - Deskripsi: "We are looking for talented engineers..."
   - **Toggle "Enable Instant Assessment": ON**
   - Status: "Active"
4. Click **"Buat Lowongan"**
5. **Lihat Console:**
   ```
   [JOBS] Starting save process...
   [JOBS] Generated slug: software-engineer
   [JOBS] Creating new job...
   [JOBS] Job created with ID: xyz123
   [JOBS] Reloading jobs list...
   [FIREBASE] Query result - documents count: 1
   ```
6. **Expected:** Alert "Lowongan berhasil dibuat!" + Job muncul di table

---

### Test 3: Verify in Firestore

1. Buka Firebase Console → Firestore → Data
2. Cari collection **`jobs`**
3. Buka document yang baru dibuat
4. Verify fields:
   ```
   {
     companyId: "c1",
     slug: "software-engineer",
     title: "Software Engineer",
     location: "Jakarta, Indonesia",
     jobType: "Full-time",
     description: "...",
     enableInstantAssessment: true,
     status: "Active",
     datePosted: "2025-12-03T08:00:00.000Z",
     applicantsCount: 0,
     createdAt: "2025-12-03T08:00:00.000Z",
     updatedAt: "2025-12-03T08:00:00.000Z"
   }
   ```

✅ **Semua field ada** = Success!
❌ **Ada field missing** = Check console logs

---

### Test 4: Copy Public Link

1. Di job table, click icon **Copy** (📋)
2. Paste di notepad:
   ```
   https://your-project.web.app/careers/company-name/software-engineer
   ```
3. Open link di **incognito window / private browsing**
4. **Expected:** Public job page loads with:
   - Company logo (jika ada)
   - Job title: "Software Engineer"
   - Location: "Jakarta, Indonesia"
   - Job type: "Full-time"
   - Description
   - **"Zero-Touch Screening Aktif"** badge
   - Application form (Name, Email, WhatsApp, CV upload)

---

### Test 5: Submit Application (Manual Test)

**Scenario A: With Instant Assessment (enableInstantAssessment = true)**

1. Open public job link
2. Fill form:
   - Nama: "John Doe"
   - Email: "john@example.com"
   - WhatsApp: "+62 812 3456 7890"
   - Upload CV: (pilih file PDF < 5MB)
3. Click **"Kirim Lamaran"**
4. **Expected:**
   - Loading spinner appears
   - Console logs:
     ```
     [PUBLIC-JOB] Submitting application...
     [PUBLIC-JOB] Uploading CV...
     [STORAGE] CV uploaded: https://...
     [PUBLIC-JOB] Creating application...
     [PUBLIC-JOB] Application created: app123
     [PUBLIC-JOB] Instant Assessment enabled, redirecting...
     [PUBLIC-JOB] Redirect URL: /assessment/start?token=...
     ```
   - **REDIRECT** to assessment page
   - Assessment page loads

**Scenario B: Without Instant Assessment (enableInstantAssessment = false)**

1. Buat job baru dengan toggle OFF
2. Open public link
3. Submit application
4. **Expected:**
   - Success modal appears
   - Message: "Aplikasi Terkirim!"
   - No redirect
   - Form clears

---

### Test 6: Verify Application in Firestore

1. Firebase Console → Firestore → Data
2. Collection **`applications`**
3. Find document yang baru dibuat
4. Verify fields:
   ```
   {
     jobId: "xyz123",
     companyId: "c1",
     fullName: "John Doe",
     email: "john@example.com",
     whatsapp: "+62 812 3456 7890",
     cvUrl: "https://firebasestorage.googleapis.com/...",
     status: "Pending",
     assessmentToken: "token-uuid-here", // if instant assessment enabled
     appliedAt: "2025-12-03T08:15:00.000Z",
     createdAt: "2025-12-03T08:15:00.000Z"
   }
   ```

---

### Test 7: Verify CV in Storage

1. Firebase Console → Storage → **Files**
2. Navigate to folder: `cvs/`
3. Find subfolder: `{applicationId}/`
4. Verify:
   - PDF file exists
   - File size < 5MB
   - Can download file

---

### Test 8: Verify Applicant Count

1. Kembali ke "Kelola Lowongan" di dashboard
2. Lihat job yang tadi dibuat
3. **Applicants Count** column harus = **1**
4. Jika submit lagi → count increment to **2**

---

## 🚨 Common Issues & Solutions

### Issue 1: "Firestore index required"

**Error:**
```
[JOBS] Error code: failed-precondition
[JOBS] ⚠️ FIRESTORE INDEX REQUIRED!
```

**Solution:**
```bash
firebase deploy --only firestore:indexes
```

Wait 2-5 minutes for index to build.

---

### Issue 2: "Permission denied"

**Error:**
```
[JOBS] Error code: permission-denied
```

**Solution:**
```bash
firebase deploy --only firestore:rules
```

---

### Issue 3: CV upload fails

**Error:**
```
[STORAGE] CV upload failed: storage/unauthorized
```

**Solution:**
```bash
firebase deploy --only storage
```

---

### Issue 4: Job tidak muncul setelah dibuat

**Debug Steps:**

1. **Cek Console Logs:**
   ```
   [JOBS] Job created with ID: xyz123
   [JOBS] Reloading jobs list...
   ```

2. **Cek Firestore:**
   - Firebase Console → Firestore → jobs collection
   - Apakah document ada?

3. **Cek Index:**
   - Firebase Console → Firestore → Indexes
   - Status = Enabled?

4. **Cek Query:**
   ```javascript
   // Di console browser:
   console.log('Company ID:', currentCompany.id);
   ```

**Solution:**
Lihat file `JOBS_TROUBLESHOOTING.md` untuk detail lengkap.

---

## 🎯 Deployment Checklist

Gunakan checklist ini sebelum declare "production-ready":

### Pre-Deploy
- [ ] `npm run build` success (no errors)
- [ ] All TypeScript errors fixed
- [ ] Console logs cleaned up (optional)

### Deploy
- [ ] `firebase deploy` success
- [ ] Hosting URL accessible
- [ ] No deployment errors

### Post-Deploy Verification
- [ ] Firestore indexes status = "Enabled"
- [ ] Firestore rules deployed correctly
- [ ] Storage rules deployed correctly
- [ ] Can access "Kelola Lowongan" page
- [ ] Can create new job
- [ ] Job appears in list after creation
- [ ] Can copy public link
- [ ] Public job page loads correctly
- [ ] Can submit application
- [ ] CV uploads successfully
- [ ] Application saved to Firestore
- [ ] Applicant count increments
- [ ] Instant assessment redirect works (if enabled)
- [ ] Manual application works (if disabled)

### Stress Test (Optional)
- [ ] Create 10 jobs
- [ ] Submit 10 applications to 1 job
- [ ] Upload various PDF sizes (1KB - 4.9MB)
- [ ] Test with long job descriptions
- [ ] Test with special characters in job title

---

## 📊 Monitoring

**After deployment, monitor:**

1. **Firestore Usage:**
   - Firebase Console → Usage
   - Reads/Writes per day
   - Document count

2. **Storage Usage:**
   - Firebase Console → Storage → Usage
   - Total CVs stored
   - Bandwidth used

3. **Hosting:**
   - Firebase Console → Hosting
   - Requests per day
   - Bandwidth

4. **Error Logs:**
   - Browser Console (client-side)
   - Firebase Console → Functions → Logs (server-side)

---

## 🎉 Success Criteria

Deployment dianggap **berhasil** jika:

✅ HR bisa create job dengan instant assessment toggle
✅ Public job link accessible tanpa login
✅ Candidate bisa submit application + upload CV
✅ Auto-redirect ke assessment (jika enabled)
✅ Manual application success (jika disabled)
✅ Applicant count accurate
✅ All data tersimpan di Firestore
✅ CVs tersimpan di Storage
✅ No console errors

---

## 🔄 Rollback Plan

Jika ada masalah serius:

1. **Rollback Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Rollback Storage Rules:**
   ```bash
   firebase deploy --only storage
   ```

3. **Rollback Hosting:**
   - Firebase Console → Hosting → Release history
   - Click "Rollback" pada version sebelumnya

4. **Delete Test Data:**
   - Firestore Console → Delete test jobs
   - Firestore Console → Delete test applications
   - Storage Console → Delete test CVs

---

## 📞 Need Help?

Jika masih ada issue:

1. **Buka Console (F12)**
2. **Screenshot semua error logs**
3. **Copy-paste error message**
4. **Share:**
   - Console screenshots
   - Firestore screenshot (jobs collection)
   - Storage screenshot (cvs folder)
   - Steps yang sudah dilakukan

Dengan informasi ini saya bisa kasih solusi yang lebih spesifik!

---

## ✅ Final Command

Untuk full deployment:

```bash
# Build
npm run build

# Deploy everything
firebase deploy

# Verify in browser
# 1. Open https://your-project.web.app
# 2. Login
# 3. Go to "Kelola Lowongan"
# 4. Create test job
# 5. Open public link
# 6. Submit test application
# 7. Verify in Firestore

# Done! 🎉
```

**Total Time:** ~10 minutes
- Build: 1-2 minutes
- Deploy: 3-5 minutes
- Testing: 5 minutes

---

## 🚀 You're Ready!

Sekarang module **Zero-Touch Recruitment** sudah production-ready dan siap digunakan! 🎊
