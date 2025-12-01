
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, Firestore, where, setDoc, getDoc } from "firebase/firestore";
import { CompanyProfile, UserProfile } from "../types";

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
  COMPANIES: 'companies'
};

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
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Akun tidak ditemukan. Silakan hubungi Administrator.");
    }

    const userData = querySnapshot.docs[0].data() as UserProfile;
    
    if (userData.password !== password) {
      throw new Error("Kata sandi salah.");
    }

    return { ...userData, id: querySnapshot.docs[0].id };
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

// --- DATA SEEDING (ONCE ONLY) ---
export const seedRealDatabase = async () => {
  if (!db) return;

  const seedId = 'system_seed_v2_real';
  const seedRef = doc(db, 'system_metadata', seedId);

  try {
    const seedDoc = await getDoc(seedRef);
    if (seedDoc.exists()) return;

    console.log("[System] Initializing Real Database Schema...");

    // 1. Create Enterprise Company
    const entCompanyRef = doc(db, COLLECTIONS.COMPANIES, 'c1');
    await setDoc(entCompanyRef, {
      name: 'PT Maju Bersama',
      tier: 'Enterprise',
      status: 'Active',
      adminEmail: 'enterprise@fraudguard.id',
      joinedDate: new Date().toISOString(),
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
      role: 'Lead Investigator',
      companyId: 'c1',
      avatar: 'https://ui-avatars.com/api/?background=CC5500&color=fff&name=Budi+Santoso'
    });

    // 3. Create Admin User
    const adminUserRef = doc(db, COLLECTIONS.USERS, 'admin1');
    await setDoc(adminUserRef, {
      name: 'Super Admin',
      email: 'admin@fraudguard.id',
      password: 'admin123',
      role: 'System Admin',
      companyId: 'system',
      avatar: 'https://ui-avatars.com/api/?background=0f172a&color=fff&name=Super+Admin'
    });

    await setDoc(seedRef, { seededAt: new Date().toISOString(), status: 'Production Ready' });
    console.log("[System] Database Initialized.");

  } catch (error) {
    console.error("Seeding Failed:", error);
  }
};

// --- SESSION SERVICES ---

export const saveSessionToDB = async (sessionData: any) => {
  try {
    if (!db) throw new Error("Database not initialized");
    return await addDoc(collection(db, COLLECTIONS.SESSIONS), sessionData);
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

export const subscribeToSessions = (onUpdate: (data: any[]) => void) => {
  if (!db) return () => {};
  
  try {
    const q = query(collection(db, COLLECTIONS.SESSIONS), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    }, (error) => {
      console.error("Realtime Subscription Error:", error);
      window.dispatchEvent(new CustomEvent('firebase-connection-error', { detail: error.message }));
    });
    return unsubscribe;
  } catch (err) {
      console.error(err);
      return () => {};
  }
};

// --- COMPANY SERVICES (CLIENT SIDE REAL EMAIL) ---

export const inviteCompanyReal = async (companyData: Omit<CompanyProfile, 'id'>) => {
    if (!db) throw new Error("Database terputus");

    try {
        // 1. Simpan Data Perusahaan ke Firestore
        const companyRef = await addDoc(collection(db, COLLECTIONS.COMPANIES), {
             ...companyData,
             createdAt: new Date().toISOString()
        });

        // 2. Generate Password Acak untuk Bisnis
        const generatedPassword = Math.random().toString(36).slice(-8) + "Fg!"; // Contoh: 8s7d6fFg!

        // 3. Buat Akun USER untuk Perusahaan tersebut agar bisa Login
        await addDoc(collection(db, COLLECTIONS.USERS), {
            name: `Admin ${companyData.name}`,
            email: companyData.adminEmail,
            password: generatedPassword, // Password yang akan dikirim ke email
            role: 'Company Admin',
            companyId: companyRef.id,
            avatar: `https://ui-avatars.com/api/?background=random&name=${companyData.name}`,
            createdAt: new Date().toISOString()
        });

        // 4. Kirim Email Menggunakan EmailJS (Client Side SMTP)
        try {
            const templateParams = {
                to_email: companyData.adminEmail, // PENTING: Pastikan Template EmailJS menggunakan {{to_email}} di kolom "To Email"
                to_name: companyData.name,
                password: generatedPassword, // Mengirim password ke template
                login_url: window.location.origin, // Link ke aplikasi ini
                tier: companyData.tier,
                message: `Selamat bergabung! Akun Enterprise Anda (${companyData.tier}) telah aktif.`
            };

            // ==========================================================
            // KONFIGURASI SERVICE ID & TEMPLATE ID EMAILJS
            // ==========================================================
            const SERVICE_ID = "service_8o2nl6d";
            const TEMPLATE_ID = "template_gfg2qr4"; 

            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
            
            return { success: true, message: `Perusahaan disimpan. Akun Login dibuat. Email kredensial terkirim ke ${companyData.adminEmail}.` };

        } catch (emailError: any) {
            console.warn("EmailJS Error:", emailError);
            return { 
                success: true, 
                message: `Akun dibuat (Pass: ${generatedPassword}), tapi Email GAGAL: ${emailError.text || emailError.message}. Periksa setting Template EmailJS Anda.` 
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
        // 1. Ambil Data Perusahaan
        const compDoc = await getDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
        if (!compDoc.exists()) throw new Error("Perusahaan tidak ditemukan.");
        const companyData = compDoc.data() as CompanyProfile;

        // 2. Ambil Data User (Admin) untuk Perusahaan ini
        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(usersRef, where("companyId", "==", companyId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
             throw new Error("User Admin untuk perusahaan ini tidak ditemukan. Silakan buat user manual.");
        }

        // Ambil user pertama (asumsi admin)
        const userData = querySnapshot.docs[0].data() as UserProfile;
        const userPassword = userData.password || "Hubungi Super Admin"; // Password tersimpan di DB untuk arsitektur ini

        // 3. Kirim Email via EmailJS
        const templateParams = {
            to_email: companyData.adminEmail,
            to_name: companyData.name,
            password: userPassword,
            login_url: window.location.origin,
            tier: companyData.tier,
            message: `[KIRIM ULANG] Berikut adalah kredensial akses Anda yang diminta.`
        };

        const SERVICE_ID = "service_8o2nl6d";
        const TEMPLATE_ID = "template_gfg2qr4";

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
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
    if (!db || !id) return null;
    
    // Fallback Enterprise untuk demo link publik jika database kosong
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
            console.warn(`Company ID ${id} not found in Firestore.`);
            return null;
        }
    } catch (e) {
        console.error("Error fetching company:", e);
        return null;
    }
};

export const resetConnectionState = () => {
  console.log("Reconnecting...");
};
