import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';
import { InterviewSession, Candidate, AssessmentItem, SJTItem } from '../types';
import { updateSessionInDB, getCompanyById } from '../services/supabase';
import { analyzeFraudRisk } from '../services/genai';
import ReportView from './ReportView';
import { useToast } from './Toast';

interface ActiveInterviewProps {
  onComplete: () => void;
  companyId: string;
  existingSession?: InterviewSession;
}

const Watermark: React.FC = () => (
  <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-3 px-4 z-50 shadow-lg dark:bg-gray-800/95 dark:border-gray-700">
    <div className="max-w-5xl mx-auto flex items-center justify-center gap-2">
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
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          Powered by <span className="font-bold text-orange-600 group-hover:text-orange-700 transition-colors">hiregood.one</span>
        </span>
      </a>
    </div>
  </div>
);

const ActiveInterview: React.FC<ActiveInterviewProps> = ({ onComplete, companyId, existingSession }) => {
  const toast = useToast();
  // This component is now primarily a REVIEWER for sessions created via Public Link
  const [session, setSession] = useState<InterviewSession | undefined>(existingSession);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const [companyTier, setCompanyTier] = useState<'Freemium' | 'Premium'>('Freemium');

  useEffect(() => {
     const fetchTier = async () => {
         const comp = await getCompanyById(companyId);
         if (comp) setCompanyTier(comp.tier);
     }
     fetchTier();
  }, [companyId]);

  const handleReAnalyze = async () => {
      if (!session) return;
      setIsReAnalyzing(true);
      try {
          const newAnalysis = await analyzeFraudRisk(
              session.candidate.role, 
              session.transcript || [], 
              session.structuredAssessment || [], 
              session.sjtResults || [], 
              companyTier,
              session.financialStrainResults || [],
              session.id,
          );
          
          await updateSessionInDB(session.id, {
              status: 'completed',
              analysis: newAnalysis
          });
          onComplete(); // Go back to history/report view
      } catch (error) {
          toast.error("Gagal menganalisis ulang.");
      } finally {
          setIsReAnalyzing(false);
      }
  };

  if (!session) return <div>Data sesi tidak ditemukan.</div>;

  // If session is completed and has analysis, show full ReportView
  if (session.status === 'completed' && session.analysis) {
    return <ReportView session={session} onBack={onComplete} onReReview={handleReAnalyze} />;
  }

  // Otherwise show review interface for incomplete sessions
  return (
      <>
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Review Jawaban Kandidat</h2>
                <button onClick={handleReAnalyze} disabled={isReAnalyzing} className="bg-brand-orange text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90">
                   {isReAnalyzing ? 'Menganalisis...' : 'Simpan & Finalisasi Laporan'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: SURVEY RESULTS */}
              <div className="space-y-6">
                  <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                          <AlertTriangle className="text-brand-blue" size={20} /> Fraud Triangle Answers
                      </h3>
                      <div className="space-y-3 h-64 overflow-y-auto pr-2 custom-scrollbar">
                          {session.structuredAssessment?.map((item, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm">
                                  <p className="text-gray-500 mb-1 text-xs">{item.question}</p>
                                  <div className="font-bold text-gray-800 dark:text-gray-200">
                                      Skor: {item.response}/5
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {session.sjtResults && (
                      <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                              <ShieldCheck className="text-purple-600" size={20} /> SJT Results
                          </h3>
                          <div className="space-y-3">
                              {session.sjtResults.map((item, idx) => {
                                  const selected = item.options[item.selectedOptionIndex || 0];
                                  return (
                                      <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg text-sm border border-purple-100">
                                          <p className="italic text-gray-500 mb-1 text-xs">Scenario: {item.scenario.substring(0, 50)}...</p>
                                          <p className="font-bold text-purple-900 dark:text-purple-300">Pilihan: {selected.label}</p>
                                          <p className="text-xs font-bold uppercase mt-1 text-purple-600">Risk: {selected.riskWeight}</p>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  )}
              </div>

              {/* RIGHT: CHAT TRANSCRIPT */}
              <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col h-[600px]">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-t-2xl">
                      <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                          <MessageSquare size={20} /> Transkrip Interview AI
                      </h3>
                      <p className="text-xs text-gray-500">Otomatis dilakukan oleh sistem via Link Publik.</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {session.transcript && session.transcript.length > 0 ? (
                          session.transcript.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.speaker === 'ai' ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white' : 'bg-brand-blue text-white'}`}>
                                      <p className="text-[9px] uppercase font-bold mb-1 opacity-70">{msg.speaker}</p>
                                      {msg.text}
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="text-center text-gray-400 dark:text-slate-500 italic text-sm p-8">
                              Tidak ada transkrip percakapan yang tercatat untuk sesi ini.
                          </div>
                      )}
                  </div>
              </div>
            </div>
        </div>
        <Watermark />
      </>
  );
};

export default ActiveInterview;