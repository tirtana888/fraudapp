import {
  RevenueTrendChart,
  AssessmentVolumeChart,
  TierDistributionChart
} from './DashboardCharts';
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
      {/* Header with Subtle Modern Design */}
      <div className="relative overflow-hidden bg-white dark:bg-brand-slate-850 rounded-2xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                <Calendar size={16} />
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center bg-gray-50 dark:bg-slate-800 p-1 rounded-lg border border-gray-100 dark:border-slate-700">
                <button className="px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white bg-white dark:bg-slate-700 rounded-md shadow-sm transition-all">
                  7 Days
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                  30 Days
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                  All Time
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-100 dark:border-green-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Assessments - Clean Card */}
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assessments</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {metrics?.total_assessments.toLocaleString() || '0'}
              </h3>
            </div>
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Activity className="w-5 h-5 text-brand-orange" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
            <div className="flex-1">
              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-brand-orange h-1.5 rounded-full"
                  style={{ width: `${metrics?.total_assessments ? Math.round((metrics.completed_assessments / metrics.total_assessments) * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {metrics?.total_assessments ? Math.round((metrics.completed_assessments / metrics.total_assessments) * 100) : 0}% Done
            </span>
          </div>
        </div>

        {/* Jobs Open - Clean Card */}
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Jobs</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {jobsOpen.toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Active</span>
            <span className="text-xs text-gray-400">Default Company</span>
          </div>
        </div>

        {/* Total Applications - Clean Card */}
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Applicants</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {totalApplications.toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
              <TrendingUp size={12} /> +12%
            </span>
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>

        {/* Companies - Clean Card */}
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Companies</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {totalCompaniesCount.toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
              <Building2 className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
            <span className="text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-medium">SaaS Clients</span>
            <span className="text-xs text-gray-400">Active</span>
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
              {/* Total Revenue - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      Rp {(revenueData?.totalRevenue || 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <span className="text-xs text-green-600 flex items-center gap-1 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                    <TrendingUp size={12} /> All Time
                  </span>
                </div>
              </div>

              {/* Monthly Revenue - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Revenue</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      Rp {(revenueData?.monthlyRevenue || 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  {revenueData && revenueData.revenueGrowth > 0 ? (
                    <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                      <TrendingUp size={12} /> +{revenueData.revenueGrowth.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                      {revenueData?.revenueGrowth.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-xs text-gray-400">vs last month</span>
                </div>
              </div>

              {/* MRR - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">MRR</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      Rp {(revenueData?.mrr || 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Repeat className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 font-medium">ARR Estimate</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Rp {(revenueData?.arr || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Success - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {paymentMetrics?.successRate || 0}%
                    </h3>
                  </div>
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-brand-orange" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 flex-1">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${paymentMetrics?.successRate || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {paymentMetrics?.successfulPayments || 0} txs
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue Trend Chart */}
            <div className="mb-6">
              <RevenueTrendChart />
            </div>

            {/* Revenue Distribution & Credit Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Tier */}
              {/* Revenue by Tier - Donut Chart */}
              <div className="h-full">
                <TierDistributionChart
                  data={tierRevenue.map(t => ({
                    name: t.tier,
                    value: parseFloat(t.percentage.toFixed(1)),
                    color: t.tier === 'Enterprise' ? '#CC5500' : t.tier === 'Premium' ? '#3b82f6' : '#94a3b8'
                  }))}
                />
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

            {/* Recent Transactions Table */}
            <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Recent Transactions
                </h3>
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  View All
                </button>
              </div>
              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="bg-gray-50 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No transactions yet</h3>
                  <p className="text-gray-500 dark:text-gray-400">Transactions will appear here once payments are processed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                {tx.companyName.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{tx.companyName}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                              Rp {tx.amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${tx.status === 'success' ? 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
                              tx.status === 'failed' ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
                                'bg-yellow-50 border-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
                              }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'success' ? 'bg-green-500' : tx.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                              {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
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
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
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
              {/* Total Assessments - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assessments</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {assessmentMetrics?.totalAssessments.toLocaleString() || '0'}
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">All Time</span>
                </div>
              </div>
              {/* Completion Rate - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {assessmentMetrics?.completionRate || 0}%
                    </h3>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 flex-1">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${assessmentMetrics?.completionRate || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {assessmentMetrics?.abandonedAssessments || 0} drops
                  </span>
                </div>
              </div>

              {/* Average Time - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Time</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {assessmentMetrics?.averageCompletionTime || 0}m
                    </h3>
                  </div>
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Clock className="w-5 h-5 text-brand-orange" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-medium">Per Session</span>
                </div>
              </div>

              {/* Active Now - Clean Card */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Now</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {assessmentMetrics?.activeAssessments || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                    Live
                  </span>
                </div>
              </div>
            </div>

            {/* Assessment Volume Chart */}
            <div className="mb-6 mt-6">
              <AssessmentVolumeChart />
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
        )
        }
      </div >

      {/* View All Companies Button */}
      {
        !showAllCompanies && (
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
        )
      }

      {/* Full Company List View */}
      {
        showAllCompanies && (
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
        )
      }

      {/* Company Detail Modal */}
      {
        selectedCompany && (
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
        )
      }

      {/* Change Tier Modal */}
      {
        showTierModal && selectedCompany && (
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
        )
      }

      {/* Add Credits Modal */}
      {
        showCreditsModal && selectedCompany && (
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
        )
      }

      {/* Last Updated Footer */}
      {
        metrics && (
          <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Last updated: <span className="font-semibold text-gray-700 dark:text-gray-300">{new Date(metrics.last_updated).toLocaleString('id-ID')}</span>
            </span>
          </div>
        )
      }
    </div >
  );
};

export default SuperAdminDashboard;
