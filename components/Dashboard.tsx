

import React, { useState } from 'react';
import { Users, AlertTriangle, FileCheck, Copy, Check, ExternalLink, RefreshCw, Lock, Zap, Send, FileText, CreditCard, Crown, BarChart3 } from 'lucide-react';
import { InterviewSession, RiskLevel, CompanyProfile, TimelineEvent, AssessmentInvite } from '../types';
import { PLAN_LIMITS } from '../constants/plans';

interface DashboardProps {
  timelineEvents: TimelineEvent[];
  currentCompany: CompanyProfile;
  onViewSession?: (id: string) => void;
  onReviewSession?: (session: InterviewSession) => void;
  onViewAll?: () => void;
  creditBalance?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ timelineEvents, currentCompany, onViewSession, onReviewSession, onViewAll, creditBalance }) => {
  const [copied, setCopied] = useState(false);

  // FEATURE GATING
  const features = currentCompany?.tier && PLAN_LIMITS[currentCompany.tier]
    ? PLAN_LIMITS[currentCompany.tier]
    : PLAN_LIMITS['Freemium'];

  // 1. DATA PROCESSING
  const sessions = timelineEvents.filter(e => e.type === 'SESSION').map(e => e.data as InterviewSession);

  // Calculate Stats
  const totalInterviews = sessions.length;
  const highRisk = sessions.filter(s => s.analysis?.riskLevel === RiskLevel.HIGH || s.analysis?.riskLevel === RiskLevel.CRITICAL).length;
  const completed = sessions.filter(s => s.status === 'completed').length;

  // 2. IDENTIFY TOP TALENT (North Star Logic)
  // Criteria: Completed, Low Risk, Sorted by Best Consistency/Fraud Score
  const topCandidates = sessions
    .filter(s => s.status === 'completed' && s.analysis)
    .sort((a, b) => {
      // Calculate simple score: Lower Fraud Score is better, Higher Consistency is better
      const scoreA = getCompositeScore(a);
      const scoreB = getCompositeScore(b);
      return scoreB - scoreA; // Descending
    })
    .slice(0, 3); // Top 3

  function getCompositeScore(session: InterviewSession): number {
    if (!session.analysis?.scores) return 0;
    const fraudAvg = (
      (session.analysis.scores.pressure || 0) +
      (session.analysis.scores.opportunity || 0) +
      (session.analysis.scores.rationalization || 0)
    ) / 3;

    // Invert fraud score (100 - fraud) -> Higher is better
    // Add Consistency boost (if available)
    const consistency = session.analysis.consistencyScore || 85;
    return (100 - fraudAvg) + (consistency * 0.5); // Weighted score
  }

  // 3. ACTIONABLE ITEMS (Pending Review)
  const pendingReviews = sessions.filter(s => s.status === 'pending_review');

  // Generate Unique Link
  const assessmentLink = `${window.location.origin}?mode=assess&cid=${currentCompany.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(assessmentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
    <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('bg-', 'text-')}`}>
        <Icon size={48} />
      </div>
      <div className="relative z-10">
        <p className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-3xl font-extrabold text-gray-800 dark:text-white">{value}</h3>
        {trend && (
          <p className="text-xs font-medium text-green-600 flex items-center gap-1 mt-2">
            <span className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">↗ {trend}</span>
            <span className="text-gray-400 dark:text-gray-500">minggu ini</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">

      {/* 1. HEADER & LINK WIDGET */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Executive Summary
          </h2>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Analisis & Rekomendasi Talent untuk <span className="font-bold text-brand-dark dark:text-white">{currentCompany.name}</span>
          </p>
        </div>

        {features?.allow_permanent_link === true ? (
          <div className="w-full md:w-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-1.5 rounded-xl shadow-sm flex items-center gap-2">
            <div className="bg-brand-blue/10 dark:bg-blue-500/20 p-2 rounded-lg text-brand-blue dark:text-blue-400">
              <ExternalLink size={18} />
            </div>
            <div className="flex-1 px-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Link Asesmen Publik</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{assessmentLink}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="bg-brand-dark text-white px-3 py-2 rounded-lg hover:bg-black transition-colors"
              title="Salin Link"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-60">
            <Lock size={16} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Upgrade untuk Link Publik</span>
          </div>
        )}
      </header>

      {/* 2. NORTH STAR METRIC: TOP TALENT RECOMMENDATIONS */}
      {topCandidates.length > 0 ? (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-700 p-2 rounded-xl shadow-sm border border-yellow-200">
              <Crown size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">Top Talent Recommendations</h3>
              <p className="text-xs text-gray-500 mt-1">Kandidat terbaik berdasarkan Integritas & Konsistensi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topCandidates.map((candidate, idx) => {
              const consistency = candidate.analysis?.consistencyScore || 0;
              const riskLevel = candidate.analysis?.riskLevel || 'Low';

              // Refined Rank visuals
              const rankConfig = idx === 0
                ? { label: 'Top #1', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-100' }
                : idx === 1
                  ? { label: 'Top #2', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', ring: 'ring-slate-100' }
                  : { label: 'Top #3', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', ring: 'ring-orange-100' };

              return (
                <div key={candidate.id} className={`bg-white dark:bg-brand-slate-850 rounded-2xl border ${rankConfig.border} p-5 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group hover:-translate-y-1`}>

                  {/* Subtle Gradient Header */}
                  <div className={`absolute top-0 left-0 right-0 h-16 opacity-30 ${rankConfig.bg}`}></div>

                  {/* Rank Badge */}
                  <div className={`absolute top-3 right-3 ${rankConfig.bg} ${rankConfig.text} border ${rankConfig.border} px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-sm`}>
                    {rankConfig.label}
                  </div>

                  <div className="relative flex flex-col items-center text-center mb-4 mt-2">
                    <div className={`h-16 w-16 rounded-full p-1 bg-white mb-3 shadow-md border ${rankConfig.border}`}>
                      <div className={`h-full w-full rounded-full bg-gradient-to-br from-brand-blue to-purple-600 flex items-center justify-center text-white font-bold text-2xl`}>
                        {candidate.candidate.name.charAt(0)}
                      </div>
                    </div>

                    <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate w-full px-2">{candidate.candidate.name}</h4>
                    <p className="text-xs text-brand-blue font-medium bg-brand-blue/5 px-2 py-0.5 rounded-md mt-1">{candidate.candidate.role}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5 border-t border-gray-100 dark:border-slate-700 pt-4">
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Integritas</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${riskLevel === 'Low' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {riskLevel}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Konsistensi</p>
                      <span className="text-sm font-black text-gray-700 dark:text-gray-200">{consistency}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onViewSession && onViewSession(candidate.id)}
                    className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-brand-dark hover:text-white dark:hover:bg-brand-blue transition-all flex items-center justify-center gap-2 group-hover:shadow-md border border-gray-100 dark:border-slate-700"
                  >
                    Lihat Profil
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-r from-gray-50 to-slate-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <div className="mx-auto bg-white p-3 w-14 h-14 rounded-full flex items-center justify-center text-gray-400 mb-4 shadow-sm border border-gray-200">
            <Crown size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-600">Menunggu Top Talent</h3>
          <p className="text-xs text-gray-400 mt-1">Selesaikan wawancara untuk melihat rekomendasi.</p>
        </section>
      )}

      {/* 3. OPERATIONAL STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Grid - Takes up 3 cols on Large */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-4 px-1">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Metrik Operasional</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Total Kandidat" value={totalInterviews} color="bg-brand-blue" trend="12%" />
            <StatCard icon={FileCheck} label="Siap Direkrut" value={completed} color="bg-green-500" trend="5%" />
            <StatCard icon={AlertTriangle} label="Risiko Tinggi" value={highRisk} color="bg-red-500" />
          </div>
        </div>

        {/* Credit Card - Compact - Takes up 1 col */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="flex items-center gap-2 mb-4 px-1 opacity-0">
            <span className="text-xs font-bold">Spacer</span>
          </div>
          <div className="flex-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-110 transition-transform">
              <CreditCard size={64} />
            </div>
            <div>
              <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1">Sisa Credit</p>
              <h3 className="text-4xl font-extrabold">{creditBalance !== undefined ? creditBalance : '-'}</h3>
            </div>
            <button className="mt-4 w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 rounded-lg text-xs font-bold transition-colors">
              Top Up Credit
            </button>
          </div>
        </div>
      </div>

      {/* 4. ACTION CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-gray-100 dark:border-slate-800">
        {/* Pending Actions */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-orange"></div>
            Butuh Review ({pendingReviews.length})
          </h3>

          <div className="space-y-3">
            {pendingReviews.length > 0 ? pendingReviews.slice(0, 3).map(session => (
              <div key={session.id} className="bg-white dark:bg-brand-slate-850 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-center justify-between hover:border-brand-orange/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-yellow-50 text-yellow-700 flex items-center justify-center font-bold text-sm border border-yellow-100">
                    {session.candidate.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-brand-orange transition-colors">{session.candidate.name}</p>
                    <p className="text-xs text-gray-500">Menunggu keputusan</p>
                  </div>
                </div>
                <button
                  onClick={() => onReviewSession && onReviewSession(session)}
                  className="text-gray-400 hover:text-brand-dark transition-colors"
                >
                  <ExternalLink size={18} />
                </button>
              </div>
            )) : (
              <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-xs font-medium">Semua kandidat aman terkendali ☕</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Feed - Cleaner List */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            Aktivitas Terkini
          </h3>
          <div className="relative border-l-2 border-gray-100 dark:border-slate-700 ml-3 space-y-6 py-2">
            {timelineEvents.slice(0, 4).map(event => {
              const isSession = event.type === 'SESSION';
              const data = event.data as any;
              const name = data.candidate?.name || data.name || 'Unknown';

              return (
                <div key={event.id} className="pl-6 relative">
                  <div className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${isSession ? 'bg-blue-500' : 'bg-purple-400'}`}></div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-bold text-gray-900 dark:text-white">{name}</span> {isSession ? 'menyelesaikan asesmen' : 'diundang'}.
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(event.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
