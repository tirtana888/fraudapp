import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Download, Eye, Mail, Phone, Filter, Loader2, FileText, AlertCircle,
  CheckCircle2, AlertTriangle, Briefcase, MapPin, Calendar, TrendingUp, Clock,
  User, Bot, Shield, Lock, Crown, Unlock, X, CreditCard, LayoutGrid, List,
  MoreHorizontal, ArrowRight, Search
} from 'lucide-react';
import { InterviewSession, Job, RiskLevel, SUBSCRIPTION_PLANS, CompanyProfile, CREDIT_COSTS } from '../types';
import { supabase, COLLECTIONS } from '../services/supabase';
import { useToast } from './Toast';
import { calculateAssessmentScores } from '../services/genai';
import { calculateApplicationRanks, shouldBlurByApplicationRank, deductCredit, getCreditBalance } from '../services/creditManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

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
  interviewEmailSent?: boolean;
  assessmentStarted?: boolean; // For detecting "Assessment In Progress" stage
  assessmentCompleted?: boolean; // For detecting when assessment is done
}

// -- CONSTANTS --
// New 8-stage recruitment workflow (matches stageTracker.ts)
const RECRUITMENT_STAGES = [
  { id: 'applied', label: 'Kandidat Apply', color: 'bg-blue-50 border-blue-200 text-blue-700', progress: 10 },
  { id: 'integrity_assessment', label: 'Integrity Assessment', color: 'bg-orange-50 border-orange-200 text-orange-700', progress: 30 },
  { id: 'assessment_completed', label: 'Need Review', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', progress: 50 },
  { id: 'interview', label: 'Wawancara Scheduled', color: 'bg-purple-50 border-purple-200 text-purple-700', progress: 60 },
  { id: 'background_check', label: 'Background Check Process', color: 'bg-indigo-50 border-indigo-200 text-indigo-700', progress: 75 },
  { id: 'bc_completed', label: 'Background Check Selesai', color: 'bg-teal-50 border-teal-200 text-teal-700', progress: 90 },
  { id: 'hired', label: 'Hire', color: 'bg-green-50 border-green-200 text-green-700', progress: 100 },
  { id: 'rejected', label: 'Tolak', color: 'bg-red-50 border-red-200 text-red-700', progress: 100 }
];
const CandidatesAutoView: React.FC<CandidatesAutoViewProps> = ({ companyId, onViewSession }) => {
  const toast = useToast();

  // -- DATA STATE --
  const [candidates, setCandidates] = useState<AutoCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [companyTier, setCompanyTier] = useState<'Freemium' | 'Premium'>('Freemium');
  const [applicationRanks, setApplicationRanks] = useState<Map<string, number>>(new Map());
  const [unlockedCandidates, setUnlockedCandidates] = useState<Set<string>>(new Set());

  // -- UI STATE --
  // viewMode state removed - forcing List View
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // -- MODALS STATE --
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedCandidateForUnlock, setSelectedCandidateForUnlock] = useState<AutoCandidate | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);




  useEffect(() => {
    setIsLoading(true);

    const fetchAll = async () => {
      const [{ data: jobsData }, { data: companyData }, { data: sessionsData }] = await Promise.all([
        supabase.from(COLLECTIONS.JOBS).select('*').eq('companyId', companyId),
        supabase.from(COLLECTIONS.COMPANIES).select('tier').eq('id', companyId).single(),
        supabase.from(COLLECTIONS.SESSIONS).select('*').eq('companyId', companyId),
      ]);

      setJobs((jobsData || []) as Job[]);
      if (companyData) {
        const tier = (companyData as { tier?: string }).tier;
        if (tier === 'Premium') setCompanyTier('Premium');
        else setCompanyTier('Freemium');
      }

      const filteredSessions = (sessionsData || []).filter(
        (d: { inviteSource?: string }) => !d.inviteSource
      );
      const candidatesData = filteredSessions.map((data: { completedAt?: string; date?: string }) => ({
        ...data, completedAt: data.completedAt || data.date
      } as AutoCandidate));

      candidatesData.sort((a: AutoCandidate, b: AutoCandidate) => {
        const dateA = new Date(a.completedAt || 0).getTime();
        const dateB = new Date(b.completedAt || 0).getTime();
        return dateB - dateA;
      });

      setApplicationRanks(calculateApplicationRanks(candidatesData));

      const unlocked = new Set<string>();
      candidatesData.forEach((c: AutoCandidate) => { if (c.unlockedAt) unlocked.add(c.id); });
      setUnlockedCandidates(unlocked);

      setCandidates(candidatesData);
      setIsLoading(false);
    };

    fetchAll();

    const channel = supabase
      .channel('auto-sessions-' + companyId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.SESSIONS, filter: `companyId=eq.${companyId}` }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  // Derived state to merge Job Titles properly whenever Candidates OR Jobs change
  const candidatesWithJobs = useMemo(() => {
    return candidates.map(c => {
      let jobTitle = 'Unknown';
      if (c.jobId) {
        const j = jobs.find(job => job.id === c.jobId);
        if (j) jobTitle = j.title;
      }
      return { ...c, jobTitle };
    });
  }, [candidates, jobs]);

  // -- HELPER: RISK SCORE & COLOR --
  const getRiskScore = (c: AutoCandidate): number | null => {
    // If no analysis exists, return null (Not Assessed)
    if (!c.analysis) return null;

    if (c.analysis.scores) {
      const { pressure = 0, opportunity = 0, rationalization = 0 } = c.analysis.scores;
      return Math.round((pressure + opportunity + rationalization) / 3);
    }
    const risk = c.analysis.riskLevel?.toLowerCase();
    if (risk === 'critical') return 90;
    if (risk === 'high') return 65;
    if (risk === 'medium') return 35;
    if (risk === 'low') return 10;

    return null;
  };

  const getRiskColor = (score: number | null) => {
    if (score === null) return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', hex: '#94a3b8' }; // Not Assessed (Gray)
    if (score <= 30) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', hex: '#22C55E' }; // Good
    if (score <= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', hex: '#EAB308' }; // Need Review
    if (score <= 80) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', hex: '#F97316' }; // Moderate
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', hex: '#EF4444' }; // High
  };

  // -- ACTIONS --
  // (Kanban drag-and-drop functions removed as List View is now the only view)


  const executeUnlock = async () => {
    if (!selectedCandidateForUnlock) return;
    const cost = CREDIT_COSTS.UNLOCK_PROFILE;
    const bal = await getCreditBalance(companyId);
    if (bal < cost) { toast.error('Credit tidak cukup'); return; }

    setIsUnlocking(true);
    // Simulate API call for brevity in this refactor, replacing with actual hook/service call
    const res = await deductCredit(companyId, cost, 'UNLOCK_PROFILE', `Unlock ${selectedCandidateForUnlock.candidate.name}`, { sessionId: selectedCandidateForUnlock.id, candidateName: selectedCandidateForUnlock.candidate.name });

    if (res.success) {
      await supabase.from(COLLECTIONS.SESSIONS).update({ unlockedAt: new Date().toISOString(), unlockedByCompanyId: companyId }).eq('id', selectedCandidateForUnlock.id);
      setUnlockedCandidates(prev => new Set([...prev, selectedCandidateForUnlock.id]));
      toast.success('Candidate Unlocked!');
      setShowUnlockModal(false);
      onViewSession(selectedCandidateForUnlock.id); // View details immediately
    } else {
      toast.error(res.error || 'Failed to unlock candidate');
    }
    setIsUnlocking(false);
  };

  // -- FILTERED DATA --
  const filteredCandidates = useMemo(() => {
    return candidatesWithJobs.filter(c => {
      const matchJob = selectedJob === 'all' || c.jobId === selectedJob;
      const matchSearch = c.candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchJob && matchSearch;
    });
  }, [candidatesWithJobs, selectedJob, searchQuery]);

  // -- METRICS --
  const metrics = useMemo(() => {
    return {
      total: candidates.length,
      screened: candidates.filter(c => c.recruitmentStage && c.recruitmentStage !== 'screening').length,
      interview: candidates.filter(c => c.recruitmentStage === 'interview').length,
      hired: candidates.filter(c => c.recruitmentStage === 'hired').length
    };
  }, [candidates]);

  const riskData = useMemo(() => {
    const critical = candidates.filter(c => c.analysis?.riskLevel === RiskLevel.CRITICAL).length;
    const high = candidates.filter(c => c.analysis?.riskLevel === RiskLevel.HIGH).length;
    const medium = candidates.filter(c => c.analysis?.riskLevel === RiskLevel.MEDIUM).length;
    const low = candidates.filter(c => c.analysis?.riskLevel === RiskLevel.LOW).length;
    return [
      { name: 'Critical', value: critical, color: '#EF4444' },
      { name: 'High', value: high, color: '#F97316' },
      { name: 'Medium', value: medium, color: '#EAB308' },
      { name: 'Low', value: low, color: '#22C55E' },
    ];
  }, [candidates]);

  if (isLoading) {
    return <div className="p-12 text-center text-slate-400">Loading Command Center...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* 1. PIPELINE FUNNEL HEADER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Applicants</div>
            <div className="text-3xl font-bold text-slate-800">{metrics.total}</div>
            <div className="text-xs text-blue-600 mt-2 font-medium flex items-center gap-1">
              <User size={12} /> Source Pool
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          {/* Connector Arrow */}
          <div className="hidden lg:block absolute -left-3 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-1 border border-slate-200 text-slate-300">
            <ArrowRight size={14} />
          </div>
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Screening Passed</div>
            <div className="text-3xl font-bold text-slate-800">{metrics.screened}</div>
            <div className="text-xs text-orange-600 mt-2 font-medium flex items-center gap-1">
              <Bot size={12} /> AI Filtered
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="hidden lg:block absolute -left-3 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-1 border border-slate-200 text-slate-300">
            <ArrowRight size={14} />
          </div>
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">In Interview</div>
            <div className="text-3xl font-bold text-slate-800">{metrics.interview}</div>
            <div className="text-xs text-purple-600 mt-2 font-medium flex items-center gap-1">
              <Calendar size={12} /> Scheduled
            </div>
          </div>
        </div>

        {/* RISK HEATMAP WIDGET */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg text-white relative overflow-hidden flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Risk Radar</div>
            <div className="text-sm text-slate-300 leading-tight">
              {(riskData.find(r => r.name === 'Low')?.value || 0)} Low Risk Candidates
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-slate-900"></div>
                <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-slate-900"></div>
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-slate-900"></div>
              </div>
              <span className="text-xs text-slate-400 font-medium">Health: Good</span>
            </div>
          </div>
          <div className="w-16 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskData} dataKey="value" cx="50%" cy="50%" innerRadius={15} outerRadius={30} paddingAngle={2}>
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. COMMAND BAR (Filters Only - View Toggle Removed) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D00]"
            />
          </div>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D00]"
          >
            <option value="all">All Jobs</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
      </div>

      {/* 3. MAIN CONTENT (List View Only) */}
      {filteredCandidates.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 opacity-75">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <User className="text-slate-300" size={32} />
          </div>
          <h3 className="font-bold text-slate-500">No candidates found</h3>
          <p className="text-sm text-slate-400">Waiting for applications...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Kandidat</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Risk Score</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Stage</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map(c => {
                const isLocked = shouldBlurByApplicationRank(applicationRanks.get(c.id) || 999, companyTier) && !unlockedCandidates.has(c.id);

                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => {
                    if (isLocked) {
                      setSelectedCandidateForUnlock(c); setShowUnlockModal(true);
                    } else {
                      onViewSession(c.id);
                    }
                  }}>
                    <td className="px-6 py-4 relative">
                      <div className={isLocked ? 'blur-[3px] select-none opacity-60' : ''}>
                        <div className="font-bold text-slate-800">{c.candidate.name}</div>
                      </div>
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock size={16} className="text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className={isLocked ? 'blur-[3px] select-none opacity-60' : ''}>
                        {c.jobTitle !== 'Unknown' ? c.jobTitle : c.candidate.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={isLocked ? 'blur-[3px] select-none opacity-60' : ''}>
                        {(() => {
                          const score = getRiskScore(c);
                          const color = getRiskColor(score);
                          return (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${color.bg} ${color.text}`}>
                              {score !== null ? `${score}/100` : 'Pending'}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={isLocked ? 'blur-[3px] select-none opacity-60' : ''}>
                        {(() => {
                          let stageId = (c.recruitmentStage || 'applied').toLowerCase().trim();

                          // Legacy mapping for backward compatibility with old data
                          if (stageId === 'screening' || stageId === 'processing') stageId = 'applied';
                          if (stageId === 'review' || stageId === 'awaiting_review') stageId = 'assessment_completed';
                          if (stageId === 'bc_check') stageId = 'background_check';
                          if (stageId === 'bc_complete') stageId = 'bc_completed';
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
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isLocked ? (
                        <button className="text-xs font-bold bg-[#D95D00]/10 text-[#D95D00] px-3 py-1.5 rounded-full flex items-center gap-1 ml-auto hover:bg-[#D95D00]/20 transition-colors">
                          <Unlock size={12} /> Unlock (2)
                        </button>
                      ) : (
                        <button className="text-[#D95D00] text-xs font-bold hover:underline">View Details</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      )}

      {/* --- UPGRADE BANNER (Sticky Bottom) --- */}
      {
        companyTier === 'Freemium' && (
          <div className="fixed bottom-4 left-64 right-4 bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-40 border border-slate-700">
            <div className="flex items-center gap-3">
              <Crown size={24} className="text-yellow-400" />
              <div>
                <div className="font-bold text-sm">Upgrade ke Premium untuk Unlimited Access</div>
                <div className="text-xs text-slate-400">Anda dibatasi melihat 10 kandidat pertama.</div>
              </div>
            </div>
            <button className="bg-[#D95D00] hover:bg-[#b14d00] px-4 py-2 rounded-lg text-xs font-bold transition-colors">
              Upgrade Now
            </button>
          </div>
        )
      }

      {/* --- MODALS --- */}

      {/* 1. CONFIRM MOVE MODAL */}


      {/* 2. UNLOCK MODAL */}
      {
        showUnlockModal && selectedCandidateForUnlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Unlock size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Unlock Candidate?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Buka profil lengkap <b>{selectedCandidateForUnlock.candidate.name}</b> dengan <b>{CREDIT_COSTS.UNLOCK_PROFILE} Credit</b>.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUnlockModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancel</button>
                <button onClick={executeUnlock} disabled={isUnlocking} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2">
                  {isUnlocking ? <Loader2 className="animate-spin" size={16} /> : 'Unlock Now'}
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default CandidatesAutoView;
