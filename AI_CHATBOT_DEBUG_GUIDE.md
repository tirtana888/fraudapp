# AI Chatbot Debug Guide - API Keys Deployed tapi Static

## Problem Statement

Anda bilang:
- ✅ API Gemini sudah dikonfigurasi
- ✅ API OpenAI sudah dikonfigurasi
- ✅ Sudah sukses deploy
- ❌ **Tapi AI chatbot masih kasih static response**

Mari kita debug step by step!

---

## What I Updated

### Enhanced Logging di `services/genai.ts`

Sekarang code akan log SEMUA detail error ke browser console:

```javascript
// Initialization logs
[GENAI-INIT] Initializing Firebase for Cloud Functions...
[GENAI-INIT] ✅ Firebase Functions initialized for region: europe-west1

// Function call logs
[GENAI] generateNextQuestion called with: {...}
[GENAI] Calling generateAIResponse function...
[GENAI] ✅ AI Response generated successfully

// OR if error:
[GENAI] ❌ AI Next Question generation failed
[GENAI] Error details: {
  message: "...",
  code: "permission-denied",  // ← This tells us what's wrong!
  details: {...}
}
```

---

## Debug Steps

### 1. Open Browser Console

1. Buka chatbot di browser
2. Press **F12**
3. Go to **Console** tab
4. Keep it open

### 2. Reload Page (Hard Reload)

**Windows/Linux**: Ctrl + F5
**Mac**: Cmd + Shift + R

### 3. Check Initialization

Look for:
```
[GENAI-INIT] ✅ Firebase Functions initialized for region: europe-west1
```

✅ **If you see this**: Firebase OK, lanjut step 4
❌ **If error**: Firebase gagal initialize, check config

### 4. Start Chat & Send Message

Complete assessment, start chat, kirim 1 message

### 5. Check Error Code

Look for `[GENAI] Error details:` dan note the **code**:

| Error Code | Problem | Fix |
|------------|---------|-----|
| `permission-denied` | Function butuh auth | Remove auth check |
| `not-found` | Function not found | Deploy ulang |
| `internal` | Server error / API keys | Check function logs |
| `unauthenticated` | Auth required | Remove auth |

---

## Common Issues

### Issue A: Permission Denied

**Console shows**:
```
[GENAI] Error code: permission-denied
```

**Problem**: Function di `functions/index.js` cek authentication

**Fix**: Edit `functions/index.js` line ~230
```javascript
exports.generateAIResponse = onCall({ region: "europe-west1" }, async (request) => {
  // HAPUS BARIS INI:
  // if (!request.auth) throw new HttpsError('unauthenticated', '...');

  // Langsung mulai:
  const { role, history, lastUserMessage } = request.data;
  // ...
});
```

Deploy:
```bash
firebase deploy --only functions
```

---

### Issue B: Function Not Found

**Console shows**:
```
[GENAI] Error code: not-found
```

**Problem**: Function tidak deployed atau region salah

**Fix**:
```bash
# Check deployed functions
firebase functions:list

# Should show:
# generateAIResponse (europe-west1)

# If not there, deploy:
firebase deploy --only functions
```

---

### Issue C: API Keys Not Accessible

**Console**: No obvious error
**Function logs**: `NO API KEYS CONFIGURED!`

**Problem**: Config set tapi tidak loaded di runtime

**Check**:
```bash
firebase functions:log --only generateAIResponse
```

Look for:
```
[AI-CONFIG] Gemini API Key present: false  ← Problem!
[AI-CONFIG] NO API KEYS CONFIGURED!
```

**Fix**:
```bash
# Force redeploy to reload config
firebase deploy --only functions --force

# Wait 2-3 minutes

# Check logs again
firebase functions:log --only generateAIResponse

# Should now show:
# [AI-CONFIG] Gemini API Key present: true
```

---

## Use Diagnostic Tool

### Quick Test

1. Open `test-ai-functions.html` in browser
2. Click "Test Connection" → Should be ✅
3. Click "Test AI Response" → Should generate dynamic response
4. Check logs for errors

Tool ini test langsung tanpa perlu complete full assessment!

---

## Check Function Logs

```bash
firebase functions:log --only generateAIResponse
```

**Good logs**:
```
[AI-CONFIG] Gemini API Key present: true
[AI] Trying Gemini for role: Manajer Keuangan
[AI] Gemini response generated successfully
```

**Bad logs**:
```
[AI-CONFIG] Gemini API Key present: false
[AI-CONFIG] NO API KEYS CONFIGURED!
⚠️ ALL AI PROVIDERS FAILED!
```

---

## Most Likely Issue

Based on "API keys sudah deploy tapi static":

### Config Not Loaded in Runtime (70% chance)

**Why**: You set config, deployed, but runtime didn't reload

**Fix**:
```bash
firebase deploy --only functions --force
```

Wait 2-3 minutes, test again.

---

## Quick Fix Sequence

Try these:

```bash
# 1. Check config
firebase functions:config:get

# Should show:
# {
#   "gemini": { "key": "AIza..." }
# }

# 2. If empty, set it
firebase functions:config:set gemini.key="YOUR_KEY"

# 3. Force redeploy
firebase deploy --only functions --force

# 4. Check logs after 2 min
firebase functions:log --only generateAIResponse

# 5. Clear browser cache & hard reload (Ctrl+F5)

# 6. Test again
```

---

## What to Check Now

1. **Open browser console** - Check for `[GENAI]` logs
2. **Note error code** - permission-denied? not-found? internal?
3. **Check function logs** - `firebase functions:log --only generateAIResponse`
4. **Test with tool** - `test-ai-functions.html`

With detailed logs, you'll see EXACTLY what's failing!

---

## Files to Read

1. **`TROUBLESHOOT_AI_CHATBOT.md`** - Full troubleshooting guide
2. **`test-ai-functions.html`** - Diagnostic testing tool
3. **`AI_QUICK_START.md`** - Quick setup reference

Check browser console logs first - that will tell you the exact issue!
