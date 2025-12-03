import React, { useState, useEffect } from 'react';
import { Zap, Download, Eye, Mail, Phone, Filter, Loader2, FileText, AlertCircle, CheckCircle2, AlertTriangle, Briefcase, MapPin, Calendar, TrendingUp, Clock } from 'lucide-react';
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all duration-200 hover:border-brand-orange"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">{candidate.candidate.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <Briefcase size={14} />
                    <span>{candidate.jobTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-500">
                    <MapPin size={14} />
                    <span>{candidate.jobLocation}</span>
                  </div>
                </div>
                <div>
                  {getRiskBadge(candidate.analysis?.riskLevel)}
                </div>
              </div>

              <div className="mb-4 py-3 border-y border-gray-100 dark:border-slate-700 space-y-3">
                {candidate.status === 'completed' ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-brand-orange" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Score:</span>
                      <span className="text-lg font-bold text-brand-orange">{candidate.testScore || 0}/100</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar size={14} />
                      {new Date(candidate.completedAt || candidate.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Progress:</span>
                      <span className="text-brand-orange font-bold">{Math.round((candidate.currentQuestionIndex || 0) / (candidate.totalQuestions || 10) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
                      <div
                        className="bg-brand-orange h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((candidate.currentQuestionIndex || 0) / (candidate.totalQuestions || 10) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock size={12} />
                      <span>Sedang mengerjakan: {candidate.currentQuestionIndex || 0} / {candidate.totalQuestions || 10} pertanyaan</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <a
                  href={`mailto:${candidate.candidate.email}`}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-orange transition-colors"
                >
                  <Mail size={14} />
                  {candidate.candidate.email}
                </a>
                {candidate.whatsapp && (
                  <a
                    href={`https://wa.me/${candidate.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-orange transition-colors"
                  >
                    <Phone size={14} />
                    {candidate.whatsapp}
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadCV(candidate.cvUrl, candidate.candidate.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <FileText size={16} />
                  CV
                </button>
                <button
                  onClick={() => onViewSession(candidate.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <Eye size={16} />
                  Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidatesAutoView;
