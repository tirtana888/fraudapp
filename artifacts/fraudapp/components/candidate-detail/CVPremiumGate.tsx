import React, { useState } from 'react';
import { Lock, Crown, FileText, Sparkles, X, AlertTriangle, Coins, CreditCard, ArrowRight, Check } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../types';

interface CVPremiumGateProps {
    onUpgrade: () => void;
    documentType?: 'cv' | 'certificate' | 'portfolio';
    currentCredits?: number;
    companyTier?: 'Freemium' | 'Premium';
    onNavigateToCredits?: () => void;
}

const CVPremiumGate: React.FC<CVPremiumGateProps> = ({
    onUpgrade,
    documentType = 'cv',
    currentCredits = 0,
    companyTier = 'Freemium',
    onNavigateToCredits
}) => {
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const getDocTitle = () => {
        switch (documentType) {
            case 'certificate': return 'Sertifikat';
            case 'portfolio': return 'Portfolio';
            default: return 'CV Lengkap';
        }
    };

    const handleUpgradeClick = () => {
        setShowUpgradeModal(true);
    };

    const handleNavigateToCredits = () => {
        setShowUpgradeModal(false);
        if (onNavigateToCredits) {
            onNavigateToCredits();
        } else {
            onUpgrade(); // Fallback to original behavior
        }
    };

    const formatIDR = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <>
            <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
                {/* Blurred Background Preview (Skeleton CV) */}
                <div className="absolute inset-0 p-6 filter blur-[6px] opacity-40 select-none pointer-events-none">
                    {/* Simulated CV Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gray-300"></div>
                        <div className="space-y-2">
                            <div className="h-5 w-48 bg-gray-300 rounded"></div>
                            <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </div>
                    </div>

                    {/* Simulated Sections */}
                    <div className="space-y-4">
                        <div className="h-4 w-24 bg-gray-400 rounded mb-2"></div>
                        <div className="h-3 w-full bg-gray-200 rounded"></div>
                        <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                        <div className="h-3 w-4/5 bg-gray-200 rounded"></div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="h-4 w-32 bg-gray-400 rounded mb-2"></div>
                        <div className="flex gap-4">
                            <div className="flex-1 h-20 bg-gray-200 rounded-lg"></div>
                            <div className="flex-1 h-20 bg-gray-200 rounded-lg"></div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="h-4 w-28 bg-gray-400 rounded mb-2"></div>
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-gray-200 rounded"></div>
                            <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>

                {/* Glass Overlay with Premium CTA */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md p-8">
                    {/* Icon Badge */}
                    <div className="relative mb-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-500/30 transform rotate-3">
                            <FileText size={36} className="text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border border-gray-100">
                            <Lock size={14} className="text-orange-600" />
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2 text-center">
                        {getDocTitle()} Terkunci
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 text-center mb-4 max-w-xs leading-relaxed">
                        Akses dokumen lengkap kandidat hanya tersedia untuk pengguna <span className="font-bold text-orange-600">Premium</span>.
                    </p>

                    {/* Credit Balance Info */}
                    <div className="mb-4 flex items-center gap-2 text-xs bg-white/80 px-3 py-2 rounded-lg border border-gray-200">
                        <Coins size={14} className="text-gray-500" />
                        <span className="font-semibold text-gray-700">
                            Saldo: {currentCredits} Credits
                        </span>
                    </div>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                            📄 Lihat CV Lengkap
                        </span>
                        <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                            📊 Download PDF
                        </span>
                        <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                            🔍 AI Analysis
                        </span>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleUpgradeClick}
                        className="group relative px-8 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl font-bold shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:scale-105 active:scale-100 transition-all duration-200 flex items-center gap-2"
                    >
                        <Crown size={18} className="group-hover:rotate-12 transition-transform" />
                        <span>Top Up / Upgrade Premium</span>
                        <Sparkles size={14} className="text-yellow-200 group-hover:animate-pulse" />
                    </button>

                    {/* Sub-text */}
                    <p className="text-xs text-gray-400 mt-4">
                        Mulai dari <span className="font-bold text-gray-600">Rp 99.000/bulan</span>
                    </p>
                </div>
            </div>

            {/* Upgrade/Top-Up Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="bg-orange-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-orange-400/30 shadow-xl">
                                <Lock size={32} className="text-orange-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Unlock CV Lengkap</h3>
                            <p className="text-slate-300 text-sm">
                                Akses dokumen kandidat dengan <span className="font-bold text-orange-400">Top Up</span> atau <span className="font-bold text-yellow-400">Upgrade Premium</span>
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {/* Current Balance */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Coins size={18} className="text-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">Saldo Saat Ini</span>
                                    </div>
                                    <span className="text-lg font-bold text-blue-600">{currentCredits} Kredit</span>
                                </div>
                            </div>

                            {/* Options */}
                            <p className="text-sm text-gray-600 mb-4 text-center font-medium">
                                Pilih salah satu opsi di bawah:
                            </p>

                            <div className="space-y-3">
                                {/* Top Up Option */}
                                <button
                                    onClick={handleNavigateToCredits}
                                    className="w-full p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-lg hover:shadow-orange-500/25 hover:-translate-y-1 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold">Top Up Kredit</p>
                                            <p className="text-xs opacity-90">Beli kredit sesuai kebutuhan</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>

                                {/* Upgrade Premium Option */}
                                {companyTier !== 'Premium' && (
                                    <button
                                        onClick={handleNavigateToCredits}
                                        className="w-full p-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl font-bold shadow-lg hover:shadow-slate-500/25 hover:-translate-y-1 transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                                                <Crown size={20} className="text-yellow-400" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold">Upgrade Premium</p>
                                                <p className="text-xs opacity-90">
                                                    {formatIDR(SUBSCRIPTION_PLANS.PREMIUM.price)}/bulan + {SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits} kredit
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>

                            {/* Premium Benefits */}
                            {companyTier !== 'Premium' && (
                                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                                        <Sparkles size={12} /> Keuntungan Premium:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {SUBSCRIPTION_PLANS.PREMIUM.features.slice(0, 4).map((feature, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-700">
                                                <Check size={10} className="text-green-600 flex-shrink-0" />
                                                <span className="truncate">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Cancel Button */}
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="w-full mt-4 py-3 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CVPremiumGate;

