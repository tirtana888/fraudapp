

import React, { useState, useEffect } from 'react';
import { Menu, Loader2, Database, WifiOff, RefreshCw, CheckCircle2, User, CreditCard, AlertTriangle, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ActiveInterview from './components/ActiveInterview';
import ReportView from './components/ReportView';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import AdminDashboard from './components/AdminDashboard';
import PublicAssessment from './components/PublicAssessment';
import AssessmentSettings from './components/AssessmentSettings';
import PricingView from './components/PricingView';
import CandidatesManualInvite from './components/CandidatesManualInvite';
import CandidatesAutoView from './components/CandidatesAutoView';
import CandidatesReviewInvite from './components/CandidatesReviewInvite';
import JobManager from './components/JobManager';
import PublicJobPage from './components/PublicJobPage';
import PublicCareerPage from './components/PublicCareerPage';
import CandidateList from './components/CandidateList';
import CandidateDetail from './components/CandidateDetail';
import BackgroundCheckCallback from './components/BackgroundCheckCallback';
import CompanyProfileSettings from './components/CompanyProfileSettings';
import HistoryView from './components/HistoryView';
import Documentation from './components/Documentation';
import WorkflowManager from './components/WorkflowManager';
import CreditManagementPage from './components/CreditManagementPage';
import { InterviewSession, UserProfile, CompanyProfile, TimelineEvent, AssessmentInvite } from './types';
import { subscribeToSessions, resetConnectionState, seedRealDatabase, getCompanyById, subscribeToInvites, observeAuthState, logoutFromFirebase } from './services/firebase';
import { getSession, clearSession, saveSession } from './services/auth';
import { ToastProvider } from './components/Toast';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  // Public Link State (Lazy Initialization to prevent Login Flash)
  const [isPublicMode, setIsPublicMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    return params.get('mode') === 'assess' || pathname.startsWith('/jobs/') || pathname.startsWith('/careers/') || pathname === '/background-check-callback';
  });

  const [isBackgroundCheckCallback, setIsBackgroundCheckCallback] = useState(() => {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    return pathname === '/background-check-callback' && params.has('verificationSessionId');
  });

  const [publicCompanyId, setPublicCompanyId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cid');
  });

  const [publicJobRoute, setPublicJobRoute] = useState<{companySlug: string; jobSlug?: string} | null>(() => {
    const pathname = window.location.pathname;
    const jobPageMatch = pathname.match(/^\/jobs\/([^/]+)\/([^/]+)$/);
    if (jobPageMatch) {
      return { companySlug: jobPageMatch[1], jobSlug: jobPageMatch[2] };
    }
    const careerPageMatch = pathname.match(/^\/jobs\/([^/]+)\/?$/);
    if (careerPageMatch) {
      return { companySlug: careerPageMatch[1], jobSlug: undefined };
    }
    return null;
  });

  const [publicCareerRoute, setPublicCareerRoute] = useState<string | null>(() => {
    const pathname = window.location.pathname;
    const careerMatch = pathname.match(/^\/careers\/([^/]+)\/?$/);
    return careerMatch ? careerMatch[1] : null;
  });

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentCompany, setCurrentCompany] = useState<CompanyProfile | null>(null);
  
  // Real-time Data States
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [reviewingSession, setReviewingSession] = useState<InterviewSession | null>(null);
  const [viewingCandidateId, setViewingCandidateId] = useState<string | null>(null);

  // Settings View State
  const [settingsTab, setSettingsTab] = useState<'profile' | 'subscription'>('profile');

  // Connection State
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Email Verification Banner State
  const [showVerificationBanner, setShowVerificationBanner] = useState(false);
  
  // Theme & Mobile State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Ref to track observer setup
  const authObserverSetup = React.useRef(false);

  useEffect(() => {
    seedRealDatabase();
  }, []);

  useEffect(() => {
    // Prevent multiple observer setups
    if (authObserverSetup.current) {
      console.log('[APP] ⚠️ Auth observer already set up, skipping...');
      return;
    }

    console.log('[APP] 🔧 Setting up Firebase Auth observer...');
    authObserverSetup.current = true;
    let isSubscribed = true; // Prevent state updates after unmount
    
    // Set up Firebase Auth state observer
    const unsubscribeAuth = observeAuthState((user) => {
      // Only update state if component is still mounted
      if (!isSubscribed) {
        console.log('[APP] ⚠️ Component unmounted, ignoring auth update');
        return;
      }

      console.log('[APP] 📡 Auth state changed:', user ? user.email : 'null');

      if (user) {
        console.log('[APP] ✅ Firebase Auth user detected:', user.email, 'Verified:', user.emailVerified);
        
        // IMPORTANT: Always update state with Firebase Auth user (source of truth)
        setCurrentUser(user);
        saveSession(user); // Keep local session for backward compatibility
        
        console.log('[APP] ✅ User state updated successfully');
      } else {
        console.log('[APP] ℹ️ No Firebase Auth user detected');
        
        // Try to restore from local session as fallback for legacy users
        const savedUser = getSession();
        if (savedUser) {
          console.log('[APP] 🔄 Restoring legacy user session:', savedUser.email);
          setCurrentUser(savedUser);
        } else {
          console.log('[APP] 🚪 No session found, user will see login page');
          setCurrentUser(null);
        }
      }
      
      // Mark auth as initialized (first callback received)
      if (!isAuthInitialized) {
        console.log('[APP] ✅ Auth initialization complete');
        setIsAuthInitialized(true);
      }
      
      // Mark auth check as complete
      setIsCheckingAuth(false);
    });

    return () => {
      console.log('[APP] 🧹 Cleaning up Firebase Auth observer');
      isSubscribed = false;
      unsubscribeAuth();
    };
  }, []); // Empty dependency array - should only run once

  useEffect(() => {
    if (!currentUser || isPublicMode) return;

    setIsLoadingData(true);
    
    const initCompany = async () => {
       try {
         // Special handling for superadmin (no company needed)
         if (currentUser.role === 'superadmin') {
           console.log('[APP] Superadmin detected, skipping company load');
           setCurrentCompany({
             id: 'superadmin',
             name: 'System Administrator',
             tier: 'Premium',
             status: 'Active',
             adminEmail: currentUser.email || '',
             joinedDate: new Date().toISOString(),
             credits: 999999,
             subscription_ends_at: null
           } as CompanyProfile);
           setIsLoadingData(false);
           return;
         }

         console.log('[APP] Loading company profile for ID:', currentUser.companyId);
         if(currentUser.companyId) {
             const company = await getCompanyById(currentUser.companyId);
             console.log('[APP] Company loaded:', company);
             
             if (company) {
               setCurrentCompany(company);
             } else {
               console.error('[APP] Company profile not found for ID:', currentUser.companyId);
               // Set a minimal company object to prevent infinite loading
               setCurrentCompany({
                 id: currentUser.companyId,
                 name: currentUser.name || 'Unknown Company',
                 tier: 'Freemium',
                 status: 'Active',
                 adminEmail: currentUser.email || '',
                 joinedDate: new Date().toISOString(),
                 credits: 0,
                 subscription_ends_at: null
               } as CompanyProfile);
             }
         } else {
           console.error('[APP] No company ID found for user');
           // Set fallback company
           setCurrentCompany({
             id: 'default',
             name: currentUser.name || 'Unknown Company',
             tier: 'Freemium',
             status: 'Active',
             adminEmail: currentUser.email || '',
             joinedDate: new Date().toISOString(),
             credits: 0,
             subscription_ends_at: null
           } as CompanyProfile);
         }
       } catch (error) {
         console.error('[APP] Error loading company profile:', error);
         // Set fallback company to prevent infinite loading
         setCurrentCompany({
           id: currentUser.companyId || 'default',
           name: currentUser.name || 'Unknown Company',
           tier: 'Freemium',
           status: 'Active',
           adminEmail: currentUser.email || '',
           joinedDate: new Date().toISOString(),
           credits: 0,
           subscription_ends_at: null
         } as CompanyProfile);
       }
       setIsLoadingData(false);
    };
    initCompany();

    const unsubscribeSessions = subscribeToSessions(currentUser.companyId, currentUser.role, (fetchedSessions) => {
      setSessions(fetchedSessions as InterviewSession[]);
      setIsLoadingData(false);
    });

    const unsubscribeInvites = currentUser.companyId ? subscribeToInvites(currentUser.companyId, (fetchedInvites) => {
      setInvites(fetchedInvites as AssessmentInvite[]);
    }) : () => {};

    const handleConnectionError = (e: any) => {
       setApiError(e.detail || "Koneksi database bermasalah.");
       setIsLoadingData(false); 
    };
    window.addEventListener('firebase-connection-error', handleConnectionError as EventListener);

    return () => {
      if (unsubscribeSessions) unsubscribeSessions();
      if (unsubscribeInvites) unsubscribeInvites();
      window.removeEventListener('firebase-connection-error', handleConnectionError as EventListener);
    };
  }, [currentUser, isPublicMode]);

  // Check email verification status and show banner if needed
  useEffect(() => {
    if (currentUser && currentUser.emailVerified === false) {
      console.log('[APP] Email not verified, showing banner');
      setShowVerificationBanner(true);
    } else {
      setShowVerificationBanner(false);
    }
  }, [currentUser]); 

  // --- TIMELINE ENGINE ---
  // Merges sessions and invites into a single, sorted, real-time feed.
  const handleNavigateToCredits = () => {
    setActiveTab('credit-management');
  };

  useEffect(() => {
    if (!currentUser) return;
    
    const sessionEvents: TimelineEvent[] = sessions.map(s => ({
        id: s.id,
        type: 'SESSION',
        date: s.date,
        data: s
    }));

    const inviteEvents: TimelineEvent[] = invites.map(i => ({
        id: i.id || i.access_code,
        type: 'INVITE',
        date: i.createdAt,
        data: i
    }));

    const combined = [...sessionEvents, ...inviteEvents];
    
    // Filter by company for non-admin users
    const filtered = currentUser.role === 'System Admin' 
        ? combined 
        : combined.filter(event => event.data.companyId === currentUser.companyId);

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setTimelineEvents(filtered.slice(0, 50)); // Limit for performance
  }, [sessions, invites, currentUser]);

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
    setViewingCandidateId(null);
    setReviewingSession(null);
  };

  const handleLogin = (user: UserProfile) => {
    console.log('[APP] 🔑 handleLogin called for:', user.email, 'Verified:', user.emailVerified);
    
    // Save session for backward compatibility
    saveSession(user);
    
    // IMPORTANT: Set state explicitly to handle immediate UI update
    // The Firebase Auth observer will confirm this shortly after
    console.log('[APP] 🔄 Updating currentUser state...');
    setCurrentUser(user);
    
    // Mark auth as initialized if not already
    if (!isAuthInitialized) {
      console.log('[APP] ✅ Marking auth as initialized from login');
      setIsAuthInitialized(true);
    }
    
    // Navigate to dashboard
    console.log('[APP] 🏠 Navigating to dashboard...');
    setActiveTab('dashboard');
    
    console.log('[APP] ✅ Login handler completed - NO PAGE REFRESH');
  };

  const handleLogout = async () => {
    console.log('[APP] User logging out...');
    try {
      // Try Firebase Auth logout first
      await logoutFromFirebase();
    } catch (error) {
      console.warn('[APP] Firebase logout failed, clearing local session:', error);
    }
    
    // Clear local session regardless
    clearSession();
    setCurrentUser(null);
    setSessions([]);
    setInvites([]);
    setTimelineEvents([]);
    setCurrentCompany(null);
    setViewingSessionId(null);
    setViewingCandidateId(null);
    setReviewingSession(null);
    setActiveTab('dashboard');
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setViewingSessionId(null);
    setViewingCandidateId(null);
    setReviewingSession(null);
    setIsMobileMenuOpen(false);
    if (tabId === 'settings') setSettingsTab('profile');
  };

  const handleReviewSession = (session: InterviewSession) => {
      setReviewingSession(session);
      setViewingSessionId(null);
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
          case 'jobs': return 'Kelola Lowongan';
          case 'workflows': return 'Workflow Rekrutmen';
          case 'candidates-auto': return 'Otomatis (Instant Assessment)';
          case 'candidates-manual': return 'Manual Invite';
          case 'candidates-review': return 'Review & Invite';
          case 'new-interview': return reviewingSession ? 'Review Jawaban Kandidat' : 'Detail Kandidat';
          case 'history': return 'Riwayat Audit';
          case 'settings': return 'Pengaturan';
          case 'admin-panel': return 'Admin Panel (Super Admin)';
          case 'link-assessment': return 'Pengaturan Link Asesmen';
          case 'documentation': return 'Dokumentasi';
          default: return '';
      }
  }

  // PRIORITY RENDER: Check Public Mode First
  if (isPublicMode) {
    if (isBackgroundCheckCallback) {
      return (
        <ToastProvider>
          <BackgroundCheckCallback />
        </ToastProvider>
      );
    }
    if (publicJobRoute) {
      return (
        <ToastProvider>
          <PublicJobPage
            companySlug={publicJobRoute.companySlug}
            jobSlug={publicJobRoute.jobSlug}
          />
        </ToastProvider>
      );
    }
    if (publicCareerRoute) {
      return (
        <ToastProvider>
          <PublicCareerPage />
        </ToastProvider>
      );
    }
    return (
      <ToastProvider>
        <PublicAssessment companyId={publicCompanyId} />
      </ToastProvider>
    );
  }

  // CRITICAL: Wait for auth initialization before rendering anything
  // This prevents login loops caused by premature redirects
  if (isCheckingAuth || !isAuthInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-brand-slate-900">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin mb-4" />
        <p className="text-gray-500 font-medium">
          {isCheckingAuth ? 'Memeriksa sesi login...' : 'Menginisialisasi autentikasi...'}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {isCheckingAuth ? 'Checking auth state...' : 'Initializing Firebase Auth...'}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <ToastProvider>
        {showSignUp ? (
          <SignUpPage 
            onSignUpSuccess={handleLogin}
            onSwitchToLogin={() => setShowSignUp(false)}
          />
        ) : (
          <LoginPage 
            onLogin={handleLogin}
            onSwitchToSignUp={() => setShowSignUp(true)}
          />
        )}
      </ToastProvider>
    );
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
    // 1. Cek apakah sedang melihat Laporan Detail
    if (viewingSessionId) {
      const session = sessions.find(s => s.id === viewingSessionId);
      if (session) {
        return (
            <ReportView 
                session={session} 
                onBack={() => setViewingSessionId(null)} 
                isDarkMode={isDarkMode}
                onReReview={() => handleReviewSession(session)} 
            />
        );
      }
    }

    if (isLoadingData && sessions.length === 0 && invites.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-in fade-in">
          <Loader2 className="w-10 h-10 text-brand-orange animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Menyinkronkan data database...</p>
        </div>
      )
    }

    // 2. Jika tidak melihat laporan, render Tab yang aktif
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
                  timelineEvents={timelineEvents}
                  currentCompany={currentCompany!}
                  onViewSession={setViewingSessionId}
                  onReviewSession={handleReviewSession}
                  onViewAll={() => setActiveTab('history')}
               />;
      case 'jobs':
        return <JobManager currentCompany={currentCompany!} />;
      case 'workflows':
        return <WorkflowManager companyId={currentCompany!.id} isDarkMode={isDarkMode} />;
      case 'candidates-auto':
        if (viewingCandidateId) {
          return <CandidateDetail
            sessionId={viewingCandidateId}
            company={currentCompany!}
            onBack={() => {
              setViewingCandidateId(null);
            }}
          />;
        }
        return <CandidatesAutoView
          companyId={currentCompany!.id}
          onViewSession={(sessionId) => {
            setViewingCandidateId(sessionId);
          }}
        />;
      case 'candidates-manual':
        if (viewingCandidateId) {
          return <CandidateDetail
            sessionId={viewingCandidateId}
            company={currentCompany!}
            onBack={() => {
              setViewingCandidateId(null);
            }}
          />;
        }
        return <CandidatesManualInvite
          currentCompany={currentCompany!}
          onViewSession={(sessionId) => {
            setViewingCandidateId(sessionId);
          }}
        />;
      case 'candidates-review':
        if (viewingCandidateId) {
          return <CandidateDetail
            sessionId={viewingCandidateId}
            company={currentCompany!}
            onBack={() => {
              setViewingCandidateId(null);
            }}
          />;
        }
        return <CandidatesReviewInvite
          companyId={currentCompany!.id}
          companyName={currentCompany!.name}
          onViewSession={(sessionId) => {
            setViewingCandidateId(sessionId);
          }}
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
        if (viewingCandidateId) {
          return <CandidateDetail
            sessionId={viewingCandidateId}
            company={currentCompany!}
            onBack={() => {
              setViewingCandidateId(null);
            }}
          />;
        }
        return <HistoryView 
          companyId={currentCompany!.id} 
          company={currentCompany!}
          onViewCandidate={setViewingCandidateId}
          onUpgradeClick={() => setActiveTab('settings')}
        />;
      case 'documentation':
        return <Documentation />;
      case 'credit-management':
        return <CreditManagementPage 
          company={currentCompany!}
          user={currentUser!}
          onCompanyUpdate={handleCompanyUpdate}
        />;
      case 'admin-panel':
        return <AdminDashboard />;
      case 'settings':
        return (
          <div className="animate-in fade-in space-y-6">
             {/* Sub Navigation Tabs */}
             <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto self-start inline-flex">
                <button 
                  onClick={() => setSettingsTab('profile')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                     settingsTab === 'profile' 
                     ? 'bg-white dark:bg-brand-slate-900 text-brand-dark dark:text-white shadow-sm' 
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                   <User size={16} /> Profil Akun
                </button>
                <button 
                  onClick={() => setSettingsTab('subscription')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                     settingsTab === 'subscription' 
                     ? 'bg-white dark:bg-brand-slate-900 text-brand-orange shadow-sm' 
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                   <CreditCard size={16} /> Paket Langganan
                </button>
             </div>

             {/* Tab Content */}
             {settingsTab === 'profile' ? (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Informasi Pengguna</h2>

                    <div className="p-5 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-2xl border border-brand-blue/10 dark:border-brand-blue/20 flex items-center gap-4">
                          {currentUser?.avatar && <img src={currentUser.avatar} alt="User" className="w-14 h-14 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" />}
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white text-lg">{currentUser?.name}</p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">{currentUser?.email}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-xs font-bold rounded">{currentUser?.role}</span>
                          </div>
                    </div>
                  </div>

                  {currentCompany && (
                    <CompanyProfileSettings
                      company={currentCompany}
                      onUpdate={async () => {
                        if (currentUser?.companyId) {
                          const updated = await getCompanyById(currentUser.companyId);
                          setCurrentCompany(updated);
                        }
                      }}
                    />
                  )}
                </div>
             ) : (
                <div className="bg-white dark:bg-brand-slate-850 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                    <PricingView currentTier={currentCompany?.tier || 'Basic'} />
                </div>
             )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <ToastProvider>
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
        setActiveTab={handleTabChange} 
        companyName={currentCompany?.name || 'FraudGuard'}
        userRole={currentUser.role}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className={`${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-56'} p-4 md:p-8 min-h-screen transition-all duration-300`}>
         <div className="max-w-7xl mx-auto">
            {/* Email Verification Warning Banner */}
            {showVerificationBanner && (
              <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-orange-900 mb-1">Email Belum Diverifikasi</h3>
                      <p className="text-sm text-orange-800 mb-2">
                        Silakan verifikasi email Anda ({currentUser.email}) untuk keamanan akun yang lebih baik.
                      </p>
                      <button 
                        onClick={async () => {
                          try {
                            const { resendVerificationEmail } = await import('./services/firebase');
                            await resendVerificationEmail();
                            alert('Email verifikasi telah dikirim! Periksa inbox Anda.');
                          } catch (error: any) {
                            alert(error.message || 'Gagal mengirim email verifikasi');
                          }
                        }}
                        className="text-sm font-medium text-orange-700 hover:text-orange-900 underline"
                      >
                        Kirim Ulang Email Verifikasi
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowVerificationBanner(false)}
                    className="text-orange-600 hover:text-orange-800 flex-shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

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
    </ToastProvider>
  );
};

export default App;
