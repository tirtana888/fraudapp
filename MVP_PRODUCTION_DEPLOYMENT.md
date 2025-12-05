# 🚀 HireGood MVP - Production Deployment Guide

## ✅ Keamanan API Keys

Semua API keys telah diamankan menggunakan **Firebase Secrets Manager**. Tidak ada API keys yang hardcoded di kode!

### 🔐 API Keys yang Diamankan:
- ✅ **RESEND_API_KEY** - Email service
- ✅ **GEMINI_API_KEY** - Primary AI engine
- ✅ **OPENAI_API_KEY** - Fallback AI engine
- ✅ **DIDIT_API_KEY** - Background check service
- ✅ **DIDIT_WEBHOOK_SECRET** - Webhook verification

---

## 📋 Persiapan Sebelum Deploy

### 1. Dapatkan API Keys

Anda perlu mendapatkan API keys berikut:

#### A. Resend (Email Service) - WAJIB
1. Daftar di: https://resend.com
2. Verifikasi domain: `hiregood.one`
3. Dapatkan API key dari: https://resend.com/api-keys
4. Format: `re_xxxxxxxxxxxxxxxxxxxx`

#### B. Gemini (Primary AI) - WAJIB
1. Buka: https://aistudio.google.com/apikey
2. Login dengan Google Account
3. Klik "Create API Key"
4. Format: `AIzaSy...`

#### C. OpenAI (Fallback AI) - OPSIONAL
1. Buka: https://platform.openai.com/api-keys
2. Login/Register
3. Klik "Create new secret key"
4. Format: `sk-proj-...`
5. **Catatan**: Ini berbayar, tapi berguna sebagai fallback jika Gemini down

#### D. Didit (Background Check) - WAJIB
1. Login ke Didit Dashboard
2. Navigate ke Settings → API Keys
3. Copy:
   - **API Key**
   - **Webhook Secret**

---

## 🛠️ Langkah Deployment

### Step 1: Install Dependencies

```bash
# Install project dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..
```

### Step 2: Setup Firebase Secrets

Gunakan script otomatis yang sudah disiapkan:

```bash
chmod +x setup-secrets.sh
./setup-secrets.sh
```

Script ini akan:
1. Meminta semua API keys yang diperlukan
2. Memvalidasi formatnya
3. Menyimpan ke Firebase Secrets secara aman
4. Konfirmasi setelah selesai

**Atau manual:**

```bash
# Set Resend API Key
firebase functions:secrets:set RESEND_API_KEY
# Paste your Resend key when prompted

# Set Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY
# Paste your Gemini key when prompted

# Set OpenAI API Key (optional)
firebase functions:secrets:set OPENAI_API_KEY
# Paste your OpenAI key when prompted

# Set Didit API Key
firebase functions:secrets:set DIDIT_API_KEY
# Paste your Didit key when prompted

# Set Didit Webhook Secret
firebase functions:secrets:set DIDIT_WEBHOOK_SECRET
# Paste your Didit webhook secret when prompted
```

### Step 3: Verifikasi Secrets

```bash
# List all secrets
firebase functions:secrets:list

# Should show:
# ✅ RESEND_API_KEY
# ✅ GEMINI_API_KEY
# ✅ OPENAI_API_KEY (if set)
# ✅ DIDIT_API_KEY
# ✅ DIDIT_WEBHOOK_SECRET
```

### Step 4: Deploy Firebase Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Atau deploy function tertentu:
# firebase deploy --only functions:sendEmail
# firebase deploy --only functions:generateAIResponse
```

### Step 5: Build Frontend

```bash
# Build production bundle
npm run build

# Output akan ada di folder dist/
```

### Step 6: Deploy Frontend

#### Option A: Firebase Hosting

```bash
firebase deploy --only hosting
```

#### Option B: Netlify/Vercel

```bash
# Upload folder dist/ ke Netlify atau Vercel
# Atau gunakan CLI mereka
```

### Step 7: Update Firestore Rules

Pastikan Firestore rules sudah di-deploy:

```bash
firebase deploy --only firestore:rules
```

### Step 8: Update Storage Rules

```bash
firebase deploy --only storage
```

---

## 🔍 Verifikasi Deployment

### 1. Test Email Service

```bash
# Dari Firebase Console → Functions → Logs
# Cari log: [EMAIL] Success!
```

### 2. Test AI Functions

```bash
# Coba chat interview di aplikasi
# Cek Firebase Functions logs untuk:
# [GENAI] ✅ AI Response generated successfully
```

### 3. Test Background Check Integration

```bash
# Start background check dari aplikasi
# Cek Didit webhook receiving data
```

---

## 🚨 Troubleshooting

### Error: "Secret not found"

```bash
# Check secrets
firebase functions:secrets:list

# If missing, set it:
firebase functions:secrets:set RESEND_API_KEY
```

### Error: "Invalid API key"

```bash
# Delete and recreate secret
firebase functions:secrets:destroy RESEND_API_KEY
firebase functions:secrets:set RESEND_API_KEY
```

### Error: "Permission denied"

```bash
# Make sure you're logged in
firebase login

# Make sure you're on correct project
firebase use --list
firebase use <project-id>
```

### Email tidak terkirim

1. Cek Resend dashboard untuk error logs
2. Pastikan domain `hiregood.one` sudah diverifikasi
3. Cek Firebase Functions logs:
   ```bash
   firebase functions:log
   ```

### AI tidak merespon

1. Cek Gemini API quota: https://aistudio.google.com/apikey
2. Cek Firebase Functions logs untuk error
3. Pastikan OpenAI key valid (jika menggunakan fallback)

---

## 📊 Monitoring Production

### Firebase Console Monitoring

1. **Functions Logs**
   ```
   Firebase Console → Functions → Logs
   ```

2. **Firestore Usage**
   ```
   Firebase Console → Firestore → Usage
   ```

3. **Storage Usage**
   ```
   Firebase Console → Storage → Usage
   ```

### Performance Monitoring

```bash
# View function performance
firebase functions:log --only generateAIResponse

# View email sending stats
firebase functions:log --only sendEmail
```

---

## 🔒 Security Checklist

- [x] ✅ No hardcoded API keys in code
- [x] ✅ All secrets stored in Firebase Secrets Manager
- [x] ✅ .gitignore configured properly
- [x] ✅ dist/ folder excluded from git
- [x] ✅ Firebase Security Rules enabled
- [x] ✅ CORS configured correctly
- [x] ✅ Webhook signature verification enabled

---

## 🌐 Production URLs

Setelah deploy, aplikasi akan available di:

- **Frontend**: `https://app.hiregood.one`
- **Backend**: `https://europe-west1-<project-id>.cloudfunctions.net`
- **Email Sender**: `no-reply@hiregood.one`
- **Interview Email**: `interview@hiregood.one`

---

## 🆘 Emergency Procedures

### Rotate API Keys

Jika API key bocor:

```bash
# 1. Generate new key dari provider
# 2. Update secret
firebase functions:secrets:set RESEND_API_KEY
# Paste new key

# 3. Deploy ulang
firebase deploy --only functions

# 4. Revoke old key dari provider dashboard
```

### Rollback Deployment

```bash
# Rollback ke versi sebelumnya
firebase functions:rollback <function-name>
```

### Scale Down in Emergency

```bash
# Stop receiving traffic temporarily
# Via Firebase Console → Functions → (select function) → Stop
```

---

## 📈 Post-Launch Optimization

### 1. Monitor Costs

- Firebase: https://console.firebase.google.com/project/_/usage
- Gemini: https://aistudio.google.com/apikey
- OpenAI: https://platform.openai.com/usage
- Resend: https://resend.com/usage

### 2. Performance Optimization

- Monitor function cold starts
- Optimize bundle size (use dynamic imports)
- Enable Firebase Performance Monitoring

### 3. Security Audit

- Review Firestore rules monthly
- Rotate API keys quarterly
- Monitor suspicious activity

---

## 📝 Deployment Checklist

**Before Deploy:**
- [ ] All API keys obtained
- [ ] Secrets configured in Firebase
- [ ] Code tested locally
- [ ] Build passes without errors
- [ ] .gitignore updated

**During Deploy:**
- [ ] Functions deployed successfully
- [ ] Frontend deployed successfully
- [ ] Database rules deployed
- [ ] Storage rules deployed

**After Deploy:**
- [ ] Test email sending
- [ ] Test AI chat
- [ ] Test background check
- [ ] Test candidate flow
- [ ] Test admin dashboard
- [ ] Monitor logs for errors

---

## 🎉 You're Live!

Aplikasi Anda sekarang sudah production-ready dengan keamanan tingkat enterprise!

**Next Steps:**
1. Share URL dengan beta testers
2. Monitor Firebase logs intensively
3. Collect feedback
4. Iterate based on usage data

**Support:**
- Firebase Issues: https://firebase.google.com/support
- Resend Issues: https://resend.com/docs
- Gemini Issues: https://ai.google.dev/gemini-api/docs

---

## 💡 Best Practices

1. **Never commit secrets to git**
2. **Always use environment variables or secrets manager**
3. **Rotate API keys regularly (every 3-6 months)**
4. **Monitor API usage and costs daily**
5. **Keep Firebase SDK and dependencies updated**
6. **Enable 2FA on all service accounts**
7. **Backup Firestore data regularly**

---

**Last Updated**: 2025-12-05

**Version**: MVP 1.0

**Deployment Status**: ✅ Production Ready
