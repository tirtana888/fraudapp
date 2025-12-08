# 🔴 BUG FIX: Duplicate Sessions di Dashboard & Riwayat Audit

## Problem Statement
1 kandidat muncul 2x (duplicate) di:
- Dashboard activity feed
- Riwayat Audit (History View)

Ini menyebabkan data tidak akurat dan membingungkan HR.

## Root Cause Analysis

### Flow Bug Identified:

**Scenario: Kandidat Apply via Job Portal**

1. **Step 1: Job Application**
   - Kandidat apply via public job portal
   - `createApplication` di firebase.ts line 1192
   - Otomatis membuat session via `createInterviewSessionFromApplication` (line 1228)
   - Session #1 dibuat di Firestore ✅
   - Application document di-update dengan `sessionId` (line 1218)

2. **Step 2: Assessment via Access Code**
   - HR generate access code untuk kandidat
   - Kandidat akses assessment via access code
   - `PublicAssessment.tsx` `handleStartChat` (line 177)
   - Code fetch application data (line 263-273)
   - **❌ BUG: Tidak check apakah `appData.sessionId` sudah exists**
   - Code membuat session #2 di line 280 → **DUPLICATE!**

3. **Result:**
   - 2 sessions untuk 1 kandidat di Firestore
   - Dashboard menampilkan 2 entries
   - Riwayat audit menampilkan 2 entries

### Code Issue Location:

**File:** `/app/components/PublicAssessment.tsx`
**Lines:** 258-281

**Before (WRONG):**
```typescript
if (inviteData?.applicationId) {
    sessionData.applicationId = inviteData.applicationId;
    
    // Fetch application data
    const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, inviteData.applicationId));
    if (appDoc.exists()) {
        const appData = appDoc.data();
        // ❌ NO CHECK for existing sessionId!
        if (appData.cvUrl) sessionData.cvUrl = appData.cvUrl;
        if (appData.whatsapp) sessionData.whatsapp = appData.whatsapp;
    }
}

// Always creates new session - DUPLICATE!
const realSessionId = await saveSessionToDB(sessionData);
```

## Solution Implemented

### Fix: Check for Existing Session Before Creating New One

**After (CORRECT):**
```typescript
if (inviteData?.applicationId) {
    sessionData.applicationId = inviteData.applicationId;
    
    const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, inviteData.applicationId));
    if (appDoc.exists()) {
        const appData = appDoc.data();
        
        // ✅ CHECK: If session already exists, use it!
        if (appData.sessionId) {
            console.log('[PUBLIC-ASSESSMENT] ✅ Session already exists:', appData.sessionId);
            console.log('[PUBLIC-ASSESSMENT] Using existing session instead of creating new one');
            
            // Use existing session
            setSessionId(appData.sessionId);
            
            // Update invite status
            if (inviteData?.access_code) {
                await markAccessCodeUsed(inviteData.access_code, 'IN_PROGRESS', appData.sessionId);
            }
            
            // Start chat with existing session
            setChatHistory(initialHistory);
            setTimeLeft(CHAT_TIME_LIMIT_SECONDS);
            setStep('chat');
            return; // Exit early - no duplicate!
        }
        
        // Only add CV/WhatsApp if creating new session
        if (appData.cvUrl) sessionData.cvUrl = appData.cvUrl;
        if (appData.whatsapp) sessionData.whatsapp = appData.whatsapp;
    }
}

// Only create new session if none exists
const realSessionId = await saveSessionToDB(sessionData);
```

### Logic Flow After Fix:

```
┌─────────────────────────────────────┐
│ Kandidat Apply via Job Portal       │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ createApplication()                 │
│ → createInterviewSessionFromApp()   │
│ → Session #1 Created ✅             │
│ → application.sessionId = session1  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ HR Generate Access Code             │
│ Kandidat Access Assessment          │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ PublicAssessment.handleStartChat()  │
│ → Fetch application data            │
│ → Check: appData.sessionId exists?  │
└────────────────┬────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    YES  │               │  NO
         ▼               ▼
┌──────────────┐  ┌──────────────┐
│ Use Existing │  │ Create New   │
│ Session ✅   │  │ Session ✅   │
│ No Duplicate │  │ (Public Link)│
└──────────────┘  └──────────────┘
```

## Expected Behavior After Fix

### Scenario 1: Job Application → Access Code
1. Kandidat apply → Session created (by job application flow)
2. Kandidat access assessment via code → **Reuse existing session** ✅
3. **Result:** 1 session only (no duplicate)

### Scenario 2: Direct Public Link (No Application)
1. Kandidat access assessment directly via public link
2. No existing session → Create new session ✅
3. **Result:** 1 session created

### Scenario 3: Manual Invite via Access Code
1. HR create manual invite with access code
2. Kandidat access assessment → Create new session ✅
3. **Result:** 1 session created

## Testing Checklist

### Manual Testing:

1. **Test Job Application Flow:**
   - ✅ Create job posting
   - ✅ Kandidat apply via public job page
   - ✅ Check Firestore: 1 session created
   - ✅ HR generate access code untuk kandidat ini
   - ✅ Kandidat akses assessment via access code
   - ✅ Check browser console:
     ```
     [PUBLIC-ASSESSMENT] ✅ Session already exists: <session_id>
     [PUBLIC-ASSESSMENT] Using existing session instead of creating new one
     ```
   - ✅ Check Firestore: Still only 1 session
   - ✅ Check Dashboard: Only 1 entry untuk kandidat
   - ✅ Check Riwayat Audit: Only 1 entry untuk kandidat

2. **Test Manual Invite Flow:**
   - ✅ HR create manual invite (no job application)
   - ✅ Kandidat akses via access code
   - ✅ Check: Should create NEW session
   - ✅ Check Dashboard: 1 entry only

3. **Test Public Link Flow:**
   - ✅ Kandidat akses via public company link
   - ✅ Check: Should create NEW session
   - ✅ Check Dashboard: 1 entry only

### Console Logs to Verify:

**When Reusing Existing Session:**
```
[PUBLIC-ASSESSMENT] ✅ Session already exists for application: <session_id>
[PUBLIC-ASSESSMENT] Using existing session instead of creating new one
```

**When Creating New Session:**
```
[PUBLIC-ASSESSMENT] Creating NEW session with source: job_application
[SESSIONS] Interview session created: <new_session_id>
```

## Files Changed

1. ✅ `/app/components/PublicAssessment.tsx` (line 258-295)
   - Added check for existing `appData.sessionId`
   - Early return if session exists
   - Only create new session if none exists

2. ✅ `/app/BUG_FIX_DUPLICATE_SESSIONS.md` (this file)
   - Documentation

## Firestore Data Structure

### Application Document (After Job Apply):
```json
{
  "id": "app_123",
  "jobId": "job_456",
  "sessionId": "session_789",  // ← Set by createApplication
  "fullName": "...",
  "email": "...",
  "cvUrl": "...",
  "createdAt": "..."
}
```

### Session Document:
```json
{
  "id": "session_789",
  "applicationId": "app_123",  // ← Link back to application
  "jobId": "job_456",
  "workflowId": "workflow_xyz",
  "candidate": {...},
  "timeline": [...],
  "status": "active"
}
```

## Impact

**Before Fix:**
- ❌ 2 sessions per job application candidate
- ❌ Duplicate entries di Dashboard
- ❌ Duplicate entries di Riwayat Audit
- ❌ Confusing untuk HR
- ❌ Data tidak akurat

**After Fix:**
- ✅ 1 session per candidate (regardless of flow)
- ✅ Clean Dashboard view
- ✅ Clean Riwayat Audit
- ✅ Accurate data
- ✅ Better user experience

## Status
🟢 **FIXED** - Ready for testing

## Related Issues
- This fix also helps with Issue P1 (Completed candidates tidak muncul) by reducing duplicate data noise
