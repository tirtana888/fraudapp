import React, { useState } from 'react';
import { X, CreditCard, Crown, Building2, Check, Loader2, ExternalLink } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { useToast } from './Toast';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    companyName: string;
    companyEmail: string;
    currentTier: 'Freemium' | 'Premium' | 'Enterprise';
    currentCredits: number;
    onPaymentSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    companyId,
    companyName,
    companyEmail,
    currentTier,
    currentCredits,
    onPaymentSuccess
}) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'credits' | 'subscription'>('credits');
    const [selectedCredits, setSelectedCredits] = useState<1000 | 5000 | 10000>(1000);
    const [selectedTier, setSelectedTier] = useState<'Premium' | 'Enterprise'>('Premium');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const CREDIT_PACKAGES = [
        { amount: 1000, price: 100000, discount: 0, popular: false },
        { amount: 5000, price: 450000, discount: 10, popular: true },
        { amount: 10000, price: 800000, discount: 20, popular: false }
    ];

    const SUBSCRIPTION_TIERS = [
        {
            tier: 'Premium' as const,
            price: 500000,
            features: [
                'Unlimited candidate views',
                'Priority support',
                'Advanced analytics',
                'Custom branding'
            ]
        },
        {
            tier: 'Enterprise' as const,
            price: 2000000,
            features: [
                'Everything in Premium',
                'Dedicated account manager',
                'Custom integrations',
                'SLA guarantee',
                'White-label solution'
            ]
        }
    ];

    const handlePurchaseCredits = async () => {
        setIsProcessing(true);
        try {
            const createInvoice = httpsCallable(functions, 'createXenditInvoice');
            const result = await createInvoice({
                type: 'credit_purchase',
                amount: selectedCredits,
                companyId,
                companyName,
                companyEmail
            });

            const data = result.data as { success: boolean; invoiceUrl: string; invoiceId: string };

            if (data.success && data.invoiceUrl) {
                // Open Xendit payment page in new tab
                window.open(data.invoiceUrl, '_blank');
                toast.success('Payment page opened! Complete payment to receive credits.');
                onClose();
            }
        } catch (error: any) {
            console.error('[PAYMENT] Error:', error);
            toast.error(`Payment failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpgradeTier = async () => {
        setIsProcessing(true);
        try {
            const createInvoice = httpsCallable(functions, 'createXenditInvoice');
            const result = await createInvoice({
                type: 'subscription_upgrade',
                tier: selectedTier,
                companyId,
                companyName,
                companyEmail
            });

            const data = result.data as { success: boolean; invoiceUrl: string; invoiceId: string };

            if (data.success && data.invoiceUrl) {
                window.open(data.invoiceUrl, '_blank');
                toast.success('Payment page opened! Complete payment to upgrade your tier.');
                onClose();
            }
        } catch (error: any) {
            console.error('[PAYMENT] Error:', error);
            toast.error(`Payment failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-brand-slate-850 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-brand-orange to-red-600">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CreditCard size={24} />
                            Payment & Billing
                        </h3>
                        <p className="text-white/80 text-sm mt-1">Buy credits or upgrade your subscription</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                    <button
                        onClick={() => setActiveTab('credits')}
                        className={`flex-1 py-4 px-6 font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'credits'
                                ? 'text-brand-orange border-b-2 border-brand-orange bg-white dark:bg-brand-slate-850'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        <CreditCard size={20} />
                        Buy Credits
                    </button>
                    <button
                        onClick={() => setActiveTab('subscription')}
                        className={`flex-1 py-4 px-6 font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'subscription'
                                ? 'text-brand-orange border-b-2 border-brand-orange bg-white dark:bg-brand-slate-850'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        <Crown size={20} />
                        Upgrade Tier
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'credits' ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Current Balance:</strong> {currentCredits.toLocaleString('id-ID')} credits
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {CREDIT_PACKAGES.map((pkg) => (
                                    <div
                                        key={pkg.amount}
                                        onClick={() => setSelectedCredits(pkg.amount as 1000 | 5000 | 10000)}
                                        className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg ${selectedCredits === pkg.amount
                                                ? 'border-brand-orange bg-orange-50 dark:bg-orange-900/20'
                                                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                                            }`}
                                    >
                                        {pkg.popular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className="bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                                                    POPULAR
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-center">
                                            <h4 className="text-2xl font-bold text-gray-800 dark:text-white">
                                                {pkg.amount.toLocaleString('id-ID')}
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Credits</p>
                                            <div className="text-3xl font-extrabold text-brand-orange mb-2">
                                                Rp {(pkg.price / 1000).toFixed(0)}K
                                            </div>
                                            {pkg.discount > 0 && (
                                                <div className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold px-2 py-1 rounded">
                                                    Save {pkg.discount}%
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-400 mt-2">
                                                Rp {(pkg.price / pkg.amount).toFixed(0)}/credit
                                            </p>
                                        </div>
                                        {selectedCredits === pkg.amount && (
                                            <div className="absolute top-4 right-4">
                                                <div className="bg-brand-orange text-white rounded-full p-1">
                                                    <Check size={16} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handlePurchaseCredits}
                                disabled={isProcessing}
                                className="w-full bg-brand-orange hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <ExternalLink size={20} />
                                        Buy {selectedCredits.toLocaleString('id-ID')} Credits - Rp {(CREDIT_PACKAGES.find(p => p.amount === selectedCredits)?.price || 0).toLocaleString('id-ID')}
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <strong>Current Tier:</strong> {currentTier}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {SUBSCRIPTION_TIERS.map((sub) => (
                                    <div
                                        key={sub.tier}
                                        onClick={() => setSelectedTier(sub.tier)}
                                        className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg ${selectedTier === sub.tier
                                                ? 'border-brand-orange bg-orange-50 dark:bg-orange-900/20'
                                                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            {sub.tier === 'Premium' ? (
                                                <Crown className="text-blue-600" size={32} />
                                            ) : (
                                                <Building2 className="text-purple-600" size={32} />
                                            )}
                                            <div>
                                                <h4 className="text-xl font-bold text-gray-800 dark:text-white">
                                                    {sub.tier}
                                                </h4>
                                                <p className="text-2xl font-extrabold text-brand-orange">
                                                    Rp {(sub.price / 1000).toFixed(0)}K<span className="text-sm text-gray-500">/month</span>
                                                </p>
                                            </div>
                                        </div>

                                        <ul className="space-y-2">
                                            {sub.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                    <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>

                                        {selectedTier === sub.tier && (
                                            <div className="absolute top-4 right-4">
                                                <div className="bg-brand-orange text-white rounded-full p-1">
                                                    <Check size={16} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleUpgradeTier}
                                disabled={isProcessing || currentTier === selectedTier}
                                className="w-full bg-brand-orange hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Processing...
                                    </>
                                ) : currentTier === selectedTier ? (
                                    <>Current Tier</>
                                ) : (
                                    <>
                                        <ExternalLink size={20} />
                                        Upgrade to {selectedTier} - Rp {(SUBSCRIPTION_TIERS.find(s => s.tier === selectedTier)?.price || 0).toLocaleString('id-ID')}/month
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        🔒 Secure payment powered by <strong>Xendit</strong>. Your payment information is encrypted and secure.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
