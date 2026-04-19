# Plan: FraudGuard Chrome Extension — Gambling History Detector + Interview Proctoring

## Executive Summary

Rencana ini menggabungkan Chrome Extension **Gambling History Detector** (dari [CHROME_EXTENSION_PROMPT.md](file:///c:/Users/lenovo/Documents/Project%20Antigravity/app.hiregood.one/fraudguard/CHROME_EXTENSION_PROMPT.md)) dengan ekosistem **FraudGuard SaaS** yang sudah ada, sehingga extension bukan hanya tool standalone, tapi menjadi **tahap workflow resmi** dalam recruitment pipeline. Extension juga akan diperluas untuk bisa digunakan sebagai **interview proctoring tool**.

> [!IMPORTANT]
> Dokumen ini adalah **PLAN ONLY — tanpa coding**. Semua backend extension menggunakan backend FraudGuard yang sudah ada (Firebase Cloud Functions, bukan server terpisah).

---

## Bagian A: Analisa CHROME_EXTENSION_PROMPT.md yang Sudah Ada

### Apa yang sudah baik ✅
1. **Consent flow** sudah didesain dengan benar (token, 24h expiry)
2. **Detection mechanism** sudah solid (domain-based + keyword + pattern)
3. **Risk scoring** clear (0-100 dengan level LOW/MEDIUM/HIGH)
4. **Security** sudah memikirkan encryption (AES-256 / Web Crypto API) dan HMAC signature
5. **Manifest V3** — standar terbaru Chrome Extension

### Apa yang perlu diubah/ditambah 🔧

| Item | Status Saat Ini | Perubahan yang Diperlukan |
|------|----------------|--------------------------|
| Server endpoint | Generic `POST /api/submit-analysis` | Harus menggunakan **Firebase Cloud Function** (`submitGamblingAnalysis`) |
| Authentication | Tidak ada | Harus terintegrasi dengan **FraudGuard session token** (consent token = sessionId + candidateId) |
| Report storage | Tidak ditentukan | Harus disimpan ke **Firestore** sebagai bagian dari `interview_sessions.gamblingAnalysis` |
| Workflow integration | Tidak ada | Harus menjadi **WorkflowStep** baru di FraudGuard |
| Interview proctoring | Tidak ada | Fitur baru harus ditambahkan |
| Indonesian gambling sites | Sebagian | Perlu ditambahkan domain lokal (togel, slot, dll) |

---

## Bagian B: Arsitektur Integrasi dengan FraudGuard

### B1. Bagaimana Extension Terhubung ke Backend FraudGuard

```
┌──────────────────────────────────────────────────┐
│           Chrome Extension (Client)               │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ Popup UI   │  │ Background  │  │ Content   │ │
│  │ (consent,  │  │ (history    │  │ Script    │ │
│  │  results)  │  │  analysis,  │  │ (interview│ │
│  │            │  │  proctoring)│  │  monitor) │ │
│  └─────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
└────────┼────────────────┼───────────────┼────────┘
         │                │               │
         ▼                ▼               ▼
┌──────────────────────────────────────────────────┐
│     Firebase Cloud Functions (Existing Backend)   │
│                                                   │
│  [NEW] submitGamblingAnalysis   (onCall)          │
│  [NEW] getExtensionToken        (onCall)          │
│  [NEW] submitProctoringEvent    (onCall)          │
│  [NEW] getExtensionConfig       (onCall)          │
│                                                   │
│  [EXISTING] analyzeFraudRisk    ← enhanced        │
│  [EXISTING] generateAIResponse  ← enhanced        │
│  [EXISTING] updateCandidateStage                  │
│                                                   │
│              ↕ Firestore ↕                        │
│                                                   │
│  interview_sessions/{id}/gamblingAnalysis  [NEW]  │
│  interview_sessions/{id}/proctoringData   [NEW]  │
│  extension_tokens/{tokenId}               [NEW]  │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│         FraudGuard Dashboard (React App)          │
│                                                   │
│  CandidateDetail.tsx → Tab "Browser Screening"    │
│  CandidateDetail.tsx → Tab "Proctoring Log"       │
│  WorkflowManager.tsx → Step "Gambling Screening"  │
│  WorkflowManager.tsx → Step "Proctored Interview" │
└──────────────────────────────────────────────────┘
```

### B2. Data Model — Apa yang Disimpan di Firestore

#### Collection baru: `extension_tokens`
```typescript
{
  id: string;                    // auto-generated
  sessionId: string;             // FraudGuard interview_session ID
  companyId: string;             // Company yang meminta
  candidateEmail: string;        // Kandidat target
  type: 'gambling_check' | 'interview_proctor';
  status: 'pending' | 'active' | 'completed' | 'expired';
  consentGiven: boolean;
  consentTimestamp?: string;
  createdAt: string;
  expiresAt: string;             // 24 jam dari created
  usedAt?: string;
}
```

#### Field baru di `interview_sessions`
```typescript
// Ditambahkan ke InterviewSession
{
  // ... existing fields ...
  
  gamblingAnalysis?: {
    status: 'pending' | 'completed' | 'skipped';
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;           // 0-100
    totalHistoryAnalyzed: number;
    flaggedSitesCount: number;
    flaggedSites: Array<{
      domain: string;
      visitCount: number;
      lastVisit: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    timePatterns: {
      lateNightAccess: number;
      weekendAccess: number;
      frequentAccess: number;
    };
    suspiciousPatterns: string[];
    consentToken: string;
    completedAt: string;
    extensionVersion: string;
  };
  
  proctoringData?: {
    status: 'monitoring' | 'completed' | 'flagged';
    totalEvents: number;
    alerts: Array<{
      type: 'tab_switch' | 'window_blur' | 'copy_paste' | 
            'screenshot_attempt' | 'devtools_open' | 'gambling_site_visit';
      timestamp: string;
      details: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
    tabSwitchCount: number;
    windowBlurCount: number;
    suspiciousActivityScore: number;  // 0-100
    sessionDuration: number;          // in seconds
    startedAt: string;
    completedAt?: string;
  };
}
```

---

## Bagian C: Mekanisme Gambling History Check (Diperbaiki)

### C1. Flow End-to-End

```
HR Dashboard                  Email/WA              Chrome Extension          Cloud Function
    │                            │                       │                        │
    │ 1. Klik "Gambling          │                       │                        │
    │    Check" di workflow      │                       │                        │
    ├───────────────────────────►│                       │                        │
    │                            │ 2. Kirim link         │                        │
    │                            │    install extension  │                        │
    │                            │    + unique token     │                        │
    │                            ├──────────────────────►│                        │
    │                            │                       │ 3. Kandidat install    │
    │                            │                       │    & buka extension    │
    │                            │                       │                        │
    │                            │                       │ 4. Input token,        │
    │                            │                       │    baca consent,       │
    │                            │                       │    klik "Setuju"       │
    │                            │                       │                        │
    │                            │                       │ 5. Extension calls     │
    │                            │                       │    getExtensionConfig  │
    │                            │                       ├───────────────────────►│
    │                            │                       │◄───────────────────────┤
    │                            │                       │    (validate token,    │
    │                            │                       │     return config)     │
    │                            │                       │                        │
    │                            │                       │ 6. Analyze browser     │
    │                            │                       │    history (local,     │
    │                            │                       │    30 days)            │
    │                            │                       │                        │
    │                            │                       │ 7. Encrypt report      │
    │                            │                       │    + HMAC sign         │
    │                            │                       │                        │
    │                            │                       │ 8. Submit to           │
    │                            │                       │    submitGamblingAnalysis
    │                            │                       ├───────────────────────►│
    │                            │                       │                        │ 9. Verify HMAC
    │                            │                       │                        │ 10. Decrypt
    │                            │                       │                        │ 11. Save to
    │                            │                       │                        │     Firestore
    │                            │                       │                        │ 12. Update
    │                            │                       │                        │     session stage
    │                            │                       │◄───────────────────────┤
    │                            │                       │    { success, reportId }
    │                            │                       │                        │
    │ 13. Real-time listener     │                       │                        │
    │     (onSnapshot) detects   │                       │                        │
    │     gamblingAnalysis data  │                       │                        │
    │                            │                       │                        │
    │ 14. HR melihat hasil       │                       │                        │
    │     di tab "Browser        │                       │                        │
    │     Screening"             │                       │                        │
```

### C2. Cloud Functions yang Perlu Ditambahkan

#### `getExtensionToken` (onCall)
- **Trigger:** HR klik "Mulai Gambling Check" di dashboard
- **Input:** `{ sessionId, candidateEmail }`
- **Logic:**
  1. Generate unique token (UUID)
  2. Simpan ke collection `extension_tokens`
  3. Set expiry 24 jam
  4. Return: `{ token, installUrl }`
- **Credit cost:** 50 credits (dari company balance)

#### `getExtensionConfig` (onCall, no auth required)
- **Trigger:** Extension popup saat kandidat input token
- **Input:** `{ extensionToken }`
- **Logic:**
  1. Validate token exists & not expired
  2. Validate token belum digunakan
  3. Return gambling domains + keywords + config
  4. Mark token as `active`
- **Output:** `{ valid: true, config: { domains, keywords, historyDays } }`

#### `submitGamblingAnalysis` (onCall, no auth required)
- **Trigger:** Extension setelah analisis selesai
- **Input:** `{ encryptedData, signature, extensionToken }`
- **Logic:**
  1. Validate token
  2. Verify HMAC signature
  3. Decrypt data
  4. Save ke `interview_sessions/{sessionId}.gamblingAnalysis`
  5. Update workflow stage via `updateCandidateStage`
  6. Mark token as `completed`
  7. Notify HR via notification trigger
- **Output:** `{ success: true, reportId }`

### C3. Enhancement: Domain List Indonesia

Prompt saat ini hanya mencakup domain internasional. Harus ditambahkan domain **gambling Indonesia** yang lebih relevan:

```javascript
// Tambahan domain gambling Indonesia
const GAMBLING_DOMAINS_ID = [
  // Togel
  'togelsingapore.com', 'togelhongkong.com', 'togelsydney.com',
  'datasydney.com', 'datahongkong.com', 'paito.net',
  
  // Slot Online Indonesia  
  'pragmaticplay.com', 'slot88.com', 'joker123.com',
  'habanero.com', 'pgsoft.com', 'spadegaming.com',
  
  // Sportsbook Indonesia
  'sbobet88.com', 'nova88.com', 'cmd368.com',
  'ibcbet.com', 'maxbet.com',
  
  // Casino Online
  'idn-poker.com', 'idnplay.com',
  'w88.com', 'fun88.com', 'm88.com',
  
  // Aggregator/Agen
  'mpo.com', 'dewabet.com', 'kebogiro.com'
];

// Tambahan keyword Indonesia
const GAMBLING_KEYWORDS_ID = [
  'togel', 'slot', 'judi online', 'bandar', 'agen judi',
  'situs judi', 'daftar slot', 'bonus new member',
  'rtp slot', 'scatter', 'maxwin', 'gacor',
  'prediksi togel', 'bocoran', 'angka main',
  'deposit pulsa', 'livechat', 'parlay',
  'mix parlay', 'handicap', 'over under'
];
```

---

## Bagian D: Mekanisme Interview Proctoring (Fitur Baru)

### D1. Konsep

Saat kandidat sedang mengerjakan **assessment** atau **AI interview** di FraudGuard (via browser), Chrome Extension yang sudah terinstall berfungsi sebagai **proctoring monitor** — mendeteksi kecurangan secara real-time.

### D2. Apa yang Dimonitor

| Event | Deskripsi | Severity |
|-------|-----------|----------|
| `tab_switch` | Kandidat pindah tab selama assessment | ⚠️ Warning |
| `window_blur` | Browser FraudGuard kehilangan focus | ⚠️ Warning |
| `copy_paste` | Kandidat copy-paste jawaban | 🔴 Critical |
| `devtools_open` | Developer tools dibuka | 🔴 Critical |
| `gambling_site_visit` | Visit gambling site SAAT assessment | 🔴 Critical |
| `ai_tool_visit` | Visit ChatGPT/Gemini/Claude saat assessment | ⚠️ Warning |
| `multiple_monitor` | Detected lebih dari 1 screen (optional) | ℹ️ Info |

### D3. Flow Proctoring

```
Kandidat buka FraudGuard             Chrome Extension              Cloud Function
Assessment Page                      (background.js)
    │                                     │                             │
    │ 1. Page loads, sends                │                             │
    │    "START_PROCTORING" msg           │                             │
    │    via window.postMessage           │                             │
    ├────────────────────────────────────►│                             │
    │                                     │ 2. Content script           │
    │                                     │    receives msg,            │
    │                                     │    starts monitoring        │
    │                                     │                             │
    │                                     │ 3. Monitor events:          │
    │                                     │    - document.hidden        │
    │                                     │    - window.onblur          │
    │                                     │    - chrome.tabs.onActivated│
    │                                     │    - chrome.webNavigation   │
    │                                     │    - keyboard shortcuts     │
    │                                     │                             │
    │  [Kandidat pindah tab]              │                             │
    │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ►│                             │
    │                                     │ 4. Detect event,            │
    │                                     │    log locally              │
    │                                     │                             │
    │  [Kandidat kembali ke tab]          │                             │
    │ ◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                             │
    │                                     │                             │
    │ 5. Assessment selesai,              │                             │
    │    send "STOP_PROCTORING"           │                             │
    ├────────────────────────────────────►│                             │
    │                                     │ 6. Compile all events       │
    │                                     │    into report              │
    │                                     │                             │
    │                                     │ 7. Submit to                │
    │                                     │    submitProctoringEvent    │
    │                                     ├────────────────────────────►│
    │                                     │                             │ 8. Save to
    │                                     │                             │    Firestore
    │                                     │                             │    proctoringData
    │                                     │◄────────────────────────────┤
    │                                     │                             │
```

### D4. Cloud Function untuk Proctoring

#### `submitProctoringEvent` (onCall, no auth)
- **Input:** `{ extensionToken, events[], sessionDuration }`
- **Logic:**
  1. Validate token
  2. Calculate `suspiciousActivityScore`:
     - Each `tab_switch` = +5 points
     - Each `window_blur` = +3 points
     - Each `copy_paste` = +15 points
     - Each `devtools_open` = +20 points
     - Each `gambling_site_visit` = +25 points
     - Each `ai_tool_visit` = +10 points
     - Cap at 100
  3. Save ke `interview_sessions/{sessionId}.proctoringData`
  4. Jika score > 50 → flag session untuk HR review
- **Output:** `{ success: true, score: number }`

### D5. Komunikasi Extension ↔ FraudGuard Page

Extension dan halaman assessment FraudGuard berkomunikasi via **Content Script + window.postMessage**:

```
FraudGuard Assessment Page (React)
  │
  │  window.postMessage({ 
  │    type: 'FRAUDGUARD_PROCTOR_START',
  │    sessionId: '...',
  │    token: '...'
  │  }, '*')
  │
  ▼
Content Script (injected by extension)
  │
  │  window.addEventListener('message', handler)
  │  → forward ke background.js via chrome.runtime.sendMessage()
  │
  ▼
Background Service Worker
  │
  │  Start monitoring: chrome.tabs, chrome.webNavigation, etc.
  │  Accumulate events in memory
  │
  ▼ (on STOP signal)
  │
  │  POST events to submitProctoringEvent Cloud Function
```

---

## Bagian E: Integrasi ke FraudGuard Workflow System

### E1. Workflow Templates Baru

Tambahkan 2 workflow step baru ke `WORKFLOW_TEMPLATES` di [types.ts](file:///c:/Users/lenovo/Documents/Project%20Antigravity/app.hiregood.one/fraudguard/types.ts):

```typescript
// Step baru #1
{
  id: 'gambling_screening',
  name: 'Gambling History Screening',
  description: 'Chrome Extension untuk menganalisa riwayat browser kandidat terkait situs gambling/judi',
  credits: 50,
  isMandatory: false,
  icon: 'Shield',        // atau 'Search'
  category: 'verification',
  isAvailable: true       // READY
}

// Step baru #2
{
  id: 'proctored_assessment',
  name: 'Proctored Assessment',
  description: 'Monitoring kandidat saat mengerjakan assessment via Chrome Extension untuk mencegah kecurangan',
  credits: 10,
  isMandatory: false,
  icon: 'Eye',
  category: 'assessment',
  isAvailable: true       // READY
}
```

### E2. Credit Action Baru

Tambahkan ke `CreditTransaction.action`:
```
'GAMBLING_SCREENING' | 'PROCTORED_ASSESSMENT'
```

Dan ke `CREDIT_COSTS`:
```
GAMBLING_SCREENING: 50,
PROCTORED_ASSESSMENT: 10
```

### E3. UI di CandidateDetail.tsx

**Tab baru: "Browser Screening"**
- Menampilkan gambling analysis results
- Risk score gauge (0-100)
- Daftar flagged sites (domain, visit count, last visit)
- Time patterns visualization (late night chart)
- Suspicious patterns badges

**Tab baru: "Proctoring Log"**
- Timeline of proctoring events
- Suspicious activity score
- Alert badges (tab switches, copy-paste attempts, etc)
- Session duration info

---

## Bagian F: Chrome Extension File Structure (Diperluas)

```
fraudguard-extension/
├── manifest.json              # Manifest V3
├── popup/
│   ├── popup.html             # Main UI
│   ├── popup.css              # Styling (dark theme, FraudGuard branding)
│   └── popup.js               # UI logic
├── background/
│   └── service-worker.js      # Main background logic
│       ├── historyAnalyzer     # Gambling history scanning
│       ├── proctorMonitor      # Interview proctoring
│       └── apiClient           # Firebase Cloud Function calls
├── content/
│   └── content-script.js      # Injected into FraudGuard pages
│       ├── postMessage bridge  # Communication with React app
│       └── DOM monitoring      # Copy-paste, devtools detection
├── utils/
│   ├── constants.js           # Gambling domains + keywords
│   ├── crypto.js              # Web Crypto API (AES-256 + HMAC)
│   └── scoring.js             # Risk calculation algorithms
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Manifest.json Permissions
```json
{
  "manifest_version": 3,
  "name": "FraudGuard Screening",
  "version": "1.0.0",
  "permissions": [
    "history",           // Browser history access
    "tabs",              // Tab monitoring (proctoring)
    "activeTab",         // Current tab info
    "storage",           // Local storage for tokens
    "webNavigation"      // URL navigation monitoring
  ],
  "host_permissions": [
    "https://*.cloudfunctions.net/*",    // Firebase Cloud Functions
    "https://*.hiregood.one/*"           // FraudGuard domain
  ],
  "content_scripts": [{
    "matches": ["https://*.hiregood.one/*"],
    "js": ["content/content-script.js"]
  }],
  "background": {
    "service_worker": "background/service-worker.js"
  }
}
```

---

## Bagian G: Security & Privacy Considerations

> [!CAUTION]
> Extension ini mengakses data sensitif (browser history). Berikut langkah-langkah keamanan yang WAJIB diimplementasikan:

1. **Explicit Consent:** Kandidat HARUS membaca dan menyetujui consent form yang menjelaskan:
   - Data apa yang diambil (hanya URL + visit count, bukan konten halaman)
   - Berapa lama data disimpan (30 hari setelah screening selesai, lalu dihapus)
   - Siapa yang bisa melihat (hanya HR perusahaan terkait)
   - Hak untuk menolak (dan konsekuensinya)

2. **Data Minimization:** HANYA kirim domain + visit count ke server, BUKAN full URL/path

3. **Encryption:** AES-256-GCM encryption sebelum data dikirim

4. **Token-based:** Setiap sesi screening memerlukan token unik yang expire dalam 24 jam

5. **No Persistence:** Extension TIDAK menyimpan history data setelah submission

6. **Audit Trail:** Semua aksi tercatat di `credit_transactions`

---

## Bagian H: Anti-Cheating Measures

Kandidat bisa mencoba menghapus history sebelum scan. Countermeasures:

| Cheat Attempt | Detection Method |
|----------------|-----------------|
| Clear all history before scan | Deteksi history count sangat rendah (`< 50 items in 30 days` = suspicious) |
| Use incognito for gambling | Tidak terdeteksi — ini kelemahan inheren Chrome History API |
| Uninstall/reinstall browser | Total history = 0, flagged sebagai anomali |
| Use VPN/different browser | Tidak terdeteksi — scope terbatas pada Chrome |

> [!NOTE]
> Gambling screening via browser history bersifat **supplementary** — bukan satu-satunya indikator fraud. Selalu digunakan bersama dengan assessment integritas, AI interview, dan KYC.

---

## Open Questions

> [!IMPORTANT]
> **Keputusan yang perlu diambil sebelum coding:**

1. **Distribusi Extension:** Publish ke Chrome Web Store (public) atau distribusi internal (unpacked/.crx)?
   - Chrome Web Store memerlukan review process (1-2 minggu)
   - Internal distribution lebih cepat tapi kurang trustworthy

2. **Consent legal:** Apakah sudah ada review legal/compliance untuk pengumpulan browser history kandidat di Indonesia?

3. **Proctoring scope:** Apakah proctoring hanya untuk assessment FraudGuard, atau juga untuk meeting interview video (Zoom/Meet)?

4. **Credit pricing:** Apakah 50 credits untuk gambling screening dan 10 credits untuk proctoring sudah sesuai dengan ekspektasi pricing?

5. **Backend target:** Apakah Cloud Functions ini tetap di Firebase, atau langsung coding di **Supabase Edge Functions** (mengingat rencana migrasi)?

---

## Verification Plan

### Setelah Coding
- Extension load tanpa error di `chrome://extensions/`
- Token generation → validate → expire flow berjalan
- History analysis menghasilkan report yang benar
- Report tersimpan di Firestore dan muncul di CandidateDetail
- Proctoring mendeteksi tab switch dan copy-paste
- Credit deduction berjalan
- Real-time listener update dashboard HR

### Manual Testing
- Install extension di Chrome kandidat
- Jalankan assessment dengan proctoring aktif
- Verifikasi semua events tercatat
- Cek dashboard HR menampilkan hasil gambling + proctoring
