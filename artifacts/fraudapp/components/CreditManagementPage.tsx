import React, { useState, useEffect, useMemo } from 'react';
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
  Shield,
  BarChart3,
  Filter,
  Download,
  Calendar
} from 'lucide-react';
import { UserProfile, CompanyProfile, CreditTransaction, SUBSCRIPTION_PLANS } from '../types';
import { getCreditBalance, getCreditTransactions, creditsToIDR } from '../services/creditManagement';
import { createTopUpInvoice, createPremiumSubscriptionInvoice, getTopUpPackages, formatIDR } from '../services/xenditIntegration';
import { getCompanyById } from '../services/supabase';

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
  const [transactionFilter, setTransactionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const topUpPackages = getTopUpPackages();

  // Calculate Usage Statistics
  const usageStats = useMemo(() => {
    const last30Days = transactions.filter(t => {
      const date = new Date(t.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    });

    const totalUsed = last30Days
      .filter(t => t.type === 'debit')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalAdded = last30Days
      .filter(t => t.type === 'credit')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const avgDailyUsage = Math.round(totalUsed / 30);

    return { totalUsed, totalAdded, avgDailyUsage };
  }, [transactions]);

  useEffect(() => {
    console.log('[CREDIT] 🚀 Initializing Credit Management page...');
    setCreditBalance(initialCompany.credits || 0);
    setCompany(initialCompany);
    loadCreditData();
  }, [initialCompany.id]);

  const loadCreditData = async () => {
    if (!initialCompany.id) return;
    try {
      const dataPromise = Promise.all([
        getCreditBalance(initialCompany.id),
        getCreditTransactions(initialCompany.id, 50),
        getCompanyById(initialCompany.id)
      ]);

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3000)
      );

      const result = await Promise.race([dataPromise, timeoutPromise]);

      if (result) {
        const [balance, txHistory, updatedCompany] = result;
        setCreditBalance(balance);
        setTransactions(txHistory);
        if (updatedCompany) setCompany(updatedCompany);
      }
    } catch (error) {
      console.error('[CREDIT] ⚠️ Error loading data:', error);
    }
  };

  const handleTopUp = async (credits: number) => {
    if (!initialCompany.id || !user.email) return;
    setIsProcessing(true);
    try {
      const result = await createTopUpInvoice(
        initialCompany.id,
        credits,
        user.email,
        initialCompany.name || 'Company'
      );
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
      // Mock upgrade for now if needed, or real call
      const result = await createPremiumSubscriptionInvoice(
        initialCompany.id,
        user.email,
        initialCompany.name || 'Company',
        'Premium'
      );
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
        return <Shield size={18} className="text-blue-600" />;
      case 'TOP_UP':
      case 'SUBSCRIPTION':
      case 'INITIAL_CREDIT':
      case 'MONTHLY_REFILL':
        return <TrendingUp size={18} className="text-green-600" />;
      default:
        return <Coins size={18} className="text-gray-600" />;
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (transactionFilter === 'ALL') return true;
    if (transactionFilter === 'IN') return tx.type === 'credit';
    if (transactionFilter === 'OUT') return tx.type === 'debit';
    return true;
  });

  const isPremium = company?.tier === 'Premium';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header with Glass Effect */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-xl">
                <Coins size={24} className="text-orange-600 dark:text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Credit Management</h1>
            </div>

            <div className="flex items-center gap-3">
              {isPremium ? (
                <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-full shadow-sm text-sm font-semibold">
                  <Crown size={16} />
                  <span>Premium Member</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="hidden sm:flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-full hover:shadow-lg transition-all text-sm font-bold"
                >
                  <Sparkles size={16} />
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Top Section: Balance & Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Balance Card (Glassmorphism) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-amber-600 shadow-2xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:opacity-10 transition-opacity duration-700"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-900 opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

            <div className="relative z-10 p-8 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-orange-100 font-medium mb-1 flex items-center gap-2">
                    Available Balance <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] uppercase tracking-wider">Active</span>
                  </p>
                  <h2 className="text-6xl font-black text-white tracking-tighter mb-2">
                    {creditBalance.toLocaleString('id-ID')}
                  </h2>
                  <p className="text-orange-200 font-medium">
                    ≅ {formatIDR(creditsToIDR(creditBalance))}
                  </p>
                </div>
                <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-inner">
                  <CreditCard size={32} className="text-white" />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="bg-white text-orange-600 py-3.5 px-6 rounded-xl font-bold hover:bg-orange-50 hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group/btn"
                >
                  <CreditCard size={18} className="group-hover/btn:scale-110 transition-transform" />
                  Top Up Credits
                </button>

                {!isPremium && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="bg-orange-800/40 backdrop-blur-sm border border-white/20 text-white py-3.5 px-6 rounded-xl font-bold hover:bg-orange-800/60 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Crown size={18} />
                    Go Premium
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <BarChart3 size={20} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Usage Overview</h3>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-red-500 rounded-full"></div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Used (30d)</p>
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{usageStats.totalUsed.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-400 group-hover:text-red-500 transition-colors">Cr</span>
                </div>

                <div className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Added (30d)</p>
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{usageStats.totalAdded.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-400 group-hover:text-green-500 transition-colors">Cr</span>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg. Daily Usage</span>
                    <span className="font-bold text-gray-900 dark:text-white">~{usageStats.avgDailyUsage} credits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-600 dark:text-gray-300">
                <History size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transaction History</h3>
            </div>

            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl">
              {(['ALL', 'IN', 'OUT'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTransactionFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${transactionFilter === filter
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'IN' ? 'Incoming' : 'Outgoing'}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Filter size={24} />
                </div>
                <h4 className="text-gray-900 dark:text-white font-bold mb-1">No transactions found</h4>
                <p className="text-sm text-gray-500">Try changing your filters or top up credits.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${tx.type === 'credit'
                          ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}>
                        {getTransactionIcon(tx.action)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm mb-0.5 group-hover:text-brand-orange transition-colors">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          {new Date(tx.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-bold block mb-1 ${tx.type === 'credit' ? 'text-green-600 dark:text-green-500' : 'text-gray-900 dark:text-white'
                        }`}>
                        {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString()} Cr
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-mono">
                        Bal: {tx.balanceAfter.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top-Up Modal (Improved) */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row">
            {/* Left Side: Summary */}
            <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-900 p-8 flex flex-col justify-between border-r border-gray-100 dark:border-slate-700">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Top Up Credits</h3>
                <p className="text-sm text-gray-500 mb-8">Pilih paket kredit untuk melanjutkan operasional Anda.</p>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-4">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Saldo Saat Ini</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{creditBalance.toLocaleString()}</p>
                </div>
              </div>

              {selectedPackage && (
                <div className="animate-in slide-in-from-bottom-4">
                  <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Purchase</span>
                      <span className="font-bold text-gray-900 dark:text-white">{selectedPackage.toLocaleString()} Credits</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Packages */}
            <div className="w-full md:w-2/3 p-8 bg-white dark:bg-slate-800 flex flex-col">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {topUpPackages.map((pkg, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPackage(pkg.credits)}
                      className={`relative p-5 rounded-2xl border-2 transition-all text-left group ${selectedPackage === pkg.credits
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md'
                        : 'border-gray-100 dark:border-slate-700 hover:border-orange-300 hover:shadow-lg'
                        }`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                          Best Value
                        </div>
                      )}

                      <div className="mb-3">
                        <span className="text-2xl font-black text-gray-900 dark:text-white block group-hover:scale-105 transition-transform origin-left">
                          {pkg.credits.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Credits</span>
                      </div>

                      <div className="flex justify-between items-end border-t border-dashed border-gray-200 dark:border-slate-600 pt-3 mt-2">
                        <span className="text-sm font-medium text-gray-500">Price</span>
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {formatIDR(pkg.price)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex gap-3 pt-6 border-t border-gray-100 dark:border-slate-700">
                <button
                  onClick={() => { setShowTopUpModal(false); setSelectedPackage(null); }}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedPackage && handleTopUp(selectedPackage)}
                  disabled={!selectedPackage || isProcessing}
                  className="flex-1 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : 'Pay Now'}
                  {!isProcessing && <ArrowRight size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Premium Modal (Simplified) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl transform transition-all">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-xl">
                <Crown size={32} className="text-yellow-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Upgrade to Premium</h3>
              <p className="text-slate-300 text-sm">Unlock unlimited potential for your hiring process.</p>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <span className="text-4xl font-black text-gray-900 dark:text-white">{formatIDR(SUBSCRIPTION_PLANS.PREMIUM.price)}</span>
                <span className="text-gray-500 text-sm font-medium">/ month</span>
              </div>

              <div className="space-y-4 mb-8">
                {SUBSCRIPTION_PLANS.PREMIUM.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 text-green-600">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    {feature}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-gray-200"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleUpgradeToPremium}
                  disabled={isProcessing}
                  className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-orange-500/25 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {isProcessing ? 'Processing...' : 'Upgrade Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManagementPage;
