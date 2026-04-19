# FraudGuard Screening — Chrome Extension

Browser History Gambling Detector + Interview Proctoring for FraudGuard SaaS.

## Features

### Gambling History Screening
- Scans 30 days of browser history for gambling/betting site visits
- Detects 50+ gambling domains (international + Indonesia: togel, slot, sbobet, etc.)
- Keyword-based URL matching (judi, gacor, maxwin, scatter, etc.)
- Late-night and weekend pattern analysis
- Risk scoring (0–100) with LOW / MEDIUM / HIGH levels

### Interview Proctoring
- Monitors candidates during FraudGuard assessments
- Detects: tab switching, copy-paste, DevTools, AI tool visits, gambling site visits
- Suspiciousness score (0–100)
- Events submitted to dashboard in real time

## Installation (Development)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `fraudguard-extension/` directory
5. Extension icon appears in the toolbar

## How It Works

### For HR / Recruiter
1. Open a candidate's detail page in the FraudGuard dashboard
2. Go to the **Background Check** tab
3. Click **Generate Token (50 Credit)** in the FraudGuard Profiling card
4. Send the 8-character token to the candidate via WhatsApp (button provided) or email
5. Gambling analysis results and proctoring logs appear automatically once the candidate submits

### For Candidate
1. Install the FraudGuard Screening Chrome Extension
2. Click the extension icon in the browser toolbar
3. Enter the token provided by HR
4. Read and accept the consent terms
5. Click **Setuju & Lanjutkan**
6. Extension scans browser history → encrypts → submits to FraudGuard
7. Done — HR sees the results in the dashboard

## API Endpoints (Supabase/API Server)

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/extension/generate-token` | Supabase JWT | HR generates token for a session |
| `POST /api/extension/validate-token` | Token only | Extension validates token |
| `POST /api/extension/submit-gambling` | Token only | Extension submits gambling analysis |
| `POST /api/extension/submit-proctoring` | Token only | Extension submits proctoring log |

## Database Setup

Run `scripts/extension-tokens-migration.sql` in the Supabase SQL editor before using the extension feature.

## Security

- **AES-256-GCM** encryption before data transmission
- **HMAC-SHA256** signature for data integrity
- **Token-based** — each session requires a unique 8-character token (24-hour expiry)
- **Data minimization** — only domain names + visit counts sent, not full URLs
- **Session-scoped** — token validates session ID before accepting any submission
- **Consent required** — candidates must explicitly agree before scanning

## File Structure

```
fraudguard-extension/
├── manifest.json                   # Manifest V3
├── background/
│   └── service-worker.js           # History analysis, proctoring, API calls
├── content/
│   └── content-script.js           # Page bridge + proctoring event listeners
├── popup/
│   ├── popup.html                  # 4-step flow UI
│   ├── popup.css                   # Dark theme styles
│   └── popup.js                    # Token validation, consent, results display
├── utils/
│   ├── constants.js                # Gambling domains, keywords, scoring config
│   ├── crypto.js                   # AES-256-GCM + HMAC-SHA256
│   └── scoring.js                  # Risk scoring engine
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
