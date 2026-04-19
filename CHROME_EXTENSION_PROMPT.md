# Chrome Extension: Browser History Gambling Detector

## 📋 Deskripsi Project
Buat Chrome Extension yang menganalisis browser history user untuk mendeteksi kunjungan ke situs gambling/judi online. Extension ini digunakan untuk screening calon karyawan (dengan consent user). Output berupa risk assessment report.

---

## 🎯 Core Features

### Feature 1: User Consent & Authentication
- **Consent Form**: User harus melihat & setuju dengan persetujuan sebelum extension bisa akses history
- **Consent Details**:
  - Jelaskan APA yang akan dianalisis (browser history 30 hari terakhir)
  - Jelaskan UNTUK APA (employee screening)
  - Jelaskan DATA PRIVACY (enkripsi, retention policy)
- **Token Management**: Generate unique consent token setiap submission
- **Consent Expiry**: Token berlaku hanya 24 jam

### Feature 2: Browser History Analysis
- **Data Collection**:
  - Ambil history dari last 30 days menggunakan `chrome.history.search()`
  - Kumpulkan: URL, visit count, last visit time
  - Max 5000 items per collection

- **Detection Mechanism**:
  - **Domain-based detection**: Check URL mengandung gambling domains (pokerstars, betfair, sbobet, maxbet, dafabet, bet365, etc)
  - **Keyword-based detection**: Cek keywords seperti "poker", "casino", "judi", "bet", "gamble", "slots", "roulette"
  - **Pattern detection**:
    - Late night access (10 PM - 6 AM)
    - Weekend concentration
    - Frequency of visits
    - Multiple gambling sites visitation

- **Risk Scoring System**:
  - Domain match = +15 points
  - Keyword match = +8 points
  - Late night access = +3 points per visit
  - Multiple sites = +20 bonus points
  - Frequent access (>10x/day) = +5 points
  - Max score: 100
  - Risk levels: LOW (0-20), MEDIUM (20-50), HIGH (50+)

### Feature 3: Report Generation
- **Report Contents**:
  ```
  {
    overallRisk: "LOW|MEDIUM|HIGH",
    riskScore: number (0-100),
    totalHistoryAnalyzed: number,
    flaggedSites: [
      {
        url: string,
        domain: string,
        visitCount: number,
        lastVisit: timestamp,
        riskLevel: "LOW|MEDIUM|HIGH"
      }
    ],
    timePatterns: {
      lateNightAccess: number,
      weekendAccess: number,
      frequentAccess: number
    },
    suspiciousPatterns: array,
    timestamp: ISO timestamp
  }
  ```

### Feature 4: Data Encryption & Security
- **Encryption**: 
  - Client-side: Encrypt report sebelum kirim ke server (AES-256 atau base64 untuk prototype)
  - Use `crypto` library atau native Web Crypto API
  
- **Signature Verification**: 
  - Generate HMAC signature untuk prevent tampering
  - Server verify signature sebelum process

- **Data Handling**:
  - Don't store history URLs locally in plain text
  - Clear data after submission
  - No persistence of sensitive data

### Feature 5: Server Integration
- **Endpoint**: `POST /api/submit-analysis`
- **Request Format**:
  ```json
  {
    "encryptedData": "base64_encoded_encrypted_report",
    "signature": "hmac_signature",
    "consentToken": "unique_token"
  }
  ```

- **Response Format**:
  ```json
  {
    "success": true,
    "reportId": "report_uuid",
    "riskLevel": "HIGH|MEDIUM|LOW",
    "message": "Analysis submitted successfully"
  }
  ```

### Feature 6: UI/UX
- **Popup Interface** (500px width):
  - Login form (if needed)
  - Consent agreement checkbox with detailed terms
  - "Analyze History" button
  - Progress indicator during analysis
  - Result summary after completion
  - Option to view detailed report
  - "Clear Data" button

- **Design**: Modern, clean, professional
  - Use gradient background (purple/blue)
  - Clear typography
  - Loading spinner during analysis
  - Color coding for risk levels (green=LOW, yellow=MEDIUM, red=HIGH)

- **Error Handling**:
  - Show error messages if history access denied
  - Show timeout warning if analysis takes too long
  - Retry mechanism

---

## 🛠️ Technical Requirements

### Stack
- **Manifest**: Manifest V3 (latest Chrome extension standard)
- **Frontend**: Vanilla JavaScript (no frameworks, or use lightweight ones)
- **Encryption**: Web Crypto API atau crypto-js library
- **Storage**: `chrome.storage.local` & `chrome.storage.sync`
- **API Calls**: Fetch API
- **No build tool needed**: Keep it simple and deployable

### File Structure
```
extension-folder/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── utils.js (helper functions)
├── constants.js (gambling domains list)
└── README.md
```

### Key APIs to Use
- `chrome.history.search()` - Get browser history
- `chrome.storage.local.set/get()` - Store consent tokens
- `chrome.runtime.sendMessage()` - Communication between popup & background
- `Fetch API` - Send encrypted data to server
- `Web Crypto API` - For encryption (optional, can use Base64 for prototype)

### Constants/Configuration
```javascript
// Gambling domains database
const GAMBLING_DOMAINS = [
  'pokerstars.com', 'betfair.com', 'sbobet.com', 'maxbet.com',
  'dafabet.com', 'bet365.com', 'betking.com', '188bet.com',
  'royalvegascasino.com', 'casinoeuropa.com', 'onlinepoker.com',
  'betpawa.com', 'spinpalace.com', 'europalace.com'
];

// Keywords to detect
const GAMBLING_KEYWORDS = [
  'poker', 'casino', 'judi', 'bet', 'gamble', 'slots', 
  'roulette', 'blackjack', 'baccarat', 'lottery', 'sportsbet'
];

// Configuration
const CONFIG = {
  HISTORY_DAYS: 30,
  MAX_HISTORY_ITEMS: 5000,
  CONSENT_EXPIRY_HOURS: 24,
  LATE_NIGHT_START: 22,
  LATE_NIGHT_END: 6,
  API_ENDPOINT: 'https://api.example.com/api/submit-analysis'
};
```

### Functions to Implement

#### popup.js
```javascript
- showConsentForm()          // Display consent UI
- handleConsentAccept()      // When user clicks accept
- startAnalysis()            // Trigger history analysis
- displayLoading()           // Show progress
- displayResults()           // Show risk report
- handleSubmitToServer()     // Send encrypted data
- showError()                // Error messages
- handleClearData()          // Clear stored data
```

#### background.js
```javascript
- analyzeHistory()           // Main analysis function
- analyzeURLs()              // Check gambling sites/keywords
- calculateRiskScore()       // Risk calculation logic
- detectTimePatterns()       // Late night, weekend patterns
- detectSuspiciousPatterns() // Multiple sites, escalation
- encryptReport()            // Encrypt before send
- generateSignature()        // HMAC signature
- logActivity()              // Audit logging
```

#### utils.js
```javascript
- generateToken()            // Create consent token
- isGamblingDomain()         // Check if domain is gambling
- hasGamblingKeyword()       // Check if URL has keywords
- getTimePatterns()          // Analyze visit times
- formatTimestamp()          // Format dates
- validateEmail()            // Email validation
- showNotification()         // Toast/notification
```

---

## 📊 Analysis Logic (Pseudocode)

```
FUNCTION analyzeHistory():
  1. GET browser history (last 30 days)
  2. INITIALIZE analysis object {
       flaggedSites: [],
       riskScore: 0,
       timePatterns: {},
       suspiciousPatterns: []
     }
  
  3. FOR EACH history item:
       a. CHECK if domain is in GAMBLING_DOMAINS
          IF YES -> flag as HIGH risk, add 15 points
       
       b. CHECK if URL contains GAMBLING_KEYWORDS
          IF YES -> flag as MEDIUM risk, add 8 points
       
       c. CHECK visit time
          IF late night (10PM-6AM) -> add 3 points
          IF weekend -> increment weekend counter
       
       d. CHECK visit frequency
          IF >10 visits/day -> add 5 points, increment frequent counter
  
  4. DETECT suspicious patterns:
       IF multiple gambling sites (>3) -> add 20 points
       IF frequent access (>5 days) -> add 15 points
       IF late night gambling -> add 10 points
  
  5. CALCULATE overall risk:
       IF score >= 50 -> HIGH
       ELSE IF score >= 20 -> MEDIUM
       ELSE -> LOW
  
  6. RETURN analysis report
```

---

## 🔐 Security Checklist

- [ ] Use HTTPS only for API calls
- [ ] Validate all input data
- [ ] Don't store sensitive data unencrypted
- [ ] Use CSP headers in manifest
- [ ] Verify consent token before analysis
- [ ] Implement request signing/HMAC
- [ ] Add rate limiting on server side
- [ ] Log all activities for audit trail
- [ ] Clear sensitive data from memory after use
- [ ] Validate server response
- [ ] Implement error handling for network failures

---

## 📝 Development Notes

1. **Start Simple**: Begin with basic history analysis, then add encryption
2. **Test Locally**: Use `chrome://extensions/` to load unpacked extension
3. **Mock API**: Create mock API endpoint first, then integrate real server
4. **Error Handling**: Add try-catch blocks everywhere
5. **User Feedback**: Show clear messages for success/error states
6. **Documentation**: Add comments in code for clarity
7. **Consent UX**: Make consent form very clear and prominent

---

## 🚀 Deployment Steps

1. Package extension folder as `.zip`
2. Upload to Chrome Web Store (requires developer account)
3. Or distribute as unpacked folder for internal use
4. Add version control (git)

---

## 📚 References & Libraries (Optional)

- Web Crypto API docs: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- Chrome History API: https://developer.chrome.com/docs/extensions/reference/history/
- crypto-js (for easier encryption): https://cdnjs.com/libraries/crypto-js
- UUID generator: https://www.npmjs.com/package/uuid

---

## ✅ Deliverables

1. ✓ Complete manifest.json
2. ✓ popup.html with consent form & UI
3. ✓ popup.js with event handlers
4. ✓ background.js with analysis logic
5. ✓ utils.js with helper functions
6. ✓ constants.js with gambling sites database
7. ✓ README.md with installation instructions
8. ✓ Mock API for testing

---

## 🎬 User Flow

```
1. User installs extension from Chrome Web Store
2. Clicks extension icon
3. Sees consent form with detailed terms
4. Reads & accepts consent
5. Clicks "Analyze My History" button
6. Extension shows loading spinner
7. Background script analyzes 30 days of history
8. Results displayed in popup:
   - Risk Level (LOW/MEDIUM/HIGH)
   - Risk Score (0-100)
   - Flagged Sites count
   - Time Patterns analysis
9. Option to:
   - View detailed report
   - Submit to server
   - Clear data & start over
10. If submit: encrypted data sent to server
11. Server returns report ID
12. User can share report ID with HR
```

---

## 💡 Tips untuk Development

- Use Chrome DevTools: Right-click extension icon → Inspect popup
- Check background script logs: chrome://extensions/ → Service Worker logs
- Test with sample history data first
- Use console.log() extensively for debugging
- Keep payload size small for performance
- Add success/error notifications

---

**Ready to code? Gunakan prompt ini di Cursor atau ChatGPT untuk auto-generate semua file extension!**
