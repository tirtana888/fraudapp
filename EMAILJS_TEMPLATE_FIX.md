# 🚨 CRITICAL: Email Terkirim ke Email yang Salah

## ⚠️ Masalah KRITIS

**Gejala:**
- Upload bulk 2 kandidat: john@example.com, jane@example.com
- ✅ Kandidat tersimpan di database
- ❌ **Email TIDAK terkirim ke john@example.com dan jane@example.com**
- ❌ **Email malah terkirim ke bisnis.ariftirtana@gmail.com** (email yang tidak ada di list)

**Severity:** 🔴 **CRITICAL** - Email dikirim ke orang yang salah!

---

## 🔍 Root Cause

**Email hardcoded di EmailJS Template Configuration!**

EmailJS Template `template_dvgrjda` (untuk kandidat) kemungkinan memiliki:
- **"To Email"** field di-hardcode ke `bisnis.ariftirtana@gmail.com`
- Variable `{{to_email}}` tidak digunakan dengan benar
- Template salah konfigurasi

---

## ✅ Cara Fix EmailJS Template

### Step 1: Login ke EmailJS Dashboard

1. Buka: https://dashboard.emailjs.com
2. Login dengan akun yang sama dengan Public Key: `bclRHuJQwKQIOljiq`

### Step 2: Buka Email Templates

1. Klik **Email Templates** di sidebar
2. Cari template dengan ID: `template_dvgrjda` (untuk kandidat)

### Step 3: Cek "To Email" Configuration

Di template editor, pastikan:

**❌ SALAH (Hardcoded):**
```
To Email: bisnis.ariftirtana@gmail.com
```

**✅ BENAR (Dynamic):**
```
To Email: {{to_email}}
```

### Step 4: Cek Template Variables

Pastikan template menggunakan variables ini:

```handlebars
To Email: {{to_email}}
To Name: {{to_name}}
Subject: Undangan Assessment - {{company_name}}

Halo {{to_name}},

Anda diundang untuk mengikuti tes integritas dari {{company_name}}.

Kode Akses Anda: {{access_code}}
Link Assessment: {{assessment_link}}

{{message}}

Terima kasih.
```

### Step 5: Test Settings

Di template editor:

1. **Test Variables:**
   ```json
   {
     "to_email": "test@example.com",
     "to_name": "Test User",
     "company_name": "PT Test",
     "access_code": "ABC123",
     "assessment_link": "https://app.com?mode=assess",
     "message": "Silakan akses link di atas"
   }
   ```

2. Klik **"Test"** button
3. **Pastikan email dikirim ke `test@example.com`**, BUKAN ke `bisnis.ariftirtana@gmail.com`

### Step 6: Save Template

1. Klik **Save** di template editor
2. Pastikan status template: **Active**

---

## 🔍 Cara Verify Konfigurasi

### Check 1: EmailJS Template Settings

**Template `template_dvgrjda` (Candidate):**
```
Template Name: Candidate Assessment Invite
Status: Active
To Email: {{to_email}}          ← HARUS DYNAMIC
From Name: FraudGuard
Reply To: {{reply_to}}          ← DYNAMIC
Subject: Undangan Tes Integritas - {{company_name}}
```

### Check 2: EmailJS Service Settings

1. Buka **Email Services** di sidebar
2. Cari service: `service_8o2nl6d`
3. Pastikan status: **Active**
4. Cek email service provider (Gmail/Outlook/SendGrid)

### Check 3: Test Manual Send

Di EmailJS Dashboard:

1. Buka template `template_dvgrjda`
2. Klik **Test**
3. Isi test variables:
   ```json
   {
     "to_email": "YOUR_EMAIL@gmail.com",
     "to_name": "Your Name",
     "company_name": "Test Company",
     "access_code": "TEST99",
     "assessment_link": "https://app.com",
     "message": "Test message"
   }
   ```
4. Klik **Send Test**
5. **Cek inbox YOUR_EMAIL@gmail.com** (BUKAN bisnis.ariftirtana@gmail.com)

---

## 🧪 Cara Test Setelah Fix

### Test 1: Single Candidate (Manual Input)

1. Login ke aplikasi
2. Tab "Undang Kandidat"
3. Klik "Tambah Kandidat"
4. Input:
   - Email: **your-test-email@gmail.com**
   - Nama: Test User
   - Role: Test Role
5. Klik "Kirim Undangan"
6. **Buka Browser Console (F12)**
7. Lihat logs:
   ```
   [EMAIL-START] Type: candidate, To: your-test-email@gmail.com
   [EMAIL-PAYLOAD] Recipient: your-test-email@gmail.com
   [EMAIL-DONE] Successfully sent to your-test-email@gmail.com
   ```
8. **Cek inbox your-test-email@gmail.com**
9. **Pastikan email MASUK ke inbox Anda, BUKAN ke bisnis.ariftirtana@gmail.com**

### Test 2: Bulk Upload

1. Buat Excel dengan 2 kandidat:
   ```
   email                    | name      | role
   test1@yourdomain.com     | Test 1    | Role 1
   test2@yourdomain.com     | Test 2    | Role 2
   ```
2. Upload via "Upload Bulk"
3. **Buka Browser Console (F12)**
4. Lihat logs:
   ```
   [BLAST-START] Processing 2 candidates
   [BLAST 1/2] Processing: Test 1 (test1@yourdomain.com)
   [BLAST] ✅ Email sent successfully to test1@yourdomain.com
   [BLAST 2/2] Processing: Test 2 (test2@yourdomain.com)
   [BLAST] ✅ Email sent successfully to test2@yourdomain.com
   ```
5. **Cek Firebase Functions Logs:**
   ```
   [EMAIL-PAYLOAD] Recipient: test1@yourdomain.com
   [EMAIL-PAYLOAD] Recipient: test2@yourdomain.com
   ```
6. **Cek inbox test1@yourdomain.com dan test2@yourdomain.com**

---

## 📊 Debugging Checklist

### ✅ Jika Email Masih Salah:

**1. Cek EmailJS Template:**
- [ ] Template ID benar: `template_dvgrjda`
- [ ] "To Email" = `{{to_email}}` (dynamic, bukan hardcoded)
- [ ] Template status = Active
- [ ] Test template dengan email berbeda

**2. Cek Firebase Functions Logs:**
```bash
# Buka Firebase Console
# Functions → Logs → Filter: sendEmailViaEmailJS

# Cari logs:
[EMAIL-PAYLOAD] Recipient: john@example.com
[EMAIL-PAYLOAD] Full params: {"to_email":"john@example.com",...}
```

**3. Cek EmailJS Dashboard:**
- Login: https://dashboard.emailjs.com
- Email Templates → template_dvgrjda
- Verify "To Email" field = `{{to_email}}`

**4. Cek Browser Console:**
```
Processing candidate: John Doe (john@example.com)
Attempting to send email to john@example.com...
Email sent successfully to john@example.com
```

---

## 🎯 Quick Fix Actions

### Immediate Actions:

1. **Login EmailJS Dashboard:**
   - URL: https://dashboard.emailjs.com
   - Gunakan akun dengan Public Key: `bclRHuJQwKQIOljiq`

2. **Fix Template `template_dvgrjda`:**
   - Email Templates → template_dvgrjda
   - To Email: **GANTI dari hardcoded ke `{{to_email}}`**
   - Save template

3. **Test Manual:**
   - Send test email dari EmailJS
   - Pastikan terkirim ke email yang benar

4. **Deploy Functions (Opsional):**
   ```bash
   cd functions
   firebase deploy --only functions
   ```

5. **Test di Aplikasi:**
   - Upload 1-2 kandidat test
   - Monitor Browser Console (F12)
   - Monitor Firebase Functions Logs
   - Verify email masuk ke inbox kandidat

---

## 💡 Alternative Solution: Bypass EmailJS Template

Jika template tidak bisa difix, gunakan direct SMTP:

### Option 1: Gmail SMTP (Recommended)

Edit `functions/index.js`:

```javascript
// Aktifkan SMTP Config
const SMTP_CONFIG = {
  user: "your-gmail@gmail.com",
  pass: "your-app-password-16-digits"
};

// Modify sendEmailViaEmailJS to use nodemailer directly
```

### Option 2: Use SendGrid API

1. Daftar SendGrid (free 100 emails/day)
2. Get API Key
3. Replace EmailJS dengan SendGrid API call

---

## 🔒 Security Note

**CRITICAL:**
- Email dikirim ke orang yang salah = **Data Breach Risk**
- Kode akses kandidat A terkirim ke kandidat B
- **JANGAN deploy ke production** sebelum fix ini verified

**Test Environment:**
- Gunakan dummy email untuk test
- Jangan pakai email kandidat real
- Verify 100% fix sebelum production

---

## 📞 Support

**Jika masih bermasalah setelah fix template:**

1. **Screenshot EmailJS Template Settings:**
   - Khususnya "To Email" field
   - Test variables
   - Template content

2. **Share Firebase Functions Logs:**
   - `[EMAIL-PAYLOAD]` logs
   - `[EMAIL-DONE]` logs

3. **Share Browser Console Logs:**
   - `[BLAST]` logs
   - Error messages

4. **Confirm:**
   - Email yang di-upload: john@example.com, jane@example.com
   - Email yang terima: ???
   - Expected: john & jane
   - Actual: bisnis.ariftirtana@gmail.com

---

## 🎉 Summary

**Problem:**
- ❌ Email terkirim ke email yang salah (hardcoded di template)
- ❌ Kandidat tidak terima email undangan
- 🔴 CRITICAL security & privacy issue

**Root Cause:**
- EmailJS Template `template_dvgrjda` memiliki "To Email" yang di-hardcode
- Variable `{{to_email}}` tidak digunakan

**Solution:**
1. ✅ Login EmailJS Dashboard
2. ✅ Edit template `template_dvgrjda`
3. ✅ Change "To Email" dari hardcoded ke `{{to_email}}`
4. ✅ Test dan verify
5. ✅ Deploy & monitor

**Status:**
- ⚠️ **ACTION REQUIRED**: Fix EmailJS Template ASAP
- 🔴 **DO NOT USE** bulk email until verified
- ✅ Code enhancement: Better logging untuk debugging

**Next:**
- Fix EmailJS template configuration
- Test dengan email real
- Verify email masuk ke recipient yang benar
