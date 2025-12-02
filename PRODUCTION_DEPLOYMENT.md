# Production Deployment Guide - FraudGuard SaaS

## 🚨 WAJIB DIBACA - Deployment Production

Aplikasi ini memerlukan Firebase Functions untuk mengirim email. Berikut step-by-step deployment untuk production.

---

## Prerequisites

1. **Node.js 18+** installed
2. **Firebase Project** sudah dibuat
3. **Firebase Blaze Plan** (required untuk Cloud Functions)
4. **EmailJS Account** (untuk email service)

---

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase --version
```

---

## Step 2: Login ke Firebase

```bash
firebase login
```

Browser akan terbuka, login dengan akun Google yang punya akses ke project Firebase.

---

## Step 3: Initialize Firebase Project

Di folder project Anda:

```bash
firebase use gen-lang-client-0226679970
```

Verify:
```bash
firebase projects:list
```

---

## Step 4: Install Dependencies untuk Functions

```bash
cd functions
npm install
cd ..
```

---

## Step 5: Configure EmailJS Settings

File `functions/index.js` sudah berisi konfigurasi EmailJS:

```javascript
const EMAILJS_CONFIG = {
  publicKey: "bclRHuJQwKQIOljiq",
  serviceId: "service_8o2nl6d",
  templateBusiness: "template_gfg2qr4",
  templateCandidate: "template_dvgrjda"
};
```

**PENTING**: Pastikan:
- ✅ EmailJS account aktif
- ✅ Service ID valid
- ✅ Template ID valid
- ✅ Public Key benar

Test di EmailJS Dashboard: https://dashboard.emailjs.com

---

## Step 6: Deploy Firebase Functions

```bash
firebase deploy --only functions
```

**Expected Output:**
```
✔ functions: Finished running predeploy script.
i functions: preparing codebase default for deployment
i functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔ functions: required API cloudfunctions.googleapis.com is enabled
✔ functions: required API cloudbuild.googleapis.com is enabled
i functions: uploading codebase...
✔ functions: Uploaded function code to Cloud Storage
i functions: creating Node.js 18 function sendEmailViaEmailJS(europe-west1)...
✔ functions[sendEmailViaEmailJS(europe-west1)] Successful create operation.

✔ Deploy complete!
```

---

## Step 7: Verify Deployment

### Check Deployed Functions:
```bash
firebase functions:list
```

**Expected:**
```
┌─────────────────────────┬────────────────┬────────────────┐
│ Function Name           │ Region         │ Status         │
├─────────────────────────┼────────────────┼────────────────┤
│ sendEmailViaEmailJS     │ europe-west1   │ ACTIVE         │
│ generateAIResponse      │ europe-west1   │ ACTIVE         │
│ analyzeFraudRisk        │ europe-west1   │ ACTIVE         │
│ inviteCompany           │ europe-west1   │ ACTIVE         │
└─────────────────────────┴────────────────┴────────────────┘
```

### View Function Logs:
```bash
firebase functions:log --only sendEmailViaEmailJS
```

---

## Step 8: Test Email Function

Buka Browser Console di aplikasi dan test:

```javascript
// Test manual
const { getFunctions, httpsCallable } = require('firebase/functions');

const functions = getFunctions(app, "europe-west1");
const sendEmail = httpsCallable(functions, "sendEmailViaEmailJS");

const result = await sendEmail({
  type: "candidate",
  to_email: "your-email@gmail.com",
  to_name: "Test User",
  data: {
    company_name: "Test Company",
    access_code: "ABC123",
    assessment_link: window.location.origin + "?mode=assess",
    message: "This is a test email"
  }
});

console.log(result);
```

---

## Step 9: Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

---

## Step 10: Verify Production

1. Buka aplikasi di browser
2. Login sebagai Company Admin
3. Go to "Undang Kandidat"
4. Add kandidat dengan email valid
5. Klik "Kirim Undangan"
6. ✅ Check email inbox kandidat

---

## Troubleshooting

### Error: "functions is not initialized"

**Cause**: Functions belum di-deploy atau region salah

**Solution**:
```bash
# Redeploy functions
firebase deploy --only functions

# Check region di firebase.ts (line 67)
functions = getFunctions(app, "europe-west1");
```

---

### Error: "EmailJS API Error"

**Cause**: EmailJS config salah atau quota habis

**Solution**:
1. Login ke https://dashboard.emailjs.com
2. Check service status
3. Check template IDs
4. Check monthly quota (200 emails/month di free tier)
5. Upgrade jika perlu

---

### Error: "Permission denied"

**Cause**: Billing account belum aktif

**Solution**:
1. Go to Firebase Console
2. Upgrade to Blaze Plan
3. Add billing account

---

### Error: "CORS error"

**Cause**: Frontend belum di-deploy atau URL salah

**Solution**:
```bash
firebase deploy --only hosting
```

---

## Monitoring & Logs

### Real-time Logs:
```bash
firebase functions:log --only sendEmailViaEmailJS
```

### Firebase Console:
https://console.firebase.google.com/project/gen-lang-client-0226679970/functions/logs

### EmailJS Dashboard:
https://dashboard.emailjs.com/admin

---

## Production Checklist

Before going live:

- [ ] Firebase Functions deployed
- [ ] EmailJS configured and tested
- [ ] Blaze Plan activated
- [ ] Frontend deployed to Firebase Hosting
- [ ] Test email sending dengan real email
- [ ] Test bulk upload kandidat
- [ ] Test candidate login dengan access code
- [ ] Check Firebase Functions logs
- [ ] Monitor EmailJS quota
- [ ] Setup billing alerts

---

## Cost Estimation

### Firebase Functions (Blaze Plan):
- **First 2M invocations/month**: FREE
- **After 2M**: $0.40 per 1M invocations
- **Typical usage**: 100-1000 invocations/day = ~$0-5/month

### EmailJS:
- **Free tier**: 200 emails/month
- **Basic Plan**: $10/month (1,000 emails)
- **Pro Plan**: $30/month (5,000 emails)

### Firebase Hosting:
- **10GB storage**: FREE
- **360MB/day transfer**: FREE
- **Typical usage**: $0/month

**Total estimated cost**: $0-15/month (depending on email volume)

---

## Emergency Rollback

If functions fail:

```bash
# Rollback to previous version
firebase functions:delete sendEmailViaEmailJS

# Redeploy old version
git checkout <previous-commit>
firebase deploy --only functions
```

---

## Support

- Firebase Console: https://console.firebase.google.com
- EmailJS Dashboard: https://dashboard.emailjs.com
- Firebase Functions Docs: https://firebase.google.com/docs/functions

---

## Next Steps After Deployment

1. ✅ Test end-to-end flow
2. ✅ Monitor logs for 24 hours
3. ✅ Setup email alerts for errors
4. ✅ Document any issues
5. ✅ Train admin team on troubleshooting
