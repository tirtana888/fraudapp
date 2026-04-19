import { supabase } from './supabase';

export interface RevenueAnalytics {
    totalRevenue: number;
    monthlyRevenue: number;
    dailyRevenue: number;
    mrr: number;
    arr: number;
    revenueGrowth: number;
}

export interface TierRevenue {
    tier: string;
    revenue: number;
    count: number;
    percentage: number;
}

export interface PaymentTransaction {
    id: string;
    companyId: string;
    companyName: string;
    amount: number;
    status: 'success' | 'pending' | 'failed';
    method: string;
    timestamp: Date;
    invoiceId?: string;
}

export interface CreditUsageStats {
    totalCreditsSold: number;
    totalCreditsConsumed: number;
    totalCreditsRemaining: number;
    averageCreditsPerCompany: number;
    creditBurnRate: number;
}

export interface PaymentMetrics {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    successRate: number;
}

const getStartOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const getStartOfDay = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const getStartOfLastMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1); };
const getEndOfLastMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59); };

export const getRevenueAnalytics = async (): Promise<RevenueAnalytics> => {
    try {
        const { data: payments } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('status', 'success');

        let totalRevenue = 0, monthlyRevenue = 0, dailyRevenue = 0, lastMonthRevenue = 0;
        const startOfMonth = getStartOfMonth(), startOfDay = getStartOfDay();
        const startOfLastMonth = getStartOfLastMonth(), endOfLastMonth = getEndOfLastMonth();

        type PayRow = { amount?: number; timestamp?: string; created_at?: string };
        (payments || []).forEach((p: PayRow) => {
            const amount = p.amount || 0;
            const ts = new Date(p.timestamp || p.created_at || 0);
            totalRevenue += amount;
            if (ts >= startOfMonth) monthlyRevenue += amount;
            if (ts >= startOfDay) dailyRevenue += amount;
            if (ts >= startOfLastMonth && ts <= endOfLastMonth) lastMonthRevenue += amount;
        });

        const { data: activeCompanies } = await supabase
            .from('companies')
            .select('tier')
            .eq('status', 'Active');

        let mrr = 0;
        (activeCompanies || []).forEach((c: { tier?: string }) => {
            const tierMRR: Record<string, number> = { Freemium: 0, Basic: 100000, Premium: 500000, Enterprise: 2000000 };
            mrr += (c.tier ? tierMRR[c.tier] : 0) || 0;
        });

        const revenueGrowth = lastMonthRevenue > 0
            ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

        return { totalRevenue, monthlyRevenue, dailyRevenue, mrr, arr: mrr * 12, revenueGrowth };
    } catch (error) {
        console.error('Error getting revenue analytics:', error);
        return { totalRevenue: 0, monthlyRevenue: 0, dailyRevenue: 0, mrr: 0, arr: 0, revenueGrowth: 0 };
    }
};

export const getRevenueByTier = async (): Promise<TierRevenue[]> => {
    try {
        const [{ data: companies }, { data: payments }] = await Promise.all([
            supabase.from('companies').select('id, tier'),
            supabase.from('payment_transactions').select('companyId, amount').eq('status', 'success'),
        ]);

        const tierData: Record<string, { revenue: number; count: number }> = {
            Freemium: { revenue: 0, count: 0 },
            Basic: { revenue: 0, count: 0 },
            Premium: { revenue: 0, count: 0 },
            Enterprise: { revenue: 0, count: 0 },
        };

        const companyPayments: Record<string, number> = {};
        let totalRevenue = 0;
        type TierPayRow = { companyId?: string; amount?: number };
        (payments || []).forEach((p: TierPayRow) => {
            if (p.companyId) companyPayments[p.companyId] = (companyPayments[p.companyId] || 0) + (p.amount || 0);
            totalRevenue += p.amount || 0;
        });

        const companyTierMap: Record<string, string> = {};
        (companies || []).forEach((c: { id: string; tier?: string }) => { companyTierMap[c.id] = c.tier || 'Freemium'; });

        Object.entries(companyPayments).forEach(([cid, revenue]) => {
            const tier = companyTierMap[cid] || 'Freemium';
            if (tierData[tier]) { tierData[tier].revenue += revenue; tierData[tier].count++; }
        });

        return Object.entries(tierData).map(([tier, d]) => ({
            tier, revenue: d.revenue, count: d.count,
            percentage: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0
        })).sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
        console.error('Error getting revenue by tier:', error);
        return [];
    }
};

export const getPaymentTransactions = async (limitCount: number = 20): Promise<PaymentTransaction[]> => {
    try {
        const [{ data: payments }, { data: companies }] = await Promise.all([
            supabase.from('payment_transactions').select('*').order('timestamp', { ascending: false }).limit(limitCount),
            supabase.from('companies').select('id, name'),
        ]);

        const companyNames: Record<string, string> = {};
        (companies || []).forEach((c: { id: string; name?: string }) => { companyNames[c.id] = c.name || 'Unknown'; });

        type FullPayRow = { id: string; companyId?: string; amount?: number; status?: string; method?: string; timestamp?: string; created_at?: string; invoiceId?: string };
        return (payments || []).map((p: FullPayRow) => ({
            id: p.id,
            companyId: p.companyId || '',
            companyName: companyNames[p.companyId || ''] || 'Unknown',
            amount: p.amount || 0,
            status: (p.status || 'pending') as PaymentTransaction['status'],
            method: p.method || 'xendit',
            timestamp: new Date(p.timestamp || p.created_at || Date.now()),
            invoiceId: p.invoiceId,
        }));
    } catch (error) {
        console.error('Error getting payment transactions:', error);
        return [];
    }
};

export const getCreditUsageStats = async (): Promise<CreditUsageStats> => {
    try {
        const { data: companies } = await supabase.from('companies').select('credits, creditsUsed');
        let totalCreditsSold = 0, totalCreditsConsumed = 0, totalCreditsRemaining = 0, companyCount = 0;

        (companies || []).forEach((c: { credits?: number; creditsUsed?: number }) => {
            const credits = c.credits || 0;
            const used = c.creditsUsed || 0;
            totalCreditsRemaining += credits;
            totalCreditsConsumed += used;
            totalCreditsSold += credits + used;
            companyCount++;
        });

        return {
            totalCreditsSold,
            totalCreditsConsumed,
            totalCreditsRemaining,
            averageCreditsPerCompany: companyCount > 0 ? Math.round(totalCreditsSold / companyCount) : 0,
            creditBurnRate: totalCreditsConsumed > 0 ? Math.round(totalCreditsConsumed / 30) : 0,
        };
    } catch (error) {
        console.error('Error getting credit usage stats:', error);
        return { totalCreditsSold: 0, totalCreditsConsumed: 0, totalCreditsRemaining: 0, averageCreditsPerCompany: 0, creditBurnRate: 0 };
    }
};

export const getPaymentMetrics = async (): Promise<PaymentMetrics> => {
    try {
        const { data: payments } = await supabase.from('payment_transactions').select('status');
        let totalPayments = 0, successfulPayments = 0, failedPayments = 0, pendingPayments = 0;

        (payments || []).forEach((p: { status?: string }) => {
            totalPayments++;
            if (p.status === 'success') successfulPayments++;
            else if (p.status === 'failed') failedPayments++;
            else pendingPayments++;
        });

        return {
            totalPayments, successfulPayments, failedPayments, pendingPayments,
            successRate: totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100) : 0
        };
    } catch (error) {
        console.error('Error getting payment metrics:', error);
        return { totalPayments: 0, successfulPayments: 0, failedPayments: 0, pendingPayments: 0, successRate: 0 };
    }
};
