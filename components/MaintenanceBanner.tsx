// Maintenance Mode Banner Component
// Shows global notification when maintenance mode is active

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { getSystemSettings } from '../services/systemConfigService';

export const MaintenanceBanner: React.FC = () => {
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        checkMaintenanceMode();

        // Check every 30 seconds
        const interval = setInterval(checkMaintenanceMode, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkMaintenanceMode = async () => {
        try {
            const settings = await getSystemSettings();
            setIsMaintenanceMode(settings.maintenanceMode);

            // Reset dismissed state if maintenance mode changes
            if (!settings.maintenanceMode) {
                setIsDismissed(false);
            }
        } catch (error) {
            console.error('Error checking maintenance mode:', error);
        }
    };

    if (!isMaintenanceMode || isDismissed) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <AlertTriangle size={24} className="flex-shrink-0 animate-pulse" />
                        <div className="flex-1">
                            <p className="font-bold text-sm md:text-base">
                                🔧 System Maintenance Mode Active
                            </p>
                            <p className="text-xs md:text-sm opacity-90 mt-0.5">
                                We're performing system maintenance. Some features may be temporarily unavailable.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsDismissed(true)}
                        className="p-1.5 hover:bg-red-800 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
