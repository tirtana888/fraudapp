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
  email: string
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string }> => {
  try {
    const amount = creditsToIDR(credits);
    const externalId = `topup_${companyId}_${Date.now()}`;

    const invoiceData: XenditInvoiceRequest = {
      external_id: externalId,
      amount: amount,
      payer_email: email,
      description: `Credit Top-Up: ${credits} credits`,
      invoice_duration: 86400, // 24 hours
      success_redirect_url: `${window.location.origin}?payment=success`,
      failure_redirect_url: `${window.location.origin}?payment=failed`,
      currency: 'IDR',
      items: [
        {
          name: `${credits} Credits`,
          quantity: 1,
          price: amount
        }
      ]
    };

    console.log('[XENDIT] Creating top-up invoice:', invoiceData);

    const response = await fetch(XENDIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(XENDIT_API_KEY + ':')}`
      },
      body: JSON.stringify(invoiceData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[XENDIT] Invoice creation failed:', errorData);
      throw new Error(errorData.message || 'Failed to create invoice');
    }

    const invoice: XenditInvoiceResponse = await response.json();
    console.log('[XENDIT] Invoice created successfully:', invoice.id);

    return {
      success: true,
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id
    };

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
  email: string
): Promise<{ success: boolean; invoiceUrl?: string; invoiceId?: string; error?: string }> => {
  try {
    const amount = 150000; // Rp 150,000
    const externalId = `premium_${companyId}_${Date.now()}`;

    const invoiceData: XenditInvoiceRequest = {
      external_id: externalId,
      amount: amount,
      payer_email: email,
      description: 'Premium Subscription - 1 Month (1500 Credits)',
      invoice_duration: 86400,
      success_redirect_url: `${window.location.origin}?payment=success&type=premium`,
      failure_redirect_url: `${window.location.origin}?payment=failed`,
      currency: 'IDR',
      items: [
        {
          name: 'Premium Plan - 1 Month',
          quantity: 1,
          price: amount
        }
      ]
    };

    console.log('[XENDIT] Creating premium subscription invoice:', invoiceData);

    const response = await fetch(XENDIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(XENDIT_API_KEY + ':')}`
      },
      body: JSON.stringify(invoiceData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[XENDIT] Invoice creation failed:', errorData);
      throw new Error(errorData.message || 'Failed to create invoice');
    }

    const invoice: XenditInvoiceResponse = await response.json();
    console.log('[XENDIT] Premium invoice created:', invoice.id);

    return {
      success: true,
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id
    };

  } catch (error: any) {
    console.error('[XENDIT] Error creating premium invoice:', error);
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
  { credits: 500, price: 50000, popular: false },
  { credits: 1000, price: 100000, popular: true },
  { credits: 2500, price: 250000, popular: false },
  { credits: 5000, price: 500000, popular: false },
  { credits: 10000, price: 1000000, popular: false }
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
