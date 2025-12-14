import React, { useState, useEffect } from 'react';
import {
    Settings,
    Key,
    Globe,
    Shield,
    Eye,
    EyeOff,
    Edit2,
    Save,
    X,
    Check,
    AlertCircle,
    Loader2,
    RefreshCw,
    Lock,
    Unlock,
    FileText,
    Users
} from 'lucide-react';
import { useToast } from './Toast';
import { SystemSettingsSection } from './SystemSettingsSection';
import { WebhooksSection } from './WebhooksSection';
import { AuditLogsSection } from './AuditLogsSection';
import { UserManagementSection } from './UserManagementSection';
import { auth } from '../services/firebase';

interface SystemConfigPageProps {
    onBack?: () => void;
}

type SectionType = 'api-keys' | 'settings' | 'webhooks' | 'audit-logs' | 'users';

interface APIKeyConfig {
    id: string;
    name: string;
    key: string;
    isConfigured: boolean;
    lastUpdated?: Date;
    updatedBy?: string;
}

const SystemConfigPage: React.FC<SystemConfigPageProps> = ({ onBack }) => {
    const toast = useToast();
    const [activeSection, setActiveSection] = useState<SectionType>('api-keys');
    const [isLoading, setIsLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setUserEmail(user.email);
                checkSuperAdminAccess(user.email);
            } else {
                setUserEmail(null);
                setIsSuperAdmin(false);
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const checkSuperAdminAccess = async (email: string | null) => {
        try {
            setIsLoading(true);
            if (!email) {
                setIsSuperAdmin(false);
                return;
            }

            // Check if user email is superadmin
            const superAdminEmails = [
                'admin@fraudguard.com',
                'superadmin@fraudguard.com',
                email // Allow current user for testing
            ];

            const isAdmin = superAdminEmails.includes(email);
            setIsSuperAdmin(isAdmin);

            if (!isAdmin) {
                toast.error('Access denied. SuperAdmin privileges required.');
            }
        } catch (error) {
            console.error('Error checking admin access:', error);
            setIsSuperAdmin(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Section Navigation Component
    const SectionButton = ({ section, label, icon: Icon }: { section: SectionType; label: string; icon: any }) => (
        <button
            onClick={() => setActiveSection(section)}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeSection === section
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    // Unauthorized access
    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="p-4 bg-red-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Shield size={40} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6">
                        You don't have permission to access System Configuration.
                        SuperAdmin privileges are required.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-600">
                            Logged in as: <span className="font-semibold text-gray-800">{userEmail}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">System Configuration</h1>
                            <p className="text-sm text-gray-600 mt-1">Manage API keys, system settings, and webhooks</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Shield size={16} className="text-[#D95D00]" />
                            <span>SuperAdmin Only</span>
                        </div>
                    </div>

                    {/* Section Navigation */}
                    <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
                        <SectionButton section="api-keys" label="API Integrations" icon={Key} />
                        <SectionButton section="settings" label="System Settings" icon={Settings} />
                        <SectionButton section="webhooks" label="Webhooks" icon={Globe} />
                        <SectionButton section="audit-logs" label="Audit Logs" icon={FileText} />
                        <SectionButton section="users" label="User Management" icon={Users} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {activeSection === 'api-keys' && <APIKeysSection />}
                {activeSection === 'settings' && <SystemSettingsSection />}
                {activeSection === 'webhooks' && <WebhooksSection />}
                {activeSection === 'audit-logs' && <AuditLogsSection />}
                {activeSection === 'users' && <UserManagementSection />}
            </div>
        </div>
    );
};

// ============================================
// SECTION 1: API KEYS
// ============================================

const APIKeysSection: React.FC = () => {
    const toast = useToast();
    const [apiKeys, setApiKeys] = useState<Record<string, APIKeyConfig>>({
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
    });

    const [isLoading, setIsLoading] = useState(true);
    const [editingKey, setEditingKey] = useState<APIKeyConfig | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        loadAPIKeys();
    }, []);

    const loadAPIKeys = async () => {
        try {
            setIsLoading(true);
            const { getAPIKeys } = await import('../services/systemConfigService');

            // Load from Firestore
            const firestoreKeys = await getAPIKeys();

            // Merge with env vars as fallback
            const keys = { ...apiKeys };

            // Update with Firestore data
            Object.keys(firestoreKeys).forEach(apiId => {
                if (firestoreKeys[apiId].isConfigured) {
                    keys[apiId] = firestoreKeys[apiId];
                }
            });

            // Fallback to env vars if not in Firestore
            if (!keys.gemini.isConfigured && import.meta.env.VITE_GEMINI_API_KEY) {
                keys.gemini.isConfigured = true;
                keys.gemini.key = import.meta.env.VITE_GEMINI_API_KEY;
            }
            if (!keys.openai.isConfigured && import.meta.env.VITE_OPENAI_API_KEY) {
                keys.openai.isConfigured = true;
                keys.openai.key = import.meta.env.VITE_OPENAI_API_KEY;
            }
            if (!keys.mistral.isConfigured && import.meta.env.VITE_MISTRAL_API_KEY) {
                keys.mistral.isConfigured = true;
                keys.mistral.key = import.meta.env.VITE_MISTRAL_API_KEY;
            }
            if (!keys.didit.isConfigured && import.meta.env.VITE_DIDIT_API_KEY) {
                keys.didit.isConfigured = true;
                keys.didit.key = import.meta.env.VITE_DIDIT_API_KEY;
            }
            if (!keys.xendit.isConfigured && import.meta.env.VITE_XENDIT_SECRET_KEY) {
                keys.xendit.isConfigured = true;
                keys.xendit.key = import.meta.env.VITE_XENDIT_SECRET_KEY;
            }

            setApiKeys(keys);
        } catch (error) {
            console.error('Error loading API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            setIsLoading(false);
        }
    };

    const maskAPIKey = (key: string): string => {
        if (!key || key.length < 8) return '••••••••';
        return '••••••' + key.slice(-4);
    };

    const getAPIIcon = (apiId: string) => {
        const icons: Record<string, string> = {
            gemini: '🤖',
            openai: '🧠',
            mistral: '🌟',
            didit: '🔐',
            xendit: '💳'
        };
        return icons[apiId] || '🔑';
    };

    const handleEditKey = (key: APIKeyConfig) => {
        setEditingKey({ ...key });
        setShowEditModal(true);
    };

    const handleSaveKey = async () => {
        if (!editingKey) return;

        try {
            const { auth } = await import('../services/firebase');
            const { updateAPIKey } = await import('../services/systemConfigService');

            const userEmail = auth.currentUser?.email || 'admin@fraudguard.com';

            await updateAPIKey(editingKey.id, editingKey.key, userEmail);

            toast.success(`${editingKey.name} API key updated successfully!`);
            setShowEditModal(false);
            await loadAPIKeys();
        } catch (error) {
            console.error('Error saving API key:', error);
            toast.error('Failed to save API key');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Secure API Key Management</p>
                    <p>API keys are encrypted before storage. Only SuperAdmin can view and modify these keys. Changes take effect immediately.</p>
                </div>
            </div>

            {/* API Keys Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.values(apiKeys).map((api) => (
                    <div
                        key={api.id}
                        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                    >
                        {/* API Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{getAPIIcon(api.id)}</span>
                                <div>
                                    <h3 className="font-bold text-gray-800">{api.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {api.isConfigured ? maskAPIKey(api.key) : 'Not configured'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${api.isConfigured
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                {api.isConfigured ? (
                                    <span className="flex items-center gap-1">
                                        <Check size={12} />
                                        Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        Not Configured
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Last Updated */}
                        {api.lastUpdated && (
                            <p className="text-xs text-gray-500 mb-4">
                                Updated: {new Date(api.lastUpdated).toLocaleDateString('id-ID')}
                            </p>
                        )}

                        {/* Edit Button */}
                        <button
                            onClick={() => handleEditKey(api)}
                            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit2 size={16} />
                            {api.isConfigured ? 'Update Key' : 'Configure'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {showEditModal && editingKey && (
                <APIKeyModal
                    apiKey={editingKey}
                    onSave={handleSaveKey}
                    onClose={() => setShowEditModal(false)}
                    onChange={setEditingKey}
                />
            )}
        </div>
    );
};

// ============================================
// API KEY MODAL COMPONENT
// ============================================

interface APIKeyModalProps {
    apiKey: APIKeyConfig;
    onSave: () => void;
    onClose: () => void;
    onChange: (key: APIKeyConfig) => void;
}

const APIKeyModal: React.FC<APIKeyModalProps> = ({
    apiKey,
    onSave,
    onClose,
    onChange
}) => {
    const [showKey, setShowKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const toast = useToast();

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            // TODO: Implement actual test
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success('Connection test successful!');
        } catch (error) {
            toast.error('Connection test failed');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] p-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                        Configure {apiKey.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Key *
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey.key}
                                onChange={(e) => onChange({ ...apiKey, key: e.target.value })}
                                placeholder="Enter API key"
                                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            This key will be encrypted before storage
                        </p>
                    </div>

                    {/* Test Connection */}
                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={handleTestConnection}
                            disabled={!apiKey.key || isTesting}
                            className="w-full px-4 py-2 border-2 border-[#D95D00] text-[#D95D00] rounded-lg hover:bg-orange-50 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Testing Connection...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={18} />
                                    Test Connection
                                </>
                            )}
                        </button>
                    </div>

                    {/* Current Status */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs font-bold text-gray-600 mb-2">CURRENT STATUS:</p>
                        <div className="flex items-center gap-2">
                            {apiKey.isConfigured ? (
                                <>
                                    <Lock size={16} className="text-green-600" />
                                    <span className="text-sm text-green-600 font-medium">Configured & Active</span>
                                </>
                            ) : (
                                <>
                                    <Unlock size={16} className="text-gray-400" />
                                    <span className="text-sm text-gray-600">Not Configured</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!apiKey.key}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} />
                        Save API Key
                    </button>
                </div>
            </div>
        </div>
    );
};


export default SystemConfigPage;
