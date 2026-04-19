
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, User, Mail, Briefcase, Loader2, AlertCircle, ChevronDown, MessageSquare, AlertTriangle, BrainCircuit, Send, Lock, Clock, KeyRound, Sparkles, Trophy, Bot } from 'lucide-react';
import { saveSessionToDB, getCompanyById, updateSessionInDB, verifyAccessCode, markAccessCodeUsed, sendAssessmentCompleteEmail, supabase, COLLECTIONS } from '../services/supabase';
import { generateNextQuestion, analyzeFraudRisk, calculateAssessmentScores } from '../services/genai';
import { AssessmentItem, CompanyProfile, InterviewSession, SJTItem, AssessmentInvite, FraudAnalysis, RiskLevel, WorkflowStep } from '../types';
import { FRAUD_TRIANGLE_QUESTIONS, SJT_SCENARIOS, FINANCIAL_STRAIN_QUESTIONS } from '../constants/assessment_questions';
import AssessmentProgress from './AssessmentProgress';
import ChatMessage from './ChatMessage';
import ConfettiAnimation from './ConfettiAnimation';

const AVAILABLE_ROLES = [
  "Manajer Keuangan", "Staff Pengadaan (Procurement)", "Kepala Gudang / Logistik",
  "Sales Manager / Tim Sales", "Kasir Senior", "Internal Auditor", "Staff Administrasi", "IT / System Admin"
];

type AssessmentStep = 'login' | 'loading' | 'welcome' | 'profile' | 'survey_ft' | 'survey_fin' | 'survey_sjt' | 'analyzing_profile' | 'intro_chat' | 'chat' | 'analyzing' | 'done';

const CHAT_TIME_LIMIT_SECONDS = 600;



interface PublicAssessmentProps {
  companyId: string | null;
}

const PublicAssessment: React.FC<PublicAssessmentProps> = ({ companyId: propCompanyId }) => {
  const [step, setStep] = useState<AssessmentStep>(propCompanyId ? 'loading' : 'login');
  const [companyId, setCompanyId] = useState<string | null>(propCompanyId);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  const [accessCode, setAccessCode] = useState('');
  const [inviteData, setInviteData] = useState<AssessmentInvite | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateRole, setCandidateRole] = useState('');

  const [ftAnswers, setFtAnswers] = useState<AssessmentItem[]>(FRAUD_TRIANGLE_QUESTIONS);
  const [finAnswers, setFinAnswers] = useState<AssessmentItem[]>(FINANCIAL_STRAIN_QUESTIONS);
  const [sjtAnswers, setSjtAnswers] = useState<SJTItem[]>(SJT_SCENARIOS);

  const [chatHistory, setChatHistory] = useState<Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [timeLeft, setTimeLeft] = useState(CHAT_TIME_LIMIT_SECONDS);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Gamification states
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const fetchCompany = async (id: string): Promise<boolean> => {
    try {
      console.log(`[PUBLIC-ASSESSMENT] Fetching company data for ID: ${id}`);
      const data = await getCompanyById(id);

      if (data) {
        console.log(`[PUBLIC-ASSESSMENT] Company data loaded:`, {
          name: data.name,
          tier: data.tier,
          hasLogo: !!data.logoUrl,
          logoLength: data.logoUrl?.length || 0,
          brandColor: data.brandColor,
          headerTitle: data.headerTitle,
          welcomeMessage: data.welcomeMessage?.substring(0, 50) + '...'
        });

        if (data.tier === 'Freemium') {
          console.warn(`[PUBLIC-ASSESSMENT] Access may be limited - Freemium tier`);
          // Freemium users can still access but with limits
        }

        setCompany(data);
        setCompanyId(id);
        console.log(`[PUBLIC-ASSESSMENT] ✅ Company data set successfully`);
        return true;
      } else {
        console.error(`[PUBLIC-ASSESSMENT] Company not found for ID: ${id}`);
        setErrorMsg("Data perusahaan untuk kode ini tidak valid.");
        return false;
      }
    } catch (err) {
      console.error(`[PUBLIC-ASSESSMENT] Error fetching company:`, err);
      setErrorMsg("Gagal memuat data perusahaan.");
      return false;
    }
  };

  useEffect(() => {
    // This effect is for GENERIC links (cid in URL)
    if (propCompanyId && !inviteData) { // Only run if it's not an access code flow
      fetchCompany(propCompanyId).then((companyLoaded) => {
        if (companyLoaded) {
          setStep('welcome');
        }
      });
    }
  }, [propCompanyId, inviteData]);

  // Update document title based on company headerTitle
  useEffect(() => {
    if (company) {
      const title = company.headerTitle || company.name || 'Assessment Portal';
      document.title = title;
      console.log(`[PUBLIC-ASSESSMENT] Document title updated to: ${title}`);
    }
  }, [company]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingCode(true);
    setErrorMsg(null);
    try {
      const invite = await verifyAccessCode(accessCode);
      if (invite) {
        // MARK CODE AS ACCESSING IMMEDIATELY AFTER VERIFICATION
        await markAccessCodeUsed(accessCode, 'ACCESSING');

        setInviteData(invite);
        setCandidateName(invite.name);
        setCandidateEmail(invite.email);
        if (invite.role) setCandidateRole(invite.role);

        const companyLoaded = await fetchCompany(invite.companyId);

        if (companyLoaded) {
          // SUCCESS: Move to next step
          setStep('welcome');

          // Update stage to 'integrity_assessment' via Cloud Function (non-blocking)
          // This uses Admin SDK so no permission issues from public page
          if (invite.applicationId) {
            console.warn('[PUBLIC-ASSESSMENT] Cloud Function stub - updateCandidateStage not called');
          }
        }

      } else {
        setErrorMsg("Kode akses tidak valid atau sudah terpakai.");
      }
    } catch (err) {
      setErrorMsg("Terjadi kesalahan verifikasi.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName || !candidateRole) return;
    setStep('survey_ft');
  };

  const handleFtChange = (id: string, value: number) => {
    setFtAnswers(prev => prev.map(item => item.id === id ? { ...item, response: value } : item));
  };
  const handleFinChange = (id: string, value: number) => {
    setFinAnswers(prev => prev.map(item => item.id === id ? { ...item, response: value } : item));
  };
  const handleSjtChange = (index: number, optionIndex: number) => {
    setSjtAnswers(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], selectedOptionIndex: optionIndex };
      return newArr;
    });
  };

  const handleStartAnalysisBridge = async () => {
    setStep('analyzing_profile');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStep('intro_chat');
  };

  const handleStartChat = async () => {
    setStep('loading');

    const initialHistory: Array<{ speaker: 'ai' | 'candidate'; text: string }> = [
      { speaker: 'ai', text: `Halo ${candidateName}, saya Alex. Terima kasih sudah mengisi survei awal. Saya ingin menggali lebih dalam tentang beberapa aspek dari jawaban Anda. Kita punya waktu sekitar 10 menit untuk berbincang. Siap untuk mulai?` }
    ];

    const now = new Date().toISOString();
    const isJobApplication = !!(inviteData?.jobId || inviteData?.applicationId);
    const sessionSource = isJobApplication ? 'job_application' : 'public_link';

    type SessionInit = Omit<InterviewSession, 'id'> & { workflowId?: string | null };
    const sessionData: SessionInit = {
      candidate: { id: Date.now().toString(), name: candidateName, email: candidateEmail, role: candidateRole },
      date: now,
      status: 'active',
      recruitmentStage: 'applied',
      structuredAssessment: ftAnswers,
      financialStrainResults: finAnswers,
      sjtResults: sjtAnswers,
      transcript: initialHistory,
      companyId: companyId || 'unknown',
      source: sessionSource,
      timeline: [
        {
          stage: 'applied',
          status: 'current' as const,
          date: now,
          note: `Kandidat Apply - Menunggu memulai assessment`
        }
      ],
      workflowId: null
    };

    if (inviteData?.jobId) {
      sessionData.jobId = inviteData.jobId;

      try {
        const { data: jobDataRow } = await supabase.from(COLLECTIONS.JOBS).select('workflowId').eq('id', inviteData.jobId).single<{ workflowId?: string }>();
        if (jobDataRow) {
          const workflowId = jobDataRow.workflowId;

          if (workflowId) {
            console.log('[PUBLIC-ASSESSMENT] Job has workflow:', workflowId);
            sessionData.workflowId = workflowId;

            const { data: workflowRow } = await supabase.from(COLLECTIONS.WORKFLOWS).select('steps').eq('id', workflowId).single<{ steps: WorkflowStep[] }>();
            if (workflowRow) {
              const workflowSteps: WorkflowStep[] = workflowRow.steps || [];
              console.log('[PUBLIC-ASSESSMENT] Loaded workflow with', workflowSteps.length, 'steps');

              const sortedSteps = [...workflowSteps].sort((a: WorkflowStep, b: WorkflowStep) => {
                if (a.id === 'integrity_assessment') return -1;
                if (b.id === 'integrity_assessment') return 1;
                return (a.order || 0) - (b.order || 0);
              });

              sessionData.timeline = sortedSteps.map((step: WorkflowStep) => ({
                stage: step.id,
                status: 'pending' as const,
                date: now,
                note: step.description || step.name,
                credits: step.credits,
                isMandatory: step.isMandatory
              }));

              sessionData.recruitmentStage = 'applied';
              console.log('[PUBLIC-ASSESSMENT] ✅ Timeline built with workflow steps, status: applied');
            }
          }
        }
      } catch (error) {
        console.error('[PUBLIC-ASSESSMENT] Error fetching job/workflow:', error);
      }
    }

    if (inviteData?.applicationId) {
      sessionData.applicationId = inviteData.applicationId;

      try {
        type AppRow = { sessionId?: string; cvUrl?: string; whatsapp?: string };
        const { data: appRow } = await supabase.from(COLLECTIONS.APPLICATIONS).select('sessionId, cvUrl, whatsapp').eq('id', inviteData.applicationId).single<AppRow>();
        if (appRow) {
          const appData = appRow;

          // Check if session already exists for this application
          if (appData.sessionId) {
            console.log('[PUBLIC-ASSESSMENT] ✅ Session already exists for application:', appData.sessionId);
            console.log('[PUBLIC-ASSESSMENT] Using existing session instead of creating new one');

            // Use existing session ID
            setSessionId(appData.sessionId);

            // Update invite status if needed
            if (inviteData?.access_code) {
              await markAccessCodeUsed(inviteData.access_code, 'IN_PROGRESS', appData.sessionId);
            }

            setChatHistory(initialHistory);
            setTimeLeft(CHAT_TIME_LIMIT_SECONDS);
            setStep('chat');
            return; // Exit early - don't create new session!
          }

          // If no existing session, add CV and WhatsApp to new session data
          if (appData.cvUrl) sessionData.cvUrl = appData.cvUrl;
          if (appData.whatsapp) sessionData.whatsapp = appData.whatsapp;
          console.log('[PUBLIC-ASSESSMENT] Added CV and WhatsApp from application:', {
            cvUrl: appData.cvUrl,
            whatsapp: appData.whatsapp
          });
        }
      } catch (error) {
        console.error('[PUBLIC-ASSESSMENT] Error fetching application data:', error);
      }
    }

    console.log('[PUBLIC-ASSESSMENT] Creating NEW session with source:', sessionSource, 'jobId:', inviteData?.jobId);

    const realSessionId = await saveSessionToDB(sessionData);
    setSessionId(realSessionId);

    // Update invite status to IN_PROGRESS
    if (inviteData?.access_code) {
      await markAccessCodeUsed(inviteData.access_code, 'IN_PROGRESS', realSessionId);
    }

    try {
      const { data: existingSession } = await supabase.from(COLLECTIONS.SESSIONS).select('timeline').eq('id', realSessionId).single<{ timeline: InterviewSession['timeline'] }>();
      const existingTimeline = existingSession?.timeline || [];
      await supabase.from(COLLECTIONS.SESSIONS).update({
        recruitmentStage: 'integrity_assessment',
        timeline: [...existingTimeline, {
          stage: 'integrity_assessment',
          status: 'current',
          date: new Date().toISOString(),
          note: 'Integrity Assessment - Mulai mengerjakan'
        }]
      }).eq('id', realSessionId);
      console.log('[PUBLIC-ASSESSMENT] ✅ Stage updated to integrity_assessment');
    } catch (error) {
      console.error('[PUBLIC-ASSESSMENT] Error updating stage:', error);
    }

    setChatHistory(initialHistory);
    setTimeLeft(CHAT_TIME_LIMIT_SECONDS);
    setStep('chat');
  };

  const handleSendMessage = async () => {
    const trimmedInput = userInput.trim();

    // Validate input
    if (!trimmedInput || !sessionId) {
      console.log('[SEND-MESSAGE] Validation failed:', { hasInput: !!trimmedInput, hasSession: !!sessionId });
      return;
    }

    console.log('[SEND-MESSAGE] Sending message:', trimmedInput.substring(0, 50));

    const newHistory = [...chatHistory, { speaker: 'candidate', text: trimmedInput } as const];
    setChatHistory(newHistory);
    setUserInput('');
    setIsAiThinking(true);
    await updateSessionInDB(sessionId, { transcript: newHistory });

    try {
      const nextQuestion = await generateNextQuestion({
        role: candidateRole,
        history: newHistory,
        assessmentData: {
          structuredAssessment: ftAnswers,
          sjtResults: sjtAnswers,
          financialStrainResults: finAnswers
        }
      });
      const updatedHistory = [...newHistory, { speaker: 'ai', text: nextQuestion } as const];
      setChatHistory(updatedHistory);
      await updateSessionInDB(sessionId, { transcript: updatedHistory });

      if (nextQuestion.toLowerCase().includes("sesi wawancara telah selesai")) {
        setTimeout(handleFinishAssessment, 2000);
      }
    } catch (error) {
      console.error('[SEND-MESSAGE] Error generating AI response:', error);
      // Add fallback message to history
      const fallbackMessage = "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai pengalaman kerja Anda?";
      const updatedHistory = [...newHistory, { speaker: 'ai', text: fallbackMessage } as const];
      setChatHistory(updatedHistory);
      await updateSessionInDB(sessionId, { transcript: updatedHistory });
    }
    finally { setIsAiThinking(false); }
  };

  const handleFinishAssessment = async () => {
    if (step === 'analyzing' || step === 'done' || !sessionId) return;
    setShowConfetti(true);
    setStep('analyzing');

    console.log('[FINISH-ASSESSMENT] Starting analysis...');
    console.log('[FINISH-ASSESSMENT] 📊 Input Data:', {
      role: candidateRole,
      historyLength: chatHistory.length,
      ftAnswersCount: ftAnswers.length,
      sjtAnswersCount: sjtAnswers.length,
      tier: company?.tier || 'Freemium'
    });

    let finalAnalysis: FraudAnalysis;

    // Add timeout to prevent infinite spinner
    const analysisTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Analysis timeout')), 30000) // 30 second timeout
    );

    try {
      console.log('[FINISH-ASSESSMENT] 🤖 Calling analyzeFraudRisk...');

      finalAnalysis = await Promise.race([
        analyzeFraudRisk(candidateRole, chatHistory, ftAnswers, sjtAnswers, company?.tier || 'Freemium'),
        analysisTimeout
      ]) as FraudAnalysis;

      console.log('[FINISH-ASSESSMENT] ✅ Analysis completed successfully!');
      console.log('[FINISH-ASSESSMENT] 📊 AI Response:', {
        scores: finalAnalysis.scores,
        riskLevel: finalAnalysis.riskLevel,
        isManualFallback: finalAnalysis.isManualFallback,
        redFlagsCount: finalAnalysis.redFlags?.length || 0,
        summaryLength: finalAnalysis.summary?.length || 0
      });

      // 🚨 CRITICAL CHECK: Detect if AI returned fallback scores
      if (finalAnalysis.scores.pressure === 50 &&
        finalAnalysis.scores.opportunity === 50 &&
        finalAnalysis.scores.rationalization === 50) {
        console.warn('[FINISH-ASSESSMENT] ⚠️ WARNING: AI returned fallback scores (50,50,50)!');
        console.warn('[FINISH-ASSESSMENT] 🔍 This indicates AI analysis may have failed silently');
        console.warn('[FINISH-ASSESSMENT] 📋 Check Cloud Function logs for errors');
      }

    } catch (error) {
      console.error("[FINISH-ASSESSMENT] ❌ Analysis failed, using fallback:", error);
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[FINISH-ASSESSMENT] 🚨 Error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack?.substring(0, 200)
      });

      const manualScores = calculateAssessmentScores(ftAnswers, sjtAnswers, finAnswers);
      console.log('[FINISH-ASSESSMENT] 📊 Manual fallback scores:', manualScores);

      const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore + manualScores.opportunityScore) / 3;
      let manualRisk = RiskLevel.LOW;
      if (avgScore > 75) manualRisk = RiskLevel.CRITICAL;
      else if (avgScore > 50) manualRisk = RiskLevel.HIGH;
      else if (avgScore > 30) manualRisk = RiskLevel.MEDIUM;

      finalAnalysis = {
        scores: { pressure: manualScores.pressureScore, opportunity: manualScores.opportunityScore, rationalization: manualScores.rationalizationScore },
        riskLevel: manualRisk,
        summary: "Laporan dibuat berdasarkan analisis manual. AI analisis tidak tersedia saat ini.",
        redFlags: ["Analisis AI tidak tersedia"],
        recommendation: "Review manual diperlukan untuk verifikasi hasil.",
        isManualFallback: true,
      } as FraudAnalysis;
    }

    try {
      type SnapRow = { timeline: InterviewSession['timeline']; workflowId?: string };
      const { data: sessionSnap } = await supabase.from(COLLECTIONS.SESSIONS).select('timeline, workflowId').eq('id', sessionId).single<SnapRow>();
      let existingTimeline: NonNullable<InterviewSession['timeline']> = [];
      let workflowId: string | null = null;

      if (sessionSnap) {
        existingTimeline = sessionSnap.timeline || [];
        workflowId = sessionSnap.workflowId || null;
      }

      const now = new Date().toISOString();

      type TlItem = NonNullable<InterviewSession['timeline']>[number];
      const updatedTimeline = existingTimeline.map((event: TlItem) => {
        // Mark current integrity_assessment as completed
        if (event.stage === 'integrity_assessment' && event.status === 'current') {
          return {
            ...event,
            status: 'completed' as const,
            completedAt: now,
            note: `${event.note || 'Assessment Integritas'} - Selesai dengan risiko: ${finalAnalysis.riskLevel}`
          };
        }
        return event;
      });

      // Find next workflow step and set as current
      const assessmentIndex = updatedTimeline.findIndex(t => t.stage === 'integrity_assessment');
      if (assessmentIndex !== -1 && assessmentIndex + 1 < updatedTimeline.length) {
        const nextStep = updatedTimeline[assessmentIndex + 1];
        if (nextStep.status === 'pending') {
          updatedTimeline[assessmentIndex + 1] = {
            ...nextStep,
            status: 'current' as const,
            date: now
          };
        }
      }

      console.log('[ASSESSMENT-COMPLETE] ✅ Updated timeline with workflow progression');
      console.log('[ASSESSMENT-COMPLETE] Workflow ID:', workflowId);

      await updateSessionInDB(sessionId, {
        status: 'completed',
        recruitmentStage: 'assessment_completed', // Changed to assessment_completed (Need Review)
        analysis: finalAnalysis,
        transcript: chatHistory,
        timeline: updatedTimeline
      });

      if (inviteData?.access_code) {
        await markAccessCodeUsed(inviteData.access_code, 'COMPLETED', sessionId);
      }

      await sendAssessmentCompleteEmail(candidateName, candidateEmail, company?.name || 'Perusahaan');

      console.log('[FINISH-ASSESSMENT] ✅ All done! Transitioning to completion page...');

      // Small delay untuk smooth transition
      setTimeout(() => {
        setStep('done');
        console.log('[FINISH-ASSESSMENT] ✅ Now showing completion page');
      }, 1000);

    } catch (dbError) {
      console.error("[FINISH-ASSESSMENT] Failed to save to DB:", dbError);
      setErrorMsg("Gagal menyimpan hasil akhir. Mohon hubungi administrator.");

      // Still show done page even if DB save fails
      setTimeout(() => setStep('done'), 2000);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'chat' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (step === 'chat' && timeLeft === 0) {
      const endMsg = { speaker: 'ai', text: "Waktu habis. Terima kasih." } as const;
      setChatHistory([...chatHistory, endMsg]);
      updateSessionInDB(sessionId, { transcript: [...chatHistory, endMsg] });
      setTimeout(handleFinishAssessment, 3000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, sessionId]); // Added sessionId to dependencies

  useEffect(() => {
    if (step === 'chat') chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, step]);

  const brandColor = company?.brandColor || '#CC5500';
  const logoUrl = company?.logoUrl;

  const Watermark = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-3 px-4 z-50 shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
        <a
          href="https://hiregood.one"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 group"
        >
          <img
            src="/untitled_design_(43).png"
            alt="HireGood Logo"
            className="h-5 w-5 object-contain"
          />
          <span className="text-xs text-gray-600 font-medium">
            Powered by <span className="font-bold text-orange-600 group-hover:text-orange-700 transition-colors">hiregood.one</span>
          </span>
        </a>
      </div>
    </div>
  );

  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans pb-20">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Seleksi Integritas</h2>
          <p className="text-gray-500 mb-6 text-sm">Masukkan kode akses unik yang dikirimkan ke email Anda untuk memulai tes.</p>

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="KODE AKSES (Contoh: X7Y9Z2)"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-orange-500 outline-none"
                maxLength={6}
              />
            </div>
            {errorMsg && <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded">{errorMsg}</p>}
            <button
              type="submit"
              disabled={isVerifyingCode || !accessCode}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 flex justify-center items-center gap-2 hover:bg-orange-700 transition-all"
            >
              {isVerifyingCode ? <Loader2 className="animate-spin" /> : "Verifikasi & Masuk"}
            </button>
          </form>
        </div>
        <Watermark />
      </div>
    );
  }

  const Header = () => {
    const displayTitle = company?.headerTitle || company?.name || 'Portal Assessment';

    // Removed excessive logging that caused infinite render loop

    return (
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 max-w-2xl">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayTitle}
              className="h-10 max-w-[200px] object-contain"
              onLoad={() => {/* Logo loaded */ }}
              onError={(e) => {
                console.error(`[HEADER] ❌ Logo failed to load:`, {
                  src: logoUrl,
                  error: e
                });
              }}
            />
          ) : (
            <>
              <ShieldCheck size={24} style={{ color: brandColor }} />
              <span className="font-bold text-xl text-gray-900 tracking-tight">{displayTitle}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4 font-sans pb-20">
        <ConfettiAnimation show={showConfetti} onComplete={() => setShowConfetti(false)} />

        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center space-y-6 animate-scale-up border-4 border-green-200">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl animate-bounce-slow">
              <Trophy size={56} className="text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-16 h-16">
              <Sparkles size={40} className="text-yellow-400 animate-spin-slow" />
            </div>
          </div>

          <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
            Selamat! 🎉
          </h2>

          <p className="text-xl text-gray-700">
            Halo <span className="font-bold text-brand-orange">{candidateName}</span>!
          </p>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-700 font-bold text-lg">
              <CheckCircle2 size={24} className="text-green-600" />
              Assessment Berhasil Diselesaikan!
            </div>
            <p className="text-sm text-gray-600">
              Semua tahapan assessment telah Anda selesaikan dengan baik. Hasil telah tersimpan dengan aman dalam sistem kami.
            </p>
          </div>

          <p className="text-gray-600 leading-relaxed">
            Tim HR akan meninjau hasil assessment Anda dan menghubungi melalui email untuk tahap selanjutnya dalam proses rekrutmen.
          </p>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 text-left space-y-3">
            <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <Mail className="text-blue-600" size={18} />
              Cek Email Anda
            </p>
            <p className="text-sm text-blue-700">
              Notifikasi dan undangan tahap berikutnya akan dikirim ke:
            </p>
            <p className="font-semibold text-blue-900 bg-blue-100 p-2 rounded text-center">
              {candidateEmail}
            </p>
          </div>

          <div className="pt-4 border-t-2 border-gray-100">
            <p className="text-lg font-semibold text-gray-700 mb-2">
              Terima kasih atas partisipasi Anda!
            </p>
            <p className="text-sm text-gray-500">
              Semoga berhasil di tahap selanjutnya! 🚀
            </p>
          </div>
        </div>
        <Watermark />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      <Header />
      <div className="max-w-2xl mx-auto p-6">

        {step === 'welcome' && (
          <div className="bg-gradient-to-br from-white to-orange-50 rounded-3xl shadow-2xl border-2 border-orange-200 p-10 text-center mt-10 animate-scale-up">
            {isAccessDenied ? (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock size={48} className="text-red-500" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Akses Terbatas</h1>
                <p className="text-gray-600 mb-4">Perusahaan ini menggunakan paket Basic dan belum mengaktifkan fitur link publik.</p>
                <p className="text-sm text-gray-500">Hubungi admin perusahaan untuk informasi lebih lanjut.</p>
              </>
            ) : (
              <>
                <div className="mb-6 relative">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-xl animate-bounce-slow" style={{ backgroundColor: `${brandColor}20` }}>
                    <Briefcase size={56} style={{ color: brandColor }} />
                  </div>
                  <div className="absolute -top-2 -right-12 sm:right-1/3">
                    <Sparkles size={28} className="text-yellow-400 animate-pulse" />
                  </div>
                </div>

                <h1 className="text-4xl font-black text-gray-900 mb-3">
                  {company?.headerTitle || company?.name}
                </h1>

                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md border border-gray-200 mb-6">
                  <ShieldCheck size={20} style={{ color: brandColor }} />
                  <span className="text-sm font-semibold text-gray-700">Integrity Assessment</span>
                </div>

                <p className="text-gray-700 mb-8 leading-relaxed max-w-lg mx-auto text-lg">
                  {company?.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.'}
                </p>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 max-w-md mx-auto">
                  <div className="flex items-start gap-3 text-left">
                    <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-900 mb-1">Durasi: ~15-20 Menit</p>
                      <p className="text-xs text-blue-700">Assessment terdiri dari 3 bagian survey dan 1 sesi wawancara AI</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep('profile')}
                  className="w-full text-white py-5 rounded-xl font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all text-lg flex items-center justify-center gap-3"
                  style={{ backgroundColor: brandColor }}
                >
                  <span>Mulai Assessment</span>
                  <ArrowRight size={24} />
                </button>
              </>
            )}
          </div>
        )}

        {step === 'profile' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 mt-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <User className="text-white" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Identitas Diri</h2>
            </div>
            {inviteData && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <Lock size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Data Terisi Otomatis dari Undangan</p>
                  <p className="text-blue-700">Nama, email, dan posisi telah diisi sesuai dengan undangan yang Anda terima dan tidak dapat diubah.</p>
                </div>
              </div>
            )}
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <User size={16} />
                  Nama Lengkap
                </label>
                <input
                  required
                  type="text"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Masukkan nama lengkap Anda"
                  disabled={!!inviteData}
                  readOnly={!!inviteData}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={candidateEmail}
                  onChange={e => setCandidateEmail(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="email@example.com"
                  disabled={!!inviteData}
                  readOnly={!!inviteData}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Briefcase size={16} />
                  Posisi
                </label>
                <div className="relative">
                  <select
                    required
                    value={candidateRole}
                    onChange={e => setCandidateRole(e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl bg-white appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!!inviteData?.role}
                  >
                    <option value="" disabled>-- Pilih Posisi --</option>
                    {AVAILABLE_ROLES.map((role, idx) => <option key={idx} value={role}>{role}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={24} />
                </div>
              </div>
              <button
                type="submit"
                className="w-full text-white py-4 rounded-xl font-bold mt-6 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                <span>Lanjut ke Survey</span>
                <ArrowRight size={20} />
              </button>
            </form>
          </div>
        )}

        {/* ====================================================== */}
        {/* ========= RESTORED SURVEY BLOCKS START HERE ========== */}
        {/* ====================================================== */}

        {step === 'survey_ft' && (
          <div className="space-y-6 animate-fade-in">
            {/* Progress Bar */}
            <AssessmentProgress
              currentStep={ftAnswers.filter(a => a.response !== null).length}
              totalSteps={ftAnswers.length}
              stepName="Kuesioner Gaya Kerja"
            />

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm font-medium flex items-center gap-2">
              <BrainCircuit size={20} />
              <span>Bagian 1/3: Kuesioner Gaya Kerja</span>
            </div>

            {ftAnswers.map((item, idx) => (
              <div key={item.id} className={`bg-white p-6 rounded-2xl shadow-md border-2 transition-all duration-300 ${item.response !== null ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="font-bold text-gray-800 flex-1">{item.question}</p>
                  {item.response !== null && (
                    <CheckCircle2 size={24} className="text-green-500 animate-scale-in" />
                  )}
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => handleFtChange(item.id, val)}
                      className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all transform hover:scale-105 active:scale-95 ${item.response === val ? 'text-white shadow-lg scale-105' : 'text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-400'}`}
                      style={item.response === val ? { backgroundColor: brandColor, borderColor: brandColor } : { borderColor: '#e5e7eb' }}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span>Tidak Setuju</span>
                  <span>Sangat Setuju</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => setStep('survey_fin')}
              disabled={ftAnswers.some(a => a.response === null)}
              className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              <span>Lanjut ke Bagian 2</span>
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scale-in {
            from { transform: scale(0); }
            to { transform: scale(1); }
          }
          @keyframes scale-up {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
          .animate-scale-in {
            animation: scale-in 0.3s ease-out;
          }
          .animate-scale-up {
            animation: scale-up 0.6s ease-out;
          }
          .animate-bounce-slow {
            animation: bounce-slow 2s ease-in-out infinite;
          }
          .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
          }
        `}</style>

        {step === 'survey_fin' && (
          <div className="space-y-6 animate-fade-in">
            {/* Progress Bar */}
            <AssessmentProgress
              currentStep={finAnswers.filter(a => a.response !== null).length}
              totalSteps={finAnswers.length}
              stepName="Survei Finansial"
            />

            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>Bagian 2/3: Survei Finansial</span>
            </div>

            {finAnswers.map((item, idx) => (
              <div key={item.id} className={`bg-white p-6 rounded-2xl shadow-md border-2 transition-all duration-300 ${item.response !== null ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="font-bold text-gray-800 flex-1">{item.question}</p>
                  {item.response !== null && (
                    <CheckCircle2 size={24} className="text-green-500 animate-scale-in" />
                  )}
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => handleFinChange(item.id, val)}
                      className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all transform hover:scale-105 active:scale-95 ${item.response === val ? 'bg-red-500 text-white border-red-500 shadow-lg scale-105' : 'text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-400'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span>Tidak Setuju</span>
                  <span>Sangat Setuju</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => setStep('survey_sjt')}
              disabled={finAnswers.some(a => a.response === null)}
              className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              <span>Lanjut ke Bagian 3</span>
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {step === 'survey_sjt' && (
          <div className="space-y-6 animate-fade-in">
            {/* Progress Bar */}
            <AssessmentProgress
              currentStep={sjtAnswers.filter(a => a.selectedOptionIndex !== null).length}
              totalSteps={sjtAnswers.length}
              stepName="Studi Kasus"
            />

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100 text-purple-800 text-sm font-medium flex items-center gap-2">
              <MessageSquare size={20} />
              <span>Bagian 3/3: Studi Kasus</span>
            </div>

            {sjtAnswers.map((item, idx) => (
              <div key={item.id} className={`bg-white p-6 rounded-2xl shadow-md border-2 transition-all duration-300 ${item.selectedOptionIndex !== null ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 mb-2 italic">"{item.scenario}"</p>
                    {item.selectedOptionIndex !== null && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle2 size={16} />
                        <span>Dijawab ✓</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {item.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => handleSjtChange(idx, optIdx)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center transform hover:scale-[1.02] active:scale-[0.98] ${item.selectedOptionIndex === optIdx ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-500 text-purple-900 font-medium shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-400'}`}
                    >
                      <span>{opt.label}</span>
                      {item.selectedOptionIndex === optIdx && <CheckCircle2 size={20} className="text-purple-600 animate-scale-in" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleStartAnalysisBridge}
              disabled={sjtAnswers.some(a => a.selectedOptionIndex === null)}
              className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              <Trophy size={20} />
              <span>Selesai & Mulai Interview</span>
            </button>
          </div>
        )}

        {/* ==================================================== */}
        {/* ========= RESTORED SURVEY BLOCKS END HERE ========== */}
        {/* ==================================================== */}

        {step === 'analyzing_profile' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-200 p-10 mt-10 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                <BrainCircuit size={56} className="text-white" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-4 border-purple-300 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Menganalisis Profil Anda...</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              AI kami sedang memproses jawaban survei Anda untuk mempersiapkan pertanyaan interview yang personal.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-purple-600 font-medium">
                <CheckCircle2 size={16} className="animate-scale-in" />
                <span>Menganalisis pola jawaban</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-purple-600 font-medium">
                <CheckCircle2 size={16} className="animate-scale-in" style={{ animationDelay: '0.3s' }} />
                <span>Menyusun pertanyaan follow-up</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-purple-600 font-medium">
                <Loader2 size={16} className="animate-spin" />
                <span>Mempersiapkan sesi wawancara...</span>
              </div>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-green-200 p-10 mt-10 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                <Trophy size={56} className="text-white" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-4 border-green-300 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Menyelesaikan Assessment...</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Kami sedang menganalisis seluruh jawaban Anda dan menyusun laporan komprehensif.
            </p>
            <div className="space-y-3 max-w-md mx-auto">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                <span className="text-gray-600 font-medium">Survey</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                <span className="text-gray-600 font-medium">Interview</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Loader2 size={18} className="text-yellow-600 animate-spin flex-shrink-0" />
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                </div>
                <span className="text-gray-600 font-medium">Analisis</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 italic mt-6">
              Mohon tunggu sebentar, ini tidak akan lama... ⏳
            </p>
          </div>
        )}

        {step === 'intro_chat' && (
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl border-2 border-purple-200 p-10 mt-10 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce-slow">
                <MessageSquare size={48} className="text-white" />
              </div>
              <div className="absolute -top-2 -right-6">
                <Sparkles size={32} className="text-yellow-400 animate-pulse" />
              </div>
            </div>

            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-3">
              Sesi Wawancara AI
            </h2>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6 inline-flex items-center gap-2">
              <Clock size={24} className="text-purple-600" />
              <span className="text-xl font-bold text-purple-900">10 Menit</span>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed max-w-md mx-auto">
              Terakhir, Anda akan melakukan sesi chat singkat dengan <span className="font-bold text-purple-600">Alex</span> - Asisten Virtual kami untuk memverifikasi beberapa jawaban.
            </p>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-8 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-bold text-yellow-900 mb-1">⏰ Perhatian Waktu</p>
                  <p className="text-xs text-yellow-800">
                    Timer akan dimulai saat Anda klik tombol di bawah. Pastikan koneksi internet Anda stabil dan Anda siap untuk menjawab.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartChat}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-5 rounded-xl font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all flex items-center justify-center gap-3 text-lg"
            >
              <span>Mulai Wawancara Sekarang</span>
              <ArrowRight size={24} />
            </button>

            <p className="text-xs text-gray-500 mt-4 italic">
              💡 Tips: Jawab dengan jujur dan natural untuk hasil terbaik
            </p>
          </div>
        )}

        {step === 'chat' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[75vh] animate-fade-in">
            {/* Header with Timer */}
            <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white flex justify-between items-center sticky top-0 z-10 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold border-2 border-white/50 relative">
                  <Bot size={24} />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                </div>
                <div>
                  <p className="font-bold text-white">Alex - AI Interviewer</p>
                  <p className="text-xs text-white/80 flex items-center gap-1">
                    <Sparkles size={12} />
                    HireGood.one Forensic
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 backdrop-blur ${timeLeft < 60 ? 'bg-red-500/90 text-white border-white/50 animate-pulse' : 'bg-white/20 text-white border-white/30'}`}>
                <Clock size={16} />
                <span className="text-sm font-mono font-bold">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-gradient-to-b from-gray-50 to-white">
              {chatHistory.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  speaker={msg.speaker}
                  text={msg.text}
                  isNew={idx === chatHistory.length - 1}
                  isTyping={false}
                />
              ))}
              {isAiThinking && (
                <ChatMessage
                  speaker="ai"
                  text=""
                  isTyping={true}
                />
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t-2 border-gray-100 sticky bottom-0 z-10 shadow-lg">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (userInput.trim() && !isAiThinking && timeLeft > 0) {
                        handleSendMessage();
                      }
                    }
                  }}
                  placeholder="Ketik jawaban Anda..."
                  className="flex-1 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  disabled={isAiThinking || timeLeft === 0}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isAiThinking || timeLeft === 0}
                  className="px-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Send size={20} />
                </button>
              </div>
              {timeLeft < 60 && (
                <p className="text-xs text-red-600 font-medium mt-2 animate-pulse">⏰ Waktu hampir habis! Segera kirim jawaban Anda.</p>
              )}
            </div>
          </div>
        )}
      </div>
      <Watermark />
    </div>
  );
};

export default PublicAssessment;
