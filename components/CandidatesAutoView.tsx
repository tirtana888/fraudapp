import React, { useState, useEffect } from 'react';
import { Zap, Download, Eye, Mail, Phone, Filter, Loader2, FileText, AlertCircle, CheckCircle2, AlertTriangle, Briefcase, MapPin, Calendar, TrendingUp, Clock, User } from 'lucide-react';
import { InterviewSession, Job, RiskLevel } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface CandidatesAutoViewProps {
  companyId: string;
  onViewSession: (sessionId: string) => void;
}

interface AutoCandidate extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  testScore?: number;
  completedAt?: string;
  currentQuestionIndex?: number;
  totalQuestions?: number;
}

const CandidatesAutoView: React.FC<CandidatesAutoViewProps> = ({ companyId, onViewSession }) => {
  const [candidates, setCandidates] = useState<AutoCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[CANDIDATES-AUTO] Loading data for company:', companyId);

      const jobsQuery = query(
        collection(db, COLLECTIONS.JOBS),
        where('companyId', '==', companyId)
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsData = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Job));
      setJobs(jobsData);

      const sessionsQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId),
        where('source', '==', 'job_application')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      console.log('[CANDIDATES-AUTO] Found all job application sessions:', sessionsSnapshot.docs.length);

      const candidatesWithDetails: AutoCandidate[] = await Promise.all(
        sessionsSnapshot.docs.map(async (docSnap) => {
          const sessionData = { id: docSnap.id, ...docSnap.data() } as any;

          let jobTitle = 'Unknown Position';
          let jobLocation = 'Unknown Location';

          if (sessionData.jobId) {
            const jobDoc = await getDoc(doc(db, COLLECTIONS.JOBS, sessionData.jobId));
            if (jobDoc.exists()) {
              const job = jobDoc.data();
              jobTitle = job.title;
              jobLocation = job.location;
            }
          }

          const testScore = sessionData.analysis?.overallScore || 0;
          const completedAt = sessionData.completedAt || sessionData.date;

          return {
            ...sessionData,
            jobTitle,
            jobLocation,
            testScore,
            completedAt
          } as AutoCandidate;
        })
      );

      candidatesWithDetails.sort((a, b) =>
        new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime()
      );

      setCandidates(candidatesWithDetails);
      console.log('[CANDIDATES-AUTO] ✅ Total candidates loaded:', candidatesWithDetails.length);
    } catch (error) {
      console.error('[CANDIDATES-AUTO] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    if (selectedJob !== 'all' && candidate.jobId !== selectedJob) return false;
    if (riskFilter !== 'all') {
      const risk = candidate.analysis?.riskLevel?.toLowerCase() || 'low';
      if (riskFilter !== risk) return false;
    }
    return true;
  });

  const getRiskBadge = (riskLevel?: RiskLevel) => {
    const risk = riskLevel?.toLowerCase() || 'low';
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300'
    };
    const icons = {
      critical: AlertCircle,
      high: AlertTriangle,
      medium: AlertTriangle,
      low: CheckCircle2
    };
    const Icon = icons[risk as keyof typeof icons] || CheckCircle2;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${styles[risk as keyof typeof styles]}`}>
        <Icon size={14} />
        {riskLevel || 'Low'}
      </span>
    );
  };

  const downloadCV = (cvUrl?: string, candidateName?: string) => {
    if (!cvUrl) {
      alert('CV tidak tersedia');
      return;
    }
    window.open(cvUrl, '_blank');
  };

  const getRiskScoreBadge = (score: number) => {
    if (score <= 20) {
      return <span className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold text-sm flex items-center gap-1">🟢 {score}</span>;
    } else if (score <= 50) {
      return <span className="px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold text-sm flex items-center gap-1">🟡 {score}</span>;
    } else {
      return <span className="px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-1">🔴 {score}</span>;
    }
  };

  const getStageBadge = (status: string, hasAnalysis: boolean) => {
    if (status === 'completed' && hasAnalysis) {
      return <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold text-xs">✅ Completed</span>;
    } else if (status === 'completed') {
      return <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold text-xs">Review Pending</span>;
    } else if (status === 'in-progress') {
      return <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold text-xs">⏳ In Progress</span>;
    } else {
      return <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 font-semibold text-xs">Invited</span>;
    }
  };

  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 text-brand-orange animate-spin mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading candidates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Zap className="text-brand-orange" size={28} />
            Otomatis (Instant Assessment)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kandidat yang auto-complete test via Job Portal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-brand-slate-850 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
            <span className="text-2xl font-bold text-gray-800 dark:text-white">{filteredCandidates.length}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">Kandidat</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-brand-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Filter:</span>
        </div>
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-slate-800 dark:text-gray-200"
        >
          <option value="all">Semua Posisi</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>{job.title}</option>
          ))}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-slate-800 dark:text-gray-200"
        >
          <option value="all">Semua Risk Level</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
          <option value="critical">Critical Risk</option>
        </select>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="bg-white dark:bg-brand-slate-850 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-12 text-center">
          <Zap className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-2">Belum Ada Kandidat Otomatis</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Kandidat yang complete instant assessment akan muncul di sini
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Applied For
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Candidate Column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-orange to-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {getAvatarInitials(candidate.candidate.name)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {candidate.candidate.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {candidate.candidate.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Applied For Column */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {candidate.jobTitle}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin size={12} />
                        {candidate.jobLocation}
                      </div>
                    </td>

                    {/* Stage Column */}
                    <td className="px-6 py-4">
                      {getStageBadge(candidate.status, !!candidate.analysis)}
                    </td>

                    {/* Risk Score Column */}
                    <td className="px-6 py-4">
                      {getRiskScoreBadge(candidate.testScore || 0)}
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onViewSession(candidate.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatesAutoView;
