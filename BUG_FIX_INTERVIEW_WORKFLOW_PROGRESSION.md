# 🔴 BUG FIX: Workflow Buttons Tidak Muncul Setelah Interview

## Problem Statement
Setelah HR menjadwalkan interview untuk kandidat, dynamic workflow buttons tidak muncul dengan benar:
- ❌ Yang seharusnya: Button "Background Check" (next workflow step) muncul
- ❌ Yang terjadi: Button kembali ke "Assessment Integritas" (disabled)
- ❌ Hanya button "Hire" dan "Tolak" yang aktif

## Root Cause Analysis

### Issue Location:
**File:** `/app/components/CandidateDetail.tsx`
**Function:** `handleInterviewInvitation` (Line 465-496)

### The Bug:
Saat interview dijadwalkan, code **menambahkan stage baru** ke timeline instead of **meng-update existing workflow steps**:

```typescript
// ❌ WRONG - Adds new stage 'interview' (not part of workflow)
const updatedTimeline = [
  ...existingTimeline.map(event => ({
    ...event,
    status: event.status === 'current' ? 'completed' : event.status
  })),
  {
    stage: 'interview',  // ← This is NOT a workflow step ID!
    status: 'current',
    date: now,
    note: `...`
  }
];
```

**Why This Breaks:**
1. Timeline punya workflow steps dengan ID seperti: `integrity_assessment`, `interview_step`, `background_check`
2. Code menambahkan stage `'interview'` (generic, bukan workflow step ID)
3. Saat render, button rendering logic filter hanya workflow steps:
   ```typescript
   const workflowTimeline = candidate.timeline?.filter((t: any) => 
     workflowData.steps.some((s: any) => s.id === t.stage)
   ) || [];
   ```
4. Stage `'interview'` tidak match dengan workflow steps → filter gagal
5. Buttons tidak render dengan benar

### Visual Flow (Before Fix):

```
Timeline Structure (After Interview Scheduled):
[
  { stage: 'integrity_assessment', status: 'completed' },  ✅
  { stage: 'interview_step', status: 'pending' },          ❌ Should be 'completed'
  { stage: 'interview', status: 'current' },               ❌ NON-WORKFLOW STAGE!
  { stage: 'background_check', status: 'pending' }         ❌ Should be 'current'
]

Button Rendering:
workflowTimeline = filter hanya workflow steps
→ Finds: integrity_assessment, interview_step, background_check
→ Misses: 'interview' (not in workflow)
→ Current step = interview_step (still pending) ← WRONG!
→ Renders: [Assessment (disabled)] [Hire] [Reject]
```

## Solution Implemented

### Fix Strategy:
**Update existing workflow steps properly** instead of adding new stages.

### New Code (Line 465-515):
```typescript
const existingTimeline = candidate.timeline || [];

// Update timeline properly for workflow progression
const updatedTimeline = existingTimeline.map((event: any) => {
  // Mark current step as completed
  if (event.status === 'current') {
    return {
      ...event,
      status: 'completed' as const,
      completedAt: now,
      note: event.note + ` - Selesai, interview dijadwalkan`
    };
  }
  return event;
});

// Find current step index and set next step as current
const currentStepIndex = existingTimeline.findIndex((t: any) => t.status === 'current');
if (currentStepIndex !== -1 && currentStepIndex + 1 < updatedTimeline.length) {
  const nextStep = updatedTimeline[currentStepIndex + 1];
  updatedTimeline[currentStepIndex + 1] = {
    ...nextStep,
    status: 'current' as const,
    date: now,
    note: nextStep.note || `${nextStep.stage} - Ready to proceed`
  };
}

console.log('[INTERVIEW] ✅ Timeline updated with workflow progression');

// Determine recruitmentStage based on next workflow step
let nextStageId = 'interview';
if (currentStepIndex !== -1 && currentStepIndex + 1 < updatedTimeline.length) {
  nextStageId = updatedTimeline[currentStepIndex + 1].stage;
}

await updateDoc(sessionRef, {
  recruitmentStage: nextStageId,  // ← Set to actual next workflow step
  timeline: updatedTimeline,
  // ... rest
});
```

### Visual Flow (After Fix):

```
Timeline Structure (After Interview Scheduled):
[
  { stage: 'integrity_assessment', status: 'completed' },  ✅
  { stage: 'interview_step', status: 'completed' },        ✅ Marked completed!
  { stage: 'background_check', status: 'current' },        ✅ Set to current!
  { stage: 'document_check', status: 'pending' }           ✅
]

Button Rendering:
workflowTimeline = filter workflow steps
→ Finds: integrity_assessment, interview_step, background_check, ...
→ Current step = background_check ✅
→ Next step = document_check (disabled) ✅
→ Renders: [📊 Activity] [Background Check ✓] [⏰ Document Check] | [✅ Hire] [❌ Reject]
            ↑ completed        ↑ clickable           ↑ disabled (next)
```

## Expected Behavior After Fix

### Flow Setelah Interview Dijadwalkan:

1. **HR Schedule Interview:**
   - Open interview modal
   - Fill date, time, location/link
   - Click "Kirim Undangan"

2. **System Updates Timeline:**
   - ✅ Mark current workflow step → `completed`
   - ✅ Set next workflow step → `current`
   - ✅ Email sent to candidate (best effort)
   - ✅ Save interview schedule details

3. **CandidateDetail Page Reloads:**
   - ✅ Fetch updated timeline
   - ✅ Load workflow data
   - ✅ Render dynamic buttons based on workflow

4. **Buttons Display:**
   ```
   [📊 Activity View] [Background Check ✓] [⏰ Next Step] | [✅ Rekrut] [❌ Tolak]
   ```

## Console Logs for Debugging

### Expected Logs After Interview Scheduled:
```
[INTERVIEW] Attempting to send email invitation...
[INTERVIEW] ✅ Email sent successfully
[INTERVIEW] ✅ Timeline updated with workflow progression
[INTERVIEW] Current completed, next step set to current

[CANDIDATE] Session workflowId: <workflow_id>
[CANDIDATE] ✅ Loaded workflow: Standard Hiring with 5 steps
[BUTTONS] Using workflow buttons. Steps: Assessment, Interview, Background Check, Document Check, Hire
[BUTTONS] Workflow timeline: integrity_assessment:completed, interview_step:completed, background_check:current, document_check:pending, hire:pending
[BUTTONS] Current step: background_check
[BUTTONS] Next step: document_check (disabled)
```

## Testing Checklist

### Manual Testing:

1. **Scenario: Interview Scheduled After Assessment**
   - ✅ Kandidat complete assessment
   - ✅ HR opens candidate detail
   - ✅ Click "Wawancara" button (or workflow step button for interview)
   - ✅ Fill interview modal with:
     - Date: [e.g., 2025-01-15]
     - Time: [e.g., 14:00]
     - Type: Online/Offline
     - Location/Link: [e.g., Zoom link or office address]
   - ✅ Click "Kirim Undangan"

2. **Expected Results:**
   - ✅ Toast: "Undangan wawancara berhasil dikirim"
   - ✅ Modal closes
   - ✅ Page reloads with updated data
   - ✅ Check browser console for logs (see above)
   - ✅ Buttons display correctly:
     ```
     [📊] [Background Check ✓] [⏰ Next Step] | [✅ Hire] [❌ Reject]
     ```

3. **Verify Firestore Data:**
   - ✅ Check session document:
     ```json
     {
       "recruitmentStage": "background_check",  // ← Next workflow step ID
       "timeline": [
         {"stage": "integrity_assessment", "status": "completed"},
         {"stage": "interview_step", "status": "completed"},
         {"stage": "background_check", "status": "current"},  // ← Current!
         {"stage": "document_check", "status": "pending"}
       ],
       "interviewSchedule": {
         "type": "online",
         "date": "2025-01-15",
         "time": "14:00",
         "link": "https://zoom.us/...",
         "scheduledAt": "..."
       }
     }
     ```

4. **Click Background Check Button:**
   - ✅ Should work (no error 500)
   - ✅ Updates timeline properly
   - ✅ Next button appears

## Files Changed

1. ✅ `/app/components/CandidateDetail.tsx` (Line 465-515)
   - Fixed `handleInterviewInvitation` to update workflow steps properly
   - Mark current → completed
   - Set next → current
   - Determine `recruitmentStage` from next workflow step

2. ✅ `/app/BUG_FIX_INTERVIEW_WORKFLOW_PROGRESSION.md` (this file)

## Related Bug Fixes

This fix is part of a series of workflow button bugs:
1. **Bug #1:** workflowId not set during session creation → Fixed ✅
2. **Bug #2:** Timeline with non-workflow stages during assessment completion → Fixed ✅
3. **Bug #3:** Duplicate sessions for job applications → Fixed ✅
4. **Bug #4:** Email Cloud Functions blocking workflow → Fixed ✅
5. **Bug #5:** Interview not progressing workflow (THIS FIX) → Fixed ✅

## Impact

**Before Fix:**
- ❌ Workflow stuck after interview
- ❌ Cannot progress to background check
- ❌ Buttons show incorrect state
- ❌ HR confused about candidate status

**After Fix:**
- ✅ Workflow progresses smoothly
- ✅ Next step button appears correctly
- ✅ Timeline accurate
- ✅ HR can continue recruitment process

## Status
🟢 **FIXED** - Ready for testing

## Next Steps

After this fix, test complete workflow flow:
1. Assessment → Interview → Background Check → Document Check → Hire
2. Verify each step progresses correctly
3. Verify buttons always show correct state

If any other workflow step has similar issue, apply same fix pattern.
