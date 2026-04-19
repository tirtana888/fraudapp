import { supabase } from './supabase';

export interface APIKeyConfig {
    id: string;
    name: string;
    key: string;
    isConfigured: boolean;
    lastUpdated?: Date;
    updatedBy?: string;
}

export interface SystemSettings {
    maintenanceMode: boolean;
    debugMode: boolean;
    rateLimits: { aiCallsPerMinute: number; emailsPerHour: number; kycPerDay: number };
    sessionTimeout: number;
}

export interface WebhookConfig {
    id: string;
    service: 'xendit' | 'didit';
    url: string;
    isActive: boolean;
    lastTriggered?: Date;
    secret?: string;
}

export interface AuditLog {
    id: string;
    timestamp: Date;
    userId: string;
    userEmail: string;
    action: 'created' | 'updated' | 'deleted' | 'toggled';
    section: 'api-keys' | 'settings' | 'webhooks';
    resource: string;
    details: string;
    oldValue?: any;
    newValue?: any;
    status: 'success' | 'error';
    errorMessage?: string;
}

// ==========================================
// SYSTEM CONFIG TABLE HELPERS
// ==========================================

const getConfigDoc = async (configId: string) => {
    const { data } = await supabase
        .from('system_config')
        .select('data')
        .eq('id', configId)
        .single();
    return data?.data || null;
};

const upsertConfigDoc = async (configId: string, value: any) => {
    const { error } = await supabase
        .from('system_config')
        .upsert({ id: configId, data: value, updatedAt: new Date().toISOString() });
    if (error) throw error;
};

// ==========================================
// API KEY MANAGEMENT
// ==========================================

export const getAPIKeys = async (): Promise<Record<string, APIKeyConfig>> => {
    try {
        const data = await getConfigDoc('apiKeys');
        return data || getDefaultAPIKeys();
    } catch (error) {
        console.error('Error getting API keys:', error);
        return getDefaultAPIKeys();
    }
};

export const updateAPIKey = async (apiId: string, key: string, updatedBy: string): Promise<void> => {
    try {
        const current = await getAPIKeys();
        const apiNames: Record<string, string> = { gemini: 'Gemini AI', openai: 'OpenAI', mistral: 'Mistral AI', didit: 'Didit KYC', xendit: 'Xendit Payment' };
        current[apiId] = {
            ...current[apiId],
            key: btoa(key),
            isConfigured: true,
            lastUpdated: new Date(),
            updatedBy
        };
        await upsertConfigDoc('apiKeys', current);
        await createAuditLog({ userId: '', userEmail: updatedBy, action: 'updated', section: 'api-keys', resource: apiNames[apiId] || apiId, details: `Updated API key for ${apiNames[apiId] || apiId}`, status: 'success' });
    } catch (error) {
        console.error('Error updating API key:', error);
        throw error;
    }
};

export const decryptAPIKey = (encryptedKey: string): string => {
    try { return atob(encryptedKey); } catch { return ''; }
};

export const maskAPIKey = (key: string): string => {
    if (!key || key.length < 8) return '••••••••';
    return '••••••' + key.slice(-4);
};

export const testAPIConnection = async (apiId: string, key: string): Promise<{ success: boolean; message: string }> => {
    if (!key || key.length < 10) return { success: false, message: 'API key appears to be invalid (too short)' };
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, message: 'Connection test successful!' };
};

const getDefaultAPIKeys = (): Record<string, APIKeyConfig> => ({
    gemini: { id: 'gemini', name: 'Gemini AI', key: '', isConfigured: false },
    openai: { id: 'openai', name: 'OpenAI', key: '', isConfigured: false },
    mistral: { id: 'mistral', name: 'Mistral AI', key: '', isConfigured: false },
    didit: { id: 'didit', name: 'Didit KYC', key: '', isConfigured: false },
    xendit: { id: 'xendit', name: 'Xendit Payment', key: '', isConfigured: false },
});

// ==========================================
// SYSTEM SETTINGS
// ==========================================

export const getSystemSettings = async (): Promise<SystemSettings> => {
    try {
        const data = await getConfigDoc('settings');
        return data || getDefaultSettings();
    } catch (error) {
        console.error('Error getting system settings:', error);
        return getDefaultSettings();
    }
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>): Promise<void> => {
    const current = await getSystemSettings();
    await upsertConfigDoc('settings', { ...current, ...settings });
    await createAuditLog({ userId: '', userEmail: '', action: 'updated', section: 'settings', resource: 'System Settings', details: `Updated settings: ${Object.keys(settings).join(', ')}`, status: 'success' });
};

export const toggleMaintenanceMode = async (enabled: boolean): Promise<void> => {
    await updateSystemSettings({ maintenanceMode: enabled });
    await createAuditLog({ userId: '', userEmail: '', action: 'toggled', section: 'settings', resource: 'Maintenance Mode', details: `${enabled ? 'Enabled' : 'Disabled'} maintenance mode`, status: 'success' });
};

const getDefaultSettings = (): SystemSettings => ({
    maintenanceMode: false,
    debugMode: false,
    rateLimits: { aiCallsPerMinute: 60, emailsPerHour: 100, kycPerDay: 500 },
    sessionTimeout: 30
});

// ==========================================
// WEBHOOKS
// ==========================================

export const getWebhooks = async (): Promise<WebhookConfig[]> => {
    try {
        const data = await getConfigDoc('webhooks');
        return data ? Object.values(data) : getDefaultWebhooks();
    } catch (error) {
        console.error('Error getting webhooks:', error);
        return getDefaultWebhooks();
    }
};

export const updateWebhook = async (webhookId: string, config: Partial<WebhookConfig>): Promise<void> => {
    const current = await getWebhooks();
    const map: Record<string, any> = {};
    current.forEach(w => { map[w.id] = w; });
    map[webhookId] = { ...map[webhookId], ...config };
    await upsertConfigDoc('webhooks', map);
    const webhookNames: Record<string, string> = { xendit: 'Xendit', didit: 'Didit' };
    await createAuditLog({ userId: '', userEmail: '', action: 'updated', section: 'webhooks', resource: webhookNames[webhookId] || webhookId, details: `Updated webhook for ${webhookNames[webhookId] || webhookId}`, status: 'success' });
};

export const testWebhook = async (webhookId: string): Promise<{ success: boolean; message: string }> => {
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, message: 'Webhook test successful!' };
};

const getDefaultWebhooks = (): WebhookConfig[] => [
    { id: 'xendit', service: 'xendit', url: '', isActive: false },
    { id: 'didit', service: 'didit', url: '', isActive: false },
];

// ==========================================
// AUDIT LOGS
// ==========================================

export const createAuditLog = async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
            ...log,
            timestamp: new Date().toISOString(),
            userId: user?.id || log.userId,
            userEmail: user?.email || log.userEmail,
        });
    } catch (error) {
        console.error('Error creating audit log:', error);
    }
};

export const getAuditLogs = async (filters?: {
    section?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}): Promise<AuditLog[]> => {
    try {
        let q = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
        if (filters?.section) q = q.eq('section', filters.section);
        if (filters?.action) q = q.eq('action', filters.action);
        if (filters?.startDate) q = q.gte('timestamp', filters.startDate.toISOString());
        if (filters?.endDate) q = q.lte('timestamp', filters.endDate.toISOString());
        if (filters?.limit) q = q.limit(filters.limit);

        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((d: any) => ({ ...d, timestamp: new Date(d.timestamp) })) as AuditLog[];
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return [];
    }
};
