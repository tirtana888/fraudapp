import React from 'react';
import { User, Fingerprint, Wifi, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface BiometricScoreCardProps {
    faceMatchScore?: number;
    faceMatchStatus?: string;
    livenessScore?: number;
    livenessStatus?: string;
    ipClean?: boolean;
    warningsCount?: number;
}

// Circular Progress Component
const CircularProgress: React.FC<{
    score: number;
    size?: number;
    strokeWidth?: number;
    label: string;
    status?: string;
}> = ({ score, size = 100, strokeWidth = 8, label, status }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (score: number) => {
        if (score >= 80) return { stroke: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' };
        if (score >= 60) return { stroke: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600' };
        return { stroke: '#ef4444', bg: 'bg-red-50', text: 'text-red-600' };
    };

    const colors = getColor(score);

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Circle */}
                <svg className="transform -rotate-90" width={size} height={size}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#e5e7eb"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={colors.stroke}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                    />
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${colors.text}`}>
                        {Math.round(score)}%
                    </span>
                </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
            {status && (
                <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.toLowerCase() === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {status}
                </span>
            )}
        </div>
    );
};

// Signal Card Component
const SignalCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    status: 'success' | 'warning' | 'danger';
}> = ({ icon, label, value, status }) => {
    const statusStyles = {
        success: 'border-green-200 bg-green-50 dark:bg-green-900/20',
        warning: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20',
        danger: 'border-red-200 bg-red-50 dark:bg-red-900/20'
    };

    const iconStyles = {
        success: 'text-green-600',
        warning: 'text-yellow-600',
        danger: 'text-red-600'
    };

    return (
        <div className={`p-4 rounded-xl border-2 ${statusStyles[status]} transition-all hover:scale-105`}>
            <div className="flex items-center gap-3">
                <div className={iconStyles[status]}>{icon}</div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{value}</p>
                </div>
                {status === 'success' && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
                {status === 'warning' && <AlertTriangle size={16} className="ml-auto text-yellow-500" />}
                {status === 'danger' && <XCircle size={16} className="ml-auto text-red-500" />}
            </div>
        </div>
    );
};

const BiometricScoreCard: React.FC<BiometricScoreCardProps> = ({
    faceMatchScore = 0,
    faceMatchStatus,
    livenessScore = 0,
    livenessStatus,
    ipClean = true,
    warningsCount = 0
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                <div className="flex items-center gap-2">
                    <Fingerprint size={20} className="text-white" />
                    <h3 className="text-lg font-bold text-white">Biometric Analysis</h3>
                </div>
                <p className="text-indigo-100 text-sm mt-1">AI-powered identity verification scores</p>
            </div>

            {/* Scores Grid */}
            <div className="p-6">
                <div className="flex justify-center gap-12 mb-6">
                    <CircularProgress
                        score={faceMatchScore}
                        label="Face Match"
                        status={faceMatchStatus}
                        size={120}
                    />
                    <CircularProgress
                        score={livenessScore}
                        label="Liveness"
                        status={livenessStatus}
                        size={120}
                    />
                </div>

                {/* Signal Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <SignalCard
                        icon={<Wifi size={20} />}
                        label="Network Status"
                        value={ipClean ? 'Clean Connection' : 'VPN/Proxy Detected'}
                        status={ipClean ? 'success' : 'danger'}
                    />
                    <SignalCard
                        icon={<AlertTriangle size={20} />}
                        label="Security Warnings"
                        value={warningsCount === 0 ? 'No Issues' : `${warningsCount} Warning${warningsCount > 1 ? 's' : ''}`}
                        status={warningsCount === 0 ? 'success' : warningsCount > 2 ? 'danger' : 'warning'}
                    />
                </div>
            </div>
        </div>
    );
};

export default BiometricScoreCard;
