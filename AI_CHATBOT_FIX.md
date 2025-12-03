# ✅ Perbaikan AI Chatbot - Firebase Functions

## 🔍 Masalah yang Ditemukan

### 1. **Fungsi AI Tidak Bekerja di Chatbot Interview**
- ❌ File `services/genai.ts` memiliki 2 fungsi yang berbeda:
  - `generateAIResponse()` - Memanggil Firebase Cloud Function ✅
  - `generateNextQuestion()` - **TIDAK memanggil Firebase Function** ❌
- ❌ `PublicAssessment.tsx` menggunakan `generateNextQuestion()` yang BROKEN
- ❌ Hasilnya: Chatbot hanya return string statis, tidak ada AI response

### 2. **Root Cause**
```typescript
// SEBELUM (SALAH):
export const generateNextQuestion = async (...) => {
  return "Silakan lanjutkan dengan pertanyaan berikutnya."; // Static string!
};
```

Fungsi ini **TIDAK** memanggil Firebase Cloud Function, sehingga AI chatbot tidak berfungsi.

---

## ✅ Solusi yang Diterapkan

### 1. **Memperbaiki `generateNextQuestion()`**
Sekarang fungsi ini **memanggil Firebase Cloud Function** dengan benar:

```typescript
// SESUDAH (BENAR):
export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic',
  assessmentData?: any
): Promise<string> => {
  try {
    if (!functions) {
      throw new Error("Firebase Functions not initialized");
    }

    // Get last candidate message
    const lastUserMessage = [...history].reverse()
      .find(h => h.speaker === 'candidate' || h.speaker === 'user')?.text || "";

    // Call Firebase Cloud Function: generateAIResponse
    const generateResponse = httpsCallable(functions, "generateAIResponse");
    const result = await generateResponse({
      role,
      history,
      lastUserMessage
    });

    const response = result.data as { success: boolean; response: string };

    if (response.success && response.response) {
      return response.response;
    }

    throw new Error("Invalid response from Cloud Function");

  } catch (error) {
    console.error("AI Next Question generation failed:", error);
    // Fallback response jika Firebase Function gagal
    return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
  }
};
```

### 2. **Menghapus Fungsi Duplikat**
- Menghapus `generateAIResponse()` karena sudah digabung dengan `generateNextQuestion()`
- Sekarang hanya ada 3 fungsi utama di `genai.ts`:
  1. ✅ `analyzeFraudRisk()` - Analisis risiko fraud
  2. ✅ `generateNextQuestion()` - Generate pertanyaan AI chatbot
  3. ✅ `calculateAssessmentScores()` - Hitung skor assessment

---

## 🚀 Cara Deploy Firebase Functions

### Prerequisites
1. **Firebase CLI** terinstall
2. **API Keys** sudah disiapkan:
   - Gemini API Key dari [Google AI Studio](https://makersuite.google.com/app/apikey)
   - OpenAI API Key dari [OpenAI Platform](https://platform.openai.com/api-keys)

### Step 1: Login ke Firebase
```bash
firebase login
```

### Step 2: Set API Keys di Firebase Config
```bash
# Set Gemini API Key (Primary)
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"

# Set OpenAI API Key (Fallback)
firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"

# Verify
firebase functions:config:get
```

Output yang diharapkan:
```json
{
  "gemini": {
    "key": "AIzaSy..."
  },
  "openai": {
    "key": "sk-proj-..."
  }
}
```

### Step 3: Deploy Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Atau deploy satu per satu:
firebase deploy --only functions:generateAIResponse
firebase deploy --only functions:analyzeFraudRisk
firebase deploy --only functions:sendEmailViaEmailJS
```

### Step 4: Verifikasi Deployment
Setelah deploy berhasil, Anda akan melihat:
```
✔ functions[europe-west1-generateAIResponse] Successful create
✔ functions[europe-west1-analyzeFraudRisk] Successful create
✔ functions[europe-west1-sendEmailViaEmailJS] Successful create
```

---

## 🧪 Testing AI Chatbot

### Test Flow:
1. **Buka aplikasi** dan login menggunakan access code
2. **Isi profil kandidat** (Nama, Email, Role)
3. **Selesaikan survey**:
   - Fraud Triangle Assessment
   - Financial Strain Questions
   - SJT (Situational Judgment Test)
4. **Mulai Chat Interview**
5. **Kirim pesan** ke AI interviewer
6. **Cek response**: Seharusnya AI memberikan follow-up question yang relevan

### Debug di Browser Console:
```javascript
// Cek apakah Firebase Functions terkoneksi
console.log(functions); // Harus ada, bukan undefined

// Cek logs saat chat
// Akan muncul: "Calling Firebase Function: generateAIResponse"
```

### Cek Logs di Firebase Console:
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project: **gen-lang-client-0226679970**
3. Klik **Functions** di sidebar
4. Klik **Logs** tab
5. Filter function: `generateAIResponse`

Logs yang baik:
```
[AI] Trying Gemini for role: Manajer Keuangan
[AI] Gemini response generated successfully
```

Logs jika Gemini gagal (fallback to OpenAI):
```
[WARN] Gemini failed, trying OpenAI fallback
[AI] OpenAI response generated successfully
```

---

## 🔍 Troubleshooting

### Error: "Firebase Functions not initialized"
**Penyebab**: Firebase Functions belum ter-deploy atau region salah

**Solusi**:
1. Deploy functions: `firebase deploy --only functions`
2. Pastikan region di `genai.ts` sama dengan di `functions/index.js`:
   ```typescript
   functions = getFunctions(app, "europe-west1");
   ```

### Error: "API keys belum dikonfigurasi"
**Penyebab**: Gemini/OpenAI API keys belum di-set di Firebase Config

**Solusi**:
```bash
firebase functions:config:set gemini.key="YOUR_KEY"
firebase functions:config:set openai.key="YOUR_KEY"
firebase deploy --only functions
```

### AI Response Selalu Sama (Statis)
**Penyebab**: Fallback response digunakan karena Firebase Function gagal

**Solusi**:
1. Cek Firebase Console → Functions → Logs
2. Lihat error message
3. Biasanya karena:
   - API keys salah/expired
   - Quota API habis
   - Network timeout

### Gemini API Error: "Safety Block"
**Penyebab**: Gemini memblokir response karena safety settings

**Solusi**:
Safety settings sudah di-set ke `BLOCK_NONE` di `functions/index.js`:
```javascript
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
```

Jika masih terjadi, sistem otomatis fallback ke OpenAI.

---

## 📊 Flow Diagram

### AI Chatbot Request Flow:
```
┌──────────────────┐
│  Kandidat Kirim  │
│     Pesan        │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────┐
│  PublicAssessment.tsx        │
│  handleSendMessage()         │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  services/genai.ts           │
│  generateNextQuestion()      │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  Firebase Cloud Function     │
│  generateAIResponse()        │
│                              │
│  TRY: Gemini API             │
│  FALLBACK: OpenAI API        │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  Return AI Response          │
│  ke Frontend                 │
└──────────────────────────────┘
```

---

## 📝 Files yang Dimodifikasi

1. ✅ **services/genai.ts**
   - Memperbaiki `generateNextQuestion()` untuk memanggil Firebase Function
   - Menghapus `generateAIResponse()` yang duplikat
   - Menambahkan fallback mechanism

2. ✅ **Build Success**
   - `npm run build` berhasil
   - Tidak ada error TypeScript
   - Bundle size: 1.5 MB (gzip: 429 KB)

---

## 🎯 Next Steps

1. **Deploy Firebase Functions** dengan API keys yang valid
2. **Test AI Chatbot** end-to-end
3. **Monitor Logs** di Firebase Console
4. **Optimize Response Time** jika perlu

---

## 💡 Tips

### Menghemat Biaya API:
- Gunakan Gemini sebagai primary (lebih murah)
- OpenAI hanya sebagai fallback
- Set timeout di Firebase Functions (max 60s)
- Cache common responses jika perlu

### Meningkatkan Response Quality:
- Sesuaikan prompt di `functions/index.js`
- Tambahkan context dari survey results
- Fine-tune temperature parameter

### Monitoring:
- Setup Firebase Alerts untuk function errors
- Track API usage di Google AI Studio & OpenAI Dashboard
- Monitor latency di Firebase Performance

---

## 📞 Support

Jika masih ada masalah:
1. Cek Firebase Console Logs
2. Cek Browser Console untuk error messages
3. Verify API keys masih valid
4. Test dengan Gemini/OpenAI playground dulu

---

**Status**: ✅ FIXED & READY FOR DEPLOYMENT
**Build**: ✅ SUCCESS
**Next**: Deploy Firebase Functions dengan API keys
