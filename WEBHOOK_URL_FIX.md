# 🔧 Perbaikan Callback URL Webhook Didit

## ⚠️ Masalah Teridentifikasi

Dari kode `index.js` yang Anda berikan, callback URL yang digunakan **SALAH**:

### ❌ URL Salah (di kode sekarang):
```javascript
callback: 'https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook'
```

### ✅ URL Yang Benar (harus digunakan):
```javascript
callback: 'https://webhook.hiregood.one/webhook'
```

---

## 📝 Perubahan yang Harus Dilakukan

Anda perlu mengubah callback URL di **2 function** dalam file `/app/functions/index.js`:

### **1. Function: `createDiditSession`**

**Cari baris ini:**
```javascript
const payload = JSON.stringify({
  workflow_id: DIDIT_FLOW_ID,
  vendor_data: sessionId,
  callback: 'https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook',  // ❌ SALAH
  metadata: { candidate_name: candidateName, candidate_email: candidateEmail, session_id: sessionId }
});
```

**Ubah menjadi:**
```javascript
const payload = JSON.stringify({
  workflow_id: DIDIT_FLOW_ID,
  vendor_data: sessionId,
  callback: 'https://webhook.hiregood.one/webhook',  // ✅ BENAR
  metadata: { candidate_name: candidateName, candidate_email: candidateEmail, session_id: sessionId }
});
```

---

### **2. Function: `initiateBackgroundCheck`**

**Cari baris ini:**
```javascript
const diditPayload = JSON.stringify({
  workflow_id: DIDIT_FLOW_ID,
  vendor_data: sessionId,
  callback: 'https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook',  // ❌ SALAH
  metadata: {
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    session_id: sessionId,
    company_id: companyId
  }
});
```

**Ubah menjadi:**
```javascript
const diditPayload = JSON.stringify({
  workflow_id: DIDIT_FLOW_ID,
  vendor_data: sessionId,
  callback: 'https://webhook.hiregood.one/webhook',  // ✅ BENAR
  metadata: {
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    session_id: sessionId,
    company_id: companyId
  }
});
```

---

## 🔍 Mengapa Ini Penting?

1. **Didit menggunakan callback URL yang diberikan saat session creation**
   - Saat Anda create Didit session, Anda memberikan callback URL
   - Didit akan mengirim webhook ke URL tersebut ketika verifikasi selesai
   
2. **URL Cloud Function vs Custom Domain**
   - `https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook` adalah URL default Cloud Function
   - `https://webhook.hiregood.one/webhook` adalah custom domain Anda
   - Keduanya mungkin mengarah ke function yang sama, TAPI Didit harus tahu URL mana yang digunakan

3. **Konsistensi URL**
   - Jika Anda set callback URL berbeda dengan URL yang ter-configure di Didit Dashboard, webhook bisa tidak sampai
   - Harus menggunakan **HTTPS**, bukan HTTP

---

## 📋 Langkah-Langkah Setelah Perubahan:

### Step 1: Edit File
Edit `/app/functions/index.js` dan ubah 2 callback URL seperti di atas.

### Step 2: Deploy Ulang
```bash
firebase deploy --only functions:createDiditSession,functions:initiateBackgroundCheck
```

### Step 3: Verifikasi di Didit Dashboard
1. Login ke Didit Dashboard
2. Buka Settings → Webhooks
3. **Pastikan Webhook URL juga diset ke:** `https://webhook.hiregood.one/webhook` (gunakan HTTPS!)
4. Save configuration

### Step 4: Test Flow
1. Trigger background check dari UI
2. Kandidat complete Didit verification
3. Check log Cloud Function untuk melihat apakah webhook diterima
4. Check Firestore untuk field `backgroundCheck`
5. Verify UI auto-update

---

## 🧪 Test Webhook Setelah Deploy

**Test 1: Check Log Function**
```bash
# Lihat log function diditWebhook
gcloud functions logs read diditWebhook --region=europe-west1 --limit=50
```

**Expected log setelah verifikasi:**
```
[DIDIT-WEBHOOK] Received webhook request
[DIDIT-WEBHOOK] Processing for Firestore session: <session-id>
[DIDIT-WEBHOOK] Updating session: <session-id> -> approved/declined
[DIDIT-WEBHOOK] ✅ Firestore updated successfully
```

**Test 2: Manual Trigger via Didit Dashboard**
- Di Didit Dashboard, gunakan fitur "Test Webhook"
- Send test event dengan sample payload
- Check apakah function menerima request dengan status 200 OK

---

## ⚠️ PENTING: Custom Domain Mapping

Jika `webhook.hiregood.one` adalah custom domain yang di-map ke Cloud Function:

1. **Verify Custom Domain Mapping:**
   ```bash
   # List custom domains di Cloud Run
   gcloud run domain-mappings list --region=europe-west1
   ```

2. **Pastikan SSL Certificate Valid:**
   - Custom domain harus punya SSL certificate yang valid
   - Didit hanya akan mengirim webhook ke HTTPS endpoint dengan valid SSL

3. **Test Custom Domain:**
   ```bash
   curl -X POST https://webhook.hiregood.one/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
   
   Expected: Respon dari Cloud Function (bukan 404 atau SSL error)

---

## 📊 Summary Perubahan

| Location | Old Value | New Value |
|----------|-----------|-----------|
| `createDiditSession` callback | `https://europe-west1-gen-lang...` | `https://webhook.hiregood.one/webhook` |
| `initiateBackgroundCheck` callback | `https://europe-west1-gen-lang...` | `https://webhook.hiregood.one/webhook` |
| Didit Dashboard Webhook URL | `http://webhook.hiregood.one/webhook` | `https://webhook.hiregood.one/webhook` |

**Perhatikan:** Gunakan **HTTPS** (bukan HTTP) di semua tempat!

---

## ✅ Checklist

- [ ] Edit callback URL di `createDiditSession`
- [ ] Edit callback URL di `initiateBackgroundCheck`
- [ ] Deploy ulang kedua function
- [ ] Update Webhook URL di Didit Dashboard ke HTTPS
- [ ] Test webhook via Didit Dashboard
- [ ] Run end-to-end verification flow
- [ ] Verify data muncul di Firestore
- [ ] Verify UI auto-update

---

**Status:** ⚠️ PERLU PERUBAHAN KODE  
**Priority:** HIGH - Ini adalah root cause webhook tidak sampai  
**Expected Result:** Setelah perubahan, webhook akan diterima dengan status 200 OK
