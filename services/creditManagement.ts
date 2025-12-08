import { db, COLLECTIONS } from './firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, orderBy, getDocs, limit, Timestamp, runTransaction } from 'firebase/firestore';
import { CreditTransaction, CREDIT_COSTS, SUBSCRIPTION_PLANS, CREDIT_TO_IDR_RATE } from '../types';

// ==========================================
// CREDIT MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Deduct credits from company balance with transaction logging
 * @param companyId - Company ID
 * @param amount - Amount to deduct (if provided, overrides default cost)
 * @param actionType - Type of action
 * @param description - Custom description (optional)
 * @param metadata - Additional metadata
 */
export const deductCredit = async (
  companyId: string,
  amount: number,
  actionType: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE',
  description?: string,
  metadata?: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
  }
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> => {
  try {
    const cost = CREDIT_COSTS[actionType];
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);

    // Use Firestore transaction for atomic credit deduction
    const result = await runTransaction(db, async (transaction) => {
      const companyDoc = await transaction.get(companyRef);
      
      if (!companyDoc.exists()) {
        throw new Error('Company not found');
      }

      const companyData = companyDoc.data();
      const currentCredits = companyData.credits || 0;

      // Check if sufficient credits
      if (currentCredits < cost) {
        throw new Error(`Insufficient credits. Required: ${cost}, Available: ${currentCredits}`);
      }

      const newBalance = currentCredits - cost;

      // Update company credits
      transaction.update(companyRef, {
        credits: newBalance
      });

      // Log transaction
      const transactionData: Omit<CreditTransaction, 'id'> = {
        companyId,
        type: 'debit',
        amount: cost,
        action: actionType,
        description: getActionDescription(actionType, metadata),
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        metadata
      };

      const transactionRef = doc(collection(db, COLLECTIONS.CREDIT_TRANSACTIONS));
      transaction.set(transactionRef, transactionData);

      return { newBalance, cost };
    });

    console.log(`[CREDIT] Deducted ${result.cost} credits from company ${companyId}. New balance: ${result.newBalance}`);

    return {
      success: true,
      message: `${result.cost} credits deducted successfully`,
      remainingCredits: result.newBalance
    };

  } catch (error: any) {
    console.error('[CREDIT] Deduction error:', error);
    return {
      success: false,
      message: error.message || 'Failed to deduct credits'
    };
  }
};

/**
 * Add credits to company balance (top-up or refill)
 */
export const addCredit = async (
  companyId: string,
  amount: number,
  action: 'TOP_UP' | 'SUBSCRIPTION' | 'INITIAL_CREDIT' | 'MONTHLY_REFILL',
  metadata?: {
    paymentId?: string;
    invoiceId?: string;
  }
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);

    const result = await runTransaction(db, async (transaction) => {
      const companyDoc = await transaction.get(companyRef);
      
      if (!companyDoc.exists()) {
        throw new Error('Company not found');
      }

      const companyData = companyDoc.data();
      const currentCredits = companyData.credits || 0;
      const newBalance = currentCredits + amount;

      // Update company credits
      transaction.update(companyRef, {
        credits: newBalance
      });

      // Log transaction
      const transactionData: Omit<CreditTransaction, 'id'> = {
        companyId,
        type: 'credit',
        amount,
        action,
        description: getAddCreditDescription(action, amount),
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        metadata
      };

      const transactionRef = doc(collection(db, COLLECTIONS.CREDIT_TRANSACTIONS));
      transaction.set(transactionRef, transactionData);

      return { newBalance };
    });

    console.log(`[CREDIT] Added ${amount} credits to company ${companyId}. New balance: ${result.newBalance}`);

    return {
      success: true,
      message: `${amount} credits added successfully`,
      newBalance: result.newBalance
    };

  } catch (error: any) {
    console.error('[CREDIT] Add credit error:', error);
    return {
      success: false,
      message: error.message || 'Failed to add credits'
    };
  }
};

/**
 * Get company credit balance
 */
export const getCreditBalance = async (companyId: string): Promise<number> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      return 0;
    }

    return companyDoc.data().credits || 0;
  } catch (error) {
    console.error('[CREDIT] Error getting balance:', error);
    return 0;
  }
};

/**
 * Get credit transaction history
 */
export const getCreditTransactions = async (
  companyId: string,
  limitCount: number = 50
): Promise<CreditTransaction[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CREDIT_TRANSACTIONS),
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CreditTransaction[];
  } catch (error) {
    console.error('[CREDIT] Error fetching transactions:', error);
    return [];
  }
};

/**
 * Check if company has sufficient credits
 */
export const hasSufficientCredits = async (
  companyId: string,
  actionType: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE'
): Promise<{ sufficient: boolean; required: number; available: number }> => {
  const required = CREDIT_COSTS[actionType];
  const available = await getCreditBalance(companyId);

  return {
    sufficient: available >= required,
    required,
    available
  };
};

/**
 * Upgrade company to Premium tier
 */
export const upgradeToPremium = async (
  companyId: string,
  paymentId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    await runTransaction(db, async (transaction) => {
      const companyDoc = await transaction.get(companyRef);
      
      if (!companyDoc.exists()) {
        throw new Error('Company not found');
      }

      // Update to Premium
      transaction.update(companyRef, {
        tier: 'Premium',
        subscriptionStartDate: now.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        monthlyCredits: SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits
      });

      // Add monthly credits
      const companyData = companyDoc.data();
      const currentCredits = companyData.credits || 0;
      const newBalance = currentCredits + SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits;

      transaction.update(companyRef, {
        credits: newBalance
      });

      // Log transaction
      const transactionData: Omit<CreditTransaction, 'id'> = {
        companyId,
        type: 'credit',
        amount: SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits,
        action: 'SUBSCRIPTION',
        description: `Upgraded to Premium plan - ${SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits} credits added`,
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        metadata: { paymentId }
      };

      const transactionRef = doc(collection(db, COLLECTIONS.CREDIT_TRANSACTIONS));
      transaction.set(transactionRef, transactionData);
    });

    console.log(`[CREDIT] Company ${companyId} upgraded to Premium`);

    return {
      success: true,
      message: 'Successfully upgraded to Premium plan'
    };

  } catch (error: any) {
    console.error('[CREDIT] Upgrade error:', error);
    return {
      success: false,
      message: error.message || 'Failed to upgrade plan'
    };
  }
};

/**
 * Check if user can view candidate (Freemium has 10 candidate limit)
 */
export const canViewCandidate = async (
  companyId: string,
  candidateIndex: number
): Promise<{ canView: boolean; reason?: string }> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      return { canView: false, reason: 'Company not found' };
    }

    const companyData = companyDoc.data();
    const tier = companyData.tier || 'Freemium';

    // Premium users can view all candidates
    if (tier === 'Premium') {
      return { canView: true };
    }

    // Freemium users limited to first 10 candidates
    const limit = SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit;
    
    if (candidateIndex >= limit) {
      return {
        canView: false,
        reason: `Freemium plan limited to ${limit} candidates. Upgrade to Premium for unlimited access.`
      };
    }

    return { canView: true };

  } catch (error) {
    console.error('[CREDIT] Error checking candidate view:', error);
    return { canView: false, reason: 'Error checking permissions' };
  }
};

/**
 * Check if contacts should be masked (Freemium masks contacts)
 */
export const shouldMaskContacts = async (companyId: string): Promise<boolean> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      return true; // Mask by default
    }

    const tier = companyDoc.data().tier || 'Freemium';
    return tier === 'Freemium';

  } catch (error) {
    console.error('[CREDIT] Error checking contact masking:', error);
    return true; // Mask by default on error
  }
};

/**
 * Calculate credit cost in IDR
 */
export const creditsToIDR = (credits: number): number => {
  return credits * CREDIT_TO_IDR_RATE;
};

/**
 * Calculate IDR to credits
 */
export const idrToCredits = (idr: number): number => {
  return Math.floor(idr / CREDIT_TO_IDR_RATE);
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getActionDescription(
  actionType: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE',
  metadata?: { candidateName?: string }
): string {
  switch (actionType) {
    case 'KYC_VERIFICATION':
      return `KYC Background Check${metadata?.candidateName ? ` - ${metadata.candidateName}` : ''}`;
    case 'RESEND_INVITE':
      return `Resend Assessment Invite${metadata?.candidateName ? ` to ${metadata.candidateName}` : ''}`;
    case 'UNLOCK_PROFILE':
      return `Unlock Candidate Profile${metadata?.candidateName ? ` - ${metadata.candidateName}` : ''}`;
    default:
      return 'Credit deduction';
  }
}

function getAddCreditDescription(
  action: 'TOP_UP' | 'SUBSCRIPTION' | 'INITIAL_CREDIT' | 'MONTHLY_REFILL',
  amount: number
): string {
  switch (action) {
    case 'TOP_UP':
      return `Credit Top-Up - ${amount} credits`;
    case 'SUBSCRIPTION':
      return `Premium Subscription - ${amount} credits`;
    case 'INITIAL_CREDIT':
      return `Welcome Bonus - ${amount} credits`;
    case 'MONTHLY_REFILL':
      return `Monthly Credit Refill - ${amount} credits`;
    default:
      return `Credit added - ${amount} credits`;
  }
}
