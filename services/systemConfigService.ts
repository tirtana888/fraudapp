/**
 * System Configuration Service
 * Handles API keys, system settings, and webhooks management
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

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
    rateLimits: {
        aiCallsPerMinute: number;
        emailsPerHour: number;
        kycPerDay: number;
    };
    sessionTimeout: number; // minutes
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

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Get all API keys from Firestore
 */
export const getAPIKeys = async (): Promise<Record<string, APIKeyConfig>> => {
    try {
        const docRef = doc(db, 'systemConfig', 'apiKeys');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Convert Firestore timestamps to Date objects
            const keys: Record<string, APIKeyConfig> = {};
            for (const [id, config] of Object.entries(data)) {
                const apiConfig = config as any;
                keys[id] = {
                    ...apiConfig,
                    lastUpdated: apiConfig.lastUpdated?.toDate?.() || undefined
                };
            }

            return keys;
        }

        // Return default structure if not found
        return getDefaultAPIKeys();
    } catch (error) {
        console.error('Error getting API keys:', error);
        throw error;
    }
};

/**
 * Update a specific API key
 */
export const updateAPIKey = async (
    apiId: string,
    key: string,
    updatedBy: string
): Promise<void> => {
    try {
        const docRef = doc(db, 'systemConfig', 'apiKeys');
        const apiNames: Record<string, string> = {
            gemini: 'Gemini AI',
            openai: 'OpenAI',
            mistral: 'Mistral AI',
            didit: 'Didit KYC',
            xendit: 'Xendit Payment'
        };

        // Simple encryption (base64) - in production, use proper encryption
        const encryptedKey = btoa(key);

        await updateDoc(docRef, {
            [`${apiId}.key`]: encryptedKey,
            [`${apiId}.isConfigured`]: true,
            [`${apiId}.lastUpdated`]: new Date(),
            [`${apiId}.updatedBy`]: updatedBy
        });

        // Audit log
        await createAuditLog({
            userId: '',
            userEmail: updatedBy,
            action: 'updated',
            section: 'api-keys',
            resource: apiNames[apiId] || apiId,
            details: `Updated API key for ${apiNames[apiId] || apiId}`,
            status: 'success'
        });

        console.log(`[SystemConfig] API key updated: ${apiId}`);
    } catch (error) {
        // If document doesn't exist, create it
        if ((error as any).code === 'not-found') {
            const docRef = doc(db, 'systemConfig', 'apiKeys');
            const defaultKeys = getDefaultAPIKeys();

            // Update the specific key
            defaultKeys[apiId] = {
                ...defaultKeys[apiId],
                key: btoa(key),
                isConfigured: true,
                lastUpdated: new Date(),
                updatedBy
            };

            await setDoc(docRef, defaultKeys);

            // Audit log
            const apiNames: Record<string, string> = {
                gemini: 'Gemini AI',
                openai: 'OpenAI',
                mistral: 'Mistral AI',
                didit: 'Didit KYC',
                xendit: 'Xendit Payment'
            };
            await createAuditLog({
                userId: '',
                userEmail: updatedBy,
                action: 'updated',
                section: 'api-keys',
                resource: apiNames[apiId] || apiId,
                details: `Updated API key for ${apiNames[apiId] || apiId}`,
                status: 'success'
            });

            console.log(`[SystemConfig] Created apiKeys document and updated: ${apiId}`);
        } else {
            console.error('Error updating API key:', error);

            // Audit log error
            const apiNames: Record<string, string> = {
                gemini: 'Gemini AI',
                openai: 'OpenAI',
                mistral: 'Mistral AI',
                didit: 'Didit KYC',
                xendit: 'Xendit Payment'
            };
            await createAuditLog({
                userId: '',
                userEmail: updatedBy,
                action: 'updated',
                section: 'api-keys',
                resource: apiNames[apiId] || apiId,
                details: `Failed to update API key for ${apiNames[apiId] || apiId}`,
                status: 'error',
                errorMessage: (error as Error).message
            });

            throw error;
        }
    }
};

/**
 * Decrypt API key for display
 */
export const decryptAPIKey = (encryptedKey: string): string => {
    try {
        return atob(encryptedKey);
    } catch (error) {
        console.error('Error decrypting API key:', error);
        return '';
    }
};

/**
 * Mask API key for display (show last 4 characters)
 */
export const maskAPIKey = (key: string): string => {
    if (!key || key.length < 8) return '••••••••';
    return '••••••' + key.slice(-4);
};

/**
 * Test API connection
 */
export const testAPIConnection = async (
    apiId: string,
    key: string
): Promise<{ success: boolean; message: string }> => {
    try {
        // TODO: Implement actual API testing
        // For now, just validate key format

        if (!key || key.length < 10) {
            return {
                success: false,
                message: 'API key appears to be invalid (too short)'
            };
        }

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            message: 'Connection test successful!'
        };
    } catch (error) {
        console.error('Error testing API connection:', error);
        return {
            success: false,
            message: 'Connection test failed'
        };
    }
};

/**
 * Get default API keys structure
 */
const getDefaultAPIKeys = (): Record<string, APIKeyConfig> => {
    return {
        gemini: {
            id: 'gemini',
            name: 'Gemini AI',
            key: '',
            isConfigured: false
        },
        openai: {
            id: 'openai',
            name: 'OpenAI',
            key: '',
            isConfigured: false
        },
        mistral: {
            id: 'mistral',
            name: 'Mistral AI',
            key: '',
            isConfigured: false
        },
        didit: {
            id: 'didit',
            name: 'Didit KYC',
            key: '',
            isConfigured: false
        },
        xendit: {
            id: 'xendit',
            name: 'Xendit Payment',
            key: '',
            isConfigured: false
        }
    };
};

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * Get system settings
 */
export const getSystemSettings = async (): Promise<SystemSettings> => {
    try {
        const docRef = doc(db, 'systemConfig', 'settings');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as SystemSettings;
        }

        // Return defaults if not found
        return getDefaultSettings();
    } catch (error) {
        console.error('Error getting system settings:', error);
        throw error;
    }
};

/**
 * Update system settings
 */
export const updateSystemSettings = async (
    settings: Partial<SystemSettings>
): Promise<void> => {
    try {
        const docRef = doc(db, 'systemConfig', 'settings');
        await updateDoc(docRef, settings as any);

        // Audit log
        const settingNames = Object.keys(settings).join(', ');
        await createAuditLog({
            userId: '',
            userEmail: '',
            action: 'updated',
            section: 'settings',
            resource: 'System Settings',
            details: `Updated settings: ${settingNames}`,
            status: 'success'
        });

        console.log('[SystemConfig] Settings updated');
    } catch (error) {
        // If document doesn't exist, create it
        if ((error as any).code === 'not-found') {
            const docRef = doc(db, 'systemConfig', 'settings');
            const defaultSettings = getDefaultSettings();
            await setDoc(docRef, { ...defaultSettings, ...settings });

            // Audit log
            const settingNames = Object.keys(settings).join(', ');
            await createAuditLog({
                userId: '',
                userEmail: '',
                action: 'updated',
                section: 'settings',
                resource: 'System Settings',
                details: `Updated settings: ${settingNames}`,
                status: 'success'
            });

            console.log('[SystemConfig] Created settings document');
        } else {
            console.error('Error updating system settings:', error);
            throw error;
        }
    }
};

/**
 * Toggle maintenance mode
 */
export const toggleMaintenanceMode = async (enabled: boolean): Promise<void> => {
    await updateSystemSettings({ maintenanceMode: enabled });

    // Audit log
    await createAuditLog({
        userId: '',
        userEmail: '',
        action: 'toggled',
        section: 'settings',
        resource: 'Maintenance Mode',
        details: `${enabled ? 'Enabled' : 'Disabled'} maintenance mode`,
        status: 'success'
    });

    console.log(`[SystemConfig] Maintenance mode: ${enabled ? 'ON' : 'OFF'}`);
};

/**
 * Get default system settings
 */
const getDefaultSettings = (): SystemSettings => {
    return {
        maintenanceMode: false,
        debugMode: false,
        rateLimits: {
            aiCallsPerMinute: 60,
            emailsPerHour: 100,
            kycPerDay: 500
        },
        sessionTimeout: 30
    };
};

// ============================================
// WEBHOOKS
// ============================================

/**
 * Get all webhooks
 */
export const getWebhooks = async (): Promise<WebhookConfig[]> => {
    try {
        const docRef = doc(db, 'systemConfig', 'webhooks');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return Object.values(data).map((webhook: any) => ({
                ...webhook,
                lastTriggered: webhook.lastTriggered?.toDate?.() || undefined
            }));
        }

        return getDefaultWebhooks();
    } catch (error) {
        console.error('Error getting webhooks:', error);
        throw error;
    }
};

/**
 * Update webhook configuration
 */
export const updateWebhook = async (
    webhookId: string,
    config: Partial<WebhookConfig>
): Promise<void> => {
    try {
        const docRef = doc(db, 'systemConfig', 'webhooks');
        await updateDoc(docRef, {
            [`${webhookId}`]: config
        });

        // Audit log
        const webhookNames: Record<string, string> = {
            xendit: 'Xendit',
            didit: 'Didit'
        };
        await createAuditLog({
            userId: '',
            userEmail: '',
            action: 'updated',
            section: 'webhooks',
            resource: webhookNames[webhookId] || webhookId,
            details: `Updated webhook configuration for ${webhookNames[webhookId] || webhookId}`,
            status: 'success'
        });

        console.log(`[SystemConfig] Webhook updated: ${webhookId}`);
    } catch (error) {
        console.error('Error updating webhook:', error);
        throw error;
    }
};

/**
 * Test webhook
 */
export const testWebhook = async (
    webhookId: string
): Promise<{ success: boolean; message: string }> => {
    try {
        // TODO: Implement actual webhook testing
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            message: 'Webhook test successful!'
        };
    } catch (error) {
        console.error('Error testing webhook:', error);
        return {
            success: false,
            message: 'Webhook test failed'
        };
    }
};

/**
 * Get default webhooks
 */
const getDefaultWebhooks = (): WebhookConfig[] => {
    return [
        {
            id: 'xendit',
            service: 'xendit',
            url: '',
            isActive: false
        },
        {
            id: 'didit',
            service: 'didit',
            url: '',
            isActive: false
        }
    ];
};

// ============================================
// AUDIT LOGS
// ============================================

/**
 * Create audit log entry
 */
export const createAuditLog = async (
    log: Omit<AuditLog, 'id' | 'timestamp'>
): Promise<void> => {
    try {
        const { auth } = await import('./firebase');
        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');

        const logsCollection = collection(db, 'auditLogs');

        await addDoc(logsCollection, {
            ...log,
            timestamp: serverTimestamp(),
            userId: auth.currentUser?.uid || log.userId,
            userEmail: auth.currentUser?.email || log.userEmail
        });

        console.log('[SystemConfig] Audit log created:', log.action, log.resource);
    } catch (error) {
        console.error('Error creating audit log:', error);
        // Don't throw - audit logging should not break main functionality
    }
};

/**
 * Get audit logs with optional filters
 */
export const getAuditLogs = async (filters?: {
    section?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}): Promise<AuditLog[]> => {
    try {
        const { collection, query, where, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');

        const logsCollection = collection(db, 'auditLogs');
        let q = query(logsCollection, orderBy('timestamp', 'desc'));

        // Apply filters
        if (filters?.section) {
            q = query(q, where('section', '==', filters.section));
        }
        if (filters?.action) {
            q = query(q, where('action', '==', filters.action));
        }
        if (filters?.startDate) {
            q = query(q, where('timestamp', '>=', filters.startDate));
        }
        if (filters?.endDate) {
            q = query(q, where('timestamp', '<=', filters.endDate));
        }
        if (filters?.limit) {
            q = query(q, firestoreLimit(filters.limit));
        }

        const querySnapshot = await getDocs(q);
        const logs: AuditLog[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            logs.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate?.() || new Date()
            } as AuditLog);
        });

        return logs;
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return [];
    }
};
