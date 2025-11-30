import React, { useState, useEffect } from 'react';
import { Menu, Loader2, Database, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ActiveInterview from './components/ActiveInterview';
import ReportView from './components/ReportView';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import PublicAssessment from './components/PublicAssessment';
import AssessmentSettings from './components/AssessmentSettings';
import PricingView from './components/PricingView';
import { InterviewSession, UserProfile, CompanyProfile } from './types';
import { subscribeToSessions, resetConnectionState, seedRealDatabase, getCompanyById } from './services/firebase';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentCompany, setCurrentCompany] = useState<CompanyProfile | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [reviewingSession, setReviewingSession] = useState<InterviewSession | null>(null);
  
  // Connection State
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Theme & Mobile State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Public Link State
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [publicCompanyId, setPublicCompanyId] = useState<string | null>(null);

  useEffect(() => {
    seedRealDatabase();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const cid = params.get('cid');

    if (mode === 'assess' && cid) {
      setIsPublicMode(true);
      setPublicCompanyId(cid);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || isPublicMode) return;

    setIsLoadingData(true);
    
    const initCompany = async () => {
       if(currentUser.companyId && currentUser.companyId !== 'system') {
           const company = await getCompanyById(currentUser.companyId);
           setCurrentCompany(company);
       } else {
           setCurrentCompany({
               id: 'system', name: 'System Admin View', tier: 'Enterprise', status: 'Active', adminEmail: 'admin@fraudguard.id', joinedDate: new Date().toISOString()
           });
       }
    };
    initCompany();

    const unsubscribe = subscribeToSessions((fetchedSessions) => {
      setSessions(fetchedSessions as InterviewSession[]);
      setIsLoadingData(false);
    });

    const handleConnectionError = (e: any) => {
       setApiError(e.detail || "Koneksi database bermasalah.");
       setIsLoadingData(false); 
    };
    window.addEventListener('firebase-connection-error', handleConnectionError as EventListener);

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('firebase-connection-error', handleConnectionError as EventListener);
    };
  }, [currentUser, isPublicMode]); 

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleRetryConnection = () => {
    setApiError(null);
    setIsLoadingData(true);
    resetConnectionState();
    window.location.reload(); 
  };

  const handleInterviewComplete = () => {
    setActiveTab('history');
    setViewingSessionId(null);
    setReviewingSession(null);
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSessions([]);
    setCurrentCompany(null);
    setViewingSessionId(null);
    setReviewingSession(null);
    setActiveTab('dashboard');
  };

  const handleReviewSession = (session: InterviewSession) => {
      setReviewingSession(session);
      setActiveTab('new-interview'); 
  };

  const handleCompanyUpdate = async () => {
     if (currentUser?.companyId) {
         const updated = await getCompanyById(currentUser.companyId);
         if (updated) setCurrentCompany(updated);
     }
  };

  const getPageTitle = (tab: string) => {
      switch(tab) {
          case 'dashboard': return 'Ringkasan Eksekutif';
          case 'new-interview': return reviewingSession ? 'Review Jawaban Kandidat' : 'Wawancara Baru';
          case 'history': return 'Riwayat Audit';
          case 'settings': return 'Pengaturan';
          case 'admin-panel': return 'Admin Panel (Super Admin)';
          case 'link-assessment': return 'Pengaturan Link Asesmen';
          case 'pricing': return 'Langganan & Paket';
          default: return '';
      }
  }

  const companySessions = sessions.filter(s => {
      if (currentUser?.role === 'System Admin') return true; 
      return s.companyId === currentCompany?.id;
  });

  if (isPublicMode && publicCompanyId) {
    return <PublicAssessment companyId={publicCompanyId} />;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (!currentCompany && !isPublicMode) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-brand-slate-900">
           <Loader2 className="w-12 h-12 text-brand-orange animate-spin mb-4" />
           <p className="text-gray-500 font-medium">Memuat Profil Perusahaan Real-time...</p>
        </div>
      );
  }

  const renderContent = () => {
    if (viewingSessionId) {
      const session = sessions.find(s => s.id === viewingSessionId);
      if (session) {
        return <ReportView session={session} onBack={() => setViewingSessionId(null)} isDarkMode={isDarkMode} />;
      }
    }

    if (isLoadingData && sessions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-in fade-in">
          <Loader2 className="w-10 h-10 text-brand-orange animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Menyinkronkan data database...</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
                  sessions={companySessions} 
                  currentCompany={currentCompany!} 
                  onViewSession={setViewingSessionId}
                  onReviewSession={handleReviewSession} 
               />;
      case 'new-interview':
        return <ActiveInterview 
                  onComplete={handleInterviewComplete} 
                  companyId={currentCompany!.id} 
                  existingSession={reviewingSession || undefined}
               />;
      case 'link-assessment':
         return <AssessmentSettings 
                    currentCompany={currentCompany!} 
                    onUpdate={handleCompanyUpdate} 
                />;
      case 'history':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Daftar Riwayat Audit</h2>
            <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-5 font-bold">Kandidat</th>
                      <th className="p-5 font-bold">Tanggal</th>
                      <th className="p-5 font-bold">Tingkat Risiko</th>
                      <th className="p-5 font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {companySessions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                        <td className="p-5">
                          <p className="font-bold text-gray-800 dark:text-gray-200 text-sm group-hover:text-brand-orange transition-colors">{s.candidate.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.candidate.role}</p>
                        </td>
                        <td className="p-5 text-sm text-gray-600 dark:text-gray-400 font-medium">
                          {new Date(s.date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap
                            ${s.status === 'pending_review' ? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' :
                              s.analysis?.riskLevel === 'High' || s.analysis?.riskLevel === 'Critical' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30' : 
                              s.analysis?.riskLevel === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/30' :
                              'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30'}`}>
                            {s.status === 'pending_review' ? 'Perlu Review' : s.analysis?.riskLevel}
                          </span>
                        </td>
                        <td className="p-5">
                          <button 
                            onClick={() => s.status === 'pending_review' ? handleReviewSession(s) : setViewingSessionId(s.id)}
                            className="text-brand-dark dark:text-gray-200 bg-gray-100 dark:bg-slate-700 hover:bg-brand-orange hover:text-white dark:hover:bg-brand-orange dark:hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                          >
                            {s.status === 'pending_review' ? 'Mulai Review' : 'Lihat Laporan'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {companySessions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-400 dark:text-gray-500 italic">
                          Belum ada data di database untuk perusahaan ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'admin-panel':
        return <AdminDashboard />;
      case 'pricing':
        return <PricingView currentTier={currentCompany?.tier || 'Basic'} />;
      case 'settings':
        return (
          <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 animate-in fade-in">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Pengaturan Akun</h2>
            
            <div className="p-5 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-2xl border border-brand-blue/10 dark:border-brand-blue/20 flex items-center gap-4">
                  {currentUser?.avatar && <img src={currentUser.avatar} alt="User" className="w-14 h-14 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" />}
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white text-lg">{currentUser?.name}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{currentUser?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-xs font-bold rounded">{currentUser?.role}</span>
                  </div>
            </div>
            {/* Additional settings placeholder */}
            <div className="mt-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">Pengaturan lebih lanjut tersedia di versi berikutnya.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-brand-slate-900' : 'bg-gray-50'}`}>
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-brand-slate-850 p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center sticky top-0 z-20">
         <div className="flex items-center gap-2">
            <div className="bg-brand-orange p-1.5 rounded-lg text-white">
              <CheckCircle2 size={18} />
            </div>
            <span className="font-bold text-gray-800 dark:text-white">FraudGuard</span>
         </div>
         <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500">
           <Menu size={24} />
         </button>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
        companyName={currentCompany?.name || 'FraudGuard'}
        userRole={currentUser.role}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <main className="md:ml-64 p-4 md:p-8 min-h-screen">
         <div className="max-w-7xl mx-auto">
            {/* Header / Title */}
            <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{getPageTitle(activeTab)}</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Selamat datang kembali, {currentUser.name.split(' ')[0]}.</p>
               </div>
               {/* Connection Status Indicator */}
               {apiError && (
                 <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100 cursor-pointer hover:bg-red-100" onClick={handleRetryConnection}>
                    <WifiOff size={14} /> {apiError} - Klik untuk refresh
                 </div>
               )}
            </div>

            {renderContent()}
         </div>
      </main>
    </div>
  );
};

export default App;