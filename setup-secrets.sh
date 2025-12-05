#!/bin/bash

# ============================================
# Setup Firebase Secrets untuk MVP Production
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "================================================"
echo "   🔐 HIREGOOD MVP - FIREBASE SECRETS SETUP"
echo "================================================"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Script ini akan mengonfigurasi semua API keys untuk production${NC}"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Error: Firebase CLI tidak terinstall!${NC}"
    echo "Install dengan: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Error: Anda belum login ke Firebase!${NC}"
    echo "Login dengan: firebase login"
    exit 1
fi

echo -e "${GREEN}✅ Firebase CLI terdeteksi${NC}"
echo ""

# ============================================
# 1. RESEND API KEY (Email Service)
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. RESEND API KEY (Email Service)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dapatkan Resend API Key dari:"
echo "  👉 https://resend.com/api-keys"
echo ""
echo -e "${YELLOW}Format: re_xxxxxxxxxxxxxxxxxxxx${NC}"
echo ""
read -p "Masukkan Resend API Key: " RESEND_KEY

if [ -z "$RESEND_KEY" ]; then
    echo -e "${RED}❌ Resend API Key wajib diisi!${NC}"
    exit 1
fi

# ============================================
# 2. GEMINI API KEY (Primary AI)
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. GEMINI API KEY (Primary AI)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dapatkan Gemini API Key dari:"
echo "  👉 https://aistudio.google.com/apikey"
echo ""
echo -e "${YELLOW}Format: AIzaSy...${NC}"
echo ""
read -p "Masukkan Gemini API Key: " GEMINI_KEY

if [ -z "$GEMINI_KEY" ]; then
    echo -e "${RED}❌ Gemini API Key wajib diisi!${NC}"
    exit 1
fi

# ============================================
# 3. OPENAI API KEY (Fallback AI)
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. OPENAI API KEY (Fallback AI) - OPTIONAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dapatkan OpenAI API Key dari:"
echo "  👉 https://platform.openai.com/api-keys"
echo ""
echo -e "${YELLOW}Format: sk-proj-...${NC}"
echo -e "${YELLOW}(Tekan Enter untuk skip)${NC}"
echo ""
read -p "Masukkan OpenAI API Key (optional): " OPENAI_KEY

# ============================================
# 4. DIDIT API KEY (Background Check)
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. DIDIT API KEY (Background Check)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dapatkan Didit API Key dari Didit Dashboard"
echo ""
read -p "Masukkan Didit API Key: " DIDIT_KEY

if [ -z "$DIDIT_KEY" ]; then
    echo -e "${RED}❌ Didit API Key wajib diisi!${NC}"
    exit 1
fi

# ============================================
# 5. DIDIT WEBHOOK SECRET
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. DIDIT WEBHOOK SECRET${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Dapatkan Webhook Secret dari Didit Dashboard"
echo ""
read -p "Masukkan Didit Webhook Secret: " DIDIT_WEBHOOK

if [ -z "$DIDIT_WEBHOOK" ]; then
    echo -e "${RED}❌ Didit Webhook Secret wajib diisi!${NC}"
    exit 1
fi

# ============================================
# KONFIRMASI
# ============================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 RINGKASAN KONFIGURASI${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. Resend API Key: ${RESEND_KEY:0:10}..."
echo "2. Gemini API Key: ${GEMINI_KEY:0:10}..."
if [ ! -z "$OPENAI_KEY" ]; then
    echo "3. OpenAI API Key: ${OPENAI_KEY:0:10}..."
else
    echo "3. OpenAI API Key: (tidak diset)"
fi
echo "4. Didit API Key: ${DIDIT_KEY:0:10}..."
echo "5. Didit Webhook Secret: ${DIDIT_WEBHOOK:0:10}..."
echo ""
read -p "Lanjutkan deploy secrets? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}❌ Setup dibatalkan${NC}"
    exit 1
fi

# ============================================
# DEPLOY SECRETS
# ============================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 DEPLOYING SECRETS...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set Resend API Key
echo "Setting RESEND_API_KEY..."
echo "$RESEND_KEY" | firebase functions:secrets:set RESEND_API_KEY
echo -e "${GREEN}✅ RESEND_API_KEY set${NC}"

# Set Gemini API Key
echo "Setting GEMINI_API_KEY..."
echo "$GEMINI_KEY" | firebase functions:secrets:set GEMINI_API_KEY
echo -e "${GREEN}✅ GEMINI_API_KEY set${NC}"

# Set OpenAI API Key (jika ada)
if [ ! -z "$OPENAI_KEY" ]; then
    echo "Setting OPENAI_API_KEY..."
    echo "$OPENAI_KEY" | firebase functions:secrets:set OPENAI_API_KEY
    echo -e "${GREEN}✅ OPENAI_API_KEY set${NC}"
fi

# Set Didit API Key
echo "Setting DIDIT_API_KEY..."
echo "$DIDIT_KEY" | firebase functions:secrets:set DIDIT_API_KEY
echo -e "${GREEN}✅ DIDIT_API_KEY set${NC}"

# Set Didit Webhook Secret
echo "Setting DIDIT_WEBHOOK_SECRET..."
echo "$DIDIT_WEBHOOK" | firebase functions:secrets:set DIDIT_WEBHOOK_SECRET
echo -e "${GREEN}✅ DIDIT_WEBHOOK_SECRET set${NC}"

# ============================================
# SELESAI
# ============================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ SECRETS BERHASIL DIKONFIGURASI!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Langkah selanjutnya:${NC}"
echo ""
echo "1. Deploy Firebase Functions:"
echo "   ${BLUE}firebase deploy --only functions${NC}"
echo ""
echo "2. Verifikasi secrets:"
echo "   ${BLUE}firebase functions:secrets:list${NC}"
echo ""
echo -e "${GREEN}🎉 Aplikasi siap untuk production!${NC}"
echo ""
