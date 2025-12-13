import React, { useState } from 'react';
import { Lock, Sparkles, AlertTriangle, CreditCard, X } from 'lucide-react';

interface ContactGlassVaultProps {
    onUnlock: () => void;
    isUnlocking: boolean;
    creditCost: number;
}

const ContactGlassVault: React.FC<ContactGlassVaultProps> = ({ onUnlock, isUnlocking, creditCost }) => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const handleUnlockClick = () => {
        setShowConfirmModal(true);
    };

    const handleConfirmUnlock = () => {
        setShowConfirmModal(false);
        onUnlock();
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
                <p className="text-xs text-gray-600 mb-4">
                    Email & WhatsApp kandidat disembunyikan untuk paket Freemium.
                </p>

                <button
                    onClick={handleUnlockClick}
                    disabled={isUnlocking}
                    className="w-full px-6 py-2.5 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg font-semibold shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                    {isUnlocking ? (
                        <>
                            <span className="animate-spin">⏳</span> Membuka...
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} className="text-yellow-200" />
                            Buka Kontak ({creditCost} Kredit)
                        </>
                    )}
                </button>
            </div>

            {/* Confirmation Modal */}
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
        </>
    );
};

export default ContactGlassVault;

