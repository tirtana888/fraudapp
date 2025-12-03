# 🔧 Troubleshooting AI Chatbot (Already Deployed)

## ✅ Perbaikan Code yang Sudah Dilakukan

### 1. **Fungsi `generateNextQuestion()` Sudah Diperbaiki**
File `services/genai.ts` sudah diupdate untuk memanggil Firebase Cloud Function dengan benar:

```typescript
// ✅ SEKARANG (BENAR)
export const generateNextQuestion = async (...) => {
  // Memanggil Firebase Cloud Function: generateAIResponse
  const generateResponse = httpsCallable(functions, "generateAIResponse");
  const result = await generateResponse({ role, history, lastUserMessage });
  // ...
}
```

### 2. **Build Sudah Berhasil**
```bash
npm run build
# ✓ built in 12.49s
```

---

## 🧪 Cara Test AI Chatbot

### Option 1: Gunakan Test Page HTML
1. Buka file: `test-ai-chatbot.html` di browser
2. Klik tombol **"Test Generate AI"**
3. Lihat response dari Firebase Functions
4. Cek console logs untuk detail error (jika ada)

### Option 2: Test di Aplikasi Langsung
1. Buka aplikasi FraudGuard
2. Login dengan access code
3. Isi profil dan survey
4. Mulai chat interview
5. Kirim pesan ke AI
6. **Cek Browser Console** untuk error messages

---

## 🔍 Diagnosa Masalah

### Kemungkinan 1: API Keys Belum Di-Set
**Gejala:**
- Chatbot selalu return response yang sama (fallback)
- Di Firebase Console Logs muncul error: "API keys belum dikonfigurasi"

**Solusi:**
```bash
# Set Gemini API Key
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"

# Set OpenAI API Key (untuk fallback)
firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"

# Verify
firebase functions:config:get

# Re-deploy setelah set config
firebase deploy --only functions
```

**Cara Cek:**
1. Login ke Firebase Console: https://console.firebase.google.com
2. Pilih project: **gen-lang-client-0226679970**
3. Klik **Functions** → **Configuration**
4. Lihat apakah `gemini.key` dan `openai.key` ada

---

### Kemungkinan 2: API Keys Tidak Valid / Expired
**Gejala:**
- Firebase Functions berjalan tapi return error
- Logs: "Gemini API Error" atau "OpenAI API Error"

**Solusi:**

#### Untuk Gemini API:
1. Buka [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Generate API key baru
3. Copy API key
4. Set di Firebase:
   ```bash
   firebase functions:config:set gemini.key="AIzaSy..."
   firebase deploy --only functions
   ```

#### Untuk OpenAI API:
1. Buka [OpenAI Platform](https://platform.openai.com/api-keys)
2. Generate API key baru
3. Copy API key
4. Set di Firebase:
   ```bash
   firebase functions:config:set openai.key="sk-proj-..."
   firebase deploy --only functions
   ```

**Test API Key Manual:**

**Gemini:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=YOUR_GEMINI_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
```

**OpenAI:**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENAI_KEY" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Say hello"}]}'
```

---

### Kemungkinan 3: Quota API Habis
**Gejala:**
- Error: "Resource exhausted" atau "Quota exceeded"
- Chatbot kadang jalan, kadang tidak

**Solusi:**

**Cek Gemini Quota:**
1. Buka [Google AI Studio](https://makersuite.google.com)
2. Lihat usage/quota
3. Jika habis, tunggu reset atau upgrade plan

**Cek OpenAI Quota:**
1. Buka [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Lihat remaining balance
3. Jika habis, top-up credit

---

### Kemungkinan 4: Region Mismatch
**Gejala:**
- Error: "Function not found"
- Timeout saat call function

**Solusi:**
Pastikan region sama di semua tempat:

**Frontend (`services/genai.ts`):**
```typescript
functions = getFunctions(app, "europe-west1"); // ✅
```

**Backend (`functions/index.js`):**
```javascript
exports.generateAIResponse = onCall({ region: "europe-west1" }, ...); // ✅
```

**Firebase Deploy:**
```bash
firebase functions:list
# Harus muncul: europe-west1-generateAIResponse
```

---

### Kemungkinan 5: Functions Belum Ter-Deploy
**Gejala:**
- Error: "Function not found" atau "ECONNREFUSED"
- Firebase Console tidak menampilkan functions

**Cara Cek:**
```bash
# List deployed functions
firebase functions:list

# Expected output:
# ✔ europe-west1-generateAIResponse
# ✔ europe-west1-analyzeFraudRisk
# ✔ europe-west1-sendEmailViaEmailJS
```

**Jika Kosong, Deploy Ulang:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

### Kemungkinan 6: Dependencies Belum Terinstall
**Gejala:**
- Deploy gagal atau error saat runtime
- Logs: "Module not found"

**Solusi:**
```bash
cd functions
npm install @google/generative-ai@^0.21.0
npm install firebase-admin@^12.0.0
npm install firebase-functions@^5.0.0
npm install nodemailer@^6.9.9
npm install cors@^2.8.5
npm install node-fetch@^2.7.0
cd ..
firebase deploy --only functions
```

---

### Kemungkinan 7: Safety Settings Gemini Terlalu Ketat
**Gejala:**
- Gemini block response karena konten dianggap sensitive
- Logs: "Response blocked by safety settings"

**Solusi:**
Safety settings sudah di-set ke `BLOCK_NONE` di `functions/index.js`. Jika masih terjadi, sistem otomatis fallback ke OpenAI.

---

## 📊 Cara Cek Firebase Logs

### Via Web Console:
1. Buka https://console.firebase.google.com
2. Pilih project: **gen-lang-client-0226679970**
3. Klik **Functions** → **Logs**
4. Filter by function: `generateAIResponse`
5. Cari error messages

### Via CLI:
```bash
# View real-time logs
firebase functions:log --only generateAIResponse

# View last 50 lines
firebase functions:log --only generateAIResponse --lines 50
```

### Logs yang Baik (Success):
```
[AI] Trying Gemini for role: Manajer Keuangan
[AI] Gemini response generated successfully
```

### Logs Jika Gemini Gagal (Fallback to OpenAI):
```
[WARN] Gemini failed, trying OpenAI fallback: API_KEY_INVALID
[AI] Trying OpenAI fallback
[AI] OpenAI response generated successfully
```

### Logs Jika Semua Gagal:
```
[ERROR] OpenAI also failed: Quota exceeded
[AI] All AI providers failed, using static fallback
```

---

## 🎯 Checklist Debugging

Ikuti checklist ini untuk troubleshoot:

- [ ] **Buka test page** (`test-ai-chatbot.html`) dan test function
- [ ] **Cek Browser Console** untuk error messages
- [ ] **Cek Firebase Console Logs** untuk server-side errors
- [ ] **Verify API Keys** sudah di-set di Firebase Config
- [ ] **Test API Keys** manual dengan curl
- [ ] **Cek Quota** di Google AI Studio & OpenAI Dashboard
- [ ] **Verify Region** sama di frontend & backend
- [ ] **Verify Functions** sudah ter-deploy dengan `firebase functions:list`
- [ ] **Cek Dependencies** di `functions/package.json`
- [ ] **Re-deploy** jika perlu: `firebase deploy --only functions`

---

## 🚀 Quick Fix Commands

```bash
# 1. Verify functions deployed
firebase functions:list

# 2. Check configuration
firebase functions:config:get

# 3. View logs
firebase functions:log --only generateAIResponse

# 4. Re-deploy if needed
firebase deploy --only functions

# 5. Test with curl (replace YOUR_PROJECT_ID)
curl -X POST \
  https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/generateAIResponse \
  -H "Content-Type: application/json" \
  -d '{"data":{"role":"Test","history":[],"lastUserMessage":"Hello"}}'
```

---

## 📞 Jika Masih Bermasalah

1. **Kirim screenshot error** dari:
   - Browser Console (F12)
   - Firebase Console Logs
   - Test page results

2. **Info yang perlu diberikan:**
   - Apakah API keys sudah di-set?
   - Apakah Gemini/OpenAI dashboard menunjukkan usage?
   - Error message lengkap dari logs

3. **Check Firebase Billing:**
   - Pastikan project sudah upgrade ke **Blaze Plan**
   - Cloud Functions butuh billing enabled

---

## 💡 Tips

### Cara Irit Quota:
- Set Gemini sebagai primary (lebih murah/gratis)
- OpenAI hanya fallback
- Limit chat turns (max 10-15 pertanyaan)
- Cache common responses

### Monitoring:
```bash
# Watch logs real-time
firebase functions:log --only generateAIResponse --tail

# Check function status
firebase functions:list

# Check function metrics
# Buka Firebase Console → Functions → Usage tab
```

---

**Status Perbaikan Code:** ✅ DONE
**Build Status:** ✅ SUCCESS
**Deployment Status:** ⚠️ NEEDS VERIFICATION
**API Keys Status:** ⚠️ PERLU DI-CEK

**Next Steps:**
1. Buka `test-ai-chatbot.html` untuk test
2. Cek Firebase Console Logs
3. Verify API keys configuration
