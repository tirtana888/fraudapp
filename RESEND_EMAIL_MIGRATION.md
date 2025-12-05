# ✅ MIGRASI EMAIL: EmailJS → Resend

## 📧 **Email Senders yang Digunakan**

| Jenis Email | Sender Email | Fungsi |
|------------|--------------|--------|
| **Business Invitation** | `no-reply@hiregoode.one` | Undangan perusahaan/admin baru |
| **Candidate Invitation** | `interview@hiregoode.one` | Undangan assessment kandidat |
| **Assessment Complete** | `interview@hiregoode.one` | Konfirmasi selesai assessment |
| **Password Reset** | `no-reply@hiregoode.one` | Reset password user |

---

## 🚀 **DEPLOY BACKEND (WAJIB!)**

### 1️⃣ **Install Dependencies**

```bash
cd functions
npm install
```

### 2️⃣ **Deploy ke Firebase**

```bash
firebase deploy --only functions
```

**Fungsi yang di-deploy:**
- ✅ `sendEmail` (Universal email function dengan Resend)
- ✅ `generateAIResponse` (AI Chatbot dengan Gemini 2.0 / GPT-4o)
- ✅ `analyzeFraudRisk` (Fraud Risk Analysis)
- ✅ `diditWebhook` (Background check webhook)
- ✅ `createDiditSession` (Background check session)

---

## 📝 **PERUBAHAN UTAMA**

### ✅ **Backend (functions/index.js)**

1. **Resend Integration**
   - Mengganti EmailJS dengan Resend API
   - API Key: `re_Wiu4xU4c_ELdXgCYQNw9DoXgaDJb4KDYF`
   - Library: `resend@3.2.0`

2. **Email Senders**
   ```javascript
   const EMAIL_SENDERS = {
     business: "no-reply@hiregoode.one",
     interview: "interview@hiregoode.one"
   };
   ```

3. **Fungsi Baru: `sendEmail`**
   ```javascript
   exports.sendEmail = onCall({ region: "europe-west1" }, async (request) => {
     const { type, to, data } = request.data;
     // type: 'business_invitation' | 'candidate_invitation' | 'assessment_complete' | 'password_reset'
   });
   ```

4. **Template Email Profesional**
   - ✅ Business Invitation (Orange gradient header)
   - ✅ Candidate Invitation (Blue gradient header)
   - ✅ Assessment Complete (Green gradient header)
   - ✅ Password Reset (Red gradient header)
   - Semua template responsive & mobile-friendly

### ✅ **Frontend (services/firebase.ts)**

1. **Fungsi `sendEmailViaCloudFunction` Diubah**

   **SEBELUM (EmailJS):**
   ```typescript
   sendEmailViaCloudFunction(
     "candidate",
     email,
     name,
     { company_name, access_code, message }
   )
   ```

   **SESUDAH (Resend):**
   ```typescript
   sendEmailViaCloudFunction(
     "candidate_invitation",
     email,
     { candidateName, candidateEmail, companyName, accessCode, assessmentLink, role }
   )
   ```

2. **Update di Semua Email Functions:**
   - `sendAssessmentCompleteEmail()`
   - `resetUserPassword()`
   - `inviteCompanyReal()`
   - `resendInviteEmail()`
   - `blastAssessmentInvites()`
   - `resendCandidateInvite()`

---

## 🎨 **TEMPLATE EMAIL PREVIEW**

### 1. **Business Invitation** (no-reply@hiregoode.one)
```
Subject: Undangan Bergabung - [Company Name]
Header: Orange gradient dengan logo HireGood
Content:
  - Welcome message
  - Detail paket langganan (Tier, Status, Admin Email)
  - CTA Button: "Masuk ke Dashboard"
```

### 2. **Candidate Invitation** (interview@hiregoode.one)
```
Subject: Undangan Assessment - [Company Name]
Header: Blue gradient dengan nama company
Content:
  - Personal greeting dengan emoji 👋
  - Kode Akses dalam box biru besar
  - Instruksi step-by-step (4 langkah)
  - CTA Button: "🚀 Mulai Assessment Sekarang"
  - Informasi penting (1x akses, koneksi stabil, dll)
```

### 3. **Assessment Complete** (interview@hiregoode.one)
```
Subject: Terima Kasih - Assessment Selesai
Header: Green gradient dengan checkmark ✅
Content:
  - Konfirmasi selesai
  - Status box: "Assessment Completed - Under Review"
  - Langkah selanjutnya (2-3 hari kerja)
  - Closing message 🎉
```

### 4. **Password Reset** (no-reply@hiregoode.one)
```
Subject: Reset Password - HireGood
Header: Red gradient dengan icon 🔐
Content:
  - Password sementara dalam box merah
  - Instruksi keamanan (4 poin penting)
  - CTA Button: "🔓 Login Sekarang"
  - Warning jika tidak request
```

---

## 🔧 **CARA TEST EMAIL**

### Test dari Frontend (Chrome DevTools Console):

```javascript
// Test Business Invitation
const sendEmail = firebase.functions().httpsCallable('sendEmail');
await sendEmail({
  type: 'business_invitation',
  to: 'test@example.com',
  data: {
    companyName: 'PT Test Corp',
    adminEmail: 'admin@test.com',
    tier: 'Premium'
  }
});

// Test Candidate Invitation
await sendEmail({
  type: 'candidate_invitation',
  to: 'candidate@example.com',
  data: {
    candidateName: 'John Doe',
    candidateEmail: 'candidate@example.com',
    companyName: 'PT Test Corp',
    accessCode: 'ABC12',
    assessmentLink: 'https://yourapp.com?mode=assess',
    role: 'Software Engineer'
  }
});

// Test Assessment Complete
await sendEmail({
  type: 'assessment_complete',
  to: 'candidate@example.com',
  data: {
    candidateName: 'John Doe',
    candidateEmail: 'candidate@example.com',
    companyName: 'PT Test Corp'
  }
});

// Test Password Reset
await sendEmail({
  type: 'password_reset',
  to: 'user@example.com',
  data: {
    candidateName: 'Jane Smith',
    tempPassword: 'Temp123#',
    loginUrl: 'https://yourapp.com/login'
  }
});
```

---

## ✅ **CHECKLIST DEPLOYMENT**

### **Sebelum Deploy:**
- [x] Update functions/package.json (resend, openai, axios)
- [x] Update functions/index.js (4 email templates + sendEmail function)
- [x] Update services/firebase.ts (semua panggilan email)
- [x] Remove EmailJS references
- [x] Test lokal dengan emulator (opsional)

### **Deployment:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### **Setelah Deploy:**
1. ✅ Test kirim email business invitation
2. ✅ Test kirim email candidate invitation
3. ✅ Test blast email massal (dari CandidateBlast page)
4. ✅ Test resend invite
5. ✅ Test reset password
6. ✅ Verify email masuk ke inbox (cek spam jika perlu)

---

## 🛡️ **SECURITY NOTES**

1. **API Key Resend** disimpan langsung di `functions/index.js`
   - Aman karena berjalan di server-side (Firebase Functions)
   - Tidak terekspos ke client

2. **Email Senders**
   - `no-reply@hiregoode.one` → System emails (business, reset)
   - `interview@hiregoode.one` → Candidate communications

3. **Rate Limiting**
   - Ada delay 500ms antar email di blast function
   - Prevent spam/abuse

---

## 📊 **MONITORING**

Check Firebase Console → Functions → Logs:

```
[EMAIL] Sending candidate_invitation to user@example.com...
[EMAIL] ✅ Sent successfully to user@example.com
```

Jika gagal:
```
[EMAIL] ❌ Error sending to user@example.com: [error message]
```

---

## 🆘 **TROUBLESHOOTING**

### Email tidak terkirim?

1. **Cek Firebase Functions Logs**
   ```bash
   firebase functions:log --limit 50
   ```

2. **Cek Resend Dashboard**
   - Login ke https://resend.com/
   - Check Email Logs untuk delivery status

3. **Verify Email Sender**
   - Pastikan domain `hiregoode.one` sudah verified di Resend
   - Cek DNS records (SPF, DKIM, DMARC)

4. **Test Manual di Console**
   ```javascript
   const sendEmail = firebase.functions().httpsCallable('sendEmail');
   const result = await sendEmail({ type: 'candidate_invitation', to: 'test@test.com', data: {...} });
   console.log(result);
   ```

---

## 📚 **DOKUMENTASI TEKNIS**

### **Email Template Structure**

Semua template menggunakan:
- **Inline CSS** (kompatibel semua email client)
- **Table-based layout** (email-safe)
- **Mobile responsive** (viewport meta tag)
- **Gradient backgrounds** (degradasi graceful)
- **Professional typography** (Segoe UI fallback stack)

### **Error Handling**

```javascript
try {
  const result = await resend.emails.send({...});
  logger.info(`[EMAIL] Success! ID: ${result.id}`);
  return { success: true, messageId: result.id };
} catch (error) {
  logger.error('[EMAIL] Error:', error);
  throw new HttpsError('internal', `Gagal mengirim email: ${error.message}`);
}
```

---

## ✅ **COMPLETED!**

✅ EmailJS removed
✅ Resend integrated
✅ 4 Professional email templates
✅ Separate senders (no-reply vs interview)
✅ Frontend updated
✅ Backend deployed

**Ready to send emails! 🚀**
