import { supabase } from './supabase';
import { createAuditLog } from './systemConfigService';

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
    totalCost: number;
    breakdown: { gemini: { tokens: number; cost: number }; openai: { tokens: number; cost: number }; mistral: { tokens: number; cost: number } };
    byFeature: { cvParsing: { tokens: number; cost: number }; fraudAnalysis: { tokens: number; cost: number }; assessment: { tokens: number; cost: number } };
}

export interface KYCAnalytics {
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    pendingVerifications: number;
    successRate: number;
    totalCost: number;
    averageVerificationTime: number;
    statusBreakdown: { approved: number; rejected: number; pending: number; error: number };
}

export const getBusinessUsers = async (filters?: {
    role?: string;
    status?: string;
    searchQuery?: string;
    limit?: number;
}): Promise<BusinessUser[]> => {
    try {
        let q = supabase.from('companies').select('*').order('joinedDate', { ascending: false });
        if (filters?.limit) q = q.limit(filters.limit);

        const { data, error } = await q;
        if (error) throw error;

        type CompanyRow = { id: string; email?: string; adminEmail?: string; name?: string; tier?: string; status?: string; joinedDate?: string; lastActivity?: string };
        let users: BusinessUser[] = (data || []).map((c: CompanyRow) => ({
            id: c.id,
            email: c.email || c.adminEmail || '',
            name: c.name || c.email?.split('@')[0] || 'Unknown',
            role: (c.tier === 'enterprise' ? 'admin' : 'user') as BusinessUser['role'],
            status: (c.status || 'active') as BusinessUser['status'],
            joinedDate: c.joinedDate ? new Date(c.joinedDate) : new Date(),
            lastLogin: c.lastActivity ? new Date(c.lastActivity) : undefined,
            companyId: c.id,
            companyName: c.name,
        }));

        if (filters?.role) users = users.filter(u => u.role === filters.role);
        if (filters?.status) users = users.filter(u => u.status === filters.status);
        if (filters?.searchQuery) {
            const q2 = filters.searchQuery.toLowerCase();
            users = users.filter(u =>
                u.name.toLowerCase().includes(q2) ||
                u.email.toLowerCase().includes(q2) ||
                u.companyName?.toLowerCase().includes(q2)
            );
        }

        return users;
    } catch (error) {
        console.error('Error getting business users:', error);
        throw error;
    }
};

export const updateUserRole = async (userId: string, newRole: 'user' | 'admin' | 'superadmin', adminEmail: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('tier, email').eq('id', userId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const newTier = newRole === 'admin' ? 'premium' : 'basic';
    const { error } = await supabase.from('_companies').update({ tier: newTier, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'updated', section: 'api-keys', resource: `Company: ${company.email}`, details: `Changed tier from ${company.tier} to ${newTier}`, oldValue: company.tier, newValue: newTier, status: 'success' });
};

export const suspendUser = async (userId: string, adminEmail: string, reason?: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('email').eq('id', userId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const { error } = await supabase.from('_companies').update({ status: 'suspended', suspended_at: new Date().toISOString(), suspended_by: adminEmail, suspend_reason: reason || 'No reason provided', updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'updated', section: 'api-keys', resource: `Company: ${company.email}`, details: `Suspended company. Reason: ${reason || 'No reason'}`, status: 'success' });
};

export const banUser = async (userId: string, adminEmail: string, reason?: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('email').eq('id', userId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const { error } = await supabase.from('_companies').update({ status: 'banned', banned_at: new Date().toISOString(), banned_by: adminEmail, ban_reason: reason || 'No reason provided', updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'deleted', section: 'api-keys', resource: `Company: ${company.email}`, details: `Banned company. Reason: ${reason || 'No reason'}`, status: 'success' });
};

export const reactivateUser = async (userId: string, adminEmail: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('email, status').eq('id', userId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const oldStatus = company.status;
    const { error } = await supabase.from('_companies').update({ status: 'active', reactivated_at: new Date().toISOString(), reactivated_by: adminEmail, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'updated', section: 'api-keys', resource: `Company: ${company.email}`, details: `Reactivated company from ${oldStatus} status`, status: 'success' });
};

export const deleteBusinessUser = async (userId: string, adminEmail: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('email').eq('id', userId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const { error } = await supabase.from('_companies').delete().eq('id', userId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'deleted', section: 'api-keys', resource: `Company: ${company.email}`, details: 'Permanently deleted company account', status: 'success' });
};

export const getUserStats = async (userId: string): Promise<UserStats> => {
    const { data, error } = await supabase.from('interview_sessions').select('id').eq('userId', userId);
    if (error) return { totalSessions: 0, totalCandidates: 0 };
    return { totalSessions: data?.length || 0, totalCandidates: data?.length || 0, lastActivity: new Date() };
};

export const getCompanyUsageStats = async (companyId: string): Promise<CompanyUsageStats> => {
    try {
        const [{ data: company }, { data: sessions }] = await Promise.all([
            supabase.from('companies').select('credits, creditsUsed, lastActivity').eq('id', companyId).single(),
            supabase.from('interview_sessions').select('status').eq('companyId', companyId),
        ]);
        const completed = (sessions || []).filter((s: { status: string }) => s.status === 'COMPLETED').length;
        return {
            totalAssessments: sessions?.length || 0,
            completedAssessments: completed,
            totalCandidates: sessions?.length || 0,
            creditsUsed: company?.creditsUsed || 0,
            creditsRemaining: company?.credits || 0,
            lastActivity: company?.lastActivity ? new Date(company.lastActivity) : undefined,
        };
    } catch (error) {
        console.error('Error getting company usage stats:', error);
        return { totalAssessments: 0, completedAssessments: 0, totalCandidates: 0, creditsUsed: 0, creditsRemaining: 0 };
    }
};

export const getTokenSpendAnalytics = async (companyId: string): Promise<TokenSpendAnalytics> => {
    return {
        totalTokensUsed: 0, totalCost: 0,
        breakdown: { gemini: { tokens: 0, cost: 0 }, openai: { tokens: 0, cost: 0 }, mistral: { tokens: 0, cost: 0 } },
        byFeature: { cvParsing: { tokens: 0, cost: 0 }, fraudAnalysis: { tokens: 0, cost: 0 }, assessment: { tokens: 0, cost: 0 } }
    };
};

export const getKYCAnalytics = async (companyId: string): Promise<KYCAnalytics> => {
    return {
        totalVerifications: 0, successfulVerifications: 0, failedVerifications: 0, pendingVerifications: 0,
        successRate: 0, totalCost: 0, averageVerificationTime: 0,
        statusBreakdown: { approved: 0, rejected: 0, pending: 0, error: 0 }
    };
};

export const updateCompanyTier = async (companyId: string, newTier: string, adminEmail: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('tier, email').eq('id', companyId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const { error } = await supabase.from('_companies').update({ tier: newTier, updated_at: new Date().toISOString() }).eq('id', companyId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'updated', section: 'api-keys', resource: `Company: ${company.email}`, details: `Changed tier from ${company.tier} to ${newTier}`, oldValue: company.tier, newValue: newTier, status: 'success' });
};

export const addCompanyCredits = async (companyId: string, amount: number, adminEmail: string, reason?: string): Promise<void> => {
    const { data: company, error: fetchErr } = await supabase.from('companies').select('credits, email').eq('id', companyId).single();
    if (fetchErr || !company) throw new Error('Company not found');
    const currentCredits = company.credits || 0;
    const newCredits = currentCredits + amount;
    const { error } = await supabase.from('_companies').update({ credits: newCredits, updated_at: new Date().toISOString() }).eq('id', companyId);
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await createAuditLog({ userId: user?.id || '', userEmail: adminEmail, action: 'updated', section: 'api-keys', resource: `Company: ${company.email}`, details: `Added ${amount} credits. Reason: ${reason || 'Manual adjustment'}`, oldValue: currentCredits.toString(), newValue: newCredits.toString(), status: 'success' });
};
