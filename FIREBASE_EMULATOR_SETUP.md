# Firebase Emulator Setup Guide

## ⚠️ Issue: Java Required

Firebase Emulator requires Java to run. The emulator failed to start because Java is not installed or not in your system PATH.

## 🔧 Solution Options

### Option 1: Install Java (Recommended for Full Testing)

**Download Java JDK:**
1. Go to: https://www.oracle.com/java/technologies/downloads/
2. Download Java 17 or later (LTS version recommended)
3. Install and add to PATH

**Or use Chocolatey (if installed):**
```powershell
choco install openjdk17
```

**Verify Installation:**
```bash
java -version
```

**Then start emulator:**
```bash
cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
firebase emulators:start
```

---

### Option 2: Test Against Production (Quick Alternative)

Instead of using emulator, update backend tests to call your deployed Firebase Functions:

**Update Test Endpoints:**
```python
# Change from:
url = "http://localhost:3000/generateAIResponse"

# To your production URL:
url = "https://europe-west1-{your-project-id}.cloudfunctions.net/generateAIResponse"
```

**Pros:**
- No Java installation needed
- Tests real production environment
- Faster setup

**Cons:**
- Uses real API credits
- Slower than emulator
- Requires deployed functions

---

### Option 3: Functions-Only Testing (Lightweight)

If you only need to test Cloud Functions logic without Firestore/Auth:

**Install Functions Framework:**
```bash
npm install -g @google-cloud/functions-framework
```

**Run individual function:**
```bash
cd functions
functions-framework --target=generateAIResponse --port=8080
```

**Test endpoint:**
```
http://localhost:8080
```

---

## 📊 Emulator Ports (Once Java is Installed)

When emulator runs, services will be available at:

| Service | Port | URL |
|---------|------|-----|
| Functions | 5001 | http://localhost:5001/{project-id}/europe-west1/{functionName} |
| Firestore | 8080 | http://localhost:8080 |
| Auth | 9099 | http://localhost:9099 |
| Storage | 9199 | http://localhost:9199 |
| Emulator UI | 4000 | http://localhost:4000 |

---

## 🚀 Quick Start (After Java Install)

```bash
# Terminal 1: Start emulator
cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
firebase emulators:start

# Terminal 2: Run backend tests
cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
# Update test URLs to emulator endpoints first
python testsprite_tests/TC001_generate_ai_chatbot_response.py
```

---

## 🔍 Checking Java Installation

**Check if Java is installed:**
```bash
java -version
```

**Expected output:**
```
java version "17.0.x" or higher
```

**If not found:**
- Java is not installed, OR
- Java is not in system PATH

---

## 💡 Recommendation

**For comprehensive testing:** Install Java and use Firebase Emulator  
**For quick testing:** Use Option 2 (production endpoints) or Option 3 (functions framework)

**Current Status:**
- ✅ Firebase CLI installed (v14.27.0)
- ✅ firebase.json configured with emulator settings
- ❌ Java not installed/not in PATH
- ⏸️ Emulator cannot start without Java

---

## 📝 Next Steps

1. **Install Java** (see Option 1 above)
2. **Restart terminal** (to refresh PATH)
3. **Run:** `firebase emulators:start`
4. **Update backend test URLs** to emulator endpoints
5. **Re-run tests**

Or choose Option 2/3 for quicker alternatives without Java.
