
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, Firestore, where, setDoc, getDoc, limit } from "firebase/firestore";
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

// --- EMAILJS CONFIGURATION ---
const EMAILJS_SERVICE_ID = "service_8o2nl6d";
const EMAILJS_TEMPLATE_BUSINESS = "template_gfg2qr4"; // For Business Invite & Password Reset
const EMAILJS_TEMPLATE_CANDIDATE = "template_dvgrjda"; // For Candidate Assessment Invite

let db: Firestore;

// Declare EmailJS globally
declare const emailjs: any;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("[FraudGuard System] Connected to Real Cloud Firestore (Blaze Plan Active).");
} catch (error) {
  console.error("CRITICAL: Gagal menghubungkan ke Firebase Real.", error);
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

        // Send Email via EmailJS
        const templateParams = {
            to_email: cleanEmail,
            to_name: userData.name,
            password: tempPassword,
            login_url: window.location.origin,
            tier: "Reset Request",
            message: `Permintaan reset password Anda berhasil. Gunakan password sementara di atas untuk login.`
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_BUSINESS, templateParams);
        
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
            const templateParams = {
                to_email: companyData.adminEmail,
                to_name: companyData.name,
                password: generatedPassword,
                login_url: window.location.origin,
                tier: companyData.tier,
                message: `Selamat bergabung! Akun ${companyData.tier} Anda aktif hingga ${defaultExpiry.toLocaleDateString('id-ID')}.`
            };

            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_BUSINESS, templateParams);
            return { success: true, message: `Perusahaan disimpan. Email kredensial terkirim ke ${companyData.adminEmail}.` };

        } catch (emailError: any) {
            console.warn("EmailJS Error:", emailError);
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

        const templateParams = {
            to_email: companyData.adminEmail,
            to_name: companyData.name,
            password: userPassword,
            login_url: window.location.origin,
            tier: companyData.tier,
            message: `[KIRIM ULANG] Berikut adalah kredensial akses Anda.`
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_BUSINESS, templateParams);
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

  // Check if EmailJS is available
  if (typeof emailjs === 'undefined') {
      throw new Error("Layanan EmailJS tidak terhubung. Cek koneksi internet atau konfigurasi index.html");
  }

  const results = { success: 0, failed: 0 };

  for (const candidate of candidates) {
    try {
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

      // C. Send Email via EmailJS
      const assessmentLink = `${window.location.origin}?mode=assess`; // No cid here, code implies company
      const templateParams = {
        to_email: candidate.email,
        to_name: candidate.name,
        company_name: companyName,
        access_code: accessCode,
        assessment_link: assessmentLink,
        message: `Silakan akses tes integritas Anda menggunakan Kode Akses: ${accessCode}. Kode ini hanya berlaku 1 kali.`
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CANDIDATE, templateParams);
      results.success++;

    } catch (error) {
      console.error(`Failed to blast invite to ${candidate.email}`, error);
      results.failed++;
    }
  }

  return results;
};

export const verifyAccessCode = async (code: string): Promise<AssessmentInvite | null> => {
  if (!db) throw new Error("Database offline");
  
  try {
    const q = query(
      collection(db, COLLECTIONS.INVITES), 
      where("access_code", "==", code.toUpperCase().trim()),
      where("status", "==", "PENDING")
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docData = snapshot.docs[0].data() as AssessmentInvite;
    return { ...docData, id: snapshot.docs[0].id };
  } catch (e) {
    console.error("Verification failed:", e);
    return null;
  }
};

export const markAccessCodeUsed = async (code: string) => {
  if (!db) return;
  
  try {
    const q = query(
      collection(db, COLLECTIONS.INVITES), 
      where("access_code", "==", code.toUpperCase().trim())
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, { status: 'USED', usedAt: new Date().toISOString() });
    }
  } catch (e) {
    console.error("Failed to mark code used:", e);
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
