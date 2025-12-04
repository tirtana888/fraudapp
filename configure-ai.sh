#!/bin/bash

# AI Chatbot Configuration & Deployment Script
# This script helps configure Firebase Functions with Gemini and OpenAI API keys

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  AI Chatbot Configuration Helper"
echo "========================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not installed!${NC}"
    echo ""
    echo "Install Firebase CLI with:"
    echo "  npm install -g firebase-tools"
    echo ""
    echo "Then login:"
    echo "  firebase login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Firebase CLI detected${NC}"
echo ""

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Firebase${NC}"
    echo ""
    echo "Login first with:"
    echo "  firebase login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Firebase authentication verified${NC}"
echo ""

# Display current configuration
echo -e "${BLUE}Current Firebase Functions Configuration:${NC}"
firebase functions:config:get || echo "No configuration set"
echo ""

# Get Gemini API Key
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Gemini API Key (REQUIRED)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Get your FREE Gemini API key from:"
echo "  https://aistudio.google.com/apikey"
echo ""
echo -e "Enter your Gemini API Key (or press Enter to skip):"
read -s GEMINI_KEY

if [ -z "$GEMINI_KEY" ]; then
    echo -e "${YELLOW}⚠️  Skipping Gemini configuration${NC}"
    CONFIGURE_GEMINI=false
else
    echo -e "${GREEN}✅ Gemini API key received${NC}"
    CONFIGURE_GEMINI=true
fi

echo ""

# Get OpenAI API Key
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: OpenAI API Key (OPTIONAL)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This is optional - used as fallback if Gemini fails"
echo "Get your OpenAI API key from:"
echo "  https://platform.openai.com/api-keys"
echo ""
echo -e "Enter your OpenAI API Key (or press Enter to skip):"
read -s OPENAI_KEY

if [ -z "$OPENAI_KEY" ]; then
    echo -e "${YELLOW}⚠️  Skipping OpenAI configuration${NC}"
    CONFIGURE_OPENAI=false
else
    echo -e "${GREEN}✅ OpenAI API key received${NC}"
    CONFIGURE_OPENAI=true
fi

echo ""

# Check if at least one key is provided
if [ "$CONFIGURE_GEMINI" = false ] && [ "$CONFIGURE_OPENAI" = false ]; then
    echo -e "${RED}❌ Error: At least one API key is required!${NC}"
    echo ""
    echo "You must provide either:"
    echo "  - Gemini API key (recommended, FREE)"
    echo "  - OpenAI API key (paid)"
    echo "  - Both (for dual-fallback)"
    echo ""
    exit 1
fi

# Confirm configuration
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Configuration Summary:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$CONFIGURE_GEMINI" = true ]; then
    echo -e "${GREEN}✅ Gemini 2.0 Flash Thinking (Gemini 3 Preview)${NC}"
else
    echo -e "${RED}❌ Gemini (skipped)${NC}"
fi

if [ "$CONFIGURE_OPENAI" = true ]; then
    echo -e "${GREEN}✅ GPT-4o (Fallback)${NC}"
else
    echo -e "${YELLOW}⚠️  GPT-4o (skipped - no fallback)${NC}"
fi

echo ""
echo "Proceed with configuration? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Configuration cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Setting Firebase Functions config...${NC}"
echo ""

# Set Gemini key
if [ "$CONFIGURE_GEMINI" = true ]; then
    echo "Setting Gemini API key..."
    firebase functions:config:set gemini.key="$GEMINI_KEY"
    echo -e "${GREEN}✅ Gemini API key configured${NC}"
fi

# Set OpenAI key
if [ "$CONFIGURE_OPENAI" = true ]; then
    echo "Setting OpenAI API key..."
    firebase functions:config:set openai.key="$OPENAI_KEY"
    echo -e "${GREEN}✅ OpenAI API key configured${NC}"
fi

echo ""
echo -e "${BLUE}Verifying configuration...${NC}"
firebase functions:config:get
echo ""

# Ask if user wants to deploy now
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Deploy Functions${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Deploy Cloud Functions now? (y/n)"
echo "This will take 2-5 minutes."
read -r DEPLOY

if [ "$DEPLOY" = "y" ] || [ "$DEPLOY" = "Y" ]; then
    echo ""
    echo -e "${BLUE}Deploying AI functions...${NC}"
    echo ""

    firebase deploy --only functions:generateAIResponse,functions:analyzeFraudRisk

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ SUCCESS! AI Chatbot is now active!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Your AI chatbot is now using:"
        if [ "$CONFIGURE_GEMINI" = true ]; then
            echo -e "  ${GREEN}• Gemini 2.0 Flash Thinking (Primary)${NC}"
        fi
        if [ "$CONFIGURE_OPENAI" = true ]; then
            echo -e "  ${GREEN}• GPT-4o (Fallback)${NC}"
        fi
        echo ""
        echo "Test your chatbot at:"
        echo "  https://your-app.web.app/?mode=assess&cid=YOUR_COMPANY_ID"
        echo ""
        echo "Monitor function logs with:"
        echo "  firebase functions:log --only generateAIResponse"
        echo ""
    else
        echo ""
        echo -e "${RED}❌ Deployment failed!${NC}"
        echo ""
        echo "Check errors above and try again with:"
        echo "  firebase deploy --only functions"
        echo ""
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}⚠️  Deployment skipped${NC}"
    echo ""
    echo "Configuration saved. Deploy later with:"
    echo "  firebase deploy --only functions"
    echo ""
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Configuration Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Test the chatbot in your app"
echo "  2. Monitor logs: firebase functions:log"
echo "  3. Check usage/quota in API dashboards"
echo ""
echo "API Dashboards:"
if [ "$CONFIGURE_GEMINI" = true ]; then
    echo "  • Gemini: https://aistudio.google.com/apikey"
fi
if [ "$CONFIGURE_OPENAI" = true ]; then
    echo "  • OpenAI: https://platform.openai.com/usage"
fi
echo ""
echo "For help, see: AI_CHATBOT_FIX_FINAL.md"
echo ""
