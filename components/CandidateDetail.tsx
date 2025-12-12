import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Shield, Bot, DollarSign, Radar, Activity, MessageSquare, User, Scan, Globe, Wifi, Smartphone, Info, Download, Eye, Sparkles, ExternalLink, Lock, CreditCard } from 'lucide-react';
import { InterviewSession, ParsedCVData, CompanyProfile } from '../types';
import { db, COLLECTIONS, functions, parseCVWithMistral } from '../services/firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './Toast';
import CandidateActivityTimeline from './CandidateActivityTimeline';
import FraudTriangleVisualization from './FraudTriangleVisualization';
import ParsedCVDisplay from './ParsedCVDisplay';
import { deductCredit } from '../services/creditManagement';

interface CandidateDetailProps {
  sessionId: string;
  company: CompanyProfile;
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
  backgroundCheck?: {
    status?: 'pending' | 'in_progress' | 'approved' | 'declined';
    decision?: string;
    diditSessionId?: string;
    verificationLink?: string;
    createdAt?: {
      seconds: number;
    };
    lastUpdated?: {
      seconds: number;
    };
    // KYC data from Didit (user's backend structure)
    idVerification?: {
      fullName?: string;
      documentNumber?: string;
      documentType?: string;
      dateOfBirth?: string;
      placeOfBirth?: string;
      gender?: string;
      address?: string;
      status?: string;
      portraitImage?: string;
      frontImage?: string;
      backImage?: string;
    };
    faceMatch?: {
      score?: number;
      status?: string;
      sourceImage?: string;
      targetImage?: string;
    };
    liveness?: {
      score?: number;
      status?: string;
      ageEstimation?: number;
      referenceImage?: string;
    };
    warnings?: string[];
    ipAnalysis?: {
      ipAddress?: string;
      country?: string;
      isVpnOrTor?: boolean;
      status?: string;
    };
  };
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ sessionId, company, onBack }) => {
  const toast = useToast();
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'integrity' | 'interview' | 'background' | 'activity'>('overview');
  const [isContactUnlocked, setIsContactUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [companyTier, setCompanyTier] = useState<'Freemium' | 'Premium'>('Freemium');
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewType, setInterviewType] = useState<'online' | 'offline'>('online');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLink, setInterviewLink] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [showBgCheckModal, setShowBgCheckModal] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [hireTime, setHireTime] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [sendRejectionEmail, setSendRejectionEmail] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [workflowData, setWorkflowData] = useState<any>(null);

  useEffect(() => {
    loadCandidateData();

    // Real-time listener for CV parsing and Background Check updates
    const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        setCandidate(prev => {
          if (!prev) return null;

          let updated = false;
          let newCandidate = { ...prev };

          // Update cvParsedData if it changes
          if (data.cvParsedData && prev.cvUrl && !prev.cvParsedData) {
            console.log('[CANDIDATE-DETAIL] CV parsed data received via real-time listener');
            newCandidate.cvParsedData = data.cvParsedData;
            updated = true;
            toast.success('CV berhasil diparsing!');
          }

          // Update backgroundCheck if it changes
          if (data.backgroundCheck) {
            const currentBgCheck = prev.backgroundCheck;
            const newBgCheck = data.backgroundCheck;

            // Check if status has changed
            if (currentBgCheck?.status !== newBgCheck.status) {
              console.log('[CANDIDATE-DETAIL] Background check status updated via real-time listener:', newBgCheck.status);
              newCandidate.backgroundCheck = newBgCheck;
              updated = true;

              // Show toast based on status
              if (newBgCheck.status === 'approved') {
                toast.success('✓ Background check berhasil! Kandidat telah diverifikasi.');
              } else if (newBgCheck.status === 'declined') {
                toast.error('✗ Background check ditolak. Verifikasi gagal.');
              } else if (newBgCheck.status === 'in_progress') {
                toast.info('⏳ Background check sedang diproses...');
              }
            } else if (!currentBgCheck && newBgCheck) {
              // Initial background check data received
              console.log('[CANDIDATE-DETAIL] Background check data received via real-time listener');
              newCandidate.backgroundCheck = newBgCheck;
              updated = true;
            }
          }

          return updated ? newCandidate : prev;
        });
      }
    });

    return () => unsubscribe();
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

      // Load workflow if exists
      console.log('[CANDIDATE] Session workflowId:', sessionData.workflowId);
      if (sessionData.workflowId) {
        try {
          const workflowRef = doc(db, COLLECTIONS.WORKFLOWS, sessionData.workflowId);
          const workflowSnap = await getDoc(workflowRef);
          if (workflowSnap.exists()) {
            const loadedWorkflow = { id: workflowSnap.id, ...workflowSnap.data() } as any;
            setWorkflowData(loadedWorkflow);
            console.log('[CANDIDATE] ✅ Loaded workflow:', loadedWorkflow.name, 'with', loadedWorkflow.steps?.length, 'steps');
          } else {
            console.log('[CANDIDATE] ⚠️ Workflow document not found:', sessionData.workflowId);
          }
        } catch (error) {
          console.error('[CANDIDATE] Error fetching workflow:', error);
        }
      } else {
        console.log('[CANDIDATE] ⚠️ No workflowId in session data');
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

  // REMOVED: Auto-progress is now handled in PublicAssessment.tsx during completion
  // This useEffect is no longer needed as timeline progression happens during assessment completion


  const handleUnlockContact = async () => {
    if (!company.id || isUnlocking) return;

    // Check if user is Premium (Premium users have unlimited access)
    if (company.tier === 'Premium') {
      setIsContactUnlocked(true);
      return;
    }

    // For Freemium users, deduct 2 credits
    try {
      setIsUnlocking(true);

      const result = await deductCredit(
        company.id,
        2,
        'UNLOCK_PROFILE',
        `Unlock kontak ${candidate?.candidate.name}`,
        { sessionId, candidateName: candidate?.candidate.name }
      );

      if (result.success) {
        setIsContactUnlocked(true);
        toast.success('Kontak kandidat berhasil dibuka! (2 kredit digunakan)');
      } else {
        toast.error(result.error || 'Gagal unlock kontak');
      }
    } catch (error) {
      console.error('[UNLOCK] Error:', error);
      toast.error('Terjadi kesalahan saat unlock kontak');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleParseCV = async () => {
    if (!candidate?.cvUrl || isParsing) return;

    try {
      setIsParsing(true);
      toast.info('Memulai parsing dokumen dengan Mistral AI...');

      await parseCVWithMistral(candidate.cvUrl, sessionId);

      toast.success('Dokumen berhasil diparsing! Refresh halaman untuk melihat hasil.');
      await loadCandidateData();

    } catch (error) {
      console.error('[CANDIDATE-DETAIL] Error parsing document:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal parsing dokumen');
    } finally {
      setIsParsing(false);
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
    return true; // KYC now available for all tiers including Freemium
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
        tooltip: !canMoveToStage(normalizedStage, 'bc_check')
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


  const handleCompleteWorkflowStep = async (stageId: string, stepIndex: number) => {
    if (!candidate || !workflowData) return;

    // Special handling for decision steps - redirect to existing modals
    if (stageId === 'hire_decision') {
      setShowHireModal(true);
      return;
    }
    if (stageId === 'reject_decision') {
      setShowRejectModal(true);
      return;
    }

    // Special handling for existing integrated actions
    if (stageId === 'face_to_face_interview') {
      // Use existing interview status update with email integration
      await handleStatusUpdate('interview');
      return;
    }
    if (stageId === 'background_check') {
      // Use existing background check status update with email integration
      await handleStatusUpdate('bc_check');
      return;
    }

    try {
      setIsUpdating(true);

      // Validate sequential execution
      const currentTimeline = candidate.timeline || [];
      const workflowSteps = currentTimeline.filter((t: any) =>
        workflowData.steps.some((s: any) => s.id === t.stage)
      );

      // Check if this is really the current step
      const currentStep = workflowSteps.find((t: any) => t.status === 'current');
      if (!currentStep || currentStep.stage !== stageId) {
        toast.error('Tahapan harus diselesaikan secara berurutan!');
        setIsUpdating(false);
        return;
      }

      const now = new Date().toISOString();

      // Update timeline: mark current as completed, set next as current
      const updatedTimeline = currentTimeline.map((item: any, idx: number) => {
        if (item.stage === stageId && item.status === 'current') {
          return {
            ...item,
            status: 'completed',
            completedAt: now
          };
        }
        return item;
      });

      // Find next workflow step and set as current
      const nextStepIndex = stepIndex + 1;
      const nextWorkflowStep = workflowSteps[nextStepIndex];

      if (nextWorkflowStep) {
        updatedTimeline.forEach((item: any, idx: number) => {
          if (item.stage === nextWorkflowStep.stage && item.status === 'pending') {
            item.status = 'current';
          }
        });
      }

      // Add to existing timeline (non-workflow steps)
      const existingTimeline = candidate.timeline || [];
      const completedStepName = workflowData.steps.find((s: any) => s.id === stageId)?.name;
      const nextStepName = nextWorkflowStep ? workflowData.steps.find((s: any) => s.id === nextWorkflowStep.stage)?.name : null;

      const timelineUpdate = [
        ...existingTimeline.map((event: any) => {
          if (event.stage === stageId && event.status === 'current') {
            return { ...event, status: 'completed', completedAt: now };
          }
          if (nextWorkflowStep && event.stage === nextWorkflowStep.stage && event.status === 'pending') {
            return { ...event, status: 'current' };
          }
          return event;
        }),
        {
          stage: 'update',
          status: 'completed' as const,
          date: now,
          note: `${completedStepName} selesai${nextStepName ? `, lanjut ke ${nextStepName}` : ''}`
        }
      ];

      // Update Firestore
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      await updateDoc(sessionRef, {
        timeline: timelineUpdate,
        recruitmentStage: nextWorkflowStep ? nextWorkflowStep.stage : stageId,
        updatedAt: now
      });

      // Send Email Notification to Candidate
      try {
        const companyRef = doc(db, COLLECTIONS.COMPANIES, candidate.companyId);
        const companySnap = await getDoc(companyRef);

        if (companySnap.exists()) {
          const companyData = companySnap.data();

          // TODO: Call email function for workflow step completion
          // For now, just log
          console.log(`[WORKFLOW] Email notification: ${completedStepName} completed for ${candidate.candidate.email}`);
          console.log(`[WORKFLOW] Company: ${companyData.name}, Next step: ${nextStepName || 'Final'}`);

          // You can implement email sending here based on step type
          // await sendEmailViaCloudFunction("workflow_step_complete", candidate.candidate.email, {...});
        }
      } catch (emailError) {
        console.error('[WORKFLOW] Error sending email:', emailError);
        // Don't fail the whole operation if email fails
      }

      // Reload candidate data
      await loadCandidateData();

      toast.success(`✓ Tahap "${completedStepName}" berhasil diselesaikan!${nextStepName ? ` Lanjut ke: ${nextStepName}` : ''}`);

    } catch (error) {
      console.error('[WORKFLOW] Error completing step:', error);
      toast.error('Gagal menyelesaikan tahap workflow');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInterviewInvitation = async () => {
    if (!candidate) return;

    if (interviewType === 'online' && !interviewLink.trim()) {
      toast.error('Link wawancara online wajib diisi!');
      return;
    }

    if (interviewType === 'offline' && !interviewLocation.trim()) {
      toast.error('Lokasi wawancara wajib diisi!');
      return;
    }

    if (!interviewDate || !interviewTime) {
      toast.error('Tanggal dan waktu wawancara wajib diisi!');
      return;
    }

    try {
      setIsUpdating(true);

      const companyRef = doc(db, COLLECTIONS.COMPANIES, candidate.companyId);
      const companySnap = await getDoc(companyRef);

      if (!companySnap.exists()) {
        throw new Error('Company not found');
      }

      const companyData = companySnap.data();
      const companyName = companyData.name || 'Our Company';

      const formattedDate = new Date(interviewDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const locationText = interviewType === 'online'
        ? `Online via ${interviewLink}`
        : interviewLocation;

      // Try to send email, but don't block workflow if it fails
      try {
        console.log('[INTERVIEW] Attempting to send email invitation...');
        const sendEmail = httpsCallable(functions, 'sendEmail');

        const emailData = {
          type: 'interview_invitation',
          to: candidate.candidate.email,
          data: {
            candidateName: candidate.candidate.name,
            candidateEmail: candidate.candidate.email,
            companyName: companyName,
            role: candidate.candidate.role || candidate.jobTitle || '',
            interviewDate: formattedDate,
            interviewTime: interviewTime,
            interviewLocation: locationText,
            interviewType: interviewType
          }
        };

        await sendEmail(emailData);
        console.log('[INTERVIEW] ✅ Email sent successfully');
      } catch (emailError) {
        console.warn('[INTERVIEW] ⚠️ Email sending failed (will continue without email):', emailError);
        // Don't throw - continue with workflow update even if email fails
      }

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const now = new Date().toISOString();

      const existingTimeline = candidate.timeline || [];

      // Update timeline properly for workflow progression
      const updatedTimeline = existingTimeline.map((event: any) => {
        // Mark current step as completed
        if (event.status === 'current') {
          return {
            ...event,
            status: 'completed' as const,
            completedAt: now,
            note: event.note + ` - Selesai, interview dijadwalkan`
          };
        }
        return event;
      });

      // Find current step index and set next step as current
      const currentStepIndex = existingTimeline.findIndex((t: any) => t.status === 'current');
      if (currentStepIndex !== -1 && currentStepIndex + 1 < updatedTimeline.length) {
        const nextStep = updatedTimeline[currentStepIndex + 1];
        updatedTimeline[currentStepIndex + 1] = {
          ...nextStep,
          status: 'current' as const,
          date: now,
          note: nextStep.note || `${nextStep.stage} - Ready to proceed`
        };
      }

      console.log('[INTERVIEW] ✅ Timeline updated with workflow progression');
      console.log('[INTERVIEW] Current completed, next step set to current');

      // Determine recruitmentStage based on next workflow step
      let nextStageId = 'interview';
      if (currentStepIndex !== -1 && currentStepIndex + 1 < updatedTimeline.length) {
        nextStageId = updatedTimeline[currentStepIndex + 1].stage;
      }

      await updateDoc(sessionRef, {
        recruitmentStage: nextStageId,
        timeline: updatedTimeline,
        updatedAt: now,
        interviewEmailSent: true,
        interviewEmailSentAt: now,
        interviewSchedule: {
          type: interviewType,
          date: interviewDate,
          time: interviewTime,
          location: interviewType === 'offline' ? interviewLocation : null,
          link: interviewType === 'online' ? interviewLink : null,
          scheduledAt: now
        }
      });

      setShowInterviewModal(false);
      setInterviewDate('');
      setInterviewTime('');
      setInterviewLink('');
      setInterviewLocation('');
      setInterviewType('online');

      await loadCandidateData();
      toast.success('Undangan wawancara berhasil dikirim ke kandidat!');

    } catch (error) {
      console.error('Error sending interview invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengirim undangan wawancara');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenInterviewModal = async () => {
    setShowInterviewModal(true);

    if (!interviewLocation && candidate) {
      try {
        const companyRef = doc(db, COLLECTIONS.COMPANIES, candidate.companyId);
        const companySnap = await getDoc(companyRef);

        if (companySnap.exists()) {
          const companyData = companySnap.data();
          const defaultLocation = companyData.address || companyData.location || '';
          setInterviewLocation(defaultLocation);
        }
      } catch (error) {
        console.error('Error loading company address:', error);
      }
    }
  };

  const handleBackgroundCheck = async () => {
    if (!candidate) return;

    try {
      setIsUpdating(true);
      setShowBgCheckModal(false);

      // Deduct credits for KYC Verification (100 credits)
      const deductionResult = await deductCredit(
        company.id,
        100,
        'KYC_VERIFICATION',
        `KYC Background Check - ${candidate.candidate.name}`,
        { sessionId, candidateName: candidate.candidate.name }
      );

      if (!deductionResult.success) {
        toast.error(deductionResult.error || 'Gagal memulai Background Check - Kredit tidak cukup');
        setIsUpdating(false);
        return;
      }

      // Update workflow status directly (email sending is optional)
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const now = new Date().toISOString();

      const existingTimeline = candidate.timeline || [];
      const updatedTimeline = [
        ...existingTimeline.map(event => ({
          ...event,
          status: event.status === 'current' ? 'completed' as const : event.status
        })),
        {
          stage: 'background_check',
          status: 'current' as const,
          date: now,
          note: `Background check dimulai untuk ${candidate.candidate.name}`
        }
      ];

      await updateDoc(sessionRef, {
        recruitmentStage: 'background_check',
        timeline: updatedTimeline,
        updatedAt: now
      });

      // Try to send email (optional - won't block if fails)
      try {
        console.log('[BACKGROUND-CHECK] Attempting to send email...');
        const initiateBackgroundCheck = httpsCallable(functions, 'initiateBackgroundCheck');
        await initiateBackgroundCheck({ sessionId });
        console.log('[BACKGROUND-CHECK] ✅ Email sent successfully');
      } catch (emailError) {
        console.warn('[BACKGROUND-CHECK] ⚠️ Email failed (continuing without email):', emailError);
      }

      toast.success(`Background Check dimulai! (100 kredit digunakan, sisa: ${deductionResult.remainingCredits})`);
      await loadCandidateData();
    } catch (error) {
      console.error('Error initiating background check:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal memulai Background Check');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleHire = async () => {
    if (!candidate || !hireDate || !hireTime || !contactPerson) {
      toast.error('Mohon lengkapi semua field');
      return;
    }

    try {
      setIsUpdating(true);
      setShowHireModal(false);

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const now = new Date().toISOString();

      const existingTimeline = candidate.timeline || [];
      const updatedTimeline = [
        ...existingTimeline.map(event => ({
          ...event,
          status: event.status === 'current' ? 'completed' as const : event.status
        })),
        {
          stage: 'hired',
          status: 'current' as const,
          date: now,
          note: `${candidate.candidate.name} direkrut! Hadir: ${hireDate} ${hireTime}, CP: ${contactPerson}`
        }
      ];

      await updateDoc(sessionRef, {
        recruitmentStage: 'hired',
        timeline: updatedTimeline,
        hireDetails: {
          date: hireDate,
          time: hireTime,
          contactPerson: contactPerson,
          hiredAt: now
        }
      });

      try {
        const sendHireEmailFn = httpsCallable(functions, 'sendHireEmail');
        await sendHireEmailFn({
          sessionId: sessionId,
          startDate: hireDate,
          startTime: hireTime,
          contactPerson: contactPerson,
          contactPhone: '',
          additionalInfo: ''
        });
        toast.success('Kandidat berhasil direkrut dan email selamat telah dikirim!');
      } catch (emailError) {
        console.error('Error sending hire email:', emailError);
        toast.success('Kandidat berhasil direkrut (email gagal dikirim)');
      }

      setHireDate('');
      setHireTime('');
      setContactPerson('');

      await loadCandidateData();

    } catch (error) {
      console.error('Error hiring candidate:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal merekrut kandidat');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!candidate) return;

    try {
      setIsUpdating(true);
      setShowRejectModal(false);

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const now = new Date().toISOString();

      const existingTimeline = candidate.timeline || [];
      const updatedTimeline = [
        ...existingTimeline.map(event => ({
          ...event,
          status: event.status === 'current' ? 'completed' as const : event.status
        })),
        {
          stage: 'rejected',
          status: 'current' as const,
          date: now,
          note: `${candidate.candidate.name} tidak lolos seleksi`
        }
      ];

      await updateDoc(sessionRef, {
        recruitmentStage: 'rejected',
        timeline: updatedTimeline,
        rejectionDetails: {
          sendEmail: sendRejectionEmail,
          rejectedAt: now
        }
      });

      if (sendRejectionEmail) {
        try {
          const sendRejectionEmailFn = httpsCallable(functions, 'sendRejectionEmail');
          await sendRejectionEmailFn({
            sessionId: sessionId,
            customMessage: ''
          });
          toast.success('Kandidat ditolak dan email penolakan telah dikirim');
        } catch (emailError) {
          console.error('Error sending rejection email:', emailError);
          toast.success('Kandidat ditolak (email gagal dikirim)');
        }
      } else {
        toast.success('Kandidat ditolak (tanpa email)');
      }

      setSendRejectionEmail(true);
      await loadCandidateData();

    } catch (error) {
      console.error('Error rejecting candidate:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal menolak kandidat');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async (newStage: string) => {
    if (!candidate) return;

    if (newStage === 'interview') {
      await handleOpenInterviewModal();
      return;
    }

    if (newStage === 'bc_check') {
      // Background Check now available for all tiers
      setShowBgCheckModal(true);
      return;
    }

    const currentStage = candidate.recruitmentStage || 'screening';

    if (newStage !== 'rejected' && !canMoveToStage(currentStage, newStage)) {
      toast.error('Tidak dapat melompat tahap! Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }

    try {
      setIsUpdating(true);
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
      {showBgCheckModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
            <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] p-6 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Kirim Background Check</h3>
                  <p className="text-sm opacity-90">Verifikasi via Didit KYC</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-orange-50 border-l-4 border-[#D95D00] p-4 rounded-lg mb-5">
                <div className="flex items-start gap-3">
                  <User size={20} className="text-[#D95D00] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{candidate?.candidate.name}</p>
                    <p className="text-sm text-gray-600 mb-2">{candidate?.candidate.email}</p>
                    <p className="text-xs text-gray-500">{candidate?.jobTitle}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-blue-600" />
                  <p className="font-semibold text-blue-900 text-sm">Batas Waktu</p>
                </div>
                <p className="text-sm text-blue-800">
                  Kandidat harus menyelesaikan verifikasi dalam <strong>48 jam</strong> setelah email dikirim.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">Biaya Verifikasi:</span>
                  <span className="font-bold text-[#D95D00] text-lg">3 Kredit KYC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Kredit Tersisa:</span>
                  <span className="font-bold text-gray-800 text-lg">∞</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBgCheckModal(false)}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleBackgroundCheck}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Kirim Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInterviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full animate-fade-in my-8">
            <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] p-6 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Jadwalkan Wawancara</h3>
                  <p className="text-sm opacity-90">Atur detail undangan wawancara</p>
                </div>
              </div>
            </div>

            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong className="block mb-2">Email akan dikirim ke:</strong>
                  <span className="font-mono text-blue-700">{candidate?.candidate.email}</span>
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <User size={16} className="text-[#D95D00]" />
                  Detail Kandidat
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 block mb-1">Nama:</span>
                    <span className="font-semibold text-gray-800">{candidate?.candidate.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block mb-1">Posisi:</span>
                    <span className="font-semibold text-gray-800">{candidate?.jobTitle}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tipe Wawancara
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInterviewType('online')}
                      className={`p-4 rounded-xl border-2 transition-all ${interviewType === 'online'
                        ? 'border-[#D95D00] bg-orange-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${interviewType === 'online' ? 'bg-[#D95D00]' : 'bg-gray-200'
                          }`}>
                          <Globe size={20} className={interviewType === 'online' ? 'text-white' : 'text-gray-600'} />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-800">Online</div>
                          <div className="text-xs text-gray-500">Video Call</div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInterviewType('offline')}
                      className={`p-4 rounded-xl border-2 transition-all ${interviewType === 'offline'
                        ? 'border-[#D95D00] bg-orange-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${interviewType === 'offline' ? 'bg-[#D95D00]' : 'bg-gray-200'
                          }`}>
                          <MapPin size={20} className={interviewType === 'offline' ? 'text-white' : 'text-gray-600'} />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-800">Offline</div>
                          <div className="text-xs text-gray-500">Di Kantor</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tanggal Wawancara <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Waktu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {interviewType === 'online' ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Link Meeting (Google Meet / Zoom) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={interviewLink}
                      onChange={(e) => setInterviewLink(e.target.value)}
                      placeholder="https://meet.google.com/xxx atau https://zoom.us/j/xxx"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Masukkan link lengkap untuk video call wawancara
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Alamat Kantor <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={interviewLocation}
                      onChange={(e) => setInterviewLocation(e.target.value)}
                      placeholder="Masukkan alamat lengkap kantor untuk wawancara"
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent outline-none resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Alamat ini akan dikirim ke kandidat dalam email undangan
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex gap-2">
                  <Info size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-800 leading-relaxed">
                    <p className="font-semibold mb-1">Yang akan dilakukan:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Mengirim email undangan dengan detail wawancara</li>
                      <li>Mengubah status kandidat menjadi "Interview"</li>
                      <li>Mencatat jadwal wawancara di sistem</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInterviewModal(false);
                    setInterviewDate('');
                    setInterviewTime('');
                    setInterviewLink('');
                    setInterviewLocation('');
                    setInterviewType('online');
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  onClick={handleInterviewInvitation}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Kirim Undangan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHireModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Rekrut Kandidat</h3>
                  <p className="text-sm opacity-90">Jadwal Hari Pertama Kerja</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <p className="text-sm text-gray-600 mb-2">Kandidat:</p>
                <p className="font-semibold text-gray-800 text-lg">{candidate?.candidate.name}</p>
                <p className="text-sm text-gray-500">{candidate?.candidate.email}</p>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tanggal Hadir <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jam Hadir <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={hireTime}
                    onChange={(e) => setHireTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Contoh: Bu Sarah (HR Manager) - 0812-3456-7890"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-lg mb-6">
                <p className="text-xs text-green-800">
                  Kandidat akan direkrut dan status berubah menjadi "Hired"
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowHireModal(false);
                    setHireDate('');
                    setHireTime('');
                    setContactPerson('');
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  onClick={handleHire}
                  disabled={isUpdating || !hireDate || !hireTime || !contactPerson}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Merekrut...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Rekrut
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <XCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Tolak Kandidat</h3>
                  <p className="text-sm opacity-90">Konfirmasi Penolakan</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <p className="text-sm text-gray-600 mb-2">Kandidat:</p>
                <p className="font-semibold text-gray-800 text-lg">{candidate?.candidate.name}</p>
                <p className="text-sm text-gray-500">{candidate?.candidate.email}</p>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-5">
                <p className="text-sm text-red-900 font-semibold mb-2">
                  Kandidat akan ditolak dan status berubah menjadi "Rejected"
                </p>
                <p className="text-xs text-red-800">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendRejectionEmail}
                    onChange={(e) => setSendRejectionEmail(e.target.checked)}
                    className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Kirim Email Penolakan</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Kandidat akan menerima notifikasi email bahwa mereka tidak lolos seleksi
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSendRejectionEmail(true);
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Menolak...
                    </>
                  ) : (
                    <>
                      <XCircle size={18} />
                      Tolak Kandidat
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

            <div className="flex items-center gap-3">
              {statusBadge && (
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${statusBadge.color}`}>
                  {statusBadge.icon}
                  {statusBadge.label}
                </span>
              )}
              {candidate.recruitmentStage !== 'rejected' && candidate.recruitmentStage !== 'approved' && candidate.recruitmentStage !== 'hired' && (() => {
                // If workflow exists, use workflow steps as stage buttons
                console.log('[BUTTONS] Rendering buttons. workflowData:', workflowData ? 'EXISTS' : 'NULL', 'recruitmentStage:', candidate.recruitmentStage);

                if (workflowData) {
                  console.log('[BUTTONS] Using workflow buttons. Steps:', workflowData.steps?.map((s: any) => s.name).join(', '));
                  const workflowTimeline = candidate.timeline?.filter((t: any) =>
                    workflowData.steps.some((s: any) => s.id === t.stage)
                  ) || [];
                  console.log('[BUTTONS] Workflow timeline:', workflowTimeline.map((t: any) => `${t.stage}:${t.status}`).join(', '));

                  const currentStepIndex = workflowTimeline.findIndex((t: any) => t.status === 'current');
                  const currentStep = workflowTimeline[currentStepIndex];
                  const nextStep = workflowTimeline[currentStepIndex + 1];

                  // Check if assessment is completed
                  const assessmentStep = workflowTimeline.find((t: any) => t.stage === 'integrity_assessment');
                  const isAssessmentCompleted = assessmentStep?.status === 'completed';
                  const isCurrentStepAssessment = currentStep?.stage === 'integrity_assessment';

                  return (
                    <div className="flex items-center gap-2">
                      {/* Workflow Steps Section */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <Activity size={14} className="text-purple-600" />
                        <div className="flex items-center gap-1.5">
                          {/* Current Workflow Step Button */}
                          {currentStep && (
                            <>
                              {isCurrentStepAssessment ? (
                                // Assessment button - Always disabled (kandidat gets email automatically)
                                <button
                                  disabled={true}
                                  title="Kandidat sudah mendapat email untuk assessment"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium cursor-not-allowed"
                                >
                                  <Mail size={12} />
                                  {workflowData.steps.find((s: any) => s.id === currentStep.stage)?.name || 'Assessment'}
                                  <span className="text-[10px] ml-1">(Email terkirim)</span>
                                </button>
                              ) : (
                                // Other steps - Clickable
                                <button
                                  onClick={() => handleCompleteWorkflowStep(currentStep.stage, currentStepIndex)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <CheckCircle2 size={12} />
                                  {workflowData.steps.find((s: any) => s.id === currentStep.stage)?.name || 'Next'}
                                </button>
                              )}
                            </>
                          )}

                          {/* Next Step Preview - Only show if assessment is completed OR not needed */}
                          {nextStep && (isAssessmentCompleted || currentStepIndex > 0) && (
                            <button
                              disabled={true}
                              title="Selesaikan tahap sebelumnya"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium opacity-60 cursor-not-allowed"
                            >
                              <Clock size={12} />
                              {workflowData.steps.find((s: any) => s.id === nextStep.stage)?.name || 'Next'}
                            </button>
                          )}

                          {/* Show waiting message if assessment not complete */}
                          {!isAssessmentCompleted && isCurrentStepAssessment && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-2">
                              Menunggu kandidat menyelesaikan assessment...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

                      {/* Decision Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowHireModal(true)}
                          disabled={isUpdating || !isAssessmentCompleted}
                          title={!isAssessmentCompleted ? "Assessment harus selesai terlebih dahulu" : "Rekrut kandidat"}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          <CheckCircle2 size={14} />
                          Rekrut
                        </button>

                        <button
                          onClick={() => setShowRejectModal(true)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          <XCircle size={14} />
                          Tolak
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  // No workflow - Show minimal buttons (Hire & Reject only)
                  return (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowHireModal(true)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <CheckCircle2 size={14} />
                        Rekrut
                      </button>

                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <XCircle size={14} />
                        Tolak
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'overview'
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'documents'
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              CV & Dokumen
            </button>
            <button
              onClick={() => setActiveTab('integrity')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'integrity'
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Laporan Integritas
            </button>
            <button
              onClick={() => setActiveTab('interview')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'interview'
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Wawancara AI
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'background'
                ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Pemeriksaan Latar Belakang
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${activeTab === 'activity'
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
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center animate-in fade-in slide-in-from-bottom-4">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Summary akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'overview' && candidate.status === 'completed' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Sparkles size={18} />
                    Ringkasan CV (AI Parsed)
                  </h3>
                  {/* Auto-parse badge */}
                  {candidate.cvUrl && !candidate.cvParsedData && (
                    <span className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 animate-pulse">
                      <span className="animate-spin">⏳</span>
                      Auto-parsing...
                    </span>
                  )}
                  {candidate.cvParsedData && (
                    <span className="px-3 py-1.5 bg-green-500/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
                      ✓ Parsed Automatically
                    </span>
                  )}
                </div>
                <div className="p-4 max-h-[800px] overflow-y-auto">
                  {candidate.cvParsedData ? (
                    <ParsedCVDisplay parsedData={candidate.cvParsedData} />
                  ) : candidate.cvUrl ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center max-w-md">
                        <div className="animate-spin text-6xl mb-4">⏳</div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Sedang Memproses CV...</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          CV sedang dianalisis oleh AI. Proses ini memakan waktu sekitar 10-30 detik.
                          Refresh halaman untuk melihat hasil.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center max-w-md">
                        <Sparkles size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">CV Tidak Tersedia</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Kandidat belum mengupload CV.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Informasi Kontak</h3>
                  {company.tier === 'Freemium' && !isContactUnlocked && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                      Terkunci
                    </span>
                  )}
                </div>

                {company.tier === 'Freemium' && !isContactUnlocked ? (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                      <Lock size={32} className="text-orange-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-700 mb-1 font-medium">Kontak Tersembunyi</p>
                      <p className="text-xs text-gray-600 mb-4">Email & WhatsApp kandidat disembunyikan untuk paket Freemium</p>
                      <button
                        onClick={handleUnlockContact}
                        disabled={isUnlocking}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUnlocking ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Membuka...
                          </>
                        ) : (
                          <>
                            <Lock size={14} />
                            Buka Kontak (2 Kredit)
                          </>
                        )}
                      </button>
                    </div>
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
                ) : (
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
                )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-240px)] min-h-[600px]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
              <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] px-4 py-3 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Sparkles size={18} />
                  Data Kandidat (AI Parsed)
                </h3>
                {!candidate.cvParsedData && candidate.cvUrl && (
                  <span className="px-2.5 py-1 bg-white/20 text-white rounded text-xs font-medium flex items-center gap-1.5 animate-pulse">
                    <span className="animate-spin">⏳</span>
                    Auto-parsing...
                  </span>
                )}
                {candidate.cvParsedData && (
                  <span className="px-2.5 py-1 bg-green-500/20 text-white rounded text-xs font-medium flex items-center gap-1.5">
                    ✓ Parsed
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                {candidate.cvParsedData ? (
                  <ParsedCVDisplay parsedData={candidate.cvParsedData} />
                ) : candidate.cvUrl ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <div className="animate-spin text-4xl mb-3">⏳</div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Sedang Memproses...</h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        CV sedang dianalisis oleh AI. Proses ini memakan waktu 10-30 detik.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <Sparkles size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">CV Tidak Tersedia</h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Kandidat belum mengupload CV.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                  <FileText size={18} className="text-[#D95D00]" />
                  CV Original
                </h3>
                {/* Download button removed for security/view-only mode */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Eye size={12} />
                  View Only
                </div>
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative group">
                {candidate.cvUrl ? (
                  (() => {
                    // Helper to check file type ignoring query params
                    const cleanUrl = candidate.cvUrl.split('?')[0].toLowerCase();
                    const isPdf = cleanUrl.endsWith('.pdf');
                    const isDoc = cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx');

                    if (isPdf) {
                      return (
                        <>
                          <iframe
                            src={`${candidate.cvUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full absolute inset-0"
                            title={`CV ${candidate.candidate.name}`}
                          />
                          {/* Overlay to block right-click/save context menu (optional) */}
                          <div className="absolute inset-0 bg-transparent" onContextMenu={(e) => e.preventDefault()} />
                        </>
                      );
                    } else if (isDoc) {
                      return (
                        <div className="w-full h-full relative">
                          <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(candidate.cvUrl)}&embedded=true`}
                            className="w-full h-full absolute inset-0"
                            title={`CV ${candidate.candidate.name}`}
                          />
                          {/* Blocker for Google Pop-out button (Top Right) */}
                          <div className="absolute top-0 right-0 w-16 h-16 bg-transparent z-10" title="Download disabled" />
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center justify-center h-full">

                          <div className="text-center">
                            <FileText size={48} className="text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Pratinjau tidak tersedia untuk format file ini</p>
                            <a
                              href={candidate.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded hover:bg-[#B84D00] transition-colors text-sm font-medium"
                            >
                              <Eye size={16} />
                              Buka di Tab Baru
                            </a>
                          </div>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada CV yang diunggah</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrity' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Integrity Report akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'integrity' && candidate.status === 'completed' && (() => {
          // --- Helper Logic for Integrity Report ---
          const riskScore = candidate.riskScore || 0;
          let recStatus = { label: 'DIREKOMENDASIKAN', color: 'green', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: <CheckCircle2 size={24} /> };

          if (riskScore > 65) {
            recStatus = { label: 'RISIKO TINGGI', color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: <XCircle size={24} /> };
          } else if (riskScore > 35) {
            recStatus = { label: 'PERLU REVIEW', color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: <AlertTriangle size={24} /> };
          }

          // Use 0 if valid data is 0. Only fallback to 0 if undefined. Do NOT use fake numbers like 35.
          const pressure = candidate.fraudTriangle?.pressure ?? candidate.analysis?.scores?.pressure ?? 0;
          const opportunity = candidate.fraudTriangle?.opportunity ?? candidate.analysis?.scores?.opportunity ?? 0;
          const rationalization = candidate.fraudTriangle?.rationalization ?? candidate.analysis?.scores?.rationalization ?? 0;

          // Smart Interview Questions Generation
          const interviewQuestions = [];
          if (pressure > 30) interviewQuestions.push('Ceritakan situasi di mana Anda menghadapi tekanan target yang sangat tinggi. Bagaimana cara Anda mencapainya?');
          if (opportunity > 30) interviewQuestions.push('Bagaimana pendapat Anda tentang "zona abu-abu" dalam aturan perusahaan? Kapan aturan boleh dilanggar?');
          if (rationalization > 30) interviewQuestions.push('Pernahkah Anda melihat rekan kerja melakukan pelanggaran kecil? Apa yang Anda lakukan/pikirkan saat itu?');
          if (interviewQuestions.length === 0) interviewQuestions.push('Ceritakan tentang dilema etika terbesar yang pernah Anda hadapi dalam pekerjaan.');

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

              {/* 1. Executive Hero Section */}
              <div className={`rounded-xl shadow-sm border p-6 ${recStatus.bg} ${recStatus.border}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 bg-white/60 rounded-full text-xs font-bold mb-3 ${recStatus.text}`}>
                      {recStatus.icon}
                      STATUS: {recStatus.label}
                    </div>
                    <h2 className={`text-2xl font-black mb-1 ${recStatus.text}`}>{candidate.candidate.name}</h2>
                    <p className={`text-sm opacity-90 ${recStatus.text}`}>
                      {recStatus.label === 'DIREKOMENDASIKAN' && 'Kandidat menunjukkan profil integritas yang sehat.'}
                      {recStatus.label === 'PERLU REVIEW' && 'Ditemukan beberapa indikator risiko yang perlu diklarifikasi.'}
                      {recStatus.label === 'RISIKO TINGGI' && 'Terdapat indikator risiko signifikan. Disarankan investigasi mendalam.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 bg-white/50 px-6 py-4 rounded-xl border border-white/50">
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">Fraud Risk Score</div>
                      <div className="flex items-baseline justify-end gap-1">
                        <span className={`text-4xl font-black ${recStatus.text}`}>{Math.round(riskScore)}</span>
                        <span className="text-sm text-gray-500 font-medium">/100</span>
                      </div>
                    </div>
                    {/* Visual Gauge */}
                    <div className="w-32 md:w-48">
                      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 relative">
                          {/* Marker */}
                          <div className="absolute top-0 bottom-0 w-1 bg-black shadow-[0_0_4px_rgba(0,0,0,0.5)] transform -translate-x-1/2" style={{ left: `${Math.min(100, Math.max(0, riskScore))}%` }}></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
                        <span>Low Risk</span>
                        <span>High Risk</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Layout: Split View for Data Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Fraud Triangle */}
                <FraudTriangleVisualization
                  pressure={pressure}
                  opportunity={opportunity}
                  rationalization={rationalization}
                  benchmarkAvg={45}
                  industryAvg={52}
                />

                {/* Right: AI Summary */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot size={20} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Ringkasan Analisis AI</h3>
                  </div>

                  <div className="flex-1">
                    {candidate.analysis?.summary ? (
                      <p className="text-sm text-gray-700 leading-relaxed mb-4">{candidate.analysis.summary}</p>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-6 text-center h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
                        <Sparkles className="text-gray-300 mb-2" size={32} />
                        <p className="text-gray-500 text-sm font-medium">Analisis Naratif Belum Tersedia</p>
                        <p className="text-xs text-gray-400">Menunggu pemrosesan data oleh AI...</p>
                      </div>
                    )}
                  </div>

                  {candidate.analysis?.summary && (
                    <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <p className="text-xs font-bold text-blue-900 mb-1 uppercase">Rekomendasi Tindakan</p>
                      <p className="text-sm text-blue-800">
                        {candidate.analysis?.recommendation || "Lakukan verifikasi referensi standar."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Red Flags & Interview Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Red Flags */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={20} className="text-red-600" />
                    <h3 className="font-bold text-gray-800">Identifikasi Red Flags</h3>
                  </div>
                  <div className="space-y-3">
                    {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                      candidate.analysis.redFlags.map((flag, idx) => (
                        <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle size={12} className="text-red-600" />
                          </div>
                          <p className="text-sm text-red-800 leading-relaxed">{flag}</p>
                        </div>
                      ))
                    ) : (
                      // Clean State
                      <div className="p-8 bg-green-50 border border-green-100 rounded-xl text-center">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="font-bold text-green-800 mb-1">Tidak Ada Red Flag</h4>
                        <p className="text-xs text-green-600">Sistem tidak mendeteksi indikator risiko mayor pada kandidat ini.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generated Interview Guide */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare size={20} className="text-purple-600" />
                    <h3 className="font-bold text-gray-800">Panduan Wawancara (Generated)</h3>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 mb-2">Pertanyaan yang disarankan berdasarkan profil risiko kandidat:</p>
                    {interviewQuestions.map((q, i) => (
                      <div key={i} className="p-3 bg-purple-50 border border-purple-100 rounded-lg flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-purple-600 text-xs font-bold">
                          {i + 1}
                        </div>
                        <p className="text-sm text-purple-900 leading-relaxed font-medium">"{q}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
                        <div className={`max-w-2xl rounded-lg p-4 ${isAI
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
          <>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-1">Laporan Pemeriksaan Latar Belakang</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Verifikasi Identitas & KYC oleh Didit</p>
                  {candidate.backgroundCheck?.status ? (
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${candidate.backgroundCheck.status === 'approved'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : candidate.backgroundCheck.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : candidate.backgroundCheck.status === 'declined'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                      {candidate.backgroundCheck.status === 'approved' && <CheckCircle2 size={14} />}
                      {candidate.backgroundCheck.status === 'in_progress' && <Clock size={14} />}
                      {candidate.backgroundCheck.status === 'declined' && <XCircle size={14} />}
                      {candidate.backgroundCheck.status === 'pending' && <Clock size={14} />}
                      {candidate.backgroundCheck.status === 'approved' ? 'APPROVED'
                        : candidate.backgroundCheck.status === 'in_progress' ? 'IN PROGRESS'
                          : candidate.backgroundCheck.status === 'declined' ? 'DECLINED'
                            : 'PENDING'}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 rounded-full text-xs font-bold">
                      <Clock size={14} />
                      NOT STARTED
                    </div>
                  )}
                </div>

                {/* Resend KYC Button */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Status Verifikasi</div>
                  <div className={`text-3xl font-black ${candidate.backgroundCheck?.status === 'approved' ? 'text-green-600 dark:text-green-400'
                    : candidate.backgroundCheck?.status === 'declined' ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-400'
                    }`}>
                    {candidate.backgroundCheck?.status === 'approved' ? '✓'
                      : candidate.backgroundCheck?.status === 'declined' ? '✗'
                        : '--'}
                  </div>

                  {/* Show Resend Button if KYC has been initiated */}
                  {candidate.backgroundCheck?.diditSessionId && (
                    <button
                      onClick={() => setShowBgCheckModal(true)}
                      disabled={isUpdating}
                      className="mt-2 px-4 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
                      title="Kirim ulang link KYC ke kandidat (100 kredit)"
                    >
                      <Mail size={16} />
                      Kirim Ulang KYC
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Shield size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Ringkasan Pemeriksaan Latar Belakang</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Status</span>
                    <span className={`text-sm font-semibold ${candidate.backgroundCheck?.status === 'approved' ? 'text-green-600 dark:text-green-400'
                      : candidate.backgroundCheck?.status === 'declined' ? 'text-red-600 dark:text-red-400'
                        : candidate.backgroundCheck?.status === 'in_progress' ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      }`}>
                      {candidate.backgroundCheck?.status === 'approved' ? 'Approved'
                        : candidate.backgroundCheck?.status === 'declined' ? 'Declined'
                          : candidate.backgroundCheck?.status === 'in_progress' ? 'In Progress'
                            : candidate.backgroundCheck?.status === 'pending' ? 'Pending'
                              : 'Not Started'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Tanggal Verifikasi</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {candidate.backgroundCheck?.lastUpdated
                        ? new Date(candidate.backgroundCheck.lastUpdated.seconds * 1000).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                        : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Didit Session ID</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                      {candidate.backgroundCheck?.diditSessionId || '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Penyedia</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Didit KYC</span>
                  </div>
                  {candidate.backgroundCheck?.decision && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Decision</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {candidate.backgroundCheck.decision}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Status Verifikasi</h3>
                </div>
                <div className="space-y-3">
                  {candidate.backgroundCheck?.status === 'approved' && (
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                      <CheckCircle2 size={48} className="text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-1">Verifikasi Berhasil</p>
                      <p className="text-xs text-green-600 dark:text-green-500">Identitas kandidat telah diverifikasi oleh Didit KYC</p>
                    </div>
                  )}
                  {candidate.backgroundCheck?.status === 'declined' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                      <XCircle size={48} className="text-red-600 dark:text-red-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Verifikasi Ditolak</p>
                      <p className="text-xs text-red-600 dark:text-red-500">Identitas kandidat tidak dapat diverifikasi</p>
                    </div>
                  )}
                  {candidate.backgroundCheck?.status === 'in_progress' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
                      <Clock size={48} className="text-blue-600 dark:text-blue-400 mx-auto mb-2 animate-pulse" />
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">Sedang Diproses</p>
                      <p className="text-xs text-blue-600 dark:text-blue-500">Verifikasi sedang berlangsung</p>
                    </div>
                  )}
                  {!candidate.backgroundCheck?.status && (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg h-48 flex items-center justify-center">
                      <div className="text-center">
                        <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Belum Ada Data Verifikasi</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <FileText size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Verification Timeline</h3>
                </div>
                <div className="space-y-3">
                  {candidate.backgroundCheck?.createdAt && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white">Background Check Started</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(candidate.backgroundCheck.createdAt.seconds * 1000).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {candidate.backgroundCheck?.lastUpdated && (
                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white">Status Updated</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(candidate.backgroundCheck.lastUpdated.seconds * 1000).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {!candidate.backgroundCheck?.createdAt && (
                    <div className="text-center py-8">
                      <Clock size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No timeline data available</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Shield size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Verification Details</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Candidate Name</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{candidate.candidate.name}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Email</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{candidate.candidate.email}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Verification Method</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Didit KYC</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Provider</span>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Didit</span>
                  </div>
                  {candidate.backgroundCheck?.verificationLink && (
                    <div className="mt-3">
                      <a
                        href={candidate.backgroundCheck.verificationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors w-full justify-center"
                      >
                        <ExternalLink size={14} />
                        Open Verification Link
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Info Section */}
            {candidate.backgroundCheck?.decision && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Verification Decision</h3>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{candidate.backgroundCheck.decision}</p>
                </div>
              </div>
            )}

            {/* ========== NEW: KYC Data Display Section ========== */}
            {candidate.backgroundCheck?.idVerification && (
              <>
                {/* ID Document Images */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                      <CreditCard size={20} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Dokumen Identitas (KTP/ID Card)</h3>
                    <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Terverifikasi</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Front Document */}
                    <div className="relative">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Depan KTP</p>
                      {candidate.backgroundCheck.idVerification.frontImage ? (
                        <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-inner">
                          <img
                            src={`data:image/jpeg;base64,${candidate.backgroundCheck.idVerification.frontImage}`}
                            alt="ID Card Front"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[3/2] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                          <p className="text-xs text-gray-400">Tidak tersedia</p>
                        </div>
                      )}
                    </div>

                    {/* Back Document */}
                    <div className="relative">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Belakang KTP</p>
                      {candidate.backgroundCheck.idVerification.backImage ? (
                        <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-inner">
                          <img
                            src={`data:image/jpeg;base64,${candidate.backgroundCheck.idVerification.backImage}`}
                            alt="ID Card Back"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[3/2] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                          <p className="text-xs text-gray-400">Tidak tersedia</p>
                        </div>
                      )}
                    </div>

                    {/* Selfie / Portrait */}
                    <div className="relative">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Foto Selfie</p>
                      {candidate.backgroundCheck.idVerification.portraitImage ? (
                        <div className="relative aspect-[3/2] rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-inner">
                          <img
                            src={`data:image/jpeg;base64,${candidate.backgroundCheck.idVerification.portraitImage}`}
                            alt="Selfie"
                            className="w-full h-full object-cover"
                          />
                          {candidate.backgroundCheck.faceMatch?.status === 'approved' && (
                            <div className="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} /> Face Match OK
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[3/2] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                          <p className="text-xs text-gray-400">Tidak tersedia</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Information from OCR */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                      <User size={20} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Data Personal (OCR dari KTP)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Nama Lengkap</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.fullName || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">NIK / No. Dokumen</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white font-mono">{candidate.backgroundCheck.idVerification.documentNumber || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tanggal Lahir</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.dateOfBirth || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Jenis Kelamin</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.gender || '-'}</span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tempat Lahir</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.placeOfBirth || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tipe Dokumen</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.documentType || 'KTP'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status Verifikasi</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{candidate.backgroundCheck.idVerification.status || '-'}</span>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">Alamat</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{candidate.backgroundCheck.idVerification.address || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Status Badges */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Status Verifikasi</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* ID Verification */}
                    <div className={`p-4 rounded-xl text-center ${candidate.backgroundCheck.idVerification?.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      }`}>
                      <CheckCircle2 size={24} className={`mx-auto mb-2 ${candidate.backgroundCheck.idVerification?.status === 'approved'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                        }`} />
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Dokumen Asli</p>
                      <p className={`text-[10px] font-medium ${candidate.backgroundCheck.idVerification?.status === 'approved'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                        }`}>
                        {candidate.backgroundCheck.idVerification?.status || 'Checking'}
                      </p>
                    </div>

                    {/* Face Match */}
                    <div className={`p-4 rounded-xl text-center ${candidate.backgroundCheck.faceMatch?.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      }`}>
                      <User size={24} className={`mx-auto mb-2 ${candidate.backgroundCheck.faceMatch?.status === 'approved'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                        }`} />
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Face Match</p>
                      <p className={`text-[10px] font-medium ${candidate.backgroundCheck.faceMatch?.status === 'approved'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                        }`}>
                        {candidate.backgroundCheck.faceMatch?.score
                          ? `${Math.round(candidate.backgroundCheck.faceMatch.score * 100)}% match`
                          : candidate.backgroundCheck.faceMatch?.status || 'Checking'}
                      </p>
                    </div>

                    {/* Warnings */}
                    <div className={`p-4 rounded-xl text-center ${(candidate.backgroundCheck.warnings?.length || 0) === 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}>
                      <AlertTriangle size={24} className={`mx-auto mb-2 ${(candidate.backgroundCheck.warnings?.length || 0) === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                        }`} />
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Peringatan</p>
                      <p className={`text-[10px] font-medium ${(candidate.backgroundCheck.warnings?.length || 0) === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                        }`}>
                        {(candidate.backgroundCheck.warnings?.length || 0) === 0
                          ? 'Tidak Ada'
                          : `${candidate.backgroundCheck.warnings?.length} ditemukan`}
                      </p>
                    </div>

                    {/* Overall Status */}
                    <div className={`p-4 rounded-xl text-center ${candidate.backgroundCheck.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : candidate.backgroundCheck.status === 'declined'
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      }`}>
                      <Shield size={24} className={`mx-auto mb-2 ${candidate.backgroundCheck.status === 'approved'
                        ? 'text-green-600'
                        : candidate.backgroundCheck.status === 'declined'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                        }`} />
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Hasil Akhir</p>
                      <p className={`text-[10px] font-medium uppercase ${candidate.backgroundCheck.status === 'approved'
                        ? 'text-green-600'
                        : candidate.backgroundCheck.status === 'declined'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                        }`}>
                        {candidate.backgroundCheck.status}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Liveness & IP Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Liveness Detection */}
                  {candidate.backgroundCheck.liveness && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                          <Activity size={20} className="text-pink-600 dark:text-pink-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white">Liveness Detection</h3>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</span>
                          <span className={`text-sm font-bold ${candidate.backgroundCheck.liveness.status === 'approved'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                            {candidate.backgroundCheck.liveness.status || 'Checking'}
                          </span>
                        </div>

                        {candidate.backgroundCheck.liveness.score !== undefined && (
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Confidence Score</span>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                              {Math.round(candidate.backgroundCheck.liveness.score * 100)}%
                            </span>
                          </div>
                        )}

                        {candidate.backgroundCheck.liveness.ageEstimation && (
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Estimasi Usia</span>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                              ~{candidate.backgroundCheck.liveness.ageEstimation} tahun
                            </span>
                          </div>
                        )}

                        {candidate.backgroundCheck.liveness.referenceImage && (
                          <div className="mt-3">
                            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Reference Image</p>
                            <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                              <img
                                src={`data:image/jpeg;base64,${candidate.backgroundCheck.liveness.referenceImage}`}
                                alt="Liveness Reference"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* IP Analysis */}
                  {candidate.backgroundCheck.ipAnalysis && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                          <Globe size={20} className="text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white">IP Analysis</h3>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">IP Address</span>
                          <span className="text-sm font-bold text-gray-800 dark:text-white font-mono">
                            {candidate.backgroundCheck.ipAnalysis.ipAddress || '-'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Country</span>
                          <span className="text-sm font-bold text-gray-800 dark:text-white">
                            {candidate.backgroundCheck.ipAnalysis.country || '-'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">VPN/Tor Detection</span>
                          <span className={`text-sm font-bold ${candidate.backgroundCheck.ipAnalysis.isVpnOrTor
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                            }`}>
                            {candidate.backgroundCheck.ipAnalysis.isVpnOrTor ? '⚠️ Detected' : '✓ Clean'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</span>
                          <span className={`text-sm font-bold ${candidate.backgroundCheck.ipAnalysis.status === 'approved'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                            {candidate.backgroundCheck.ipAnalysis.status || 'Checking'}
                          </span>
                        </div>

                        {candidate.backgroundCheck.ipAnalysis.isVpnOrTor && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-red-700 dark:text-red-400">VPN/Tor Terdeteksi</p>
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                  Kandidat menggunakan VPN atau Tor saat verifikasi. Ini bisa mengindikasikan upaya menyembunyikan lokasi asli.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Warnings Detail */}
                {candidate.backgroundCheck.warnings && candidate.backgroundCheck.warnings.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="font-bold text-gray-800 dark:text-white">Peringatan Verifikasi</h3>
                      <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                        {candidate.backgroundCheck.warnings.length} Warning{candidate.backgroundCheck.warnings.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {candidate.backgroundCheck.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{warning}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        <strong>Catatan:</strong> Peringatan ini tidak otomatis menolak kandidat, namun perlu ditinjau lebih lanjut oleh HR.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            {/* ========== END: KYC Data Display Section ========== */}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Info size={20} className="text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white">Notes</h3>
              </div>
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Background check powered by <span className="font-semibold text-blue-600 dark:text-blue-400">Didit KYC</span>
                </p>
              </div>
            </div>
          </>
        )}

        {/* Liveness section removed */}
      </div>
    </div>
  );
};

export default CandidateDetail;
