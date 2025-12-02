# Firebase Functions Deployment Guide

## Status Saat Ini
✅ **Database**: Firestore sudah berfungsi
⚠️ **Email**: Firebase Functions belum di-deploy (email di-skip untuk development)

## Apa yang Terjadi Sekarang?
Saat Anda mengundang kandidat:
1. ✅ Data kandidat **TERSIMPAN** ke Firestore
2. ✅ Kode akses **DIGENERATE** otomatis
3. ⚠️ Email **TIDAK TERKIRIM** (karena Cloud Functions belum di-deploy)
4. ✅ Kandidat bisa **LOGIN** menggunakan kode akses yang ada di tabel

## Cara Deploy Firebase Functions (Opsional)

### Prerequisites
1. **Firebase CLI** terinstall
2. **Firebase Project** sudah dibuat
3. **Billing Account** (Blaze Plan) aktif

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Initialize Functions
```bash
cd /path/to/project
firebase init functions
```

Pilih:
- Use existing project: **gen-lang-client-0226679970**
- Language: **JavaScript**
- Install dependencies: **Yes**

### Step 3: Deploy Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Step 4: Set EmailJS Config (Jika Menggunakan EmailJS)
```bash
firebase functions:config:set emailjs.publickey="bclRHuJQwKQIOljiq"
firebase functions:config:set emailjs.serviceid="service_8o2nl6d"
firebase functions:config:set emailjs.templatebusiness="template_gfg2qr4"
firebase functions:config:set emailjs.templatecandidate="template_dvgrjda"
```

### Step 5: Redeploy After Config
```bash
firebase deploy --only functions
```

## Testing Email Function

Setelah deploy, buka browser console dan test:
```javascript
const functions = getFunctions(app, "europe-west1");
const sendEmail = httpsCallable(functions, "sendEmailViaEmailJS");

await sendEmail({
  type: "candidate",
  to_email: "test@example.com",
  to_name: "Test User",
  data: {
    company_name: "Test Company",
    access_code: "ABC123",
    assessment_link: "https://your-app.com?mode=assess",
    message: "Test message"
  }
});
```

## Alternative: Skip Email Deployment

Jika Anda tidak ingin deploy Firebase Functions, aplikasi tetap berfungsi:
- Data kandidat tersimpan
- Kode akses bisa dilihat di tabel "Status Undangan Terkirim"
- Anda bisa **manual share** kode akses via WhatsApp/Email

## Development Mode (Current Setup)

Saat ini aplikasi berjalan dalam **Development Mode**:
- Email function di-skip (return true)
- Data kandidat tetap tersimpan ke Firestore
- Kode akses bisa dilihat di dashboard
- Kandidat bisa login dengan kode akses

## Production Mode (After Deployment)

Setelah deploy Firebase Functions:
- Email otomatis terkirim ke kandidat
- Kandidat menerima kode akses via email
- Fully automated workflow

---

## Troubleshooting

### Error: "Firebase Functions not initialized"
**Solusi**: Deploy Firebase Functions atau gunakan development mode

### Error: "Email sending failed"
**Solusi**: Check EmailJS configuration atau SMTP settings

### Error: "Billing account required"
**Solusi**: Upgrade ke Firebase Blaze Plan

---

## Quick Commands

```bash
# Check deployed functions
firebase functions:list

# View function logs
firebase functions:log

# Delete a function
firebase functions:delete sendEmailViaEmailJS

# Test locally
firebase emulators:start --only functions
```

---

## Support

Untuk bantuan lebih lanjut:
1. Cek Firebase Console: https://console.firebase.google.com
2. Cek Functions Logs: https://console.firebase.google.com/project/gen-lang-client-0226679970/functions/logs
3. Review EmailJS Dashboard: https://dashboard.emailjs.com
