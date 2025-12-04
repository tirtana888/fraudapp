# Set API Keys - Quick Guide

## Problem Detected

Your API keys are configured but **INVALID**. Both Gemini and OpenAI are rejecting them.

From Firebase logs:
```
❌ Gemini 3.0 Gagal: API key not valid. Please pass a valid API key.
❌ OpenAI failed: 401 Incorrect API key provided
```

## Solution (3 Steps)

### Step 1: Get Valid Gemini API Key (FREE)

1. Go to: **https://aistudio.google.com/apikey**
2. Sign in with Google account
3. Click **"Create API Key"** or **"Get API Key"**
4. Copy the key (starts with `AIzaSy...`)
5. Key should be **39 characters long**

### Step 2: Update Firebase Secret

```bash
# Delete old invalid secret
firebase functions:secrets:destroy GEMINI_API_KEY

# Create new secret with valid key
firebase functions:secrets:set GEMINI_API_KEY

# When prompted, paste your NEW valid Gemini API key
# Press Enter to confirm
```

### Step 3: Deploy Updated Functions

```bash
# Deploy with updated code and new secrets
firebase deploy --only functions:generateAIResponse,functions:analyzeFraudRisk
```

Wait 2-3 minutes for deployment to complete.

## Verify It Works

### Check Logs
```bash
firebase functions:log --only generateAIResponse
```

You should see:
```
✅ [AI-CONFIG] Gemini API Key present: true
✅ [AI-CONFIG] Gemini API Key length: 39
✅ [AI] Gemini response generated successfully
```

NOT:
```
❌ API key not valid
❌ Incorrect API key provided
```

### Test Chatbot

1. Open your app assessment page
2. Complete profile and surveys
3. Start chat interview
4. Send message: "Halo, saya siap"
5. You should get a **contextual AI response** (not static fallback)

## Optional: Add OpenAI as Fallback

If you want OpenAI GPT-4o as backup (paid):

```bash
# Get API key from: https://platform.openai.com/api-keys

# Set secret
firebase functions:secrets:set OPENAI_API_KEY

# Paste your OpenAI key when prompted
```

Then deploy again:
```bash
firebase deploy --only functions
```

## Common Issues

### "API key not valid"

- Key is expired or wrong
- Get a fresh key from https://aistudio.google.com/apikey
- Make sure you copied the ENTIRE key (39 characters)

### "Secret not found"

```bash
# List all secrets
firebase functions:secrets:list

# If GEMINI_API_KEY not there, create it:
firebase functions:secrets:set GEMINI_API_KEY
```

### "Permission denied"

```bash
# Make sure you're logged in as project owner
firebase login

# Select correct project
firebase use gen-lang-client-0226679970
```

## Cost Estimate

**With Gemini only (FREE tier):**
- 50 requests/day
- ~5-10 candidates/day
- Cost: $0/month

**With Gemini + OpenAI fallback:**
- Unlimited candidates
- Gemini free, OpenAI $0.005 per 1K tokens
- ~100 candidates/month = ~$0.80/month

## Quick Commands Reference

```bash
# List secrets
firebase functions:secrets:list

# Set new secret
firebase functions:secrets:set GEMINI_API_KEY

# Delete secret
firebase functions:secrets:destroy GEMINI_API_KEY

# View secret value (first 10 chars)
firebase functions:secrets:access GEMINI_API_KEY

# Deploy functions
firebase deploy --only functions

# Watch logs
firebase functions:log --only generateAIResponse

# Force redeploy
firebase deploy --only functions --force
```

## Success Checklist

- [ ] Got valid Gemini API key (39 chars, starts with AIzaSy...)
- [ ] Destroyed old invalid secret
- [ ] Created new secret with valid key
- [ ] Deployed updated functions code
- [ ] Logs show "Gemini API Key length: 39"
- [ ] Logs show "Gemini response generated successfully"
- [ ] Chatbot gives contextual responses (not static)
- [ ] Interview completes properly

---

## Need Help?

If still having issues:

1. **Check logs**: `firebase functions:log`
2. **Verify key length**: Should be 39 characters
3. **Try new key**: Get fresh one from Google AI Studio
4. **Check quota**: Free tier = 50 requests/day

**Remember**: The code is already updated. You just need to set a VALID API key!
