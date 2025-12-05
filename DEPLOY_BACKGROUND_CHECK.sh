#!/bin/bash

echo "🚀 Deploying Background Check Function..."
echo ""

# Deploy function
cd functions
npm install
cd ..

echo ""
echo "📦 Installing dependencies..."
firebase deploy --only functions:initiateBackgroundCheck

echo ""
echo "✅ Background Check Function deployed!"
echo ""
echo "📋 Next Steps:"
echo "1. Test by clicking 'Cek Latar' button on a candidate"
echo "2. Check candidate email for verification link"
echo "3. Complete KYC verification on Didit"
echo "4. Webhook will update status automatically"
