

import React, { useState } from 'react';
import { Users, AlertTriangle, FileCheck, Copy, Check, ExternalLink, RefreshCw, Lock, Zap, Send, FileText } from 'lucide-react';
import { InterviewSession, RiskLevel, CompanyProfile, TimelineEvent, AssessmentInvite } from '../types';
import { PLAN_LIMITS } from '../constants/plans';

interface DashboardProps {
  timelineEvents: TimelineEvent[];
  currentCompany: CompanyProfile;
  onViewSession?: (id: string) => void;
  onReviewSession?: (session: InterviewSession) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ timelineEvents, currentCompany, onViewSession, onReviewSession }) => {
  const [copied, setCopied] = useState(false);

  // FEATURE GATING
  const features = PLAN_LIMITS[currentCompany.tier];

  // Calculate stats from the timeline events
  const sessions = timelineEvents.filter(e => e.type === 'SESSION').map(e => e.data as InterviewSession);
  const totalInterviews = sessions.length;
  const highRisk = sessions.filter(s => s.analysis?.riskLevel === RiskLevel.HIGH || s.analysis?.riskLevel === RiskLevel.CRITICAL).length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const pendingReview = sessions.filter(s => s.status === 'pending_review');

  // Generate Unique Link
  const assessmentLink = `${window.location.origin}?mode=assess&cid=${currentCompany.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(assessmentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
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
                    <p className="text-[10px] text-gray-500">Tingkatkan ke Premium untuk membuka fitur link mandiri.</p>
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
          icon={Users} 
          label="Total Undangan" 
          value={timelineEvents.filter(e => e.type === 'INVITE').length} 
          color="bg-purple-500" 
        />
      </div>

      <div className="bg-white dark:bg-brand-slate-850 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-brand-orange animate-pulse"></span>
                Timeline Aktivitas Real-time
            </h3>
            <button className="text-brand-orange text-sm font-semibold hover:underline">Lihat Semua</button>
          </div>
          
          <div className="space-y-4">
            {timelineEvents.slice(0, 5).map((event) => {
              // --- RENDER INVITE EVENT ---
              if (event.type === 'INVITE') {
                const invite = event.data as AssessmentInvite;

                // Determine status color and label
                const statusConfig = invite.status === 'COMPLETED'
                  ? { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-100 dark:border-green-900/30', iconBg: 'bg-green-100', iconColor: 'text-green-700', label: '✓ Selesai', labelColor: 'text-green-600 dark:text-green-400' }
                  : invite.status === 'IN_PROGRESS'
                  ? { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-900/30', iconBg: 'bg-blue-100', iconColor: 'text-blue-700', label: '⏳ Sedang Interview', labelColor: 'text-blue-600 dark:text-blue-400' }
                  : invite.status === 'ACCESSING'
                  ? { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-100 dark:border-purple-900/30', iconBg: 'bg-purple-100', iconColor: 'text-purple-700', label: '👀 Sedang Mengakses', labelColor: 'text-purple-600 dark:text-purple-400' }
                  : invite.status === 'EXPIRED'
                  ? { bg: 'bg-gray-50 dark:bg-gray-900/10', border: 'border-gray-100 dark:border-gray-900/30', iconBg: 'bg-gray-100', iconColor: 'text-gray-700', label: '❌ Kadaluarsa', labelColor: 'text-gray-600 dark:text-gray-400' }
                  : { bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-100 dark:border-yellow-900/30', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-700', label: '⏱️ Menunggu Kandidat', labelColor: 'text-yellow-600 dark:text-yellow-400' };

                return (
                  <div key={event.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 ${statusConfig.bg} border ${statusConfig.border} rounded-xl transition-all gap-3`}>
                    <div className="flex items-center space-x-4">
                       <div className={`h-10 w-10 rounded-full ${statusConfig.iconBg} ${statusConfig.iconColor} flex items-center justify-center shrink-0`}>
                           <Send size={18} />
                       </div>
                       <div>
                           <p className="font-bold text-gray-900 dark:text-gray-100">{invite.name}</p>
                           <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                               Undangan via Email • <span className={`font-bold ${statusConfig.labelColor}`}>{statusConfig.label}</span>
                           </p>
                       </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap self-start sm:self-center">
                        {new Date(invite.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }
              // --- RENDER SESSION EVENT ---
              else if (event.type === 'SESSION') {
                const session = event.data as InterviewSession;
                
                // RENDER PENDING REVIEW SESSION
                if (session.status === 'pending_review') {
                  return (
                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl transition-all gap-3">
                      <div className="flex items-center space-x-4">
                         <div className="h-10 w-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-lg shrink-0">
                             {session.candidate.name.charAt(0)}
                         </div>
                         <div>
                             <p className="font-bold text-gray-900 dark:text-gray-100">{session.candidate.name} <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full ml-1">PERLU REVIEW</span></p>
                             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Asesmen Selesai (Via Link)</p>
                         </div>
                      </div>
                      <button 
                         onClick={() => onReviewSession && onReviewSession(session)}
                         className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                      >
                         Mulai Review
                      </button>
                    </div>
                  );
                }
                
                // RENDER COMPLETED SESSION
                return (
                   <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl transition-all gap-3">
                     <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-lg shrink-0">
                            <FileText size={18} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{session.candidate.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                Laporan Selesai Dibuat • Risiko: <span className={`font-bold ${session.analysis?.riskLevel === 'High' ? 'text-red-600' : 'text-green-800'}`}>{session.analysis?.riskLevel || 'N/A'}</span>
                            </p>
                        </div>
                     </div>
                     <button 
                        onClick={() => onViewSession && onViewSession(session.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                     >
                        <FileCheck size={12} /> Lihat Laporan
                     </button>
                   </div>
                );
              }
              return null;
            })}
            
            {timelineEvents.length === 0 && <p className="text-gray-400 dark:text-slate-500 text-sm italic text-center py-8">Belum ada aktivitas. Coba undang kandidat baru.</p>}
          </div>
        </div>
    </div>
  );
};

export default Dashboard;