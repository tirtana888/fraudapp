
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, Firestore, where, setDoc, getDoc, limit } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser
} from "firebase/auth";
import { CompanyProfile, UserProfile, AssessmentInvite, Job, JobApplication } from "../types";

// --- KONFIGURASI FIREBASE (From Environment Variables) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const COLLECTIONS = {
  SESSIONS: 'interview_sessions',
  USERS: 'users',
  COMPANIES: 'companies',
  INVITES: 'assessment_invites',
  JOBS: 'jobs',
  APPLICATIONS: 'applications',
  WORKFLOWS: 'workflows'
};

export let db: Firestore;
export let functions: any;
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
        accessCode,
        assessmentLink,
        role: jobTitle
      }
    );

    const inviteData: AssessmentInvite = {
      access_code: accessCode,
      name: candidateName,
      email: candidateEmail,
      role: jobTitle,
      companyId: sessionId,
      status: 'PENDING',
      sessionId: sessionId,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, COLLECTIONS.INVITES), inviteData);

    // Update session dengan inviteSource marker untuk tracking
    const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      inviteSource: 'review_invite',
      inviteAccessCode: accessCode,
      invitedAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('[INTEGRITY-INVITE] Error:', error);
    throw error;
  }
};

// --- REAL AUTHENTICATION SERVICE ---
export const loginWithFirestore = async (email: string, password: string): Promise<UserProfile | null> => {
  if (!db) throw new Error("Koneksi Database terputus.");

  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    // Auto-trim input to prevent copy-paste errors
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    const q = query(usersRef, where("email", "==", cleanEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Akun tidak ditemukan. Silakan hubungi Administrator.");
    }

    const userData = querySnapshot.docs[0].data() as UserProfile;
    
    // Auto-trim stored password as well for safety
    if (userData.password?.trim() !== cleanPass) {
      throw new Error("Kata sandi salah.");
    }

    // Assign Role if missing (Backward Compatibility)
    const role = userData.role || 'User';

    return { ...userData, role, id: querySnapshot.docs[0].id };
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};


// Sign Up Function
interface SignUpData {
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export const signUpWithFirestore = async (data: SignUpData): Promise<UserProfile | null> => {
  if (!db) throw new Error("Koneksi Database terputus.");

  try {
    const { companyName, fullName, email, phone, password } = data;
    
    // Check if email already exists
    const usersRef = collection(db, COLLECTIONS.USERS);
    const emailQuery = query(usersRef, where("email", "==", email));
    const existingUsers = await getDocs(emailQuery);
    
    if (!existingUsers.empty) {
      throw new Error("Email sudah terdaftar. Silakan gunakan email lain atau login.");
    }

    // Create company first
    const companiesRef = collection(db, COLLECTIONS.COMPANIES);
    const newCompany: CompanyProfile = {
      id: '', // Will be set after creation
      name: companyName,
      tier: 'Basic', // Default tier
      status: 'Active',
      adminEmail: email,
      joinedDate: new Date().toISOString(),
      logoUrl: '',
      whatsapp: phone,
      createdAt: new Date(),
      verification_credits: 100 // Initial credits
    };

    const companyDoc = await addDoc(companiesRef, newCompany);
    console.log('[SIGNUP] Company created:', companyDoc.id);

    // Create user
    const newUser: UserProfile = {
      id: '', // Will be set after creation
      name: fullName,
      email: email,
      password: password, // In production, this should be hashed
      role: 'Company Admin', // First user is company admin
      companyId: companyDoc.id,
      avatar: ''
    };

    const userDoc = await addDoc(usersRef, newUser);
    console.log('[SIGNUP] User created:', userDoc.id);

    // Return user profile
    return {
      ...newUser,
      id: userDoc.id
    };

  } catch (error: any) {
    console.error('[SIGNUP] Error:', error);
    throw error;
  }
};


export const resetUserPassword = async (email: string) => {
    if (!db) throw new Error("Database terputus");

    try {
        const cleanEmail = email.trim();
        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(usersRef, where("email", "==", cleanEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Email tidak terdaftar dalam sistem.");
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as UserProfile;
        
        // Generate Temporary Password
        const tempPassword = Math.random().toString(36).slice(-8) + "#Rst";
        
        // Update Password in Database
        await updateDoc(doc(db, COLLECTIONS.USERS, userDoc.id), {
            password: tempPassword
        });

        // Send Email via Firebase Cloud Function
        const emailSent = await sendEmailViaCloudFunction(
            "password_reset",
            cleanEmail,
            {
                candidateName: userData.name,
                candidateEmail: cleanEmail,
                tempPassword: tempPassword,
                loginUrl: window.location.origin
            }
        );

        if (!emailSent) {
            throw new Error("Gagal mengirim email. Silakan coba lagi.");
        }
        
        return { success: true, message: `Password baru telah dikirim ke ${cleanEmail}.` };

    } catch (error: any) {
        console.error("Reset Password Error:", error);
        throw error;
    }
};

// --- DATA SEEDING (ONCE ONLY) ---
export const seedRealDatabase = async () => {
  if (!db) return;

  const seedId = 'system_seed_v4_admin_ent'; 
  const seedRef = doc(db, 'system_metadata', seedId);

  try {
    const seedDoc = await getDoc(seedRef).catch(e => {
        console.warn("[Seeding] Database unreachable or offline, skipping seed check:", e.message);
        return { exists: () => true }; 
    });

    // @ts-ignore
    if (!seedDoc || seedDoc.exists()) return;

    console.log("[System] Initializing Real Database Schema (RBAC)...");

    // 1. Create Enterprise Company
    const entCompanyRef = doc(db, COLLECTIONS.COMPANIES, 'c1');
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await setDoc(entCompanyRef, {
      name: 'PT Maju Bersama',
      tier: 'Enterprise',
      status: 'Active',
      adminEmail: 'enterprise@fraudguard.id',
      joinedDate: new Date().toISOString(),
      subscription_ends_at: oneYearFromNow.toISOString(),
      custom_candidate_limit: 0, 
      verification_credits: 100, 
      usersCount: 5,
      logoUrl: '', 
      brandColor: '#CC5500'
    });

    // 2. Create Enterprise User
    const entUserRef = doc(db, COLLECTIONS.USERS, 'u1');
    await setDoc(entUserRef, {
      name: 'Budi Santoso',
      email: 'enterprise@fraudguard.id',
      password: 'password123',
      role: 'Company Admin', 
      companyId: 'c1',
      avatar: 'https://ui-avatars.com/api/?background=CC5500&color=fff&name=Budi+Santoso'
    });

    // 3. Create SUPER ADMIN Company (System) - FORCE ENTERPRISE
    const systemCompRef = doc(db, COLLECTIONS.COMPANIES, 'system');
    await setDoc(systemCompRef, {
      name: 'System Admin View',
      tier: 'Enterprise',
      status: 'Active',
      adminEmail: 'admin@fraudguard.id',
      joinedDate: new Date().toISOString(),
      subscription_ends_at: new Date(2099, 11, 31).toISOString(), 
      custom_candidate_limit: 999999,
      verification_credits: 999999,
      usersCount: 1,
      logoUrl: '',
      brandColor: '#1e293b'
    });

    // 4. Create SUPER ADMIN User
    const adminUserRef = doc(db, COLLECTIONS.USERS, 'admin1');
    await setDoc(adminUserRef, {
      name: 'Super Admin',
      email: 'admin@fraudguard.id',
      password: 'admin123',
      role: 'System Admin', 
      companyId: 'system',
      avatar: 'https://ui-avatars.com/api/?background=0f172a&color=fff&name=Super+Admin'
    });

    await setDoc(seedRef, { seededAt: new Date().toISOString(), status: 'Production Ready V3' });
    console.log("[System] Database Initialized with RBAC.");

  } catch (error) {
    console.warn("Seeding process encountered an issue:", error);
  }
};

// --- SESSION SERVICES ---

export const saveSessionToDB = async (sessionData: any): Promise<string> => {
  try {
    if (!db) throw new Error("Database not initialized");
    const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), sessionData);
    return docRef.id;
  } catch (e: any) {
    console.error("Gagal menyimpan ke Cloud:", e);
    throw e;
  }
};

export const updateSessionInDB = async (id: string, sessionData: any) => {
    try {
        if (!db) throw new Error("Database not initialized");
        const docRef = doc(db, COLLECTIONS.SESSIONS, id);
        await updateDoc(docRef, sessionData);
    } catch (e: any) {
        console.error("Gagal update Cloud:", e);
        throw e;
    }
};

// --- SMART FALLBACK SUBSCRIPTION ---
export const subscribeToSessions = (companyId: string | undefined, role: string, onUpdate: (data: any[]) => void) => {
  if (!db) return () => {};
  
  const collRef = collection(db, COLLECTIONS.SESSIONS);
  let unsubscribe: () => void = () => {};

  const executeSimpleQuery = () => {
      // FALLBACK: Simple Query (No OrderBy) -> Sort Client Side
      console.warn("Using Fallback Query (Client-Side Sorting)");
      let simpleQ;
      if (role === 'System Admin') {
          simpleQ = query(collRef, limit(50));
      } else if (companyId) {
          simpleQ = query(collRef, where('companyId', '==', companyId), limit(50));
      } else {
          return;
      }

      unsubscribe = onSnapshot(simpleQ, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Client-side sort
          data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          onUpdate(data);
      });
  };

  try {
    // ATTEMPT 1: Complex Query (Requires Index)
    let complexQ;
    if (role === 'System Admin') {
        complexQ = query(collRef, orderBy('date', 'desc'), limit(50));
    } else if (companyId) {
        complexQ = query(collRef, where('companyId', '==', companyId), orderBy('date', 'desc'), limit(50));
    } else {
        return () => {};
    }

    unsubscribe = onSnapshot(complexQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    }, (error) => {
      if (error.message.includes("requires an index")) {
         console.warn("⚠️ Index missing. Switching to Fallback Strategy...");
         // If complex query fails, run simple query
         executeSimpleQuery();
      } else if (error.code !== 'permission-denied') {
          console.error("Subscription Error:", error);
      }
    });

    return () => unsubscribe();

  } catch (err) {
      console.error("Setup Error, using fallback:", err);
      executeSimpleQuery();
      return () => unsubscribe();
  }
};

// --- COMPANY SERVICES ---

export const inviteCompanyReal = async (companyData: Omit<CompanyProfile, 'id'>) => {
    if (!db) throw new Error("Database terputus");

    try {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30);

        const companyPayload = {
             ...companyData,
             status: 'Active', 
             subscription_ends_at: defaultExpiry.toISOString(),
             verification_credits: 0,
             custom_candidate_limit: 0,
             createdAt: new Date().toISOString()
        };

        const companyRef = await addDoc(collection(db, COLLECTIONS.COMPANIES), companyPayload);
        const generatedPassword = Math.random().toString(36).slice(-8) + "Fg!";

        await addDoc(collection(db, COLLECTIONS.USERS), {
            name: `Admin ${companyData.name}`,
            email: companyData.adminEmail,
            password: generatedPassword, 
            role: 'Company Admin', 
            companyId: companyRef.id,
            avatar: `https://ui-avatars.com/api/?background=random&name=${companyData.name}`,
            createdAt: new Date().toISOString()
        });

        try {
            const emailSent = await sendEmailViaCloudFunction(
                "business_invitation",
                companyData.adminEmail,
                {
                    companyName: companyData.name,
                    adminEmail: companyData.adminEmail,
                    tier: companyData.tier,
                    password: generatedPassword
                }
            );

            if (!emailSent) {
                return {
                    success: true,
                    message: `Akun dibuat (Pass: ${generatedPassword}), tapi Email GAGAL.`
                };
            }

            return { success: true, message: `Perusahaan disimpan. Email kredensial terkirim ke ${companyData.adminEmail}.` };

        } catch (emailError: any) {
            console.warn("Email Error:", emailError);
            return {
                success: true,
                message: `Akun dibuat (Pass: ${generatedPassword}), tapi Email GAGAL.`
            };
        }

    } catch (error: any) {
        console.error("Invite Error:", error);
        throw new Error(error.message || "Gagal menyimpan data perusahaan.");
    }
};

export const resendInviteEmail = async (companyId: string) => {
    if (!db) throw new Error("Database terputus");

    try {
        const compDoc = await getDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
        if (!compDoc.exists()) throw new Error("Perusahaan tidak ditemukan.");
        const companyData = compDoc.data() as CompanyProfile;

        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(usersRef, where("companyId", "==", companyId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
             throw new Error("User Admin untuk perusahaan ini tidak ditemukan.");
        }

        const userData = querySnapshot.docs[0].data() as UserProfile;
        const userPassword = userData.password || "Hubungi Super Admin";

        const emailSent = await sendEmailViaCloudFunction(
            "business_invitation",
            companyData.adminEmail,
            {
                companyName: companyData.name,
                adminEmail: companyData.adminEmail,
                tier: companyData.tier,
                password: userPassword
            }
        );

        if (!emailSent) {
            throw new Error("Gagal mengirim email. Silakan coba lagi.");
        }

        return { success: true, message: `Email kredensial berhasil dikirim ulang ke ${companyData.adminEmail}` };

    } catch (error: any) {
        console.error("Resend Email Error:", error);
        throw error;
    }
};

export const updateCompany = async (id: string, data: Partial<CompanyProfile>, retries = 3) => {
    if (!db) {
        console.error('[UPDATE-COMPANY] Firestore DB not initialized');
        throw new Error('Database not initialized');
    }

    console.log('[UPDATE-COMPANY] Updating company:', {
        id,
        dataKeys: Object.keys(data),
        hasLogoUrl: !!data.logoUrl,
        logoUrlLength: data.logoUrl?.length || 0,
        retriesLeft: retries
    });

    const docRef = doc(db, COLLECTIONS.COMPANIES, id);

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await updateDoc(docRef, data);
            console.log('[UPDATE-COMPANY] ✅ Update successful');
            return;
        } catch (error: any) {
            console.error(`[UPDATE-COMPANY] Attempt ${attempt + 1} failed:`, error);

            if (attempt === retries - 1) {
                throw error;
            }

            const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
            console.log(`[UPDATE-COMPANY] Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

export const updateCompanySubscription = async (id: string, data: any) => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.COMPANIES, id);
    await updateDoc(docRef, data);
};

export const deleteCompany = async (id: string) => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.COMPANIES, id);
    await deleteDoc(docRef);
};

export const getCompanies = async (): Promise<CompanyProfile[]> => {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.COMPANIES));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyProfile));
    } catch (e) {
        console.error("Firestore fetch error:", e);
        return [];
    }
};

export const getCompanyBySlug = async (slug: string): Promise<CompanyProfile | null> => {
    if (!slug || !db) {
        console.warn('[GET-COMPANY] No slug or DB not initialized');
        return null;
    }

    try {
        const q = query(
            collection(db, COLLECTIONS.COMPANIES),
            where('companySlug', '==', slug),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as CompanyProfile;
        }

        const companies = await getDocs(collection(db, COLLECTIONS.COMPANIES));
        const matchedCompany = companies.docs.find(doc => {
            const generatedSlug = generateSlug(doc.data().name);
            return generatedSlug === slug;
        });

        if (matchedCompany) {
            return { id: matchedCompany.id, ...matchedCompany.data() } as CompanyProfile;
        }

        return null;
    } catch (error) {
        console.error('[GET-COMPANY] Error fetching company by slug:', error);
        return null;
    }
};

export const getCompanyById = async (id: string): Promise<CompanyProfile | null> => {
    if (!id || !db) {
        console.warn('[GET-COMPANY] No ID or DB not initialized');
        return null;
    }

    console.log('[GET-COMPANY] Fetching company with ID:', id);

    if (id === 'system') {
        try {
            const docRef = doc(db, COLLECTIONS.COMPANIES, 'system');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('[GET-COMPANY] system found in Firestore:', {
                    hasLogoUrl: !!data.logoUrl,
                    logoUrlLength: data.logoUrl?.length || 0
                });
                return { id: docSnap.id, ...data } as CompanyProfile;
            }
        } catch (e) {
            console.error('[GET-COMPANY] Error fetching system:', e);
        }

        console.log('[GET-COMPANY] Using fallback data for system');
        return {
            id: 'system',
            name: 'System Admin View',
            tier: 'Enterprise',
            status: 'Active',
            adminEmail: 'admin@fraudguard.id',
            joinedDate: new Date().toISOString(),
            subscription_ends_at: new Date(2099, 11, 31).toISOString(),
            custom_candidate_limit: 999999,
            usersCount: 1
        } as CompanyProfile;
    }

    if (id === 'c1') {
        try {
            const docRef = doc(db, COLLECTIONS.COMPANIES, 'c1');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('[GET-COMPANY] c1 found in Firestore:', {
                    hasLogoUrl: !!data.logoUrl,
                    logoUrlLength: data.logoUrl?.length || 0
                });
                return { id: docSnap.id, ...data } as CompanyProfile;
            }
        } catch (e) {
            console.error('[GET-COMPANY] Error fetching c1:', e);
        }

        console.log('[GET-COMPANY] Using fallback data for c1');
        return {
            id: 'c1',
            name: 'PT Maju Bersama',
            tier: 'Enterprise',
            status: 'Active',
            adminEmail: 'enterprise@fraudguard.id',
            joinedDate: new Date().toISOString()
        } as CompanyProfile;
    }

    try {
        const docRef = doc(db, COLLECTIONS.COMPANIES, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('[GET-COMPANY] Company found:', {
                id,
                hasLogoUrl: !!data.logoUrl,
                logoUrlLength: data.logoUrl?.length || 0,
                logoUrlPreview: data.logoUrl?.substring(0, 100),
                allFields: Object.keys(data)
            });
            return { id: docSnap.id, ...data } as CompanyProfile;
        } else {
            console.warn(`[GET-COMPANY] Company ID ${id} not found in Firestore`);
            return {
                id: id,
                name: 'Perusahaan Terdaftar',
                tier: 'Basic',
                status: 'Active',
                adminEmail: 'support@fraudguard.id',
                joinedDate: new Date().toISOString(),
                welcomeMessage: 'Silakan lengkapi data asesmen Anda.'
            } as CompanyProfile;
        }
    } catch (e) {
        console.error("[GET-COMPANY] Error fetching company:", e);
        return {
             id: id,
             name: 'Portal Kandidat FraudGuard',
             tier: 'Basic',
             status: 'Active',
             adminEmail: '',
             joinedDate: new Date().toISOString(),
             welcomeMessage: 'Akses database terbatas. Menggunakan profil sementara.'
        } as CompanyProfile;
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
