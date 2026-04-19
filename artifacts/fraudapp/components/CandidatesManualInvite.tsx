
import React, { useState, useEffect } from 'react';
import { UserPlus, Plus, Send, Copy, Loader2, CheckCircle2, AlertCircle, X, ChevronDown, Upload, MoreVertical, Trash2, RefreshCw, Eye, User, Briefcase, AlertTriangle, MapPin } from 'lucide-react';
import { blastAssessmentInvites, subscribeToInvites, resendCandidateInvite, deleteCandidateInvite, supabase, COLLECTIONS } from '../services/supabase';
import { CompanyProfile, AssessmentInvite, InterviewSession, RiskLevel } from '../types';
import { PLAN_LIMITS } from '../constants/plans';
import BulkUploadCandidates from './BulkUploadCandidates';
import { useToast } from './Toast';
import { calculateAssessmentScores } from '../services/genai';
import { deductCredit } from '../services/creditManagement';

interface CandidatesManualInviteProps {
  currentCompany: CompanyProfile;
  onViewSession?: (sessionId: string) => void;
}

interface CompletedCandidate extends InterviewSession {
  accessCode?: string;
  completedAt?: string;
}

const AVAILABLE_ROLES = [
  "Manajer Keuangan", "Staff Pengadaan (Procurement)", "Kepala Gudang / Logistik",
  "Sales Manager / Tim Sales", "Kasir Senior", "Internal Auditor", "Staff Administrasi", "IT / System Admin", "Lainnya"
];

const CandidatesManualInvite: React.FC<CandidatesManualInviteProps> = ({ currentCompany, onViewSession }) => {
  const toast = useToast();
  const [candidates, setCandidates] = useState<{ name: string; email: string; role: string }[]>([
    { name: '', email: '', role: '' }
  ]);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  const [completedCandidates, setCompletedCandidates] = useState<CompletedCandidate[]>([]);

  // UI States
  const [isSending, setIsSending] = useState(false);
  const [blastStatus, setBlastStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  useEffect(() => {
    if (currentCompany?.id) {
      const unsubscribe = subscribeToInvites(currentCompany.id, (data) => {
        setInvites(data);
        loadCompletedCandidates(data);
      });
      return () => unsubscribe();
    }
  }, [currentCompany?.id]);

  const loadCompletedCandidates = async (invitesData: AssessmentInvite[]) => {
    try {
      setIsLoadingCompleted(true);
      console.log('[MANUAL-INVITE] Loading completed candidates...');

      const completedInvites = invitesData.filter(inv => inv.status === 'COMPLETED' && inv.sessionId);

      if (completedInvites.length === 0) {
        setCompletedCandidates([]);
        setIsLoadingCompleted(false);
        return;
      }

      const candidatesWithDetails: (CompletedCandidate | null)[] = await Promise.all(
        completedInvites.map(async (invite) => {
          try {
            const { data: sessionDoc } = await supabase.from(COLLECTIONS.SESSIONS).select('*').eq('id', invite.sessionId!).single();
            if (sessionDoc) {
              const sessionData = sessionDoc as unknown as InterviewSession;

              // 🔧 FIX: Exclude job applications (auto sourcing)
              // Only show manual invites and public link assessments
              if (sessionData.source === 'job_application') {
                console.log('[MANUAL-INVITE] ⏭️ Skipping job application session:', sessionData.id);
                return null;
              }

              return {
                ...sessionData,
                accessCode: invite.access_code
              } as CompletedCandidate;
            }
            return null;
          } catch (error) {
            console.error('[MANUAL-INVITE] Error fetching session:', invite.sessionId, error);
            return null;
          }
        })
      );

      const validCandidates = candidatesWithDetails.filter(c => c !== null) as CompletedCandidate[];

      validCandidates.sort((a, b) => {
        return new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime();
      });

      setCompletedCandidates(validCandidates);
      console.log('[MANUAL-INVITE] ✅ Loaded completed candidates (excluding job applications):', validCandidates.length);
    } catch (error) {
      console.error('[MANUAL-INVITE] Error loading completed candidates:', error);
    } finally {
      setIsLoadingCompleted(false);
    }
  };

  const handleAddRow = () => {
    setCandidates([...candidates, { name: '', email: '', role: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (candidates.length <= 1) return;
    const newArr = [...candidates];
    newArr.splice(index, 1);
    setCandidates(newArr);
  };

  const handleChange = (index: number, field: string, value: string) => {
    const newArr = [...candidates];
    (newArr[index] as any)[field] = value;
    setCandidates(newArr);
  };

  const handleResendInvite = async (inviteId: string) => {
    if (actionLoading) return;

    setActionLoading(true);
    try {
      // Find the invite to get candidate name
      const invite = invites.find(inv => inv.id === inviteId);

      // Deduct 2 credits for resending invite
      const deductionResult = await deductCredit(
        currentCompany.id,
        2,
        'RESEND_INVITE',
        `Kirim ulang undangan - ${invite?.name || 'Kandidat'}`,
        { candidateName: invite?.name }
      );

      if (!deductionResult.success) {
        toast.error(deductionResult.error || 'Gagal kirim ulang - Kredit tidak cukup');
        setActionLoading(false);
        setActiveMenuId(null);
        return;
      }

      const result = await resendCandidateInvite(inviteId, currentCompany.name);
      if (result.success) {
        toast.success(`${result.message} (2 kredit digunakan, sisa: ${deductionResult.remainingCredits})`);
      } else {
        toast.error(`${result.message}`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
      setActiveMenuId(null);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (actionLoading) return;

    const confirmed = await toast.confirm({
      title: "Hapus Kandidat",
      message: "Apakah Anda yakin ingin menghapus kandidat ini? Data tidak dapat dikembalikan.",
      confirmText: "Hapus",
      cancelText: "Batal",
      type: "danger"
    });

    if (!confirmed) {
      setActiveMenuId(null);
      return;
    }

    setActionLoading(true);
    try {
      const result = await deleteCandidateInvite(inviteId);
      if (result.success) {
        toast.success(` ${result.message}`);
      } else {
        toast.error(` ${result.message}`);
      }
    } catch (error: any) {
      toast.error(` Error: ${error.message}`);
    } finally {
      setActionLoading(false);
      setActiveMenuId(null);
    }
  };

  const handleSendBlast = async () => {
    setIsSending(true);
    setBlastStatus('idle');
    setStatusMessage('Memvalidasi data...');

    try {
      console.log("Attempting to send blast...");

      if (!currentCompany || !currentCompany.id) {
        throw new Error("Profil perusahaan tidak termuat. Silakan refresh halaman.");
      }

      const planFeatures = currentCompany?.tier && PLAN_LIMITS[currentCompany.tier]
        ? PLAN_LIMITS[currentCompany.tier]
        : PLAN_LIMITS['Freemium'];
      if (planFeatures?.allow_permanent_link !== true) {
        throw new Error("Fitur undangan massal hanya tersedia untuk paket Premium/Enterprise.");
      }

      const validCandidates = candidates.filter(c => c.name.trim() && c.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));

      if (validCandidates.length === 0) {
        throw new Error("Mohon isi minimal Nama dan Email yang valid untuk satu kandidat.");
      }

      setStatusMessage(`Mengirim ${validCandidates.length} undangan...`);

      const result = await blastAssessmentInvites(validCandidates, currentCompany.id, currentCompany.name);

      if (result.success > 0) {
        setBlastStatus('success');
        setStatusMessage(`✅ ${result.success} email undangan berhasil dikirim! ${result.failed > 0 ? `❌ ${result.failed} gagal dikirim.` : ''}`);
        setCandidates([{ name: '', email: '', role: '' }]);
      } else {
        throw new Error(`Gagal mengirim undangan. ${result.failed} kandidat gagal. Periksa konfigurasi Firebase Functions.`);
      }
    } catch (error: any) {
      console.error("Blast sending failed:", error);
      setBlastStatus('error');
      setStatusMessage(error.message || "Terjadi kesalahan tak terduga.");
    } finally {
      setIsSending(false);
      console.log("Process finished. Button unlocked.");

      setTimeout(() => {
        setBlastStatus('idle');
        setStatusMessage('');
      }, 8000);
    }
  };

  const calculateRiskScore = (candidate: CompletedCandidate): number => {
    if (candidate.analysis?.scores) {
      const { pressure = 0, opportunity = 0, rationalization = 0 } = candidate.analysis.scores;
      return Math.round((pressure + opportunity + rationalization) / 3);
    }

    if (candidate.structuredAssessment && candidate.structuredAssessment.length > 0) {
      const scores = calculateAssessmentScores(
        candidate.structuredAssessment,
        candidate.sjtResults || [],
        candidate.financialStrainResults || []
      );
      return Math.round((scores.pressureScore + scores.opportunityScore + scores.rationalizationScore) / 3);
    }

    if (candidate.analysis?.riskLevel) {
      const riskLevel = candidate.analysis.riskLevel.toLowerCase();
      if (riskLevel === 'critical') return 90;
      if (riskLevel === 'high') return 65;
      if (riskLevel === 'medium') return 35;
      if (riskLevel === 'low') return 10;
    }

    return 0;
  };

  const getRiskScoreBadge = (candidate: CompletedCandidate) => {
    if (!candidate.analysis) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold text-xs">
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

  const getStageBadge = (candidate: CompletedCandidate) => {
    const recruitmentStage = candidate.recruitmentStage || 'screening';

    const stageMap: { [key: string]: { label: string; color: string } } = {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" onClick={() => setActiveMenuId(null)}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <UserPlus className="text-brand-orange" size={28} /> Manual Invite
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kirim undangan test dengan Access Code unik ke kandidat dari berbagai sumber
          </p>
        </div>
        <button
          onClick={() => setIsBulkUploadOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2 hover:scale-105"
        >
          <Upload size={20} />
          Upload Bulk Excel/CSV
        </button>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700 dark:text-gray-200">Input Data Kandidat</h3>
          <button onClick={handleAddRow} className="text-sm text-brand-blue font-bold hover:underline flex items-center gap-1">
            <Plus size={16} /> Tambah Baris
          </button>
        </div>

        <div className="space-y-3">
          {candidates.map((c, idx) => (
            <div key={idx} className="flex flex-col md:flex-row gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {idx + 1}
              </div>
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={c.name}
                onChange={(e) => handleChange(idx, 'name', e.target.value)}
                className="flex-1 w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <input
                type="email"
                placeholder="Email"
                value={c.email}
                onChange={(e) => handleChange(idx, 'email', e.target.value)}
                className="flex-1 w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <div className="relative w-full md:w-1/3">
                <select
                  value={c.role}
                  onChange={(e) => handleChange(idx, 'role', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue appearance-none"
                >
                  <option value="">Pilih Posisi (Opsional)</option>
                  {AVAILABLE_ROLES.map((role, rIdx) => (
                    <option key={rIdx} value={role}>{role}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
              </div>

              {candidates.length > 1 && (
                <button onClick={() => handleRemoveRow(idx)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col md:flex-row justify-between gap-3 items-center">
          {/* STATUS MESSAGE */}
          <div className="w-full md:w-auto">
            {statusMessage && (
              <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 w-full animate-in fade-in ${blastStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                  blastStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                {blastStatus === 'success' ? <CheckCircle2 size={16} /> :
                  blastStatus === 'error' ? <AlertCircle size={16} /> :
                    <Loader2 size={16} className="animate-spin" />}
                {statusMessage}
              </div>
            )}
          </div>

          <button
            onClick={handleSendBlast}
            disabled={isSending}
            className={`w-full md:w-auto text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSending ? 'bg-gray-400' : 'bg-brand-orange hover:bg-orange-700 hover:shadow-xl'
              }`}
          >
            {isSending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            {isSending ? 'Memproses...' : 'Kirim Undangan Massal'}
          </button>
        </div>
      </div>

      {/* COMPLETED CANDIDATES DASHBOARD */}
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
                        Kode Akses
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
                              {candidate.candidate.role && (
                                <div className="text-xs text-brand-blue font-medium flex items-center gap-1 mt-0.5">
                                  <Briefcase size={10} />
                                  {candidate.candidate.role}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-mono font-semibold">
                            {candidate.accessCode || '-'}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          {getStageBadge(candidate)}
                        </td>
                        <td className="px-6 py-4">
                          {getRiskScoreBadge(candidate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {onViewSession && (
                            <button
                              onClick={() => onViewSession(candidate.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-md text-xs font-semibold transition-colors"
                            >
                              <Eye size={14} />
                              View
                            </button>
                          )}
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

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <BulkUploadCandidates
          companyId={currentCompany.id}
          companyName={currentCompany.name}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {
            setIsBulkUploadOpen(false);
          }}
        />
      )}

    </div>
  );
};

export default CandidatesManualInvite;
