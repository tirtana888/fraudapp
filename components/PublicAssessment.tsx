
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, User, Mail, Briefcase, Loader2, AlertCircle, ChevronDown, MessageSquare, AlertTriangle, BrainCircuit, Send, Lock, Clock, KeyRound } from 'lucide-react';
import { saveSessionToDB, getCompanyById, updateSessionInDB, verifyAccessCode, markAccessCodeUsed, sendAssessmentCompleteEmail, db, COLLECTIONS } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateNextQuestion, analyzeFraudRisk, calculateAssessmentScores } from '../services/genai';
import { AssessmentItem, CompanyProfile, InterviewSession, SJTItem, AssessmentInvite, FraudAnalysis, RiskLevel } from '../types';
import { FRAUD_TRIANGLE_QUESTIONS, SJT_SCENARIOS, FINANCIAL_STRAIN_QUESTIONS } from '../constants/assessment_questions';

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

          if (data.tier === 'Basic') {
              console.warn(`[PUBLIC-ASSESSMENT] Access denied - Basic tier`);
              setIsAccessDenied(true);
              setStep('welcome'); // Show access denied message on welcome screen
              return false;
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

              if(companyLoaded) {
                  // SUCCESS: Move to next step
                  setStep('welcome');
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

      // Determine source based on invite data
      const isJobApplication = !!(inviteData?.jobId || inviteData?.applicationId);
      const sessionSource = isJobApplication ? 'job_application' : 'public_link';

      const sessionData: any = {
          candidate: { id: Date.now().toString(), name: candidateName, email: candidateEmail, role: candidateRole },
          date: new Date().toISOString(),
          status: 'active',
          structuredAssessment: ftAnswers,
          financialStrainResults: finAnswers,
          sjtResults: sjtAnswers,
          transcript: initialHistory,
          companyId: companyId || 'unknown',
          source: sessionSource
      };

      // Add job-related fields if this is a job application
      if (inviteData?.jobId) {
          sessionData.jobId = inviteData.jobId;
      }
      if (inviteData?.applicationId) {
          sessionData.applicationId = inviteData.applicationId;

          // Fetch application data to get cvUrl and whatsapp
          try {
              const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, inviteData.applicationId));
              if (appDoc.exists()) {
                  const appData = appDoc.data();
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

      console.log('[PUBLIC-ASSESSMENT] Creating session with source:', sessionSource, 'jobId:', inviteData?.jobId);

      const realSessionId = await saveSessionToDB(sessionData);
      setSessionId(realSessionId);

      // Update invite status to IN_PROGRESS
      if (inviteData?.access_code) {
          await markAccessCodeUsed(inviteData.access_code, 'IN_PROGRESS', realSessionId);
      }

      setChatHistory(initialHistory);
      setTimeLeft(CHAT_TIME_LIMIT_SECONDS);
      setStep('chat');
  };

  const handleSendMessage = async () => {
      if (!userInput.trim() || !sessionId) return;
      const newHistory = [...chatHistory, { speaker: 'candidate', text: userInput } as const];
      setChatHistory(newHistory);
      setUserInput('');
      setIsAiThinking(true);
      await updateSessionInDB(sessionId, { transcript: newHistory });

      try {
          const nextQuestion = await generateNextQuestion(
              candidateRole,
              newHistory,
              company?.tier || 'Basic',
              { structuredAssessment: ftAnswers, sjtResults: sjtAnswers, financialStrainResults: finAnswers }
          );
          const updatedHistory = [...newHistory, { speaker: 'ai', text: nextQuestion } as const];
          setChatHistory(updatedHistory);
          await updateSessionInDB(sessionId, { transcript: updatedHistory });

          if (nextQuestion.toLowerCase().includes("sesi wawancara telah selesai")) {
              setTimeout(handleFinishAssessment, 2000);
          }
      } catch (error) { console.error(error); } 
      finally { setIsAiThinking(false); }
  };

  const handleFinishAssessment = async () => {
    if (step === 'analyzing' || step === 'done' || !sessionId) return;
    setStep('analyzing');
    
    let finalAnalysis: FraudAnalysis;
    try {
      finalAnalysis = await analyzeFraudRisk(candidateRole, chatHistory, ftAnswers, sjtAnswers, company?.tier || 'Basic');
    } catch (error) {
      console.error("CRITICAL: analyzeFraudRisk threw an unexpected error. Generating emergency fallback.", error);
      const manualScores = calculateAssessmentScores(ftAnswers, sjtAnswers, finAnswers);
      const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore + manualScores.opportunityScore) / 3;
      let manualRisk = RiskLevel.LOW;
      if (avgScore > 75) manualRisk = RiskLevel.CRITICAL;
      else if (avgScore > 50) manualRisk = RiskLevel.HIGH;
      else if (avgScore > 30) manualRisk = RiskLevel.MEDIUM;

      finalAnalysis = {
          scores: { pressure: manualScores.pressureScore, opportunity: manualScores.opportunityScore, rationalization: manualScores.rationalizationScore },
          riskLevel: manualRisk,
          summary: "Laporan GAGAL dibuat karena gangguan koneksi saat analisis AI. Skor dihitung berdasarkan jawaban kuesioner saja. Mohon review manual.",
          redFlags: ["ANALISIS AI GAGAL TOTAL"],
          recommendation: "Lakukan review manual transkrip dan jawaban yang tersimpan.",
          isManualFallback: true,
      } as FraudAnalysis;
    }

    try {
      await updateSessionInDB(sessionId, {
        status: 'completed',
        analysis: finalAnalysis,
        transcript: chatHistory
        // source field is NOT updated here to preserve original source set during session creation
      });

      // Update invite status to COMPLETED
      if (inviteData?.access_code) {
          await markAccessCodeUsed(inviteData.access_code, 'COMPLETED', sessionId);
      }

      // Send email notification
      await sendAssessmentCompleteEmail(candidateName, candidateEmail, company?.name || 'Perusahaan');

      setStep('done');
    } catch (dbError) {
      console.error("Failed to save final session to DB:", dbError);
      setErrorMsg("Gagal menyimpan hasil akhir. Mohon hubungi administrator.");
      setStep('chat');
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

  if (step === 'login') {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
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
          </div>
      );
  }

  const Header = () => {
    console.log(`[HEADER] Rendering header with logoUrl:`, {
      hasLogoUrl: !!logoUrl,
      logoLength: logoUrl?.length || 0,
      companyName: company?.name,
      headerTitle: company?.headerTitle
    });

    return (
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-8 object-contain"
                onLoad={() => console.log(`[HEADER] ✅ Logo image loaded successfully`)}
                onError={(e) => console.error(`[HEADER] ❌ Logo image failed to load`, e)}
              />
            ) : (
              <ShieldCheck size={24} style={{ color: brandColor }} />
            )}
            <span className="font-bold text-xl text-gray-900 tracking-tight">{company?.headerTitle || company?.name}</span>
          </div>
      </div>
    );
  };
  
  if (step === 'done') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 p-4 font-sans">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={48} className="text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">Terima Kasih!</h2>
            <p className="text-lg text-gray-700">
              Halo <span className="font-bold text-brand-orange">{candidateName}</span>,
            </p>
            <p className="text-gray-600 leading-relaxed">
              Asesmen Anda telah berhasil diselesaikan dan hasil telah tersimpan dengan aman.
              Tim HR akan meninjau hasil Anda dan menghubungi melalui email untuk tahap selanjutnya.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <Mail className="text-blue-600" size={16} />
                Cek Email Anda
              </p>
              <p className="text-xs text-blue-700">
                Kami akan mengirimkan undangan untuk tahap selanjutnya ke <span className="font-semibold">{candidateEmail}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 italic">
              Semoga berhasil! 🎉
            </p>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      <Header />
      <div className="max-w-2xl mx-auto p-6">
        
        {step === 'welcome' && (
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center mt-10">
               <Briefcase size={40} className="mx-auto mb-6 text-orange-600" />
               <h1 className="text-2xl font-bold text-gray-900 mb-4">Portal Asesmen Kandidat</h1>
               <p className="text-gray-500 mb-8">{company?.welcomeMessage}</p>
               <button onClick={() => setStep('profile')} className="w-full text-white py-4 rounded-xl font-bold shadow-lg" style={{ backgroundColor: brandColor }}>Mulai Proses</button>
           </div>
        )}

        {step === 'profile' && (
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-6">
               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><User /> Identitas Diri</h2>
               {inviteData && (
                 <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                   <Lock size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                   <div className="text-sm">
                     <p className="font-semibold text-blue-900 mb-1">Data Terisi Otomatis dari Undangan</p>
                     <p className="text-blue-700">Nama, email, dan posisi telah diisi sesuai dengan undangan yang Anda terima dan tidak dapat diubah.</p>
                   </div>
                 </div>
               )}
               <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lengkap</label>
                    <input
                      required
                      type="text"
                      value={candidateName}
                      onChange={e => setCandidateName(e.target.value)}
                      className="w-full p-3 border rounded-xl disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!!inviteData}
                      readOnly={!!inviteData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                    <input
                      required
                      type="email"
                      value={candidateEmail}
                      onChange={e => setCandidateEmail(e.target.value)}
                      className="w-full p-3 border rounded-xl disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!!inviteData}
                      readOnly={!!inviteData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Posisi</label>
                    <div className="relative">
                        <select
                          required
                          value={candidateRole}
                          onChange={e => setCandidateRole(e.target.value)}
                          className="w-full p-3 border rounded-xl bg-white appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                          disabled={!!inviteData?.role}
                        >
                            <option value="" disabled>-- Pilih Posisi --</option>
                            {AVAILABLE_ROLES.map((role, idx) => <option key={idx} value={role}>{role}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={20} />
                    </div>
                  </div>
                  <button type="submit" className="w-full text-white py-3 rounded-xl font-bold mt-4" style={{ backgroundColor: brandColor }}>Lanjut</button>
               </form>
           </div>
        )}

        {/* ====================================================== */}
        {/* ========= RESTORED SURVEY BLOCKS START HERE ========== */}
        {/* ====================================================== */}
        
        {step === 'survey_ft' && (
           <div className="space-y-6">
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm font-medium">Bagian 1/3: Kuesioner Gaya Kerja</div>
               {ftAnswers.map((item) => (
                 <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <p className="font-bold text-gray-800 mb-4">{item.question}</p>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(val => (
                            <button key={val} onClick={() => handleFtChange(item.id, val)} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${item.response === val ? 'text-white' : 'text-gray-500 bg-white hover:bg-gray-50'}`} style={item.response === val ? { backgroundColor: brandColor, borderColor: brandColor } : { borderColor: '#e5e7eb' }}>{val}</button>
                        ))}
                    </div>
                 </div>
               ))}
               <button onClick={() => setStep('survey_fin')} disabled={ftAnswers.some(a => a.response === null)} className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50" style={{ backgroundColor: brandColor }}>Lanjut</button>
           </div>
        )}

        {step === 'survey_fin' && (
            <div className="space-y-6">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm font-medium">Bagian 2/3: Survei Finansial</div>
                {finAnswers.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                     <p className="font-bold text-gray-800 mb-4">{item.question}</p>
                     <div className="flex gap-2">
                         {[1, 2, 3, 4, 5].map(val => (
                             <button key={val} onClick={() => handleFinChange(item.id, val)} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${item.response === val ? 'bg-red-500 text-white border-red-500' : 'text-gray-500 bg-white hover:bg-gray-50'}`}>{val}</button>
                         ))}
                     </div>
                  </div>
                ))}
                <button onClick={() => setStep('survey_sjt')} disabled={finAnswers.some(a => a.response === null)} className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50" style={{ backgroundColor: brandColor }}>Lanjut</button>
            </div>
        )}

        {step === 'survey_sjt' && (
            <div className="space-y-6">
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-purple-800 text-sm font-medium">Bagian 3/3: Studi Kasus</div>
                {sjtAnswers.map((item, idx) => (
                  <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                     <p className="font-bold text-gray-800 mb-4 italic">"{item.scenario}"</p>
                     <div className="space-y-3">
                        {item.options.map((opt, optIdx) => (
                            <button key={optIdx} onClick={() => handleSjtChange(idx, optIdx)} className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${item.selectedOptionIndex === optIdx ? 'bg-purple-50 border-purple-500 text-purple-900 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                {opt.label}
                                {item.selectedOptionIndex === optIdx && <CheckCircle2 size={16} className="text-purple-600" />}
                            </button>
                        ))}
                     </div>
                  </div>
                ))}
                <button onClick={handleStartAnalysisBridge} disabled={sjtAnswers.some(a => a.selectedOptionIndex === null)} className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50" style={{ backgroundColor: brandColor }}>Selesai & Mulai Interview</button>
            </div>
        )}
        
        {/* ==================================================== */}
        {/* ========= RESTORED SURVEY BLOCKS END HERE ========== */}
        {/* ==================================================== */}
        
        {step === 'intro_chat' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-10 text-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Clock size={32} className="text-brand-orange" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Sesi Wawancara AI (10 Menit)</h2>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    Terakhir, Anda akan melakukan sesi chat singkat dengan Asisten Virtual kami untuk memverifikasi beberapa jawaban. 
                    <br/><br/><strong>Waktu dibatasi 10 menit. Sistem akan otomatis menutup sesi jika waktu habis.</strong>
                </p>
                <button onClick={handleStartChat} className="w-full bg-brand-orange text-white py-4 rounded-xl font-bold shadow-lg hover:opacity-90">
                    Mulai Wawancara (Timer Start)
                </button>
            </div>
        )}

        {step === 'chat' && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[75vh]">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold">AI</div>
                        <div>
                            <p className="font-bold text-gray-800">Interviewer</p>
                            <p className="text-xs text-gray-500">FraudGuard Forensic</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                         <Clock size={14} />
                         <span className="text-xs font-mono font-bold">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm leading-relaxed ${msg.speaker === 'ai' ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none' : 'bg-brand-blue text-white rounded-tr-none'}`}>{msg.text}</div>
                        </div>
                    ))}
                    {isAiThinking && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-400 text-xs"><Loader2 className="animate-spin" size={14} /> Sedang mengetik...</div></div>}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-white border-t sticky bottom-0 z-10">
                    <div className="flex gap-2">
                        <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ketik jawaban Anda..." className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue" disabled={isAiThinking || timeLeft === 0} />
                        <button onClick={handleSendMessage} disabled={!userInput.trim() || isAiThinking || timeLeft === 0} className="p-3 bg-brand-blue text-white rounded-xl hover:opacity-90 disabled:opacity-50"><Send size={20} /></button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicAssessment;
