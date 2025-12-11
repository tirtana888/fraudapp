import React, { useState, useEffect } from 'react';
import { Search, FileText, Calendar, User, Briefcase, ChevronRight, Lock, Crown, Unlock, X, CreditCard, Loader2 } from 'lucide-react';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { InterviewSession, AssessmentInvite, CompanyProfile, SUBSCRIPTION_PLANS, CREDIT_COSTS } from '../types';
import { calculateApplicationRanks, shouldBlurByApplicationRank, deductCredit, getCreditBalance } from '../services/creditManagement';
import { useToast } from './Toast';

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
  const viewLimit = SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit;

  useEffect(() => {
    loadAllCandidates();
  }, [companyId]);

  const loadAllCandidates = async () => {
    try {
      setIsLoading(true);

      const invitesRef = collection(db, COLLECTIONS.INVITES);
      const invitesQuery = query(invitesRef, where('companyId', '==', companyId));
      const invitesSnapshot = await getDocs(invitesQuery);

      const sessionToAccessCode: Record<string, string> = {};
      invitesSnapshot.forEach((doc) => {
        const invite = doc.data() as AssessmentInvite;
        if (invite.sessionId) {
          sessionToAccessCode[invite.sessionId] = invite.access_code;
        }
      });

      const sessionsRef = collection(db, COLLECTIONS.SESSIONS);
      const sessionsQuery = query(
        sessionsRef,
        where('companyId', '==', companyId),
        orderBy('date', 'desc')
      );

      const sessionsSnapshot = await getDocs(sessionsQuery);
      const allCandidates: CandidateHistory[] = [];

      console.log('[HISTORY] Loaded sessions from database:', sessionsSnapshot.size);

      sessionsSnapshot.forEach((doc) => {
        const data = doc.data() as InterviewSession;
        console.log('[HISTORY] Session:', doc.id, 'status:', data.status, 'stage:', data.recruitmentStage);

        const riskScore = data.analysis?.scores
          ? Math.round((data.analysis.scores.pressure + data.analysis.scores.opportunity + data.analysis.scores.rationalization) / 3)
          : 50;

        allCandidates.push({
          ...data,
          id: doc.id,
          assessmentCode: sessionToAccessCode[doc.id] || '-',
          riskScore,
          recruitmentStage: data.recruitmentStage || 'assessment_complete'
        });
      });

      setCandidates(allCandidates);

      // Calculate application ranks (based on apply date - oldest first = rank 1)
      const ranks = calculateApplicationRanks(allCandidates);
      setApplicationRanks(ranks);
      console.log('[HISTORY] Application ranks calculated:', ranks.size);

      // Load previously unlocked candidates from session data
      const unlockedIds = new Set<string>();
      allCandidates.forEach(c => {
        if ((c as any).unlockedAt) {
          unlockedIds.add(c.id);
        }
      });
      setUnlockedCandidates(unlockedIds);
      console.log('[HISTORY] Previously unlocked candidates:', unlockedIds.size);
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
      toast.error(`Kredit tidak cukup. Dibutuhkan: ${unlockCost}, Tersedia: ${creditBalance}`);
      setShowUnlockModal(false);
      return;
    }

    setIsUnlocking(true);
    try {
      const result = await deductCredit(
        companyId,
        unlockCost,
        'UNLOCK_PROFILE',
        `Unlock kandidat: ${selectedCandidateForUnlock.candidate.name}`,
        {
          candidateId: selectedCandidateForUnlock.id,
          candidateName: selectedCandidateForUnlock.candidate.name,
          sessionId: selectedCandidateForUnlock.id
        }
      );

      if (result.success) {
        // Save unlock status to Firestore
        const sessionRef = doc(db, COLLECTIONS.SESSIONS, selectedCandidateForUnlock.id);
        await updateDoc(sessionRef, {
          unlockedAt: new Date().toISOString(),
          unlockedByCompanyId: companyId
        });

        setUnlockedCandidates(prev => new Set([...prev, selectedCandidateForUnlock.id]));
        toast.success(`Kandidat ${selectedCandidateForUnlock.candidate.name} berhasil di-unlock! Sisa kredit: ${result.remainingCredits}`);
        setShowUnlockModal(false);
        onViewCandidate(selectedCandidateForUnlock.id);
      } else {
        toast.error(result.error || 'Gagal unlock kandidat');
      }
    } catch (error: any) {
      console.error('[UNLOCK] Error:', error);
      toast.error('Terjadi kesalahan saat unlock kandidat');
    } finally {
      setIsUnlocking(false);
      setSelectedCandidateForUnlock(null);
    }
  };

  const getStageLabel = (stage?: string) => {
    const stages: Record<string, string> = {
      'assessment_complete': 'Assessment Selesai',
      'interview_scheduled': 'Interview Dijadwalkan',
      'interview_completed': 'Interview Selesai',
      'background_check': 'Background Check',
      'offer_extended': 'Penawaran Dikirim',
      'hired': 'Diterima',
      'rejected': 'Ditolak',
      'pending_review': 'Perlu Review'
    };
    return stages[stage || 'assessment_complete'] || stage || 'Assessment Selesai';
  };

  const getStageColor = (stage?: string) => {
    const colors: Record<string, string> = {
      'assessment_complete': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30',
      'interview_scheduled': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30',
      'interview_completed': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/30',
      'background_check': 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/30',
      'offer_extended': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-900/30',
      'hired': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30',
      'rejected': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30',
      'pending_review': 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    };
    return colors[stage || 'assessment_complete'] || colors['assessment_complete'];
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/30';
    return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'Tinggi';
    if (score >= 50) return 'Sedang';
    return 'Rendah';
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch =
      candidate.candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.candidate.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (candidate.assessmentCode && candidate.assessmentCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStage = filterStage === 'all' || candidate.recruitmentStage === filterStage;

    return matchesSearch && matchesStage;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400">Memuat riwayat audit...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Unlock Confirmation Modal */}
      {showUnlockModal && selectedCandidateForUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Konfirmasi Unlock Kandidat</h3>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 flex items-center justify-center">
                  <User className="text-brand-orange" size={24} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{selectedCandidateForUnlock.candidate.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCandidateForUnlock.candidate.role || 'Unknown Position'}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="text-blue-600" size={20} />
                  <span className="font-semibold text-gray-800 dark:text-white">Biaya Unlock:</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{CREDIT_COSTS.UNLOCK_PROFILE} Credit</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Saldo Anda:</span>
                <span className={`font-bold ${creditBalance >= CREDIT_COSTS.UNLOCK_PROFILE ? 'text-green-600' : 'text-red-600'}`}>
                  {creditBalance} Credit
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Dengan menggunakan {CREDIT_COSTS.UNLOCK_PROFILE} credit, Anda akan mendapatkan akses penuh untuk melihat profil dan detail assessment kandidat ini.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUnlockModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmUnlock}
                disabled={isUnlocking || creditBalance < CREDIT_COSTS.UNLOCK_PROFILE}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-orange to-brand-blue text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Unlock size={18} />
                    Unlock Kandidat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Riwayat Audit</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total {filteredCandidates.length} kandidat dari {candidates.length} data
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari nama, posisi, atau kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent dark:bg-slate-800 dark:text-white text-sm w-full sm:w-64"
              />
            </div>

            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent dark:bg-slate-800 dark:text-white text-sm"
            >
              <option value="all">Semua Stage</option>
              <option value="assessment_complete">Assessment Selesai</option>
              <option value="interview_scheduled">Interview Dijadwalkan</option>
              <option value="interview_completed">Interview Selesai</option>
              <option value="background_check">Background Check</option>
              <option value="offer_extended">Penawaran Dikirim</option>
              <option value="hired">Diterima</option>
              <option value="rejected">Ditolak</option>
            </select>

            <button
              onClick={loadAllCandidates}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
            <FileText className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {searchQuery || filterStage !== 'all' ? 'Tidak ada data yang sesuai filter' : 'Belum ada riwayat audit'}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              {searchQuery || filterStage !== 'all' ? 'Coba ubah pencarian atau filter' : 'Data kandidat akan muncul di sini setelah assessment selesai'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Kandidat
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Kode Akses
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Tingkat Risiko
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Stage Proses
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredCandidates.map((candidate) => {
                      const rank = applicationRanks.get(candidate.id) || 999;
                      const isBlurred = shouldBlurByApplicationRank(rank, company?.tier || 'Freemium') && !unlockedCandidates.has(candidate.id);

                      return (
                        <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group relative">
                          <td className="px-6 py-4">
                            <div className={`flex items-center space-x-3 ${isBlurred ? 'blur-sm select-none pointer-events-none' : ''}`}>
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 flex items-center justify-center">
                                  <User className="text-brand-orange" size={20} />
                                </div>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-orange transition-colors">
                                  {candidate.candidate.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                  <Briefcase size={14} />
                                  {candidate.candidate.role || 'Posisi tidak disebutkan'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className={`px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-mono font-semibold ${isBlurred ? 'blur-sm select-none' : ''}`}>
                              {candidate.assessmentCode}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`flex items-center gap-2 ${isBlurred ? 'blur-sm select-none' : ''}`}>
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getRiskColor(candidate.riskScore || 50)}`}>
                                {getRiskLabel(candidate.riskScore || 50)}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {candidate.riskScore || 50}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${getStageColor(candidate.recruitmentStage)} ${isBlurred ? 'blur-sm select-none' : ''}`}>
                              <Calendar size={14} />
                              {getStageLabel(candidate.recruitmentStage)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isBlurred ? (
                              <button
                                onClick={() => handleUnlockClick(candidate)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium text-sm shadow-md hover:shadow-lg"
                              >
                                <Unlock size={16} />
                                Unlock (2 Credit)
                              </button>
                            ) : (
                              <button
                                onClick={() => onViewCandidate(candidate.id)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-all font-medium text-sm shadow-md hover:shadow-lg"
                              >
                                <FileText size={16} />
                                Lihat Laporan
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-4">
              {filteredCandidates.map((candidate) => {
                const rank = applicationRanks.get(candidate.id) || 999;
                const isBlurred = shouldBlurByApplicationRank(rank, company?.tier || 'Freemium') && !unlockedCandidates.has(candidate.id);

                return (
                  <div
                    key={candidate.id}
                    className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 space-y-4 relative"
                  >
                    <div className={`flex items-start justify-between ${isBlurred ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 flex items-center justify-center">
                            <User className="text-brand-orange" size={22} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">
                            {candidate.candidate.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Briefcase size={14} />
                            {candidate.candidate.role || 'Posisi tidak disebutkan'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 gap-3 ${isBlurred ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                          Kode Akses
                        </p>
                        <code className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono font-semibold inline-block">
                          {candidate.assessmentCode}
                        </code>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                          Tingkat Risiko
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getRiskColor(candidate.riskScore || 50)}`}>
                            {getRiskLabel(candidate.riskScore || 50)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {candidate.riskScore || 50}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={isBlurred ? 'blur-sm select-none pointer-events-none' : ''}>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Stage Proses
                      </p>
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${getStageColor(candidate.recruitmentStage)}`}>
                        <Calendar size={14} />
                        {getStageLabel(candidate.recruitmentStage)}
                      </span>
                    </div>

                    {isBlurred ? (
                      <button
                        onClick={() => handleUnlockClick(candidate)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium text-sm shadow-md active:scale-95"
                      >
                        <Unlock size={16} />
                        Unlock (2 Credit)
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onViewCandidate(candidate.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-all font-medium text-sm shadow-md active:scale-95"
                      >
                        <FileText size={16} />
                        Lihat Laporan
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upgrade Banner for Freemium Users */}
            {isFreemium && filteredCandidates.length > viewLimit && (
              <div className="mt-6 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-2 border-orange-300 dark:border-orange-700 rounded-2xl p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="bg-orange-500 text-white p-3 rounded-full">
                    <Lock size={32} />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {filteredCandidates.length - viewLimit} Kandidat Lagi Terkunci
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-1">
                  Paket Freemium terbatas melihat {viewLimit} kandidat pertama
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Upgrade ke Premium untuk akses unlimited kandidat + fitur lengkap
                </p>
                <button
                  onClick={() => onUpgradeClick && onUpgradeClick()}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Crown size={20} />
                  Upgrade ke Premium Sekarang
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default HistoryView;

