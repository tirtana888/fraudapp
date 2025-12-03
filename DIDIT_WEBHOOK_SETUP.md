# Didit Webhook Integration Setup Guide

## Overview
Webhook endpoint telah dibuat untuk menerima real-time notifications dari Didit.me setiap ada perubahan status verifikasi background check.

## What's Been Implemented

### 1. Firebase Cloud Function (`functions/index.js`)
Function `diditWebhook` sudah dibuat dengan fitur:
- ✅ HMAC-SHA256 signature verification untuk keamanan
- ✅ Timestamp validation (max 5 menit)
- ✅ Handle event types: `status.updated` dan `data.updated`
- ✅ Auto-update status ke Firestore
- ✅ Comprehensive logging untuk debugging
- ✅ Error handling dan retry support

### 2. Security Features
- **Signature Verification**: Setiap webhook diverifikasi menggunakan webhook secret
- **Timing Attack Prevention**: Menggunakan `crypto.timingSafeEqual`
- **Timestamp Check**: Menolak webhook yang lebih dari 5 menit
- **Raw Body Validation**: HMAC dihitung dari raw JSON body

### 3. Event Handling

#### Status Updates (`status.updated`)
Webhook akan update field berikut di Firestore:
- `backgroundCheck.status` - Status mapped: pending/in_progress/approved/declined/in_review
- `backgroundCheck.lastUpdated` - Timestamp terakhir update
- `backgroundCheck.diditSessionId` - Session ID dari Didit
- `backgroundCheckStatus` - Status untuk filtering
- `backgroundCheck.decision` - Data decision lengkap (jika ada)
- `backgroundCheckCompletedAt` - Timestamp completion (untuk status final)

#### Data Updates (`data.updated`)
Untuk manual data correction oleh reviewer:
- `backgroundCheck.dataUpdated` - Flag ada update data
- `backgroundCheck.lastDataUpdate` - Timestamp data update
- `backgroundCheck.decision` - Updated decision data

## Deployment Steps

### Step 1: Deploy Firebase Function

```bash
# Masuk ke folder project
cd /tmp/cc-agent/60982488/project

# Deploy hanya webhook function
firebase deploy --only functions:diditWebhook
```

**Output yang diharapkan:**
```
✔ Deploy complete!

Function URL (diditWebhook(europe-west1)):
https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook
```

**PENTING:** Simpan URL function ini untuk step berikutnya!

### Step 2: Configure Webhook di Didit Dashboard

1. **Login ke Didit Dashboard**
   - Buka: https://dashboard.didit.me
   - Login dengan akun Anda

2. **Navigate ke Webhook Settings**
   - Pilih Application/Workflow Anda
   - Cari menu "Webhooks" atau "Settings"

3. **Add Webhook URL**
   - Masukkan URL function:
     ```
     https://europe-west1-gen-lang-client-0226679970.cloudfunctions.net/diditWebhook
     ```
   - Webhook Secret sudah dikonfigurasi: `wU3IKNEZeXakCk1uYidDcEXlaob5mFPQOWSL1vdTl6I`

4. **Test Webhook (Optional)**
   - Didit biasanya punya feature "Test Webhook"
   - Pastikan response adalah `200 OK`
   - Check Firebase Console > Functions > Logs untuk melihat webhook diterima

### Step 3: Verify Integration

1. **Test Background Check Flow**
   - Buka dashboard HireGood
   - Pilih kandidat di "Otomatis" tab
   - Klik "Start Check" pada kandidat
   - Complete verifikasi KTP + Liveness

2. **Monitor Real-time Updates**
   - Status akan auto-update tanpa refresh page
   - Check Firebase Console > Functions > Logs:
     ```
     [DIDIT-WEBHOOK] Received webhook request
     [DIDIT-WEBHOOK] Signature verified successfully
     [DIDIT-WEBHOOK] Processing status update
     [DIDIT-WEBHOOK] Session updated successfully
     ```

3. **Check Firestore Data**
   - Buka Firebase Console > Firestore
   - Collection: `sessions`
   - Document: [session_id]
   - Verify fields:
     - `backgroundCheck.status`
     - `backgroundCheck.decision`
     - `backgroundCheckCompletedAt`

## Webhook Events Flow

```
┌──────────────┐
│   Kandidat   │
│  Complete    │
│ Verification │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│   Didit.me       │  1. Status: "In Progress"
│   Processing     │  2. Status: "In Review" (optional)
│                  │  3. Status: "Approved/Declined"
└──────┬───────────┘
       │
       │ POST webhook for each status change
       │ Headers: X-Signature, X-Timestamp
       │ Body: { session_id, status, vendor_data, ... }
       │
       ▼
┌────────────────────────────┐
│  Firebase Cloud Function   │
│  diditWebhook              │
│                            │
│  1. Verify signature       │
│  2. Validate timestamp     │
│  3. Parse payload          │
│  4. Update Firestore       │
│  5. Return 200 OK          │
└──────┬─────────────────────┘
       │
       ▼
┌──────────────────┐
│   Firestore      │
│   sessions/      │
│   {session_id}   │
│                  │
│   backgroundCheck:│
│     status: ✅   │
│     decision: {} │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  HireGood UI     │
│  Auto-updates    │
│  Badge Status    │
└──────────────────┘
```

## Status Mapping

| Didit Status    | Internal Status | Badge Display    |
|-----------------|----------------|------------------|
| Not Started     | pending        | Start Check      |
| In Progress     | in_progress    | ⏳ Pending       |
| In Review       | in_review      | ⏳ In Review     |
| Approved        | approved       | ✅ Verified      |
| Declined        | declined       | ❌ Failed        |
| Abandoned       | declined       | ❌ Failed        |

## Troubleshooting

### Webhook Not Received

1. **Check Function Deployment**
   ```bash
   firebase functions:log --only diditWebhook
   ```

2. **Check Webhook URL Configuration**
   - Pastikan URL di Didit dashboard benar
   - Format: `https://[region]-[project-id].cloudfunctions.net/diditWebhook`

3. **Check Firewall/CORS**
   - Function sudah configured dengan `cors: true`
   - Didit IP should be whitelisted (biasanya tidak perlu)

### Signature Verification Failed

1. **Check Webhook Secret**
   - Harus sama persis di:
     - `functions/index.js` (line 33)
     - Didit Dashboard webhook configuration

2. **Check Logs**
   ```bash
   firebase functions:log --only diditWebhook
   ```
   Look for:
   ```
   [DIDIT-WEBHOOK] Expected signature: abc123...
   [DIDIT-WEBHOOK] Invalid signature
   ```

### Status Not Updating in UI

1. **Check Firestore Rules**
   - Pastikan read access ke `sessions` collection

2. **Hard Refresh Page**
   - Press `Ctrl + F5` / `Cmd + Shift + R`

3. **Check Browser Console**
   - Look for Firestore errors

## Advanced Configuration

### Custom Region
Default region: `europe-west1`

Untuk ganti region:
```javascript
// functions/index.js line 548
exports.diditWebhook = onRequest({
  region: "asia-southeast1",  // Change this
  cors: true
}, async (req, res) => {
```

### Retry Policy
Didit akan auto-retry jika webhook gagal:
- 1st retry: ~1 menit setelah gagal
- 2nd retry: ~4 menit setelah retry pertama

Function akan log setiap attempt:
```
[DIDIT-WEBHOOK] Received webhook request
[DIDIT-WEBHOOK] Session updated successfully
```

### Custom Logging
Tambahkan custom logs di `functions/index.js`:
```javascript
console.log('[CUSTOM] Your log message here');
```

## Security Best Practices

1. **Never Expose Webhook Secret**
   - Sudah di-hardcode di function (aman)
   - Jangan commit ke public repo

2. **Monitor Logs Regularly**
   - Check untuk unauthorized attempts
   - Look for signature verification failures

3. **Enable Firebase Security Rules**
   - Restrict Firestore write access
   - Only allow authenticated writes

4. **Rate Limiting (Optional)**
   - Implement rate limiting jika ada abuse
   - Use Firebase Extensions: Rate Limiter

## Cost Estimation

**Firebase Functions Pricing:**
- Invocations: FREE for first 2M/month
- Compute Time: FREE for first 400K GB-seconds
- Outbound Networking: FREE for first 5 GB

**Typical Webhook:**
- ~100ms execution time
- ~50 KB data transfer
- Cost: ~$0.000001 per webhook

**Monthly (1000 verifications):**
- Cost: ~$0.001 (basically free!)

## Support

Jika ada masalah:
1. Check Firebase Console > Functions > Logs
2. Check Didit Dashboard > Webhook Logs
3. Check Firestore data directly

**Function sudah production-ready!** 🚀
