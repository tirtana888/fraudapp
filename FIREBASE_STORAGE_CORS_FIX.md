# Fix: Firebase Storage CORS Error

## 🚨 Error yang Terjadi

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...'
from origin 'https://tirtana888-fraudguar-68hf.bolt.host' has been blocked
by CORS policy: Response to preflight request doesn't pass access control
check: It does not have HTTP ok status.
```

**Artinya:** Firebase Storage tidak mengizinkan upload dari domain `bolt.host` karena CORS (Cross-Origin Resource Sharing) belum dikonfigurasi.

---

## ✅ SOLUSI

Ada 4 cara untuk fix issue ini:

---

## 🎯 Solusi 1: Deploy ke Firebase Hosting (RECOMMENDED - PALING MUDAH!)

**Kenapa ini paling mudah?**
- Firebase Hosting domain sudah otomatis di-whitelist untuk Storage
- Tidak perlu konfigurasi CORS manual
- Langsung bisa test production

**Langkah:**

### Step 1: Deploy ke Firebase Hosting

```bash
# Build project
npm run build

# Deploy ke Firebase Hosting
firebase deploy --only hosting

# Tunggu sampai selesai (1-2 menit)
```

**Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/gen-lang-client-0226679970/overview
Hosting URL: https://gen-lang-client-0226679970.web.app
```

### Step 2: Test dari Firebase Hosting URL

1. Buka: `https://gen-lang-client-0226679970.web.app`
2. Navigate ke public job page
3. Submit aplikasi + upload CV
4. **HARUS BERHASIL!** ✅

**Kenapa berhasil?**
- Domain `.web.app` dan `.firebaseapp.com` sudah auto-whitelisted
- Tidak ada CORS issue

---

## 🔧 Solusi 2: Configure CORS via gcloud CLI

**Gunakan jika:**
- Mau deploy ke custom domain
- Perlu test dari bolt.host atau localhost

### Prerequisites

**Install Google Cloud SDK:**

**Windows:**
- Download: https://cloud.google.com/sdk/docs/install#windows
- Run installer
- Restart terminal

**Mac:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Step 1: Login & Set Project

```bash
# Login
gcloud auth login

# Set project
gcloud config set project gen-lang-client-0226679970

# Verify
gcloud config list
```

### Step 2: Apply CORS Configuration

File `cors.json` sudah dibuat di project root dengan config:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Range", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

**Apply CORS:**

```bash
# Navigate ke project directory
cd /path/to/project

# Apply CORS
gsutil cors set cors.json gs://gen-lang-client-0226679970.appspot.com
```

**Expected Output:**
```
Setting CORS on gs://gen-lang-client-0226679970.appspot.com/...
```

### Step 3: Verify CORS Config

```bash
# Check CORS configuration
gsutil cors get gs://gen-lang-client-0226679970.appspot.com
```

**Expected Output:**
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Range", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

### Step 4: Test Upload Again

- Refresh page di bolt.host
- Test upload CV
- **Harus berhasil!** ✅

---

## 🖱️ Solusi 3: Configure CORS via Google Cloud Console (UI)

**Gunakan jika:**
- Tidak mau install CLI
- Prefer GUI

### Step 1: Open Google Cloud Console

1. Go to: https://console.cloud.google.com
2. Login dengan Google account Anda
3. Select project: **gen-lang-client-0226679970**

### Step 2: Navigate to Cloud Storage

1. Click **☰** (hamburger menu) di kiri atas
2. Scroll ke **Storage** section
3. Click **Cloud Storage** → **Buckets**

### Step 3: Select Bucket

1. Cari bucket: **gen-lang-client-0226679970.appspot.com**
2. Click pada bucket name

### Step 4: Configure CORS

1. Tab **Configuration**
2. Scroll ke section **CORS configuration**
3. Click **Edit CORS configuration**
4. Paste JSON ini:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Range", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

5. Click **Save**
6. Wait 1-2 minutes for propagation

### Step 5: Test Upload

- Refresh page
- Test upload CV
- **Harus berhasil!** ✅

---

## 🔐 Solusi 4: Restricted CORS (Production-Ready)

**Untuk production**, jangan pakai `"origin": ["*"]`. Ganti dengan domain spesifik:

```json
[
  {
    "origin": [
      "https://gen-lang-client-0226679970.web.app",
      "https://gen-lang-client-0226679970.firebaseapp.com",
      "https://yourdomain.com",
      "http://localhost:5173"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Range", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

**Apply:**
```bash
gsutil cors set cors.json gs://gen-lang-client-0226679970.appspot.com
```

---

## 📊 Comparison: Mana yang Paling Cocok?

| Solusi | Kesulitan | Waktu | Use Case |
|--------|-----------|-------|----------|
| **1. Deploy ke Firebase Hosting** | ⭐ Easy | 5 min | **RECOMMENDED** - Testing & Production |
| **2. gcloud CLI** | ⭐⭐ Medium | 15 min | Development dengan custom domain |
| **3. Google Cloud Console** | ⭐⭐ Medium | 10 min | Prefer GUI, no CLI |
| **4. Restricted CORS** | ⭐⭐⭐ Advanced | 20 min | Production hardening |

---

## 🎯 REKOMENDASI: Gunakan Solusi #1

**Alasan:**
1. ✅ Paling cepat (5 menit)
2. ✅ Tidak perlu install tools tambahan
3. ✅ Auto-whitelist domain Firebase
4. ✅ Langsung production-ready
5. ✅ Test dari URL yang sebenarnya akan dipakai user

**Langkah:**
```bash
npm run build
firebase deploy --only hosting
```

**Test dari:**
```
https://gen-lang-client-0226679970.web.app/careers/{company-slug}/{job-slug}
```

---

## ✅ Verification Steps

Setelah apply CORS fix (any method):

### Test 1: Basic Upload
1. Buka public job page
2. Open Console (F12)
3. Isi form + upload PDF
4. Console harus show:
   ```
   [STORAGE] Starting file upload...
   [STORAGE] File uploaded to storage, getting download URL...
   [STORAGE] CV uploaded successfully!
   ```

### Test 2: Verify di Firebase Console
1. Firebase Console → Storage → Files
2. Navigate ke `cvs/` folder
3. Harus ada file yang baru di-upload

### Test 3: Download CV
1. Copy URL dari console log
2. Paste di browser
3. PDF harus bisa di-download

---

## 🚨 Troubleshooting

### Issue: "gsutil: command not found"

**Fix:**
```bash
# Install gcloud SDK
# https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version
gsutil --version
```

---

### Issue: "You do not have permission"

**Fix:**
```bash
# Make sure you're logged in with correct account
gcloud auth list

# Switch account if needed
gcloud config set account YOUR_EMAIL@gmail.com

# Re-login
gcloud auth login
```

---

### Issue: CORS still not working after apply

**Possible causes:**
1. Browser cache (hard refresh: Ctrl+Shift+R)
2. Propagation delay (wait 2-5 minutes)
3. Wrong bucket name

**Fix:**
```bash
# Verify CORS was applied
gsutil cors get gs://gen-lang-client-0226679970.appspot.com

# If empty, apply again
gsutil cors set cors.json gs://gen-lang-client-0226679970.appspot.com
```

---

### Issue: "Bucket not found"

**Verify bucket name:**
1. Firebase Console → Storage
2. Copy exact bucket name
3. Should be: `gen-lang-client-0226679970.appspot.com`

---

## 📝 Quick Commands Reference

```bash
# Login
gcloud auth login

# Set project
gcloud config set project gen-lang-client-0226679970

# Apply CORS (allow all origins)
gsutil cors set cors.json gs://gen-lang-client-0226679970.appspot.com

# Verify CORS
gsutil cors get gs://gen-lang-client-0226679970.appspot.com

# Deploy to Firebase Hosting (RECOMMENDED)
firebase deploy --only hosting
```

---

## 🎉 Expected Result

**After fix, console logs should show:**

```
[STORAGE] Starting file upload...
[STORAGE] File uploaded to storage, getting download URL...
[STORAGE] CV uploaded successfully!
[STORAGE] Download URL: https://firebasestorage.googleapis.com/...
[PUBLIC-JOB] ✅ CV uploaded successfully!
[PUBLIC-JOB] ===== STEP 2: CREATING APPLICATION =====
[PUBLIC-JOB] ✅ Application created with ID: abc123
[PUBLIC-JOB] ========== FORM SUBMIT SUCCESS ==========
```

**NO MORE CORS ERRORS!** ✅

---

## 📞 Need Help?

Jika masih ada issue setelah apply CORS:

1. **Screenshot Console logs** (full logs dari submit sampai error)
2. **Verify CORS applied:** Run `gsutil cors get gs://your-bucket`
3. **Share output** dari command di atas
4. **Firebase Hosting URL** (jika sudah deploy)

Dengan info ini saya bisa help troubleshoot lebih lanjut! 🚀
