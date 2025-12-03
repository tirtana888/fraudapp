# 🔧 Troubleshooting: Email Undangan Bulk Upload

## 🔍 Masalah yang Dilaporkan

Ketika upload bulk kandidat (.xls):
- ✅ Upload sukses
- ✅ Kandidat muncul di dashboard
- ❌ **Email undangan hanya terkirim ke 1 email** (bisnis.ariftirtana@gmail.com)
- ❌ **Email tidak sampai ke kandidat lain**

---

## ✅ Perbaikan yang Sudah Dilakukan

### 1. **Enhanced Logging di Firebase Functions**

File `functions/index.js` - Fungsi `sendEmailViaEmailJS`:
```javascript
console.log(`[EMAIL-START] Type: ${type}, To: ${to_email}, Name: ${to_name}`);
console.log(`[EMAIL-DATA]`, JSON.stringify(data));
console.log(`[EMAIL-TEMPLATE] Using template: ${templateId}`);
console.log(`[EMAIL-PAYLOAD] Prepared payload for EmailJS`);
console.log(`[EMAIL-RESPONSE] Status: ${response.status} ${response.statusText}`);
console.log(`[EMAIL-DONE] Successfully sent to ${to_email}`);
```

### 2. **Enhanced Logging di Frontend**

File `services/firebase.ts` - Fungsi `blastAssessmentInvites`:
```typescript
console.log(`[BLAST-START] Processing ${candidates.length} candidates`);
console.log(`[BLAST 1/3] Processing: John Doe (john@example.com)`);
console.log(`[BLAST] ✅ Database saved for john@example.com`);
console.log(`[BLAST] Attempting to send email to john@example.com...`);
console.log(`[BLAST] ✅ Email sent successfully to john@example.com`);
console.log(`[BLAST-COMPLETE] Success: 3, Failed: 0`);
```

### 3. **Rate Limiting Protection**

Tambah delay 500ms antar email untuk menghindari rate limiting:
```typescript
// Add small delay between emails to avoid rate limiting
if (i < candidates.length - 1) {
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

---

## 🧪 Cara Debug

### Step 1: Test Upload Bulk
1. Login sebagai Company Admin
2. Klik tab "Undang Kandidat"
3. Upload file Excel dengan 3 kandidat
4. **Buka Browser Console (F12)**
5. Lihat logs saat proses upload

### Step 2: Lihat Logs di Browser Console

**Logs yang Bagus (Semua Berhasil):**
```
[BLAST-START] Processing 3 candidates for company: PT Maju Bersama
[BLAST 1/3] Processing: John Doe (john@example.com)
[BLAST] Generated access code for john@example.com: AB12CD
[BLAST] ✅ Database saved for john@example.com
[BLAST] Attempting to send email to john@example.com...
[BLAST] ✅ Email sent successfully to john@example.com
[BLAST 2/3] Processing: Jane Smith (jane@example.com)
[BLAST] Generated access code for jane@example.com: EF34GH
[BLAST] ✅ Database saved for jane@example.com
[BLAST] Attempting to send email to jane@example.com...
[BLAST] ✅ Email sent successfully to jane@example.com
[BLAST 3/3] Processing: Bob Wilson (bob@example.com)
[BLAST] Generated access code for bob@example.com: IJ56KL
[BLAST] ✅ Database saved for bob@example.com
[BLAST] Attempting to send email to bob@example.com...
[BLAST] ✅ Email sent successfully to bob@example.com
[BLAST-COMPLETE] Success: 3, Failed: 0
[BLAST-EMAILS-SENT] ["john@example.com", "jane@example.com", "bob@example.com"]
```

**Logs Jika Ada Email yang Gagal:**
```
[BLAST 2/3] Processing: Jane Smith (jane@example.com)
[BLAST] ✅ Database saved for jane@example.com
[BLAST] Attempting to send email to jane@example.com...
[BLAST] ❌ Email error for jane@example.com: Gagal mengirim email ke jane@example.com: EmailJS API Error (429): Rate limit exceeded
[BLAST-COMPLETE] Success: 2, Failed: 1
[BLAST-EMAILS-SENT] ["john@example.com", "bob@example.com"]
[BLAST-EMAILS-FAILED] ["jane@example.com"]
[BLAST-ERRORS] ["jane@example.com: Gagal mengirim email..."]
```

### Step 3: Cek Firebase Functions Logs

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project: **gen-lang-client-0226679970**
3. Klik **Functions** → **Logs**
4. Filter by function: `sendEmailViaEmailJS`
5. Cari error messages

**Firebase Logs yang Bagus:**
```
[EMAIL-START] Type: candidate, To: john@example.com, Name: John Doe
[EMAIL-DATA] {"company_name":"PT Maju Bersama","access_code":"AB12CD",...}
[EMAIL-TEMPLATE] Using template: template_dvgrjda
[EMAIL-PAYLOAD] Prepared payload for EmailJS
[EMAIL-RESPONSE] Status: 200 OK
[EMAIL-SUCCESS] Response: OK
[EMAIL-DONE] Successfully sent to john@example.com
```

**Firebase Logs Jika Error:**
```
[EMAIL-START] Type: candidate, To: jane@example.com, Name: Jane Smith
[EMAIL-RESPONSE] Status: 429 Too Many Requests
[EMAIL-ERROR] EmailJS API Error: Rate limit exceeded
[EMAIL-FAIL] Email sending failed: EmailJS API Error (429): Rate limit exceeded
```

---

## 🔍 Kemungkinan Penyebab Masalah

### 1. **EmailJS Quota Habis** ⚠️ **PALING MUNGKIN**

**Gejala:**
- Email pertama berhasil terkirim
- Email kedua dan seterusnya gagal
- Firebase Logs: "Rate limit exceeded" atau "Quota exceeded"

**Penjelasan:**
- EmailJS Free Plan: **200 email/bulan**
- Jika quota habis, email tidak akan terkirim
- Hanya email pertama di batch yang berhasil

**Solusi:**
1. **Cek Quota EmailJS:**
   - Login ke [EmailJS Dashboard](https://dashboard.emailjs.com)
   - Lihat **Usage** di sidebar
   - Cek berapa email yang sudah terpakai bulan ini

2. **Jika Quota Habis:**
   - **Option A**: Tunggu bulan depan (quota reset)
   - **Option B**: Upgrade ke Paid Plan (1000 email/bulan)
   - **Option C**: Gunakan SMTP Gmail sebagai fallback

3. **Temporary Workaround:**
   - Share kode akses manual via WhatsApp
   - Export kandidat dari dashboard
   - Kirim email manual ke kandidat

---

### 2. **Rate Limiting**

**Gejala:**
- Beberapa email berhasil
- Email berikutnya gagal dengan error 429

**Penjelasan:**
- EmailJS membatasi request per detik
- Bulk email terlalu cepat

**Solusi:**
- ✅ Sudah diperbaiki dengan delay 500ms antar email
- Jika masih terjadi, naikkan delay:
  ```typescript
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 detik
  ```

---

### 3. **Template EmailJS Tidak Valid**

**Gejala:**
- Error: "Template not found"
- Email tidak terkirim sama sekali

**Penjelasan:**
- Template ID salah atau tidak ada

**Solusi:**
1. Cek `functions/index.js` line 24-28:
   ```javascript
   const EMAILJS_CONFIG = {
     publicKey: "bclRHuJQwKQIOljiq",
     serviceId: "service_8o2nl6d",
     templateBusiness: "template_gfg2qr4",
     templateCandidate: "template_dvgrjda"  // ← Pastikan ini benar
   };
   ```

2. Login ke [EmailJS Dashboard](https://dashboard.emailjs.com)
3. Buka **Email Templates**
4. Cari template dengan ID: `template_dvgrjda`
5. Pastikan template aktif dan valid

---

### 4. **Service EmailJS Tidak Aktif**

**Gejala:**
- Error: "Service not found"
- Semua email gagal

**Solusi:**
1. Login ke [EmailJS Dashboard](https://dashboard.emailjs.com)
2. Buka **Email Services**
3. Pastikan ada service dengan ID: `service_8o2nl6d`
4. Pastikan status service: **Active**

---

### 5. **Firebase Functions Timeout**

**Gejala:**
- Email ke-1 berhasil
- Email ke-2 timeout
- Logs: "Function execution took too long"

**Solusi:**
- Firebase Functions Free Plan: **60 detik timeout**
- Jangan upload terlalu banyak kandidat sekaligus
- **Rekomendasi**: Maksimal 20-30 kandidat per batch

---

## 📊 Flow Diagram: Kenapa Email Hanya Ke 1 Orang?

```
Upload 3 Kandidat (A, B, C)
         │
         ↓
┌────────────────────────────┐
│  Loop: Process Kandidat    │
└────────┬───────────────────┘
         │
         ↓ Kandidat A
┌────────────────────────────┐
│  1. Save to Database ✅    │
│  2. Send Email ✅          │
│     → SUCCESS              │
└────────┬───────────────────┘
         │
         ↓ Kandidat B
┌────────────────────────────┐
│  1. Save to Database ✅    │
│  2. Send Email ❌          │
│     → FAIL: Quota Exceeded │
└────────┬───────────────────┘
         │
         ↓ Kandidat C
┌────────────────────────────┐
│  1. Save to Database ✅    │
│  2. Send Email ❌          │
│     → FAIL: Quota Exceeded │
└────────┬───────────────────┘
         │
         ↓
┌────────────────────────────┐
│  Result:                   │
│  - 3 kandidat di database  │
│  - 1 email terkirim (A)    │
│  - 2 email gagal (B, C)    │
└────────────────────────────┘
```

---

## 💡 Solusi Lengkap

### Option 1: Cek dan Upgrade EmailJS Quota

1. **Check Quota:**
   ```
   https://dashboard.emailjs.com/admin
   → Sidebar: Usage
   → Lihat berapa email terpakai
   ```

2. **Jika Quota Habis:**
   - **Free Plan**: 200 email/bulan
   - **Paid Plan**: 1000 email/bulan ($15/bulan)
   - Upgrade di: https://dashboard.emailjs.com/admin/account

### Option 2: Manual Share Kode Akses

Jika quota habis dan tidak bisa upgrade:

1. **Export Kandidat dari Dashboard:**
   - Buka tab "Status Undangan Terkirim"
   - Copy kode akses dari tabel

2. **Kirim Manual:**
   - Via WhatsApp/Email manual
   - Copy template:
   ```
   Halo [Nama Kandidat],

   Anda diundang untuk mengikuti tes integritas dari [Nama Perusahaan].

   Kode Akses Anda: [ACCESS_CODE]
   Link Assessment: https://your-app.com?mode=assess

   Silakan akses link di atas dan masukkan kode akses.
   Kode ini hanya berlaku 1 kali.

   Terima kasih.
   ```

### Option 3: Setup SMTP Gmail Fallback

Jika ingin unlimited email:

1. **Enable Gmail SMTP di Functions:**
   - Edit `functions/index.js` line 18-21
   - Ganti dengan Gmail App Password Anda
   - Deploy ulang: `firebase deploy --only functions`

2. **Edit fungsi sendEmailViaEmailJS:**
   - Tambahkan fallback ke Gmail SMTP jika EmailJS gagal

---

## 🎯 Action Plan Sekarang

### Immediate Steps:

1. ✅ **Build sudah berhasil** dengan logging yang lebih baik
2. ⚠️ **Deploy Firebase Functions:**
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

3. 🔍 **Test Upload Bulk:**
   - Upload 3 kandidat
   - Buka Browser Console (F12)
   - Lihat logs detail

4. 📧 **Cek EmailJS Quota:**
   - Login ke EmailJS Dashboard
   - Cek Usage bulan ini
   - Jika habis → upgrade atau gunakan workaround

5. 📊 **Cek Firebase Functions Logs:**
   - Buka Firebase Console
   - Functions → Logs
   - Cari error messages

---

## 📞 Jika Masih Bermasalah

**Kirim info berikut:**
1. Screenshot Browser Console logs (F12)
2. Screenshot Firebase Functions logs
3. Screenshot EmailJS Dashboard (Usage)
4. Berapa kandidat yang di-upload
5. Berapa email yang berhasil terkirim

**Dari logs, kita bisa tahu:**
- Apakah masalahnya di EmailJS quota
- Apakah masalahnya di rate limiting
- Apakah masalahnya di template/service
- Apakah masalahnya di Firebase Functions

---

## 🎉 Summary Perbaikan

**Before:**
- ❌ Tidak ada logging detail
- ❌ Sulit debug kenapa email gagal
- ❌ Tidak ada delay antar email (rate limit prone)

**After:**
- ✅ Logging detail di setiap tahap
- ✅ Browser Console menampilkan progress
- ✅ Firebase Functions logs lebih informatif
- ✅ Delay 500ms antar email (anti rate limit)
- ✅ Summary emails sent vs failed

**Next:**
- 🔍 Test dengan kandidat real
- 📧 Verify EmailJS quota
- 📊 Monitor Firebase Functions logs

**Build Status:** ✅ SUCCESS
**Ready for Testing:** ✅
**Action Required:** Deploy Functions & Check EmailJS Quota
