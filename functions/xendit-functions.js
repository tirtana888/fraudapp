/**
 * XENDIT PAYMENT INTEGRATION
 * Handles credit purchase and subscription tier upgrades
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const db = getFirestore();

// Secrets
const xenditApiKey = defineSecret("XENDIT_API_KEY");
const xenditWebhookToken = defineSecret("XENDIT_WEBHOOK_TOKEN");

// Pricing Configuration
const PRICING = {
    credits: {
        200: 2000,      // Rp 2,000 (testing package)
        1000: 100000,   // Rp 100,000
        5000: 450000,   // Rp 450,000 (10% discount)
        10000: 800000   // Rp 800,000 (20% discount)
    },
    subscriptions: {
        Premium: 500000,      // Rp 500,000/month
        Enterprise: 2000000   // Rp 2,000,000/month
    }
};

/**
 * Create Xendit Invoice for credit purchase or subscription upgrade
 */
exports.createXenditInvoice = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [xenditApiKey]
}, async (request) => {
    const { type, amount, companyId, companyName, companyEmail, tier } = request.data;

    // Validate input
    if (!type || !companyId || !companyName || !companyEmail) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    if (type !== 'credit_purchase' && type !== 'subscription_upgrade') {
        throw new HttpsError('invalid-argument', 'Invalid payment type');
    }

    try {
        let description, price;

        if (type === 'credit_purchase') {
            if (!amount || !PRICING.credits[amount]) {
                throw new HttpsError('invalid-argument', 'Invalid credit amount');
            }
            price = PRICING.credits[amount];
            description = `Purchase ${amount.toLocaleString('id-ID')} Credits - ${companyName}`;
        } else {
            if (!tier || !PRICING.subscriptions[tier]) {
                throw new HttpsError('invalid-argument', 'Invalid subscription tier');
            }
            price = PRICING.subscriptions[tier];
            description = `Upgrade to ${tier} Tier - ${companyName}`;
        }

        // Get API Key (Secret or Fallback for Local Dev)
        let apiKey = xenditApiKey.value();
        if (!apiKey || apiKey === '') {
            logger.warn('[XENDIT] Secret/Env not found, using fallback for local dev');
            // Fallback for local testing only
            apiKey = 'xnd_production_dIN7dRfeoCqQx0YL5q49OOs68KNeqGgyMRl9oOQX4kAoWsfMY3nqT058TcPl';
        }

        // Create invoice via Xendit API
        const response = await axios.post(
            'https://api.xendit.co/v2/invoices',
            {
                external_id: `${type}_${companyId}_${Date.now()}`,
                amount: price,
                payer_email: companyEmail,
                description: description,
                currency: 'IDR',
                invoice_duration: 86400, // 24 hours
                success_redirect_url: `${process.env.APP_URL || 'http://localhost:3001'}/?payment=success&redirect=credits`,
                failure_redirect_url: `${process.env.APP_URL || 'http://localhost:3001'}/?payment=failed`,
                payment_methods: ['QRIS'], // Only accept QRIS payments
                metadata: {
                    type,
                    companyId,
                    companyName,
                    ...(type === 'credit_purchase' ? { credits: amount } : { tier })
                }
            },
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info(`[XENDIT] Invoice created: ${response.data.id}`, {
            type,
            companyId,
            amount: type === 'credit_purchase' ? amount : tier,
            price
        });

        return {
            success: true,
            invoiceUrl: response.data.invoice_url,
            invoiceId: response.data.id,
            expiryDate: response.data.expiry_date
        };

    } catch (error) {
        logger.error('[XENDIT] Invoice creation failed:', error.response?.data || error.message);
        throw new HttpsError('internal', `Failed to create invoice: ${error.message}`);
    }
});

/**
 * Handle Xendit Webhook for payment notifications
 */
exports.handleXenditWebhook = onRequest({
    region: "europe-west1",
    secrets: [xenditWebhookToken]
}, async (req, res) => {
    try {
        // Verify webhook signature
        const callbackToken = req.headers['x-callback-token'];
        if (callbackToken !== xenditWebhookToken.value()) {
            logger.warn('[XENDIT] Invalid webhook token');
            res.status(403).send('Invalid signature');
            return;
        }

        const payload = req.body;
        logger.info('[XENDIT] Webhook received:', {
            id: payload.id,
            status: payload.status,
            external_id: payload.external_id
        });

        // Only process paid invoices
        if (payload.status !== 'PAID') {
            logger.info('[XENDIT] Invoice not paid, skipping');
            res.status(200).send('OK');
            return;
        }

        // Get metadata from payload or parse from external_id
        let metadata = payload.metadata || {};
        let { type, companyId, credits, tier } = metadata;

        // Fallback: Parse from external_id if metadata is missing
        if (!type || !companyId) {
            logger.warn('[XENDIT] Metadata missing, parsing from external_id');
            const externalId = payload.external_id || '';
            const parts = externalId.split('_');

            if (parts.length >= 3) {
                type = parts[0]; // 'credit' or 'subscription'
                if (parts[0] === 'credit') {
                    type = 'credit_purchase';
                } else if (parts[0] === 'subscription') {
                    type = 'subscription_upgrade';
                }
                companyId = parts[parts.length - 2]; // Second to last part

                // For credit purchase, calculate credits from amount
                if (type === 'credit_purchase') {
                    // Get credits from pricing lookup
                    const amount = payload.amount || payload.paid_amount || 0;
                    const PRICING_REVERSE = {
                        2000: 200,
                        100000: 1000,
                        450000: 5000,
                        800000: 10000
                    };
                    credits = PRICING_REVERSE[amount] || Math.floor(amount / 10); // Fallback: 1 credit = Rp 10
                }

                logger.info('[XENDIT] Parsed from external_id:', { type, companyId, credits });
            }
        }

        if (!type || !companyId) {
            logger.error('[XENDIT] Missing metadata in webhook', {
                external_id: payload.external_id,
                metadata: payload.metadata,
                payload: JSON.stringify(payload)
            });
            res.status(400).send('Missing metadata');
            return;
        }

        // Process based on payment type
        if (type === 'credit_purchase') {
            await processCreditPurchase(companyId, credits, payload);
        } else if (type === 'subscription_upgrade') {
            await processTierUpgrade(companyId, tier, payload);
        }

        res.status(200).send('OK');

    } catch (error) {
        logger.error('[XENDIT] Webhook processing error:', error);
        res.status(500).send('Internal error');
    }
});

/**
 * Process credit purchase after successful payment
 */
async function processCreditPurchase(companyId, credits, paymentData) {
    try {
        const companyRef = db.collection('companies').doc(companyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            throw new Error('Company not found');
        }

        const currentCredits = companyDoc.data().credits || 0;
        const newBalance = currentCredits + parseInt(credits);

        // Update company credits
        await companyRef.update({
            credits: newBalance,
            last_credit_purchase: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log transaction
        await db.collection('credit_transactions').add({
            companyId,
            type: 'credit',
            amount: parseInt(credits),
            action: 'CREDIT_PURCHASE',
            description: `Purchased ${credits} credits via Xendit`,
            balanceBefore: currentCredits,
            balanceAfter: newBalance,
            timestamp: new Date().toISOString(),
            metadata: {
                paymentId: paymentData.id,
                paidAmount: paymentData.paid_amount,
                paymentMethod: paymentData.payment_method
            }
        });

        logger.info(`[XENDIT] Credit purchase processed: ${credits} credits added to company ${companyId}`);

    } catch (error) {
        logger.error('[XENDIT] Credit purchase processing error:', error);
        throw error;
    }
}

/**
 * Process tier upgrade after successful payment
 */
async function processTierUpgrade(companyId, tier, paymentData) {
    try {
        const companyRef = db.collection('companies').doc(companyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            throw new Error('Company not found');
        }

        // Calculate subscription end date (30 days from now)
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

        // Update company tier and subscription
        await companyRef.update({
            tier: tier,
            status: 'Active',
            subscription_ends_at: subscriptionEndDate.toISOString(),
            last_subscription_payment: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log transaction
        await db.collection('credit_transactions').add({
            companyId,
            type: 'debit',
            amount: PRICING.subscriptions[tier],
            action: 'SUBSCRIPTION_UPGRADE',
            description: `Upgraded to ${tier} tier`,
            timestamp: new Date().toISOString(),
            metadata: {
                paymentId: paymentData.id,
                paidAmount: paymentData.paid_amount,
                paymentMethod: paymentData.payment_method,
                tier: tier,
                subscriptionEndDate: subscriptionEndDate.toISOString()
            }
        });

        logger.info(`[XENDIT] Tier upgrade processed: Company ${companyId} upgraded to ${tier}`);

    } catch (error) {
        logger.error('[XENDIT] Tier upgrade processing error:', error);
        throw error;
    }
}

/**
 * Get payment status by invoice ID
 */
exports.getPaymentStatus = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [xenditApiKey]
}, async (request) => {
    const { invoiceId } = request.data;

    if (!invoiceId) {
        throw new HttpsError('invalid-argument', 'Invoice ID required');
    }

    try {
        const response = await axios.get(
            `https://api.xendit.co/v2/invoices/${invoiceId}`,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(xenditApiKey.value() + ':').toString('base64')}`
                }
            }
        );

        return {
            success: true,
            status: response.data.status,
            paidAt: response.data.paid_at,
            amount: response.data.amount
        };

    } catch (error) {
        logger.error('[XENDIT] Get payment status error:', error.response?.data || error.message);
        throw new HttpsError('internal', 'Failed to get payment status');
    }
});

// Export helper functions for testing
exports.processCreditPurchase = processCreditPurchase;
exports.processTierUpgrade = processTierUpgrade;
