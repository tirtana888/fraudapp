import { supabase } from './supabase';

interface SessionRow {
    status?: string;
    completedAt?: string;
    createdAt?: string;
    companyId?: string;
    fraudAnalysis?: {
        scores?: { pressure?: number; opportunity?: number; rationalization?: number };
        riskLevel?: string;
    };
}

interface CompanyRow {
    id: string;
    name?: string;
}

export interface AssessmentMetrics {
    totalAssessments: number;
    completedAssessments: number;
    pendingAssessments: number;
    abandonedAssessments: number;
    completionRate: number;
    averageCompletionTime: number;
    activeAssessments: number;
}

export interface FraudStats {
    totalFraudCases: number;
    fraudDetectionRate: number;
    averageFraudScore: number;
    riskDistribution: { low: number; medium: number; high: number; critical: number };
}

export interface CandidateAnalytics {
    totalCandidates: number;
    averageFraudScore: number;
    rejectionRate: number;
    topCompanies: Array<{ companyId: string; companyName: string; assessmentCount: number; averageScore: number }>;
}

export const getAssessmentMetrics = async (): Promise<AssessmentMetrics> => {
    try {
        const { data, error } = await supabase.from('interview_sessions').select('*');
        if (error) throw error;
        const sessions = data || [];

        let total = sessions.length;
        let completed = 0, pending = 0, abandoned = 0, active = 0, totalCompletionTime = 0, completionCount = 0;

        sessions.forEach((s: SessionRow) => {
            const status = s.status || 'PENDING';
            if (status === 'COMPLETED') {
                completed++;
                if (s.completedAt && s.createdAt) {
                    const duration = (new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime()) / 60000;
                    if (duration > 0 && duration < 1440) { totalCompletionTime += duration; completionCount++; }
                }
            } else if (['IN_PROGRESS', 'ACTIVE', 'active'].includes(status)) {
                pending++; active++;
            } else { abandoned++; }
        });

        return {
            totalAssessments: total,
            completedAssessments: completed,
            pendingAssessments: pending,
            abandonedAssessments: abandoned,
            completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
            averageCompletionTime: completionCount > 0 ? Math.round(totalCompletionTime / completionCount) : 0,
            activeAssessments: active
        };
    } catch (error) {
        console.error('Error getting assessment metrics:', error);
        return { totalAssessments: 0, completedAssessments: 0, pendingAssessments: 0, abandonedAssessments: 0, completionRate: 0, averageCompletionTime: 0, activeAssessments: 0 };
    }
};

export const getFraudStats = async (): Promise<FraudStats> => {
    try {
        const { data, error } = await supabase.from('interview_sessions').select('*').eq('status', 'COMPLETED');
        if (error) throw error;
        const sessions = data || [];

        let totalFraudCases = 0, totalFraudScore = 0, scoreCount = 0;
        const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

        sessions.forEach((s: SessionRow) => {
            if (s.fraudAnalysis?.scores) {
                const scores = s.fraudAnalysis.scores;
                const avg = ((scores.pressure || 0) + (scores.opportunity || 0) + (scores.rationalization || 0)) / 3;
                totalFraudScore += avg; scoreCount++;
                if (avg > 60) totalFraudCases++;
                const risk = (s.fraudAnalysis.riskLevel || '').toLowerCase();
                if (risk.includes('low')) riskDistribution.low++;
                else if (risk.includes('medium')) riskDistribution.medium++;
                else if (risk.includes('high')) riskDistribution.high++;
                else if (risk.includes('critical')) riskDistribution.critical++;
            }
        });

        const total = sessions.length;
        return {
            totalFraudCases,
            fraudDetectionRate: total > 0 ? Math.round((totalFraudCases / total) * 1000) / 10 : 0,
            averageFraudScore: scoreCount > 0 ? Math.round(totalFraudScore / scoreCount) : 0,
            riskDistribution
        };
    } catch (error) {
        console.error('Error getting fraud stats:', error);
        return { totalFraudCases: 0, fraudDetectionRate: 0, averageFraudScore: 0, riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 } };
    }
};

export const getCandidateAnalytics = async (): Promise<CandidateAnalytics> => {
    try {
        const [{ data: sessions }, { data: companies }] = await Promise.all([
            supabase.from('interview_sessions').select('*'),
            supabase.from('companies').select('id, name'),
        ]);

        const companyNames: Record<string, string> = {};
        (companies || []).forEach((c: CompanyRow) => { companyNames[c.id] = c.name || 'Unknown'; });

        let totalCandidates = 0, totalFraudScore = 0, scoreCount = 0, rejectedCount = 0;
        const companyStats: Record<string, { count: number; totalScore: number; scoreCount: number }> = {};

        (sessions || []).forEach((s: SessionRow) => {
            totalCandidates++;
            const cid = s.companyId || 'unknown';
            if (!companyStats[cid]) companyStats[cid] = { count: 0, totalScore: 0, scoreCount: 0 };
            companyStats[cid].count++;
            if (s.fraudAnalysis?.scores) {
                const scores = s.fraudAnalysis.scores;
                const avg = ((scores.pressure || 0) + (scores.opportunity || 0) + (scores.rationalization || 0)) / 3;
                totalFraudScore += avg; scoreCount++;
                companyStats[cid].totalScore += avg; companyStats[cid].scoreCount++;
            }
            if (s.status === 'REJECTED' || (s.fraudAnalysis?.riskLevel && ['High', 'Critical'].includes(s.fraudAnalysis.riskLevel))) rejectedCount++;
        });

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
            averageFraudScore: scoreCount > 0 ? Math.round(totalFraudScore / scoreCount) : 0,
            rejectionRate: totalCandidates > 0 ? Math.round((rejectedCount / totalCandidates) * 1000) / 10 : 0,
            topCompanies
        };
    } catch (error) {
        console.error('Error getting candidate analytics:', error);
        return { totalCandidates: 0, averageFraudScore: 0, rejectionRate: 0, topCompanies: [] };
    }
};
