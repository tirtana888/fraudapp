import React, { useState, useEffect } from 'react';
import { Zap, Download, Eye, Mail, Phone, Filter, Loader2, FileText, AlertCircle, CheckCircle2, AlertTriangle, Briefcase, MapPin, Calendar, TrendingUp, Clock, User, Bot, Shield } from 'lucide-react';
import { InterviewSession, Job, RiskLevel } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useToast } from './Toast';
import { calculateAssessmentScores } from '../services/genai';

interface CandidatesAutoViewProps {
  companyId: string;
  onViewSession: (sessionId: string) => void;
}

interface AutoCandidate extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  completedAt?: string;
  currentQuestionIndex?: number;
  totalQuestions?: number;
}

const CandidatesAutoView: React.FC<CandidatesAutoViewProps> = ({ companyId, onViewSession }) => {
  const toast = useToast();
  const [candidates, setCandidates] = useState<AutoCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

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

      const autoCandidateSessions = sessionsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status !== 'pending_review';
      });
      console.log('[CANDIDATES-AUTO] Filtered to auto-complete only (excluding pending_review):', autoCandidateSessions.length);

      const candidatesWithDetails: AutoCandidate[] = await Promise.all(
        autoCandidateSessions.map(async (docSnap) => {
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

          const completedAt = sessionData.completedAt || sessionData.date;

          return {
            ...sessionData,
            jobTitle,
            jobLocation,
            completedAt
          } as AutoCandidate;
        })
      );

      candidatesWithDetails.sort((a, b) => {
        return new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime();
      });

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
    if (stageFilter !== 'all') {
      let stage = candidate.recruitmentStage || 'screening';
      if (stage === 'processing') stage = 'screening';
      if (stage === 'background_check') stage = 'bc_check';
      if (stage === 'approved') stage = 'hired';
      if (stageFilter !== stage) return false;
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
      toast.error('CV tidak tersedia');
      return;
    }
    window.open(cvUrl, '_blank');
  };

  const calculateRiskScore = (candidate: AutoCandidate): number => {
    // Priority 1: Use analysis.scores if available
    if (candidate.analysis?.scores) {
      const { pressure = 0, opportunity = 0, rationalization = 0 } = candidate.analysis.scores;
      const avgScore = Math.round((pressure + opportunity + rationalization) / 3);
      console.log(`[RISK-SCORE] ${candidate.candidate?.name}: Using analysis.scores - P=${pressure}, O=${opportunity}, R=${rationalization}, Avg=${avgScore}`);
      return avgScore;
    }

    // Priority 2: Calculate from structuredAssessment and sjtResults
    if (candidate.structuredAssessment && candidate.structuredAssessment.length > 0) {
      const scores = calculateAssessmentScores(
        candidate.structuredAssessment,
        candidate.sjtResults || [],
        candidate.financialStrainResults || []
      );
      const avgScore = Math.round((scores.pressureScore + scores.opportunityScore + scores.rationalizationScore) / 3);
      console.log(`[RISK-SCORE] ${candidate.candidate?.name}: Calculated from assessment - P=${scores.pressureScore}, O=${scores.opportunityScore}, R=${scores.rationalizationScore}, Avg=${avgScore}`);
      return avgScore;
    }

    // Priority 3: Fallback to riskLevel estimation
    if (candidate.analysis?.riskLevel) {
      const riskLevel = candidate.analysis.riskLevel.toLowerCase();
      console.log(`[RISK-SCORE] ${candidate.candidate?.name}: Using riskLevel fallback=${riskLevel}`);
      if (riskLevel === 'critical') return 90;
      if (riskLevel === 'high') return 65;
      if (riskLevel === 'medium') return 35;
      if (riskLevel === 'low') return 10;
    }

    console.log(`[RISK-SCORE] ${candidate.candidate?.name}: No data available, returning 0`);
    return 0;
  };

  const getRiskScoreBadge = (candidate: AutoCandidate) => {
    if (!candidate.analysis) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold text-xs flex items-center gap-1">
          <Clock size={12} />
          Pending
        </span>
      );
    }

    const score = calculateRiskScore(candidate);
    const riskLevel = candidate.analysis.riskLevel?.toLowerCase() || 'low';

    if (riskLevel === 'critical' || score >= 75) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold text-xs flex items-center gap-1">
          <AlertCircle size={12} />
          {score}/100
        </span>
      );
    } else if (riskLevel === 'high' || score >= 50) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold text-xs flex items-center gap-1">
          <AlertTriangle size={12} />
          {score}/100
        </span>
      );
    } else if (riskLevel === 'medium' || score >= 30) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold text-xs flex items-center gap-1">
          <AlertTriangle size={12} />
          {score}/100
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold text-xs flex items-center gap-1">
          <CheckCircle2 size={12} />
          {score}/100
        </span>
      );
    }
  };

  const getStageBadge = (candidate: AutoCandidate) => {
    const recruitmentStage = candidate.recruitmentStage || 'screening';
    const hasAnalysis = !!candidate.analysis;

    const stageMap: { [key: string]: { label: string; color: string; icon: JSX.Element } } = {
      'screening': {
        label: 'Screening 🤖',
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        icon: <Bot size={12} />
      },
      'review': {
        label: 'Review 📋',
        color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        icon: <FileText size={12} />
      },
      'interview': {
        label: 'Interview 🤝',
        color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        icon: <User size={12} />
      },
      'bc_check': {
        label: 'BC Check 🛡️',
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        icon: <Shield size={12} />
      },
      'hired': {
        label: 'Hired 🎉',
        color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
        icon: <CheckCircle2 size={12} />
      },
      'rejected': {
        label: 'Rejected',
        color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
        icon: <AlertCircle size={12} />
      },
      'processing': {
        label: 'Screening 🤖',
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        icon: <Bot size={12} />
      },
      'background_check': {
        label: 'BC Check 🛡️',
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        icon: <Shield size={12} />
      },
      'approved': {
        label: 'Hired 🎉',
        color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
        icon: <CheckCircle2 size={12} />
      }
    };

    const stage = stageMap[recruitmentStage] || stageMap['screening'];

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-xs border ${stage.color}`}>
        {stage.icon}
        {stage.label}
      </span>
    );
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
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-slate-800 dark:text-gray-200"
        >
          <option value="all">Semua Stage</option>
          <option value="screening">Screening 🤖</option>
          <option value="review">Review 📋</option>
          <option value="interview">Interview 🤝</option>
          <option value="bc_check">BC Check 🛡️</option>
          <option value="hired">Hired 🎉</option>
          <option value="rejected">Rejected</option>
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
                      {getStageBadge(candidate)}
                    </td>

                    {/* Risk Score Column */}
                    <td className="px-6 py-4">
                      {getRiskScoreBadge(candidate)}
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onViewSession(candidate.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md text-xs font-semibold transition-colors"
                      >
                        <Eye size={14} />
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
