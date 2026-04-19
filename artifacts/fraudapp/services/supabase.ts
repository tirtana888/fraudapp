import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { InterviewSession, AssessmentInvite, CompanyProfile, UserProfile, Job, JobApplication, Workflow } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Re-export db alias for compatibility with files importing { db }
export const db = supabase;

// Auth instance alias for compatibility
export const auth = supabase.auth;

// Functions stub — Firebase Cloud Functions are replaced with console.warn
export const functions = null;

export const COLLECTIONS = {
  SESSIONS: 'interview_sessions',
  USERS: 'users',
  COMPANIES: 'companies',
  INVITES: 'assessment_invites',
  JOBS: 'jobs',
  APPLICATIONS: 'applications',
  WORKFLOWS: 'workflows',
  CREDIT_TRANSACTIONS: 'credit_transactions',
  NOTIFICATIONS: 'notifications',
} as const;

// ==========================================
// HELPER: stub for Cloud Functions
// ==========================================
export const sendEmailViaCloudFunction = async (
  emailType: string,
  to_email: string,
  emailData: Record<string, any>
): Promise<boolean> => {
  console.warn('[EMAIL] Cloud Functions not migrated. Email not sent:', { emailType, to_email, emailData });
  return false;
};

// ==========================================
// AUTH FUNCTIONS
// ==========================================

export const loginWithFirebase = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
};

export const registerWithFirebase = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
};

export const logoutFromFirebase = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const sendPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const resendVerificationEmail = async () => {
  console.warn('[AUTH] Email verification resend not supported in Supabase anon flow');
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
  return data;
};

export const onAuthStateChanged = (callback: (user: any) => void): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
};

// ==========================================
// USER PROFILE
// ==========================================

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.USERS)
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[USER] Error fetching profile:', error);
    return null;
  }
  return data as UserProfile;
};

export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.USERS)
    .select('*')
    .eq('email', email)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[USER] Error fetching profile by email:', error);
    return null;
  }
  return data as UserProfile;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.USERS).insert(profile);
  if (error) {
    console.error('[USER] Error creating profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>, email?: string): Promise<void> => {
  let query = supabase.from(COLLECTIONS.USERS).update(updates).eq('id', userId);
  const { error } = await query;

  if (error) {
    // Try by email as fallback
    if (email) {
      const { error: emailError } = await supabase
        .from(COLLECTIONS.USERS)
        .update(updates)
        .eq('email', email);

      if (emailError) {
        // Upsert
        const newProfile: UserProfile = {
          id: userId,
          email: email,
          name: updates.name || 'User',
          role: updates.role || 'System Admin',
          createdAt: new Date().toISOString(),
          ...updates
        };
        const { error: insertError } = await supabase.from(COLLECTIONS.USERS).insert(newProfile);
        if (insertError) throw insertError;
      }
    } else {
      throw error;
    }
  }
};

// ==========================================
// COMPANY
// ==========================================

export const getCompanyById = async (companyId: string): Promise<CompanyProfile | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('*')
    .eq('id', companyId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[COMPANY] Error fetching company:', error);
    return null;
  }
  return data as CompanyProfile;
};

export const createCompany = async (companyData: Omit<CompanyProfile, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .insert({ ...companyData, createdAt: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateCompany = async (companyId: string, updates: Partial<CompanyProfile>): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', companyId);
  if (error) throw error;
};

export const getCompanies = async (): Promise<CompanyProfile[]> => {
  const { data, error } = await supabase.from(COLLECTIONS.COMPANIES).select('*');
  if (error) {
    console.error('[ADMIN] Error fetching companies:', error);
    return [];
  }
  return (data || []) as CompanyProfile[];
};

export const updateCompanySubscription = async (companyId: string, updates: any): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .update(updates)
    .eq('id', companyId);
  if (error) throw error;
};

export const deleteCompany = async (companyId: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.COMPANIES).delete().eq('id', companyId);
  if (error) throw error;
};

export const inviteCompanyReal = async (payload: {
  name: string;
  adminEmail: string;
  tier: 'Freemium' | 'Premium';
  status: 'Pending' | 'Active';
  joinedDate: string;
  usersCount: number;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const companyData = {
      name: payload.name,
      tier: payload.tier,
      status: payload.status,
      adminEmail: payload.adminEmail,
      joinedDate: payload.joinedDate,
      usersCount: payload.usersCount || 1,
      credits: payload.tier === 'Premium' ? 1500 : 1000,
      verification_credits: 100,
      createdAt: new Date().toISOString(),
    };
    const { data, error } = await supabase.from(COLLECTIONS.COMPANIES).insert(companyData).select('id').single();
    if (error) throw error;
    return { success: true, message: `Company "${payload.name}" berhasil dibuat dengan ID: ${data.id}` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal membuat company' };
  }
};

export const resendInviteEmail = async (companyId: string): Promise<{ success: boolean; message: string }> => {
  const company = await getCompanyById(companyId);
  if (!company) return { success: false, message: 'Company tidak ditemukan' };
  console.warn('[ADMIN] resendInviteEmail: email sending not implemented (Cloud Functions removed)');
  return { success: true, message: `Email undangan berhasil dikirim ke ${company.adminEmail}` };
};

// ==========================================
// INTERVIEW SESSIONS
// ==========================================

export const createInterviewSession = async (sessionData: Omit<InterviewSession, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .insert({ ...sessionData })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const getSessionsByCompany = async (companyId: string): Promise<InterviewSession[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .select('*')
    .eq('companyId', companyId)
    .order('date', { ascending: false });
  if (error) {
    console.error('[SESSIONS] Error fetching sessions:', error);
    return [];
  }
  return (data || []) as InterviewSession[];
};

export const getSessionById = async (sessionId: string): Promise<InterviewSession | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[SESSIONS] Error fetching session:', error);
    return null;
  }
  return data as InterviewSession;
};

export const updateSession = async (sessionId: string, updates: Partial<InterviewSession>): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.SESSIONS).delete().eq('id', sessionId);
  if (error) throw error;
};

export const subscribeToSessions = (
  companyId: string,
  onUpdate: (data: InterviewSession[]) => void
): (() => void) => {
  // Initial fetch
  getSessionsByCompany(companyId).then(onUpdate);

  const channel: RealtimeChannel = supabase
    .channel(`sessions:${companyId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: COLLECTIONS.SESSIONS,
      filter: `companyId=eq.${companyId}`,
    }, () => {
      getSessionsByCompany(companyId).then(onUpdate);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ==========================================
// ASSESSMENT INVITES
// ==========================================

export const blastAssessmentInvites = async (
  companyId: string,
  candidates: Array<{ name: string; email: string; whatsapp?: string }>,
  assessmentConfig?: any
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const now = new Date().toISOString();
      const invite = {
        companyId,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidateWhatsapp: candidate.whatsapp || '',
        status: 'sent',
        createdAt: now,
        updatedAt: now,
        assessmentConfig: assessmentConfig || {},
        inviteLink: `${window.location.origin}/assessment?company=${companyId}&email=${encodeURIComponent(candidate.email)}`,
      };

      const { error } = await supabase.from(COLLECTIONS.INVITES).insert(invite);
      if (error) throw error;

      console.warn('[EMAIL] sendEmailViaCloudFunction: Cloud Functions removed. Invite email not sent.');
      success++;
    } catch (e) {
      console.error('[INVITES] Error creating invite:', e);
      failed++;
    }
  }

  return { success, failed };
};

export const resendCandidateInvite = async (inviteId: string): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.INVITES)
    .update({ updatedAt: new Date().toISOString(), status: 'resent' })
    .eq('id', inviteId);
  if (error) throw error;
  console.warn('[INVITES] resendCandidateInvite: Cloud Functions removed. Email not sent.');
};

export const deleteCandidateInvite = async (inviteId: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.INVITES).delete().eq('id', inviteId);
  if (error) throw error;
};

export const sendIntegrityTestInvitation = async (
  sessionId: string,
  candidateEmail: string,
  candidateName: string,
  companyId: string
): Promise<void> => {
  console.warn('[INVITES] sendIntegrityTestInvitation: Cloud Functions removed. Email not sent.');
  await updateSession(sessionId, { status: 'invited' as any });
};

export const subscribeToInvites = (
  companyId: string,
  onUpdate: (data: AssessmentInvite[]) => void
): (() => void) => {
  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from(COLLECTIONS.INVITES)
      .select('*')
      .eq('companyId', companyId)
      .order('createdAt', { ascending: false })
      .limit(100);
    if (!error) onUpdate((data || []) as AssessmentInvite[]);
  };

  fetchInvites();

  const channel: RealtimeChannel = supabase
    .channel(`invites:${companyId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: COLLECTIONS.INVITES,
      filter: `companyId=eq.${companyId}`,
    }, fetchInvites)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ==========================================
// STORAGE: COMPANY LOGO
// ==========================================

export const uploadCompanyLogo = async (companyId: string, file: File): Promise<string> => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Format file tidak valid. Gunakan PNG atau JPG.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`Ukuran file terlalu besar. Maksimal 5MB.`);
  }

  const fileExt = file.name.split('.').pop() || 'png';
  const storagePath = `logos/${companyId}/logo.${fileExt}`;

  const { error } = await supabase.storage
    .from('company-assets')
    .upload(storagePath, file, { upsert: true });

  if (error) throw new Error(`Gagal upload logo: ${error.message}`);

  const { data } = supabase.storage.from('company-assets').getPublicUrl(storagePath);
  return data.publicUrl;
};

export const deleteCompanyLogo = async (companyId: string): Promise<void> => {
  const extensions = ['png', 'jpg', 'jpeg'];
  for (const ext of extensions) {
    await supabase.storage.from('company-assets').remove([`logos/${companyId}/logo.${ext}`]);
  }
};

// ==========================================
// STORAGE: CV UPLOAD
// ==========================================

export const uploadCV = async (applicationId: string, file: File): Promise<string> => {
  const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
  ];

  if (!validTypes.includes(file.type)) {
    throw new Error('Format file tidak valid. Gunakan PDF, DOC, DOCX, TXT, atau gambar.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file terlalu besar. Maksimal 5MB.');
  }

  const storagePath = `cvs/${applicationId}/${file.name}`;
  const { error } = await supabase.storage
    .from('candidate-documents')
    .upload(storagePath, file, { upsert: true });

  if (error) throw new Error(`Gagal upload dokumen: ${error.message}`);

  const { data } = supabase.storage.from('candidate-documents').getPublicUrl(storagePath);
  return data.publicUrl;
};

// ==========================================
// CLOUD FUNCTIONS STUBS
// ==========================================

export const parseCVWithMistral = async (cvUrl: string, sessionId: string): Promise<any> => {
  console.warn('[DOC-PARSE] parseCVWithMistral: Cloud Functions removed. CV parsing not available.');
  return null;
};

export const initiateBackgroundCheck = async (candidateId: string, candidateName: string): Promise<string> => {
  console.warn('[DIDIT] initiateBackgroundCheck: Cloud Functions removed.');
  throw new Error('Background check service not available');
};

// ==========================================
// JOBS
// ==========================================

export const createJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'datePosted' | 'applicantsCount'>): Promise<string> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(COLLECTIONS.JOBS)
    .insert({
      ...jobData,
      datePosted: now,
      applicantsCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.JOBS)
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
};

export const deleteJob = async (jobId: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.JOBS).delete().eq('id', jobId);
  if (error) throw error;
};

export const getJobsByCompany = async (companyId: string): Promise<Job[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.JOBS)
    .select('*')
    .eq('companyId', companyId)
    .order('datePosted', { ascending: false });
  if (error) {
    console.error('[JOBS] Error fetching jobs:', error);
    return [];
  }
  return (data || []) as Job[];
};

export const getJobBySlug = async (companyId: string, jobSlug: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.JOBS)
    .select('*')
    .eq('companyId', companyId)
    .eq('slug', jobSlug)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Job;
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
// APPLICATIONS
// ==========================================

export const createApplication = async (applicationData: Omit<JobApplication, 'id' | 'createdAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(COLLECTIONS.APPLICATIONS)
    .insert({ ...applicationData, createdAt: now })
    .select('id')
    .single();
  if (error) throw error;

  const appId = data.id;

  // Increment applicants count
  const { data: jobData } = await supabase
    .from(COLLECTIONS.JOBS)
    .select('applicantsCount, enableInstantAssessment, workflowId')
    .eq('id', applicationData.jobId)
    .single();

  let enableInstantAssessment = false;
  if (jobData) {
    enableInstantAssessment = jobData.enableInstantAssessment || false;
    await supabase
      .from(COLLECTIONS.JOBS)
      .update({ applicantsCount: (jobData.applicantsCount || 0) + 1 })
      .eq('id', applicationData.jobId);
  }

  const sessionId = await createInterviewSessionFromApplication(appId, applicationData, enableInstantAssessment);
  await supabase.from(COLLECTIONS.APPLICATIONS).update({ sessionId }).eq('id', appId);

  return appId;
};

export const createInterviewSessionFromApplication = async (
  applicationId: string,
  applicationData: Omit<JobApplication, 'id' | 'createdAt'>,
  enableInstantAssessment: boolean = false
): Promise<string> => {
  const now = new Date().toISOString();
  const sessionStatus = enableInstantAssessment ? 'active' : 'pending_review';
  const screeningNote = enableInstantAssessment
    ? 'Kandidat akan langsung mengikuti instant assessment'
    : 'Menunggu review HR';

  let workflowSteps: any[] = [];
  let workflowId: string | undefined;

  if (applicationData.jobId) {
    const { data: jobDoc } = await supabase
      .from(COLLECTIONS.JOBS)
      .select('workflowId')
      .eq('id', applicationData.jobId)
      .single();

    if (jobDoc?.workflowId) {
      workflowId = jobDoc.workflowId;
      const { data: wfDoc } = await supabase
        .from(COLLECTIONS.WORKFLOWS)
        .select('steps')
        .eq('id', workflowId)
        .single();
      if (wfDoc) workflowSteps = wfDoc.steps || [];
    }
  }

  const timeline: any[] = [
    { stage: 'applied', status: 'completed', date: now, note: 'Kandidat melamar via Job Portal' },
    { stage: 'cv_uploaded', status: 'completed', date: now, note: 'CV berhasil diunggah' },
  ];

  if (workflowSteps.length > 0) {
    const sortedSteps = [...workflowSteps].sort((a, b) => a.order - b.order);
    sortedSteps.forEach((step, index) => {
      timeline.push({
        stage: step.id,
        status: index === 0 ? 'current' : 'pending',
        date: now,
        note: step.description,
        credits: step.credits,
        isMandatory: step.isMandatory,
      });
    });
  } else {
    timeline.push({ stage: 'screening', status: 'current', date: now, note: screeningNote });
  }

  const session = {
    candidate: { id: applicationId, name: applicationData.fullName, email: applicationData.email, role: 'Applicant' },
    date: now,
    status: sessionStatus,
    recruitmentStage: 'applied',
    transcript: [{ speaker: 'ai', text: `Aplikasi diterima dari ${applicationData.fullName} via Job Portal. CV: ${applicationData.cvUrl}` }],
    timeline,
    companyId: applicationData.companyId,
    source: 'job_application',
    jobId: applicationData.jobId,
    applicationId,
    cvUrl: applicationData.cvUrl,
    whatsapp: applicationData.whatsapp,
    workflowId: workflowId || null,
  };

  const { data, error } = await supabase.from(COLLECTIONS.SESSIONS).insert(session).select('id').single();
  if (error) throw error;

  console.warn('[SESSIONS] sendCandidateWelcomeEmail: Cloud Functions removed. Welcome email not sent.');

  if (applicationData.cvUrl) {
    parseCVWithMistral(applicationData.cvUrl, data.id).catch(() => {});
  }

  return data.id;
};

// ==========================================
// WORKFLOWS
// ==========================================

export const createWorkflow = async (workflowData: Omit<Workflow, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.WORKFLOWS)
    .insert(workflowData)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const getWorkflowsByCompany = async (companyId: string): Promise<Workflow[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.WORKFLOWS)
    .select('*')
    .eq('companyId', companyId)
    .order('createdAt', { ascending: false });
  if (error) {
    console.error('[WORKFLOWS] Error fetching workflows:', error);
    return [];
  }
  return (data || []) as Workflow[];
};

export const updateWorkflow = async (workflowId: string, updates: Partial<Workflow>): Promise<void> => {
  const { error } = await supabase
    .from(COLLECTIONS.WORKFLOWS)
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', workflowId);
  if (error) throw error;
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  const { error } = await supabase.from(COLLECTIONS.WORKFLOWS).delete().eq('id', workflowId);
  if (error) throw error;
};

// ==========================================
// LEGACY ALIASES
// ==========================================
export const updateSessionInDB = updateSession;
export const saveSessionToDB = createInterviewSession;

// ==========================================
// ADDITIONAL FUNCTIONS (from firebase.ts)
// ==========================================

export const observeAuthState = (callback: (user: UserProfile | null) => void): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      try {
        const { data } = await supabase
          .from(COLLECTIONS.USERS)
          .select('*')
          .eq('email', session.user.email)
          .single();
        if (data) {
          callback({ ...data, id: session.user.id, emailVerified: !!session.user.email_confirmed_at } as UserProfile);
        } else {
          callback(null);
        }
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
  return () => subscription.unsubscribe();
};

export const seedRealDatabase = async () => {
  console.log('[SEED] Skipping seed - using production Supabase data');
};

export const resetConnectionState = () => {
  console.log('[SUPABASE] Reconnecting...');
};

export const signUpWithFirebase = async (userData: {
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<UserProfile> => {
  const { data, error } = await supabase.auth.signUp({ email: userData.email, password: userData.password });
  if (error) throw error;
  const userId = data.user!.id;

  const now = new Date().toISOString();
  const companyData = {
    name: userData.companyName,
    tier: 'Freemium',
    status: 'Active',
    adminEmail: userData.email,
    joinedDate: now,
    usersCount: 1,
    credits: 1000,
    verification_credits: 100,
    createdAt: now,
  };
  const { data: company } = await supabase.from(COLLECTIONS.COMPANIES).insert(companyData).select('id').single();
  const companyId = company?.id || `temp-${userId}`;

  const userProfile: UserProfile = {
    id: userId,
    name: userData.fullName,
    email: userData.email,
    phone: userData.phone,
    role: 'Company Admin',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
    companyId,
    emailVerified: false,
    createdAt: now,
  };

  await supabase.from(COLLECTIONS.USERS).insert(userProfile);
  return userProfile;
};

export const getCompanyBySlug = async (slug: string): Promise<CompanyProfile | null> => {
  // 1. Try by companySlug field
  const { data: bySlug } = await supabase
    .from(COLLECTIONS.COMPANIES).select('*').eq('companySlug', slug).single();
  if (bySlug) return bySlug as CompanyProfile;

  // 2. Try by ID
  const { data: byId } = await supabase
    .from(COLLECTIONS.COMPANIES).select('*').eq('id', slug).single();
  if (byId) return byId as CompanyProfile;

  // 3. Try by name slug
  const { data: allCompanies } = await supabase.from(COLLECTIONS.COMPANIES).select('*');
  const match = (allCompanies || []).find((c: any) => {
    const nameSlug = (c.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return nameSlug === slug.toLowerCase();
  });
  return match ? match as CompanyProfile : null;
};

export const sendAssessmentCompleteEmail = async (
  candidateName: string,
  candidateEmail: string,
  companyName: string
): Promise<boolean> => {
  console.warn('[EMAIL] sendAssessmentCompleteEmail: Cloud Functions removed. Email not sent.');
  return false;
};

export const verifyAccessCode = async (code: string): Promise<AssessmentInvite | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.INVITES)
    .select('*')
    .eq('access_code', code)
    .single();
  if (error) return null;
  return data as AssessmentInvite;
};

export const markAccessCodeUsed = async (code: string, status: string, sessionId?: string): Promise<void> => {
  const updates: any = { status, updatedAt: new Date().toISOString() };
  if (sessionId) updates.sessionId = sessionId;
  await supabase.from(COLLECTIONS.INVITES).update(updates).eq('access_code', code);
};
