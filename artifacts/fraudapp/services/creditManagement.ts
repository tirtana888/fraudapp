import { supabase, COLLECTIONS } from './supabase';
import { CreditTransaction, CREDIT_COSTS, SUBSCRIPTION_PLANS, CREDIT_TO_IDR_RATE } from '../types';

// ==========================================
// CREDIT MANAGEMENT FUNCTIONS
// ==========================================

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
    const cost = amount || CREDIT_COSTS[actionType];

    // Atomic credit deduction via RPC (row-level lock prevents double-spend)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('deduct_credits', {
      p_company_id: companyId,
      p_amount: cost,
    });
    if (rpcErr) {
      // RPC raises a Postgres exception with the business message
      const msg = rpcErr.message || '';
      if (msg.includes('Insufficient credits')) {
        throw new Error(`Kredit tidak cukup. Dibutuhkan: ${cost}`);
      }
      if (msg.includes('Company not found')) {
        throw new Error('Company not found');
      }
      throw new Error(msg || 'Credit deduction failed');
    }

    const newBalance = rpcResult as number;
    const currentCredits = newBalance + cost; // pre-deduction balance

    const transactionData: Omit<CreditTransaction, 'id'> = {
      companyId,
      type: 'debit',
      amount: cost,
      action: actionType,
      description: description || getActionDescription(actionType, metadata),
      balanceBefore: currentCredits,
      balanceAfter: newBalance,
      timestamp: new Date().toISOString(),
      metadata,
    };

    await supabase.from(COLLECTIONS.CREDIT_TRANSACTIONS).insert(transactionData);

    return { success: true, remainingCredits: newBalance };
  } catch (error: any) {
    console.error('[CREDIT] Deduction error:', error);
    return { success: false, error: error.message || 'Gagal mengurangi kredit' };
  }
};

export const addCredit = async (
  companyId: string,
  amount: number,
  action: 'TOP_UP' | 'SUBSCRIPTION' | 'INITIAL_CREDIT' | 'MONTHLY_REFILL',
  metadata?: { paymentId?: string; invoiceId?: string }
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  try {
    const { data: companyData, error: fetchErr } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .select('credits')
      .eq('id', companyId)
      .single();

    if (fetchErr || !companyData) throw new Error('Company not found');

    const currentCredits = companyData.credits || 0;
    const newBalance = currentCredits + amount;

    const { error: updateErr } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .update({ credits: newBalance })
      .eq('id', companyId);
    if (updateErr) throw updateErr;

    const transactionData: Omit<CreditTransaction, 'id'> = {
      companyId,
      type: 'credit',
      amount,
      action,
      description: getAddCreditDescription(action, amount),
      balanceBefore: currentCredits,
      balanceAfter: newBalance,
      timestamp: new Date().toISOString(),
      metadata,
    };

    await supabase.from(COLLECTIONS.CREDIT_TRANSACTIONS).insert(transactionData);

    return { success: true, message: `${amount} credits added successfully`, newBalance };
  } catch (error: any) {
    console.error('[CREDIT] Add credit error:', error);
    return { success: false, message: error.message || 'Failed to add credits' };
  }
};

export const getCreditBalance = async (companyId: string): Promise<number> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('credits')
    .eq('id', companyId)
    .single();
  if (error) return 0;
  return data?.credits || 0;
};

export const getCreditTransactions = async (companyId: string, limitCount: number = 50): Promise<CreditTransaction[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.CREDIT_TRANSACTIONS)
    .select('*')
    .eq('companyId', companyId)
    .order('timestamp', { ascending: false })
    .limit(limitCount);
  if (error) {
    console.error('[CREDIT] Error fetching transactions:', error);
    return [];
  }
  return (data || []) as CreditTransaction[];
};

export const hasSufficientCredits = async (
  companyId: string,
  actionType: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE'
): Promise<{ sufficient: boolean; required: number; available: number }> => {
  const required = CREDIT_COSTS[actionType];
  const available = await getCreditBalance(companyId);
  return { sufficient: available >= required, required, available };
};

export const upgradeToPremium = async (
  companyId: string,
  paymentId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const { data: companyData, error: fetchErr } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .select('credits')
      .eq('id', companyId)
      .single();
    if (fetchErr || !companyData) throw new Error('Company not found');

    const currentCredits = companyData.credits || 0;
    const newBalance = currentCredits + SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits;

    await supabase.from(COLLECTIONS.COMPANIES).update({
      tier: 'Premium',
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: endDate.toISOString(),
      monthlyCredits: SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits,
      credits: newBalance,
    }).eq('id', companyId);

    await supabase.from(COLLECTIONS.CREDIT_TRANSACTIONS).insert({
      companyId,
      type: 'credit',
      amount: SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits,
      action: 'SUBSCRIPTION',
      description: `Upgraded to Premium plan - ${SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits} credits added`,
      balanceBefore: currentCredits,
      balanceAfter: newBalance,
      timestamp: new Date().toISOString(),
      metadata: { paymentId },
    });

    return { success: true, message: 'Successfully upgraded to Premium plan' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to upgrade plan' };
  }
};

export const canViewCandidate = async (
  companyId: string,
  candidateIndex: number
): Promise<{ canView: boolean; reason?: string }> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('tier')
    .eq('id', companyId)
    .single();
  if (error || !data) return { canView: false, reason: 'Company not found' };

  const tier = data.tier || 'Freemium';
  if (tier === 'Premium') return { canView: true };

  const limit = SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit;
  if (candidateIndex >= limit) {
    return { canView: false, reason: `Freemium plan limited to ${limit} candidates.` };
  }
  return { canView: true };
};

export const shouldMaskContacts = async (companyId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('tier')
    .eq('id', companyId)
    .single();
  if (error || !data) return true;
  return (data.tier || 'Freemium') === 'Freemium';
};

export const creditsToIDR = (credits: number): number => credits * CREDIT_TO_IDR_RATE;
export const idrToCredits = (idr: number): number => Math.floor(idr / CREDIT_TO_IDR_RATE);

// ==========================================
// APPLICATION ORDER RANKING
// ==========================================

interface CandidateWithDate {
  id?: string;
  date?: string;
  appliedAt?: string;
  createdAt?: string | number;
}

export const calculateApplicationRanks = (candidates: CandidateWithDate[]): Map<string, number> => {
  const sorted = [...candidates].sort((a, b) => getApplyDate(a) - getApplyDate(b));
  const rankMap = new Map<string, number>();
  sorted.forEach((c, idx) => { if (c.id) rankMap.set(c.id, idx + 1); });
  return rankMap;
};

export const shouldBlurByApplicationRank = (applicationRank: number, tier: 'Freemium' | 'Premium'): boolean => {
  if (tier === 'Premium') return false;
  return applicationRank > SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit;
};

function getApplyDate(candidate: CandidateWithDate): number {
  if (candidate.appliedAt) return new Date(candidate.appliedAt).getTime();
  if (candidate.date) return new Date(candidate.date).getTime();
  if (candidate.createdAt) return new Date(candidate.createdAt).getTime();
  return 0;
}

function getActionDescription(actionType: string, metadata?: { candidateName?: string }): string {
  switch (actionType) {
    case 'KYC_VERIFICATION': return `KYC Background Check${metadata?.candidateName ? ` - ${metadata.candidateName}` : ''}`;
    case 'RESEND_INVITE': return `Resend Assessment Invite${metadata?.candidateName ? ` to ${metadata.candidateName}` : ''}`;
    case 'UNLOCK_PROFILE': return `Unlock Candidate Profile${metadata?.candidateName ? ` - ${metadata.candidateName}` : ''}`;
    default: return 'Credit deduction';
  }
}

function getAddCreditDescription(action: string, amount: number): string {
  switch (action) {
    case 'TOP_UP': return `Credit Top-Up - ${amount} credits`;
    case 'SUBSCRIPTION': return `Premium Subscription - ${amount} credits`;
    case 'INITIAL_CREDIT': return `Welcome Bonus - ${amount} credits`;
    case 'MONTHLY_REFILL': return `Monthly Credit Refill - ${amount} credits`;
    default: return `Credit added - ${amount} credits`;
  }
}
