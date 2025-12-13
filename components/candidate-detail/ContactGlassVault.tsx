import React, { useState } from 'react';
import { Lock, Sparkles, AlertTriangle, CreditCard, X, Crown, Check, Coins, ArrowRight } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../types';

interface ContactGlassVaultProps {
    onUnlock: () => void;
    isUnlocking: boolean;
    creditCost: number;
    currentCredits?: number;
    companyTier?: 'Freemium' | 'Premium';
    onNavigateToCredits?: () => void;
}

const ContactGlassVault: React.FC<ContactGlassVaultProps> = ({
    onUnlock,
    isUnlocking,
    creditCost,
    currentCredits = 0,
    companyTier = 'Freemium',
    onNavigateToCredits
}) => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const hasEnoughCredits = currentCredits >= creditCost;

    const handleUnlockClick = () => {
        if (hasEnoughCredits) {
            setShowConfirmModal(true);
        } else {
            // Not enough credits - show upgrade/top-up modal
            setShowUpgradeModal(true);
        }
    };

    const handleConfirmUnlock = () => {
        setShowConfirmModal(false);
        onUnlock();
    };

    const handleNavigateToCredits = () => {
        setShowUpgradeModal(false);
        if (onNavigateToCredits) {
            onNavigateToCredits();
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
            {/* Lock Card - Compact version that fits parent container */}
            <div className="relative bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100 p-6 text-center">
                {/* Lock Icon */}
                <div className="mb-3 inline-flex p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full border-2 border-orange-200">
                    <Lock size={28} className="text-orange-600" />
                </div>

                <h4 className="text-base font-bold text-gray-800 mb-1">Kontak Terkunci</h4>
                <p className="text-xs text-gray-600 mb-2">
                    Email & WhatsApp kandidat disembunyikan untuk paket Freemium.
                </p>

                {/* Credit Balance Info */}
                <div className="mb-4 flex items-center justify-center gap-2 text-xs">
                    <Coins size={12} className="text-gray-500" />
                    <span className={`font-semibold ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`}>
                        Saldo: {currentCredits} Credits
                    </span>
                    {!hasEnoughCredits && (
                        <span className="text-red-600">(Butuh: {creditCost})</span>
                    )}
                </div>

                <button
                    onClick={handleUnlockClick}
                    disabled={isUnlocking}
                    className={`w-full px-6 py-2.5 rounded-lg font-semibold shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 ${hasEnoughCredits
                            ? 'bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white hover:shadow-lg hover:shadow-orange-500/30'
                            : 'bg-gradient-to-r from-slate-800 to-slate-700 text-white hover:shadow-lg'
                        }`}
                >
                    {isUnlocking ? (
                        <>
                            <span className="animate-spin">⏳</span> Membuka...
                        </>
                    ) : hasEnoughCredits ? (
                        <>
                            <Sparkles size={14} className="text-yellow-200" />
                            Buka Kontak ({creditCost} Kredit)
                        </>
                    ) : (
                        <>
                            <Crown size={14} className="text-yellow-400" />
                            Top Up / Upgrade Premium
                        </>
                    )}
                </button>
            </div>

            {/* Confirmation Modal - When have enough credits */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] p-5 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-white">
                                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                        <CreditCard size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Konfirmasi Unlock</h3>
                                        <p className="text-sm opacity-90">Buka informasi kontak</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="text-white/80 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg mb-5">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-1">Biaya Kredit</p>
                                        <p className="text-sm text-gray-700">
                                            Tindakan ini akan mengurangi <strong>{creditCost} kredit</strong> dari saldo Anda.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Biaya Unlock:</span>
                                    <span className="font-bold text-[#D95D00] text-lg">{creditCost} Kredit</span>
                                </div>
                                <div className="flex items-center justify-between mt-2 text-sm">
                                    <span className="text-gray-500">Saldo Setelah:</span>
                                    <span className="font-semibold text-gray-700">{currentCredits - creditCost} Kredit</span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 mb-5 text-center">
                                Setelah unlock, Anda akan dapat melihat email dan WhatsApp kandidat.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleConfirmUnlock}
                                    disabled={isUnlocking}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isUnlocking ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            Membuka...
                                        </>
                                    ) : (
                                        <>
                                            <Lock size={16} />
                                            Ya, Unlock
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade/Top-Up Modal - When credits insufficient */}
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

                            <div className="bg-red-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-red-400/30 shadow-xl">
                                <AlertTriangle size={32} className="text-red-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Kredit Tidak Cukup</h3>
                            <p className="text-slate-300 text-sm">
                                Anda membutuhkan <span className="font-bold text-orange-400">{creditCost} kredit</span> untuk unlock kontak ini.
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {/* Current Balance */}
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Coins size={18} className="text-red-500" />
                                        <span className="text-sm font-medium text-gray-700">Saldo Saat Ini</span>
                                    </div>
                                    <span className="text-lg font-bold text-red-600">{currentCredits} Kredit</span>
                                </div>
                                <div className="mt-2 text-xs text-red-600">
                                    Kekurangan: {creditCost - currentCredits} kredit
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

export default ContactGlassVault;


