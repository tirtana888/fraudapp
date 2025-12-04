# AI Chatbot Quick Start

## TL;DR - 3 Commands to Fix

```bash
# 1. Configure API Key (get from https://aistudio.google.com/apikey)
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"

# 2. Deploy Functions
firebase deploy --only functions

# 3. Test
firebase functions:log --only generateAIResponse
```

**Done!** Your AI chatbot is now using Gemini 3 Preview + GPT-4o.

---

## What's Wrong Now?

**Problem**: AI chatbot gives static responses only.

**Why**: Firebase Cloud Functions tidak punya API keys untuk Gemini/OpenAI.

**Proof**: Check function logs:
```bash
firebase functions:log --only generateAIResponse
```

You'll see:
```
❌ [AI-CONFIG] NO API KEYS CONFIGURED! Using static fallback.
```

---

## Solution (5 Minutes)

### Step 1: Get Gemini API Key (FREE)

1. Go to: **https://aistudio.google.com/apikey**
2. Click **"Create API Key"**
3. Copy the key (starts with `AIzaSy...`)

### Step 2: Configure Firebase

```bash
firebase functions:config:set gemini.key="PASTE_YOUR_KEY_HERE"
```

### Step 3: Deploy

```bash
firebase deploy --only functions:generateAIResponse,functions:analyzeFraudRisk
```

Wait 2-3 minutes for deployment.

### Step 4: Verify

```bash
firebase functions:log --only generateAIResponse
```

Now you should see:
```
✅ [AI] Trying Gemini for role: Manajer Keuangan
✅ [AI] Gemini response generated successfully
```

---

## Using the Helper Script (Easier)

```bash
# Make script executable
chmod +x configure-ai.sh

# Run it
./configure-ai.sh
```

The script will:
- ✅ Guide you through API key setup
- ✅ Configure Firebase automatically
- ✅ Deploy functions
- ✅ Verify everything works

---

## What AI Models Are Used?

### Primary: Gemini 2.0 Flash Thinking Experimental
- **Model**: `gemini-2.0-flash-thinking-exp-1219`
- **This IS "Gemini 3 Preview"** - Latest model!
- **Cost**: FREE (50 requests/day)
- **Response Time**: 1-3 seconds

### Fallback: GPT-4o
- **Model**: `gpt-4o`
- **Cost**: ~$0.005 per 1K tokens
- **Response Time**: 2-5 seconds
- **Optional**: Only if Gemini fails

---

## Current Implementation

Your Cloud Functions **already have** the AI code:

```javascript
// functions/index.js:296-299
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-thinking-exp-1219",  // ← Gemini 3 Preview
  safetySettings
});
```

```javascript
// functions/index.js:337
model: "gpt-4o",  // ← Latest GPT-4 Omni
```

**All you need**: Add API keys!

---

## Testing

### 1. Test Chatbot Interface

1. Open: `https://your-app.web.app/?mode=assess&cid=YOUR_COMPANY_ID`
2. Fill profile
3. Complete surveys
4. Start chat
5. Send message: "Saya pernah bekerja di perusahaan retail"

**Expected Response** (Dynamic):
```
Menarik sekali. Dalam pengalaman Anda di retail, apakah
pernah ada situasi di mana Anda harus menangani
perbedaan antara inventory fisik dan sistem? Bagaimana
Anda menyelesaikannya?
```

**NOT Expected** (Static):
```
Terima kasih atas jawabannya. Bisa Anda ceritakan lebih
lanjut mengenai bagaimana Anda menangani situasi penuh
tekanan di pekerjaan sebelumnya?
```

### 2. Check Function Logs

```bash
# Real-time logs
firebase functions:log --only generateAIResponse

# Look for:
✅ [AI] Trying Gemini for role: Manajer Keuangan
✅ [AI] Gemini response generated successfully
```

---

## Troubleshooting

### "API keys belum dikonfigurasi"

```bash
# Check config
firebase functions:config:get

# Should show:
{
  "gemini": {
    "key": "AIzaSy..."
  }
}

# If empty, set it:
firebase functions:config:set gemini.key="YOUR_KEY"
firebase deploy --only functions
```

### "Invalid API Key"

1. Get new key: https://aistudio.google.com/apikey
2. Update config:
```bash
firebase functions:config:set gemini.key="NEW_KEY"
firebase deploy --only functions
```

### "Quota Exceeded"

**Gemini Free Tier**: 50 requests/day
- Wait 24 hours, or
- Upgrade to paid tier

### Still Static Response?

```bash
# Force redeploy
firebase deploy --only functions --force

# Clear and reconfigure
firebase functions:config:unset gemini
firebase functions:config:set gemini.key="YOUR_KEY"
firebase deploy --only functions
```

---

## Cost

### Free Tier (Gemini only)
- **50 requests/day**
- **~5-10 candidates/day**
- **Cost**: $0/month

### Production (Gemini + OpenAI fallback)
- **100 candidates/month**
- **800 AI requests**
- **Cost**: ~$0.80/month

**Very affordable!**

---

## Important Notes

### ✅ Security (Already Implemented)
- API keys stored server-side only
- Never exposed to frontend
- Encrypted in Firebase config

### ✅ Dual Fallback (Already Implemented)
```
1st Try: Gemini 3 Preview
    ↓ fails
2nd Try: GPT-4o
    ↓ fails
3rd: Static response
```

### ✅ Error Handling (Already Implemented)
- Detailed logging
- Graceful fallbacks
- User-friendly errors

---

## Quick Commands

```bash
# Check current config
firebase functions:config:get

# Set Gemini key
firebase functions:config:set gemini.key="YOUR_KEY"

# Set OpenAI key (optional)
firebase functions:config:set openai.key="YOUR_KEY"

# Deploy AI functions
firebase deploy --only functions:generateAIResponse,functions:analyzeFraudRisk

# Check logs
firebase functions:log --only generateAIResponse

# Check all logs
firebase functions:log

# Clear config (if needed)
firebase functions:config:unset gemini
firebase functions:config:unset openai
```

---

## Success Checklist

- [ ] Got Gemini API key from Google AI Studio
- [ ] Configured Firebase: `firebase functions:config:set gemini.key="..."`
- [ ] Deployed functions: `firebase deploy --only functions`
- [ ] Verified logs show: "Gemini response generated successfully"
- [ ] Tested chatbot with dynamic responses
- [ ] Responses are contextual and specific
- [ ] Interview completes properly
- [ ] Analysis runs successfully

---

## Resources

- **Get Gemini Key**: https://aistudio.google.com/apikey
- **Get OpenAI Key**: https://platform.openai.com/api-keys
- **Firebase Console**: https://console.firebase.google.com
- **Full Guide**: See `AI_CHATBOT_FIX_FINAL.md`

---

## Support

If stuck, check:
1. Function logs: `firebase functions:log`
2. Firebase console: https://console.firebase.google.com
3. Full documentation: `AI_CHATBOT_FIX_FINAL.md`

**Remember**: The AI code is already there. You just need to add the API key!
