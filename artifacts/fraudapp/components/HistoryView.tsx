import React, { useState, useEffect } from 'react';
import {
  Search, FileText, Calendar, User, Briefcase, ChevronRight, Lock, Crown, Unlock,
  X, CreditCard, Loader2, TrendingUp, AlertTriangle, Clock, Filter, Eye, ArrowUpRight
} from 'lucide-react';
import { supabase, COLLECTIONS } from '../services/supabase';
import { InterviewSession, AssessmentInvite, CompanyProfile, SUBSCRIPTION_PLANS, CREDIT_COSTS, Job } from '../types';
import { calculateApplicationRanks, shouldBlurByApplicationRank, deductCredit, getCreditBalance } from '../services/creditManagement';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryViewProps {
  companyId: string;
  company?: CompanyProfile;
  onViewCandidate: (sessionId: string) => void;
  onUpgradeClick?: () => void;
}

interface CandidateHistory extends InterviewSession {
  assessmentCode?: string;
  riskScore?: number;
  recruitmentStage?: string;
  appliedAt?: string;
  jobTitle?: string;
  unlockedAt?: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({
  companyId,
  company,
  onViewCandidate,
  onUpgradeClick
}) => {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [applicationRanks, setApplicationRanks] = useState<Map<string, number>>(new Map());
  const [unlockedCandidates, setUnlockedCandidates] = useState<Set<string>>(new Set());
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedCandidateForUnlock, setSelectedCandidateForUnlock] = useState<CandidateHistory | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  // Freemium logic
  const isFreemium = company?.tier === 'Freemium';
  const viewLimit = SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit || 10;

  useEffect(() => {
    loadAllCandidates();
  }, [companyId]);

  const loadAllCandidates = async () => {
    try {
      setIsLoading(true);

      const [{ data: invitesData }, { data: jobsData }, { data: sessionsData }] = await Promise.all([
        supabase.from(COLLECTIONS.INVITES).select('*').eq('companyId', companyId),
        supabase.from(COLLECTIONS.JOBS).select('id, title').eq('companyId', companyId),
        supabase.from(COLLECTIONS.SESSIONS).select('*').eq('companyId', companyId).order('date', { ascending: false }),
      ]);

      const sessionToAccessCode: Record<string, string> = {};
      (invitesData || []).forEach((invite: AssessmentInvite) => {
        if (invite.sessionId) sessionToAccessCode[invite.sessionId] = invite.access_code;
      });

      const jobsMap = new Map<string, string>();
      (jobsData || []).forEach((j: { id: string; title: string }) => { jobsMap.set(j.id, j.title); });

      const allCandidates: CandidateHistory[] = (sessionsData || []).map((data: InterviewSession) => {
        const riskScore = data.analysis?.scores
          ? Math.round((data.analysis.scores.pressure + data.analysis.scores.opportunity + data.analysis.scores.rationalization) / 3)
          : 50;
        return {
          ...data,
          assessmentCode: sessionToAccessCode[data.id] || '-',
          riskScore,
          recruitmentStage: data.recruitmentStage || 'assessment_complete',
          appliedAt: data.date,
          jobTitle: data.jobId ? jobsMap.get(data.jobId) : undefined
        };
      });

      setCandidates(allCandidates);

      // Calculate application ranks
      const ranks = calculateApplicationRanks(allCandidates);
      setApplicationRanks(ranks);

      // Load unlocked candidates
      const unlockedIds = new Set<string>();
      allCandidates.forEach(c => {
        if (c.unlockedAt) {
          unlockedIds.add(c.id);
        }
      });
      setUnlockedCandidates(unlockedIds);
    } catch (error) {
      console.error('[HISTORY] Error loading candidates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockClick = async (candidate: CandidateHistory) => {
    const balance = await getCreditBalance(companyId);
    setCreditBalance(balance);
    setSelectedCandidateForUnlock(candidate);
    setShowUnlockModal(true);
  };

  const confirmUnlock = async () => {
    if (!selectedCandidateForUnlock) return;
    const unlockCost = CREDIT_COSTS.UNLOCK_PROFILE;

    if (creditBalance < unlockCost) {
      toast.error(`Credit insufficient. Need: ${unlockCost}, Available: ${creditBalance}`);
      setShowUnlockModal(false);
      return;
    }

    setIsUnlocking(true);
    try {
      const result = await deductCredit(
        companyId,
        unlockCost,
        'UNLOCK_PROFILE',
        `Unlock candidate: ${selectedCandidateForUnlock.candidate.name}`,
        {
          candidateId: selectedCandidateForUnlock.id,
          candidateName: selectedCandidateForUnlock.candidate.name,
          sessionId: selectedCandidateForUnlock.id
        }
      );

      if (result.success) {
        await supabase.from(COLLECTIONS.SESSIONS).update({
          unlockedAt: new Date().toISOString(),
          unlockedByCompanyId: companyId
        }).eq('id', selectedCandidateForUnlock.id);

        setUnlockedCandidates(prev => new Set([...prev, selectedCandidateForUnlock.id]));
        toast.success(`Candidate unlocked! Remaining credits: ${result.remainingCredits}`);
        setShowUnlockModal(false);
        onViewCandidate(selectedCandidateForUnlock.id);
      } else {
        toast.error(result.error || 'Failed to unlock');
      }
    } catch (error: any) {
      alert('Error unlocking candidate');
    } finally {
      setIsUnlocking(false);
      setSelectedCandidateForUnlock(null);
    }
  };

  // --- Insight Metrics ---
  const totalCandidates = candidates.length;
  const highRiskCandidates = candidates.filter(c => (c.riskScore || 0) >= 70).length;
  const hiredCandidates = candidates.filter(c => c.recruitmentStage === 'hired').length;
  const pendingReview = candidates.filter(c => c.recruitmentStage === 'assessment_complete' || c.recruitmentStage === 'pending_review').length;

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch =
      candidate.candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.candidate.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (candidate.assessmentCode && candidate.assessmentCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStage = filterStage === 'all' || candidate.recruitmentStage === filterStage;
    return matchesSearch && matchesStage;
  });

  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      if (diffInHours < 1) return 'Just now';
      return `${Math.floor(diffInHours)}h ago`;
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 text-[#D95D00] animate-spin" />
        <p className="text-slate-500 animate-pulse font-medium">Loading candidate insights...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">

      {/* 1. INSIGHT HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#D95D00]/50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-green-500 flex items-center gap-1 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> +12%
            </span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mt-4">Total Candidates</p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{totalCandidates}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-red-500/50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mt-4">High Risk</p>
            <h3 className="text-3xl font-extrabold text-red-600 dark:text-red-400 mt-1">{highRiskCandidates}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-orange-500/50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mt-4">Pending Review</p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{pendingReview}</h3>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#D95D00] to-[#b14d00] p-5 rounded-2xl shadow-lg shadow-orange-500/20 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4">
            <Crown className="w-24 h-24" />
          </div>
          <div className="flex items-start justify-between relative z-10">
            <div className="p-2 bg-white/20 rounded-lg text-white">
              <Crown className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mt-4">Hired This Month</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{hiredCandidates}</h3>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative min-h-[500px]">

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" /> All Activities
          </h3>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20 focus:border-[#D95D00] transition-all"
              />
            </div>
            <div className="relative">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:border-[#D95D00] cursor-pointer"
              >
                <option value="all">All Stages</option>
                <option value="assessment_complete">Assessment</option>
                <option value="interview">Interview</option>
                <option value="hired">Hired</option>
              </select>
              <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table List */}
        <div className="relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Risk Analysis</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Current Stage</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Active</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredCandidates.map((candidate, index) => {
                // Calculate rank based on index in FULL list (approx) or applicationRanks map
                const rank = applicationRanks.get(candidate.id) || 999;
                const isLocked = isFreemium && shouldBlurByApplicationRank(rank, 'Freemium') && !unlockedCandidates.has(candidate.id);

                return (
                  <tr
                    key={candidate.id}
                    className={cn(
                      "group transition-colors relative",
                      isLocked ? "bg-slate-50/50 dark:bg-slate-800/50" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    )}
                  // If locked, we don't want hover effect on row content except unlock actions
                  >
                    <td className={cn("px-6 py-4", isLocked && "blur-[6px] opacity-40 select-none")}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-500 font-bold border-2 border-white dark:border-slate-800 shadow-sm">
                          {candidate.candidate.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{candidate.candidate.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{candidate.jobTitle || candidate.candidate.role}</p>
                        </div>
                      </div>
                    </td>

                    <td className={cn("px-6 py-4", isLocked && "blur-[6px] opacity-40 select-none")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5", getRiskColor(candidate.riskScore || 50))}>
                          {(candidate.riskScore || 0) >= 70 && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                          )}
                          {candidate.riskScore}% Risk
                        </div>
                      </div>
                    </td>

                    <td className={cn("px-6 py-4", isLocked && "blur-[6px] opacity-40 select-none")}>
                      {(() => {
                        // New 8-stage recruitment workflow (matching CandidatesAutoView)
                        const RECRUITMENT_STAGES = [
                          { id: 'applied', label: 'Applied', progress: 10 },
                          { id: 'assessment_in_progress', label: 'Assessment In Progress', progress: 30 },
                          { id: 'awaiting_review', label: 'Awaiting Review', progress: 50 },
                          { id: 'interview', label: 'Interview Scheduled', progress: 60 },
                          { id: 'bc_check', label: 'Background Check', progress: 80 },
                          { id: 'bc_complete', label: 'Background Check Complete', progress: 90 },
                          { id: 'hired', label: 'Hired', progress: 100 },
                          { id: 'rejected', label: 'Rejected', progress: 100 }
                        ];

                        let stageId = (candidate.recruitmentStage || 'applied').toLowerCase().trim();

                        // Legacy mapping for backward compatibility
                        if (stageId === 'screening' || stageId === 'processing') stageId = 'applied';
                        if (stageId === 'review') stageId = 'awaiting_review';
                        if (stageId === 'background_check') stageId = 'bc_check';
                        if (stageId === 'approved') stageId = 'hired';

                        const stageConfig = RECRUITMENT_STAGES.find(s => s.id === stageId);
                        const label = stageConfig?.label || stageId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        const progress = stageConfig?.progress || 10;

                        return (
                          <div className="w-full max-w-[160px]">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                              <span>{label}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${stageId === 'rejected' ? 'bg-red-500' : 'bg-[#D95D00]'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    <td className={cn("px-6 py-4", isLocked && "blur-[6px] opacity-40 select-none")}>
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {getRelativeTime(candidate.date)}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right relative z-10">
                      {isLocked ? (
                        <button
                          onClick={() => handleUnlockClick(candidate)}
                          className="p-2 bg-white dark:bg-slate-700 shadow-lg rounded-full text-[#D95D00] border border-orange-100 hover:scale-110 transform duration-200"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onViewCandidate(candidate.id)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 shadow-sm"
                          >
                            <Eye className="w-3 h-3" /> Quick View
                          </button>
                          <button
                            onClick={() => onViewCandidate(candidate.id)}
                            className="p-1.5 bg-[#D95D00] text-white rounded-lg hover:bg-[#b14d00]"
                          >
                            <ChevronRight className="w-4 h-4 ml-0.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* --- FREEMIUM UPGRADE BANNER (ABSOLUTE POSITIONED OVER BLURRED AREA) --- */}
          {isFreemium && filteredCandidates.length > viewLimit && (
            <div
              className="absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center pointer-events-none"
              style={{ top: `${(viewLimit + 1) * 76}px` }} // Approximate row height calculation
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-1/2 transform -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-8 max-w-lg text-center pointer-events-auto"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30 transform rotate-3">
                  <Lock className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
                  {filteredCandidates.length - viewLimit} Kandidat Lagi Terkunci
                </h3>

                <p className="text-slate-500 dark:text-slate-400 mb-8 px-4 leading-relaxed">
                  Paket Freemium terbatas melihat <span className="font-bold text-slate-800 dark:text-slate-200">{viewLimit} kandidat pertama</span>.
                  Upgrade ke Premium untuk akses unlimited kandidat + fitur lengkap.
                </p>

                <button
                  onClick={() => onUpgradeClick && onUpgradeClick()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white font-bold text-lg shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                >
                  <Crown className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Upgrade ke Premium Sekarang
                </button>
              </motion.div>
            </div>
          )}

          {/* Full Frost Overlay covering the rest of the table */}
          {isFreemium && filteredCandidates.length > viewLimit && (
            <div
              className="absolute left-0 right-0 bottom-0 backdrop-blur-[4px] bg-white/30 dark:bg-black/30 z-10 pointer-events-none"
              style={{ top: `${(viewLimit * 76) + 60}px` }}
            />
          )}
        </div>

        {filteredCandidates.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No candidates found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* UNLOCK MODAL */}
      <AnimatePresence>
        {showUnlockModal && selectedCandidateForUnlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowUnlockModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative z-10 border border-slate-200 dark:border-slate-700"
            >
              <button
                onClick={() => setShowUnlockModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{selectedCandidateForUnlock.candidate.name}</h3>
                  <p className="text-sm text-slate-500">{selectedCandidateForUnlock.candidate.role}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Unlock Cost</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    {CREDIT_COSTS.UNLOCK_PROFILE} Credits
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-sm text-slate-500">Your Balance</span>
                  <span className={cn("font-bold flex items-center gap-1", creditBalance >= CREDIT_COSTS.UNLOCK_PROFILE ? "text-green-600" : "text-red-500")}>
                    {creditBalance} Credits
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnlockModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUnlock}
                  disabled={isUnlocking || creditBalance < CREDIT_COSTS.UNLOCK_PROFILE}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-[#D95D00] hover:bg-[#b14d00] shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
                >
                  {isUnlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                  Unlock Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default HistoryView;
