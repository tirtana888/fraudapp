# AI Chatbot Debug Guide

## Status Update: Model Dikembalikan ke Setup Awal

✅ **Model TELAH DIKEMBALIKAN ke konfigurasi yang benar:**
- **Gemini 2.0 Flash Thinking Experimental** (`gemini-2.0-flash-thinking-exp-1219`) - Gemini "3" Preview untuk chat & analysis
- **GPT-4o** sebagai fallback

---

## Kenapa Chatbot Hanya Memberikan Response Static?

Jika chatbot hanya memberikan response static seperti:
> "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?"

Artinya **KEDUA AI Provider (Gemini DAN OpenAI) GAGAL bekerja**.

---

## Cara Mengecek Masalahnya

### 1. Cek Firebase Functions Logs

```bash
firebase functions:log --limit 50
```

**Cari log berikut:**

#### ✅ **Jika API Keys Terkonfigurasi dengan Benar:**
```
[AI-CONFIG] Gemini API Key present: true
[AI-CONFIG] OpenAI API Key present: true
[AI] Trying Gemini for role: ...
```

#### ❌ **Jika API Keys TIDAK Terkonfigurasi:**
```
[AI-CONFIG] Gemini API Key present: false
[AI-CONFIG] OpenAI API Key present: false
[AI-CONFIG] NO API KEYS CONFIGURED! Using static fallback.
```

#### ⚠️ **Jika AI Provider Gagal:**
```
[ERROR] Gemini failed: { message: "...", stack: "..." }
[AI] Attempting OpenAI fallback...
[ERROR] OpenAI also failed: { message: "...", stack: "..." }
[AI] ⚠️ ALL AI PROVIDERS FAILED! Using static fallback response.
```

---

## Troubleshooting Steps

### Problem 1: API Keys Tidak Terkonfigurasi
**Symptom:**
```
[AI-CONFIG] Gemini API Key present: false
[AI-CONFIG] OpenAI API Key present: false
```

**Solution:**
```bash
# Set Gemini API Key
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"

# Set OpenAI API Key
firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"

# Verify
firebase functions:config:get

# Deploy ulang
firebase deploy --only functions
```

---

### Problem 2: Gemini API Error (Model Not Found)
**Symptom:**
```
[ERROR] Gemini failed: { message: "models/gemini-2.0-flash-thinking-exp-1219 is not found" }
```

**Possible Causes:**
1. Model ID salah atau tidak tersedia di region Anda
2. Gemini API Key tidak memiliki akses ke model experimental/preview

**Solution:**
- Cek apakah API key Anda memiliki akses ke `gemini-2.0-flash-thinking-exp-1219` (Gemini "3" Preview)
- Jika tidak, model akan otomatis fallback ke OpenAI GPT-4o
- Atau bisa ganti model di `functions/index.js` ke model yang tersedia:
  - `gemini-2.0-flash-exp`
  - `gemini-1.5-flash-latest`
  - `gemini-1.5-pro-latest`

---

### Problem 3: OpenAI API Error (Quota/Rate Limit)
**Symptom:**
```
[ERROR] OpenAI also failed: { message: "Rate limit exceeded" }
atau
[ERROR] OpenAI also failed: { message: "Insufficient quota" }
```

**Solution:**
1. Cek quota OpenAI di: https://platform.openai.com/usage
2. Tambah credits ke account OpenAI Anda
3. Atau gunakan API key yang berbeda

---

### Problem 4: CORS / Network Error
**Symptom:**
```
[ERROR] Gemini failed: { message: "fetch failed" }
[ERROR] OpenAI also failed: { message: "fetch failed" }
```

**Solution:**
1. Pastikan Firebase Functions bisa akses internet (seharusnya otomatis)
2. Cek apakah region `europe-west1` support untuk project Anda
3. Coba deploy ke region lain jika perlu

---

## Cara Test AI Chatbot

### 1. Test dari Browser Console

Buka halaman assessment, lalu jalankan di console:
```javascript
// Check if functions are reachable
console.log(firebase.functions());

// Test call (harus login dulu)
const testAI = firebase.functions().httpsCallable('generateAIResponse');
testAI({
  role: 'Test Role',
  history: [{ speaker: 'ai', text: 'Hello' }],
  lastUserMessage: 'Test message'
}).then(result => {
  console.log('AI Response:', result.data);
}).catch(err => {
  console.error('Error:', err);
});
```

### 2. Cek dari Firebase Console

1. Buka **Firebase Console** > **Functions** > **Logs**
2. Lakukan assessment dari browser
3. Lihat real-time logs untuk error messages

---

## Current Configuration

**File:** `functions/index.js`

### generateAIResponse Function (Chat)
```javascript
// Primary: Gemini 2.0 Flash Thinking Experimental (Gemini "3" Preview)
model: "gemini-2.0-flash-thinking-exp-1219"

// Fallback: OpenAI GPT-4o
model: "gpt-4o"
```

### analyzeFraudRisk Function (Analysis)
```javascript
// Primary: Gemini 2.0 Flash Thinking Experimental (Gemini "3" Preview)
model: "gemini-2.0-flash-thinking-exp-1219"

// Fallback: OpenAI GPT-4o
model: "gpt-4o"
```

---

## Improved Error Logging

Sekarang Firebase Functions sudah memiliki logging lengkap:

1. **Config Check**: Apakah API keys terkonfigurasi?
2. **Gemini Attempt**: Detailed error jika Gemini gagal
3. **OpenAI Fallback**: Detailed error jika OpenAI juga gagal
4. **Final Warning**: Clear message jika semua provider gagal

**Semua log** akan muncul di Firebase Functions logs dan bisa diakses dengan:
```bash
firebase functions:log
```

---

## Next Steps

1. ✅ **Deploy Firebase Functions** dengan config yang sudah diperbaiki
   ```bash
   firebase deploy --only functions
   ```

2. ✅ **Cek Logs** setelah deployment
   ```bash
   firebase functions:log --limit 50
   ```

3. ✅ **Test Assessment** dari browser dan cek apakah AI response sudah dynamic

4. ✅ **Verify API Keys** terkonfigurasi dengan benar
   ```bash
   firebase functions:config:get
   ```

---

## Summary

- ✅ Model sudah dikembalikan ke: **Gemini 2.0 Flash Thinking Experimental (Gemini "3" Preview) + GPT-4o**
- ✅ Logging diperbaiki untuk debugging yang lebih baik
- ✅ Error handling lebih detail
- ✅ Prompt AI sudah lebih natural dan conversational
- ✅ Transcript akan muncul di laporan kandidat

**Chatbot akan bekerja dengan baik jika:**
1. API Keys terkonfigurasi dengan benar
2. API Keys memiliki quota yang cukup
3. Model ID `gemini-2.0-flash-thinking-exp-1219` tersedia/accessible untuk API key Anda
