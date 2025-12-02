# Quick Start Guide - Production Deployment

## ⚡ 5 Menit Deploy ke Production

### Step 1: Install Firebase CLI (jika belum)
```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Deploy Functions & Hosting
```bash
./deploy.sh all
```

**ATAU manual:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```

### Step 3: Test Email
1. Buka aplikasi di browser
2. Login sebagai Company Admin
3. Undang Kandidat → Input email valid
4. Klik "Kirim Undangan"
5. ✅ Check email inbox

---

## 🔍 Troubleshooting

### ❌ Error: "Email gagal dikirim"

**Quick Fix:**
```bash
# Check if functions deployed
firebase functions:list

# View logs
firebase functions:log --only sendEmailViaEmailJS

# Redeploy
firebase deploy --only functions
```

### ❌ Error: "Permission denied"

**Quick Fix:**
1. Go to Firebase Console
2. Upgrade to Blaze Plan
3. Redeploy: `firebase deploy --only functions`

### ❌ Error: "EmailJS API Error"

**Quick Fix:**
1. Login: https://dashboard.emailjs.com
2. Check service status
3. Check template IDs in `functions/index.js`
4. Check monthly quota (200 emails/month free)

---

## 📊 Monitor

### Real-time Logs:
```bash
firebase functions:log
```

### Firebase Console:
https://console.firebase.google.com/project/gen-lang-client-0226679970/functions

### EmailJS Dashboard:
https://dashboard.emailjs.com/admin

---

## 🆘 Emergency Support

**Functions not working?**
```bash
# Full redeploy
firebase deploy --only functions --force
```

**Email not sending?**
1. Check EmailJS quota
2. Check template IDs
3. Check service status
4. View function logs

**Need rollback?**
```bash
firebase functions:delete sendEmailViaEmailJS
git checkout <previous-commit>
firebase deploy --only functions
```

---

## ✅ Production Checklist

Before going live:
- [ ] Run `./deploy.sh all`
- [ ] Test email dengan real email address
- [ ] Check Firebase Functions logs
- [ ] Monitor EmailJS quota
- [ ] Setup billing alerts

---

## 💰 Cost

- Firebase Functions: **$0-5/month**
- EmailJS: **$0-10/month**
- Total: **~$5-15/month**

---

## 📚 Full Documentation

For detailed docs, see:
- `PRODUCTION_DEPLOYMENT.md` - Full deployment guide
- `FIREBASE_FUNCTIONS_DEPLOYMENT.md` - Functions setup
- `BACKEND_GUIDE.md` - Backend architecture
