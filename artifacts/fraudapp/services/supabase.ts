import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { InterviewSession, AssessmentInvite, CompanyProfile, UserProfile, Job, JobApplication, Workflow, WorkflowStep } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Reuse a single Supabase client across HMR reloads to avoid the
// "Multiple GoTrueClient instances detected" warning, which can lead to
// inconsistent session persistence across page refreshes.
const _globalAny = globalThis as unknown as { __fraudguardSupabase?: SupabaseClient };

export const supabase: SupabaseClient =
  _globalAny.__fraudguardSupabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'fraudguard-auth',
      flowType: 'pkce',
    },
  });

if (typeof window !== 'undefined') {
  _globalAny.__fraudguardSupabase = supabase;
}

// Re-export db alias for compatibility with files importing { db }
export const db = supabase;

// Auth shim — exposes a synchronous `currentUser` property that reads the cached Supabase session.
// Supabase does not have a synchronous currentUser; this shim provides best-effort compatibility.
let _cachedUser: { email: string | null } | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUser = session?.user ? { email: session.user.email ?? null } : null;
});
supabase.auth.getSession().then(({ data }) => {
  _cachedUser = data.session?.user ? { email: data.session.user.email ?? null } : null;
});
export const auth = Object.assign(supabase.auth, {
  get currentUser() { return _cachedUser; },
  // Firebase-compatible alias: auth.onAuthStateChanged(callback) => unsubscribe()
  onAuthStateChanged(callback: (user: { email: string | null } | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? { email: session.user.email ?? null } : null);
    });
    // Fire immediately with current state
    supabase.auth.getSession().then(({ data }) => {
      callback(data.session?.user ? { email: data.session.user.email ?? null } : null);
    });
    return () => subscription.unsubscribe();
  }
});

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
// EMAIL — calls /api/send-email on the API server
// ==========================================
export const sendEmailViaCloudFunction = async (
  emailType: string,
  to_email: string,
  emailData: Record<string, string>
): Promise<boolean> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      console.warn('[EMAIL] No active session — email not sent');
      return false;
    }
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ emailType, to_email, emailData }),
    });
    const json = await resp.json() as { success: boolean; error?: string };
    if (!json.success) {
      console.warn('[EMAIL] send-email endpoint returned failure:', json.error);
    }
    return json.success;
  } catch (err) {
    console.warn('[EMAIL] Failed to reach send-email endpoint:', err);
    return false;
  }
};

export const sendEmailViaPublicEndpoint = async (
  emailType: string,
  to_email: string,
  emailData: Record<string, string>,
  sessionId: string
): Promise<boolean> => {
  try {
    const resp = await fetch('/api/send-email-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailType, to_email, emailData, sessionId }),
    });
    const json = await resp.json() as { success: boolean; error?: string };
    if (!json.success) {
      console.warn('[EMAIL] send-email-public returned failure:', json.error);
    }
    return json.success;
  } catch (err) {
    console.warn('[EMAIL] Failed to reach send-email-public endpoint:', err);
    return false;
  }
};

// ==========================================
// AUTH FUNCTIONS
// ==========================================

export const loginWithFirebase = async (email: string, password: string): Promise<UserProfile> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const supaUser = data.user!;

  // Try to load the persisted user profile; fall back to a minimal UserProfile derived from auth data
  const { data: profileRow } = await supabase.from(COLLECTIONS.USERS).select('*').eq('id', supaUser.id).single();
  if (profileRow) {
    return { ...(profileRow as UserProfile), emailVerified: !!supaUser.email_confirmed_at };
  }

  // Minimal fallback profile (no matching row in users table yet)
  return {
    id: supaUser.id,
    email: supaUser.email || email,
    name: supaUser.user_metadata?.full_name || supaUser.email || email,
    role: 'Company Admin',
    emailVerified: !!supaUser.email_confirmed_at,
    createdAt: supaUser.created_at,
  } as UserProfile;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('No authenticated user found');
  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
  if (error) throw error;
};

export const signInWithGoogle = async (): Promise<UserProfile> => {
  // Google OAuth via Supabase uses a redirect flow — we initiate the redirect here.
  // The actual session is captured after the redirect via observeAuthState in App.tsx.
  // We still call signInWithOAuth but the returned `data` is { provider, url } not a user.
  // Callers that await this expect a UserProfile; we throw so they can handle the redirect.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
  // Redirect is being initiated; the page will reload and observeAuthState will fire.
  // Throwing a special sentinel lets callers (LoginPage) gracefully suppress the error UI.
  throw Object.assign(new Error('google_oauth_redirect'), { isOAuthRedirect: true });
};

// Firebase-compatible auth state observer (fires with Supabase User or null)
export const onAuthStateChanged = (
  callback: (user: { uid?: string; email?: string | null } | null) => void
): (() => void) => {
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

const toSnakeCaseUserRow = (obj: Record<string, unknown>): Record<string, unknown> => {
  const { password: _password, ...rest } = obj;
  return toSnakeCaseRow(rest);
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const payload = toSnakeCaseUserRow(profile as unknown as Record<string, unknown>);
  const { error } = await supabase.from('_users').insert(payload);
  if (error) {
    console.error('[USER] Error creating profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>, email?: string): Promise<void> => {
  const payload = toSnakeCaseUserRow({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  const { error } = await supabase.from('_users').update(payload).eq('id', userId);

  if (error) {
    // Try by email as fallback
    if (email) {
      const { error: emailError } = await supabase
        .from('_users')
        .update(payload)
        .eq('email', email);

      if (emailError) {
        // Upsert fallback: create a minimal profile when the user row does not
        // exist yet.  Admin profiles (role = 'System Admin') must be created
        // via a privileged backend path using the service-role key; they cannot
        // be created through this client-side path because RLS blocks it.
        const newProfile: UserProfile = {
          id: userId,
          email: email,
          createdAt: new Date().toISOString(),
          ...updates,
          name: updates.name || 'User',
          role: updates.role || 'Company Admin',
        };
        const insertPayload = toSnakeCaseUserRow(newProfile as unknown as Record<string, unknown>);
        const { error: insertError } = await supabase.from('_users').insert(insertPayload);
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
  // Authenticated callers: direct table query returns the full CompanyProfile.
  // This is the primary path used by the authenticated app (App.tsx, dashboards).
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('*')
    .eq('id', companyId)
    .single();
  if (!error && data) return data as CompanyProfile;

  // Unauthenticated callers (e.g., public assessment page): the direct query
  // will fail with an RLS error.  Fall back to the get_company_for_public
  // SECURITY DEFINER RPC which returns only public-safe branding fields.
  if (error?.code === 'PGRST301' || error?.message?.includes('permission denied') || !data) {
    const { data: rpcData } = await supabase.rpc('get_company_for_public', { p_company_id: companyId });
    if (!rpcData) return null;
    return rpcData as CompanyProfile;
  }

  console.error('[COMPANY] Error fetching company:', error);
  return null;
};

export const createCompany = async (companyData: Omit<CompanyProfile, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('_companies')
    .insert(toSnakeCaseRow({ ...companyData, createdAt: new Date().toISOString() } as Record<string, unknown>))
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

const camelToSnake = (key: string): string =>
  key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());

export const toSnakeCaseRow = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
};

const toSnakeCaseJobRow = (obj: Record<string, unknown>): Record<string, unknown> => {
  const row = toSnakeCaseRow(obj);
  if ('job_type' in row) {
    row['type'] = row['job_type'];
    delete row['job_type'];
  }
  delete row['applicants_count'];
  return row;
};

const toSnakeCaseApplicationRow = (obj: Record<string, unknown>): Record<string, unknown> => {
  const {
    fullName,
    email,
    whatsapp,
    cvUrl,
    jobId,
    companyId,
    appliedAt,
    sessionId: _sessionId,
    assessmentToken: _assessmentToken,
    createdAt: _createdAt,
    ...rest
  } = obj as Record<string, unknown>;
  return {
    ...toSnakeCaseRow(rest as Record<string, unknown>),
    candidate_name: fullName,
    candidate_email: email,
    candidate_whatsapp: whatsapp,
    cv_url: cvUrl,
    job_id: jobId,
    company_id: companyId,
    ...(appliedAt !== undefined ? { applied_at: appliedAt } : {}),
  };
};

export const updateCompany = async (companyId: string, updates: Partial<CompanyProfile>): Promise<void> => {
  const payload = toSnakeCaseRow({ ...updates, updatedAt: new Date().toISOString() });
  const { error } = await supabase
    .from('_companies')
    .update(payload)
    .eq('id', companyId);
  if (error) {
    console.error('[updateCompany] Supabase error:', error);
    throw error;
  }
};

export const getCompanies = async (): Promise<CompanyProfile[]> => {
  const { data, error } = await supabase.from(COLLECTIONS.COMPANIES).select('*');
  if (error) {
    console.error('[ADMIN] Error fetching companies:', error);
    return [];
  }
  return (data || []) as CompanyProfile[];
};

export const updateCompanySubscription = async (companyId: string, updates: Partial<CompanyProfile>): Promise<void> => {
  const { error } = await supabase
    .from('_companies')
    .update(toSnakeCaseRow(updates))
    .eq('id', companyId);
  if (error) {
    console.error('[updateCompanySubscription] Supabase error:', error);
    throw error;
  }
};

export const deleteCompany = async (companyId: string): Promise<void> => {
  const { error } = await supabase.from('_companies').delete().eq('id', companyId);
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
    const { data, error } = await supabase.from('_companies').insert(toSnakeCaseRow(companyData as Record<string, unknown>)).select('id').single();
    if (error) throw error;
    return { success: true, message: `Company "${payload.name}" berhasil dibuat dengan ID: ${data.id}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal membuat company' };
  }
};

export const resendInviteEmail = async (companyId: string): Promise<{ success: boolean; message: string }> => {
  const company = await getCompanyById(companyId);
  if (!company) return { success: false, message: 'Company tidak ditemukan' };
  const email = company.adminEmail;
  if (!email) return { success: false, message: 'Company tidak memiliki email admin' };

  const inviteLink = `${window.location.origin}/register?company=${companyId}`;
  await sendEmailViaCloudFunction('assessment_invite', email, {
    candidateName: company.name,
    companyName: 'HireGood',
    inviteLink,
  });
  return { success: true, message: `Email undangan berhasil dikirim ke ${email}` };
};

// ==========================================
// INTERVIEW SESSIONS
// ==========================================

export const createInterviewSession = async (sessionData: Omit<InterviewSession, 'id'>): Promise<string> => {
  const payload = toSnakeCaseRow(sessionData as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from('_interview_sessions')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    console.error('[createInterviewSession] Supabase error:', error);
    throw error;
  }
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
  const payload = toSnakeCaseRow({ ...updates, updatedAt: new Date().toISOString() } as unknown as Record<string, unknown>);
  const { error } = await supabase
    .from('_interview_sessions')
    .update(payload)
    .eq('id', sessionId);
  if (error) {
    console.error('[updateSession] Supabase error:', error);
    throw error;
  }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase.from('_interview_sessions').delete().eq('id', sessionId);
  if (error) throw error;
};

export const subscribeToSessions = (
  companyId: string,
  roleOrCallback: string | ((data: InterviewSession[]) => void),
  maybeCallback?: (data: InterviewSession[]) => void
): (() => void) => {
  // Accept both (companyId, onUpdate) and (companyId, role, onUpdate) call signatures
  const onUpdate = typeof roleOrCallback === 'function' ? roleOrCallback : maybeCallback!;
  return _subscribeToSessionsImpl(companyId, onUpdate);
};

const _subscribeToSessionsImpl = (
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
  candidates: Array<{ name: string; email: string; whatsapp?: string }>,
  companyId: string,
  companyName?: string,
  assessmentConfig?: Record<string, unknown>
): Promise<{ success: number; failed: number }> => {
  return _blastAssessmentInvitesImpl(companyId, candidates, companyName, assessmentConfig);
};

const _blastAssessmentInvitesImpl = async (
  companyId: string,
  candidates: Array<{ name: string; email: string; whatsapp?: string }>,
  companyName?: string,
  assessmentConfig?: Record<string, unknown>
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const now = new Date().toISOString();
      const inviteLink = `${window.location.origin}/assessment?company=${companyId}&email=${encodeURIComponent(candidate.email)}`;
      const invite = {
        companyId,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidateWhatsapp: candidate.whatsapp || '',
        status: 'sent',
        createdAt: now,
        updatedAt: now,
        assessmentConfig: assessmentConfig || {},
        inviteLink,
      };

      const { error } = await supabase.from('_assessment_invites').insert(toSnakeCaseRow(invite as Record<string, unknown>));
      if (error) throw error;

      await sendEmailViaCloudFunction('assessment_invite', candidate.email, {
        candidateName: candidate.name,
        companyName: companyName || 'Perusahaan',
        inviteLink,
      });
      success++;
    } catch (e) {
      console.error('[INVITES] Error creating invite:', e);
      failed++;
    }
  }

  return { success, failed };
};

export const resendCandidateInvite = async (inviteId: string, _companyName?: string): Promise<{ success: boolean; message: string }> => {
  const { data: inviteData, error: fetchErr } = await supabase
    .from(COLLECTIONS.INVITES)
    .select('candidateEmail, candidateName, companyId, inviteLink')
    .eq('id', inviteId)
    .single<{ candidateEmail: string; candidateName: string; companyId: string; inviteLink?: string }>();
  if (fetchErr) return { success: false, message: fetchErr.message };

  const { error } = await supabase
    .from('_assessment_invites')
    .update({ updated_at: new Date().toISOString(), status: 'resent' })
    .eq('id', inviteId);
  if (error) return { success: false, message: error.message };

  const companyId = inviteData?.companyId || '';
  const inviteLink = inviteData?.inviteLink ||
    `${window.location.origin}/assessment?company=${companyId}&email=${encodeURIComponent(inviteData?.candidateEmail || '')}`;

  if (inviteData?.candidateEmail) {
    const { data: companyRow } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .select('name')
      .eq('id', companyId)
      .single<{ name: string }>();

    await sendEmailViaCloudFunction('assessment_invite', inviteData.candidateEmail, {
      candidateName: inviteData.candidateName || 'Kandidat',
      companyName: companyRow?.name || 'Perusahaan',
      inviteLink,
    });
  }

  return { success: true, message: 'Undangan berhasil dikirim ulang' };
};

export const deleteCandidateInvite = async (inviteId: string): Promise<{ success: boolean; message: string }> => {
  const { error } = await supabase.from('_assessment_invites').delete().eq('id', inviteId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Undangan berhasil dihapus' };
};

export const sendIntegrityTestInvitation = async (
  sessionId: string,
  candidateEmail: string,
  candidateName: string,
  companyId: string,
  jobTitle?: string
): Promise<void> => {
  await updateSession(sessionId, { status: 'active' });

  const assessmentLink = `${window.location.origin}/assessment?company=${companyId}&session=${sessionId}`;

  const { data: companyRow } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('name')
    .eq('id', companyId)
    .single<{ name: string }>();

  await sendEmailViaCloudFunction('assessment_invite', candidateEmail, {
    candidateName,
    companyName: companyRow?.name || 'Perusahaan',
    inviteLink: assessmentLink,
    roleName: jobTitle || 'posisi yang tersedia',
  });
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
  const payload = toSnakeCaseJobRow({
    ...jobData,
    datePosted: now,
    createdAt: now,
    updatedAt: now,
  } as Record<string, unknown>);
  const { data, error } = await supabase
    .from('_jobs')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    console.error('[createJob] Supabase error:', error);
    throw error;
  }
  return data.id;
};

export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<void> => {
  const payload = toSnakeCaseJobRow({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  const { error } = await supabase
    .from('_jobs')
    .update(payload)
    .eq('id', jobId);
  if (error) {
    console.error('[updateJob] Supabase error:', error);
    throw error;
  }
};

export const deleteJob = async (jobId: string): Promise<void> => {
  const { error } = await supabase.from('_jobs').delete().eq('id', jobId);
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
  const payload = toSnakeCaseApplicationRow({ ...applicationData, appliedAt: applicationData.appliedAt || now } as Record<string, unknown>);
  const { data, error } = await supabase
    .from('_applications')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    console.error('[createApplication] Supabase error:', error);
    throw error;
  }

  const appId = data.id;

  // Read job metadata from the view (reads are fine through views)
  const { data: jobData } = await supabase
    .from(COLLECTIONS.JOBS)
    .select('applicantsCount, enableInstantAssessment, workflowId')
    .eq('id', applicationData.jobId)
    .single();

  const enableInstantAssessment = jobData?.enableInstantAssessment || false;

  await createInterviewSessionFromApplication(appId, applicationData, enableInstantAssessment);

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

  let workflowSteps: WorkflowStep[] = [];
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
        .single<{ steps: WorkflowStep[] }>();
      if (wfDoc) workflowSteps = wfDoc.steps || [];
    }
  }

  const timeline: Array<{ stage: string; status: 'completed' | 'current' | 'pending'; date: string; note: string; credits?: number; isMandatory?: boolean }> = [
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

  const sessionPayload = toSnakeCaseRow(session as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from('_interview_sessions').insert(sessionPayload).select('id').single();
  if (error) {
    console.error('[createInterviewSessionFromApplication] Supabase error:', error);
    throw error;
  }

  const assessmentLink = `${window.location.origin}/assessment?company=${applicationData.companyId}&session=${data.id}`;
  const { data: companyForEmail } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('name')
    .eq('id', applicationData.companyId)
    .single<{ name: string }>();
  sendEmailViaCloudFunction('candidate_welcome', applicationData.email, {
    candidateName: applicationData.fullName,
    companyName: companyForEmail?.name || 'Perusahaan',
    assessmentLink,
  }).catch(() => {});

  if (applicationData.cvUrl) {
    parseCVWithMistral(applicationData.cvUrl, data.id).catch(() => {});
  }

  return data.id;
};

// ==========================================
// WORKFLOWS
// ==========================================

export const createWorkflow = async (workflowData: Omit<Workflow, 'id'>): Promise<string> => {
  const now = new Date().toISOString();
  const payload = toSnakeCaseRow({ ...workflowData, createdAt: now, updatedAt: now });
  const { data, error } = await supabase
    .from('_workflows')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    console.error('[createWorkflow] Supabase error:', error);
    throw error;
  }
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
  const payload = toSnakeCaseRow({ ...updates, updatedAt: new Date().toISOString() });
  const { error } = await supabase
    .from('_workflows')
    .update(payload)
    .eq('id', workflowId);
  if (error) {
    console.error('[updateWorkflow] Supabase error:', error);
    throw error;
  }
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  const { error } = await supabase.from('_workflows').delete().eq('id', workflowId);
  if (error) {
    console.error('[deleteWorkflow] Supabase error:', error);
    throw error;
  }
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
  // Helper: build a minimal profile from the auth user only — used as a safe
  // fallback so that a transient profile-fetch error never signs the user out.
  const minimalProfileFromAuth = (supaUser: any): UserProfile => {
    const fullName: string = supaUser.user_metadata?.full_name || supaUser.email || 'User';
    const avatar: string = supaUser.user_metadata?.avatar_url
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
    return {
      id: supaUser.id,
      email: supaUser.email || '',
      name: fullName,
      role: 'Company Admin',
      avatar,
      emailVerified: !!supaUser.email_confirmed_at,
      createdAt: supaUser.created_at || new Date().toISOString(),
    } as UserProfile;
  };

  const handleSession = async (event: string | null, session: any) => {
    if (!session?.user) {
      // Only treat explicit sign-out / no-session events as logout.
      callback(null);
      return;
    }

    const supaUser = session.user;

    try {
      // Try profile by id
      const { data: existingProfile, error: idErr } = await supabase
        .from(COLLECTIONS.USERS)
        .select('*')
        .eq('id', supaUser.id)
        .maybeSingle();

      if (existingProfile) {
        callback({ ...(existingProfile as UserProfile), emailVerified: !!supaUser.email_confirmed_at });
        return;
      }

      // Try profile by email (migrated records)
      const { data: profileByEmail, error: emailErr } = supaUser.email
        ? await supabase
            .from(COLLECTIONS.USERS)
            .select('*')
            .eq('email', supaUser.email)
            .maybeSingle()
        : { data: null, error: null };

      if (profileByEmail) {
        callback({ ...(profileByEmail as UserProfile), id: supaUser.id, emailVerified: !!supaUser.email_confirmed_at });
        return;
      }

      // If either lookup errored (RLS / network), do NOT try to provision a
      // new company — the user almost certainly already has one. Fall back to
      // a minimal profile so they stay logged in.
      if (idErr || emailErr) {
        console.warn('[AUTH] Profile lookup failed, using minimal auth profile:', idErr || emailErr);
        callback(minimalProfileFromAuth(supaUser));
        return;
      }

      // Genuinely no profile rows found. Only attempt to provision on a fresh
      // sign-in (SIGNED_IN), never on session restore (INITIAL_SESSION /
      // TOKEN_REFRESHED), to avoid logging out existing users when a
      // provisioning attempt would throw.
      if (event !== 'SIGNED_IN') {
        callback(minimalProfileFromAuth(supaUser));
        return;
      }

      const fullName: string = supaUser.user_metadata?.full_name || supaUser.email || 'User';
      const avatar: string = supaUser.user_metadata?.avatar_url
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

      const { data: rpResult, error: rpError } = await supabase.rpc('provision_company', {
        p_company_name: `${fullName}'s Company`,
        p_user_name:    fullName,
        p_user_email:   supaUser.email || '',
        p_user_phone:   null,
        p_user_avatar:  avatar,
      });

      if (rpError) {
        // RPC failed (e.g. "caller already belongs to a company"). Don't sign
        // them out — fall back to the minimal profile.
        console.warn('[AUTH] provision_company failed, using minimal profile:', rpError);
        callback(minimalProfileFromAuth(supaUser));
        return;
      }

      const companyId: string = (rpResult as { companyId: string })?.companyId || `temp-${supaUser.id}`;
      callback({
        ...minimalProfileFromAuth(supaUser),
        companyId,
      });
    } catch (err) {
      // Last-resort safety net: any unexpected throw must not log the user out
      // when we have a valid Supabase session in hand.
      console.error('[AUTH] observeAuthState error (keeping session):', err);
      callback(minimalProfileFromAuth(supaUser));
    }
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    void handleSession(event, session);
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

  // provision_company() is a SECURITY DEFINER RPC that atomically creates the
  // company and user profile in one trusted call.  This prevents arbitrary
  // company_id injection via direct client-side INSERT.
  const { data: rpResult, error: rpError } = await supabase.rpc('provision_company', {
    p_company_name: userData.companyName,
    p_user_name:    userData.fullName,
    p_user_email:   userData.email,
    p_user_phone:   userData.phone,
    p_user_avatar:  `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
  });
  if (rpError) throw rpError;

  const companyId: string = (rpResult as { companyId: string })?.companyId || `temp-${userId}`;
  return {
    id: userId,
    name: userData.fullName,
    email: userData.email,
    role: 'Company Admin',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
    companyId,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };
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
  const match = (allCompanies || []).find((c: CompanyProfile) => {
    const nameSlug = (c.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return nameSlug === slug.toLowerCase();
  });
  return match ? match as CompanyProfile : null;
};

export const sendAssessmentCompleteEmail = async (
  candidateName: string,
  candidateEmail: string,
  companyName: string,
  sessionId?: string
): Promise<boolean> => {
  if (sessionId) {
    return sendEmailViaPublicEndpoint('assessment_complete', candidateEmail, { candidateName, companyName }, sessionId);
  }
  return sendEmailViaCloudFunction('assessment_complete', candidateEmail, {
    candidateName,
    companyName,
  });
};

export const verifyAccessCode = async (code: string): Promise<AssessmentInvite | null> => {
  // Use the verify_access_code SECURITY DEFINER RPC so unauthenticated
  // candidates can look up their invite without a blanket anonymous SELECT
  // policy on _assessment_invites.
  const { data, error } = await supabase.rpc('verify_access_code', { p_code: code });
  if (error || !data) return null;
  return data as AssessmentInvite;
};

export const markAccessCodeUsed = async (
  code: string,
  status: AssessmentInvite['status'],
  sessionId?: string
): Promise<void> => {
  // Use the mark_access_code_used SECURITY DEFINER RPC so unauthenticated
  // candidates can update their specific invite without a blanket anonymous
  // UPDATE policy on _assessment_invites.
  await supabase.rpc('mark_access_code_used', {
    p_code:       code,
    p_status:     status,
    p_session_id: sessionId ?? null,
  });
};
