
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, User, Mail, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import { saveSessionToDB, getCompanyById } from '../services/firebase';
import { AssessmentItem, CompanyProfile } from '../types';

interface PublicAssessmentProps {
  companyId: string;
}

// Reuse questions for self-assessment (slightly modified for first-person context)
const SELF_ASSESSMENT_ITEMS: AssessmentItem[] = [
  { id: 'p1', category: 'pressure', question: 'Apakah Anda memiliki tanggungan finansial mendesak saat ini?', response: null },
  { id: 'p2', category: 'pressure', question: 'Apakah Anda pernah mengalami tekanan target kerja yang sangat tinggi?', response: null },
  { id: 'o1', category: 'opportunity', question: 'Apakah Anda nyaman bekerja tanpa pengawasan langsung?', response: null },
  { id: 'o2', category: 'opportunity', question: 'Apakah Anda memahami konsep pemisahan tugas (segregation of duties)?', response: null },
  { id: 'r1', category: 'rationalization', question: 'Menurut Anda, apakah wajar menggunakan aset kantor untuk keperluan mendesak?', response: null },
  { id: 'r2', category: 'rationalization', question: 'Apakah peraturan perusahaan harus selalu diikuti tanpa pengecualian?', response: null },
];

const PublicAssessment: React.FC<PublicAssessmentProps> = ({ companyId }) => {
  const [step, setStep] = useState<'loading' | 'welcome' | 'form' | 'questions' | 'done'>('loading');
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  
  // Form State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateRole, setCandidateRole] = useState('');
  const [answers, setAnswers] = useState<AssessmentItem[]>(SELF_ASSESSMENT_ITEMS);

  useEffect(() => {
    const fetchCompany = async () => {
      const data = await getCompanyById(companyId);
      if (data) {
        setCompany(data);
        setStep('welcome');
      } else {
        alert("Link tidak valid atau perusahaan tidak ditemukan.");
      }
    };
    fetchCompany();
  }, [companyId]);

  const handleStart = () => setStep('form');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (candidateName && candidateRole) {
      setStep('questions');
    }
  };

  const handleAnswer = (id: string, value: 'low' | 'medium' | 'high') => {
    setAnswers(prev => prev.map(item => item.id === id ? { ...item, response: value } : item));
  };

  const handleSubmitAll = async () => {
    setStep('loading');
    
    const sessionData = {
      candidate: {
        id: Date.now().toString(),
        name: candidateName,
        email: candidateEmail,
        role: candidateRole
      },
      date: new Date().toISOString(),
      status: 'pending_review', // Special status for self-assessment
      structuredAssessment: answers,
      transcript: [], // Empty for now
      companyId: companyId
    };

    await saveSessionToDB(sessionData);
    setStep('done');
  };

  // Helper styles based on company branding
  const brandColor = company?.brandColor || '#CC5500'; // Default Orange
  const headerTitle = company?.headerTitle || company?.name || 'FraudGuard';
  const logoUrl = company?.logoUrl;
  const welcomeMsg = company?.welcomeMessage || `Anda diundang oleh ${company?.name} untuk melengkapi profil dan asesmen pra-interview.`;

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin" size={40} style={{ color: brandColor }} />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Data Terkirim!</h2>
          <p className="text-gray-600 mb-6">Terima kasih telah melengkapi data awal. Tim HR {company?.name} akan segera menghubungi Anda.</p>
          <button onClick={() => window.location.reload()} className="font-bold hover:underline" style={{ color: brandColor }}>
            Kembali ke Halaman Utama
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans transition-colors duration-300">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
           {logoUrl ? (
               <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
           ) : (
               <ShieldCheck size={24} style={{ color: brandColor }} />
           )}
           <span className="font-bold text-xl text-gray-900 tracking-tight">
               {headerTitle}
           </span>
           {!logoUrl && <span className="text-gray-300 mx-2">|</span>}
           {!logoUrl && <span className="font-semibold text-gray-600">Portal Kandidat</span>}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6">
        
        {step === 'welcome' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center mt-10">
             <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${brandColor}15`, color: brandColor }}>
                <Briefcase size={40} />
             </div>
             <h1 className="text-2xl font-bold text-gray-900 mb-4">Formulir Data Kandidat</h1>
             <p className="text-gray-500 mb-8 leading-relaxed">
               {welcomeMsg}
             </p>
             <button 
                onClick={handleStart} 
                className="w-full text-white py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 hover:opacity-90"
                style={{ backgroundColor: brandColor }}
             >
               Mulai Pengisian <ArrowRight size={20} />
             </button>
          </div>
        )}

        {step === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <User style={{ color: brandColor }} /> Data Diri
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lengkap</label>
                <input required type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2" style={{ '--tw-ring-color': brandColor } as any} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <input required type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2" style={{ '--tw-ring-color': brandColor } as any} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Posisi Dilamar</label>
                <input required type="text" value={candidateRole} onChange={e => setCandidateRole(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2" style={{ '--tw-ring-color': brandColor } as any} />
              </div>
              <button type="submit" className="w-full text-white py-3 rounded-xl font-bold mt-4 hover:opacity-90" style={{ backgroundColor: brandColor }}>Lanjut</button>
            </form>
          </div>
        )}

        {step === 'questions' && (
          <div className="space-y-6 mt-4">
             <div className="p-4 rounded-xl flex gap-3 text-sm font-medium border" style={{ backgroundColor: `${brandColor}10`, color: brandColor, borderColor: `${brandColor}30` }}>
                <AlertCircle className="shrink-0" size={20} />
                Jawablah pertanyaan berikut dengan jujur sesuai pandangan Anda.
             </div>

             {answers.map((item, idx) => (
               <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                 <p className="font-bold text-gray-800 mb-4">{idx + 1}. {item.question}</p>
                 <div className="grid grid-cols-3 gap-3">
                   {['low', 'medium', 'high'].map((val) => {
                       const isSelected = item.response === val;
                       const labels: Record<string, string> = { low: 'Tidak', medium: 'Netral', high: 'Ya' };
                       return (
                           <button 
                                key={val}
                                onClick={() => handleAnswer(item.id, val as any)} 
                                className={`py-2 rounded-lg text-sm font-bold border transition-all ${isSelected ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : { borderColor: '#e5e7eb' }}
                            >
                               {labels[val]}
                           </button>
                       )
                   })}
                 </div>
               </div>
             ))}

             <button 
               onClick={handleSubmitAll}
               disabled={answers.some(a => a.response === null)}
               className="w-full text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
               style={{ backgroundColor: brandColor }}
             >
               Kirim Jawaban
             </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default PublicAssessment;
