
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, Firestore, where, setDoc, getDoc, limit } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CompanyProfile, UserProfile, AssessmentInvite } from "../types";

// --- KONFIGURASI FIREBASE REAL (PRODUCTION) ---
const firebaseConfig = {
  apiKey: "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo",
  authDomain: "gen-lang-client-0226679970.firebaseapp.com",
  projectId: "gen-lang-client-0226679970",
  storageBucket: "gen-lang-client-0226679970.firebasestorage.app",
  messagingSenderId: "422224153226",
  appId: "1:422224153226:web:4598cd213b6275436a3b73",
  measurementId: "G-MXQTH4CBF6"
};

export const COLLECTIONS = {
  SESSIONS: 'interview_sessions',
  USERS: 'users',
  COMPANIES: 'companies',
  INVITES: 'assessment_invites'
};

export let db: Firestore;
let functions: any;

// Helper function untuk kirim email via Firebase Cloud Function
const sendEmailViaCloudFunction = async (
  type: "business" | "candidate" | "reset",
  to_email: string,
  to_name: string,
  data: Record<string, any>
): Promise<boolean> => {
  try {
    if (!functions) {
      console.error("Firebase Functions not initialized");
      throw new Error("Layanan email tidak tersedia. Pastikan Firebase Functions sudah di-deploy.");
    }

    console.log(`Sending ${type} email to ${to_email}...`);

    // Panggil Firebase Cloud Function
    const sendEmail = httpsCallable(functions, "sendEmailViaEmailJS");
    const result = await sendEmail({
      type,
      to_email,
      to_name,
      data,
    });

    const response = result.data as { success: boolean; message?: string };

    if (!response.success) {
      throw new Error(response.message || "Gagal mengirim email");
    }

    console.log(`Email sent successfully to ${to_email}`);
    return true;
  } catch (error: any) {
    console.error("Error sending email via Firebase Function:", error);

    // Log detailed error for debugging
    if (error.code) {
      console.error("Firebase Error Code:", error.code);
    }
    if (error.message) {
      console.error("Error Message:", error.message);
    }

    throw new Error(`Email gagal dikirim: ${error.message || 'Unknown error'}`);
  }
};

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  functions = getFunctions(app, "europe-west1"); // Set region sesuai dengan Cloud Function
  console.log("[FraudGuard System] Connected to Firebase (Firestore + Functions).");
} catch (error) {
  console.error("CRITICAL: Gagal menghubungkan ke Firebase.", error);
}

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
            "reset",
            cleanEmail,
            userData.name,
            {
                password: tempPassword,
                login_url: window.location.origin,
                tier: "Reset Request",
                message: `Permintaan reset password Anda berhasil. Gunakan password sementara di atas untuk login.`
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
                "business",
                companyData.adminEmail,
                companyData.name,
                {
                    password: generatedPassword,
                    login_url: window.location.origin,
                    tier: companyData.tier,
                    message: `Selamat bergabung! Akun ${companyData.tier} Anda aktif hingga ${defaultExpiry.toLocaleDateString('id-ID')}.`
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
            "business",
            companyData.adminEmail,
            companyData.name,
            {
                password: userPassword,
                login_url: window.location.origin,
                tier: companyData.tier,
                message: `[KIRIM ULANG] Berikut adalah kredensial akses Anda.`
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

export const updateCompany = async (id: string, data: Partial<CompanyProfile>) => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.COMPANIES, id);
    await updateDoc(docRef, data);
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

export const getCompanyById = async (id: string): Promise<CompanyProfile | null> => {
    if (!id || !db) return null;

    if (id === 'system') {
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
            if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as CompanyProfile;
        } catch (e) {}
        
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
            return { id: docSnap.id, ...docSnap.data() } as CompanyProfile;
        } else {
            console.warn(`Company ID ${id} not found.`);
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
        console.error("Error fetching company:", e);
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

  for (const candidate of candidates) {
    try {
      console.log(`Processing candidate: ${candidate.name} (${candidate.email})`);

      // A. Generate Access Code (6 Alphanumeric)
      const accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();

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
      console.log(`Database saved for ${candidate.email}`);

      // C. Send Email via Firebase Cloud Function
      const assessmentLink = `${window.location.origin}?mode=assess`;

      try {
        const emailSent = await sendEmailViaCloudFunction(
          "candidate",
          candidate.email,
          candidate.name,
          {
            company_name: companyName,
            access_code: accessCode,
            assessment_link: assessmentLink,
            message: `Silakan akses tes integritas Anda menggunakan Kode Akses: ${accessCode}. Kode ini hanya berlaku 1 kali.`
          }
        );

        if (!emailSent) {
          throw new Error("Email function returned false");
        }

        console.log(`Email sent successfully to ${candidate.email}`);
        results.success++;

      } catch (emailError: any) {
        console.error(`Email error for ${candidate.email}:`, emailError);
        errors.push(`${candidate.email}: ${emailError.message}`);
        results.failed++;
      }

    } catch (error: any) {
      console.error(`Failed to process invite for ${candidate.email}`, error);
      errors.push(`${candidate.email}: ${error.message}`);
      results.failed++;
    }
  }

  if (errors.length > 0) {
    console.error("Errors during blast:", errors);
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
      "candidate",
      inviteData.email,
      inviteData.name,
      {
        company_name: companyName,
        access_code: inviteData.access_code,
        assessment_link: assessmentLink,
        message: `Silakan akses tes integritas Anda menggunakan Kode Akses: ${inviteData.access_code}. Kode ini hanya berlaku 1 kali.`
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
