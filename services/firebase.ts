import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit, 
  Firestore,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject, ref } from 'firebase/storage';
import { InterviewSession, AssessmentInvite, CompanyProfile, UserProfile, Job, JobApplication, Workflow } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hiring-good.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hiring-good",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hiring-good.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "618826274963",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:618826274963:web:6e54bb9f7df9d5a7c6d7a2"
};

export let db: Firestore;
export let functions: any;
export let auth: Auth;
let storage: any;

// Helper function untuk kirim email via Firebase Cloud Function dengan Resend
export const sendEmailViaCloudFunction = async (
  emailType: "business_invitation" | "candidate_invitation" | "assessment_complete" | "password_reset",
  to_email: string,
  emailData: Record<string, any>
): Promise<boolean> => {
  try {
    if (!functions) {
      console.warn("Firebase Functions not deployed!");
      throw new Error("Email service not configured");
    }

    console.log(`[EMAIL] Sending ${emailType} to ${to_email}...`);

    // Panggil Firebase Cloud Function dengan Resend
    const sendEmail = httpsCallable(functions, "sendEmail");
    const result = await sendEmail({
      type: emailType,
      to: to_email,
      data: emailData
    });

    const response = result.data as { success: boolean; message?: string };

    if (!response.success) {
      throw new Error(response.message || "Gagal mengirim email");
    }

    console.log(`[EMAIL] ✅ Sent successfully to ${to_email}`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL] ❌ Error sending to ${to_email}:`, error);
    throw new Error(`Email gagal dikirim: ${error.message || 'Unknown error'}`);
  }
};

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  functions = getFunctions(app, "europe-west1"); // Set region sesuai dengan Cloud Function
  storage = getStorage(app); // Initialize Firebase Storage
  console.log("[FraudGuard System] Connected to Firebase (Firestore + Functions + Storage).");
} catch (error) {
  console.error("CRITICAL: Gagal menghubungkan ke Firebase.", error);
}

// Export email function for external use
export const sendAssessmentCompleteEmail = async (candidateName: string, candidateEmail: string, companyName: string): Promise<boolean> => {
  return await sendEmailViaCloudFunction(
    "assessment_complete",
    candidateEmail,
    {
      candidateName,
      candidateEmail,
      companyName
    }
  );
};

// Send integrity test invitation to candidate from Review & Invite
export const sendIntegrityTestInvitation = async (
  candidateName: string,
  candidateEmail: string,
  companyName: string,
  jobTitle: string,
  sessionId: string
): Promise<boolean> => {
  try {
    const accessCode = Math.random().toString(36).slice(2, 7).toUpperCase();
    const assessmentLink = `${window.location.origin}?mode=assess&code=${accessCode}`;

    await sendEmailViaCloudFunction(
      "candidate_invitation",
      candidateEmail,
      {
        candidateName,
        candidateEmail,
        companyName,
        jobTitle,
        accessCode,
        assessmentLink
      }
    );

    // Save invite to DB
    const inviteData: Omit<AssessmentInvite, 'id'> = {
      access_code: accessCode,
      name: candidateName,
      email: candidateEmail,
      companyId: '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      sessionId: sessionId
    };

    await addDoc(collection(db, COLLECTIONS.INVITES), inviteData);
    console.log('[INVITE] ✅ Invitation sent and saved');

    return true;
  } catch (error: any) {
    console.error('[INVITE] Error sending invitation:', error);
    throw error;
  }
};

// ==========================================
// FIREBASE AUTHENTICATION
// ==========================================

/**
 * Sign up new user with Firebase Authentication
 * Creates user in Firebase Auth and saves profile to Firestore
 */
export const signUpWithFirebase = async (userData: {
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<UserProfile> => {
  try {
    console.log('[AUTH] Starting Firebase sign up process...');
    
    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );
    
    const firebaseUser = userCredential.user;
    console.log('[AUTH] Firebase user created:', firebaseUser.uid);

    // 2. Send email verification
    try {
      await sendEmailVerification(firebaseUser);
      console.log('[AUTH] ✅ Verification email sent to:', userData.email);
    } catch (verificationError) {
      console.warn('[AUTH] ⚠️ Failed to send verification email:', verificationError);
      // Don't block signup if email sending fails
    }

    // 3. Create company profile with initial Freemium credits
    const companyData: Omit<CompanyProfile, 'id'> = {
      name: userData.companyName,
      tier: 'Freemium',
      status: 'Active',
      adminEmail: userData.email,
      joinedDate: new Date().toISOString(),
      usersCount: 1,
      credits: 1000, // Initial Freemium credits
      verification_credits: 100,
      createdAt: Timestamp.now()
    };

    const companyRef = await addDoc(collection(db, COLLECTIONS.COMPANIES), companyData);
    const companyId = companyRef.id;
    console.log('[AUTH] Company created:', companyId);

    // 4. Create user profile in Firestore
    const userProfile: Omit<UserProfile, 'id'> & { id: string } = {
      id: firebaseUser.uid,
      name: userData.fullName,
      email: userData.email,
      role: 'Company Admin',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
      companyId: companyId,
      emailVerified: false,
      createdAt: Timestamp.now()
    };

    await addDoc(collection(db, COLLECTIONS.USERS), userProfile);
    console.log('[AUTH] ✅ User profile created in Firestore');

    // Return user profile
    return {
      ...userProfile,
      emailVerified: firebaseUser.emailVerified
    };

  } catch (error: any) {
    console.error('[AUTH] Sign up error:', error);
    
    // Provide user-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau login.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Format email tidak valid.');
    } else {
      throw new Error(error.message || 'Gagal mendaftar. Silakan coba lagi.');
    }
  }
};

/**
 * Sign in user with Firebase Authentication
 */
export const loginWithFirebase = async (email: string, password: string): Promise<UserProfile> => {
  try {
    console.log('[AUTH] Attempting login for:', email);
    
    // 1. Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    console.log('[AUTH] Firebase login successful:', firebaseUser.uid);
    console.log('[AUTH] Email verified:', firebaseUser.emailVerified);

    // 2. Fetch user profile from Firestore
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', email), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Profil pengguna tidak ditemukan');
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data() as UserProfile;

    // 3. Update email verification status in Firestore if changed
    if (userData.emailVerified !== firebaseUser.emailVerified) {
      await updateDoc(userDoc.ref, {
        emailVerified: firebaseUser.emailVerified
      });
    }

    console.log('[AUTH] ✅ Login complete');

    return {
      ...userData,
      id: firebaseUser.uid,
      emailVerified: firebaseUser.emailVerified
    };

  } catch (error: any) {
    console.error('[AUTH] Login error:', error);
    
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      throw new Error('Email atau password salah. Silakan coba lagi.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak percobaan login. Silakan coba lagi nanti.');
    } else {
      throw new Error(error.message || 'Gagal login. Silakan coba lagi.');
    }
  }
};

/**
 * Sign out current user
 */
export const logoutFromFirebase = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log('[AUTH] User signed out successfully');
  } catch (error) {
    console.error('[AUTH] Sign out error:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('[AUTH] Password reset email sent to:', email);
  } catch (error: any) {
    console.error('[AUTH] Password reset error:', error);
    
    if (error.code === 'auth/user-not-found') {
      throw new Error('Email tidak terdaftar.');
    } else {
      throw new Error(error.message || 'Gagal mengirim email reset password.');
    }
  }
};

/**
 * Resend email verification
 */
export const resendVerificationEmail = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Tidak ada user yang login');
    }

    if (user.emailVerified) {
      throw new Error('Email sudah terverifikasi');
    }

    await sendEmailVerification(user);
    console.log('[AUTH] ✅ Verification email resent to:', user.email);
  } catch (error: any) {
    console.error('[AUTH] Resend verification error:', error);
    
    if (error.code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak permintaan. Tunggu beberapa menit sebelum mencoba lagi.');
    } else {
      throw new Error(error.message || 'Gagal mengirim ulang email verifikasi.');
    }
  }
};

/**
 * Observe auth state changes
 */
export const observeAuthState = (callback: (user: UserProfile | null) => void) => {
  return firebaseOnAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      try {
        // Fetch user profile from Firestore
        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(usersRef, where('email', '==', firebaseUser.email), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data() as UserProfile;
          
          // Update email verification status if changed
          if (userData.emailVerified !== firebaseUser.emailVerified) {
            await updateDoc(snapshot.docs[0].ref, {
              emailVerified: firebaseUser.emailVerified
            });
          }

          callback({
            ...userData,
            id: firebaseUser.uid,
            emailVerified: firebaseUser.emailVerified
          });
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('[AUTH] Error fetching user profile:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

// Collection names
export const COLLECTIONS = {
  SESSIONS: 'interview_sessions',
  USERS: 'users',
  COMPANIES: 'companies',
  INVITES: 'assessment_invites',
  JOBS: 'jobs',
  APPLICATIONS: 'applications',
  WORKFLOWS: 'workflows',
  CREDIT_TRANSACTIONS: 'credit_transactions'
};

// Seed real database with demo data
export const seedRealDatabase = async () => {
  console.log("[SEED] Skipping seed - using production Firebase data");
};

// ==========================================
// FIRESTORE QUERIES - REAL TIME UPDATES
// ==========================================

export const subscribeToSessions = (companyId: string, role: string, onUpdate: (sessions: InterviewSession[]) => void) => {
  if (!db) {
    console.error("Database not initialized");
    return () => {};
  }

  try {
    const sessionsRef = collection(db, COLLECTIONS.SESSIONS);
    let q;

    if (role === 'System Admin') {
      q = query(sessionsRef, orderBy('date', 'desc'), limit(100));
    } else {
      q = query(
        sessionsRef,
        where('companyId', '==', companyId),
        orderBy('date', 'desc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InterviewSession[];
        onUpdate(sessions);
      },
      (error) => {
        console.error("[SESSIONS] Snapshot error:", error);
        window.dispatchEvent(new CustomEvent('firebase-connection-error', { 
          detail: "Koneksi ke database bermasalah. Refresh halaman."
        }));
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("[SESSIONS] Error setting up listener:", error);
    return () => {};
  }
};

export const getSessionById = async (sessionId: string): Promise<InterviewSession | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InterviewSession;
    }
    return null;
  } catch (error) {
    console.error("Error fetching session:", error);
    return null;
  }
};

export const updateSession = async (sessionId: string, updates: Partial<InterviewSession>) => {
  try {
    const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    await updateDoc(sessionRef, updates as any);
    console.log(`[SESSION-UPDATE] Updated session ${sessionId}`);
  } catch (error) {
    console.error(`[SESSION-UPDATE] Error updating session ${sessionId}:`, error);
    throw error;
  }
};

export const createInterviewSession = async (sessionData: Omit<InterviewSession, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), sessionData);
    console.log('[SESSIONS] New session created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[SESSIONS] Error creating session:', error);
    throw error;
  }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SESSIONS, sessionId));
    console.log('[SESSIONS] Session deleted:', sessionId);
  } catch (error) {
    console.error('[SESSIONS] Error deleting session:', error);
    throw error;
  }
};

export const getCompanyById = async (companyId: string): Promise<CompanyProfile | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CompanyProfile;
    }
    return null;
  } catch (error) {
    console.error('[COMPANIES] Error fetching company:', error);
    return null;
  }
};

export const getCompanyBySlug = async (slug: string): Promise<CompanyProfile | null> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMPANIES),
      where('companySlug', '==', slug),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CompanyProfile;
  } catch (error) {
    console.error('[COMPANIES] Error fetching company by slug:', error);
    return null;
  }
};

export const updateCompany = async (companyId: string, updates: Partial<CompanyProfile>): Promise<void> => {
  try {
    const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
    await updateDoc(companyRef, updates as any);
    console.log('[COMPANIES] Company updated:', companyId);
  } catch (error) {
    console.error('[COMPANIES] Error updating company:', error);
    throw error;
  }
};

export const resetConnectionState = () => {
  console.log("Reconnecting...");
};

// --- BLAST CONTROLLER & ACCESS CODE LOGIC ---

export const blastAssessmentInvites = async (
  candidates: { name: string; email: string; role?: string }[],
  companyId: string,
  companyName: string
) => {
  if (!db) throw new Error("Database offline");

  // Check if Firebase Functions is initialized
  if (!functions) {
      console.error("Firebase Functions not initialized");
      throw new Error("Layanan email tidak dikonfigurasi dengan benar. Hubungi administrator.");
  }

  const results = { success: 0, failed: 0 };
  const errors: string[] = [];
  const emailsSent: string[] = [];
  const emailsFailed: string[] = [];

  console.log(`[BLAST-START] Processing ${candidates.length} candidates for company: ${companyName}`);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`[BLAST ${i + 1}/${candidates.length}] Processing: ${candidate.name} (${candidate.email})`);

    try {
      // A. Generate Access Code (5 Alphanumeric)
      const accessCode = Math.random().toString(36).slice(2, 7).toUpperCase();
      console.log(`[BLAST] Generated access code for ${candidate.email}: ${accessCode}`);

      // B. Save to Database
      const inviteData: AssessmentInvite = {
        access_code: accessCode,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role || "Kandidat",
        companyId: companyId,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, COLLECTIONS.INVITES), inviteData);
      console.log(`[BLAST] ✅ Database saved for ${candidate.email}`);

      // C. Send Email via Firebase Cloud Function
      const assessmentLink = `${window.location.origin}?mode=assess`;

      try {
        console.log(`[BLAST] Attempting to send email to ${candidate.email}...`);

        const emailSent = await sendEmailViaCloudFunction(
          "candidate_invitation",
          candidate.email,
          {
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            companyName: companyName,
            accessCode: accessCode,
            assessmentLink: assessmentLink,
            role: candidate.role || "Kandidat"
          }
        );

        if (!emailSent) {
          throw new Error("Email function returned false");
        }

        console.log(`[BLAST] ✅ Email sent successfully to ${candidate.email}`);
        results.success++;
        emailsSent.push(candidate.email);

      } catch (emailError: any) {
        console.error(`[BLAST] ❌ Email error for ${candidate.email}:`, emailError);
        errors.push(`${candidate.email}: ${emailError.message}`);
        emailsFailed.push(candidate.email);
        results.failed++;
      }

    } catch (error: any) {
      console.error(`[BLAST] ❌ Failed to process invite for ${candidate.email}:`, error);
      errors.push(`${candidate.email}: ${error.message}`);
      results.failed++;
    }

    // Add small delay between emails to avoid rate limiting
    if (i < candidates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[BLAST-COMPLETE] Success: ${results.success}, Failed: ${results.failed}`);
  console.log(`[BLAST-EMAILS-SENT]`, emailsSent);
  console.log(`[BLAST-EMAILS-FAILED]`, emailsFailed);

  if (errors.length > 0) {
    console.error("[BLAST-ERRORS]", errors);
  }

  return results;
};

export const verifyAccessCode = async (code: string): Promise<AssessmentInvite | null> => {
  if (!db) throw new Error("Database offline");

  try {
    const q = query(
      collection(db, COLLECTIONS.INVITES),
      where("access_code", "==", code.toUpperCase().trim())
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docData = snapshot.docs[0].data() as AssessmentInvite;

    // Only allow PENDING codes (one-time use enforcement)
    if (docData.status !== 'PENDING') {
      console.warn(`Access code ${code} has status: ${docData.status}. Already used.`);
      return null;
    }

    return { ...docData, id: snapshot.docs[0].id };
  } catch (e) {
    console.error("Verification failed:", e);
    return null;
  }
};

export const markAccessCodeUsed = async (
  code: string,
  status: 'ACCESSING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' = 'COMPLETED',
  sessionId?: string
) => {
  if (!db) return;

  try {
    const q = query(
      collection(db, COLLECTIONS.INVITES),
      where("access_code", "==", code.toUpperCase().trim())
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      const updateData: any = { status };

      // Add timestamps based on status
      if (status === 'ACCESSING') {
        updateData.accessedAt = new Date().toISOString();
      } else if (status === 'IN_PROGRESS') {
        updateData.startedAt = new Date().toISOString();
        if (sessionId) updateData.sessionId = sessionId;
      } else if (status === 'COMPLETED') {
        updateData.completedAt = new Date().toISOString();
        if (sessionId) updateData.sessionId = sessionId;
      }

      await updateDoc(docRef, updateData);
    }
  } catch (e) {
    console.error("Failed to update access code status:", e);
  }
};

export const resendCandidateInvite = async (inviteId: string, companyName: string): Promise<{ success: boolean; message: string }> => {
  if (!db) throw new Error("Database offline");

  try {
    const inviteRef = doc(db, COLLECTIONS.INVITES, inviteId);
    const inviteDoc = await getDoc(inviteRef);

    if (!inviteDoc.exists()) {
      throw new Error("Undangan tidak ditemukan");
    }

    const inviteData = inviteDoc.data() as AssessmentInvite;

    const assessmentLink = `${window.location.origin}?mode=assess`;
    const emailSent = await sendEmailViaCloudFunction(
      "candidate_invitation",
      inviteData.email,
      {
        candidateName: inviteData.name,
        candidateEmail: inviteData.email,
        companyName: companyName,
        accessCode: inviteData.access_code,
        assessmentLink: assessmentLink,
        role: inviteData.role || "Kandidat"
      }
    );

    if (!emailSent) {
      throw new Error("Gagal mengirim email");
    }

    await updateDoc(inviteRef, {
      resentAt: new Date().toISOString()
    });

    return { success: true, message: "Email undangan berhasil dikirim ulang" };
  } catch (error: any) {
    console.error("Error resending invite:", error);
    return { success: false, message: error.message || "Gagal mengirim ulang undangan" };
  }
};

export const deleteCandidateInvite = async (inviteId: string): Promise<{ success: boolean; message: string }> => {
  if (!db) throw new Error("Database offline");

  try {
    const inviteRef = doc(db, COLLECTIONS.INVITES, inviteId);
    await deleteDoc(inviteRef);

    return { success: true, message: "Kandidat berhasil dihapus" };
  } catch (error: any) {
    console.error("Error deleting invite:", error);
    return { success: false, message: error.message || "Gagal menghapus kandidat" };
  }
};

export const subscribeToInvites = (companyId: string, onUpdate: (data: AssessmentInvite[]) => void) => {
    if (!db) return () => {};

    const executeSimpleQuery = () => {
        const q = query(
            collection(db, COLLECTIONS.INVITES),
            where("companyId", "==", companyId),
            limit(100)
        );
        onSnapshot(q, (snapshot) => {
            const invites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssessmentInvite));
            // Sort Client Side
            invites.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onUpdate(invites);
        });
    };

    try {
        const q = query(
            collection(db, COLLECTIONS.INVITES),
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
            limit(100)
        );

        return onSnapshot(q, (snapshot) => {
            const invites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssessmentInvite));
            onUpdate(invites);
        }, (error) => {
            if (error.code === 'failed-precondition') {
                console.warn("Invite Index missing, switching to client-side sort");
                executeSimpleQuery();
            }
        });
    } catch (e) {
        executeSimpleQuery();
        return () => {};
    }
};

// --- FIREBASE STORAGE: LOGO UPLOAD (Up to 5MB) ---

/**
 * Upload logo file ke Firebase Storage
 * @param companyId - ID company
 * @param file - File object (PNG/JPG/JPEG)
 * @returns Download URL for the uploaded logo
 */
export const uploadCompanyLogo = async (companyId: string, file: File): Promise<string> => {
  console.log(`[STORAGE] uploadCompanyLogo called with:`, {
    companyId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    storageAvailable: !!storage
  });

  if (!storage) {
    console.error("[STORAGE] Storage not initialized!");
    throw new Error("Firebase Storage tidak tersedia. Refresh halaman dan coba lagi.");
  }

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    console.error(`[STORAGE] Invalid file type: ${file.type}`);
    throw new Error("Format file tidak valid. Gunakan PNG atau JPG.");
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    console.error(`[STORAGE] File too large: ${file.size} bytes`);
    throw new Error(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 5MB.`);
  }

  console.log(`[STORAGE] Validation passed. Uploading logo for company: ${companyId}, size: ${(file.size / 1024).toFixed(2)}KB`);

  try {
    // Create storage reference: logos/companyId/logo.ext
    const fileExtension = file.name.split('.').pop() || 'png';
    const storagePath = `logos/${companyId}/logo.${fileExtension}`;

    console.log(`[STORAGE] Creating storage reference: ${storagePath}`);
    const storageRef = ref(storage, storagePath);

    // Upload file
    console.log(`[STORAGE] Starting upload to: ${storagePath}`);
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`[STORAGE] Upload complete! Snapshot:`, {
      fullPath: snapshot.ref.fullPath,
      name: snapshot.ref.name
    });

    // Get download URL
    console.log(`[STORAGE] Getting download URL...`);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`[STORAGE] ✅ Logo uploaded successfully!`);
    console.log(`[STORAGE] Download URL length: ${downloadURL.length} chars`);

    return downloadURL;
  } catch (error: any) {
    console.error(`[STORAGE] ❌ Upload failed with error:`, error);
    console.error(`[STORAGE] Error details:`, {
      message: error.message,
      code: error.code,
      name: error.name,
      serverResponse: error.serverResponse
    });

    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error("Izin akses ditolak. Pastikan Firebase Storage Rules sudah di-deploy.");
    } else if (error.code === 'storage/canceled') {
      throw new Error("Upload dibatalkan. Silakan coba lagi.");
    } else if (error.code === 'storage/unknown') {
      throw new Error("Terjadi kesalahan. Pastikan koneksi internet stabil dan coba lagi.");
    } else {
      throw new Error(`Gagal upload logo: ${error.message || 'Unknown error'}`);
    }
  }
};

/**
 * Delete logo from Firebase Storage
 * @param companyId - ID company
 */
export const deleteCompanyLogo = async (companyId: string): Promise<void> => {
  if (!storage) return;

  try {
    // Try to delete both PNG and JPG versions
    const extensions = ['png', 'jpg', 'jpeg'];

    for (const ext of extensions) {
      try {
        const storagePath = `logos/${companyId}/logo.${ext}`;
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        console.log(`[STORAGE] Deleted logo: ${storagePath}`);
      } catch (e: any) {
        // File might not exist, that's ok
        if (e.code !== 'storage/object-not-found') {
          console.warn(`[STORAGE] Error deleting ${ext}:`, e);
        }
      }
    }
  } catch (error) {
    console.error(`[STORAGE] Error during logo deletion:`, error);
  }
};

export const createJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'datePosted' | 'applicantsCount'>): Promise<string> => {
  try {
    const now = new Date().toISOString();
    const job: Omit<Job, 'id'> = {
      ...jobData,
      datePosted: now,
      applicantsCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.JOBS), job);
    console.log('[JOBS] Job created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[JOBS] Error creating job:', error);
    throw error;
  }
};

export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<void> => {
  try {
    const jobRef = doc(db, COLLECTIONS.JOBS, jobId);
    await updateDoc(jobRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    console.log('[JOBS] Job updated:', jobId);
  } catch (error) {
    console.error('[JOBS] Error updating job:', error);
    throw error;
  }
};

export const deleteJob = async (jobId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.JOBS, jobId));
    console.log('[JOBS] Job deleted:', jobId);
  } catch (error) {
    console.error('[JOBS] Error deleting job:', error);
    throw error;
  }
};

export const getJobsByCompany = async (companyId: string): Promise<Job[]> => {
  try {
    console.log('[FIREBASE] Fetching jobs for companyId:', companyId);

    const q = query(
      collection(db, COLLECTIONS.JOBS),
      where('companyId', '==', companyId),
      orderBy('datePosted', 'desc')
    );

    console.log('[FIREBASE] Executing query...');
    const snapshot = await getDocs(q);
    console.log('[FIREBASE] Query result - documents count:', snapshot.docs.length);

    const jobs = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('[FIREBASE] Job document:', { id: doc.id, ...data });
      return { id: doc.id, ...data } as Job;
    });

    return jobs;
  } catch (error: any) {
    console.error('[JOBS] Error fetching jobs:', error);
    console.error('[JOBS] Error code:', error.code);
    console.error('[JOBS] Error message:', error.message);

    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.error('[JOBS] ⚠️ FIRESTORE INDEX REQUIRED!');
      console.error('[JOBS] You need to create a composite index for:');
      console.error('[JOBS] Collection: jobs');
      console.error('[JOBS] Fields: companyId (asc), datePosted (desc)');
      console.error('[JOBS] Go to Firebase Console → Firestore → Indexes');

      console.log('[JOBS] Trying fallback query without orderBy...');
      try {
        const fallbackQ = query(
          collection(db, COLLECTIONS.JOBS),
          where('companyId', '==', companyId)
        );
        const fallbackSnapshot = await getDocs(fallbackQ);
        const fallbackJobs = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
        console.log('[JOBS] Fallback query succeeded, found', fallbackJobs.length, 'jobs');
        return fallbackJobs.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime());
      } catch (fallbackError) {
        console.error('[JOBS] Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
};

export const getJobBySlug = async (companyId: string, jobSlug: string): Promise<Job | null> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.JOBS),
      where('companyId', '==', companyId),
      where('slug', '==', jobSlug),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Job;
  } catch (error) {
    console.error('[JOBS] Error fetching job by slug:', error);
    throw error;
  }
};

export const createApplication = async (applicationData: Omit<JobApplication, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const now = new Date().toISOString();
    const application: Omit<JobApplication, 'id'> = {
      ...applicationData,
      createdAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.APPLICATIONS), application);
    console.log('[APPLICATIONS] Application created with ID:', docRef.id);

    const jobRef = doc(db, COLLECTIONS.JOBS, applicationData.jobId);
    const jobSnap = await getDoc(jobRef);
    let enableInstantAssessment = false; // Default: Instant OFF (pending_review)
    
    if (jobSnap.exists()) {
      const jobData = jobSnap.data();
      const currentCount = jobData.applicantsCount || 0;
      enableInstantAssessment = jobData.enableInstantAssessment || false;
      await updateDoc(jobRef, { applicantsCount: currentCount + 1 });
    }

    console.log('[APPLICATIONS] Creating interview session for application... Instant Assessment:', enableInstantAssessment);
    const sessionId = await createInterviewSessionFromApplication(docRef.id, applicationData, enableInstantAssessment);
    console.log('[APPLICATIONS] Interview session created:', sessionId);

    await updateDoc(docRef, { sessionId });
    console.log('[APPLICATIONS] Application updated with sessionId');

    return docRef.id;
  } catch (error) {
    console.error('[APPLICATIONS] Error creating application:', error);
    throw error;
  }
};

export const createInterviewSessionFromApplication = async (
  applicationId: string,
  applicationData: Omit<JobApplication, 'id' | 'createdAt'>,
  enableInstantAssessment: boolean = false
): Promise<string> => {
  try {
    const now = new Date().toISOString();

    // Tentukan status dan note berdasarkan Instant Assessment setting
    const sessionStatus = enableInstantAssessment ? 'active' : 'pending_review';
    const screeningNote = enableInstantAssessment 
      ? 'Kandidat akan langsung mengikuti instant assessment' 
      : 'Menunggu review HR';

    console.log(`[SESSION-CREATE] Creating session with status: ${sessionStatus} (Instant: ${enableInstantAssessment})`);

    // Load Job and Workflow if exists
    let workflowSteps: any[] = [];
    let workflowId: string | undefined;
    
    if (applicationData.jobId) {
      try {
        const jobDoc = await getDoc(doc(db, COLLECTIONS.JOBS, applicationData.jobId));
        if (jobDoc.exists()) {
          const jobData = jobDoc.data();
          workflowId = jobData.workflowId;
          
          if (workflowId) {
            console.log(`[SESSION-CREATE] Job has workflow: ${workflowId}`);
            const workflowDoc = await getDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId));
            if (workflowDoc.exists()) {
              const workflowData = workflowDoc.data();
              workflowSteps = workflowData.steps || [];
              console.log(`[SESSION-CREATE] Loaded ${workflowSteps.length} workflow steps`);
            }
          }
        }
      } catch (error) {
        console.error('[SESSION-CREATE] Error loading workflow:', error);
      }
    }

    // Build timeline based on workflow or default
    const timeline: any[] = [
      {
        stage: 'applied',
        status: 'completed' as const,
        date: now,
        note: `Kandidat melamar via Job Portal`
      },
      {
        stage: 'cv_uploaded',
        status: 'completed' as const,
        date: now,
        note: `CV berhasil diunggah`
      }
    ];

    // Add workflow steps to timeline if exists
    if (workflowSteps.length > 0) {
      // Sort steps by order, no special treatment for any step
      const sortedSteps = [...workflowSteps].sort((a, b) => a.order - b.order);
      
      sortedSteps.forEach((step, index) => {
        // First enabled step is current
        const isFirstStep = index === 0;
        timeline.push({
          stage: step.id,
          status: isFirstStep ? 'current' as const : 'pending' as const,
          date: now,
          note: step.description,
          credits: step.credits,
          isMandatory: step.isMandatory
        });
      });
      console.log(`[SESSION-CREATE] Added ${sortedSteps.length} workflow stages to timeline (first enabled step is current)`);
    } else {
      // Default timeline if no workflow
      timeline.push({
        stage: 'screening',
        status: 'current' as const,
        date: now,
        note: screeningNote
      });
    }

    const session = {
      candidate: {
        id: applicationId,
        name: applicationData.fullName,
        email: applicationData.email,
        role: 'Applicant'
      },
      date: now,
      status: sessionStatus as 'active' | 'pending_review',
      recruitmentStage: workflowSteps.length > 0 ? workflowSteps[0].id : 'screening',
      transcript: [
        {
          speaker: 'ai' as const,
          text: `Aplikasi diterima dari ${applicationData.fullName} via Job Portal. CV: ${applicationData.cvUrl}`
        }
      ],
      timeline,
      companyId: applicationData.companyId,
      source: 'job_application',
      jobId: applicationData.jobId,
      applicationId: applicationId,
      cvUrl: applicationData.cvUrl,
      whatsapp: applicationData.whatsapp,
      workflowId: workflowId || null, // Reference to workflow if exists
      // Tidak set inviteSource untuk auto-sourcing (Instant ON)
      // inviteSource akan di-set hanya saat HR mengirim undangan dari Review & Invite
    };

    const sessionRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), session);
    console.log('[SESSIONS] Interview session created from job application:', sessionRef.id);

    // Auto-parse Document if exists
    if (applicationData.cvUrl) {
      console.log('[SESSIONS] ✅ Document detected, triggering auto-parse...');
      
      // Trigger parse asynchronously (don't wait)
      parseCVWithMistral(applicationData.cvUrl, sessionRef.id)
        .then(() => {
          console.log('[SESSIONS] ✅ Auto-parse document completed for session:', sessionRef.id);
        })
        .catch((error) => {
          console.error('[SESSIONS] ⚠️ Auto-parse document failed (non-blocking):', error);
          // Don't throw - Document parsing failure shouldn't block session creation
        });
    }

    return sessionRef.id;
  } catch (error) {
    console.error('[SESSIONS] Error creating interview session:', error);
    throw error;
  }
};

export const uploadCV = async (applicationId: string, file: File): Promise<string> => {
  console.log('[STORAGE] uploadCV called with:', {
    applicationId,
    fileName: file.name,
    fileSize: `${(file.size / 1024).toFixed(2)} KB`,
    fileType: file.type
  });

  if (!storage) {
    console.error('[STORAGE] Storage not initialized!');
    throw new Error("Firebase Storage tidak tersedia");
  }
  console.log('[STORAGE] Storage initialized OK');

  // Updated: Support multiple document types
  const validTypes = [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain', // .txt
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif'
  ];
  
  if (!validTypes.includes(file.type)) {
    console.error('[STORAGE] Invalid file type:', file.type);
    throw new Error("Format file tidak valid. Gunakan PDF, DOC, DOCX, TXT, atau gambar (JPG/PNG).");
  }
  console.log('[STORAGE] File type validation passed');

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.error('[STORAGE] File too large:', sizeMB, 'MB');
    throw new Error(`Ukuran file terlalu besar (${sizeMB}MB). Maksimal 5MB.`);
  }
  console.log('[STORAGE] File size validation passed');

  try {
    const storagePath = `cvs/${applicationId}/${file.name}`;
    console.log('[STORAGE] Storage path:', storagePath);

    console.log('[STORAGE] Creating storage reference...');
    const storageRef = ref(storage, storagePath);
    console.log('[STORAGE] Storage reference created');

    console.log('[STORAGE] Starting file upload...');
    const snapshot = await uploadBytes(storageRef, file);
    console.log('[STORAGE] File uploaded to storage, getting download URL...');

    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('[STORAGE] Document uploaded successfully!');
    console.log('[STORAGE] Download URL:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('[STORAGE] Document upload failed!');
    console.error('[STORAGE] Error:', error);
    console.error('[STORAGE] Error code:', error.code);
    console.error('[STORAGE] Error message:', error.message);
    console.error('[STORAGE] Error details:', JSON.stringify(error, null, 2));

    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Pastikan Storage Rules sudah di-deploy.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload dibatalkan.');
    } else if (error.code === 'storage/unknown') {
      throw new Error('Network error. Cek koneksi internet Anda.');
    }

    throw new Error(`Gagal upload dokumen: ${error.message}`);
  }
};

export const parseCVWithMistral = async (cvUrl: string, sessionId: string): Promise<any> => {
  console.log('[DOC-PARSE] Starting document parsing with Mistral AI...');
  console.log('[DOC-PARSE] Document URL:', cvUrl);
  console.log('[DOC-PARSE] Session ID:', sessionId);

  try {
    if (!functions) {
      console.error('[DOC-PARSE] Firebase Functions not initialized');
      throw new Error('Firebase Functions not available');
    }

    // Updated: Use new universal document parser function
    const parseDocFunction = httpsCallable(functions, 'parseDocumentWithMistral');

    console.log('[DOC-PARSE] Calling Firebase Function...');
    const result = await parseDocFunction({ documentUrl: cvUrl, sessionId });

    console.log('[DOC-PARSE] ✅ Document parsed successfully');
    const resultData = result.data as any;
    console.log('[DOC-PARSE] File type:', resultData?.fileType);
    console.log('[DOC-PARSE] Extracted chars:', resultData?.extractedChars);
    return result.data;

  } catch (error: any) {
    console.error('[DOC-PARSE] Error parsing document:', error);
    throw new Error(`Failed to parse document: ${error.message}`);
  }
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// ==========================================
// WORKFLOW MANAGEMENT
// ==========================================

export const createWorkflow = async (workflowData: Omit<Workflow, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.WORKFLOWS), workflowData);
    console.log('[WORKFLOWS] Workflow created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[WORKFLOWS] Error creating workflow:', error);
    throw error;
  }
};

export const getWorkflowsByCompany = async (companyId: string): Promise<Workflow[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.WORKFLOWS),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
  } catch (error: any) {
    console.error('[WORKFLOWS] Error fetching workflows:', error);
    if (error.code === 'failed-precondition') {
      try {
        const fallbackQ = query(
          collection(db, COLLECTIONS.WORKFLOWS),
          where('companyId', '==', companyId)
        );
        const fallbackSnapshot = await getDocs(fallbackQ);
        const workflows = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
        return workflows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (fallbackError) {
        console.error('[WORKFLOWS] Fallback query failed:', fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
};

export const updateWorkflow = async (workflowId: string, updates: Partial<Workflow>): Promise<void> => {
  try {
    const workflowRef = doc(db, COLLECTIONS.WORKFLOWS, workflowId);
    await updateDoc(workflowRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    console.log('[WORKFLOWS] Workflow updated:', workflowId);
  } catch (error) {
    console.error('[WORKFLOWS] Error updating workflow:', error);
    throw error;
  }
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId));
    console.log('[WORKFLOWS] Workflow deleted:', workflowId);
  } catch (error) {
    console.error('[WORKFLOWS] Error deleting workflow:', error);
    throw error;
  }
};

// Initiate Background Check with Didit KYC
export const initiateBackgroundCheck = async (candidateId: string, candidateName: string): Promise<string> => {
  try {
    if (!functions) {
      throw new Error("Firebase Functions not initialized");
    }

    console.log('[DIDIT] Initiating background check for candidate:', candidateId);

    const initiateCheck = httpsCallable(functions, 'initiateBackgroundCheck');
    const result = await initiateCheck({
      candidateId,
      candidateName
    });

    const response = result.data as { success: boolean; verificationUrl?: string; message?: string };

    if (!response.success || !response.verificationUrl) {
      throw new Error(response.message || 'Gagal memulai background check');
    }

    console.log('[DIDIT] ✅ Background check initiated successfully');
    return response.verificationUrl;

  } catch (error: any) {
    console.error('[DIDIT] Error initiating background check:', error);
    throw new Error(`Background check gagal: ${error.message}`);
  }
};

// Legacy function exports for backward compatibility
export const updateSessionInDB = updateSession;
export const saveSessionToDB = createInterviewSession;

// Admin functions - placeholder implementations
export const inviteCompanyReal = async (payload: any): Promise<{ success: boolean; message: string }> => {
  console.log('[ADMIN] inviteCompanyReal called with:', payload);
  return { success: true, message: "Company invited successfully" };
};

export const getCompanies = async () => { 
  console.log('[ADMIN] getCompanies called');
  return []; 
};

export const updateCompanySubscription = async (companyId: string, updates: any): Promise<void> => {
  console.log('[ADMIN] updateCompanySubscription called:', companyId, updates);
  const companyRef = doc(db, COLLECTIONS.COMPANIES, companyId);
  await updateDoc(companyRef, updates);
};

export const deleteCompany = async (companyId: string): Promise<void> => {
  console.log('[ADMIN] deleteCompany called for:', companyId);
  await deleteDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
};

export const resendInviteEmail = async (companyId: string): Promise<{ success: boolean; message: string }> => {
  console.log('[ADMIN] resendInviteEmail called for:', companyId);
  return { success: true, message: "Invite email resent successfully" };
};