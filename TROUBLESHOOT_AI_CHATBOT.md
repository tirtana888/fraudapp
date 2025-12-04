# AI Chatbot Troubleshooting Guide

## Issue: AI Masih Static Meskipun API Keys Sudah Deployed

Anda sudah deploy API keys tapi AI tetap kasih static response? Ikuti guide ini untuk identify root cause.

---

## Quick Diagnostic Steps

### Step 1: Open Browser Console

1. Open your chatbot di browser
2. Press **F12** atau **Right-click → Inspect**
3. Go to **Console** tab
4. Reload page
5. Start chatbot interview

### Step 2: Look for These Logs

#### ✅ **Good Signs (AI Working)**:
```
[GENAI-INIT] ✅ Firebase Functions initialized for region: europe-west1
[GENAI] generateNextQuestion called with: {...}
[GENAI] Calling generateAIResponse function...
[GENAI] ✅ AI Response generated successfully
```

#### ❌ **Bad Signs (AI Failing)**:
```
[GENAI-INIT] ❌ Firebase initialization error
[GENAI] Firebase Functions not initialized!
[GENAI] ❌ AI Next Question generation failed
[GENAI] Error details: {...}
[GENAI] Using static fallback response
```

---

## Common Issues & Solutions

### Issue 1: "Firebase initialization error"

**Symptoms in Console**:
```
[GENAI-INIT] ❌ Firebase initialization error
Error: Firebase app named 'genai-app' already exists
```

**Root Cause**: Multiple Firebase instances trying to initialize

**Solution**:
Refresh browser (Ctrl+F5 or Cmd+Shift+R). This is harmless and won't affect functionality.

---

### Issue 2: "Functions not initialized"

**Symptoms in Console**:
```
[GENAI] Firebase Functions not initialized!
[GENAI] ❌ AI Next Question generation failed
```

**Root Cause**: Firebase Functions failed to initialize

**Solution**:

1. Check browser console for initialization errors
2. Verify firebaseConfig in `/services/genai.ts` is correct
3. Clear browser cache and reload

---

### Issue 3: "Permission denied" or "Unauthenticated"

**Symptoms in Console**:
```
[GENAI] Error code: permission-denied
or
[GENAI] Error code: unauthenticated
```

**Root Cause**: Firebase Functions security rules blocking calls

**Solution**:

Check `functions/index.js` - make sure functions don't require authentication:

```javascript
// ✅ CORRECT (No auth required for public assessment)
exports.generateAIResponse = onCall({ region: "europe-west1" }, async (request) => {
  // No auth check here!
  const { role, history, lastUserMessage } = request.data;
  // ...
});

// ❌ WRONG (Blocks public access)
exports.generateAIResponse = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  // ...
});
```

**Fix**:
1. Remove auth checks from functions
2. Redeploy: `firebase deploy --only functions`

---

### Issue 4: "Internal" error or API keys not configured

**Symptoms in Console**:
```
[GENAI] Error code: internal
[GENAI] Error message: "API keys belum dikonfigurasi..."
```

**Root Cause**: API keys NOT set in Firebase Functions config

**Verify Config**:
```bash
firebase functions:config:get
```

**Expected Output**:
```json
{
  "gemini": {
    "key": "AIzaSy..."
  },
  "openai": {
    "key": "sk-proj-..."
  }
}
```

**If Empty**:
```bash
# Set Gemini key
firebase functions:config:set gemini.key="YOUR_GEMINI_KEY"

# Deploy
firebase deploy --only functions
```

---

### Issue 5: Static fallback response from server

**Symptoms**:
- No errors in browser console
- Function logs show: `⚠️ ALL AI PROVIDERS FAILED!`

**Check Firebase Function Logs**:
```bash
firebase functions:log --only generateAIResponse
```

**Look for**:
```
[AI-CONFIG] Gemini API Key present: false
[AI-CONFIG] OpenAI API Key present: false
[AI-CONFIG] NO API KEYS CONFIGURED!
```

**Root Cause**: API keys NOT accessible in functions runtime

**Solution**:

1. **Verify config is set**:
   ```bash
   firebase functions:config:get
   ```

2. **If config exists but not working, redeploy**:
   ```bash
   firebase deploy --only functions --force
   ```

3. **Check functions are using config correctly** (`functions/index.js`):
   ```javascript
   const functions = require("firebase-functions");
   const GEMINI_API_KEY = functions.config().gemini?.key;  // ← Must use functions.config()
   ```

---

### Issue 6: Gemini API failing, no OpenAI fallback

**Symptoms in Function Logs**:
```
[AI] Trying Gemini for role: ...
[ERROR] Gemini failed: API key not valid
⚠️ ALL AI PROVIDERS FAILED!
```

**Root Cause**:
- Invalid Gemini API key, AND
- No OpenAI fallback configured

**Solution**:

**Option A: Fix Gemini key**
```bash
# Get NEW key from: https://aistudio.google.com/apikey
firebase functions:config:set gemini.key="NEW_VALID_KEY"
firebase deploy --only functions
```

**Option B: Add OpenAI fallback**
```bash
# Get key from: https://platform.openai.com/api-keys
firebase functions:config:set openai.key="YOUR_OPENAI_KEY"
firebase deploy --only functions
```

---

### Issue 7: Region mismatch

**Symptoms**:
```
[GENAI] Error code: not-found
[GENAI] Error message: "Function generateAIResponse not found"
```

**Root Cause**: Frontend calling wrong region

**Check regions match**:

1. **Frontend** (`services/genai.ts:24`):
   ```javascript
   functions = getFunctions(app, "europe-west1");  // Must match!
   ```

2. **Backend** (`functions/index.js:230`):
   ```javascript
   exports.generateAIResponse = onCall({ region: "europe-west1" }, ...);  // Must match!
   ```

**If mismatch**:
- Update both to use same region
- Redeploy: `firebase deploy --only functions`

---

## Advanced Debugging

### Use the Diagnostic Tool

Open `test-ai-functions.html` in browser:

This tool will:
- ✅ Test Firebase connection
- ✅ Test AI function calls
- ✅ Show detailed logs
- ✅ Display exact errors

### Check Firebase Function Logs (Real-time)

```bash
# Monitor all function logs
firebase functions:log

# Monitor specific function
firebase functions:log --only generateAIResponse

# Monitor with filters
firebase functions:log --only generateAIResponse,analyzeFraudRisk
```

---

## Verification Checklist

### Frontend Configuration

- [ ] `/services/genai.ts` exists
- [ ] Firebase config has correct project ID
- [ ] Functions initialized with correct region: `europe-west1`
- [ ] `generateNextQuestion` calls `httpsCallable(functions, "generateAIResponse")`
- [ ] Error logging is visible in browser console

### Backend Configuration

- [ ] `functions/index.js` exists
- [ ] `generateAIResponse` function exported
- [ ] Function region is `europe-west1`
- [ ] Function uses `onCall`, not `onRequest`
- [ ] No authentication checks blocking calls
- [ ] Functions config has API keys:
  ```bash
  firebase functions:config:get
  # Should show gemini.key and/or openai.key
  ```

### Deployment

- [ ] Functions deployed successfully
- [ ] Functions visible in Firebase Console
- [ ] Function logs show initialization

### API Keys

- [ ] Gemini API key obtained from: https://aistudio.google.com/apikey
- [ ] API key is valid (not expired, not invalid)
- [ ] API key configured in Firebase:
  ```bash
  firebase functions:config:get
  # Shows: { "gemini": { "key": "AIza..." } }
  ```
- [ ] (Optional) OpenAI key configured as fallback

### Testing

- [ ] Open chatbot in browser
- [ ] Browser console shows `[GENAI-INIT] ✅ Firebase Functions initialized`
- [ ] Send message in chatbot
- [ ] Console shows `[GENAI] ✅ AI Response generated successfully`
- [ ] Response is dynamic (not static fallback)
- [ ] Function logs show: `[AI] Gemini response generated successfully`

---

## Emergency Reset

If nothing works, try this complete reset:

```bash
# 1. Clear function config
firebase functions:config:unset gemini
firebase functions:config:unset openai

# 2. Set fresh API keys
firebase functions:config:set gemini.key="YOUR_NEW_GEMINI_KEY"

# 3. Force redeploy
firebase deploy --only functions --force

# 4. Wait 2 minutes for deployment

# 5. Check logs
firebase functions:log --only generateAIResponse

# 6. Test in browser
# Clear cache (Ctrl+Shift+Delete)
# Open chatbot
# Test message
```

---

## Still Not Working?

### Check These Common Mistakes:

1. **Wrong Firebase project**:
   ```bash
   firebase use
   # Should show: gen-lang-client-0226679970
   ```

2. **Functions not deployed to correct project**:
   ```bash
   firebase functions:list
   # Should show generateAIResponse (europe-west1)
   ```

3. **Billing not enabled**:
   - Firebase Functions requires Blaze plan
   - Check: https://console.firebase.google.com

4. **API quotas exceeded**:
   - Gemini free: 50 req/day
   - Check: https://aistudio.google.com/apikey

5. **Old cached code**:
   - Clear browser cache completely
   - Hard reload: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

---

## Summary

Most common issues:

1. **API keys not configured** → Set with `firebase functions:config:set gemini.key="..."`
2. **Functions not deployed** → Run `firebase deploy --only functions`
3. **Region mismatch** → Both must use `europe-west1`
4. **Invalid API key** → Get fresh key from Google AI Studio
5. **Cached code** → Hard reload browser (Ctrl+F5)

**Remember**: Check BOTH browser console AND Firebase function logs!
