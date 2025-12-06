import React, { useState, useEffect } from 'react';
import {
  Activity,
  Building2,
  TrendingUp,
  Users,
  Briefcase,
  UserPlus,
  Loader2,
  Calendar
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { CompanyProfile } from '../types';

const BRAND_ORANGE = '#CC5500';

interface GlobalMetrics {
  total_assessments: number;
  completed_assessments: number;
  jobs_open: number;
  total_applications: number;
  last_updated: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [jobsOpen, setJobsOpen] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [completedAssessments, setCompletedAssessments] = useState(0);
  const [totalCompaniesCount, setTotalCompaniesCount] = useState(0);

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

  // Fetch recent companies
  useEffect(() => {
    const fetchRecentCompanies = async () => {
      try {
        // Get total count of ALL companies
        const allCompaniesSnapshot = await getDocs(collection(db, 'companies'));
        setTotalCompaniesCount(allCompaniesSnapshot.size);

        // Get recent 5 companies for display
        const q = query(
          collection(db, 'companies'),
          orderBy('joinedDate', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const companiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CompanyProfile[];
        setCompanies(companiesData);
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setCompaniesLoading(false);
      }
    };

    fetchRecentCompanies();
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

      {/* Recent Companies */}
      <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-900/5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-lg">
                <Building2 className="w-6 h-6 text-brand-orange" />
              </div>
              Recent Companies
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Latest {companies.length} registrations
            </span>
          </div>
        </div>

        {companiesLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-4 bg-gray-100 dark:bg-slate-800 rounded-full mb-4">
              <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No companies registered yet</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              {companies.map((company, index) => (
                <div
                  key={company.id}
                  className="group relative bg-gray-50/50 dark:bg-slate-800/30 rounded-xl p-5 border border-gray-200 dark:border-slate-700 hover:border-brand-orange/50 dark:hover:border-orange-600/50 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="w-6 h-6 text-brand-orange" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {company.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {company.adminEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold ${getTierBadgeStyle(company.tier)}`}>
                          {company.tier}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {formatDate(company.joinedDate)}
                        </span>
                      </div>

                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${getStatusBadgeStyle(company.status)}`}>
                        {company.status}
                      </span>

                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                        <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {company.usersCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
