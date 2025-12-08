import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Users, FileText, Phone, Mail, MapPin, Calendar, Filter, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Video, Shield, AlertCircle, Clock, UserPlus, Briefcase, Eye, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { InterviewSession, Job, RiskLevel } from '../types';
import { db, COLLECTIONS, sendIntegrityTestInvitation } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface CandidatesReviewInviteProps {
  companyId: string;
  companyName?: string;
  onViewSession: (sessionId: string) => void;
}

interface ApplicationWithDetails extends Omit<InterviewSession, 'analysis'> {
  jobTitle?: string;
  jobLocation?: string;
  applicationStatus?: string;
  appliedAt?: string;
  applicationId?: string;
  recruitmentStage?: string;
  timeline?: TimelineItem[];
  completedAt?: string;
  analysis?: {
    riskLevel?: string;
    riskScore?: number;
    scores?: {
      pressure?: number;
      opportunity?: number;
      rationalization?: number;
    };
    summary?: string;
    redFlags?: string[];
    recommendation?: string;
  };
}

interface TimelineItem {
  stage: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  note?: string;
}

const CandidatesReviewInvite: React.FC<CandidatesReviewInviteProps> = ({ companyId, companyName = 'Company', onViewSession }) => {
  const toast = useToast();
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [completedCandidates, setCompletedCandidates] = useState<ApplicationWithDetails[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCompletedCandidates();
  }, [companyId]);

  const loadCompletedCandidates = async () => {
    try {
      setIsLoadingCompleted(true);
      console.log('[REVIEW-INVITE] Loading completed candidates from job_application (Instant OFF, now completed)...');

      // Query: Ambil kandidat dari job_application yang sudah complete test
      // Ini adalah kandidat yang tadinya pending_review, lalu diundang dan sudah complete
      const completedQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId),
        where('source', '==', 'job_application')
      );
      
      const completedSnapshot = await getDocs(completedQuery);
      
      // Filter: Ambil yang sudah ada analysis (sudah complete test) DAN tadinya dari pending_review
      // Tandanya: ada inviteSource field atau pernah ada status pending_review
      const completedSessions = completedSnapshot.docs.filter(doc => {
        const data = doc.data();
        // Hanya tampilkan yang sudah complete test (ada analysis) DAN berasal dari review invite flow
        return data.analysis && data.inviteSource === 'review_invite';
      });

      console.log('[REVIEW-INVITE] Found completed candidates from review invite flow:', completedSessions.length);

      if (completedSessions.length === 0) {
        setCompletedCandidates([]);
        setIsLoadingCompleted(false);
        return;
      }

      const candidatesWithDetails: ApplicationWithDetails[] = await Promise.all(
        completedSessions.map(async (docSnap) => {
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

          return {
            ...sessionData,
            jobTitle,
            jobLocation
          } as ApplicationWithDetails;
        })
      );

      candidatesWithDetails.sort((a, b) => {
        return new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime();
      });

      setCompletedCandidates(candidatesWithDetails);
      console.log('[REVIEW-INVITE] ✅ Total completed candidates loaded:', candidatesWithDetails.length);
    } catch (error) {
      console.error('[REVIEW-INVITE] Error loading completed candidates:', error);
    } finally {
      setIsLoadingCompleted(false);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[CANDIDATES-REVIEW] Loading data for company:', companyId);

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
      console.log('[CANDIDATES-REVIEW] Loaded jobs:', jobsData.length);

      const sessionsQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId),
        where('source', '==', 'job_application'),
        where('status', '==', 'pending_review')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      console.log('[CANDIDATES-REVIEW] Found sessions (pending_review):', sessionsSnapshot.docs.length);

      const applicationsWithDetails: ApplicationWithDetails[] = await Promise.all(
        sessionsSnapshot.docs.map(async (docSnap) => {
          const sessionData = { id: docSnap.id, ...docSnap.data() } as any;
          console.log('[CANDIDATES-REVIEW] Processing session:', docSnap.id, sessionData);

          let jobTitle = 'Unknown Position';
          let jobLocation = 'Unknown Location';
          let applicationStatus = 'Pending';
          let appliedAt = sessionData.date;
          let recruitmentStage = sessionData.recruitmentStage || 'application';
          let timeline = sessionData.timeline || [];

          if (sessionData.jobId) {
            const jobDoc = await getDoc(doc(db, COLLECTIONS.JOBS, sessionData.jobId));
            if (jobDoc.exists()) {
              const job = jobDoc.data();
              jobTitle = job.title;
              jobLocation = job.location;
            }
          }

          if (sessionData.applicationId) {
            const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, sessionData.applicationId));
            if (appDoc.exists()) {
              const app = appDoc.data();
              applicationStatus = app.status;
              appliedAt = app.appliedAt || sessionData.date;
            }
          }

          return {
            ...sessionData,
            jobTitle,
            jobLocation,
            applicationStatus,
            appliedAt,
            recruitmentStage,
            timeline
          } as ApplicationWithDetails;
        })
      );

      applicationsWithDetails.sort((a, b) =>
        new Date(b.appliedAt || b.date).getTime() - new Date(a.appliedAt || a.date).getTime()
      );

      setApplications(applicationsWithDetails);
      console.log('[JOB-APPLICATIONS] ✅ Total applications loaded:', applicationsWithDetails.length);
      console.log('[JOB-APPLICATIONS] Applications:', applicationsWithDetails);
    } catch (error) {
      console.error('[JOB-APPLICATIONS] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitation = async (app: ApplicationWithDetails) => {
    try {
      setSendingInvite(app.id);

      await sendIntegrityTestInvitation(
        app.candidate.name,
        app.candidate.email,
        companyName,
        app.jobTitle || 'Position',
        app.id
      );

      await updateRecruitmentStage(app.id, app.applicationId, 'integrity_test', 'Undangan test integritas telah dikirim via email');

      toast.success(`Undangan test berhasil dikirim ke ${app.candidate.email}`);
    } catch (error: any) {
      console.error('[SEND-INVITE] Error:', error);
      toast.error(`Gagal mengirim undangan: ${error.message}`);
    } finally {
      setSendingInvite(null);
    }
  };

  const updateRecruitmentStage = async (sessionId: string, applicationId: string | undefined, stage: string, note?: string) => {
    try {
      setUpdatingStatus(sessionId);

      const newTimelineItem: TimelineItem = {
        stage,
        status: 'completed',
        date: new Date().toISOString(),
        note
      };

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (sessionSnap.exists()) {
        const currentTimeline = sessionSnap.data().timeline || [];
        await updateDoc(sessionRef, {
          recruitmentStage: stage,
          timeline: [...currentTimeline, newTimelineItem]
        });
      }

      if (applicationId) {
        const appRef = doc(db, COLLECTIONS.APPLICATIONS, applicationId);
        await updateDoc(appRef, {
          status: stage === 'rejected' ? 'Rejected' : 'In Progress',
          lastUpdated: new Date().toISOString()
        });
      }

      await loadData();
    } catch (error) {
      console.error('[JOB-APPLICATIONS] Error updating stage:', error);
      toast.error('Gagal update status. Silakan coba lagi.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (selectedJob !== 'all' && app.jobId !== selectedJob) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'rejected' && app.recruitmentStage !== 'rejected') return false;
      if (statusFilter === 'active' && app.recruitmentStage === 'rejected') return false;
    }
    return true;
  });

  const filteredCompletedCandidates = completedCandidates.filter(candidate => {
    if (riskFilter !== 'all') {
      const risk = candidate.analysis?.riskLevel?.toLowerCase() || 'low';
      if (riskFilter !== risk) return false;
    }
    if (stageFilter !== 'all') {
      let stage = candidate.recruitmentStage || 'screening';
      if (stage === 'background_check') stage = 'bc_check';
      if (stage === 'approved') stage = 'hired';
      if (stageFilter !== stage) return false;
    }
    return true;
  });

  // Dashboard Stats
  const totalPending = applications.length;
  const totalCompleted = completedCandidates.length;
  const totalAll = totalPending + totalCompleted;
  
  const completedWithRisk = completedCandidates.filter(c => c.analysis?.riskLevel);
  const highRiskCount = completedWithRisk.filter(c => 
    ['high', 'critical'].includes(c.analysis?.riskLevel?.toLowerCase() || '')
  ).length;
  const mediumRiskCount = completedWithRisk.filter(c => 
    c.analysis?.riskLevel?.toLowerCase() === 'medium'
  ).length;
  const lowRiskCount = completedWithRisk.filter(c => 
    c.analysis?.riskLevel?.toLowerCase() === 'low'
  ).length;

  const inviteSentCount = applications.filter(a => 
    a.recruitmentStage && a.recruitmentStage !== 'pending_review'
  ).length;
  const pendingInviteCount = totalPending - inviteSentCount;

  const getRiskScoreBadge = (candidate: ApplicationWithDetails) => {
    const riskLevel = candidate.analysis?.riskLevel?.toLowerCase() || 'low';
    const riskScore = candidate.analysis?.riskScore || 0;

    const styles = {
      critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
    };

    const icons = {
      critical: AlertCircle,
      high: AlertTriangle,
      medium: AlertTriangle,
      low: CheckCircle2
    };

    const Icon = icons[riskLevel as keyof typeof icons] || CheckCircle2;
    const style = styles[riskLevel as keyof typeof styles] || styles.low;

    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${style}`}>
          <Icon size={14} />
          {candidate.analysis?.riskLevel || 'Low'}
        </span>
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {riskScore}%
        </span>
      </div>
    );
  };

  const getStageBadge = (candidate: ApplicationWithDetails) => {
    const recruitmentStage = candidate.recruitmentStage || 'screening';
    const stageMap: Record<string, { label: string; color: string }> = {
      'screening': {
        label: 'Screening',
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      },
      'review': {
        label: 'Review',
        color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
      },
      'interview': {
        label: 'Interview',
        color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
      },
      'bc_check': {
        label: 'BC Check',
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
      },
      'background_check': {
        label: 'BC Check',
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
      },
      'hired': {
        label: 'Hired',
        color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
      },
      'approved': {
        label: 'Hired',
        color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
      },
      'rejected': {
        label: 'Rejected',
        color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
      }
    };

    const stage = stageMap[recruitmentStage] || stageMap['screening'];

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-xs border ${stage.color}`}>
        {stage.label}
      </span>
    );
  };

  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageInfo = (stage?: string) => {
    switch (stage) {
      case 'application':
        return { label: 'Aplikasi Masuk', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FileText size={14} /> };
      case 'integrity_test':
        return { label: 'Test Integritas', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Shield size={14} /> };
      case 'interview_office':
        return { label: 'Interview Office', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Video size={14} /> };
      case 'kyc':
        return { label: 'KYC Process', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: <CheckCircle2 size={14} /> };
      case 'approved':
        return { label: 'Disetujui', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 size={14} /> };
      case 'rejected':
        return { label: 'Ditolak', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={14} /> };
      default:
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={14} /> };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D95D00]/10 rounded-xl">
              <ClipboardCheck className="text-[#D95D00]" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Review & Invite</h2>
              <p className="text-sm text-gray-500">Review CV kandidat dari portal (Instant OFF) dan undang untuk test</p>
            </div>
          </div>
          <button
            onClick={() => {
              loadData();
              loadCompletedCandidates();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* DASHBOARD STATISTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending Review */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalPending}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Menunggu review & undangan</p>
        </div>

        {/* Total Completed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Completed</span>
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalCompleted}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sudah selesai assessment</p>
        </div>

        {/* Invite Sent */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Mail size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Invited</span>
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{inviteSentCount}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Undangan sudah dikirim</p>
        </div>

        {/* High Risk Count */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">High Risk</span>
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{highRiskCount}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Kandidat berisiko tinggi</p>
        </div>
      </div>

      {/* Risk Distribution Chart */}
      {completedCandidates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#D95D00]" />
            Distribusi Risk Level
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{lowRiskCount}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Low Risk</p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${totalCompleted > 0 ? (lowRiskCount / totalCompleted * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{mediumRiskCount}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Medium Risk</p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${totalCompleted > 0 ? (mediumRiskCount / totalCompleted * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{highRiskCount}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">High Risk</p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${totalCompleted > 0 ? (highRiskCount / totalCompleted * 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD KANDIDAT YANG SUDAH COMPLETE */}
      {completedCandidates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Dashboard Kandidat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Kandidat yang sudah menyelesaikan assessment
              </p>
            </div>
            <div className="bg-white dark:bg-brand-slate-850 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
              <span className="text-2xl font-bold text-gray-800 dark:text-white">{filteredCompletedCandidates.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">Kandidat</span>
            </div>
          </div>

          <div className="bg-white dark:bg-brand-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-wrap gap-3">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white dark:bg-slate-800 dark:text-gray-200"
            >
              <option value="all">Semua Stage</option>
              <option value="screening">Screening</option>
              <option value="review">Review</option>
              <option value="interview">Interview</option>
              <option value="bc_check">BC Check</option>
              <option value="hired">Hired</option>
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

          {isLoadingCompleted ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading candidates...</p>
            </div>
          ) : filteredCompletedCandidates.length === 0 ? (
            <div className="bg-white dark:bg-brand-slate-850 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-12 text-center">
              <UserPlus className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-2">Tidak Ada Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Tidak ada kandidat yang sesuai dengan filter
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-brand-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Kandidat
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Posisi
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
                    {filteredCompletedCandidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
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
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                            <Briefcase size={14} className="text-brand-blue" />
                            {candidate.jobTitle}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={12} />
                            {candidate.jobLocation}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStageBadge(candidate)}
                        </td>
                        <td className="px-6 py-4">
                          {getRiskScoreBadge(candidate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => onViewSession(candidate.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
                          >
                            <Eye size={16} />
                            Lihat Detail
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
      )}

      {/* APLIKASI PENDING REVIEW */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Aplikasi Pending Review</h3>
            <p className="text-sm text-gray-500 mt-1">Kandidat yang menunggu untuk di-review dan diundang test</p>
          </div>
          <div className="bg-[#D95D00]/10 border border-[#D95D00]/20 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-[#D95D00]" />
              <span className="font-bold text-[#D95D00]">{filteredApplications.length}</span>
              <span className="text-sm text-gray-600">Aplikasi</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filter:</span>
          </div>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Posisi ({applications.length})</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({applications.filter(a => a.jobId === job.id).length})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 dark:text-gray-400 mb-2">Belum Ada Aplikasi</h3>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Aplikasi dari kandidat akan muncul di sini
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
                      Applied Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {filteredApplications.map((app) => {
              const stageInfo = getStageInfo(app.recruitmentStage);
              const isUpdating = updatingStatus === app.id;

              return (
                <tr
                  key={app.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {/* Candidate Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-orange to-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {getAvatarInitials(app.candidate.name)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {app.candidate.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {app.candidate.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Applied For Column */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {app.jobTitle}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin size={12} />
                      {app.jobLocation}
                    </div>
                  </td>

                  {/* Applied Date Column */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(app.appliedAt || app.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </td>

                  {/* Stage Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-xs border ${stageInfo.color}`}>
                      {stageInfo.icon}
                      {stageInfo.label}
                    </span>
                  </td>

                  {/* Action Column */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {app.recruitmentStage !== 'rejected' && app.recruitmentStage !== 'integrity_test' && (
                        <button
                          onClick={() => handleSendInvitation(app)}
                          disabled={sendingInvite === app.id || isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingInvite === app.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail size={14} />
                              Send Invite
                            </>
                          )}
                        </button>
                      )}

                      {app.recruitmentStage === 'integrity_test' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'interview_office', 'Kandidat diundang untuk interview office')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Video size={14} />
                          Interview
                        </button>
                      )}

                      {app.recruitmentStage === 'interview_office' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'kyc', 'Proses KYC dimulai')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 size={16} />
                          Proses KYC
                        </button>
                      )}

                      {app.recruitmentStage === 'kyc' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'approved', 'Kandidat disetujui')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </button>
                      )}

                      {app.recruitmentStage !== 'rejected' && app.recruitmentStage !== 'approved' && (
                        <button
                          onClick={() => updateRecruitmentStage(app.id, app.applicationId, 'rejected', 'Kandidat ditolak')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      )}

                      {app.cvUrl && (
                        <a
                          href={app.cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-colors"
                        >
                          <FileText size={14} />
                          CV
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
                  );})}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#D95D00]/10 to-[#F18F01]/10 border border-[#D95D00]/20 rounded-xl p-6">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Users size={20} className="text-[#D95D00]" />
          Alur Rekrutmen
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-700 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
            <FileText size={14} />
            <span className="font-medium">Aplikasi</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
            <Shield size={14} />
            <span className="font-medium">Test Integritas</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
            <Video size={14} />
            <span className="font-medium">Interview</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-full border border-cyan-200">
            <CheckCircle2 size={14} />
            <span className="font-medium">KYC</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
            <CheckCircle2 size={14} />
            <span className="font-medium">Approved</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidatesReviewInvite;
