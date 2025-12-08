/**
 * Firebase Cloud Function to handle Xendit Payment Webhook
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Add this function to your /functions/index.js
 * 2. Deploy: firebase deploy --only functions:xenditWebhook
 * 3. Get the function URL from Firebase Console
 * 4. Set this URL as webhook in Xendit Dashboard:
 *    https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/xenditWebhook
 * 5. Add verification token to env: XENDIT_WEBHOOK_TOKEN
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Xendit Webhook Handler
 * Processes payment callbacks and updates credits/subscriptions
 */
exports.xenditWebhook = functions
  .region('europe-west1') // Match your region
  .https.onRequest(async (req, res) => {
    console.log('[XENDIT-WEBHOOK] Received webhook');
    
    // Verify it's a POST request
    if (req.method !== 'POST') {
      console.log('[XENDIT-WEBHOOK] Invalid method:', req.method);
      return res.status(405).send('Method Not Allowed');
    }

    try {
      const webhookData = req.body;
      
      // Verify Xendit webhook token (optional but recommended)
      const xenditToken = req.headers['x-callback-token'];
      const expectedToken = functions.config().xendit?.webhook_token;
      
      if (expectedToken && xenditToken !== expectedToken) {
        console.log('[XENDIT-WEBHOOK] Invalid token');
        return res.status(401).send('Unauthorized');
      }

      console.log('[XENDIT-WEBHOOK] Webhook data:', {
        id: webhookData.id,
        external_id: webhookData.external_id,
        status: webhookData.status,
        amount: webhookData.amount
      });

      // Only process PAID status
      if (webhookData.status !== 'PAID') {
        console.log('[XENDIT-WEBHOOK] Ignoring non-PAID status:', webhookData.status);
        return res.status(200).json({ message: 'Ignored non-PAID status' });
      }

      // Parse external_id
      const externalId = webhookData.external_id;
      const parts = externalId.split('_');
      const type = parts[0]; // 'topup' or 'premium'
      const companyId = parts[1];

      if (!companyId) {
        throw new Error('Invalid external_id format');
      }

      console.log('[XENDIT-WEBHOOK] Processing payment:', { type, companyId });

      // Get company reference
      const companyRef = db.collection('companies').doc(companyId);
      const companyDoc = await companyRef.get();

      if (!companyDoc.exists) {
        throw new Error(`Company ${companyId} not found`);
      }

      const companyData = companyDoc.data();
      const currentCredits = companyData.credits || 0;

      if (type === 'topup') {
        // Process credit top-up
        const amount = webhookData.amount;
        const credits = Math.floor(amount / 100); // 100 IDR per credit
        const newBalance = currentCredits + credits;

        // Use transaction for atomicity
        await db.runTransaction(async (transaction) => {
          // Update company credits
          transaction.update(companyRef, {
            credits: newBalance
          });

          // Log transaction
          const transactionData = {
            companyId: companyId,
            type: 'credit',
            amount: credits,
            action: 'TOP_UP',
            description: `Credit Top-Up: ${credits} credits`,
            balanceBefore: currentCredits,
            balanceAfter: newBalance,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
              paymentId: webhookData.id,
              invoiceId: webhookData.id
            }
          };

          transaction.set(
            db.collection('credit_transactions').doc(),
            transactionData
          );
        });

        console.log('[XENDIT-WEBHOOK] ✅ Top-up processed:', { companyId, credits, newBalance });

        return res.status(200).json({
          success: true,
          message: `Added ${credits} credits to company ${companyId}`
        });

      } else if (type === 'premium') {
        // Process premium upgrade
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);

        const monthlyCredits = 1500; // Premium plan credits
        const newBalance = currentCredits + monthlyCredits;

        // Use transaction for atomicity
        await db.runTransaction(async (transaction) => {
          // Update company to Premium
          transaction.update(companyRef, {
            tier: 'Premium',
            credits: newBalance,
            subscriptionStartDate: now.toISOString(),
            subscriptionEndDate: endDate.toISOString(),
            monthlyCredits: monthlyCredits
          });

          // Log transaction
          const transactionData = {
            companyId: companyId,
            type: 'credit',
            amount: monthlyCredits,
            action: 'SUBSCRIPTION',
            description: `Upgraded to Premium plan - ${monthlyCredits} credits added`,
            balanceBefore: currentCredits,
            balanceAfter: newBalance,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
              paymentId: webhookData.id,
              invoiceId: webhookData.id
            }
          };

          transaction.set(
            db.collection('credit_transactions').doc(),
            transactionData
          );
        });

        console.log('[XENDIT-WEBHOOK] ✅ Premium upgrade processed:', { companyId, newBalance });

        return res.status(200).json({
          success: true,
          message: `Company ${companyId} upgraded to Premium`
        });

      } else {
        throw new Error(`Unknown payment type: ${type}`);
      }

    } catch (error) {
      console.error('[XENDIT-WEBHOOK] ❌ Error processing webhook:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  });

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Add to your functions/index.js:
 *    exports.xenditWebhook = require('./xenditWebhook').xenditWebhook;
 * 
 * 2. Set webhook verification token:
 *    firebase functions:config:set xendit.webhook_token="YOUR_SECRET_TOKEN"
 * 
 * 3. Deploy function:
 *    firebase deploy --only functions:xenditWebhook
 * 
 * 4. Configure webhook URL in Xendit Dashboard:
 *    Go to Settings > Webhooks
 *    Add: https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/xenditWebhook
 *    Select events: invoice.paid
 * 
 * 5. Test webhook:
 *    Use Xendit webhook simulator in dashboard
 */
