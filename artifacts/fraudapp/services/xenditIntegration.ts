/**
 * Xendit Payment Gateway Integration
 * Handles invoice creation, payment processing, and webhook handling.
 *
 * MIGRATION NOTE (Firebase → Supabase):
 *   The original implementation called Firebase Cloud Functions
 *   (createXenditInvoice) which are EXPLICITLY OUT OF SCOPE for this
 *   migration.  Those Cloud Function call-sites have been replaced with
 *   console.warn stubs that return { success: false, error: '...' } so
 *   the UI surfaces a clear message instead of throwing unhandled errors.
 *   Re-implementing the Xendit webhook flow (a standalone backend concern)
 *   is tracked as a separate follow-up task.
 */

import { addCredit, upgradeToPremium, creditsToIDR } from './creditManagement';
import { validatePromoCode, incrementPromoUsage, getFinalPrice, PromoCode } from './pricingService';

const XENDIT_API_KEY = import.meta.env.VITE_XENDIT_SECRET_KEY || '';
const XENDIT_API_URL = 'https://api.xendit.co/v2/invoices';

export interface XenditInvoiceRequest {
  external_id: string;
  amount: number;
  payer_email: string;
  description: string;
  invoice_duration?: number;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  currency?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  merchant_name: string;
  amount: number;
  payer_email: string;
  description: string;
  invoice_url: string;
  expiry_date: string;
  created: string;
}

/**
 * Create Xendit invoice for credit top-up
 */
export const createTopUpInvoice = async (
  companyId: string,
  credits: number,
  email: string,
  companyName: string = 'Company',
  promoCode?: string
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string; discount?: number; finalAmount?: number }> => {
  try {
    console.log('[XENDIT] Creating top-up invoice via Firebase Functions:', { companyId, credits, email, promoCode });

    // Calculate original amount
    const originalAmount = credits * 1000; // 1 credit = Rp 1,000
    let finalAmount = originalAmount;
    let discount = 0;
    let validatedPromo: PromoCode | null = null;

    // Validate and apply promo code if provided
    if (promoCode) {
      validatedPromo = await validatePromoCode(promoCode);

      if (!validatedPromo) {
        return {
          success: false,
          error: 'Invalid or expired promo code'
        };
      }

      // Check if promo is applicable to credits
      if (validatedPromo.applicableTo !== 'credits' && validatedPromo.applicableTo !== 'both') {
        return {
          success: false,
          error: 'This promo code is not applicable to credit purchases'
        };
      }

      // Calculate final price with discount
      finalAmount = getFinalPrice(originalAmount, validatedPromo);
      discount = originalAmount - finalAmount;

      console.log('[XENDIT] Promo code applied:', {
        code: promoCode,
        originalAmount,
        discount,
        finalAmount
      });
    }

    console.warn('[XENDIT] createXenditInvoice Cloud Function removed (stubbed). Would create top-up invoice:', { type: 'credit_purchase', amount: credits, companyId });
    throw new Error('Xendit payment via Cloud Functions is not available in this environment');

  } catch (error) {
    console.error('[XENDIT] Error creating top-up invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment invoice'
    };
  }
};

/**
 * Create Xendit invoice for Premium subscription
 */
export const createPremiumSubscriptionInvoice = async (
  companyId: string,
  email: string,
  companyName: string = 'Company',
  tier: 'Premium' | 'Enterprise' = 'Premium',
  promoCode?: string
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string; discount?: number; finalAmount?: number }> => {
  try {
    console.log('[XENDIT] Creating subscription invoice via Firebase Functions:', { companyId, tier, email, promoCode });

    // Calculate original amount (Premium = Rp 99,000)
    const originalAmount = tier === 'Premium' ? 99000 : 199000;
    let finalAmount = originalAmount;
    let discount = 0;
    let validatedPromo: PromoCode | null = null;

    // Validate and apply promo code if provided
    if (promoCode) {
      validatedPromo = await validatePromoCode(promoCode);

      if (!validatedPromo) {
        return {
          success: false,
          error: 'Invalid or expired promo code'
        };
      }

      // Check if promo is applicable to subscription
      if (validatedPromo.applicableTo !== 'subscription' && validatedPromo.applicableTo !== 'both') {
        return {
          success: false,
          error: 'This promo code is not applicable to subscriptions'
        };
      }

      // Calculate final price with discount
      finalAmount = getFinalPrice(originalAmount, validatedPromo);
      discount = originalAmount - finalAmount;

      console.log('[XENDIT] Promo code applied:', {
        code: promoCode,
        originalAmount,
        discount,
        finalAmount
      });
    }

    console.warn('[XENDIT] createXenditInvoice Cloud Function removed (stubbed). Would create subscription invoice:', { type: 'subscription_upgrade', tier, companyId });
    throw new Error('Xendit payment via Cloud Functions is not available in this environment');

  } catch (error) {
    console.error('[XENDIT] Error creating subscription invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment invoice'
    };
  }
};

/**
 * Process Xendit webhook callback
 * This should be called from a Firebase Cloud Function
 */
interface XenditWebhookData {
  external_id: string;
  status: string;
  id: string;
  amount: number;
}

export const processXenditWebhook = async (webhookData: XenditWebhookData): Promise<{ success: boolean; message: string }> => {
  try {
    const { external_id, status, id, amount } = webhookData;

    console.log('[XENDIT] Processing webhook:', { external_id, status, id });

    // Only process paid invoices
    if (status !== 'PAID') {
      return {
        success: false,
        message: `Invoice status is ${status}, not processing`
      };
    }

    // Parse external_id to get type and companyId
    const parts = external_id.split('_');
    const type = parts[0]; // 'topup' or 'premium'
    const companyId = parts[1];

    if (!companyId) {
      throw new Error('Invalid external_id format');
    }

    if (type === 'topup') {
      // Process credit top-up
      const credits = Math.floor(amount / 100); // amount in IDR, divide by rate
      const result = await addCredit(companyId, credits, 'TOP_UP', { paymentId: id });

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log('[XENDIT] Top-up processed:', { companyId, credits });

      return {
        success: true,
        message: `Added ${credits} credits to company ${companyId}`
      };

    } else if (type === 'premium') {
      // Process premium upgrade
      const result = await upgradeToPremium(companyId, id);

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log('[XENDIT] Premium upgrade processed:', companyId);

      return {
        success: true,
        message: `Company ${companyId} upgraded to Premium`
      };

    } else {
      throw new Error(`Unknown payment type: ${type}`);
    }

  } catch (error) {
    console.error('[XENDIT] Webhook processing error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process webhook'
    };
  }
};

/**
 * Get available top-up packages
 */
export const getTopUpPackages = () => [
  { credits: 200, price: 2000, popular: false },
  { credits: 1000, price: 100000, popular: true },
  { credits: 5000, price: 450000, popular: false },
  { credits: 10000, price: 800000, popular: false }
];

/**
 * Format IDR currency
 */
export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};
