#!/bin/bash

# ========================================
# DEPLOY SCRIPT: Resend Email Integration
# ========================================

echo "🚀 Deploying Resend Email Integration..."
echo ""

# Step 1: Install dependencies
echo "📦 Step 1/3: Installing dependencies..."
cd functions
npm install
cd ..

echo "✅ Dependencies installed!"
echo ""

# Step 2: Deploy Functions
echo "🔥 Step 2/3: Deploying Firebase Functions..."
firebase deploy --only functions

echo "✅ Functions deployed!"
echo ""

# Step 3: Summary
echo "📧 Step 3/3: Email System Summary"
echo "========================================"
echo "✅ Business emails: no-reply@hiregoode.one"
echo "✅ Interview emails: interview@hiregoode.one"
echo ""
echo "📝 Available Email Types:"
echo "  1. business_invitation"
echo "  2. candidate_invitation"
echo "  3. assessment_complete"
echo "  4. password_reset"
echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📚 Read RESEND_EMAIL_MIGRATION.md for testing & troubleshooting"
