# FraudGuard SaaS - Product Specification Document
## For Whitebox Testing

**Version:** 1.0  
**Last Updated:** 2025-12-12  
**Document Type:** Technical Specification for Testing

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Core Features & Modules](#3-core-features--modules)
4. [Data Models](#4-data-models)
5. [API Endpoints & Cloud Functions](#5-api-endpoints--cloud-functions)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Business Logic & Workflows](#7-business-logic--workflows)
8. [Integration Points](#8-integration-points)
9. [Credit System](#9-credit-system)
10. [Testing Considerations](#10-testing-considerations)

---

## 1. Executive Summary

### 1.1 Product Overview
FraudGuard is a multi-tenant SaaS platform that helps companies detect fraud risks in job candidates using AI-powered interviews and the Fraud Triangle framework (Pressure, Opportunity, Rationalization).

### 1.2 Technology Stack
- **Frontend:** React 18.2, TypeScript, Vite 5.1, Tailwind CSS
- **Backend:** Firebase Cloud Functions (Node.js 18+)
- **Database:** Firebase Firestore (NoSQL)
- **Storage:** Firebase Cloud Storage
- **AI/ML:** Google Gemini 1.5 Flash, Mistral AI
- **Authentication:** Firebase Authentication
- **Email:** Resend API
- **Payment:** Xendit Integration
- **KYC:** Didit Integration

### 1.3 Deployment
- **Hosting:** Firebase Hosting
- **Region:** europe-west1
- **Port:** 3000 (development), 8080 (production preview)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │Candidates│  │  Jobs    │  │ Settings │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer (TS)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Firebase  │  │  Auth    │  │  GenAI   │  │  Credit  │   │
│  │ Service  │  │ Service  │  │ Service  │  │Management│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Node.js)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ generateAI   │  │ parseCVWith  │  │ analyzeFraud │      │
│  │ Response     │  │ Mistral      │  │ Risk         │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ sendEmail    │  │ diditWebhook │  │ createDidit  │      │
│  │              │  │              │  │ Session      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer (Firebase)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Firestore   │  │   Storage    │  │     Auth     │      │
│  │  (Database)  │  │   (Files)    │  │   (Users)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Structure

**Frontend Components (36 total):**
- `App.tsx` - Main application orchestrator
- `Dashboard.tsx` - Executive summary view
- `ActiveInterview.tsx` - AI interview interface
- `CandidateDetail.tsx` - Detailed candidate profile (158KB - largest component)
- `CandidatesAutoView.tsx` - Instant assessment candidates
- `CandidatesManualInvite.tsx` - Manual invitation management
- `JobManager.tsx` - Job posting management
- `WorkflowManager.tsx` - Recruitment workflow configuration
- `AdminDashboard.tsx` - Super admin panel
- `AssessmentSettings.tsx` - Assessment link configuration
- `BackgroundCheckCallback.tsx` - KYC callback handler
- `CreditManagementPage.tsx` - Credit purchase and management
- `LoginPage.tsx` / `SignUpPage.tsx` - Authentication
- `PublicAssessment.tsx` - Public assessment interface
- `PublicJobPage.tsx` / `PublicCareerPage.tsx` - Public job portal
- And 20+ additional components

**Backend Services (7 files):**
- `firebase.ts` (58KB) - Main Firebase integration
- `creditManagement.ts` (14KB) - Credit system logic
- `genai.ts` - AI integration
- `didit.ts` - KYC integration
- `xenditIntegration.ts` - Payment processing
- `auth.ts` - Authentication helpers

---

## 3. Core Features & Modules

### 3.1 Multi-Tenant System

**Company Isolation:**
- Each company has unique `companyId`
- Data filtered by `companyId` in all queries
- Company-specific branding (logo, colors, messages)
- Company slug for public URLs

**User Roles:**
- `superadmin` - System administrator (full access)
- `System Admin` - Company administrator
- `Company Admin` - Company administrator
- `User` - Regular HR user
- `Lead Investigator` - Fraud investigation specialist

### 3.2 Job Portal & Application System

**Job Management:**
- Create/edit/delete job postings
- Job status: Active / Closed
- Job types: Full-time, Part-time, Contract, Internship
- Public career page: `/careers/{companySlug}`
- Public job page: `/jobs/{companySlug}/{jobSlug}`
- Instant assessment toggle per job

**Application Flow:**
1. Candidate applies via public job page
2. CV uploaded to Firebase Storage
3. `JobApplication` document created
4. If instant assessment enabled → auto-create `InterviewSession`
5. Assessment invite sent via email
6. Candidate completes assessment
7. HR reviews in dashboard

### 3.3 AI Interview System

**Interview Types:**
1. **Integrity Assessment** - Fraud Triangle questionnaire + AI chatbot
2. **Skill Interview** - Technical assessment (Coming Soon)
3. **Live Proctoring** - Real-time monitoring (Coming Soon)

**AI Chatbot Implementation:**
- **Primary Model:** Google Gemini 1.5 Flash
- **Fallback:** Static responses if API fails
- **Technique:** STAR method (Situation, Task, Action, Result)
- **Language:** Bahasa Indonesia
- **Probing:** Deep questioning on inconsistencies

**Interview Session States:**
- `active` - In progress
- `completed` - Finished, awaiting review
- `pending_review` - Ready for HR review

### 3.4 Fraud Detection Engine

**Fraud Triangle Framework:**
- **Pressure** (0-100): Financial strain, personal issues
- **Opportunity** (0-100): Access to assets, weak controls
- **Rationalization** (0-100): Justification patterns

**Risk Levels:**
- `LOW` - Safe to hire
- `MEDIUM` - Requires investigation
- `HIGH` - High risk, recommend rejection
- `CRITICAL` - Immediate red flags

**Analysis Components:**
1. Structured assessment (Likert scale 1-5)
2. Situational Judgment Test (SJT)
3. AI transcript analysis
4. Consistency scoring
5. Euphemism detection
6. Sentiment analysis

### 3.5 Recruitment Workflow System

**Workflow Steps:**
1. **Integrity Assessment** (0 credits) - Mandatory/Optional
2. **Skill Interview** (5 credits) - Coming Soon
3. **Live Proctoring** (5 credits) - Coming Soon
4. **Face-to-Face Interview** (0 credits) - Manual
5. **Background Check** (50 credits) - KYC via Didit
6. **Document Forgery Detection** (50 credits) - Coming Soon
7. **Social Media Screening** (50 credits) - Coming Soon
8. **Hire Decision** (0 credits) - Final step
9. **Reject Decision** (0 credits) - Final step

**Workflow Assignment:**
- Workflows assigned to jobs
- Steps tracked per candidate
- Status: pending → in_progress → completed → skipped

### 3.6 KYC / Background Check (Didit Integration)

**Process Flow:**
1. HR initiates background check
2. System deducts 100 credits
3. Creates Didit session via API
4. Sends verification link to candidate
5. Candidate completes KYC (ID scan, selfie, liveness)
6. Didit webhook sends results
7. System stores KYC data in Firestore

**KYC Data Captured:**
- Personal info (name, DOB, gender, nationality)
- Document info (type, number, expiry)
- Address
- Portrait image (base64)
- Document images (front/back, base64)
- Verification status
- Face match confidence
- Warnings and flags

**Background Check Statuses:**
- `pending` - Initiated, waiting for candidate
- `in_progress` - Candidate started verification
- `approved` - Passed verification
- `declined` - Failed verification
- `in_review` - Manual review required

### 3.7 Credit System

**Subscription Tiers:**

| Feature | Freemium | Premium |
|---------|----------|---------|
| Price | Rp 0 | Rp 150,000/month |
| Initial Credits | 1,000 | 0 |
| Monthly Credits | 0 | 1,500 |
| Candidate View Limit | 10 | Unlimited |
| Job Posting | Unlimited | Unlimited |
| Logo Upload | ✓ | ✓ |
| Career Page | ✓ | ✓ |

**Credit Costs:**
- KYC Verification: 100 credits
- Resend Invite: 2 credits
- Unlock Profile: 2 credits

**Credit Conversion:**
- 1 Credit = Rp 100
- 1,000 Credits = Rp 100,000

**Transaction Types:**
- `debit` - Credit used
- `credit` - Credit added

**Transaction Actions:**
- `KYC_VERIFICATION`
- `RESEND_INVITE`
- `UNLOCK_PROFILE`
- `TOP_UP`
- `SUBSCRIPTION`
- `INITIAL_CREDIT`
- `MONTHLY_REFILL`

### 3.8 Email System

**Email Templates (via Resend):**
1. **Candidate Invitation** - Assessment invite with access code
2. **Interview Invitation** - Scheduled interview details

**Email Data:**
- From: `noreply@hiregood.one`
- HTML templates with company branding
- Variables: candidateName, companyName, role, accessCode, assessmentLink, etc.

### 3.9 CV Parsing (Mistral AI)

**Process:**
1. Download CV from Firebase Storage
2. Extract text from PDF using `pdf-parse`
3. Send to Mistral AI Large model
4. Parse JSON response
5. Store in `cvParsedData` field

**Extracted Data:**
- Full name, email, phone, address
- Professional summary
- Work experience (title, company, duration, description)
- Education (degree, institution, year)
- Skills, certifications, languages

---

## 4. Data Models

### 4.1 Core Collections

#### `companies`
```typescript
{
  id: string;
  name: string;
  tier: 'Freemium' | 'Premium';
  status: 'Active' | 'Pending' | 'Suspended' | 'Past Due';
  adminEmail: string;
  joinedDate: string;
  credits: number;
  logoUrl?: string;
  brandColor?: string;
  headerTitle?: string;
  welcomeMessage?: string;
  subscription_ends_at?: string;
  custom_candidate_limit?: number;
  verification_credits?: number;
  companySlug?: string;
  whatsapp?: string;
  address?: string;
}
```

#### `users`
```typescript
{
  id: string;
  name: string;
  role: 'System Admin' | 'Company Admin' | 'User' | 'Lead Investigator' | 'superadmin';
  email: string;
  companyId?: string;
  emailVerified?: boolean;
  createdAt: Timestamp;
}
```

#### `interview_sessions`
```typescript
{
  id: string;
  candidate: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  date: string;
  status: 'active' | 'completed' | 'pending_review';
  companyId: string;
  source?: string;
  jobId?: string;
  applicationId?: string;
  cvUrl?: string;
  cvParsedData?: ParsedCVData;
  whatsapp?: string;
  recruitmentStage?: string;
  
  // Assessment data
  structuredAssessment?: AssessmentItem[];
  sjtResults?: SJTItem[];
  financialStrainResults?: AssessmentItem[];
  transcript: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>;
  
  // Analysis results
  analysis?: {
    scores: {
      pressure: number; // 0-100
      opportunity: number; // 0-100
      rationalization: number; // 0-100
    };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    redFlags: string[];
    recommendation: string;
    consistencyScore?: number;
    euphemismScore?: number;
    euphemismDetected?: string[];
    sentimentBreakdown?: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  
  // Workflow tracking
  timeline?: Array<{
    stage: string;
    status: 'completed' | 'current' | 'pending';
    date?: string;
    note?: string;
  }>;
  
  // Background check
  backgroundCheck?: {
    status?: 'pending' | 'in_progress' | 'approved' | 'declined' | 'in_review';
    diditSessionId?: string;
    decision?: string;
    verificationLink?: string;
    createdAt?: Timestamp;
    lastUpdated?: Timestamp;
    kycData?: KYCData;
    rawWebhookData?: any;
  };
}
```

#### `assessment_invites`
```typescript
{
  id: string;
  access_code: string;
  email: string;
  name: string;
  role?: string;
  companyId: string;
  status: 'PENDING' | 'ACCESSING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  createdAt: string;
  accessedAt?: string;
  startedAt?: string;
  completedAt?: string;
  sessionId?: string;
  jobId?: string;
  applicationId?: string;
}
```

#### `jobs`
```typescript
{
  id: string;
  companyId: string;
  slug: string;
  title: string;
  location: string;
  jobType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  description: string;
  status: 'Active' | 'Closed';
  enableInstantAssessment: boolean;
  workflowId?: string;
  datePosted: string;
  applicantsCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `job_applications`
```typescript
{
  id: string;
  jobId: string;
  companyId: string;
  fullName: string;
  email: string;
  whatsapp: string;
  cvUrl: string;
  status: 'Pending' | 'Reviewed' | 'Shortlisted' | 'Rejected';
  assessmentToken?: string;
  sessionId?: string;
  appliedAt: string;
  createdAt: Timestamp;
}
```

#### `workflows`
```typescript
{
  id: string;
  name: string;
  description: string;
  companyId: string;
  steps: Array<{
    id: string;
    name: string;
    description: string;
    credits: number;
    isMandatory: boolean;
    isEnabled: boolean;
    order: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
    completedAt?: string;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalCredits: number;
}
```

#### `credit_transactions`
```typescript
{
  id: string;
  companyId: string;
  type: 'debit' | 'credit';
  amount: number;
  action: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE' | 'TOP_UP' | 'SUBSCRIPTION' | 'INITIAL_CREDIT' | 'MONTHLY_REFILL';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
  metadata?: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
    paymentId?: string;
    invoiceId?: string;
  };
}
```

---

## 5. API Endpoints & Cloud Functions

### 5.1 Firebase Cloud Functions

All functions deployed to `europe-west1` region.

#### `parseCVWithMistral`
- **Type:** HTTPS Callable
- **Timeout:** 540s
- **Memory:** 1GB
- **Input:** `{ cvUrl: string, sessionId: string }`
- **Output:** `{ success: boolean, parsedData: ParsedCVData }`
- **Process:**
  1. Download CV from Firebase Storage
  2. Extract text using pdf-parse
  3. Call Mistral AI Large model
  4. Parse JSON response
  5. Update session document

#### `generateAIResponse`
- **Type:** HTTPS Callable
- **Timeout:** 60s
- **Memory:** 1GB
- **Input:** `{ role: string, message: string, history: Array, candidateData: object }`
- **Output:** `{ success: boolean, response: string, model: string }`
- **AI Model:** Gemini 1.5 Flash
- **Technique:** STAR method, behavioral questions
- **Language:** Bahasa Indonesia

#### `analyzeFraudRisk`
- **Type:** HTTPS Callable
- **Timeout:** 60s
- **Memory:** 1GB
- **Input:** `{ role: string, transcript: Array, ftAnswers: Array }`
- **Output:** Fraud analysis JSON
- **AI Model:** Gemini 1.5 Flash
- **Framework:** Fraud Triangle

#### `sendEmail`
- **Type:** HTTPS Callable
- **Timeout:** 60s
- **Input:** `{ templateId: string, to: string, variables: object }`
- **Output:** `{ success: boolean }`
- **Service:** Resend API
- **Templates:** candidate_invitation, interview_invitation

#### `diditWebhook`
- **Type:** HTTPS Request
- **Method:** POST
- **Path:** `/diditWebhook`
- **Purpose:** Receive KYC results from Didit
- **Signature Verification:** HMAC SHA-256

#### `createDiditSession`
- **Type:** HTTPS Callable
- **Purpose:** Create KYC session with Didit API

#### `initiateBackgroundCheck`
- **Type:** HTTPS Callable
- **Purpose:** Start background check process
- **Credit Deduction:** 100 credits

### 5.2 Frontend API Calls

**Firebase Service Methods:**
- `subscribeToSessions()` - Real-time session updates
- `subscribeToInvites()` - Real-time invite updates
- `getCompanyById()` - Fetch company profile
- `observeAuthState()` - Auth state listener
- `logoutFromFirebase()` - Sign out

**Credit Management:**
- `getCreditBalance()` - Fetch current balance
- `deductCredits()` - Deduct credits with transaction log
- `addCredits()` - Add credits (top-up)

**Didit Integration:**
- `initiateBackgroundCheck()` - Start KYC
- `getKYCData()` - Fetch KYC results

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

**Firebase Authentication:**
1. User enters email/password
2. Firebase Auth validates credentials
3. `observeAuthState()` listener fires
4. User profile fetched from Firestore `/users/{uid}`
5. Session saved to localStorage (backward compatibility)
6. Company profile loaded via `companyId`

**Email Verification:**
- Required for new signups
- Verification banner shown if `emailVerified === false`
- Verification link sent via Firebase Auth

### 6.2 Authorization Rules

**Firestore Security Rules:**
```javascript
// Companies: Only company members can read/write
match /companies/{companyId} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
}

// Sessions: Company-scoped access
match /interview_sessions/{sessionId} {
  allow read, write: if request.auth != null && 
    resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
}

// Superadmin: Full access
match /{document=**} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
}
```

**Storage Rules:**
```javascript
// CV uploads: Company-scoped
match /cvs/{companyId}/{fileName} {
  allow read, write: if request.auth != null && 
    request.auth.token.companyId == companyId;
}

// Company logos: Public read, company write
match /company_logos/{companyId}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null && 
    request.auth.token.companyId == companyId;
}
```

### 6.3 Public Access

**Public Routes (No Auth Required):**
- `/careers/{companySlug}` - Career page
- `/jobs/{companySlug}/{jobSlug}` - Job detail
- `/?mode=assess&cid={companyId}` - Public assessment
- `/background-check-callback` - KYC callback

**Access Code System:**
- 6-character alphanumeric code
- Stored in `assessment_invites` collection
- Validates candidate access to assessment

---

## 7. Business Logic & Workflows

### 7.1 Candidate Lifecycle

```
1. Application Received
   ↓
2. CV Parsing (Mistral AI)
   ↓
3. Assessment Invitation Sent
   ↓
4. Candidate Accesses Assessment
   ↓
5. Integrity Assessment (Fraud Triangle)
   ↓
6. AI Chatbot Interview
   ↓
7. Fraud Risk Analysis (Gemini)
   ↓
8. HR Reviews Results
   ↓
9. Workflow Steps (Optional)
   - Background Check (KYC)
   - Face-to-Face Interview
   - Skill Assessment
   ↓
10. Final Decision (Hire/Reject)
```

### 7.2 Credit Deduction Logic

**Automatic Deductions:**
1. **KYC Verification** (100 credits)
   - Triggered when HR clicks "Initiate Background Check"
   - Transaction logged before API call
   - If API fails, credits NOT refunded (design decision)

2. **Resend Invite** (2 credits)
   - Triggered when HR resends assessment invite
   - New access code generated

3. **Unlock Profile** (2 credits)
   - Freemium tier can view 10 candidates
   - Unlocking beyond limit costs credits

**Credit Validation:**
```typescript
if (company.credits < requiredCredits) {
  throw new Error('Insufficient credits');
}
```

### 7.3 Fraud Triangle Calculation

**Scoring Algorithm:**
1. Structured assessment answers (Likert 1-5) → normalized to 0-100
2. SJT results → risk weights mapped to scores
3. AI transcript analysis → consistency score
4. Combined weighted average:
   - Pressure: 30%
   - Opportunity: 30%
   - Rationalization: 40%

**Risk Level Mapping:**
- 0-30: LOW
- 31-60: MEDIUM
- 61-85: HIGH
- 86-100: CRITICAL

### 7.4 Timeline Engine

**Real-time Feed:**
- Merges `interview_sessions` and `assessment_invites`
- Sorted by date descending
- Filtered by `companyId` (except superadmin)
- Limited to 50 most recent events

**Event Types:**
- `SESSION` - Interview session created/updated
- `INVITE` - Assessment invite sent

---

## 8. Integration Points

### 8.1 External APIs

#### Mistral AI
- **Endpoint:** `https://api.mistral.ai/v1/chat/completions`
- **Model:** mistral-large-latest
- **Purpose:** CV parsing
- **Auth:** Bearer token
- **Timeout:** 30s

#### Google Gemini
- **SDK:** `@google/generative-ai`
- **Model:** gemini-1.5-flash
- **Purpose:** AI chatbot, fraud analysis
- **Config:** Temperature 0.7, max tokens 300

#### Resend
- **Purpose:** Email delivery
- **From:** noreply@hiregood.one
- **Templates:** HTML with inline CSS

#### Didit
- **Purpose:** KYC verification
- **Webhook:** HMAC signature verification
- **Session Creation:** REST API
- **Data:** ID scan, selfie, liveness check

#### Xendit
- **Purpose:** Payment processing (credit top-up)
- **Integration:** xenditIntegration.ts
- **Webhook:** Payment confirmation

### 8.2 Firebase Services

- **Firestore:** Real-time database
- **Storage:** File uploads (CVs, logos)
- **Authentication:** User management
- **Cloud Functions:** Serverless backend
- **Hosting:** Static site hosting

---

## 9. Credit System

### 9.1 Credit Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Credit Sources                          │
├─────────────────────────────────────────────────────────┤
│ 1. Initial Signup (Freemium): +1000 credits             │
│ 2. Monthly Refill (Premium): +1500 credits              │
│ 3. Top-Up (Xendit): Variable amount                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                 Company Balance                          │
│              (companies.credits)                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  Credit Usage                            │
├─────────────────────────────────────────────────────────┤
│ 1. KYC Verification: -100 credits                       │
│ 2. Resend Invite: -2 credits                            │
│ 3. Unlock Profile: -2 credits                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│            Transaction Log                               │
│       (credit_transactions collection)                   │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Transaction Logging

**Every credit change creates a transaction:**
```typescript
{
  companyId: string;
  type: 'debit' | 'credit';
  amount: number;
  action: string;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
  metadata: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
  }
}
```

### 9.3 Freemium Limitations

**Candidate View Limit:**
- Freemium: 10 candidates visible
- Candidates beyond #10 are blurred
- Unlock costs 2 credits per candidate
- Premium: Unlimited views

---

## 10. Testing Considerations

### 10.1 Critical Test Scenarios

#### Authentication
- [ ] User signup with email verification
- [ ] Login with valid/invalid credentials
- [ ] Session persistence across page refresh
- [ ] Logout clears session
- [ ] Public routes accessible without auth
- [ ] Protected routes redirect to login

#### Multi-Tenancy
- [ ] Company A cannot see Company B's data
- [ ] Superadmin can see all companies
- [ ] Company-scoped queries filter correctly
- [ ] Public job pages show correct company branding

#### Credit System
- [ ] Initial credits granted on signup
- [ ] Credit deduction on KYC initiation
- [ ] Transaction log created for each deduction
- [ ] Insufficient credits prevents action
- [ ] Credit balance updates in real-time
- [ ] Freemium view limit enforced

#### AI Interview
- [ ] Gemini API called with correct parameters
- [ ] Fallback response if API fails
- [ ] Transcript saved to Firestore
- [ ] STAR method questions generated
- [ ] Bahasa Indonesia responses

#### Fraud Analysis
- [ ] Fraud Triangle scores calculated correctly
- [ ] Risk level mapped accurately
- [ ] Red flags detected
- [ ] Recommendation generated
- [ ] Analysis saved to session

#### KYC Integration
- [ ] Didit session created successfully
- [ ] Verification link sent to candidate
- [ ] Webhook signature verified
- [ ] KYC data stored in Firestore
- [ ] Background check status updated

#### Job Portal
- [ ] Public job page accessible
- [ ] Application creates session if instant assessment enabled
- [ ] CV uploaded to Storage
- [ ] CV parsed by Mistral AI
- [ ] Assessment invite sent

#### Email System
- [ ] Candidate invitation email sent
- [ ] Interview invitation email sent
- [ ] Email variables populated correctly
- [ ] Resend API called successfully

### 10.2 Edge Cases

- [ ] Concurrent credit deductions (race condition)
- [ ] API timeout handling
- [ ] Invalid CV format
- [ ] Malformed JSON from AI
- [ ] Webhook replay attacks
- [ ] Session expiry
- [ ] Large file uploads
- [ ] Network disconnection during interview

### 10.3 Performance Tests

- [ ] Dashboard loads in < 2s
- [ ] Real-time updates latency < 500ms
- [ ] CV parsing completes in < 30s
- [ ] Fraud analysis completes in < 10s
- [ ] Concurrent users (100+)

### 10.4 Security Tests

- [ ] SQL injection (N/A - NoSQL)
- [ ] XSS attacks
- [ ] CSRF protection
- [ ] Firestore rules enforcement
- [ ] Storage rules enforcement
- [ ] API key exposure
- [ ] Webhook signature validation

### 10.5 Integration Tests

- [ ] Mistral AI CV parsing end-to-end
- [ ] Gemini AI chatbot end-to-end
- [ ] Didit KYC flow end-to-end
- [ ] Resend email delivery
- [ ] Xendit payment flow
- [ ] Firebase Auth flow

---

## Appendix A: Environment Variables

**Firebase Functions Config:**
```bash
firebase functions:config:set \
  gemini.key="YOUR_GEMINI_API_KEY" \
  mistral.api_key="YOUR_MISTRAL_API_KEY" \
  resend.api_key="YOUR_RESEND_API_KEY" \
  didit.api_key="YOUR_DIDIT_API_KEY" \
  didit.webhook_secret="YOUR_DIDIT_WEBHOOK_SECRET"
```

**Frontend Environment:**
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Appendix B: Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `App.tsx` | 855 | Main application orchestrator |
| `CandidateDetail.tsx` | 3,500+ | Detailed candidate view (largest) |
| `firebase.ts` | 1,300+ | Firebase integration service |
| `functions/index.js` | 510 | Cloud Functions entry point |
| `types.ts` | 442 | TypeScript type definitions |
| `creditManagement.ts` | 320+ | Credit system logic |

---

## Appendix C: Database Collections

1. `companies` - Company profiles
2. `users` - User accounts
3. `interview_sessions` - Assessment sessions
4. `assessment_invites` - Invitation tracking
5. `jobs` - Job postings
6. `job_applications` - Applications
7. `workflows` - Recruitment workflows
8. `credit_transactions` - Credit history
9. `kyc_sessions` - KYC verification data

---

**Document End**

*This specification is intended for whitebox testing and provides comprehensive technical details of the FraudGuard SaaS platform.*
