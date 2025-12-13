import React from 'react';
import { Globe, Wifi, Shield, Clock, Building2, Hash } from 'lucide-react';

interface NetworkAnalysisCardProps {
    data: {
        isp?: string | null;
        organization?: string | null;
        asn?: string | null;
        connectionType?: string | null;
        isVpnOrTor?: boolean;
        timezone?: string | null;
        city?: string | null;
        region?: string | null;
        country?: string | null;
    };
}

const NetworkAnalysisCard: React.FC<NetworkAnalysisCardProps> = ({ data }) => {
    const isRisky = data.isVpnOrTor;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <Wifi size={20} className="text-cyan-600 dark:text-cyan-400" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white">Network Analysis</h3>
                {isRisky && (
                    <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Shield size={12} />
                        VPN/Proxy Detected
                    </span>
                )}
            </div>

            {/* Network Details Grid */}
            <div className="space-y-3">
                {/* ISP */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Building2 size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Internet Service Provider</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                            {data.isp || 'Not Available'}
                        </p>
                    </div>
                </div>

                {/* Organization */}
                {data.organization && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Building2 size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Organization</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                {data.organization}
                            </p>
                        </div>
                    </div>
                )}

                {/* ASN & Connection Type */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Hash size={14} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-1">ASN</p>
                            <p className="text-xs font-bold text-gray-800 dark:text-white truncate">
                                {data.asn || 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Wifi size={14} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-1">Connection</p>
                            <p className="text-xs font-bold text-gray-800 dark:text-white truncate">
                                {data.connectionType || 'Unknown'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Timezone */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Clock size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Timezone</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                            {data.timezone || 'Not Available'}
                        </p>
                    </div>
                </div>

                {/* Location Summary */}
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Globe size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Geographic Location</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {[data.city, data.region, data.country].filter(Boolean).join(', ') || 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* VPN/Tor Warning */}
                {isRisky && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Shield size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-700 dark:text-red-400">Security Alert</p>
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                    VPN or Tor network detected. User may be masking their true location.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NetworkAnalysisCard;
