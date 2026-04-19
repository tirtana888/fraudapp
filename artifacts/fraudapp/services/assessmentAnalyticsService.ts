/**
 * ASSESSMENT ANALYTICS SERVICE
 * Handles all assessment performance and fraud detection analytics
 */

import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// ==========================================
// INTERFACES
// ==========================================

export interface AssessmentMetrics {
    totalAssessments: number;
    completedAssessments: number;
    pendingAssessments: number;
    abandonedAssessments: number;
    completionRate: number;
    averageCompletionTime: number; // in minutes
    activeAssessments: number;
}

export interface FraudStats {
    totalFraudCases: number;
    fraudDetectionRate: number;
    averageFraudScore: number;
    riskDistribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}

export interface CandidateAnalytics {
    totalCandidates: number;
    averageFraudScore: number;
    rejectionRate: number;
    topCompanies: Array<{
        companyId: string;
        companyName: string;
        assessmentCount: number;
        averageScore: number;
    }>;
}

// ==========================================
// ASSESSMENT METRICS
// ==========================================

/**
 * Get comprehensive assessment performance metrics
 */
export const getAssessmentMetrics = async (): Promise<AssessmentMetrics> => {
    try {
        const sessionsRef = collection(db, 'interview-sessions');
        const sessionsSnapshot = await getDocs(sessionsRef);

        let total = 0;
        let completed = 0;
        let pending = 0;
        let abandoned = 0;
        let active = 0;
        let totalCompletionTime = 0;
        let completionCount = 0;

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();
            total++;

            const status = data.status || 'PENDING';

            if (status === 'COMPLETED') {
                completed++;

                // Calculate completion time if timestamps exist
                if (data.completedAt && data.createdAt) {
                    const startTime = data.createdAt?.toDate?.() || new Date(data.createdAt);
                    const endTime = data.completedAt?.toDate?.() || new Date(data.completedAt);
                    const duration = (endTime.getTime() - startTime.getTime()) / 60000; // Convert to minutes

                    if (duration > 0 && duration < 1440) { // Ignore if > 24 hours
                        totalCompletionTime += duration;
                        completionCount++;
                    }
                }
            } else if (status === 'IN_PROGRESS' || status === 'ACTIVE') {
                pending++;
                active++;
            } else {
                abandoned++;
            }
        });

        const completionRate = total > 0 ? (completed / total) * 100 : 0;
        const averageCompletionTime = completionCount > 0 ? totalCompletionTime / completionCount : 0;

        return {
            totalAssessments: total,
            completedAssessments: completed,
            pendingAssessments: pending,
            abandonedAssessments: abandoned,
            completionRate: Math.round(completionRate * 10) / 10,
            averageCompletionTime: Math.round(averageCompletionTime),
            activeAssessments: active
        };
    } catch (error) {
        console.error('Error getting assessment metrics:', error);
        return {
            totalAssessments: 0,
            completedAssessments: 0,
            pendingAssessments: 0,
            abandonedAssessments: 0,
            completionRate: 0,
            averageCompletionTime: 0,
            activeAssessments: 0
        };
    }
};

// ==========================================
// FRAUD DETECTION STATS
// ==========================================

/**
 * Get fraud detection statistics
 */
export const getFraudStats = async (): Promise<FraudStats> => {
    try {
        const sessionsRef = collection(db, 'interview-sessions');
        const completedQuery = query(sessionsRef, where('status', '==', 'COMPLETED'));
        const sessionsSnapshot = await getDocs(completedQuery);

        let totalFraudCases = 0;
        let totalFraudScore = 0;
        let scoreCount = 0;

        const riskDistribution = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0
        };

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();

            // Check fraud analysis data
            if (data.fraudAnalysis) {
                const riskLevel = data.fraudAnalysis.riskLevel || data.riskLevel || 'Low';
                const scores = data.fraudAnalysis.scores;

                // Calculate average fraud score
                if (scores) {
                    const avgScore = (
                        (scores.pressure || 0) +
                        (scores.opportunity || 0) +
                        (scores.rationalization || 0)
                    ) / 3;

                    totalFraudScore += avgScore;
                    scoreCount++;

                    // Count as fraud case if score > 60
                    if (avgScore > 60) {
                        totalFraudCases++;
                    }
                }

                // Risk distribution
                const risk = riskLevel.toLowerCase();
                if (risk.includes('low')) {
                    riskDistribution.low++;
                } else if (risk.includes('medium')) {
                    riskDistribution.medium++;
                } else if (risk.includes('high')) {
                    riskDistribution.high++;
                } else if (risk.includes('critical')) {
                    riskDistribution.critical++;
                }
            }
        });

        const total = sessionsSnapshot.size;
        const fraudDetectionRate = total > 0 ? (totalFraudCases / total) * 100 : 0;
        const averageFraudScore = scoreCount > 0 ? totalFraudScore / scoreCount : 0;

        return {
            totalFraudCases,
            fraudDetectionRate: Math.round(fraudDetectionRate * 10) / 10,
            averageFraudScore: Math.round(averageFraudScore),
            riskDistribution
        };
    } catch (error) {
        console.error('Error getting fraud stats:', error);
        return {
            totalFraudCases: 0,
            fraudDetectionRate: 0,
            averageFraudScore: 0,
            riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
        };
    }
};

// ==========================================
// CANDIDATE ANALYTICS
// ==========================================

/**
 * Get candidate analytics and top companies
 */
export const getCandidateAnalytics = async (): Promise<CandidateAnalytics> => {
    try {
        const sessionsRef = collection(db, 'interview-sessions');
        const sessionsSnapshot = await getDocs(sessionsRef);

        const companiesRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);

        // Build company name map
        const companyNames: { [key: string]: string } = {};
        companiesSnapshot.forEach(doc => {
            companyNames[doc.id] = doc.data().name || 'Unknown Company';
        });

        let totalCandidates = 0;
        let totalFraudScore = 0;
        let scoreCount = 0;
        let rejectedCount = 0;

        const companyStats: { [key: string]: { count: number; totalScore: number; scoreCount: number } } = {};

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();
            totalCandidates++;

            const companyId = data.companyId || 'unknown';

            // Initialize company stats
            if (!companyStats[companyId]) {
                companyStats[companyId] = { count: 0, totalScore: 0, scoreCount: 0 };
            }
            companyStats[companyId].count++;

            // Calculate fraud score
            if (data.fraudAnalysis?.scores) {
                const scores = data.fraudAnalysis.scores;
                const avgScore = (
                    (scores.pressure || 0) +
                    (scores.opportunity || 0) +
                    (scores.rationalization || 0)
                ) / 3;

                totalFraudScore += avgScore;
                scoreCount++;

                companyStats[companyId].totalScore += avgScore;
                companyStats[companyId].scoreCount++;
            }

            // Check if rejected
            if (data.status === 'REJECTED' || data.fraudAnalysis?.riskLevel === 'High' || data.fraudAnalysis?.riskLevel === 'Critical') {
                rejectedCount++;
            }
        });

        const averageFraudScore = scoreCount > 0 ? totalFraudScore / scoreCount : 0;
        const rejectionRate = totalCandidates > 0 ? (rejectedCount / totalCandidates) * 100 : 0;

        // Get top 5 companies by assessment count
        const topCompanies = Object.entries(companyStats)
            .map(([companyId, stats]) => ({
                companyId,
                companyName: companyNames[companyId] || 'Unknown',
                assessmentCount: stats.count,
                averageScore: stats.scoreCount > 0 ? Math.round(stats.totalScore / stats.scoreCount) : 0
            }))
            .sort((a, b) => b.assessmentCount - a.assessmentCount)
            .slice(0, 5);

        return {
            totalCandidates,
            averageFraudScore: Math.round(averageFraudScore),
            rejectionRate: Math.round(rejectionRate * 10) / 10,
            topCompanies
        };
    } catch (error) {
        console.error('Error getting candidate analytics:', error);
        return {
            totalCandidates: 0,
            averageFraudScore: 0,
            rejectionRate: 0,
            topCompanies: []
        };
    }
};
