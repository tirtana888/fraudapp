import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Shield, Bot, DollarSign, Radar, Activity, MessageSquare, User, Scan, Globe, Wifi, Smartphone, Info } from 'lucide-react';
import { InterviewSession } from '../types';
import { db, COLLECTIONS, functions } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './Toast';
import CandidateActivityTimeline from './CandidateActivityTimeline';

interface CandidateDetailProps {
  sessionId: string;
  onBack: () => void;
}

interface CandidateData extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  riskScore?: number;
  fraudTriangle?: {
    pressure: number;
    opportunity: number;
    rationalization: number;
  };
  financialStrain?: number;
  verificationStatus?: {
    email: boolean;
    phone: boolean;
    documents: 'pending' | 'verified' | 'failed';
  };
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ sessionId, onBack }) => {
  const toast = useToast();
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'integrity' | 'interview' | 'background' | 'activity'>('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  const [companyTier, setCompanyTier] = useState<'Basic' | 'Premium' | 'Enterprise'>('Basic');

  useEffect(() => {
    loadCandidateData();
  }, [sessionId]);

  const loadCandidateData = async () => {
    try {
      setIsLoading(true);

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        console.error('Session not found');
        return;
      }

      const sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as any;

      if (sessionData.companyId) {
        try {
          const companyRef = doc(db, COLLECTIONS.COMPANIES, sessionData.companyId);
          const companySnap = await getDoc(companyRef);
          if (companySnap.exists()) {
            const companyData = companySnap.data();
            setCompanyTier(companyData.tier || 'Basic');
          }
        } catch (error) {
          console.error('Error fetching company:', error);
        }
      }

      let jobTitle = 'Direct Application';
      let jobLocation = 'Not specified';

      if (sessionData.jobId) {
        try {
          const jobRef = doc(db, COLLECTIONS.JOBS, sessionData.jobId);
          const jobSnap = await getDoc(jobRef);
          if (jobSnap.exists()) {
            const jobData = jobSnap.data();
            jobTitle = jobData.title;
            jobLocation = jobData.location;
          }
        } catch (error) {
          console.error('Error fetching job:', error);
        }
      }

      const riskScore = calculateRiskScore(sessionData);

      const fraudTriangle = sessionData.analysis?.scores ? {
        pressure: sessionData.analysis.scores.pressure || 0,
        opportunity: sessionData.analysis.scores.opportunity || 0,
        rationalization: sessionData.analysis.scores.rationalization || 0
      } : {
        pressure: 0,
        opportunity: 0,
        rationalization: 0
      };

      const financialStrain = sessionData.analysis?.scores?.pressure || 0;

      const verificationStatus = sessionData.verificationStatus || {
        email: true,
        phone: true,
        documents: 'pending' as const
      };

      setCandidate({
        ...sessionData,
        jobTitle,
        jobLocation,
        riskScore,
        fraudTriangle,
        financialStrain,
        verificationStatus
      });
    } catch (error) {
      console.error('[CANDIDATE-DETAIL] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRiskScore = (session: any): number => {
    if (!session.analysis?.scores) {
      if (session.analysis?.riskLevel === 'CRITICAL') return 90;
      if (session.analysis?.riskLevel === 'HIGH') return 65;
      if (session.analysis?.riskLevel === 'MEDIUM') return 35;
      if (session.analysis?.riskLevel === 'LOW') return 10;
      return 0;
    }

    const { pressure = 0, opportunity = 0, rationalization = 0 } = session.analysis.scores;
    const avgScore = Math.round((pressure + opportunity + rationalization) / 3);
    return avgScore;
  };

  const getWorkflowOrder = () => {
    return ['screening', 'processing', 'interview', 'bc_check', 'background_check', 'hired', 'approved'];
  };

  const canMoveToStage = (currentStage: string, targetStage: string): boolean => {
    // HR has full control - they make the final decision regardless of risk score
    if (targetStage === 'rejected') return true;

    const stage = currentStage || 'screening';

    // Interview: Always allowed from screening, processing, or review stages
    if (targetStage === 'interview') {
      return ['screening', 'processing', 'review'].includes(stage);
    }

    // Background Check: Can be done after interview or directly if HR decides
    if (targetStage === 'bc_check' || targetStage === 'background_check') {
      return ['interview', 'processing', 'screening', 'review'].includes(stage);
    }

    // Hired/Approved: Should have at least completed screening/assessment
    if (targetStage === 'hired' || targetStage === 'approved') {
      return !['screening'].includes(stage);
    }

    return true;
  };

  const isBackgroundCheckAvailable = (): boolean => {
    return companyTier === 'Premium' || companyTier === 'Enterprise';
  };

  const getStageButtonConfig = (currentStage: string) => {
    const normalizedStage = currentStage || 'screening';

    return {
      interview: {
        enabled: canMoveToStage(normalizedStage, 'interview'),
        tooltip: !canMoveToStage(normalizedStage, 'interview')
          ? 'Lanjutkan kandidat ke tahap wawancara'
          : 'Lanjutkan ke tahap wawancara'
      },
      bc_check: {
        enabled: canMoveToStage(normalizedStage, 'bc_check') && isBackgroundCheckAvailable(),
        tooltip: !isBackgroundCheckAvailable()
          ? 'Upgrade ke Premium atau Enterprise untuk menggunakan Background Check'
          : !canMoveToStage(normalizedStage, 'bc_check')
          ? 'Lakukan background check'
          : 'Mulai background check verification'
      },
      hired: {
        enabled: canMoveToStage(normalizedStage, 'hired'),
        tooltip: !canMoveToStage(normalizedStage, 'hired')
          ? 'Kandidat perlu menyelesaikan assessment terlebih dahulu'
          : 'Terima kandidat dan mark sebagai hired'
      },
      rejected: {
        enabled: true,
        tooltip: ''
      }
    };
  };

  const handleStatusUpdate = async (newStage: string) => {
    if (!candidate) return;

    const currentStage = candidate.recruitmentStage || 'screening';

    if (newStage !== 'rejected' && !canMoveToStage(currentStage, newStage)) {
      toast.error('Tidak dapat melompat tahap! Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }

    if (newStage === 'bc_check' && !isBackgroundCheckAvailable()) {
      toast.error('Background Check hanya tersedia untuk tier Premium dan Enterprise. Silakan upgrade paket Anda.');
      return;
    }

    try {
      setIsUpdating(true);

      if (newStage === 'bc_check') {
        const initiateBackgroundCheck = httpsCallable(functions, 'initiateBackgroundCheck');

        const result = await initiateBackgroundCheck({ sessionId });
        const data = result.data as { success: boolean; message: string };

        if (data.success) {
          toast.success('Email undangan Background Check berhasil dikirim!');
          await loadCandidateData();
        } else {
          throw new Error(data.message || 'Failed to initiate background check');
        }
      } else {
        const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
        const now = new Date().toISOString();

        const existingTimeline = candidate.timeline || [];
        const updatedTimeline = [
          ...existingTimeline.map(event => ({
            ...event,
            status: event.status === 'current' ? 'completed' as const : event.status
          })),
          {
            stage: newStage,
            status: (newStage === 'rejected' || newStage === 'hired' || newStage === 'approved') ? 'completed' as const : 'current' as const,
            date: now,
            note: getStageNote(newStage, candidate.candidate.name)
          }
        ];

        await updateDoc(sessionRef, {
          recruitmentStage: newStage,
          timeline: updatedTimeline,
          updatedAt: now
        });

        await loadCandidateData();

        const stageLabels: { [key: string]: string } = {
          'interview': 'Wawancara',
          'hired': 'Rekrut',
          'rejected': 'Ditolak',
          'bc_check': 'Background Check',
          'background_check': 'Background Check'
        };

        toast.success(`Status kandidat diupdate ke: ${stageLabels[newStage] || newStage}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengupdate status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStageNote = (stage: string, candidateName: string): string => {
    const noteMap: { [key: string]: string } = {
      'interview': `${candidateName} dipanggil untuk tahap wawancara`,
      'bc_check': `Background check dimulai untuk ${candidateName}`,
      'background_check': `Background check dimulai untuk ${candidateName}`,
      'hired': `${candidateName} diterima dan hired`,
      'approved': `${candidateName} diterima dan hired`,
      'rejected': `${candidateName} ditolak dari proses rekrutmen`
    };
    return noteMap[stage] || `Status diupdate ke ${stage}`;
  };

  const getStatusBadge = () => {
    if (!candidate) return null;

    const stage = candidate.recruitmentStage || 'screening';
    const statusMap: { [key: string]: { label: string; color: string; icon: JSX.Element } } = {
      'screening': {
        label: 'Screening 🤖',
        color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        icon: <Bot size={12} />
      },
      'review': {
        label: 'Review 📋',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
        icon: <FileText size={12} />
      },
      'interview': {
        label: 'Interview 🤝',
        color: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        icon: <User size={12} />
      },
      'bc_check': {
        label: 'BC Check 🛡️',
        color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        icon: <Shield size={12} />
      },
      'hired': {
        label: 'Hired 🎉',
        color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
        icon: <CheckCircle2 size={12} />
      },
      'rejected': {
        label: 'Rejected',
        color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        icon: <XCircle size={12} />
      },
      'processing': {
        label: 'Screening 🤖',
        color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        icon: <Bot size={12} />
      },
      'background_check': {
        label: 'BC Check 🛡️',
        color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        icon: <Shield size={12} />
      },
      'approved': {
        label: 'Hired 🎉',
        color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
        icon: <CheckCircle2 size={12} />
      }
    };

    return statusMap[stage] || statusMap['screening'];
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return 'text-green-600';
    if (score <= 50) return 'text-yellow-600';
    return 'text-[#D95D00]';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProgressBarColor = (value: number) => {
    if (value <= 30) return 'bg-green-500';
    if (value <= 60) return 'bg-yellow-500';
    return 'bg-[#D95D00]';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat detail kandidat...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-20">
        <AlertTriangle size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Kandidat Tidak Ditemukan</h3>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
        >
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Kembali ke Kandidat</span>
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#D95D00]/10 flex items-center justify-center text-[#D95D00] font-bold text-xl">
                {getInitials(candidate.candidate.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{candidate.candidate.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} />
                    {candidate.jobTitle}
                  </span>
                  {candidate.jobLocation && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      {candidate.jobLocation}
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Progress Stepper */}
          <div className="mt-6 mb-2">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              {[
                { id: 'screening', label: 'Aplikasi', icon: FileText, stage: 'screening' },
                { id: 'review', label: 'Test Integritas', icon: Shield, stage: 'review' },
                { id: 'interview', label: 'Interview', icon: User, stage: 'interview' },
                { id: 'bc_check', label: 'KYC', icon: Scan, stage: 'bc_check' },
                { id: 'hired', label: 'Approved', icon: CheckCircle2, stage: 'hired' }
              ].map((step, index, array) => {
                const currentStage = candidate.recruitmentStage || 'screening';
                const isActive = currentStage === step.id ||
                  (step.id === 'screening' && (currentStage === 'processing' || currentStage === 'screening')) ||
                  (step.id === 'hired' && currentStage === 'approved') ||
                  (step.id === 'review' && currentStage === 'processing');
                const StepIcon = step.icon;
                const buttonConfig = getStageButtonConfig(currentStage);

                // Determine if clickable based on stage and current status
                const isClickable = candidate.recruitmentStage !== 'rejected' &&
                                   candidate.recruitmentStage !== 'approved' &&
                                   candidate.recruitmentStage !== 'hired' &&
                                   !isActive &&
                                   ((step.stage === 'interview' && buttonConfig.interview.enabled) ||
                                    (step.stage === 'bc_check' && buttonConfig.bc_check.enabled) ||
                                    (step.stage === 'hired' && buttonConfig.hired.enabled));

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => isClickable ? handleStatusUpdate(step.stage) : null}
                        disabled={isUpdating || !isClickable}
                        className={`
                          w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
                          ${isActive
                            ? 'bg-[#D95D00] border-[#D95D00] text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-slate-800 dark:border-slate-600'
                          }
                          ${isClickable ? 'cursor-pointer hover:border-[#D95D00] hover:bg-orange-50' : 'cursor-default'}
                          disabled:opacity-50
                        `}
                        title={
                          step.stage === 'bc_check' && !isBackgroundCheckAvailable()
                            ? 'Upgrade ke Premium/Enterprise untuk Background Check'
                            : isClickable
                            ? `Klik untuk pindah ke ${step.label}`
                            : ''
                        }
                      >
                        <StepIcon size={20} />
                      </button>
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        isActive ? 'text-[#D95D00] font-bold' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {index < array.length - 1 && (
                      <div className="flex-1 h-0.5 bg-gray-300 dark:bg-slate-600 mx-2 mt-[-20px]"></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Action Buttons */}
            {candidate.recruitmentStage !== 'rejected' && candidate.recruitmentStage !== 'approved' && candidate.recruitmentStage !== 'hired' && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => handleStatusUpdate('rejected')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} />
                  Tolak
                </button>
                <button
                  onClick={() => handleStatusUpdate('hired')}
                  disabled={isUpdating || !getStageButtonConfig(candidate.recruitmentStage || 'screening').hired.enabled}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  title={getStageButtonConfig(candidate.recruitmentStage || 'screening').hired.tooltip}
                >
                  <CheckCircle2 size={16} />
                  Rekrut
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 mt-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              CV & Dokumen
            </button>
            <button
              onClick={() => setActiveTab('integrity')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'integrity'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Laporan Integritas
            </button>
            <button
              onClick={() => setActiveTab('interview')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'interview'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Wawancara AI
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'background'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Pemeriksaan Latar Belakang
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Riwayat Aktivitas
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Kandidat masih dalam proses mengerjakan assessment. Report akan tersedia setelah assessment selesai.</p>
          </div>
        )}

        {activeTab === 'overview' && candidate.status === 'completed' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText size={18} className="text-[#D95D00]" />
                    Resume Asli
                  </h3>
                </div>
                <div className="p-4">
                  {candidate.cvUrl ? (
                    <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                      {candidate.cvUrl.endsWith('.pdf') ? (
                        <iframe
                          src={candidate.cvUrl}
                          className="w-full h-full"
                          title={`CV ${candidate.candidate.name}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Pratinjau tidak tersedia</p>
                            <a
                              href={candidate.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
                            >
                              <FileText size={16} />
                              Buka di Tab Baru
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg">
                      <div className="text-center">
                        <FileText size={48} className="text-gray-400 mb-4" />
                        <p className="text-gray-600">CV belum diunggah</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Informasi Kontak</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${candidate.candidate.email}`} className="text-[#D95D00] hover:underline">
                      {candidate.candidate.email}
                    </a>
                  </div>
                  {candidate.whatsapp && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone size={16} className="text-gray-400" />
                      <a href={`https://wa.me/${candidate.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#D95D00] hover:underline">
                        {candidate.whatsapp}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-600">
                      Melamar pada {new Date(candidate.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-[#D95D00]/10 rounded-lg">
                      <Radar size={20} className="text-[#D95D00]" />
                    </div>
                    <h3 className="font-bold text-gray-800">Visualisasi Fraud Triangle</h3>
                  </div>
                  <div className="relative h-48 flex items-center justify-center">
                    <svg width="200" height="180" viewBox="0 0 200 180">
                      <polygon
                        points="100,20 170,150 30,150"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <polygon
                        points="100,20 170,150 30,150"
                        fill="#D95D00"
                        fillOpacity="0.1"
                        stroke="#D95D00"
                        strokeWidth="2"
                      />
                      <text x="100" y="15" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Tekanan</text>
                      <text x="25" y="155" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Peluang</text>
                      <text x="175" y="155" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Rasionalisasi</text>
                    </svg>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center p-2 bg-red-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">TEKANAN</div>
                      <div className="text-lg font-black text-red-600">{candidate.fraudTriangle?.pressure || 35}</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">PELUANG</div>
                      <div className="text-lg font-black text-blue-600">{candidate.fraudTriangle?.opportunity || 15}</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">RASIONALISASI</div>
                      <div className="text-lg font-black text-orange-600">{candidate.fraudTriangle?.rationalization || 25}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-cyan-100 rounded-lg">
                      <Activity size={20} className="text-cyan-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Benchmarking Risiko</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Kandidat</div>
                        <div className="h-6 bg-orange-500 rounded" style={{ width: `${Math.min(100, (candidate.riskScore || 0) * 2)}%` }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Rata-rata Perusahaan</div>
                        <div className="h-6 bg-blue-500 rounded" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Industri Sejenis</div>
                        <div className="h-6 bg-gray-400 rounded" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Membandingkan skor agregat kandidat dengan database internal.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <CheckCircle2 size={20} className="text-orange-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Skor Konsistensi</h3>
                  </div>
                  <div className="text-center mb-2">
                    <div className="text-4xl font-black text-orange-600">0.92%</div>
                    <div className="text-xs text-gray-500">Akurasi Jawaban</div>
                  </div>
                  <div className="h-2 bg-orange-200 rounded-full">
                    <div className="h-2 bg-orange-500 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Mengukur konsistensi antara tes tertulis dan wawancara.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-teal-100 rounded-lg">
                      <MessageSquare size={20} className="text-teal-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Sentimen Analisis</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-green-700">Positif</span>
                      <span className="font-bold">0%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-green-500 rounded-full" style={{ width: '0%' }}></div></div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-gray-700">Netral</span>
                      <span className="font-bold">1%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-gray-400 rounded-full" style={{ width: '1%' }}></div></div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-red-700">Negatif</span>
                      <span className="font-bold">0%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Identifikasi Red Flags</h3>
                </div>
                {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                  <div className="space-y-2">
                    {candidate.analysis.redFlags.map((flag, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={12} className="text-red-600" />
                        </div>
                        <p className="text-xs text-red-800 leading-relaxed">{flag}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Kandidat melaporkan kecemasan sedang terkait keuangan pribadi.</p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Mengalami darurat keuangan dalam 6 bulan terakhir.</p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Kandidat menganggap beberapa aturan perusahaan berpotensi tidak adil.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Bot size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Ringkasan AI</h3>
                    <p className="text-xs text-gray-500">Profiling risiko otomatis</p>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  {candidate.analysis?.summary ? (
                    <p className="text-gray-700 leading-relaxed text-sm">{candidate.analysis.summary}</p>
                  ) : (
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Kandidat menunjukkan <span className="font-semibold">kompetensi tinggi</span> di bidang teknis namun ditandai untuk{' '}
                      <span className="font-semibold text-[#D95D00]">Potensi Tekanan Finansial</span>. Selama sesi profiling,
                      kandidat menyebutkan memiliki kewajiban utang jangka pendek yang signifikan. Skor risiko mengindikasikan{' '}
                      <span className="font-semibold">profil risiko {candidate.riskScore && candidate.riskScore > 50 ? 'tinggi' : 'sedang'}</span>.
                      <br /><br />
                      <span className="font-semibold">Rekomendasi:</span> Verifikasi latar belakang finansial melalui pengecekan SLIK OJK dan lakukan verifikasi referensi tambahan.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <CandidateActivityTimeline
            timeline={candidate.timeline}
            candidateName={candidate.candidate.name}
          />
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Dokumen</h3>
            {candidate.cvUrl ? (
              <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '800px' }}>
                {candidate.cvUrl.endsWith('.pdf') ? (
                  <iframe
                    src={candidate.cvUrl}
                    className="w-full h-full"
                    title={`CV ${candidate.candidate.name}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Pratinjau tidak tersedia</p>
                      <a
                        href={candidate.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
                      >
                        Buka di Tab Baru
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-20">Tidak ada dokumen tersedia</p>
            )}
          </div>
        )}

        {activeTab === 'integrity' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Integrity Report akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'integrity' && candidate.status === 'completed' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm border border-orange-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 mb-1">{candidate.candidate.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Briefcase size={14} />
                      {candidate.candidate.role}
                    </span>
                    <span>•</span>
                    <span>{new Date(candidate.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    <CheckCircle2 size={14} />
                    RESIKO LOW
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase mb-1">Skor Fraud</div>
                  <div className="text-5xl font-black text-[#D95D00]">{candidate.riskScore || 25}</div>
                  <div className="text-sm text-gray-500">/100</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Visualisasi Fraud Triangle</h3>
                <div className="relative h-56 flex items-center justify-center mb-4">
                  <svg width="240" height="220" viewBox="0 0 240 220">
                    <polygon
                      points="120,30 200,180 40,180"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />
                    <polygon
                      points="120,30 200,180 40,180"
                      fill="#D95D00"
                      fillOpacity="0.15"
                      stroke="#D95D00"
                      strokeWidth="2"
                    />
                    <text x="120" y="20" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Tekanan</text>
                    <text x="30" y="195" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Peluang</text>
                    <text x="210" y="195" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Rasionalisasi</text>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Tekanan</div>
                    <div className="text-2xl font-black text-red-600">{candidate.fraudTriangle?.pressure || 35}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Peluang</div>
                    <div className="text-2xl font-black text-blue-600">{candidate.fraudTriangle?.opportunity || 15}</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Rasionalisasi</div>
                    <div className="text-2xl font-black text-orange-600">{candidate.fraudTriangle?.rationalization || 25}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={20} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Ringkasan Analisis AI</h3>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {candidate.analysis?.summary || (
                      <>
                        Kandidat menunjukkan <span className="font-semibold text-blue-600">profil risiko rendah</span> yang ditandai dengan <span className="font-semibold">kepatuhan kuat terhadap pemisahan tugas</span> dan <span className="font-semibold">rasionalisasi rendah untuk fraud</span>. Meskipun ada <span className="font-semibold text-orange-600">indikator tingkat menengah</span> terkait tekanan finansial (tingkat stres: {candidate.fraudTriangle?.pressure || 35}), jawaban kandidat secara konsisten menolak peluang fraudulen dan rasionalisasi tidak etis. Konsistensi antara penilaian diri dan skenario SJT tinggi.
                      </>
                    )}
                  </p>
                  <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-xs font-bold text-blue-900 mb-1 uppercase">Rekomendasi Tindakan</p>
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Direkomendasikan untuk direkrut.</span> Kandidat menunjukkan kompas etika yang kuat dan pemahaman kontrol internal. Indikator tekanan finansial minor diimbangi oleh skor integritas tinggi.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={20} className="text-cyan-600" />
                    <h3 className="font-bold text-gray-800">Benchmarking Risiko</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Kandidat</div>
                        <div className="h-7 bg-orange-500 rounded flex items-center justify-end pr-2" style={{ width: `${Math.min(100, (candidate.riskScore || 25) * 2)}%` }}>
                          <span className="text-xs font-bold text-white">{candidate.riskScore || 25}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Rata-rata Perusahaan</div>
                        <div className="h-7 bg-blue-500 rounded flex items-center justify-end pr-2" style={{ width: '60%' }}>
                          <span className="text-xs font-bold text-white">45</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Industri Sejenis</div>
                        <div className="h-7 bg-gray-400 rounded flex items-center justify-end pr-2" style={{ width: '75%' }}>
                          <span className="text-xs font-bold text-white">52</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">Membandingkan skor agregat kandidat dengan database internal.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={20} className="text-orange-600" />
                  <h3 className="font-bold text-gray-800">Skor Konsistensi</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="text-5xl font-black text-orange-600">0.92%</div>
                  <div className="text-sm text-gray-500 mt-1">Akurasi Jawaban</div>
                </div>
                <div className="h-3 bg-orange-200 rounded-full mb-4">
                  <div className="h-3 bg-orange-500 rounded-full" style={{ width: '92%' }}></div>
                </div>
                <p className="text-sm text-gray-600">Mengukur konsistensi antara tes tertulis dan wawancara.</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-teal-600" />
                  <h3 className="font-bold text-gray-800">Sentimen Analisis</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-green-700">Positif</span>
                      <span className="font-bold text-gray-800">0%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-green-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-gray-700">Netral</span>
                      <span className="font-bold text-gray-800">1%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-gray-400 rounded-full" style={{ width: '1%' }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-red-700">Negatif</span>
                      <span className="font-bold text-gray-800">0%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-red-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-red-600" />
                <h3 className="font-bold text-gray-800">Identifikasi Red Flags</h3>
              </div>
              <div className="space-y-3">
                {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                  candidate.analysis.redFlags.map((flag, idx) => (
                    <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800 leading-relaxed">{flag}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Kandidat melaporkan kecemasan sedang terkait keuangan pribadi.</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Mengalami darurat keuangan dalam 6 bulan terakhir.</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Kandidat menganggap beberapa aturan perusahaan berpotensi tidak adil.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'interview' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-6 flex items-center gap-2">
              <MessageSquare className="text-[#0066CC]" size={24} />
              Transkrip Wawancara AI
            </h3>
            {candidate.transcript && candidate.transcript.length > 0 ? (
              <>
                <div className="space-y-4 max-h-[600px] overflow-y-auto bg-gray-50 rounded-xl p-4">
                  {candidate.transcript.map((msg, idx) => {
                    const isAI = msg.speaker === 'ai';
                    const isCandidate = msg.speaker === 'candidate' || msg.speaker === 'user';

                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-2xl rounded-lg p-4 ${
                          isAI
                            ? 'bg-white text-gray-800 border border-gray-200'
                            : 'bg-[#D95D00] text-white'
                        }`}>
                          <div className="text-xs font-semibold mb-1 opacity-70">
                            {isAI ? '🤖 Pewawancara AI' : `👤 ${candidate.candidate.name}`}
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">
                  ✅ Percakapan terekam: {candidate.transcript.length} pesan | Tanggal: {new Date(candidate.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                <p className="text-yellow-800">⚠️ Transkrip wawancara tidak tersedia atau kandidat belum menyelesaikan wawancara</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'background' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Pemeriksaan Latar Belakang akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'background' && candidate.status === 'completed' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-sm border border-blue-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 mb-1">Laporan Pemeriksaan Latar Belakang</h2>
                  <p className="text-sm text-gray-600 mb-3">Verifikasi Identitas & KYC oleh Didit</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                    <Clock size={14} />
                    SEGERA HADIR
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase mb-1">Status Verifikasi</div>
                  <div className="text-3xl font-black text-gray-400">--</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield size={20} className="text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Ringkasan Pemeriksaan Latar Belakang</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Status</span>
                    <span className="text-sm font-semibold text-gray-400">Menunggu Integrasi</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Tanggal Verifikasi</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Penyedia</span>
                    <span className="text-sm font-semibold text-blue-600">Didit KYC</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 size={20} className="text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Gambar Verifikasi ID</h3>
                </div>
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                  <div className="text-center">
                    <FileText size={48} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Pratinjau Gambar ID</p>
                    <p className="text-xs text-gray-400">Segera Hadir</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText size={20} className="text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Extracted Data from ID</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Full Name</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">ID Number</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Date of Birth</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Address</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Nationality</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <User size={20} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Liveness Detection</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <User size={48} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Liveness Check Pending</p>
                  <p className="text-xs text-gray-400 mt-1">Verifies user is physically present</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Scan size={20} className="text-orange-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Face Match</h3>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-3">
                    <span className="text-4xl font-black text-gray-300">--%</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Match Score</p>
                  <p className="text-xs text-gray-400 mt-1">Compares selfie with ID photo</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">AML Screening</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Sanctions List</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">PEP Check</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Watchlist</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Globe size={20} className="text-cyan-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">IP Analysis</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">IP Address</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Location</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">ISP</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">VPN/Proxy</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Wifi size={20} className="text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Network Details</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Connection Type</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Speed</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Provider</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Risk Score</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <MapPin size={20} className="text-yellow-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">ID Verification Document Location</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Country</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">City</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Coordinates</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Timezone</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Smartphone size={20} className="text-pink-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Device Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Device Type</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">OS</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Browser</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Device ID</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Info size={24} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">Integrasi Segera Hadir</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Fitur Pemeriksaan Latar Belakang ini akan didukung oleh <span className="font-semibold">Didit KYC</span>,
                    solusi verifikasi identitas dan Know Your Customer (KYC) yang komprehensif. Setelah terintegrasi,
                    fitur ini akan menyediakan verifikasi identitas real-time, autentikasi dokumen, deteksi kehadiran fisik,
                    screening AML, dan penilaian risiko komprehensif untuk semua kandidat.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateDetail;
