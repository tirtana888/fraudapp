#!/bin/bash

# FraudGuard SaaS Production Deployment Script
# Usage: ./deploy.sh [functions|hosting|all]

set -e

echo "🚀 FraudGuard SaaS Deployment Script"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found!${NC}"
    echo "Install with: npm install -g firebase-tools"
    exit 1
fi

echo -e "${GREEN}✅ Firebase CLI found${NC}"
echo ""

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Firebase${NC}"
    echo "Run: firebase login"
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Firebase${NC}"
echo ""

# Deployment type
DEPLOY_TYPE=${1:-all}

# Deploy Functions
if [ "$DEPLOY_TYPE" = "functions" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo -e "${YELLOW}📦 Installing Functions dependencies...${NC}"
    cd functions
    npm install
    cd ..
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""

    echo -e "${YELLOW}🔧 Deploying Firebase Functions...${NC}"
    firebase deploy --only functions
    echo -e "${GREEN}✅ Functions deployed${NC}"
    echo ""
fi

# Deploy Hosting
if [ "$DEPLOY_TYPE" = "hosting" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo -e "${YELLOW}🏗️  Building frontend...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""

    echo -e "${YELLOW}🌐 Deploying to Firebase Hosting...${NC}"
    firebase deploy --only hosting
    echo -e "${GREEN}✅ Hosting deployed${NC}"
    echo ""
fi

# Summary
echo ""
echo "===================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "===================================="
echo ""

if [ "$DEPLOY_TYPE" = "functions" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo "📧 Email functions are now live"
    echo "View logs: firebase functions:log --only sendEmailViaEmailJS"
    echo ""
fi

if [ "$DEPLOY_TYPE" = "hosting" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo "🌐 Frontend is now live"
    echo "View site: firebase hosting:channel:open live"
    echo ""
fi

echo "📊 Monitor at: https://console.firebase.google.com/project/gen-lang-client-0226679970"
echo ""
