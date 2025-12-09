#!/bin/bash

# FraudGuard Quick Deploy Script
# Pastikan tidak ada package-lock.json dan gunakan Yarn

set -e

echo "🚀 FraudGuard SaaS - Quick Deploy to Firebase Hosting"
echo "=================================================="
echo ""

# Step 1: Verify dependencies
echo "📦 Step 1: Verifying dependencies..."
if [ -f "package-lock.json" ]; then
    echo "⚠️  WARNING: package-lock.json detected! Removing..."
    rm -f package-lock.json
    echo "✅ package-lock.json removed"
fi

if [ ! -f "yarn.lock" ]; then
    echo "❌ ERROR: yarn.lock not found!"
    exit 1
fi

echo "✅ Using yarn.lock"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Installing dependencies with Yarn..."
yarn install --frozen-lockfile
echo "✅ Dependencies installed"
echo ""

# Step 3: Check integrity
echo "🔍 Step 3: Checking dependency integrity..."
yarn check --integrity
echo "✅ Dependencies are in sync"
echo ""

# Step 4: Build application
echo "🏗️  Step 4: Building application..."
yarn build
echo "✅ Build completed"
echo ""

# Step 5: Check build output
echo "📊 Step 5: Checking build output..."
if [ -d "dist" ]; then
    echo "✅ dist/ folder exists"
    echo "📁 Build files:"
    ls -lh dist/
    echo ""
else
    echo "❌ ERROR: dist/ folder not found!"
    exit 1
fi

# Step 6: Ready to deploy
echo "✨ READY FOR DEPLOYMENT!"
echo ""
echo "To deploy to Firebase Hosting, run:"
echo "  firebase deploy --only hosting"
echo ""
echo "To deploy everything (hosting + functions + rules):"
echo "  firebase deploy"
echo ""
echo "=================================================="
