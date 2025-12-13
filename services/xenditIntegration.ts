/**
 * Xendit Payment Gateway Integration
 * Handles invoice creation, payment processing, and webhook handling
 */

import { addCredit, upgradeToPremium, creditsToIDR } from './creditManagement';

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
  companyName: string = 'Company'
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string }> => {
  try {
    console.log('[XENDIT] Creating top-up invoice via Firebase Functions:', { companyId, credits, email });

    // Import Firebase Functions
    const { functions } = await import('../services/firebase');
    const { httpsCallable } = await import('firebase/functions');

    // Call Firebase Function
    const createInvoice = httpsCallable(functions, 'createXenditInvoice');
    const result = await createInvoice({
      type: 'credit_purchase',
      amount: credits,
      companyId,
      companyName,
      companyEmail: email
    });

    const data = result.data as { success: boolean; invoiceUrl: string; invoiceId: string };

    if (data.success && data.invoiceUrl) {
      console.log('[XENDIT] Invoice created successfully:', data.invoiceId);

      // Save pending payment redirect to localStorage
      localStorage.setItem('pendingPaymentRedirect', 'credits');
      localStorage.setItem('pendingPaymentType', 'top-up');
      console.log('[XENDIT] Saved payment redirect flag to localStorage');

      return {
        success: true,
        invoiceUrl: data.invoiceUrl,
        invoiceId: data.invoiceId
      };
    } else {
      throw new Error('Failed to create invoice');
    }

  } catch (error: any) {
    console.error('[XENDIT] Error creating top-up invoice:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment invoice'
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
  tier: 'Premium' | 'Enterprise' = 'Premium'
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string }> => {
  try {
    console.log('[XENDIT] Creating subscription invoice via Firebase Functions:', { companyId, tier, email });

    // Import Firebase Functions
    const { functions } = await import('../services/firebase');
    const { httpsCallable } = await import('firebase/functions');

    // Call Firebase Function
    const createInvoice = httpsCallable(functions, 'createXenditInvoice');
    const result = await createInvoice({
      type: 'subscription_upgrade',
      tier,
      companyId,
      companyName,
      companyEmail: email
    });

    const data = result.data as { success: boolean; invoiceUrl: string; invoiceId: string };

    if (data.success && data.invoiceUrl) {
      console.log('[XENDIT] Subscription invoice created:', data.invoiceId);
      return {
        success: true,
        invoiceUrl: data.invoiceUrl,
        invoiceId: data.invoiceId
      };
    } else {
      throw new Error('Failed to create invoice');
    }

  } catch (error: any) {
    console.error('[XENDIT] Error creating subscription invoice:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment invoice'
    };
  }
};

/**
 * Process Xendit webhook callback
 * This should be called from a Firebase Cloud Function
 */
export const processXenditWebhook = async (webhookData: any): Promise<{ success: boolean; message: string }> => {
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

  } catch (error: any) {
    console.error('[XENDIT] Webhook processing error:', error);
    return {
      success: false,
      message: error.message || 'Failed to process webhook'
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
