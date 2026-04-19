/**
 * User Management Service
 * Handles business user management operations
 */

import { db, auth } from './firebase';
import {
    collection,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { createAuditLog } from './systemConfigService';

// ============================================
// TYPES
// ============================================

export interface BusinessUser {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin' | 'superadmin';
    status: 'active' | 'suspended' | 'banned';
    joinedDate: Date;
    lastLogin?: Date;
    companyId?: string;
    companyName?: string;
}

export interface UserStats {
    totalSessions: number;
    totalCandidates: number;
    lastActivity?: Date;
}

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get all business users with optional filters
 * Now loads from companies collection (existing data)
 */
export const getBusinessUsers = async (filters?: {
    role?: string;
    status?: string;
    searchQuery?: string;
    limit?: number;
}): Promise<BusinessUser[]> => {
    try {
        // Load from companies collection (existing data)
        const companiesCollection = collection(db, 'companies');
        let q = query(companiesCollection, orderBy('joinedDate', 'desc'));

        // Apply limit
        if (filters?.limit) {
            q = query(q, firestoreLimit(filters.limit));
        }

        const querySnapshot = await getDocs(q);
        let users: BusinessUser[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Map company data to user format
            users.push({
                id: doc.id,
                email: data.email || '',
                name: data.name || data.email?.split('@')[0] || 'Unknown',
                role: data.tier === 'enterprise' ? 'admin' : 'user', // Map tier to role
                status: data.status || 'active',
                joinedDate: data.joinedDate?.toDate?.() || new Date(),
                lastLogin: data.lastActivity?.toDate?.(),
                companyId: doc.id,
                companyName: data.name
            });
        });

        // Client-side filters
        if (filters?.role) {
            users = users.filter(user => user.role === filters.role);
        }

        if (filters?.status) {
            users = users.filter(user => user.status === filters.status);
        }

        // Client-side search filter
        if (filters?.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            users = users.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query) ||
                user.companyName?.toLowerCase().includes(query)
            );
        }

        return users;
    } catch (error) {
        console.error('Error getting business users:', error);
        throw error;
    }
};

/**
 * Update user role (updates company tier)
 */
export const updateUserRole = async (
    userId: string,
    newRole: 'user' | 'admin' | 'superadmin',
    adminEmail: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', userId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const oldTier = companyDoc.data().tier;
        const newTier = newRole === 'admin' ? 'premium' : 'basic'; // Map role to tier

        await updateDoc(companyRef, {
            tier: newTier,
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Changed tier from ${oldTier} to ${newTier}`,
            oldValue: oldTier,
            newValue: newTier,
            status: 'success'
        });

        console.log(`[UserManagement] Company tier updated: ${userId} -> ${newTier}`);
    } catch (error) {
        console.error('Error updating company tier:', error);

        // Audit log error
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${userId}`,
            details: `Failed to change tier to ${newRole}`,
            status: 'error',
            errorMessage: (error as Error).message
        });

        throw error;
    }
};

/**
 * Suspend user (suspend company)
 */
export const suspendUser = async (
    userId: string,
    adminEmail: string,
    reason?: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', userId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        await updateDoc(companyRef, {
            status: 'suspended',
            suspendedAt: Timestamp.now(),
            suspendedBy: adminEmail,
            suspendReason: reason || 'No reason provided',
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Suspended company. Reason: ${reason || 'No reason'}`,
            status: 'success'
        });

        console.log(`[UserManagement] Company suspended: ${userId}`);
    } catch (error) {
        console.error('Error suspending company:', error);
        throw error;
    }
};

/**
 * Ban user (ban company)
 */
export const banUser = async (
    userId: string,
    adminEmail: string,
    reason?: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', userId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        await updateDoc(companyRef, {
            status: 'banned',
            bannedAt: Timestamp.now(),
            bannedBy: adminEmail,
            banReason: reason || 'No reason provided',
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'deleted',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Banned company. Reason: ${reason || 'No reason'}`,
            status: 'success'
        });

        console.log(`[UserManagement] Company banned: ${userId}`);
    } catch (error) {
        console.error('Error banning company:', error);
        throw error;
    }
};

/**
 * Reactivate user (reactivate company)
 */
export const reactivateUser = async (
    userId: string,
    adminEmail: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', userId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const oldStatus = companyDoc.data().status;

        await updateDoc(companyRef, {
            status: 'active',
            reactivatedAt: Timestamp.now(),
            reactivatedBy: adminEmail,
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Reactivated company from ${oldStatus} status`,
            status: 'success'
        });

        console.log(`[UserManagement] Company reactivated: ${userId}`);
    } catch (error) {
        console.error('Error reactivating company:', error);
        throw error;
    }
};

/**
 * Delete user (delete company - WARNING: permanent)
 */
export const deleteBusinessUser = async (
    userId: string,
    adminEmail: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', userId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const companyEmail = companyDoc.data().email;

        // Delete from Firestore
        await deleteDoc(companyRef);

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'deleted',
            section: 'api-keys',
            resource: `Company: ${companyEmail}`,
            details: `Permanently deleted company account`,
            status: 'success'
        });

        console.log(`[UserManagement] Company deleted: ${userId}`);
    } catch (error) {
        console.error('Error deleting company:', error);
        throw error;
    }
};

/**
 * Get user statistics
 */
export const getUserStats = async (userId: string): Promise<UserStats> => {
    try {
        // Get user's interview sessions
        const sessionsQuery = query(
            collection(db, 'interview-sessions'),
            where('userId', '==', userId)
        );

        const sessionsSnapshot = await getDocs(sessionsQuery);

        return {
            totalSessions: sessionsSnapshot.size,
            totalCandidates: sessionsSnapshot.size,
            lastActivity: new Date() // TODO: Get from actual last activity
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return {
            totalSessions: 0,
            totalCandidates: 0
        };
    }
};

// ============================================
// COMPANY ANALYTICS TYPES
// ============================================

export interface CompanyUsageStats {
    totalAssessments: number;
    completedAssessments: number;
    totalCandidates: number;
    creditsUsed: number;
    creditsRemaining: number;
    lastActivity?: Date;
}

export interface TokenSpendAnalytics {
    totalTokensUsed: number;
    totalCost: number; // in Rupiah
    breakdown: {
        gemini: { tokens: number; cost: number };
        openai: { tokens: number; cost: number };
        mistral: { tokens: number; cost: number };
    };
    byFeature: {
        cvParsing: { tokens: number; cost: number };
        fraudAnalysis: { tokens: number; cost: number };
        assessment: { tokens: number; cost: number };
    };
}

export interface KYCAnalytics {
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    pendingVerifications: number;
    successRate: number; // percentage
    totalCost: number; // in Rupiah
    averageVerificationTime: number; // in seconds
    statusBreakdown: {
        approved: number;
        rejected: number;
        pending: number;
        error: number;
    };
}

// ============================================
// COMPANY ANALYTICS FUNCTIONS
// ============================================

/**
 * Get company usage statistics
 */
export const getCompanyUsageStats = async (companyId: string): Promise<CompanyUsageStats> => {
    try {
        // Get company data
        const companyRef = doc(db, 'companies', companyId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const companyData = companyDoc.data();

        // Get all interview sessions for this company
        const sessionsQuery = query(
            collection(db, 'interview-sessions'),
            where('companyId', '==', companyId)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        let completedCount = 0;
        sessionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'COMPLETED') {
                completedCount++;
            }
        });

        return {
            totalAssessments: sessionsSnapshot.size,
            completedAssessments: completedCount,
            totalCandidates: sessionsSnapshot.size,
            creditsUsed: companyData.creditsUsed || 0,
            creditsRemaining: companyData.credits || 0,
            lastActivity: companyData.lastActivity?.toDate?.()
        };
    } catch (error) {
        console.error('Error getting company usage stats:', error);
        return {
            totalAssessments: 0,
            completedAssessments: 0,
            totalCandidates: 0,
            creditsUsed: 0,
            creditsRemaining: 0
        };
    }
};

/**
 * Get token spend analytics for a company
 */
export const getTokenSpendAnalytics = async (companyId: string): Promise<TokenSpendAnalytics> => {
    try {
        // Get all interview sessions for this company
        const sessionsQuery = query(
            collection(db, 'interview-sessions'),
            where('companyId', '==', companyId)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        let totalTokens = 0;
        let geminiTokens = 0;
        let openaiTokens = 0;
        let mistralTokens = 0;
        let cvParsingTokens = 0;
        let fraudAnalysisTokens = 0;
        let assessmentTokens = 0;

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();

            // Sum up tokens from different AI models
            if (data.aiUsage) {
                geminiTokens += data.aiUsage.gemini?.tokens || 0;
                openaiTokens += data.aiUsage.openai?.tokens || 0;
                mistralTokens += data.aiUsage.mistral?.tokens || 0;
            }

            // Sum up tokens by feature
            if (data.tokenUsage) {
                cvParsingTokens += data.tokenUsage.cvParsing || 0;
                fraudAnalysisTokens += data.tokenUsage.fraudAnalysis || 0;
                assessmentTokens += data.tokenUsage.assessment || 0;
            }
        });

        totalTokens = geminiTokens + openaiTokens + mistralTokens;

        // Calculate costs (example rates - adjust as needed)
        const geminiCost = geminiTokens * 0.001; // Rp per token
        const openaiCost = openaiTokens * 0.002;
        const mistralCost = mistralTokens * 0.0015;
        const totalCost = geminiCost + openaiCost + mistralCost;

        const cvParsingCost = cvParsingTokens * 0.001;
        const fraudAnalysisCost = fraudAnalysisTokens * 0.0015;
        const assessmentCost = assessmentTokens * 0.001;

        return {
            totalTokensUsed: totalTokens,
            totalCost: totalCost,
            breakdown: {
                gemini: { tokens: geminiTokens, cost: geminiCost },
                openai: { tokens: openaiTokens, cost: openaiCost },
                mistral: { tokens: mistralTokens, cost: mistralCost }
            },
            byFeature: {
                cvParsing: { tokens: cvParsingTokens, cost: cvParsingCost },
                fraudAnalysis: { tokens: fraudAnalysisTokens, cost: fraudAnalysisCost },
                assessment: { tokens: assessmentTokens, cost: assessmentCost }
            }
        };
    } catch (error) {
        console.error('Error getting token spend analytics:', error);
        return {
            totalTokensUsed: 0,
            totalCost: 0,
            breakdown: {
                gemini: { tokens: 0, cost: 0 },
                openai: { tokens: 0, cost: 0 },
                mistral: { tokens: 0, cost: 0 }
            },
            byFeature: {
                cvParsing: { tokens: 0, cost: 0 },
                fraudAnalysis: { tokens: 0, cost: 0 },
                assessment: { tokens: 0, cost: 0 }
            }
        };
    }
};

/**
 * Get KYC analytics for a company
 */
export const getKYCAnalytics = async (companyId: string): Promise<KYCAnalytics> => {
    try {
        // Get all interview sessions with KYC data for this company
        const sessionsQuery = query(
            collection(db, 'interview-sessions'),
            where('companyId', '==', companyId)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        let totalVerifications = 0;
        let successful = 0;
        let failed = 0;
        let pending = 0;
        let approved = 0;
        let rejected = 0;
        let error = 0;
        let totalVerificationTime = 0;
        let verificationCount = 0;

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();

            // Check if session has KYC data
            if (data.kycData || data.diditVerification) {
                totalVerifications++;

                const kycStatus = data.kycData?.status || data.diditVerification?.status;

                if (kycStatus === 'approved' || kycStatus === 'verified') {
                    successful++;
                    approved++;
                } else if (kycStatus === 'rejected' || kycStatus === 'failed') {
                    failed++;
                    rejected++;
                } else if (kycStatus === 'pending') {
                    pending++;
                } else if (kycStatus === 'error') {
                    failed++;
                    error++;
                }

                // Calculate verification time if available
                if (data.kycData?.verificationTime) {
                    totalVerificationTime += data.kycData.verificationTime;
                    verificationCount++;
                }
            }
        });

        const successRate = totalVerifications > 0
            ? (successful / totalVerifications) * 100
            : 0;

        const avgVerificationTime = verificationCount > 0
            ? totalVerificationTime / verificationCount
            : 0;

        // KYC cost (example: Rp 5000 per verification)
        const kycCostPerVerification = 5000;
        const totalCost = totalVerifications * kycCostPerVerification;

        return {
            totalVerifications,
            successfulVerifications: successful,
            failedVerifications: failed,
            pendingVerifications: pending,
            successRate: Math.round(successRate * 100) / 100,
            totalCost,
            averageVerificationTime: Math.round(avgVerificationTime),
            statusBreakdown: {
                approved,
                rejected,
                pending,
                error
            }
        };
    } catch (error) {
        console.error('Error getting KYC analytics:', error);
        return {
            totalVerifications: 0,
            successfulVerifications: 0,
            failedVerifications: 0,
            pendingVerifications: 0,
            successRate: 0,
            totalCost: 0,
            averageVerificationTime: 0,
            statusBreakdown: {
                approved: 0,
                rejected: 0,
                pending: 0,
                error: 0
            }
        };
    }
};

/**
 * Update company tier
 */
export const updateCompanyTier = async (
    companyId: string,
    newTier: string,
    adminEmail: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', companyId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const oldTier = companyDoc.data().tier;

        await updateDoc(companyRef, {
            tier: newTier,
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Changed tier from ${oldTier} to ${newTier}`,
            oldValue: oldTier,
            newValue: newTier,
            status: 'success'
        });

        console.log(`[CompanyManagement] Tier updated: ${companyId} -> ${newTier}`);
    } catch (error) {
        console.error('Error updating company tier:', error);
        throw error;
    }
};

/**
 * Add credits to company manually
 */
export const addCompanyCredits = async (
    companyId: string,
    amount: number,
    adminEmail: string,
    reason?: string
): Promise<void> => {
    try {
        const companyRef = doc(db, 'companies', companyId);
        const companyDoc = await getDoc(companyRef);

        if (!companyDoc.exists()) {
            throw new Error('Company not found');
        }

        const currentCredits = companyDoc.data().credits || 0;
        const newCredits = currentCredits + amount;

        await updateDoc(companyRef, {
            credits: newCredits,
            updatedAt: Timestamp.now()
        });

        // Audit log
        await createAuditLog({
            userId: auth.currentUser?.uid || '',
            userEmail: adminEmail,
            action: 'updated',
            section: 'api-keys',
            resource: `Company: ${companyDoc.data().email}`,
            details: `Added ${amount} credits. Reason: ${reason || 'Manual adjustment'}`,
            oldValue: currentCredits.toString(),
            newValue: newCredits.toString(),
            status: 'success'
        });

        console.log(`[CompanyManagement] Credits added: ${companyId} +${amount}`);
    } catch (error) {
        console.error('Error adding company credits:', error);
        throw error;
    }
};
