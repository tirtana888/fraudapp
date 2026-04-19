import React, { useState } from 'react';
import { Smartphone, Monitor, Tablet, Chrome, Code, ChevronDown, ChevronUp } from 'lucide-react';

interface DeviceData {
    browser?: string | null;
    browserVersion?: string | null;
    os?: string | null;
    osVersion?: string | null;
    deviceType?: string | null;
    userAgent?: string | null;
}

interface DeviceFingerprintCardProps {
    devices: DeviceData[];
}

const DeviceFingerprintCard: React.FC<DeviceFingerprintCardProps> = ({ devices }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [showUserAgent, setShowUserAgent] = useState(false);

    const currentDevice = devices[activeTab] || {};

    const getDeviceIcon = (type?: string | null) => {
        const deviceType = type?.toLowerCase() || '';
        if (deviceType.includes('mobile') || deviceType.includes('phone')) {
            return <Smartphone size={20} className="text-purple-600 dark:text-purple-400" />;
        }
        if (deviceType.includes('tablet')) {
            return <Tablet size={20} className="text-purple-600 dark:text-purple-400" />;
        }
        return <Monitor size={20} className="text-purple-600 dark:text-purple-400" />;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    {getDeviceIcon(currentDevice.deviceType)}
                </div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Device Fingerprint</h3>
                {devices.length > 1 && (
                    <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">
                        {devices.length} Devices
                    </span>
                )}
            </div>

            {/* Device Tabs (if multiple) */}
            {devices.length > 1 && (
                <div className="flex gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    {devices.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === index
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-600'
                                }`}
                        >
                            Device {index + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Device Details */}
            <div className="p-6 space-y-3">
                {/* Browser */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Chrome size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Browser</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {currentDevice.browser || 'Unknown'} {currentDevice.browserVersion && `v${currentDevice.browserVersion}`}
                        </p>
                    </div>
                </div>

                {/* Operating System */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Monitor size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Operating System</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {currentDevice.os || 'Unknown'} {currentDevice.osVersion && `v${currentDevice.osVersion}`}
                        </p>
                    </div>
                </div>

                {/* Device Type */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {getDeviceIcon(currentDevice.deviceType)}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Device Type</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white capitalize">
                            {currentDevice.deviceType || 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* User Agent (Collapsible) */}
                {currentDevice.userAgent && (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setShowUserAgent(!showUserAgent)}
                            className="w-full flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Code size={14} className="text-gray-500 dark:text-gray-400" />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">User Agent String</span>
                            </div>
                            {showUserAgent ? (
                                <ChevronUp size={14} className="text-gray-500" />
                            ) : (
                                <ChevronDown size={14} className="text-gray-500" />
                            )}
                        </button>
                        {showUserAgent && (
                            <div className="p-3 bg-gray-900 dark:bg-gray-950">
                                <code className="text-[10px] text-green-400 font-mono break-all">
                                    {currentDevice.userAgent}
                                </code>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeviceFingerprintCard;
