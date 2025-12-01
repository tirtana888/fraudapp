
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, StopCircle, User, Bot, Briefcase, ChevronDown, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Save, ClipboardEdit, BrainCircuit, DollarSign, Lock } from 'lucide-react';
import { InterviewSession, Candidate, AssessmentItem, SJTItem, CompanyProfile } from '../types';
import { generateNextQuestion, analyzeFraudRisk } from '../services/genai';
import { saveSessionToDB, updateSessionInDB, getCompanyById } from '../services/firebase';

interface ActiveInterviewProps {
  onComplete: () => void;
  initialCandidate?: Candidate;
  companyId: string;
  existingSession?: InterviewSession;
}

const AVAILABLE_POSITIONS = [
  "Manajer Keuangan", "Staff Pengadaan", "Kepala Gudang", "Sales Manager", "Kasir Senior", "Internal Auditor"
];

// --- MODULE 1: BASIC ASSESSMENT (EXPANDED TO 10 ITEMS) ---
const BASIC_ASSESSMENT_ITEMS: AssessmentItem[] = [
  // Pressure (Tekanan)
  { id: 'p1', category: 'pressure', question: 'Apakah kandidat memiliki hutang atau kewajiban finansial yang mendesak?', response: null },
  { id: 'p2', category: 'pressure', question: 'Apakah gaya hidup kandidat terlihat melebihi standar penghasilan (Hedonisme)?', response: null },
  { id: 'p3', category: 'pressure', question: 'Apakah ada tanda-tanda kecanduan (judi/investasi berisiko/gaya hidup)?', response: null },
  
  // Opportunity (Peluang)
  { id: 'o1', category: 'opportunity', question: 'Pemahaman tentang pemisahan tugas (segregation of duties)?', response: null },
  { id: 'o2', category: 'opportunity', question: 'Apakah posisi ini memiliki akses tak terbatas ke aset/kas?', response: null },
  { id: 'o3', category: 'opportunity', question: 'Riwayat bekerja tanpa pengawasan ketat?', response: null },
  { id: 'o4', category: 'opportunity', question: 'Apakah kandidat sering bekerja di luar jam kantor tanpa alasan jelas?', response: null },
  
  // Rationalization (Rasionalisasi)
  { id: 'r1', category: 'rationalization', question: 'Sikap terhadap "peminjaman" aset kantor untuk pribadi?', response: null },
  { id: 'r2', category: 'rationalization', question: 'Sikap terhadap pelanggaran aturan kecil (misal: SOP administrasi)?', response: null },
  { id: 'r3', category: 'rationalization', question: 'Apakah kandidat merasa "berhak" (entitlement) atas kompensasi lebih?', response: null },
];

// --- MODULE 1 EXTENSION: FINANCIAL STRAIN (PREMIUM+) ---
const FINANCIAL_STRAIN_ITEMS: AssessmentItem[] = [
  { id: 'fs1', category: 'financial_strain', question: 'Indikasi ketidakpuasan terhadap gaji saat ini dibandingkan beban kerja?', response: null },
  { id: 'fs2', category: 'financial_strain', question: 'Apakah kandidat sering mengeluh tentang biaya hidup atau kebutuhan mendadak?', response: null },
  { id: 'fs3', category: 'financial_strain', question: 'Apakah kandidat memiliki sumber penghasilan lain yang mencurigakan?', response: null },
  { id: 'fs4', category: 'financial_strain', question: 'Apakah kandidat sering meminta kasbon atau pinjaman ke rekan kerja?', response: null },
];

// --- MODULE 2: SITUATIONAL JUDGMENT TEST (PREMIUM+) ---
const SJT_SCENARIOS: SJTItem[] = [
  {
    id: 'sjt1',
    scenario: "Rekan kerja Anda, yang sedang kesulitan biaya pengobatan anaknya, meminta Anda memanipulasi sedikit laporan lembur agar ia mendapat tambahan uang. Ia berjanji hanya sekali ini saja. Apa yang Anda lakukan?",
    options: [
      { label: "Melaporkan rekan tersebut ke HR segera.", riskWeight: 'low' },
      { label: "Menolak permintaannya dan menasihatinya.", riskWeight: 'medium' },
      { label: "Membantunya karena alasan kemanusiaan, hanya sekali.", riskWeight: 'high' },
    ],
    selectedOptionIndex: null
  },
  {
    id: 'sjt2',
    scenario: "Anda menemukan celah dalam sistem pengadaan yang memungkinkan mark-up harga tanpa terdeteksi auditor. Atasan Anda tahu tapi diam saja. Tindakan Anda?",
    options: [
      { label: "Membiarkannya karena itu tanggung jawab atasan.", riskWeight: 'high' },
      { label: "Mendiskusikan dengan atasan untuk menutup celah itu.", riskWeight: 'medium' },
      { label: "Membuat laporan anonim ke bagian kepatuhan (Whistleblowing).", riskWeight: 'low' },
    ],
    selectedOptionIndex: null
  }
];

const ActiveInterview: React.FC<ActiveInterviewProps> = ({ onComplete, initialCandidate, companyId, existingSession }) => {
  // Steps: setup -> structured (basic) -> sjt (psychometric) -> interview (AI) -> analyzing
  const [step, setStep] = useState<'setup' | 'structured' | 'sjt' | 'interview' | 'analyzing' | 'saving'>('setup');
  
  // Data State
  const [candidateName, setCandidateName] = useState(initialCandidate?.name || '');
  const [candidateRole, setCandidateRole] = useState(initialCandidate?.role || '');
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>(BASIC_ASSESSMENT_ITEMS);
  const [sjtItems, setSjtItems] = useState<SJTItem[]>(SJT_SCENARIOS);
  const [history, setHistory] = useState<Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>>([]);
  const [companyTier, setCompanyTier] = useState<'Basic' | 'Premium' | 'Enterprise'>('Basic');
  
  // UI State
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Data & Check Tier
  useEffect(() => {
    const init = async () => {
        // 1. Fetch Tier
        const comp = await getCompanyById(companyId);
        const tier = comp?.tier || 'Basic';
        setCompanyTier(tier);

        // 2. Adjust Assessment Items based on Tier
        let items = [...BASIC_ASSESSMENT_ITEMS];
        if (tier === 'Premium' || tier === 'Enterprise') {
            items = [...items, ...FINANCIAL_STRAIN_ITEMS];
        }

        // 3. Load Existing Session
        if (existingSession) {
            setCandidateName(existingSession.candidate.name);
            setCandidateRole(existingSession.candidate.role);
            if (existingSession.structuredAssessment && existingSession.structuredAssessment.length > 5) {
                // If reviewing, use what's in DB (which might be the self-assessment items)
                // We merge logic here: display what user answered
                setAssessmentItems(existingSession.structuredAssessment);
            } else {
                setAssessmentItems(items);
            }
            if (existingSession.sjtResults) setSjtItems(existingSession.sjtResults);
            setStep('structured');
        } else {
            setAssessmentItems(items);
        }
    };
    init();
  }, [existingSession, companyId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, currentQuestion]);

  const handleStartAssessment = () => {
    if (!candidateName || !candidateRole) return;
    setStep('structured');
  };

  const handleAssessmentResponse = (id: string, response: 'low' | 'medium' | 'high') => {
    setAssessmentItems(prev => prev.map(item => item.id === id ? { ...item, response } : item));
  };

  const handleSJTResponse = (id: string, index: number) => {
    setSjtItems(prev => prev.map(item => item.id === id ? { ...item, selectedOptionIndex: index } : item));
  };

  // Navigation Logic based on Tier
  const handleNextFromStructured = () => {
      if (companyTier === 'Basic') {
          // Skip SJT for Basic
          handleStartInterview();
      } else {
          // Go to SJT for Premium/Enterprise
          setStep('sjt');
      }
  };

  const handleStartInterview = async () => {
    setStep('interview');
    setIsLoading(true);
    const question = await generateNextQuestion(candidateRole, []);
    setCurrentQuestion(question);
    setIsLoading(false);
  };

  const handleSendAnswer = async () => {
    if (!currentInput.trim()) return;
    const newHistory = [...history, { speaker: 'ai' as const, text: currentQuestion }, { speaker: 'candidate' as const, text: currentInput }];
    setHistory(newHistory);
    setCurrentInput('');
    setIsLoading(true);
    const nextQ = await generateNextQuestion(candidateRole, newHistory);
    setCurrentQuestion(nextQ);
    setIsLoading(false);
  };

  const handleFinish = async () => {
    setStep('analyzing');
    let finalHistory = history;
    if (currentInput.trim()) {
       finalHistory = [...history, { speaker: 'ai' as const, text: currentQuestion }, { speaker: 'candidate' as const, text: currentInput }];
    }

    try {
      // Pass Tier to Analysis to enable/disable Enterprise features
      const analysis = await analyzeFraudRisk(candidateRole, finalHistory, assessmentItems, companyTier === 'Basic' ? undefined : sjtItems, companyTier);
      
      const sessionData = {
        candidate: { id: existingSession?.candidate?.id || Date.now().toString(), name: candidateName, role: candidateRole, email: existingSession?.candidate?.email || 'n/a' },
        date: new Date().toISOString(),
        status: 'completed',
        structuredAssessment: assessmentItems,
        sjtResults: companyTier === 'Basic' ? [] : sjtItems, 
        transcript: finalHistory,
        analysis: analysis,
        companyId: companyId
      };

      setStep('saving');
      if (existingSession && existingSession.id) {
          await updateSessionInDB(existingSession.id, sessionData);
      } else {
          await saveSessionToDB(sessionData);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Error saving report.");
      setStep('interview');
    }
  };

  // --- RENDERERS ---

  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto bg-white dark:bg-brand-slate-850 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mt-10">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Setup Kandidat</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Nama Lengkap" className="w-full p-4 border rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-600" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
          <select className="w-full p-4 border rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-600" value={candidateRole} onChange={(e) => setCandidateRole(e.target.value)}>
            <option value="" disabled>-- Pilih Posisi --</option>
            {AVAILABLE_POSITIONS.map((pos, idx) => <option key={idx} value={pos}>{pos}</option>)}
          </select>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/30">
              <ShieldCheck className="text-brand-blue shrink-0" size={20} />
              <div>
                  <p className="text-sm font-bold text-brand-dark dark:text-white">Paket Aktif: {companyTier}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {companyTier === 'Basic' ? 'Mencakup 12 Pertanyaan Dasar & Interview Standar.' : 
                       companyTier === 'Premium' ? 'Termasuk Tes Psikometri (SJT) & Skala Finansial.' : 
                       'Fitur Lengkap: SJT, Deteksi Eufemisme AI & Benchmarking.'}
                  </p>
              </div>
          </div>
          <button onClick={handleStartAssessment} disabled={!candidateName || !candidateRole} className="w-full bg-brand-orange text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50">Mulai Asesmen</button>
        </div>
      </div>
    );
  }

  if (step === 'structured') {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <ClipboardEdit className="text-brand-blue"/> Modul 1: Asesmen Dasar 
            {companyTier !== 'Basic' && ' & Finansial'}
        </h2>
        <div className="space-y-6 mb-8">
          {assessmentItems.map((item) => (
            <div key={item.id} className="bg-white dark:bg-brand-slate-850 p-5 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between gap-4">
               <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                       <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                           item.category === 'financial_strain' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                       }`}>{item.category.replace('_', ' ')}</span>
                   </div>
                   <p className="font-medium text-gray-800 dark:text-gray-200">{item.question}</p>
                   {existingSession && <p className="text-xs text-brand-orange mt-1">Jawaban Kandidat: {item.response?.toUpperCase() || '-'}</p>}
               </div>
               <div className="flex gap-2">
                   {['low', 'medium', 'high'].map((val) => (
                       <button key={val} onClick={() => handleAssessmentResponse(item.id, val as any)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${item.response === val ? 'bg-brand-blue text-white border-brand-blue' : 'text-gray-500 border-gray-200 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
                           {val === 'low' ? 'Rendah' : val === 'medium' ? 'Sedang' : 'Tinggi'}
                       </button>
                   ))}
               </div>
            </div>
          ))}
          
          {/* UPSELL BANNER FOR BASIC */}
          {companyTier === 'Basic' && (
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-between opacity-75">
                  <div className="flex items-center gap-3">
                      <Lock className="text-gray-400" size={20} />
                      <span className="text-sm font-medium text-gray-500">Pertanyaan Indikator Tekanan Finansial (Terkunci)</span>
                  </div>
                  <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Premium</span>
              </div>
          )}
        </div>
        <div className="flex justify-end">
            <button onClick={handleNextFromStructured} disabled={assessmentItems.some(i => i.response === null)} className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                {companyTier === 'Basic' ? 'Lanjut ke Interview AI' : 'Lanjut ke SJT (Psikometri)'} <ArrowRight size={18} />
            </button>
        </div>
      </div>
    );
  }

  if (step === 'sjt') {
      return (
        <div className="max-w-4xl mx-auto pb-10 animate-in fade-in slide-in-from-right">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-900/30 mb-8">
                <h2 className="text-xl font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2 mb-2">
                    <BrainCircuit /> Modul 2: Situational Judgment Test (SJT)
                </h2>
                <p className="text-purple-700 dark:text-purple-400 text-sm">
                    Tes ini mengukur integritas bawah sadar kandidat melalui studi kasus dilema etika. 
                    Jawaban kandidat akan menentukan kecenderungan rasionalisasi mereka.
                </p>
            </div>

            <div className="space-y-8 mb-8">
                {sjtItems.map((item, idx) => (
                    <div key={item.id} className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-lg">Kasus #{idx + 1}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl italic border-l-4 border-brand-orange">
                            "{item.scenario}"
                        </p>
                        <div className="space-y-3">
                            {item.options.map((opt, optIdx) => (
                                <button
                                    key={optIdx}
                                    onClick={() => handleSJTResponse(item.id, optIdx)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                                        item.selectedOptionIndex === optIdx 
                                        ? 'bg-brand-orange/10 border-brand-orange text-brand-dark dark:text-white' 
                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <span className="font-medium">{opt.label}</span>
                                    {item.selectedOptionIndex === optIdx && <CheckCircle2 className="text-brand-orange" size={20} />}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button onClick={handleStartInterview} disabled={sjtItems.some(i => i.selectedOptionIndex === null)} className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                    Masuk ke Deep Interview AI <ArrowRight size={18} />
                </button>
            </div>
        </div>
      );
  }

  if (step === 'analyzing' || step === 'saving') {
     return (
       <div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
         <Loader2 className="w-16 h-16 text-brand-orange animate-spin mb-6" />
         <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{step === 'analyzing' ? 'Analisis Forensik AI...' : 'Menyimpan Laporan...'}</h3>
         <p className="text-gray-500 max-w-md">
            {companyTier === 'Enterprise' 
                ? 'Sistem sedang mendeteksi pola eufemisme, menghitung skor SJT, sentimen, dan benchmark industri.'
                : 'Menganalisis jawaban dan menghitung risiko fraud.'}
         </p>
       </div>
     );
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-brand-slate-850 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold">{candidateName.charAt(0)}</div>
            <div>
                <h3 className="font-bold text-gray-800 dark:text-white">{candidateName}</h3>
                <p className="text-xs text-brand-orange font-bold uppercase">
                    Modul {companyTier === 'Basic' ? '2' : '3'}: Deep Interview
                </p>
            </div>
        </div>
        <button onClick={handleFinish} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold border border-red-100 flex items-center gap-2">
          <StopCircle size={16} /> Selesai
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-slate-900/50" ref={scrollRef}>
        <div className="flex justify-center">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                {companyTier === 'Basic' ? 'Asesmen Dasar Selesai' : 'Modul SJT Selesai'}. Melanjutkan pendalaman...
            </span>
        </div>
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-2xl p-5 shadow-sm ${msg.speaker === 'ai' ? 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-800 dark:text-gray-200' : 'bg-brand-blue/10 border border-brand-blue/20 text-brand-dark dark:text-brand-blue'}`}>
               <p className="text-sm font-bold opacity-50 mb-1 uppercase">{msg.speaker === 'ai' ? 'AI Investigator' : 'Kandidat'}</p>
               <p className="leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-2"><Loader2 className="animate-spin text-brand-orange" size={16}/><span className="text-sm text-gray-500">Menganalisis jawaban...</span></div></div>}
        {!isLoading && currentQuestion && (
            <div className="flex justify-start">
                <div className="max-w-[85%] bg-white dark:bg-slate-800 p-5 rounded-2xl border-l-4 border-brand-orange shadow-sm">
                    <p className="text-xs font-bold text-brand-orange mb-1 uppercase">Pertanyaan AI</p>
                    <p className="font-medium text-lg text-gray-800 dark:text-white">{currentQuestion}</p>
                </div>
            </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-brand-slate-850 flex gap-3">
        <input type="text" value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendAnswer()} placeholder="Ketik jawaban kandidat..." className="flex-1 p-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none" />
        <button onClick={handleSendAnswer} disabled={!currentInput.trim() || isLoading} className="bg-brand-dark text-white px-6 rounded-xl hover:bg-gray-800 transition-all"><Send size={20} /></button>
      </div>
    </div>
  );
};

export default ActiveInterview;
