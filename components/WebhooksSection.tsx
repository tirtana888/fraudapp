// Webhooks Section Component
// Clean and minimalist design for webhook management

import React, { useState, useEffect } from 'react';
import {
    Globe,
    Edit2,
    Save,
    X,
    Check,
    AlertCircle,
    Loader2,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import { useToast } from './Toast';
import { getWebhooks, updateWebhook, testWebhook, WebhookConfig } from '../services/systemConfigService';

export const WebhooksSection: React.FC = () => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        loadWebhooks();
    }, []);

    const loadWebhooks = async () => {
        try {
            setIsLoading(true);
            const data = await getWebhooks();
            setWebhooks(data);
        } catch (error) {
            console.error('Error loading webhooks:', error);
            toast.error('Failed to load webhooks');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (webhook: WebhookConfig) => {
        setEditingWebhook({ ...webhook });
        setShowEditModal(true);
    };

    const handleSave = async () => {
        if (!editingWebhook) return;

        try {
            await updateWebhook(editingWebhook.id, editingWebhook);
            toast.success('Webhook updated successfully!');
            setShowEditModal(false);
            await loadWebhooks();
        } catch (error) {
            console.error('Error saving webhook:', error);
            toast.error('Failed to save webhook');
        }
    };

    const handleToggleActive = async (webhook: WebhookConfig) => {
        try {
            const newStatus = !webhook.isActive;
            await updateWebhook(webhook.id, { ...webhook, isActive: newStatus });
            toast.success(`Webhook ${newStatus ? 'activated' : 'deactivated'}`);
            await loadWebhooks();
        } catch (error) {
            console.error('Error toggling webhook:', error);
            toast.error('Failed to update webhook');
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
                    <p className="font-semibold mb-1">Webhook Configuration</p>
                    <p>Configure webhook URLs for external service integrations. These URLs receive real-time notifications from payment and KYC providers.</p>
                </div>
            </div>

            {/* Webhooks Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Service
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Webhook URL
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Last Triggered
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {webhooks.map((webhook) => (
                                <tr key={webhook.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg">
                                                <Globe size={20} className="text-gray-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 capitalize">{webhook.service}</p>
                                                <p className="text-xs text-gray-500">
                                                    {webhook.service === 'xendit' ? 'Payment Gateway' : 'KYC Provider'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {webhook.url ? (
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                    {webhook.url.length > 50 ? webhook.url.substring(0, 50) + '...' : webhook.url}
                                                </code>
                                                {webhook.url && (
                                                    <a
                                                        href={webhook.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">Not configured</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleActive(webhook)}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${webhook.isActive
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {webhook.isActive ? (
                                                <span className="flex items-center gap-1">
                                                    <Check size={12} />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <X size={12} />
                                                    Inactive
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {webhook.lastTriggered ? (
                                            <span className="text-sm text-gray-600">
                                                {new Date(webhook.lastTriggered).toLocaleString('id-ID')}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400">Never</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEdit(webhook)}
                                            className="px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm flex items-center gap-2 ml-auto"
                                        >
                                            <Edit2 size={14} />
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {webhooks.length === 0 && (
                    <div className="text-center py-12">
                        <Globe size={48} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No webhooks configured</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {showEditModal && editingWebhook && (
                <WebhookModal
                    webhook={editingWebhook}
                    onSave={handleSave}
                    onClose={() => setShowEditModal(false)}
                    onChange={setEditingWebhook}
                />
            )}
        </div>
    );
};

// ============================================
// WEBHOOK MODAL COMPONENT
// ============================================

interface WebhookModalProps {
    webhook: WebhookConfig;
    onSave: () => void;
    onClose: () => void;
    onChange: (webhook: WebhookConfig) => void;
}

const WebhookModal: React.FC<WebhookModalProps> = ({
    webhook,
    onSave,
    onClose,
    onChange
}) => {
    const [isTesting, setIsTesting] = useState(false);
    const toast = useToast();

    const handleTest = async () => {
        if (!webhook.url) {
            toast.error('Please enter a webhook URL first');
            return;
        }

        setIsTesting(true);
        try {
            const result = await testWebhook(webhook.id);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Webhook test failed');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] p-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white capitalize">
                        Configure {webhook.service} Webhook
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
                            Webhook URL *
                        </label>
                        <input
                            type="url"
                            value={webhook.url}
                            onChange={(e) => onChange({ ...webhook, url: e.target.value })}
                            placeholder="https://your-domain.com/api/webhooks/..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This URL will receive POST requests from {webhook.service}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Webhook Secret (Optional)
                        </label>
                        <input
                            type="password"
                            value={webhook.secret || ''}
                            onChange={(e) => onChange({ ...webhook, secret: e.target.value })}
                            placeholder="Enter webhook secret for signature verification"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Used to verify webhook authenticity
                        </p>
                    </div>

                    {/* Test Webhook */}
                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={handleTest}
                            disabled={!webhook.url || isTesting}
                            className="w-full px-4 py-2 border-2 border-[#D95D00] text-[#D95D00] rounded-lg hover:bg-orange-50 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Testing Webhook...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={18} />
                                    Test Webhook
                                </>
                            )}
                        </button>
                    </div>

                    {/* Current Status */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs font-bold text-gray-600 mb-2">CURRENT STATUS:</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Active:</span>
                                <span className={`text-sm font-medium ${webhook.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                    {webhook.isActive ? 'Yes' : 'No'}
                                </span>
                            </div>
                            {webhook.lastTriggered && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Last Triggered:</span>
                                    <span className="text-sm text-gray-800">
                                        {new Date(webhook.lastTriggered).toLocaleString('id-ID')}
                                    </span>
                                </div>
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
                        disabled={!webhook.url}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} />
                        Save Webhook
                    </button>
                </div>
            </div>
        </div>
    );
};
