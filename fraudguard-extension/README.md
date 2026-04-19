# FraudGuard Screening — Chrome Extension

Browser History Gambling Detector + Interview Proctoring for FraudGuard SaaS.

## Features

### 🎰 Gambling History Screening
- Scans 30 days of browser history for gambling/betting site visits
- Detects 50+ gambling domains (international + Indonesia)
- Keyword-based URL matching
- Late-night and weekend pattern analysis
- Risk scoring (0-100) with LOW / MEDIUM / HIGH levels

### 👁️ Interview Proctoring
- Monitors candidates during FraudGuard assessments
- Detects: tab switching, copy-paste, DevTools, AI tool visits, gambling site visits
- Suspiciousness score (0-100)
- Real-time event logging

## Installation (Development)

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select the `fraudguard-extension/` directory
5. Extension icon appears in toolbar

## How It Works

### For HR / Admin
1. Go to candidate detail in FraudGuard dashboard
2. Click "Gambling Screening" or "Proctored Assessment" in workflow
3. System generates a unique token and deducts credits
4. Send token to candidate via email/WhatsApp
5. Results appear in dashboard once candidate completes screening

### For Candidate
1. Install the extension
2. Click extension icon
3. Enter the token provided by HR
4. Read and accept consent terms
5. Click "Setuju & Lanjutkan"
6. Extension analyzes browser history
7. Encrypted report is sent to FraudGuard backend

## Security & Privacy

- **AES-256-GCM** encryption before data transmission
- **HMAC-SHA256** signature for data integrity
- **Token-based** — each session requires a unique, 24-hour token
- **Data minimization** — only domains + visit counts are sent, not full URLs
- **No persistence** — data cleared after submission
- **Consent required** — candidates must explicitly agree

## File Structure

```
fraudguard-extension/
├── manifest.json               # Manifest V3
├── popup/
│   ├── popup.html              # UI
│   ├── popup.css               # Dark theme styling
│   └── popup.js                # Step flow logic
├── background/
│   └── service-worker.js       # History analysis + proctoring
├── content/
│   └── content-script.js       # FraudGuard page bridge
├── utils/
│   ├── constants.js            # Domains + keywords + config
│   ├── crypto.js               # AES-256 + HMAC
│   └── scoring.js              # Risk calculation
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Backend

The extension uses **FraudGuard's existing Firebase Cloud Functions**:
- `getExtensionToken` — HR generates token (deducts credits)
- `getExtensionConfig` — Extension validates token
- `submitGamblingAnalysis` — Extension submits encrypted report
- `submitProctoringEvent` — Extension submits proctoring events

## Credits

| Feature | Cost |
|---------|------|
| Gambling Screening | 50 credits |
| Proctored Assessment | 10 credits |
