# 🚨 DEPLOY SEKARANG - FIX EMAIL ERROR

Error yang Anda alami: **"Gagal mengirim undangan"** terjadi karena **Firebase Functions belum di-deploy**.

---

## ✅ SOLUSI CEPAT (5 Menit)

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

Verify:
```bash
firebase --version
```

### Step 2: Login ke Firebase
```bash
firebase login
```

Browser akan terbuka → Login dengan Google account yang punya akses ke project Firebase.

### Step 3: Navigate ke Project Folder
```bash
cd /path/to/fraudguard-saas
```

### Step 4: Verify Project
```bash
firebase use gen-lang-client-0226679970
```

Expected output:
```
Now using project gen-lang-client-0226679970
```

### Step 5: Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

### Step 6: Deploy Functions
```bash
firebase deploy --only functions
```

**Expected Output:**
```
✔ functions: Finished running predeploy script.
i functions: preparing codebase default for deployment
✔ functions: uploading codebase...
i functions: creating Node.js 18 function sendEmailViaEmailJS(europe-west1)...
✔ functions[sendEmailViaEmailJS(europe-west1)] Successful create operation.

✔ Deploy complete!
```

### Step 7: Verify Deployment
```bash
firebase functions:list
```

Expected:
```
┌─────────────────────────┬────────────────┬────────────────┐
│ Function Name           │ Region         │ Status         │
├─────────────────────────┼────────────────┼────────────────┤
│ sendEmailViaEmailJS     │ europe-west1   │ ACTIVE         │
└─────────────────────────┴────────────────┴────────────────┘
```

### Step 8: Test Email
1. Refresh aplikasi di browser
2. Login as Company Admin
3. Undang Kandidat → Input kandidat
4. Klik "Kirim Undangan"
5. ✅ Email should send successfully!

---

## 🐛 Jika Masih Error

### Check Function Logs:
```bash
firebase functions:log --only sendEmailViaEmailJS
```

### Check Browser Console:
1. Tekan F12
2. Tab "Console"
3. Screenshot error message
4. Share dengan saya

### Verify EmailJS:
1. Login: https://dashboard.emailjs.com
2. Check service status
3. Check template IDs:
   - Service: `service_8o2nl6d`
   - Template Business: `template_gfg2qr4`
   - Template Candidate: `template_dvgrjda`
   - Public Key: `bclRHuJQwKQIOljiq`

---

## 💡 Quick Troubleshooting

### Error: "Permission denied"
**Solution**:
```bash
# Upgrade to Blaze Plan
# Go to: https://console.firebase.google.com/project/gen-lang-client-0226679970/usage
# Click "Upgrade to Blaze Plan"
```

### Error: "Command not found: firebase"
**Solution**:
```bash
npm install -g firebase-tools
```

### Error: "Not logged in"
**Solution**:
```bash
firebase login
```

### Error: "Project not found"
**Solution**:
```bash
firebase use gen-lang-client-0226679970
```

---

## 📞 Need Help?

Share this info dengan saya:

1. **Firebase CLI Version:**
   ```bash
   firebase --version
   ```

2. **Deployment Output:**
   ```bash
   firebase deploy --only functions 2>&1 | tee deploy.log
   ```

3. **Browser Console Error:**
   - F12 → Console tab → Screenshot

4. **Function Logs:**
   ```bash
   firebase functions:log --only sendEmailViaEmailJS
   ```

---

## ✅ After Successful Deploy

You should see:
- ✅ Email sent successfully
- ✅ Kandidat receives email with access code
- ✅ No more "Gagal mengirim undangan" error

---

**Deploy sekarang dan test!** 🚀
