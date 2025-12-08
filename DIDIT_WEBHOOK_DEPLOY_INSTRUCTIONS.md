# 🚀 Instruksi Deploy Didit Webhook - PENTING!

## ⚠️ **MASALAH TERIDENTIFIKASI**

Dari log webhook Didit dan screenshot Firebase Console, ditemukan **2 masalah utama**:

### 1. **Webhook Response 405 (Method Not Allowed)**
- Cloud Function `diditWebhook` **BELUM TER-DEPLOY** atau tidak ter-configure dengan benar
- Webhook Didit mengirim POST request tapi function mengembalikan error 405
- Ini menyebabkan data verifikasi tidak pernah sampai ke Firestore

### 2. **Data Tidak Muncul di UI**
- Karena webhook gagal (405), field `backgroundCheck` tidak pernah ter-create/update di Firestore
- Real-time listener di frontend tidak ada data untuk di-display
- UI tetap menampilkan status "Pending"

---

## ✅ **SOLUSI: Deploy Cloud Function Webhook**

Saya telah menambahkan 2 Cloud Functions baru ke file `/app/functions/index.js`:

### **Function 1: `diditWebhook`** (HTTP Request Handler)
- **Purpose**: Menerima webhook callback dari Didit ketika verifikasi selesai
- **Type**: HTTPS onRequest (bukan onCall)
- **Method**: POST
- **Features**:
  - ✅ Handle POST request dengan benar
  - ✅ CORS enabled untuk cross-origin requests
  - ✅ Parse webhook payload dari Didit
  - ✅ Map status Didit (Approved/Declined) ke format kita
  - ✅ Update Firestore collection `interview_sessions`
  - ✅ Extract decision & warnings dari payload
  - ✅ Logging lengkap untuk debugging

### **Function 2: `createDiditSession`** (Callable Function)
- **Purpose**: Create new Didit verification session via API
- **Type**: HTTPS onCall (dipanggil dari frontend)
- **Features**:
  - ✅ Call Didit API untuk create session
  - ✅ Set `vendor_data` dengan Firestore session ID
  - ✅ Return verification URL ke frontend

---

## 📋 **LANGKAH-LANGKAH DEPLOYMENT**

### **Step 1: Set Firebase Configuration**

Anda perlu mengatur API keys untuk Didit di Firebase Functions config:

```bash
# Didit API Key
firebase functions:config:set didit.api_key="YOUR_DIDIT_API_KEY"

# Didit Flow/Workflow ID
firebase functions:config:set didit.flow_id="YOUR_DIDIT_WORKFLOW_ID"
```

**Cara mendapatkan keys:**
1. Login ke Didit Dashboard: https://didit.me/dashboard
2. Navigate ke **Settings → API Keys**
3. Copy **API Key** dan **Workflow ID**

---

### **Step 2: Deploy Cloud Functions**

Di terminal/command prompt, navigate ke folder project dan deploy:

```bash
cd /path/to/your/project

# Deploy semua functions (termasuk diditWebhook & createDiditSession)
firebase deploy --only functions

# ATAU deploy hanya function webhook (lebih cepat)
firebase deploy --only functions:diditWebhook,functions:createDiditSession
```

**Expected Output:**
```
✔  functions[diditWebhook(europe-west1)]: Successful create operation.
✔  functions[createDiditSession(europe-west1)]: Successful create operation.
Function URL (diditWebhook): https://europe-west1-your-project.cloudfunctions.net/diditWebhook
```

⚠️ **PENTING**: Copy URL dari `diditWebhook` - Anda akan butuh ini untuk Step 3!

---

### **Step 3: Configure Webhook URL di Didit Dashboard**

Setelah deploy, configure webhook URL di Didit:

1. Login ke Didit Dashboard
2. Navigate ke **Settings → Webhooks** atau **Workflows → [Your Workflow] → Settings**
3. Set **Webhook URL** ke:
   ```
   https://europe-west1-YOUR-PROJECT-ID.cloudfunctions.net/diditWebhook
   ```
   *(Ganti `YOUR-PROJECT-ID` dengan Firebase project ID Anda)*

4. **Webhook Events**: Pilih `status.updated`
5. **Save** configuration

---

### **Step 4: Test Webhook**

Untuk test apakah webhook berfungsi:

1. **Trigger Test dari Didit Dashboard:**
   - Di Didit Dashboard, cari opsi "Test Webhook" atau "Send Test Event"
   - Kirim test event dengan sample payload
   
2. **Check Firebase Functions Logs:**
   ```bash
   firebase functions:log --only diditWebhook
   ```
   
   **Expected logs:**
   ```
   [DIDIT-WEBHOOK] Received webhook request
   [DIDIT-WEBHOOK] Method: POST
   [DIDIT-WEBHOOK] Processing for Firestore session: <session-id>
   [DIDIT-WEBHOOK] ✅ Firestore updated successfully
   ```

3. **Check Firestore Console:**
   - Buka Firebase Console → Firestore Database
   - Cari collection `interview_sessions`
   - Pilih document kandidat yang baru saja verifikasi
   - **Field `backgroundCheck` harus muncul** dengan data:
     ```javascript
     {
       status: "approved" | "declined" | "in_progress",
       diditSessionId: "1695dac1-42f2-4acf-9672-3bb79d51c8f2",
       decision: "Verification Declined (3 warning(s) detected)",
       verificationLink: "https://...",
       createdAt: Timestamp,
       lastUpdated: Timestamp
     }
     ```

---

## 🧪 **TESTING FLOW END-TO-END**

Setelah webhook ter-deploy dan ter-configure, test full flow:

### **Test 1: Real Verification Flow**
1. **Trigger Background Check dari UI:**
   - Buka candidate profile di aplikasi
   - Klik button "Background Check"
   - Kandidat akan menerima email dengan link Didit

2. **Kandidat Complete Verification:**
   - Kandidat klik link dan selesaikan verifikasi Didit
   - Upload ID, selfie, dll

3. **Webhook Update Firestore:**
   - Ketika Didit selesai processing, webhook akan dipanggil
   - Function `diditWebhook` akan update Firestore

4. **UI Auto-Updates:**
   - Real-time listener di frontend akan detect perubahan
   - UI otomatis refresh dengan status baru
   - Toast notification muncul
   - **TANPA PERLU REFRESH BROWSER!** 🎉

### **Test 2: Manual Update (Jika Webhook Gagal)**
Jika webhook masih belum berfungsi, Anda bisa manual update Firestore untuk test UI:

1. Buka Firebase Console → Firestore
2. Pilih collection `interview_sessions`
3. Edit document kandidat
4. Tambahkan field `backgroundCheck`:
   ```json
   {
     "status": "approved",
     "decision": "Test verification successful",
     "diditSessionId": "test-session-123",
     "createdAt": { "seconds": 1733654400 },
     "lastUpdated": { "seconds": 1733654400 }
   }
   ```
5. Buka candidate profile di browser (tanpa refresh)
6. **Expected**: UI otomatis update, toast muncul

---

## 🔍 **TROUBLESHOOTING**

### **Issue: Webhook Masih Return 405**
**Solusi:**
1. Pastikan function ter-deploy:
   ```bash
   firebase functions:list | grep diditWebhook
   ```
2. Cek Firebase Functions logs:
   ```bash
   firebase functions:log --only diditWebhook --limit 50
   ```
3. Test webhook URL dengan curl:
   ```bash
   curl -X POST https://YOUR-FUNCTION-URL/diditWebhook \
     -H "Content-Type: application/json" \
     -d '{"session_id":"test","vendor_data":"test123","status":"Approved"}'
   ```

### **Issue: Data Tidak Muncul di Firestore**
**Solusi:**
1. Check function logs untuk error
2. Verify `vendor_data` di webhook payload = Firestore session ID
3. Pastikan Firestore rules allow write untuk function

### **Issue: UI Tidak Update Otomatis**
**Solusi:**
1. Buka browser console (F12)
2. Cek logs:
   - `[CANDIDATE-DETAIL] Background check status updated via real-time listener`
3. Jika tidak ada log, berarti real-time listener tidak detect perubahan
4. Manual refresh untuk test apakah data ada di Firestore

---

## 📊 **DATA STRUCTURE**

### **Webhook Payload dari Didit:**
```json
{
  "session_id": "1695dac1-42f2-4acf-9672-3bb79d51c8f2",
  "status": "Declined",
  "vendor_data": "6HtXwbdfs8KDUeopPYVG",
  "decision": {
    "status": "Declined",
    "id_verification": {
      "status": "Declined",
      "warnings": [...]
    },
    "face_match": {
      "status": "Approved",
      "score": 94.15
    },
    "liveness": {
      "status": "Approved",
      "score": 98.02
    }
  },
  "created_at": 1765173138,
  "timestamp": 1765184940,
  "webhook_type": "status.updated"
}
```

### **Data di Firestore (After Webhook):**
```javascript
{
  // Collection: interview_sessions
  // Document ID: 6HtXwbdfs8KDUeopPYVG
  
  backgroundCheck: {
    status: "declined",
    diditSessionId: "1695dac1-42f2-4acf-9672-3bb79d51c8f2",
    decision: "Verification Declined (3 warning(s) detected)",
    verificationLink: "https://verify.didit.me/session/...",
    createdAt: Timestamp(1765173138),
    lastUpdated: Timestamp(1765184940),
    rawWebhookData: {
      status: "Declined",
      webhook_type: "status.updated",
      session_number: 265
    }
  },
  backgroundCheckStatus: "declined",
  backgroundCheckCompletedAt: Timestamp(...)
}
```

---

## ✅ **CHECKLIST SEBELUM DEPLOYMENT**

- [ ] Firebase CLI ter-install (`npm install -g firebase-tools`)
- [ ] Login ke Firebase (`firebase login`)
- [ ] Firebase project ter-configure (`firebase use YOUR_PROJECT_ID`)
- [ ] Dapatkan Didit API Key dari dashboard
- [ ] Dapatkan Didit Workflow ID dari dashboard
- [ ] Set Firebase config: `didit.api_key` dan `didit.flow_id`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Copy webhook URL dari deploy output
- [ ] Configure webhook URL di Didit Dashboard
- [ ] Test webhook dengan sample payload
- [ ] Verify data muncul di Firestore
- [ ] Test UI auto-update

---

## 📞 **SUPPORT**

Jika masih ada masalah setelah deploy:

1. **Cek Firebase Functions Logs:**
   - Console: https://console.firebase.google.com → Functions → Logs
   - CLI: `firebase functions:log`

2. **Cek Didit Webhook Logs:**
   - Dashboard: https://didit.me/dashboard → Webhooks → Logs
   - Lihat response status dari webhook calls

3. **Test Webhook Manually:**
   ```bash
   # Test dengan curl
   curl -X POST YOUR_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d @test_webhook_payload.json
   ```

---

**Status:** Function code READY ✅  
**Next Action:** Deploy ke Firebase Functions  
**Expected Result:** Webhook 200 OK, Data muncul di Firestore & UI
