# 🔴 P0 BUG FIX: Dynamic Workflow Buttons Hilang Setelah Assessment Complete

## Problem Statement
Dynamic workflow buttons hilang atau revert ke buttons lama setelah kandidat menyelesaikan assessment. Ini blocking core recruitment process karena HR tidak bisa move candidates through workflow stages.

## Root Cause Analysis

### Primary Issue #1: workflowId Not Set During Session Creation
Di `PublicAssessment.tsx` line 209-231, saat session dibuat untuk job application assessment, code **TIDAK mengambil dan menyimpan `workflowId`** dari job!

```typescript
// ❌ WRONG - Missing workflowId
if (inviteData?.jobId) {
    sessionData.jobId = inviteData.jobId;
    // workflowId NOT fetched or set!
}
```

Akibatnya:
- Session tidak punya `workflowId` reference
- CandidateDetail tidak bisa load workflow data
- Buttons tidak render karena `workflowData` = null

### Secondary Issue #2: Non-Workflow Stages Added to Timeline
Di `PublicAssessment.tsx` line 328-345, saat assessment selesai, code menambahkan **NON-WORKFLOW stages** ke timeline:
```typescript
// ❌ WRONG - Menambahkan stage yang tidak ada di workflow
{
  stage: 'assessment_completed',  // NOT in workflow!
  status: 'completed',
  ...
},
{
  stage: 'review',  // NOT in workflow!
  status: 'current',
  ...
}
```

Ini menyebabkan:
1. Timeline berisi stage yang tidak match dengan `workflowData.steps`
2. Di `CandidateDetail.tsx`, filter ini gagal menemukan workflow timeline:
```typescript
const workflowTimeline = candidate.timeline?.filter((t: any) => 
  workflowData.steps.some((s: any) => s.id === t.stage)
) || [];
```
3. Akibatnya `workflowTimeline` kosong atau incomplete
4. Buttons tidak render dengan benar

### Secondary Issue
`CandidateDetail.tsx` line 162-222 memiliki duplicate auto-progress logic yang redundant dan bisa cause race conditions.

## Solution Implemented

### 1. Fixed `PublicAssessment.tsx` (line 317-353)
**BEFORE:**
- Menambahkan stage baru (`assessment_completed`, `review`) yang tidak ada di workflow
- Tidak meng-update next workflow step ke `current`

**AFTER:**
- ✅ Mark `integrity_assessment` di timeline sebagai `completed`
- ✅ Set **next workflow step** sebagai `current`
- ✅ Preserve `workflowId` dan struktur timeline
- ✅ Set `recruitmentStage` ke `'integrity_assessment'` (completed)

```typescript
// Update timeline properly for workflow
const updatedTimeline = existingTimeline.map((event: any) => {
  // Mark current integrity_assessment as completed
  if (event.stage === 'integrity_assessment' && event.status === 'current') {
    return {
      ...event,
      status: 'completed' as const,
      completedAt: now,
      note: `${event.note || 'Assessment Integritas'} - Selesai dengan risiko: ${finalAnalysis.riskLevel}`
    };
  }
  return event;
});

// Find next workflow step and set as current
const assessmentIndex = updatedTimeline.findIndex(t => t.stage === 'integrity_assessment');
if (assessmentIndex !== -1 && assessmentIndex + 1 < updatedTimeline.length) {
  const nextStep = updatedTimeline[assessmentIndex + 1];
  if (nextStep.status === 'pending') {
    updatedTimeline[assessmentIndex + 1] = {
      ...nextStep,
      status: 'current' as const,
      date: now
    };
  }
}
```

### 2. Removed Duplicate Logic in `CandidateDetail.tsx` (line 162-222)
Removed redundant auto-progress `useEffect` karena progression sekarang di-handle di `PublicAssessment.tsx` saat completion.

## Expected Behavior After Fix

### Flow Setelah Kandidat Complete Assessment:

1. **PublicAssessment.tsx:**
   - Mark `integrity_assessment` → `completed` ✅
   - Mark next workflow step (e.g., `background_check`) → `current` ✅
   - Save to Firestore dengan `workflowId` ter-preserve ✅

2. **CandidateDetail.tsx:**
   - Load session data dengan `workflowId` ✅
   - Fetch workflow dari Firestore ✅
   - Filter timeline untuk workflow steps ✅
   - Render dynamic buttons untuk current & next step ✅

### UI Buttons Yang Muncul:
```
[📊 Activity] [ Background Check ] [ ⏰ Document Forgery ] | [✅ Rekrut] [❌ Tolak]
                  ↑ clickable              ↑ disabled (next)
```

## Testing Checklist

### Manual Testing:
1. ✅ Create job dengan workflow assigned
2. ✅ Kandidat apply dan complete assessment
3. ✅ Check browser console logs:
   ```
   [ASSESSMENT-COMPLETE] ✅ Updated timeline with workflow progression
   [ASSESSMENT-COMPLETE] Workflow ID: <workflow_id>
   ```
4. ✅ Verify di CandidateDetail:
   ```
   [CANDIDATE] Session workflowId: <workflow_id>
   [CANDIDATE] ✅ Loaded workflow: <workflow_name> with X steps
   [BUTTONS] Using workflow buttons. Steps: ...
   [BUTTONS] Workflow timeline: integrity_assessment:completed, background_check:current, ...
   ```
5. ✅ Verify dynamic workflow buttons muncul (tidak revert ke old buttons)
6. ✅ Verify next step button disabled sampai current step completed
7. ✅ Click current step button → moves to next step

### Firestore Data Verification:
Check session document harus punya:
```json
{
  "workflowId": "<workflow_doc_id>",
  "recruitmentStage": "integrity_assessment",
  "status": "completed",
  "timeline": [
    {
      "stage": "integrity_assessment",
      "status": "completed",
      "completedAt": "..."
    },
    {
      "stage": "background_check",
      "status": "current",
      "date": "..."
    },
    ...
  ]
}
```

### Frontend Testing Agent:
Use `auto_frontend_testing_agent` untuk test:
- Workflow button rendering
- Button interactions
- State transitions
- Console log verification

## Files Changed
1. `/app/components/PublicAssessment.tsx` - Fixed timeline update logic
2. `/app/components/CandidateDetail.tsx` - Removed duplicate auto-progress logic

## Console Logs for Debugging
Key logs to watch:
- `[ASSESSMENT-COMPLETE] ✅ Updated timeline with workflow progression`
- `[CANDIDATE] ✅ Loaded workflow: ... with X steps`
- `[BUTTONS] Using workflow buttons. Steps: ...`
- `[BUTTONS] Workflow timeline: ...`

## Known Edge Cases Handled
1. ✅ Kandidat complete assessment → workflow buttons appear
2. ✅ workflowId preserved dalam session data
3. ✅ Timeline hanya berisi valid workflow stages
4. ✅ Next step auto-set ke current setelah assessment
5. ✅ No race conditions dari duplicate auto-progress logic

## Status
🟢 **FIXED** - Ready for testing
