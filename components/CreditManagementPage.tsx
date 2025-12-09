import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  TrendingUp, 
  CreditCard, 
  Crown, 
  ArrowRight, 
  Check, 
  Loader2,
  History,
  AlertCircle,
  Sparkles,
  Shield
} from 'lucide-react';
import { UserProfile, CompanyProfile, CreditTransaction, SUBSCRIPTION_PLANS } from '../types';
import { getCreditBalance, getCreditTransactions, creditsToIDR } from '../services/creditManagement';
import { createTopUpInvoice, createPremiumSubscriptionInvoice, getTopUpPackages, formatIDR } from '../services/xenditIntegration';
import { getCompanyById } from '../services/firebase';

interface CreditManagementPageProps {
  company: CompanyProfile;
  user: UserProfile;
  onCompanyUpdate: () => void;
}

const CreditManagementPage: React.FC<CreditManagementPageProps> = ({ company: initialCompany, user, onCompanyUpdate }) => {
  const [creditBalance, setCreditBalance] = useState<number>(initialCompany.credits || 0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(initialCompany);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const topUpPackages = getTopUpPackages();

  useEffect(() => {
    // OPTIMIZATION: Show UI immediately with initial data
    console.log('[CREDIT] 🚀 Initializing Credit Management page...');
    
    // Set initial data immediately (no blocking)
    setCreditBalance(initialCompany.credits || 0);
    setCompany(initialCompany);
    setIsLoading(false); // ✅ Unblock UI immediately!
    
    // Load fresh data in background (non-blocking)
    loadCreditData();
  }, [initialCompany.id]);

  const loadCreditData = async () => {
    if (!initialCompany.id) return;

    console.log('[CREDIT] 📊 Loading credit data in background...');
    
    try {
      // Add timeout protection
      const dataPromise = Promise.all([
        getCreditBalance(initialCompany.id),
        getCreditTransactions(initialCompany.id, 50),
        getCompanyById(initialCompany.id)
      ]);
      
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => {
          console.log('[CREDIT] ⏰ Data fetch timeout, using initial data');
          resolve(null);
        }, 3000) // 3 second timeout
      );

      const result = await Promise.race([dataPromise, timeoutPromise]);

      if (result) {
        const [balance, txHistory, updatedCompany] = result;
        
        console.log('[CREDIT] ✅ Data loaded:', { balance, transactions: txHistory.length });
        setCreditBalance(balance);
        setTransactions(txHistory);
        
        if (updatedCompany) {
          setCompany(updatedCompany);
        }
      }
    } catch (error) {
      console.error('[CREDIT] ⚠️ Error loading data (non-critical):', error);
      // Keep using initial data - page still works
    }
  };

  const handleTopUp = async (credits: number) => {
    if (!initialCompany.id || !user.email) return;

    setIsProcessing(true);
    try {
      const result = await createTopUpInvoice(initialCompany.id, credits, user.email);

      if (result.success && result.invoiceUrl) {
        window.location.href = result.invoiceUrl;
      } else {
        alert(result.error || 'Gagal membuat invoice pembayaran');
      }
    } catch (error) {
      console.error('[CREDIT] Top-up error:', error);
      alert('Terjadi kesalahan saat membuat pembayaran');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgradeToPremium = async () => {
    if (!initialCompany.id || !user.email) return;

    setIsProcessing(true);
    try {
      const result = await createPremiumSubscriptionInvoice(initialCompany.id, user.email);

      if (result.success && result.invoiceUrl) {
        window.location.href = result.invoiceUrl;
      } else {
        alert(result.error || 'Gagal membuat invoice pembayaran');
      }
    } catch (error) {
      console.error('[CREDIT] Upgrade error:', error);
      alert('Terjadi kesalahan saat membuat pembayaran');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTransactionIcon = (action: string) => {
    switch (action) {
      case 'KYC_VERIFICATION':
        return <Shield size={16} className="text-blue-600" />;
      case 'TOP_UP':
      case 'SUBSCRIPTION':
      case 'INITIAL_CREDIT':
      case 'MONTHLY_REFILL':
        return <TrendingUp size={16} className="text-green-600" />;
      default:
        return <Coins size={16} className="text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-orange-600" />
      </div>
    );
  }

  const isPremium = company?.tier === 'Premium';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-brand-slate-850 border-b border-gray-200 dark:border-slate-700">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Coins size={24} className="text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Credit Management</h1>
              </div>
            </div>
            
            {isPremium && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg">
                <Crown size={18} />
                <span className="text-sm font-semibold">Premium Member</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Credit Balance Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 text-white mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-orange-100 text-sm mb-1">Saldo Kredit Anda</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-5xl font-bold">{creditBalance.toLocaleString('id-ID')}</h2>
                <span className="text-xl text-orange-100">Credits</span>
              </div>
              <p className="text-orange-100 text-sm mt-2">
                ≈ {formatIDR(creditsToIDR(creditBalance))}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              <Coins size={48} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="bg-white text-orange-600 font-semibold py-3 rounded-xl hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Top Up Kredit
            </button>

            {!isPremium && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-white/10 backdrop-blur-sm border-2 border-white text-white font-semibold py-3 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                <Crown size={18} />
                Upgrade Premium
              </button>
            )}
          </div>
        </div>

        {/* Current Plan */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Paket Saat Ini</h3>
            {isPremium && (
              <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full">
                Aktif
              </span>
            )}
          </div>

          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${isPremium ? 'bg-orange-100' : 'bg-gray-100'}`}>
              {isPremium ? <Crown size={24} className="text-orange-600" /> : <Sparkles size={24} className="text-gray-600" />}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                {isPremium ? 'Premium Plan' : 'Freemium Plan'}
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                {isPremium 
                  ? `${formatIDR(SUBSCRIPTION_PLANS.PREMIUM.price)}/bulan • ${SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits} kredit/bulan`
                  : 'Gratis • 1000 kredit awal'}
              </p>
              <ul className="space-y-2">
                {(isPremium ? SUBSCRIPTION_PLANS.PREMIUM.features : SUBSCRIPTION_PLANS.FREEMIUM.features).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <History size={20} className="text-gray-700" />
            <h3 className="text-lg font-bold text-gray-900">Riwayat Transaksi</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada transaksi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      {getTransactionIcon(tx.action)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(tx.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-gray-500">Saldo: {tx.balanceAfter.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top-Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Top Up Kredit</h3>
              <p className="text-sm text-gray-600 mt-1">Pilih paket kredit yang sesuai dengan kebutuhan Anda</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topUpPackages.map((pkg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPackage(pkg.credits)}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      selectedPackage === pkg.credits
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${pkg.popular ? 'ring-2 ring-orange-200' : ''}`}
                  >
                    {pkg.popular && (
                      <span className="inline-block bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded mb-2">
                        Popular
                      </span>
                    )}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-gray-900">{pkg.credits.toLocaleString('id-ID')}</span>
                      <span className="text-sm text-gray-600">Credits</span>
                    </div>
                    <p className="text-lg font-semibold text-orange-600">{formatIDR(pkg.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setSelectedPackage(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (selectedPackage) {
                    handleTopUp(selectedPackage);
                  }
                }}
                disabled={!selectedPackage || isProcessing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Lanjut Pembayaran
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Premium Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                  <Crown size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Upgrade ke Premium</h3>
              </div>
              <p className="text-sm text-gray-600">Dapatkan akses penuh dan kredit bulanan</p>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 mb-6">
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-gray-900">{formatIDR(SUBSCRIPTION_PLANS.PREMIUM.price)}</div>
                  <p className="text-sm text-gray-600">per bulan</p>
                </div>
                <ul className="space-y-3">
                  {SUBSCRIPTION_PLANS.PREMIUM.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-900">
                      <Check size={16} className="text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Anda akan mendapatkan {SUBSCRIPTION_PLANS.PREMIUM.monthlyCredits} kredit setelah upgrade berhasil
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleUpgradeToPremium}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Crown size={18} />
                    Upgrade Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManagementPage;
