/**
 * REVENUE SERVICE
 * Handles all revenue and financial analytics queries
 */

import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// ==========================================
// INTERFACES
// ==========================================

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

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getStartOfMonth = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getStartOfDay = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getStartOfLastMonth = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
};

const getEndOfLastMonth = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
};

// ==========================================
// REVENUE ANALYTICS
// ==========================================

/**
 * Get comprehensive revenue analytics
 */
export const getRevenueAnalytics = async (): Promise<RevenueAnalytics> => {
    try {
        const paymentsRef = collection(db, 'payment-transactions');

        // Get all successful payments
        const allPaymentsQuery = query(
            paymentsRef,
            where('status', '==', 'success')
        );
        const allPaymentsSnapshot = await getDocs(allPaymentsQuery);

        let totalRevenue = 0;
        let monthlyRevenue = 0;
        let dailyRevenue = 0;
        let lastMonthRevenue = 0;

        const startOfMonth = getStartOfMonth();
        const startOfDay = getStartOfDay();
        const startOfLastMonth = getStartOfLastMonth();
        const endOfLastMonth = getEndOfLastMonth();

        allPaymentsSnapshot.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            const timestamp = data.timestamp?.toDate() || new Date(0);

            totalRevenue += amount;

            if (timestamp >= startOfMonth) {
                monthlyRevenue += amount;
            }

            if (timestamp >= startOfDay) {
                dailyRevenue += amount;
            }

            if (timestamp >= startOfLastMonth && timestamp <= endOfLastMonth) {
                lastMonthRevenue += amount;
            }
        });

        // Calculate MRR from active subscriptions
        const companiesRef = collection(db, 'companies');
        const activeCompaniesQuery = query(
            companiesRef,
            where('status', '==', 'Active')
        );
        const companiesSnapshot = await getDocs(activeCompaniesQuery);

        let mrr = 0;
        companiesSnapshot.forEach(doc => {
            const data = doc.data();
            const tierMRR = {
                'Freemium': 0,
                'Basic': 100000,
                'Premium': 500000,
                'Enterprise': 2000000
            };
            mrr += tierMRR[data.tier as keyof typeof tierMRR] || 0;
        });

        const arr = mrr * 12;
        const revenueGrowth = lastMonthRevenue > 0
            ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
            : 0;

        return {
            totalRevenue,
            monthlyRevenue,
            dailyRevenue,
            mrr,
            arr,
            revenueGrowth
        };
    } catch (error) {
        console.error('Error getting revenue analytics:', error);
        return {
            totalRevenue: 0,
            monthlyRevenue: 0,
            dailyRevenue: 0,
            mrr: 0,
            arr: 0,
            revenueGrowth: 0
        };
    }
};

// ==========================================
// REVENUE BY TIER
// ==========================================

export const getRevenueByTier = async (): Promise<TierRevenue[]> => {
    try {
        const companiesRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);

        const tierData: { [key: string]: { revenue: number; count: number } } = {
            'Freemium': { revenue: 0, count: 0 },
            'Basic': { revenue: 0, count: 0 },
            'Premium': { revenue: 0, count: 0 },
            'Enterprise': { revenue: 0, count: 0 }
        };

        let totalRevenue = 0;

        const paymentsRef = collection(db, 'payment-transactions');
        const paymentsQuery = query(paymentsRef, where('status', '==', 'success'));
        const paymentsSnapshot = await getDocs(paymentsQuery);

        const companyPayments: { [key: string]: number } = {};
        paymentsSnapshot.forEach(doc => {
            const data = doc.data();
            const companyId = data.companyId;
            const amount = data.amount || 0;
            companyPayments[companyId] = (companyPayments[companyId] || 0) + amount;
            totalRevenue += amount;
        });

        companiesSnapshot.forEach(doc => {
            const data = doc.data();
            const tier = data.tier || 'Freemium';
            const companyRevenue = companyPayments[doc.id] || 0;

            if (tierData[tier]) {
                tierData[tier].revenue += companyRevenue;
                tierData[tier].count += 1;
            }
        });

        const result: TierRevenue[] = Object.entries(tierData).map(([tier, data]) => ({
            tier,
            revenue: data.revenue,
            count: data.count,
            percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
        }));

        return result.sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
        console.error('Error getting revenue by tier:', error);
        return [];
    }
};

// ==========================================
// PAYMENT TRANSACTIONS
// ==========================================

export const getPaymentTransactions = async (limitCount: number = 20): Promise<PaymentTransaction[]> => {
    try {
        const paymentsRef = collection(db, 'payment-transactions');
        const paymentsQuery = query(
            paymentsRef,
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);

        const companiesRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);
        const companyNames: { [key: string]: string } = {};
        companiesSnapshot.forEach(doc => {
            companyNames[doc.id] = doc.data().name || 'Unknown Company';
        });

        const transactions: PaymentTransaction[] = [];
        paymentsSnapshot.forEach(doc => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                companyId: data.companyId || '',
                companyName: companyNames[data.companyId] || 'Unknown',
                amount: data.amount || 0,
                status: data.status || 'pending',
                method: data.method || 'xendit',
                timestamp: data.timestamp?.toDate() || new Date(),
                invoiceId: data.invoiceId
            });
        });

        return transactions;
    } catch (error) {
        console.error('Error getting payment transactions:', error);
        return [];
    }
};

// ==========================================
// CREDIT USAGE STATS
// ==========================================

export const getCreditUsageStats = async (): Promise<CreditUsageStats> => {
    try {
        const companiesRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);

        let totalCreditsSold = 0;
        let totalCreditsConsumed = 0;
        let totalCreditsRemaining = 0;
        let companyCount = 0;

        companiesSnapshot.forEach(doc => {
            const data = doc.data();
            const credits = data.credits || 0;
            const creditsUsed = data.creditsUsed || 0;

            totalCreditsRemaining += credits;
            totalCreditsConsumed += creditsUsed;
            totalCreditsSold += credits + creditsUsed;
            companyCount += 1;
        });

        const averageCreditsPerCompany = companyCount > 0 ? totalCreditsSold / companyCount : 0;
        const creditBurnRate = totalCreditsConsumed > 0 ? Math.round(totalCreditsConsumed / 30) : 0;

        return {
            totalCreditsSold,
            totalCreditsConsumed,
            totalCreditsRemaining,
            averageCreditsPerCompany: Math.round(averageCreditsPerCompany),
            creditBurnRate
        };
    } catch (error) {
        console.error('Error getting credit usage stats:', error);
        return {
            totalCreditsSold: 0,
            totalCreditsConsumed: 0,
            totalCreditsRemaining: 0,
            averageCreditsPerCompany: 0,
            creditBurnRate: 0
        };
    }
};

// ==========================================
// PAYMENT METRICS
// ==========================================

export const getPaymentMetrics = async (): Promise<PaymentMetrics> => {
    try {
        const paymentsRef = collection(db, 'payment-transactions');
        const paymentsSnapshot = await getDocs(paymentsRef);

        let totalPayments = 0;
        let successfulPayments = 0;
        let failedPayments = 0;
        let pendingPayments = 0;

        paymentsSnapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'pending';

            totalPayments += 1;

            if (status === 'success') {
                successfulPayments += 1;
            } else if (status === 'failed') {
                failedPayments += 1;
            } else {
                pendingPayments += 1;
            }
        });

        const successRate = totalPayments > 0
            ? Math.round((successfulPayments / totalPayments) * 100)
            : 0;

        return {
            totalPayments,
            successfulPayments,
            failedPayments,
            pendingPayments,
            successRate
        };
    } catch (error) {
        console.error('Error getting payment metrics:', error);
        return {
            totalPayments: 0,
            successfulPayments: 0,
            failedPayments: 0,
            pendingPayments: 0,
            successRate: 0
        };
    }
};
