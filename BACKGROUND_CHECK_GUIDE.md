# Background Check Integration Guide

## Overview
Implementasi lengkap untuk flow Background Check menggunakan Didit KYC verification dengan email notification.

## Features Implemented

### 1. Email Template
- **Congratulations email** dengan desain professional
- Header hijau celebration theme
- Instruksi step-by-step verifikasi
- Link ke Didit KYC verification
- Security & privacy information

### 2. Firebase Function: `initiateBackgroundCheck`
Function ini akan:
- ✅ Get data kandidat dari Firestore
- ✅ Get data perusahaan dari Firestore
- ✅ Create Didit verification session
- ✅ Send email dengan verification link
- ✅ Update candidate status ke `bc_check`
- ✅ Return verification link & session ID

### 3. Frontend Integration
`CandidateDetail.tsx` sudah terintegrasi:
- ✅ Call function ketika klik "Cek Latar"
- ✅ Validasi tier (Premium/Enterprise only)
- ✅ Validasi workflow (must come from Interview stage)
- ✅ Show success/error toast
- ✅ Auto refresh candidate data

## Deployment

### Step 1: Deploy Function
```bash
cd functions
npm install
cd ..
firebase deploy --only functions:initiateBackgroundCheck
```

Atau gunakan script:
```bash
bash DEPLOY_BACKGROUND_CHECK.sh
```

### Step 2: Deploy Firestore Indexes (jika belum)
```bash
firebase deploy --only firestore:indexes
```

## How It Works

### User Flow
1. HR opens candidate detail page
2. HR clicks "Cek Latar" button
3. System validates:
   - Company tier (Premium/Enterprise)
   - Current recruitment stage (must be Interview)
4. System triggers `initiateBackgroundCheck` function
5. Function creates Didit session & sends email
6. Candidate receives email with verification link
7. Candidate completes KYC on Didit platform
8. Didit webhook updates status automatically

### Email Content
**Subject:** 🎉 Congratulations! Next Step: Background Check - {Company Name}

**Content:**
- Congratulations message
- Next steps explanation
- Process verification steps (5 steps)
- Security & privacy info
- Important notes
- CTA button "Mulai Verifikasi Sekarang"

### Didit Integration
**Workflow ID:** `f6eb1a67-47c4-4668-960a-1baab821f388`

**Metadata sent:**
- candidate_name
- candidate_email
- session_id
- company_id

**Callback URL:**
`https://tirtana888-fraudguar-68hf.bolt.host/background-check-callback`

## Testing

### 1. Test Email Sending
1. Navigate to candidate detail
2. Click "Cek Latar" button
3. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only initiateBackgroundCheck
   ```
4. Verify email received in candidate inbox

### 2. Test Didit Integration
1. Click verification link in email
2. Complete KYC steps:
   - Document upload (KTP/SIM/Passport)
   - Selfie with liveness detection
   - Confirmation
3. Check webhook callback updates status

### 3. Test Status Updates
1. After verification complete
2. Check candidate status updated to:
   - `backgroundCheck.status`: "completed"
   - `backgroundCheck.decision`: "approved" / "rejected"
3. Timeline should show new entry

## Troubleshooting

### CORS Error
**Error:** `No 'Access-Control-Allow-Origin' header`

**Solution:** Function sudah include `cors: true`. Pastikan deploy ulang function.

### Email Not Sent
**Check:**
1. RESEND_API_KEY configured: `firebase functions:config:get`
2. Email sender domain verified di Resend
3. Function logs: `firebase functions:log`

### Didit Session Failed
**Check:**
1. DIDIT_API_KEY configured
2. Workflow ID correct: `f6eb1a67-47c4-4668-960a-1baab821f388`
3. Callback URL accessible

### Status Not Updated
**Check:**
1. Webhook endpoint accessible
2. DIDIT_WEBHOOK_SECRET configured
3. Webhook logs in Firebase Functions

## File Changes

### Modified Files
1. `functions/index.js`
   - Added email template: `backgroundCheckInvitation`
   - Added function: `initiateBackgroundCheck`

2. `components/CandidateDetail.tsx`
   - Updated: `handleStatusUpdate()` to call function

### New Files
1. `BACKGROUND_CHECK_GUIDE.md` (this file)
2. `DEPLOY_BACKGROUND_CHECK.sh` (deployment script)

## Security Notes

1. **Data Encryption:** All data sent to Didit is encrypted
2. **One-time Link:** Verification link valid for single use
3. **Liveness Detection:** AI-powered fraud prevention
4. **Webhook Validation:** Signature verification required
5. **Access Control:** Only Premium/Enterprise tiers

## API Endpoints

### Function: `initiateBackgroundCheck`
**Region:** europe-west1
**Method:** HTTPS Callable
**Auth:** Required

**Request:**
```json
{
  "sessionId": "session_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Background check email sent successfully",
  "verificationLink": "https://verification.didit.me/...",
  "diditSessionId": "didit_session_id"
}
```

**Errors:**
- `invalid-argument`: Session ID missing
- `not-found`: Session/Company not found
- `failed-precondition`: Incomplete candidate data
- `internal`: Didit API or email sending failed

## Next Steps

1. ✅ Deploy function
2. ✅ Test with real candidate
3. Monitor webhook callbacks
4. Setup email monitoring in Resend dashboard
5. Configure Didit dashboard for verification settings

## Support

For issues:
1. Check Firebase Functions logs
2. Check Resend email logs
3. Check Didit dashboard
4. Review this guide for troubleshooting steps
