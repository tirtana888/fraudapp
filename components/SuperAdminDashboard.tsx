import React, { useState, useEffect } from 'react';
import {
  Activity,
  Building2,
  TrendingUp,
  Users,
  Briefcase,
  UserPlus,
  Loader2,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  ShieldCheck,
  BarChart3,
  DollarSign,
  Repeat,
  CheckCircle,
  TrendingDown,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { CompanyProfile } from '../types';
import {
  getCompanyUsageStats,
  getTokenSpendAnalytics,
  getKYCAnalytics,
  updateCompanyTier,
  addCompanyCredits,
  CompanyUsageStats,
  TokenSpendAnalytics,
  KYCAnalytics
} from '../services/userManagementService';
import {
  getRevenueAnalytics,
  getRevenueByTier,
  getPaymentTransactions,
  getCreditUsageStats,
  getPaymentMetrics,
  RevenueAnalytics,
  TierRevenue,
  PaymentTransaction,
  CreditUsageStats,
  PaymentMetrics
} from '../services/revenueService';
import {
  getAssessmentMetrics,
  getFraudStats,
  getCandidateAnalytics,
  AssessmentMetrics,
  FraudStats,
  CandidateAnalytics
} from '../services/assessmentAnalyticsService';
import { useToast } from './Toast';

const BRAND_ORANGE = '#CC5500';

interface GlobalMetrics {
  total_assessments: number;
  completed_assessments: number;
  jobs_open: number;
  total_applications: number;
  last_updated: string;
}

const SuperAdminDashboard: React.FC = () => {
  const toast = useToast();
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [jobsOpen, setJobsOpen] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [completedAssessments, setCompletedAssessments] = useState(0);
  const [totalCompaniesCount, setTotalCompaniesCount] = useState(0);

  // Company Management States
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [allCompanies, setAllCompanies] = useState<CompanyProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const companiesPerPage = 20;

  // Company Detail Modal States
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyUsageStats | null>(null);
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenSpendAnalytics | null>(null);
  const [kycAnalytics, setKYCAnalytics] = useState<KYCAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Action Modals
  const [showTierModal, setShowTierModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [newTier, setNewTier] = useState('');
  const [creditsAmount, setCreditsAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Revenue Analytics State
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
  const [tierRevenue, setTierRevenue] = useState<TierRevenue[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [creditStats, setCreditStats] = useState<CreditUsageStats | null>(null);
  const [paymentMetrics, setPaymentMetrics] = useState<PaymentMetrics | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // Assessment Analytics State
  const [assessmentMetrics, setAssessmentMetrics] = useState<AssessmentMetrics | null>(null);
  const [fraudStats, setFraudStats] = useState<FraudStats | null>(null);
  const [candidateAnalytics, setCandidateAnalytics] = useState<CandidateAnalytics | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(true);

  // Fetch ALL data from ALL companies
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch ALL jobs from ALL companies
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const openJobs = jobsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.status !== 'Closed';
        });
        setJobsOpen(openJobs.length);

        // Fetch ALL job applications from portal (interview_sessions with source = 'job_application')
        const applicationsQuery = query(
          collection(db, 'interview_sessions'),
          where('source', '==', 'job_application')
        );
        const applicationsSnapshot = await getDocs(applicationsQuery);
        setTotalApplications(applicationsSnapshot.size);

        // Calculate total assessments and completed assessments from ALL companies
        const allSessionsSnapshot = await getDocs(collection(db, 'interview_sessions'));
        let totalAssess = allSessionsSnapshot.size;
        let completedAssess = 0;

        allSessionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Count as completed if status is 'COMPLETED'
          if (data.status === 'COMPLETED') {
            completedAssess++;
          }
        });

        setTotalAssessments(totalAssess);
        setCompletedAssessments(completedAssess);

        setMetrics({
          total_assessments: totalAssess,
          completed_assessments: completedAssess,
          jobs_open: openJobs.length,
          total_applications: applicationsSnapshot.size,
          last_updated: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error fetching global data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Fetch total companies count
  useEffect(() => {
    const fetchCompaniesCount = async () => {
      try {
        const allCompaniesSnapshot = await getDocs(collection(db, 'companies'));
        setTotalCompaniesCount(allCompaniesSnapshot.size);
      } catch (error) {
        console.error('Error fetching companies count:', error);
      } finally {
        setCompaniesLoading(false);
      }
    };

    fetchCompaniesCount();
  }, []);

  // Fetch revenue analytics data
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        setRevenueLoading(true);
        const [revenue, tiers, txs, credits, payments] = await Promise.all([
          getRevenueAnalytics(),
          getRevenueByTier(),
          getPaymentTransactions(20),
          getCreditUsageStats(),
          getPaymentMetrics()
        ]);

        setRevenueData(revenue);
        setTierRevenue(tiers);
        setTransactions(txs);
        setCreditStats(credits);
        setPaymentMetrics(payments);
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      } finally {
        setRevenueLoading(false);
      }
    };

    fetchRevenueData();
  }, []);

  // Fetch assessment analytics data
  useEffect(() => {
    const fetchAssessmentData = async () => {
      try {
        setAssessmentLoading(true);
        const [metrics, fraud, candidates] = await Promise.all([
          getAssessmentMetrics(),
          getFraudStats(),
          getCandidateAnalytics()
        ]);

        setAssessmentMetrics(metrics);
        setFraudStats(fraud);
        setCandidateAnalytics(candidates);
      } catch (error) {
        console.error('Error fetching assessment data:', error);
      } finally {
        setAssessmentLoading(false);
      }
    };

    fetchAssessmentData();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-800 dark:text-green-300 border-2 border-green-300 dark:border-green-700 shadow-sm';
      case 'Pending':
        return 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-300 dark:border-yellow-700 shadow-sm';
      case 'Suspended':
        return 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 text-red-800 dark:text-red-300 border-2 border-red-300 dark:border-red-700 shadow-sm';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600';
    }
  };

  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'Enterprise':
        return 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-800 dark:text-orange-300 border-2 border-orange-300 dark:border-orange-700 shadow-sm';
      case 'Premium':
        return 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-800 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700 shadow-sm';
      case 'Basic':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600';
    }
  };

  // Company Management Functions
  const loadAllCompanies = async () => {
    try {
      setCompaniesLoading(true);
      const q = query(collection(db, 'companies'), orderBy('joinedDate', 'desc'));
      const snapshot = await getDocs(q);
      const companiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CompanyProfile[];
      setAllCompanies(companiesData);
    } catch (error) {
      console.error('Error loading all companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setCompaniesLoading(false);
    }
  };

  const handleCompanyClick = async (company: CompanyProfile) => {
    setSelectedCompany(company);
    setAnalyticsLoading(true);

    try {
      const [stats, tokens, kyc] = await Promise.all([
        getCompanyUsageStats(company.id),
        getTokenSpendAnalytics(company.id),
        getKYCAnalytics(company.id)
      ]);

      setCompanyStats(stats);
      setTokenAnalytics(tokens);
      setKYCAnalytics(kyc);
    } catch (error) {
      console.error('Error loading company analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleChangeTier = async () => {
    if (!selectedCompany || !newTier) return;

    try {
      setIsProcessing(true);
      const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
      await updateCompanyTier(selectedCompany.id, newTier, adminEmail);
      toast.success('Company tier updated successfully');
      setShowTierModal(false);
      await loadAllCompanies();
      if (selectedCompany) {
        const updated = allCompanies.find(c => c.id === selectedCompany.id);
        if (updated) setSelectedCompany(updated);
      }
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Failed to update tier');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedCompany || !creditsAmount) return;

    const amount = parseInt(creditsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setIsProcessing(true);
      const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
      await addCompanyCredits(selectedCompany.id, amount, adminEmail, 'Manual credit adjustment');
      toast.success(`Added ${amount} credits successfully`);
      setShowCreditsModal(false);
      setCreditsAmount('');
      await loadAllCompanies();
      if (selectedCompany) {
        const stats = await getCompanyUsageStats(selectedCompany.id);
        setCompanyStats(stats);
      }
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error('Failed to add credits');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter companies
  const filteredCompanies = allCompanies.filter(company => {
    const matchesSearch = !searchQuery ||
      company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.adminEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTier = !tierFilter || company.tier === tierFilter;
    const matchesStatus = !statusFilter || company.status === statusFilter;

    return matchesSearch && matchesTier && matchesStatus;
  });

  // Pagination
  const indexOfLastCompany = currentPage * companiesPerPage;
  const indexOfFirstCompany = indexOfLastCompany - companiesPerPage;
  const currentCompanies = filteredCompanies.slice(indexOfFirstCompany, indexOfLastCompany);
  const totalPages = Math.ceil(filteredCompanies.length / companiesPerPage);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-orange/10 via-blue-50 to-purple-50 dark:from-brand-orange/5 dark:via-slate-800 dark:to-purple-900/10 rounded-2xl p-8 border border-orange-200/50 dark:border-slate-700">
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-orange to-orange-600 dark:from-orange-400 dark:to-orange-300 bg-clip-text text-transparent">
                  Super Admin Analytics
                </h1>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full border border-gray-200 dark:border-slate-600 shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Live Updates</span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-200/30 to-transparent dark:from-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-200/30 to-transparent dark:from-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Assessments */}
        <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-orange-200/50 dark:border-orange-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-brand-orange/50 dark:hover:border-orange-600/50 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200/30 to-transparent dark:from-orange-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Activity className="w-7 h-7 text-brand-orange" />
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {metrics?.total_assessments.toLocaleString() || '0'}
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Assessments</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {metrics?.completed_assessments || 0} completed
                </p>
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                  {metrics?.total_assessments ? Math.round((metrics.completed_assessments / metrics.total_assessments) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs Open */}
        <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-blue-200/50 dark:border-blue-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-blue-500/50 dark:hover:border-blue-600/50 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-transparent dark:from-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {jobsOpen.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Jobs Open</p>
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Active job postings
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Applications */}
        <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-green-200/50 dark:border-green-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-green-500/50 dark:hover:border-green-600/50 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/30 to-transparent dark:from-green-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                <UserPlus className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                Total
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {totalApplications.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Candidate Applications</p>
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  All time applications
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Companies Onboarded */}
        <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-cyan-200/50 dark:border-cyan-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-cyan-500/50 dark:hover:border-cyan-600/50 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-200/30 to-transparent dark:from-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-cyan-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-full">
                <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {totalCompaniesCount.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Companies Onboarded</p>
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Active clients
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Financial Analytics Section */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-green-600/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            Revenue & Financial Analytics
          </h2>
        </div>

        {revenueLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : (
          <>
            {/* Revenue Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Revenue */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-green-200/50 dark:border-green-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-green-500/50 dark:hover:border-green-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/30 to-transparent dark:from-green-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <DollarSign className="w-7 h-7 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      All-Time
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      Rp {(revenueData?.totalRevenue || 0).toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Revenue</p>
                  </div>
                </div>
              </div>

              {/* Monthly Revenue */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-blue-200/50 dark:border-blue-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-blue-500/50 dark:hover:border-blue-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-transparent dark:from-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    {revenueData && revenueData.revenueGrowth > 0 ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                        <TrendingUp className="w-3 h-3" />
                        +{revenueData.revenueGrowth.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-400 font-semibold">
                        <TrendingDown className="w-3 h-3" />
                        {revenueData?.revenueGrowth.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      Rp {(revenueData?.monthlyRevenue || 0).toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">This Month</p>
                  </div>
                </div>
              </div>

              {/* MRR */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-purple-200/50 dark:border-purple-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-purple-500/50 dark:hover:border-purple-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200/30 to-transparent dark:from-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Repeat className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs text-purple-700 dark:text-purple-400 font-semibold">
                      Recurring
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      Rp {(revenueData?.mrr || 0).toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">MRR</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ARR: Rp {(revenueData?.arr || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Success Rate */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-orange-200/50 dark:border-orange-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-brand-orange/50 dark:hover:border-orange-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200/30 to-transparent dark:from-orange-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle className="w-7 h-7 text-brand-orange" />
                    </div>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                      Success
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {paymentMetrics?.successRate || 0}%
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payment Success</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {paymentMetrics?.successfulPayments || 0}/{paymentMetrics?.totalPayments || 0} payments
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue by Tier & Credit Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Tier */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={20} />
                  Revenue by Tier
                </h3>
                <div className="space-y-3">
                  {tierRevenue.map((tier) => (
                    <div key={tier.tier} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${tier.tier === 'Enterprise' ? 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 text-orange-800 dark:text-orange-300 border-2 border-orange-300 dark:border-orange-700' :
                          tier.tier === 'Premium' ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 text-blue-800 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                          }`}>
                          {tier.tier}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {tier.count} companies
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          Rp {tier.revenue.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tier.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credit Usage Stats */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard size={20} />
                  Credit Usage
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Credits Sold</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(creditStats?.totalCreditsSold || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Consumed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(creditStats?.totalCreditsConsumed || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(creditStats?.totalCreditsRemaining || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Burn Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {creditStats?.creditBurnRate || 0}/day
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign size={20} />
                  Recent Transactions
                </h3>
              </div>
              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{tx.companyName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              Rp {tx.amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${tx.status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                              tx.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                              }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(tx.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Assessment Analytics Section */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            Assessment Analytics
          </h2>
        </div>

        {assessmentLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : (
          <>
            {/* Assessment Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Assessments */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-blue-200/50 dark:border-blue-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-blue-500/50 dark:hover:border-blue-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-transparent dark:from-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs text-blue-700 dark:text-blue-400 font-semibold">
                      Total
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {(assessmentMetrics?.totalAssessments || 0).toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Assessments</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {assessmentMetrics?.completedAssessments || 0} completed
                    </p>
                  </div>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-green-200/50 dark:border-green-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-green-500/50 dark:hover:border-green-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/30 to-transparent dark:from-green-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs text-green-700 dark:text-green-400 font-semibold">
                      Success
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {assessmentMetrics?.completionRate || 0}%
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Completion Rate</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {assessmentMetrics?.abandonedAssessments || 0} abandoned
                    </p>
                  </div>
                </div>
              </div>

              {/* Average Time */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-orange-200/50 dark:border-orange-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-brand-orange/50 dark:hover:border-orange-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200/30 to-transparent dark:from-orange-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Clock className="w-7 h-7 text-brand-orange" />
                    </div>
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full text-xs text-orange-700 dark:text-orange-400 font-semibold">
                      Avg
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {assessmentMetrics?.averageCompletionTime || 0}m
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Completion Time</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Per assessment
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Now */}
              <div className="group relative bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border-2 border-purple-200/50 dark:border-purple-900/30 p-6 hover:shadow-xl hover:scale-105 hover:border-purple-500/50 dark:hover:border-purple-600/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200/30 to-transparent dark:from-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Activity className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs text-purple-700 dark:text-purple-400 font-semibold">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                      Live
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                      {assessmentMetrics?.activeAssessments || 0}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Now</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      In progress
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fraud Stats & Candidate Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fraud Detection Stats */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-600" />
                  Fraud Detection
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Cases</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {fraudStats?.totalFraudCases || 0}
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Detection Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {fraudStats?.fraudDetectionRate || 0}%
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Risk Distribution</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Low Risk</span>
                        <span className="text-sm font-bold text-green-600">{fraudStats?.riskDistribution.low || 0}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(fraudStats?.riskDistribution.low || 0) / Math.max(1, (fraudStats?.riskDistribution.low || 0) + (fraudStats?.riskDistribution.medium || 0) + (fraudStats?.riskDistribution.high || 0)) * 100}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Medium Risk</span>
                        <span className="text-sm font-bold text-yellow-600">{fraudStats?.riskDistribution.medium || 0}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${(fraudStats?.riskDistribution.medium || 0) / Math.max(1, (fraudStats?.riskDistribution.low || 0) + (fraudStats?.riskDistribution.medium || 0) + (fraudStats?.riskDistribution.high || 0)) * 100}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">High Risk</span>
                        <span className="text-sm font-bold text-red-600">{fraudStats?.riskDistribution.high || 0}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(fraudStats?.riskDistribution.high || 0) / Math.max(1, (fraudStats?.riskDistribution.low || 0) + (fraudStats?.riskDistribution.medium || 0) + (fraudStats?.riskDistribution.high || 0)) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Candidate Analytics */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users size={20} />
                  Candidate Analytics
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Candidates</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {(candidateAnalytics?.totalCandidates || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Score</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {candidateAnalytics?.averageFraudScore || 0}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top Companies</p>
                    <div className="space-y-2">
                      {candidateAnalytics?.topCompanies.slice(0, 3).map((company, index) => (
                        <div key={company.companyId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">#{index + 1}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                              {company.companyName}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-blue-600">
                            {company.assessmentCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View All Companies Button */}
      {!showAllCompanies && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              setShowAllCompanies(true);
              loadAllCompanies();
            }}
            className="px-6 py-3 bg-gradient-to-r from-brand-orange to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2"
          >
            <Building2 size={20} />
            View All Companies ({totalCompaniesCount})
          </button>
        </div>
      )}

      {/* Full Company List View */}
      {showAllCompanies && (
        <div className="mt-6 space-y-6">
          {/* Back Button */}
          <button
            onClick={() => setShowAllCompanies(false)}
            className="flex items-center gap-2 text-brand-orange hover:text-orange-600 font-semibold transition-colors"
          >
            <ChevronLeft size={20} />
            Back to Dashboard
          </button>

          {/* Search & Filters - Same style as existing cards */}
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Tiers</option>
                <option value="Basic">Basic</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            {(searchQuery || tierFilter || statusFilter) && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredCompanies.length} of {allCompanies.length} companies
              </div>
            )}
          </div>

          {/* Companies List - Same card style as recent companies */}
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            {companiesLoading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              </div>
            ) : currentCompanies.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No companies found</p>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-4">
                  {currentCompanies.map((company) => (
                    <div
                      key={company.id}
                      onClick={() => handleCompanyClick(company)}
                      className="group relative bg-gray-50/50 dark:bg-slate-800/30 rounded-xl p-5 border border-gray-200 dark:border-slate-700 hover:border-brand-orange/50 dark:hover:border-orange-600/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="flex-shrink-0 p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <Building2 className="w-6 h-6 text-brand-orange" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">{company.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{company.adminEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTierBadgeStyle(company.tier || 'Basic')}`}>
                            {company.tier || 'Basic'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeStyle(company.status || 'Active')}`}>
                            {company.status || 'Active'}
                          </span>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {formatDate(company.joinedDate)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {indexOfFirstCompany + 1} to {Math.min(indexOfLastCompany, filteredCompanies.length)} of {filteredCompanies.length} companies
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 rounded-xl">
                  <Building2 className="w-8 h-8 text-brand-orange" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.name}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCompany.adminEmail}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
            {analyticsLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              </div>
            ) : (
              <>
                {companyStats && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Assessments</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{companyStats.totalAssessments}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Candidates</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{companyStats.totalCandidates}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Credits</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{companyStats.creditsRemaining}</p>
                    </div>
                  </div>
                )}
                {tokenAnalytics && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <BarChart3 size={20} />
                      Token Spend Analytics
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{tokenAnalytics.totalTokensUsed.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">Rp {tokenAnalytics.totalCost.toLocaleString()}</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Cost/Assessment</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          Rp {companyStats ? (tokenAnalytics.totalCost / Math.max(companyStats.totalAssessments, 1)).toFixed(0) : 0}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">Gemini</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tokenAnalytics.breakdown.gemini.tokens.toLocaleString()} tokens (Rp {tokenAnalytics.breakdown.gemini.cost.toLocaleString()})
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">OpenAI</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tokenAnalytics.breakdown.openai.tokens.toLocaleString()} tokens (Rp {tokenAnalytics.breakdown.openai.cost.toLocaleString()})
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">Mistral</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tokenAnalytics.breakdown.mistral.tokens.toLocaleString()} tokens (Rp {tokenAnalytics.breakdown.mistral.cost.toLocaleString()})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {kycAnalytics && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <ShieldCheck size={20} />
                      KYC Analytics (Didit)
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total KYC</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{kycAnalytics.totalVerifications}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{kycAnalytics.successRate}%</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{kycAnalytics.failedVerifications}</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">Rp {kycAnalytics.totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => {
                      setNewTier(selectedCompany.tier || 'Basic');
                      setShowTierModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Change Tier
                  </button>
                  <button
                    onClick={() => setShowCreditsModal(true)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} />
                    Add Credits
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Change Tier Modal */}
      {showTierModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Change Company Tier</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Change tier for <span className="font-semibold">{selectedCompany.name}</span>
            </p>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-6"
            >
              <option value="Basic">Basic</option>
              <option value="Premium">Premium</option>
              <option value="Enterprise">Enterprise</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTierModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeTier}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-brand-orange to-orange-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Changing...' : 'Change Tier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credits Modal */}
      {showCreditsModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Credits</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add credits to <span className="font-semibold">{selectedCompany.name}</span>
            </p>
            <input
              type="number"
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreditsModal(false);
                  setCreditsAmount('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredits}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Adding...' : 'Add Credits'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated Footer */}
      {metrics && (
        <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: <span className="font-semibold text-gray-700 dark:text-gray-300">{new Date(metrics.last_updated).toLocaleString('id-ID')}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
