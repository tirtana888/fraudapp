# 📊 Status Implementasi Credit Deduction

## ✅ Fungsi Core - TERIMPLEMENTASI LENGKAP

### 1. **deductCredit() Function**

**Location:** `/app/services/creditManagement.ts`

**Implementation:**
```typescript
export const deductCredit = async (
  companyId: string,
  amount: number,
  actionType: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE',
  description?: string,
  metadata?: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
  }
): Promise<{ success: boolean; error?: string; remainingCredits?: number }>
```

**Features:**
- ✅ Atomic transaction using Firestore `runTransaction`
- ✅ Credit balance check (sufficient credits)
- ✅ Automatic transaction logging
- ✅ Error handling with friendly messages
- ✅ Metadata support for tracking
- ✅ Returns remaining balance

**How it works:**
```
1. Start transaction
2. Get current company credits
3. Check if credits >= cost
4. If yes: Deduct credits
5. Log transaction to CREDIT_TRANSACTIONS collection
6. Return new balance
7. If no: Return error message
```

## 💰 Credit Costs - DEFINED

**Location:** `/app/types.ts`

```typescript
export const CREDIT_COSTS = {
  KYC_VERIFICATION: 100,      // Background check via Didit
  RESEND_INVITE: 2,           // Resend assessment invite
  UNLOCK_PROFILE: 2           // Unlock candidate contact
} as const;
```

## 📍 Implementation Locations - VERIFIED

### ✅ 1. Unlock Contact (CandidateDetail.tsx)

**When:** User clicks "Unlock Kontak" untuk melihat email/phone
**Cost:** 2 credits
**Implementation:**
```typescript
// Line 248-254
const result = await deductCredit(
  company.id,
  2,
  'UNLOCK_PROFILE',
  `Unlock kontak ${candidate?.candidate.name}`,
  { sessionId, candidateName: candidate?.candidate.name }
);

if (result.success) {
  setIsContactUnlocked(true);
  toast.success('Kontak berhasil dibuka! (2 kredit digunakan)');
} else {
  toast.error(result.error || 'Gagal unlock kontak');
}
```

**User Flow:**
```
User clicks "Unlock Kontak"
    ↓
Check if Premium (skip deduction)
    ↓
If Freemium:
    ↓
Deduct 2 credits
    ↓
Show contact info ✅
```

### ✅ 2. Background Check (CandidateDetail.tsx)

**When:** HR melakukan verifikasi KYC via Didit
**Cost:** 100 credits
**Implementation:**
```typescript
// Line 671
const deductionResult = await deductCredit(
  company.id,
  100,
  'KYC_VERIFICATION',
  `Background check untuk ${candidate?.candidate.name}`
);

if (!deductionResult.success) {
  toast.error(deductionResult.error || 'Kredit tidak cukup');
  return;
}

// Proceed with KYC verification
```

**User Flow:**
```
User clicks "Verifikasi KYC"
    ↓
Deduct 100 credits
    ↓
Call Didit API
    ↓
Show verification result ✅
```

### ✅ 3. Resend Invite - Manual (CandidatesManualInvite.tsx)

**When:** HR re-send assessment invite ke kandidat
**Cost:** 2 credits
**Implementation:**
```typescript
// Line 130
const deductionResult = await deductCredit(
  companyId,
  2,
  'RESEND_INVITE',
  `Resend invite ke ${candidateName}`,
  { candidateId, candidateName }
);

if (deductionResult.success) {
  // Send email invitation
  toast.success('Invitation sent! (2 kredit digunakan)');
} else {
  toast.error(deductionResult.error);
}
```

### ✅ 4. Resend Invite - Blast (CandidateBlast.tsx)

**When:** HR bulk send invites via sourcing
**Cost:** 2 credits per candidate
**Implementation:**
```typescript
// Line 70
const deductionResult = await deductCredit(
  companyId,
  2,
  'RESEND_INVITE',
  `Bulk send invite`,
  { candidateName: candidate.name }
);
```

**User Flow:**
```
Select multiple candidates
    ↓
Click "Send Invites"
    ↓
For each candidate:
    - Deduct 2 credits
    - Send invitation
    ↓
Show total credits used ✅
```

## 📊 Credit Transaction Logging

**Collection:** `credit_transactions`

**Transaction Schema:**
```typescript
{
  companyId: string,
  type: 'debit',
  amount: number,
  action: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE',
  description: string,
  balanceBefore: number,
  balanceAfter: number,
  timestamp: string,
  metadata?: {
    candidateId?: string,
    candidateName?: string,
    sessionId?: string
  }
}
```

**Example Transaction:**
```json
{
  "companyId": "company123",
  "type": "debit",
  "amount": 2,
  "action": "UNLOCK_PROFILE",
  "description": "Unlock kontak John Doe",
  "balanceBefore": 1000,
  "balanceAfter": 998,
  "timestamp": "2024-12-09T01:45:00.000Z",
  "metadata": {
    "sessionId": "session456",
    "candidateName": "John Doe"
  }
}
```

## 🔍 Credit Check Logic

### Premium Users:
```typescript
// No credit deduction
if (company.tier === 'Premium') {
  // Allow action without deduction
  return;
}
```

### Freemium Users:
```typescript
// Check and deduct
const result = await deductCredit(companyId, cost, actionType);

if (!result.success) {
  // Show error: "Kredit tidak cukup"
  return;
}

// Proceed with action
```

## ✅ Features Implemented

### 1. **Atomic Transactions**
- ✅ Uses Firestore `runTransaction`
- ✅ Prevents race conditions
- ✅ Guarantees consistency
- ✅ Rollback on error

### 2. **Balance Validation**
```typescript
if (currentCredits < cost) {
  throw new Error(`Kredit tidak cukup. Dibutuhkan: ${cost}, Tersedia: ${currentCredits}`);
}
```

### 3. **Transaction History**
- ✅ Every deduction logged
- ✅ Tracks balance before/after
- ✅ Stores metadata (candidate, session)
- ✅ Timestamped

### 4. **Error Handling**
```typescript
try {
  const result = await deductCredit(...);
  if (result.success) {
    // Proceed
  } else {
    toast.error(result.error);
  }
} catch (error) {
  toast.error('Terjadi kesalahan');
}
```

### 5. **User Feedback**
- ✅ Success: "Kontak berhasil dibuka! (2 kredit digunakan)"
- ✅ Error: "Kredit tidak cukup. Dibutuhkan: 2, Tersedia: 0"
- ✅ Loading states during deduction

## 📱 UI Integration

### Credit Balance Display:
**Location:** CreditManagementPage.tsx

```tsx
<div className="text-3xl font-bold">
  {creditBalance.toLocaleString()} Credits
</div>
```

### Transaction History:
**Location:** CreditManagementPage.tsx

```tsx
{transactions.map(tx => (
  <div key={tx.id}>
    <span>{tx.description}</span>
    <span className="text-red-600">-{tx.amount}</span>
  </div>
))}
```

### Low Credit Warning:
```tsx
{creditBalance < 10 && (
  <div className="bg-red-50 text-red-600">
    ⚠️ Kredit Anda hampir habis!
  </div>
)}
```

## 🧪 Testing Checklist

### Test 1: Unlock Contact (Freemium)
```
1. Login as Freemium user
2. Go to candidate detail
3. Check credit balance (e.g., 100)
4. Click "Unlock Kontak"
5. Verify:
   ✅ 2 credits deducted
   ✅ New balance: 98
   ✅ Contact info visible
   ✅ Transaction logged
```

### Test 2: Insufficient Credits
```
1. Freemium user with 1 credit
2. Try to unlock contact (needs 2)
3. Verify:
   ✅ Error message shown
   ✅ No deduction
   ✅ Contact still locked
   ✅ No transaction logged
```

### Test 3: Premium User (No Deduction)
```
1. Login as Premium user
2. Unlock contact
3. Verify:
   ✅ No credits deducted
   ✅ Contact unlocked immediately
   ✅ No transaction logged
```

### Test 4: Background Check
```
1. Freemium with 150 credits
2. Click "Verifikasi KYC"
3. Verify:
   ✅ 100 credits deducted
   ✅ New balance: 50
   ✅ KYC verification proceeds
   ✅ Transaction logged
```

### Test 5: Bulk Invite
```
1. Select 5 candidates
2. Bulk send invites
3. Verify:
   ✅ 10 credits deducted (2 × 5)
   ✅ All invites sent
   ✅ 5 transactions logged
```

## ⚠️ Edge Cases Handled

### 1. Race Conditions
```typescript
// Multiple simultaneous deductions
await runTransaction(db, async (transaction) => {
  // Atomic read-modify-write
  // Prevents overselling credits
});
```

### 2. Insufficient Credits
```typescript
if (currentCredits < cost) {
  throw new Error('Kredit tidak cukup');
}
// Prevents negative balance
```

### 3. Missing Company
```typescript
if (!companyDoc.exists()) {
  throw new Error('Company not found');
}
// Prevents deduction from non-existent company
```

### 4. Network Errors
```typescript
try {
  await deductCredit(...);
} catch (error) {
  // Rollback automatic via transaction
  return { success: false, error: error.message };
}
```

## 📊 Credit Flow Summary

```
User Action
    ↓
Check User Tier
    ↓
If Premium → Allow (no deduction)
    ↓
If Freemium:
    ↓
Check Credit Balance
    ↓
If Sufficient:
    - Start Transaction
    - Deduct Credits
    - Log Transaction
    - Commit
    - Proceed with Action ✅
    ↓
If Insufficient:
    - Show Error
    - Block Action ❌
```

## 🎯 Summary

### ✅ Fully Implemented:
1. ✅ Core deduction function
2. ✅ Atomic transactions
3. ✅ Balance validation
4. ✅ Transaction logging
5. ✅ Error handling
6. ✅ UI integration
7. ✅ Premium bypass
8. ✅ User feedback

### 📍 Locations:
1. ✅ Unlock Contact (CandidateDetail.tsx)
2. ✅ Background Check (CandidateDetail.tsx)
3. ✅ Manual Invite (CandidatesManualInvite.tsx)
4. ✅ Bulk Invite (CandidateBlast.tsx)

### 💰 Credit Costs:
1. ✅ KYC Verification: 100 credits
2. ✅ Resend Invite: 2 credits
3. ✅ Unlock Profile: 2 credits

### 🔒 Safety Features:
1. ✅ Atomic transactions (no race conditions)
2. ✅ Balance validation (no negative)
3. ✅ Full audit trail
4. ✅ Rollback on error

---

**Status:** ✅ FULLY IMPLEMENTED & WORKING
**Last Updated:** December 9, 2024
**Priority:** HIGH - Core business logic

**Conclusion:** Credit deduction system sudah terimplementasi dengan lengkap dan robust. Semua aksi yang membutuhkan credit (unlock contact, background check, resend invite) sudah dilengkapi dengan deduction logic, validation, logging, dan error handling yang proper!
