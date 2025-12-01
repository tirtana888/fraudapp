
import React, { useState } from 'react';
import { Users, AlertTriangle, FileCheck, TrendingUp, Copy, Check, ExternalLink, ClipboardList, RefreshCw, Lock, Zap } from 'lucide-react';
import { InterviewSession, RiskLevel, CompanyProfile } from '../types';
import { PLAN_LIMITS } from '../constants/plans';

interface DashboardProps {
  sessions: InterviewSession[];
  currentCompany: CompanyProfile;
  onViewSession?: (id: string) => void;
  onReviewSession?: (session: InterviewSession) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sessions, currentCompany, onViewSession, onReviewSession }) => {
  const [copied, setCopied] = useState(false);

  // FEATURE GATING
  const features = PLAN_LIMITS[currentCompany.tier];

  const totalInterviews = sessions.length;
  const highRisk = sessions.filter(s => s.analysis?.riskLevel === RiskLevel.HIGH || s.analysis?.riskLevel === RiskLevel.CRITICAL).length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const pendingReview = sessions.filter(s => s.status === 'pending_review');

  // Filter for "Recent Auto-Completed" Sessions (Source: public_link)
  const recentAutoSessions = sessions.filter(s => s.status === 'completed' && (s as any).source === 'public_link').slice(0, 3);

  // Generate Unique Link
  const assessmentLink = `${window.location.origin}?mode=assess&cid=${currentCompany.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(assessmentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const StatCard = ({ icon: Icon, label, value, color, darkColor }: any) => (
    <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <h3 className="text-3xl font-bold text-gray-800 dark:text-white mt-2">{value}</h3>
        </div>
        <div className={`p-4 rounded-xl ${color} dark:bg-opacity-20 bg-opacity-10 group-hover:scale-105 transition-transform duration-200`}>
          <Icon size={28} className={color.replace('bg-', 'text-')} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white transition-colors">Tinjauan Perusahaan</h2>
          <p className="text-sm md:text-base text-gray-500 dark:text-slate-400 mt-1 transition-colors">
            Analisis untuk <span className="font-bold text-brand-orange">{currentCompany.name}</span>
          </p>
        </div>
        
        {/* Recruitment Link Widget - GATED */}
        {features.allow_permanent_link ? (
            <div className="w-full md:w-auto bg-brand-blue/10 dark:bg-brand-blue/5 border border-brand-blue/20 p-4 rounded-xl flex flex-col gap-2">
                <label className="text-xs font-bold text-brand-dark dark:text-brand-blue uppercase tracking-wide flex items-center gap-1">
                    <ExternalLink size={12} /> Link Asesmen Mandiri
                </label>
                <div className="flex gap-2">
                    <input 
                        readOnly 
                        value={assessmentLink} 
                        className="flex-1 min-w-[200px] md:min-w-[300px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-300 focus:outline-none"
                    />
                    <button 
                        onClick={handleCopyLink}
                        className="bg-brand-blue hover:bg-brand-blue/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Disalin' : 'Salin'}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Bagikan link ini kepada kandidat untuk pengisian data awal.</p>
            </div>
        ) : (
            <div className="w-full md:w-auto bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4 opacity-75">
                <div className="bg-gray-200 dark:bg-slate-700 p-3 rounded-full">
                    <Lock size={20} className="text-gray-500" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Link Asesmen Dikunci</h4>
                    <p className="text-[10px] text-gray-500">Upgrade ke Premium untuk membuka fitur link mandiri.</p>
                </div>
            </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          icon={Users} 
          label="Total Kandidat" 
          value={`${totalInterviews} / ${features.max_candidates === 'unlimited' ? '∞' : features.max_candidates}`} 
          color="bg-brand-blue" 
        />
        <StatCard 
          icon={AlertTriangle} 
          label="Risiko Tinggi" 
          value={highRisk} 
          color="bg-brand-orange" 
        />
        <StatCard 
          icon={FileCheck} 
          label="Selesai Diulas" 
          value={completed} 
          color="bg-green-500" 
        />
        <StatCard 
          icon={ClipboardList} 
          label="Menunggu Review" 
          value={pendingReview.length} 
          color="bg-yellow-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white dark:bg-brand-slate-850 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                {(pendingReview.length > 0 || recentAutoSessions.length > 0) ? (
                    <span className="flex h-3 w-3 rounded-full bg-brand-orange animate-pulse"></span>
                ) : null}
                Aktivitas Terbaru
            </h3>
            <button className="text-brand-orange text-sm font-semibold hover:underline">Lihat Semua</button>
          </div>
          
          <div className="space-y-4">
            
            {/* 1. Show Pending Reviews (Manual Input / Error Cases) */}
            {pendingReview.slice(0, 3).map(session => (
               <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl transition-all gap-3">
                 <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-lg shrink-0">
                        {session.candidate.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-gray-100">{session.candidate.name} <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full ml-1">PENDING</span></p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Melamar: {session.candidate.role}</p>
                    </div>
                 </div>
                 <button 
                    onClick={() => onReviewSession && onReviewSession(session)}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                 >
                    Mulai Review
                 </button>
               </div>
            ))}

            {/* 2. Show RECENT AUTO-ANALYZED SESSIONS (Completed from Link) */}
            {recentAutoSessions.map(session => (
               <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/10 dark:border-brand-blue/20 rounded-xl transition-all gap-3">
                 <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-lg shrink-0">
                        {session.candidate.name.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 dark:text-gray-100">{session.candidate.name}</p>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                <Zap size={8} /> Auto-Analyzed
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Risiko: <span className={`font-bold ${session.analysis?.riskLevel === 'High' ? 'text-red-600' : 'text-gray-600'}`}>{session.analysis?.riskLevel || 'N/A'}</span></p>
                    </div>
                 </div>
                 <button 
                    onClick={() => onViewSession && onViewSession(session.id)}
                    className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                 >
                    <FileCheck size={12} /> Lihat Laporan
                 </button>
               </div>
            ))}

            {/* 3. Show Other Completed Sessions */}
            {sessions.filter(s => s.status === 'completed' && (s as any).source !== 'public_link').slice(0, 3).map(session => (
              <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 hover:shadow-sm rounded-xl transition-all gap-3 cursor-pointer" onClick={() => onViewSession && onViewSession(session.id)}>
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-brand-blue/20 dark:bg-brand-blue/10 flex items-center justify-center text-brand-dark dark:text-brand-blue font-bold text-lg shrink-0">
                    {session.candidate.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{session.candidate.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{session.candidate.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-center
                    ${session.analysis?.riskLevel === RiskLevel.HIGH ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50' : 
                      session.analysis?.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/50' :
                      'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50'}`}>
                    {session.analysis ? session.analysis.riskLevel : 'Menunggu'}
                  </span>
                  <button 
                     onClick={(e) => { e.stopPropagation(); onReviewSession && onReviewSession(session); }}
                     className="p-2 text-gray-400 hover:text-brand-orange hover:bg-orange-50 rounded-lg transition-colors"
                     title="Ulas Ulang"
                  >
                      <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-gray-400 dark:text-slate-500 text-sm italic text-center py-8">Belum ada aktivitas audit.</p>}
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-brand-orange to-orange-600 p-6 md:p-8 rounded-2xl shadow-xl text-white">
          <div className="relative z-10">
            <h3 className="font-bold text-xl md:text-2xl mb-2">Upgrade ke Enterprise</h3>
            <p className="text-orange-50 mb-8 max-w-sm leading-relaxed text-sm md:text-base">
              Dapatkan analisis biometrik canggih, konsolidasi multi-perusahaan, dan akses API untuk alur kerja deteksi kecurangan Anda.
            </p>
            <button className="bg-white text-brand-orange px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:bg-gray-50 hover:scale-105 transition-all w-full md:w-auto">
              Lihat Paket Langganan
            </button>
          </div>
          {/* Decorative Circle */}
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl"></div>
          <div className="absolute top-12 right-8 w-24 h-24 bg-brand-blue opacity-20 rounded-full blur-xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
