

import React, { useState, useEffect } from 'react';
import { Menu, Loader2, Database, WifiOff, RefreshCw, CheckCircle2, User, CreditCard, AlertTriangle, X, Unlock } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ActiveInterview from './components/ActiveInterview';
import ReportView from './components/ReportView';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import SettingsPage from './components/SettingsPage';
import AdminDashboard from './components/AdminDashboard';
import PublicAssessment from './components/PublicAssessment';
import AssessmentSettings from './components/AssessmentSettings';
import PricingView from './components/PricingView';
import CandidatesManualInvite from './components/CandidatesManualInvite';
import CandidatesAutoView from './components/CandidatesAutoView';

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
import { InterviewSession, UserProfile, CompanyProfile, TimelineEvent, AssessmentInvite, CREDIT_COSTS } from './types';
import { subscribeToSessions, resetConnectionState, seedRealDatabase, getCompanyById, subscribeToInvites, observeAuthState, logoutFromFirebase } from './services/firebase';
import { getSession, clearSession, saveSession } from './services/auth';
import { getCreditBalance, deductCredit } from './services/creditManagement';
import PaymentModal from './components/PaymentModal';
import { ToastProvider, useToast } from './components/Toast';
import { db, COLLECTIONS } from './services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Unlock Modal Component
interface UnlockModalProps {
  candidate: InterviewSession;
  creditBalance: number;
  isUnlocking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const UnlockModal: React.FC<UnlockModalProps> = ({ candidate, creditBalance, isUnlocking, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Konfirmasi Unlock Kandidat</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 flex items-center justify-center">
              <User className="text-brand-orange" size={24} />
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-white">{candidate.candidate.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{candidate.candidate.role || 'Unknown Position'}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="text-blue-600" size={20} />
              <span className="font-semibold text-gray-800 dark:text-white">Biaya Unlock:</span>
            </div>
            <span className="text-xl font-bold text-blue-600">{CREDIT_COSTS.UNLOCK_PROFILE} Credit</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">Saldo Anda:</span>
            <span className={`font-bold ${creditBalance >= CREDIT_COSTS.UNLOCK_PROFILE ? 'text-green-600' : 'text-red-600'}`}>
              {creditBalance} Credit
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Dengan menggunakan {CREDIT_COSTS.UNLOCK_PROFILE} credit, Anda akan mendapatkan akses penuh untuk melihat profil dan detail assessment kandidat ini.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isUnlocking || creditBalance < CREDIT_COSTS.UNLOCK_PROFILE}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-orange to-brand-blue text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUnlocking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Unlock size={18} />
                Unlock Kandidat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

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

    // Don't treat payment redirects as public mode
    const isPaymentRedirect = params.get('payment') && params.get('redirect');
    if (isPaymentRedirect) {
      console.log('[APP] Payment redirect detected, not public mode');
      return false;
    }

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

  const [publicJobRoute, setPublicJobRoute] = useState<{ companySlug: string; jobSlug?: string } | null>(() => {
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

  // Unlock Modal State
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedCandidateForUnlock, setSelectedCandidateForUnlock] = useState<InterviewSession | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

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

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Ref to track observer setup
  const authObserverSetup = React.useRef(false);

  useEffect(() => {
    seedRealDatabase();
  }, []);

  // Credit Balance State
  const [creditBalance, setCreditBalance] = useState<number | undefined>(undefined);

  // Poll/Fetch Credit Balance
  useEffect(() => {
    if (currentCompany?.id) {
      const fetchCredits = async () => {
        try {
          const balance = await getCreditBalance(currentCompany.id);
          setCreditBalance(balance);
        } catch (error) {
          console.error('Error fetching credits:', error);
        }
      };

      fetchCredits();
    }
  }, [currentCompany?.id, activeTab]);

  useEffect(() => {
    // Prevent multiple observer setups (even in StrictMode)
    if (authObserverSetup.current) {
      console.log('[APP] ⚠️ Auth observer already set up, skipping duplicate mount...');
      // In StrictMode, this might run twice, but we only set up once
      // We still need to mark initialization properly
      if (!isAuthInitialized) {
        // Check if user exists in local storage
        const savedUser = getSession();
        if (savedUser) {
          console.log('[APP] 🔄 Fast restore from session:', savedUser.email);
          setCurrentUser(savedUser);
        }
        // Mark as initialized to unblock UI
        setTimeout(() => {
          if (!isAuthInitialized) {
            console.log('[APP] ✅ Marking auth as initialized (fallback)');
            setIsAuthInitialized(true);
            setIsCheckingAuth(false);
          }
        }, 1000);
      }
      return;
    }

    console.log('[APP] 🔧 Setting up Firebase Auth observer...');
    authObserverSetup.current = true;
    let isSubscribed = true; // Prevent state updates after unmount
    let initializationTimeout: NodeJS.Timeout;

    // Set up Firebase Auth state observer
    const unsubscribeAuth = observeAuthState((user) => {
      // Only update state if component is still mounted
      if (!isSubscribed) {
        console.log('[APP] ⚠️ Component unmounted, ignoring auth update');
        return;
      }

      console.log('[APP] 📡 Auth state changed:', user ? user.email : 'null');

      // Clear timeout since we got callback
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }

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
      console.log('[APP] ✅ Auth initialization complete');
      setIsAuthInitialized(true);
      setIsCheckingAuth(false);
    });

    // Fallback: If observer doesn't fire within 2s, mark as initialized anyway
    initializationTimeout = setTimeout(() => {
      if (!isAuthInitialized) {
        console.log('[APP] ⏰ Auth observer timeout - marking as initialized anyway');
        setIsAuthInitialized(true);
        setIsCheckingAuth(false);
      }
    }, 2000);

    return () => {
      console.log('[APP] 🧹 Cleaning up Firebase Auth observer');
      isSubscribed = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      unsubscribeAuth();
    };
  }, []); // Empty dependency array - should only run once

  useEffect(() => {
    if (!currentUser || isPublicMode) return;

    console.log('[APP] 🚀 Starting dashboard data load...');

    // OPTIMIZATION 1: Set minimal loading state
    setIsLoadingData(true);

    // OPTIMIZATION 2: Create fallback company immediately (show dashboard faster)
    const fallbackCompany: CompanyProfile = {
      id: currentUser.companyId || 'default',
      name: currentUser.name || 'Loading...',
      tier: 'Freemium',
      status: 'Active',
      adminEmail: currentUser.email || '',
      joinedDate: new Date().toISOString(),
      credits: 1000, // Default initial credits for new companies
      subscription_ends_at: null
    };

    // Set fallback immediately to unblock UI
    setCurrentCompany(fallbackCompany);
    setIsLoadingData(false); // Unblock UI immediately!

    const initCompany = async () => {
      try {
        // Special handling for superadmin (no company needed)
        if (currentUser.role === 'superadmin') {
          console.log('[APP] ✅ Superadmin detected');
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
          return;
        }

        console.log('[APP] 📄 Loading company profile for ID:', currentUser.companyId);
        if (currentUser.companyId) {
          // OPTIMIZATION 3: Add timeout to company fetch
          const companyPromise = getCompanyById(currentUser.companyId);
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.log('[APP] ⏰ Company fetch timeout, using fallback');
              resolve(null);
            }, 2000) // 2 second timeout
          );

          const company = await Promise.race([companyPromise, timeoutPromise]);

          if (company) {
            console.log('[APP] ✅ Company loaded:', company.name);
            setCurrentCompany(company);
          } else {
            console.log('[APP] ⚠️ Using fallback company (timeout or not found)');
            // Keep fallback company
          }
        } else {
          console.log('[APP] ⚠️ No company ID, using fallback');
        }
      } catch (error) {
        console.error('[APP] ❌ Error loading company:', error);
        // Keep fallback company
      }
    };

    // OPTIMIZATION 4: Run company fetch in background (don't block)
    initCompany();

    // OPTIMIZATION 5: Subscribe to sessions (async, non-blocking)
    let unsubscribeSessions: (() => void) | undefined;
    let unsubscribeInvites: (() => void) | undefined;

    // Don't block on subscriptions
    (async () => {
      try {
        unsubscribeSessions = subscribeToSessions(currentUser.companyId, currentUser.role, (fetchedSessions) => {
          console.log('[APP] 📊 Sessions updated:', fetchedSessions.length);
          setSessions(fetchedSessions as InterviewSession[]);
        });

        if (currentUser.companyId) {
          unsubscribeInvites = subscribeToInvites(currentUser.companyId, (fetchedInvites) => {
            console.log('[APP] 📨 Invites updated:', fetchedInvites.length);
            setInvites(fetchedInvites as AssessmentInvite[]);
          });
        }
      } catch (error) {
        console.error('[APP] ⚠️ Error setting up subscriptions:', error);
      }
    })();

    const handleConnectionError = (e: any) => {
      setApiError(e.detail || "Koneksi database bermasalah.");
      setIsLoadingData(false);
    };
    window.addEventListener('firebase-connection-error', handleConnectionError as EventListener);

    return () => {
      console.log('[APP] 🧹 Cleaning up dashboard subscriptions');
      if (unsubscribeSessions) {
        try {
          unsubscribeSessions();
        } catch (e) {
          console.warn('[APP] Error cleaning up sessions:', e);
        }
      }
      if (unsubscribeInvites) {
        try {
          unsubscribeInvites();
        } catch (e) {
          console.warn('[APP] Error cleaning up invites:', e);
        }
      }
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

  // Handle payment success redirect
  useEffect(() => {
    // Check URL parameters on every mount/update
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const redirectTo = params.get('redirect');

    console.log('[APP] Checking payment redirect:', { paymentStatus, redirectTo, hasUser: !!currentUser });

    if (paymentStatus === 'success' && redirectTo === 'credits') {
      console.log('[APP] 💳 Payment success detected!');

      // Wait for user to be loaded if not yet
      if (!currentUser) {
        console.log('[APP] Waiting for user to load...');
        return;
      }

      console.log('[APP] Redirecting to credit management...');

      // Navigate to credit management
      setActiveTab('credit-management');

      // Clean up URL and localStorage
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.removeItem('pendingPaymentRedirect');
      localStorage.removeItem('pendingPaymentType');

      // Show success message after a short delay
      setTimeout(() => {
        const event = new CustomEvent('show-toast', {
          detail: {
            type: 'success',
            message: 'Pembayaran berhasil! Credit Anda akan segera ditambahkan.'
          }
        });
        window.dispatchEvent(event);
      }, 1000);

    } else if (paymentStatus === 'failed') {
      console.log('[APP] ❌ Payment failed detected');

      // Clean up URL and localStorage
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.removeItem('pendingPaymentRedirect');
      localStorage.removeItem('pendingPaymentType');

      // Show error message
      setTimeout(() => {
        const event = new CustomEvent('show-toast', {
          detail: {
            type: 'error',
            message: 'Pembayaran gagal. Silakan coba lagi.'
          }
        });
        window.dispatchEvent(event);
      }, 1000);
    }

    // Also check localStorage for pending payment redirect (for when user logs in after payment)
    else if (currentUser) {
      const pendingRedirect = localStorage.getItem('pendingPaymentRedirect');
      const pendingType = localStorage.getItem('pendingPaymentType');

      if (pendingRedirect === 'credits' && pendingType) {
        console.log('[APP] 💳 Found pending payment redirect in localStorage!');

        // Navigate to credit management
        setActiveTab('credit-management');

        // Clean up localStorage
        localStorage.removeItem('pendingPaymentRedirect');
        localStorage.removeItem('pendingPaymentType');

        // Show message
        setTimeout(() => {
          const event = new CustomEvent('show-toast', {
            detail: {
              type: 'info',
              message: 'Menunggu konfirmasi pembayaran...'
            }
          });
          window.dispatchEvent(event);
        }, 1000);
      }
    }
  }, [currentUser, window.location.search]); // Trigger when user loads or URL changes

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

  // Handle unlock candidate from Dashboard
  const handleUnlockCandidate = (candidate: InterviewSession) => {
    setSelectedCandidateForUnlock(candidate);
    setShowUnlockModal(true);
  };

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Ringkasan Eksekutif';
      case 'jobs': return 'Kelola Lowongan';
      case 'workflows': return 'Workflow Rekrutmen';
      case 'candidates-auto': return 'Otomatis (Instant Assessment)';
      case 'candidates-manual': return 'Manual Invite';

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
      if (publicJobRoute.jobSlug) {
        return (
          <ToastProvider>
            <PublicJobPage
              companySlug={publicJobRoute.companySlug}
              jobSlug={publicJobRoute.jobSlug}
            />
          </ToastProvider>
        );
      }
      return (
        <ToastProvider>
          <PublicCareerPage
            companySlug={publicJobRoute.companySlug}
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

  // Only show login page after auth is fully initialized and confirmed no user
  if (!currentUser && isAuthInitialized) {
    console.log('[APP] 🚪 No user detected after initialization, showing login page');
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
          onViewSession={(sessionId) => {
            setViewingCandidateId(sessionId);
            setActiveTab('history');
          }}
          onReviewSession={handleReviewSession}
          onViewAll={() => setActiveTab('history')}
          creditBalance={creditBalance}
          onUnlockCandidate={handleUnlockCandidate}
          onNavigateToCredits={handleNavigateToCredits}
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
        return <SettingsPage
          currentUser={currentUser!}
          currentCompany={currentCompany!}
          onCompanyUpdate={handleCompanyUpdate}
          onNavigateToCredits={handleNavigateToCredits}
          onLogout={handleLogout}
        />;
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
          creditBalance={creditBalance}
        />

        <main
          className={`${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-56'} pt-16 md:pt-0 p-4 md:p-8 min-h-screen transition-all duration-300 ease-in-out bg-gray-50 dark:bg-slate-900`}
          onMouseEnter={() => {
            // Auto-collapse mobile menu when mouse enters main content area
            if (isMobileMenuOpen) {
              setIsMobileMenuOpen(false);
            }
          }}
        >
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



            {/* Connection Status Indicator */}
            {apiError && (
              <div className="mb-6 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100 cursor-pointer hover:bg-red-100" onClick={handleRetryConnection}>
                <WifiOff size={14} /> {apiError} - Klik untuk refresh
              </div>
            )}

            {renderContent()}
          </div>
        </main>

        {/* Unlock Confirmation Modal */}
        {showUnlockModal && selectedCandidateForUnlock && (
          <UnlockModal
            candidate={selectedCandidateForUnlock}
            creditBalance={creditBalance || 0}
            isUnlocking={isUnlocking}
            onConfirm={async () => {
              if (!currentCompany?.id) return;

              const unlockCost = CREDIT_COSTS.UNLOCK_PROFILE;

              if ((creditBalance || 0) < unlockCost) {
                alert(`Kredit tidak cukup. Dibutuhkan: ${unlockCost}, Tersedia: ${creditBalance || 0}`);
                setShowUnlockModal(false);
                return;
              }

              setIsUnlocking(true);
              try {
                const result = await deductCredit(
                  currentCompany.id,
                  unlockCost,
                  'UNLOCK_PROFILE',
                  `Unlock kandidat: ${selectedCandidateForUnlock.candidate.name}`,
                  {
                    candidateId: selectedCandidateForUnlock.id,
                    candidateName: selectedCandidateForUnlock.candidate.name,
                    sessionId: selectedCandidateForUnlock.id
                  }
                );

                if (result.success) {
                  // Save unlock status to Firestore
                  const sessionRef = doc(db, COLLECTIONS.SESSIONS, selectedCandidateForUnlock.id);
                  await updateDoc(sessionRef, {
                    unlockedAt: new Date().toISOString(),
                    unlockedByCompanyId: currentCompany.id
                  });

                  // Update credit balance
                  setCreditBalance(result.remainingCredits);

                  alert(`Kandidat ${selectedCandidateForUnlock.candidate.name} berhasil di-unlock! Sisa kredit: ${result.remainingCredits}`);
                  setShowUnlockModal(false);

                  // Navigate to candidate detail
                  setViewingCandidateId(selectedCandidateForUnlock.id);
                  setActiveTab('history');

                  // Reload data to refresh unlock status
                  window.location.reload();
                } else {
                  alert(result.error || 'Gagal unlock kandidat');
                }
              } catch (error: any) {
                console.error('[UNLOCK] Error:', error);
                alert('Terjadi kesalahan saat unlock kandidat');
              } finally {
                setIsUnlocking(false);
                setSelectedCandidateForUnlock(null);
              }
            }}
            onCancel={() => {
              setShowUnlockModal(false);
              setSelectedCandidateForUnlock(null);
            }}
          />
        )}

        {/* Payment Modal */}
        {showPaymentModal && currentCompany && currentUser && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            companyId={currentCompany.id}
            companyName={currentCompany.name}
            companyEmail={currentUser.email || ''}
            currentTier={currentCompany.tier}
            currentCredits={creditBalance || 0}
            onPaymentSuccess={() => {
              // Reload credit balance
              if (currentCompany?.id) {
                getCreditBalance(currentCompany.id).then(balance => {
                  setCreditBalance(balance);
                });
              }
            }}
          />
        )}

        {/* Floating Buy Credits Button */}
        {currentUser && currentCompany && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-brand-orange to-red-600 text-white px-6 py-3 rounded-full shadow-2xl hover:shadow-3xl transition-all flex items-center gap-2 font-bold z-40 hover:scale-105"
          >
            <CreditCard size={20} />
            Buy Credits
          </button>
        )}
      </div>
    </ToastProvider>
  );
};

export default App;
