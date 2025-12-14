# Test Welcome Email Function

## Cara Test Manual

Anda bisa test function `sendCandidateWelcomeEmail` secara manual dengan cara:

### 1. Via Firebase Console

1. Buka Firebase Console: https://console.firebase.google.com/project/gen-lang-client-0226679970/functions
2. Cari function `sendCandidateWelcomeEmail`
3. Klik "Test function"
4. Input data:
```json
{
  "sessionId": "YOUR_SESSION_ID_HERE"
}
```
5. Klik "Run"

### 2. Via Browser Console

Buka browser console di aplikasi Anda dan jalankan:

```javascript
// Get Firebase Functions instance
const functions = firebase.functions();

// Call the function
const sendWelcomeEmail = functions.httpsCallable('sendCandidateWelcomeEmail');

// Replace with actual session ID from Firestore
sendWelcomeEmail({ sessionId: 'YOUR_SESSION_ID' })
  .then(result => {
    console.log('Success:', result.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### 3. Cara Mendapatkan Session ID

1. Buka Firebase Console → Firestore
2. Buka collection `interview_sessions`
3. Pilih session yang baru dibuat (yang ada `candidate.email`)
4. Copy document ID-nya
5. Gunakan ID tersebut untuk test

---

## Troubleshooting

Jika email tidak terkirim, cek:

1. **Logs di Firebase Console**:
   - Functions → sendCandidateWelcomeEmail → Logs
   - Lihat error message

2. **Resend API Key**:
   - Pastikan `RESEND_API_KEY` sudah di-set di Firebase Secrets

3. **Email Valid**:
   - Pastikan email kandidat valid
   - Cek spam folder

4. **Workflow Data**:
   - Pastikan job punya workflow (optional)
   - Function tetap jalan meski tanpa workflow

---

## Expected Behavior

Ketika kandidat apply:
1. Session dibuat di Firestore
2. Function `sendCandidateWelcomeEmail` dipanggil otomatis
3. Email terkirim ke kandidat dalam beberapa detik
4. Log muncul di console: `[SESSIONS] ✅ Welcome email sent successfully`

Jika ada error, akan muncul: `[SESSIONS] ⚠️ Welcome email failed (non-blocking)`
