import React, { useState, useEffect } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend
} from 'recharts';
import { AlertOctagon, CheckCircle, AlertTriangle, ArrowLeft, Lock, Crown, BarChart3, Fingerprint, PenSquare, RefreshCw, FileWarning, FileText } from 'lucide-react';
import { InterviewSession, RiskLevel, CompanyProfile } from '../types';
import { getCompanyById } from '../services/firebase';

interface ReportViewProps {
  session: InterviewSession;
  onBack: () => void;
  isDarkMode?: boolean;
  onReReview?: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ session, onBack, isDarkMode, onReReview }) => {
  const { analysis, candidate, companyId } = session;
  const [companyTier, setCompanyTier] = useState<'Basic' | 'Premium' | 'Enterprise'>('Basic');

  useEffect(() => {
    const fetchTier = async () => {
        const comp = await getCompanyById(companyId);
        if (comp) setCompanyTier(comp.tier);
    };
    fetchTier();
  }, [companyId]);

  // --- RECOVERY MODE IF ANALYSIS IS MISSING ---
  if (!analysis) {
      return (
          <div className="max-w-4xl mx-auto py-10 text-center animate-in fade-in">
              <button onClick={onBack} className="mb-8 text-gray-500 hover:text-gray-800 flex items-center gap-2 mx-auto font-bold text-sm">
                  <ArrowLeft size={16} /> Kembali ke Dasbor
              </button>
              
              <div className="bg-white dark:bg-brand-slate-850 p-10 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 max-w-lg mx-auto">
                  <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileWarning size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Laporan Belum Tersedia</h2>
                  <p className="text-gray-500 mb-8 leading-relaxed">
                      Kandidat <strong>{candidate.name}</strong> telah menyelesaikan wawancara, namun analisis AI tertunda karena gangguan koneksi atau proses di latar belakang.
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-xl mb-8 text-left text-sm text-gray-600 border border-gray-200">
                      <p className="font-bold mb-1">Detail Sesi:</p>
                      <ul className="list-disc list-inside space-y-1">
                          <li>Posisi: {candidate.role}</li>
                          <li>Tanggal: {new Date(session.date).toLocaleDateString()}</li>
                          <li>Status: Menunggu Analisis</li>
                      </ul>
                  </div>

                  <button 
                      onClick={onReReview}
                      className="w-full bg-brand-orange text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                      <RefreshCw size={20} /> Generate Analisis Sekarang
                  </button>
              </div>
          </div>
      );
  }

  // ANTI-CRASH: Safely access scores with numerical conversion
  const safeNumber = (val: any) => {
      if (val === null || val === undefined) return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : n;
  };

  // Helper to ensure text rendering and prevent Object error
  const safeText = (text: any) => {
      if (text === null || text === undefined) return '';
      if (typeof text === 'string') return text;
      if (typeof text === 'number') return String(text);
      if (Array.isArray(text)) return text.join(', ');
      if (typeof text === 'object') return JSON.stringify(text); // Last resort to prevent crash
      return String(text);
  };

  // Safely extract scores
  const scores = {
    pressure: safeNumber(analysis.scores?.pressure),
    rationalization: safeNumber(analysis.scores?.rationalization),
    opportunity: safeNumber(analysis.scores?.opportunity),
  };

  // Chart Data using safe scores
  const radarData = [
    { subject: 'Tekanan', A: scores.pressure, fullMark: 100 },
    { subject: 'Rasionalisasi', A: scores.rationalization, fullMark: 100 },
    { subject: 'Peluang', A: scores.opportunity, fullMark: 100 },
  ];

  const benchmarkData = analysis.benchmarkComparison ? [
    { name: 'Kandidat', score: safeNumber(analysis.benchmarkComparison.candidateAvg), fill: '#CC5500' },
    { name: 'Rata-rata Perusahaan', score: safeNumber(analysis.benchmarkComparison.companyAvg), fill: '#3b82f6' },
    { name: 'Industri Sejenis', score: safeNumber(analysis.benchmarkComparison.industryAvg), fill: '#94a3b8' },
  ] : [];

  const getRiskColor = (level: RiskLevel | string) => {
    const riskLevel = safeText(level);
    switch (riskLevel) {
      case RiskLevel.CRITICAL: return 'bg-red-600';
      case RiskLevel.HIGH: return 'bg-brand-orange';
      case RiskLevel.MEDIUM: return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };
  
  const averageScore = Math.round((scores.pressure + scores.opportunity + scores.rationalization) / 3);

  // Safely extract red flags array
  const redFlags = Array.isArray(analysis.redFlags) ? analysis.redFlags : [];

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center mb-2 md:mb-4">
          <button onClick={onBack} className="text-gray-500 dark:text-gray-400 hover:text-brand-dark dark:hover:text-white text-sm font-bold flex items-center gap-2 transition-colors">
            <ArrowLeft size={16} /> Kembali ke Dasbor
          </button>
          
          <div className="flex gap-2">
              {onReReview && (
                  <button 
                    onClick={onReReview}
                    className="text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                  >
                     <FileText size={14} /> Lihat Transkrip & Jawaban
                  </button>
              )}
              {onReReview && (
                  <button 
                    onClick={onReReview}
                    className="text-brand-blue bg-blue-50 hover:bg-brand-blue hover:text-white dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-brand-blue dark:hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                  >
                     <PenSquare size={14} /> Edit Laporan
                  </button>
              )}
          </div>
      </div>

      {/* Header Card */}
      <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center transition-colors gap-4 relative overflow-hidden">
        {companyTier === 'Enterprise' && (
             <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-orange/20 to-transparent p-20 rounded-bl-full pointer-events-none"></div>
        )}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white truncate">{safeText(candidate.name)}</h1>
            <span className={`px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-sm uppercase tracking-wider self-start ${getRiskColor(analysis.riskLevel)}`}>
              Risiko {safeText(analysis.riskLevel)}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm md:text-base mb-2">{safeText(candidate.role)} • {new Date(session.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}</p>

          {session.cvUrl && (
            <a
              href={session.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors mt-2"
            >
              <FileText size={16} />
              Download CV
            </a>
          )}
        </div>
        <div className="w-full md:w-auto text-right bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-row md:flex-col items-center justify-between md:items-end z-10">
          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold md:mb-1">Skor Fraud</p>
          <div className="text-3xl md:text-4xl font-black text-brand-dark dark:text-white flex items-baseline justify-end gap-1">
            {averageScore}
            <span className="text-sm md:text-lg text-gray-400 dark:text-slate-500 font-medium">/100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 space-y-6">
            {/* Radar Chart */}
            <div className="bg-white dark:bg-brand-slate-850 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col items-center transition-colors">
            <h3 className="w-full text-base md:text-lg font-bold text-gray-800 dark:text-white mb-4 md:mb-6 border-b border-gray-100 dark:border-slate-700 pb-4 text-center">Visualisasi Fraud Triangle</h3>
            <div className="w-full h-[250px] md:h-[300px] relative">
                <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: '700' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                    name={candidate.name}
                    dataKey="A"
                    stroke="#CC5500"
                    strokeWidth={3}
                    fill="#CC5500"
                    fillOpacity={0.3}
                    />
                    <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDarkMode ? '#1e293b' : '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#CC5500', fontWeight: 'bold' }}
                    />
                </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 w-full mt-4 text-center">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1 truncate">Tekanan</p>
                    <p className="text-lg font-black text-red-700 dark:text-red-400">{scores.pressure}</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1 truncate">Peluang</p>
                    <p className="text-lg font-black text-blue-700 dark:text-blue-400">{scores.opportunity}</p>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1 truncate">Rasionalisasi</p>
                    <p className="text-lg font-black text-yellow-700 dark:text-yellow-400">{scores.rationalization}</p>
                </div>
            </div>
            </div>

            {/* ENTERPRISE: Benchmarking Chart */}
            <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 relative overflow-hidden group">
                {companyTier === 'Basic' && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-6">
                        <Lock className="text-brand-dark dark:text-white mb-3" size={32} />
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Fitur Enterprise</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-xs">Tingkatkan paket untuk melihat perbandingan skor kandidat melawan rata-rata industri.</p>
                        <button className="bg-brand-dark text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">Tingkatkan Paket</button>
                    </div>
                )}
                
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-1.5 bg-brand-orange/10 rounded-md text-brand-orange">
                        <BarChart3 size={18} />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">Benchmarking Risiko</h3>
                </div>

                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={benchmarkData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} width={100} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                                {benchmarkData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2 italic text-center">Membandingkan skor agregat kandidat dengan database internal.</p>
            </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-7 space-y-4 md:space-y-6">
          
          {/* Summary */}
          <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle className="text-brand-blue" size={24} />
              Ringkasan Analisis AI
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-loose text-justify text-sm">
              {safeText(analysis.summary)}
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
               <h4 className="font-bold text-gray-800 dark:text-white mb-3 text-xs md:text-sm uppercase tracking-wide">Rekomendasi Tindakan</h4>
               <p className="text-sm font-medium text-brand-dark dark:text-white bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border-l-4 border-brand-orange leading-relaxed">
                 {safeText(analysis.recommendation)}
               </p>
            </div>
          </div>

          {/* ENTERPRISE: Consistency & Sentiment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-brand-slate-850 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 relative overflow-hidden">
                {companyTier === 'Basic' && <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[1px] z-20"></div>}
                <div className="flex items-center gap-2 mb-4">
                    <Fingerprint className="text-brand-orange" size={20} />
                    <h4 className="font-bold text-gray-800 dark:text-white text-sm">Skor Konsistensi</h4>
                </div>
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-black text-gray-800 dark:text-white">{safeNumber(analysis.consistencyScore)}%</span>
                    <span className="text-xs text-gray-500 mb-1.5">Akurasi Jawaban</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full ${(safeNumber(analysis.consistencyScore)) > 75 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                        style={{ width: `${safeNumber(analysis.consistencyScore)}%` }}
                    ></div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Mengukur konsistensi antara tes tertulis dan wawancara.</p>
              </div>

              <div className="bg-white dark:bg-brand-slate-850 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 relative overflow-hidden">
                {companyTier === 'Basic' && <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[1px] z-20"></div>}
                <div className="flex items-center gap-2 mb-4">
                    <Crown className="text-brand-blue" size={20} />
                    <h4 className="font-bold text-gray-800 dark:text-white text-sm">Sentimen Analisis</h4>
                </div>
                {analysis.sentimentBreakdown ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-green-600 font-bold">Positif</span>
                            <span className="text-gray-600 dark:text-gray-300">{safeNumber(analysis.sentimentBreakdown.positive)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${safeNumber(analysis.sentimentBreakdown.positive)}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-gray-500 font-bold">Netral</span>
                            <span className="text-gray-600 dark:text-gray-300">{safeNumber(analysis.sentimentBreakdown.neutral)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-400" style={{ width: `${safeNumber(analysis.sentimentBreakdown.neutral)}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-red-600 font-bold">Negatif</span>
                            <span className="text-gray-600 dark:text-gray-300">{safeNumber(analysis.sentimentBreakdown.negative)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${safeNumber(analysis.sentimentBreakdown.negative)}%` }}></div>
                        </div>
                    </div>
                ) : <p className="text-xs text-gray-400">Data tidak tersedia.</p>}
              </div>
          </div>

          {/* Red Flags */}
          <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-brand-orange" size={24} />
              Identifikasi Red Flags
            </h3>
            <ul className="space-y-3">
              {redFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                  <AlertOctagon size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="font-medium">{safeText(flag)}</span>
                </li>
              ))}
              {redFlags.length === 0 && (
                <li className="text-gray-500 dark:text-gray-400 text-sm italic p-4 bg-gray-50 dark:bg-slate-800 rounded-lg text-center">Tidak ada tanda bahaya signifikan yang terdeteksi.</li>
              )}
            </ul>
          </div>

          {/* AI Interview Transcript */}
          {session.transcript && session.transcript.length > 0 && (
            <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
              <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="text-brand-blue" size={24} />
                Transkrip Interview AI
              </h3>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 max-h-96 overflow-y-auto space-y-3">
                {session.transcript.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                      msg.speaker === 'ai'
                        ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white border border-gray-200 dark:border-slate-600'
                        : 'bg-brand-blue text-white'
                    }`}>
                      <p className="text-[10px] uppercase font-bold mb-1 opacity-60">
                        {msg.speaker === 'ai' ? 'AI Interviewer' : 'Kandidat'}
                      </p>
                      <p className="leading-relaxed">{safeText(msg.text)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                Total {session.transcript.length} pesan dalam percakapan
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportView;