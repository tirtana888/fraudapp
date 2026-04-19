// System Settings Section Component
// Extracted for better organization

import React, { useState, useEffect } from 'react';
import {
    Settings,
    AlertCircle,
    Loader2,
    Save,
    RefreshCw,
    Shield,
    Lock
} from 'lucide-react';
import { useToast } from './Toast';
import { getSystemSettings, updateSystemSettings, toggleMaintenanceMode } from '../services/systemConfigService';

interface SystemSettings {
    maintenanceMode: boolean;
    debugMode: boolean;
    rateLimits: {
        aiCallsPerMinute: number;
        emailsPerHour: number;
        kycPerDay: number;
    };
    sessionTimeout: number;
}

export const SystemSettingsSection: React.FC = () => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<SystemSettings>({
        maintenanceMode: false,
        debugMode: false,
        rateLimits: {
            aiCallsPerMinute: 60,
            emailsPerHour: 100,
            kycPerDay: 500
        },
        sessionTimeout: 30
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const data = await getSystemSettings();
            setSettings(data);
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (setting: 'maintenanceMode' | 'debugMode') => {
        try {
            const newValue = !settings[setting];
            setSettings({ ...settings, [setting]: newValue });

            if (setting === 'maintenanceMode') {
                await toggleMaintenanceMode(newValue);
            } else {
                await updateSystemSettings({ debugMode: newValue });
            }

            toast.success(`${setting === 'maintenanceMode' ? 'Maintenance' : 'Debug'} mode ${newValue ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling setting:', error);
            toast.error('Failed to update setting');
            // Revert on error
            setSettings({ ...settings, [setting]: !settings[setting] });
        }
    };

    const handleSaveRateLimits = async () => {
        try {
            setIsSaving(true);
            await updateSystemSettings({ rateLimits: settings.rateLimits });
            toast.success('Rate limits updated successfully!');
        } catch (error) {
            console.error('Error saving rate limits:', error);
            toast.error('Failed to save rate limits');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!confirm('Reset all settings to defaults?')) return;

        const defaults: SystemSettings = {
            maintenanceMode: false,
            debugMode: false,
            rateLimits: {
                aiCallsPerMinute: 60,
                emailsPerHour: 100,
                kycPerDay: 500
            },
            sessionTimeout: 30
        };

        try {
            await updateSystemSettings(defaults);
            setSettings(defaults);
            toast.success('Settings reset to defaults');
        } catch (error) {
            console.error('Error resetting settings:', error);
            toast.error('Failed to reset settings');
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">System-Wide Settings</p>
                    <p>Changes to these settings affect all users immediately. Use with caution.</p>
                </div>
            </div>

            {/* Maintenance Mode Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertCircle size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Maintenance Mode</h3>
                                <p className="text-sm text-gray-600">Disable access for all users except SuperAdmin</p>
                            </div>
                        </div>
                        {settings.maintenanceMode && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800 font-medium">
                                    ⚠️ Maintenance mode is currently ACTIVE. Users cannot access the system.
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle('maintenanceMode')}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* Debug Mode Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Settings size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Debug Mode</h3>
                                <p className="text-sm text-gray-600">Enable detailed logging and error messages</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggle('debugMode')}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.debugMode ? 'bg-[#D95D00]' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.debugMode ? 'translate-x-7' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* Rate Limits Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <Shield size={24} className="text-[#D95D00]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Rate Limits</h3>
                        <p className="text-sm text-gray-600">Configure API and service usage limits</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            AI Calls per Minute
                        </label>
                        <input
                            type="number"
                            value={settings.rateLimits.aiCallsPerMinute}
                            onChange={(e) => setSettings({
                                ...settings,
                                rateLimits: { ...settings.rateLimits, aiCallsPerMinute: parseInt(e.target.value) }
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Emails per Hour
                        </label>
                        <input
                            type="number"
                            value={settings.rateLimits.emailsPerHour}
                            onChange={(e) => setSettings({
                                ...settings,
                                rateLimits: { ...settings.rateLimits, emailsPerHour: parseInt(e.target.value) }
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            KYC Checks per Day
                        </label>
                        <input
                            type="number"
                            value={settings.rateLimits.kycPerDay}
                            onChange={(e) => setSettings({
                                ...settings,
                                rateLimits: { ...settings.rateLimits, kycPerDay: parseInt(e.target.value) }
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSaveRateLimits}
                    disabled={isSaving}
                    className="px-6 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Rate Limits
                        </>
                    )}
                </button>
            </div>

            {/* Session Timeout Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Lock size={24} className="text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Session Timeout</h3>
                        <p className="text-sm text-gray-600">Auto-logout users after inactivity</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">minutes</span>
                </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleResetDefaults}
                    className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium flex items-center gap-2"
                >
                    <RefreshCw size={18} />
                    Reset to Defaults
                </button>
            </div>
        </div>
    );
};
