import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CompanyProfile, UserProfile, AssessmentInvite, InterviewSession } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const COLLECTIONS = {
  SESSIONS: 'interview_sessions',
  USERS: 'users',
  COMPANIES: 'companies',
  INVITES: 'assessment_invites'
};

export const signUp = async (email: string, password: string, metadata: {
  name: string;
  role: string;
  company_id: string;
  avatar: string;
}) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create user');

  const { error: profileError } = await supabase
    .from(COLLECTIONS.USERS)
    .insert({
      id: authData.user.id,
      email,
      name: metadata.name,
      role: metadata.role,
      company_id: metadata.company_id,
      avatar: metadata.avatar
    });

  if (profileError) throw profileError;

  return authData;
};

export const signIn = async (email: string, password: string): Promise<UserProfile> => {
  const cleanEmail = email.trim();
  const cleanPass = password.trim();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPass
  });

  if (authError) {
    if (authError.message.includes('Invalid')) {
      throw new Error('Email atau password salah.');
    }
    throw authError;
  }

  if (!authData.user) throw new Error('Login gagal');

  const { data: userData, error: userError } = await supabase
    .from(COLLECTIONS.USERS)
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!userData) throw new Error('Profil pengguna tidak ditemukan');

  return userData as UserProfile;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async (): Promise<UserProfile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData, error } = await supabase
    .from(COLLECTIONS.USERS)
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return userData as UserProfile | null;
};

export const resetUserPassword = async (email: string) => {
  const cleanEmail = email.trim();

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) throw error;

  return {
    success: true,
    message: `Email reset password telah dikirim ke ${cleanEmail}. Silakan cek inbox Anda.`
  };
};

export const saveSessionToDB = async (sessionData: Partial<InterviewSession>): Promise<string> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .insert(sessionData)
    .select()
    .single();

  if (error) throw error;
  return data.id;
};

export const updateSessionInDB = async (id: string, sessionData: Partial<InterviewSession>) => {
  const { error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .update(sessionData)
    .eq('id', id);

  if (error) throw error;
};

export const subscribeToSessions = (
  companyId: string | undefined,
  role: string,
  onUpdate: (data: InterviewSession[]) => void
) => {
  const fetchData = async () => {
    let query = supabase
      .from(COLLECTIONS.SESSIONS)
      .select('*')
      .order('date', { ascending: false })
      .limit(50);

    if (role !== 'System Admin' && companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data } = await query;
    if (data) onUpdate(data as InterviewSession[]);
  };

  fetchData();

  const subscription = supabase
    .channel('sessions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: COLLECTIONS.SESSIONS
      },
      () => {
        fetchData();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

export const inviteCompanyReal = async (companyData: Omit<CompanyProfile, 'id'>) => {
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);

  const companyPayload = {
    name: companyData.name,
    tier: companyData.tier,
    status: 'Active' as const,
    admin_email: companyData.adminEmail,
    joined_date: companyData.joinedDate || new Date().toISOString(),
    subscription_ends_at: defaultExpiry.toISOString(),
    verification_credits: 0,
    custom_candidate_limit: 0,
    users_count: 1
  };

  const { data: company, error: companyError } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .insert(companyPayload)
    .select()
    .single();

  if (companyError) throw companyError;

  const generatedPassword = Math.random().toString(36).slice(-8) + 'Fg!';

  await signUp(
    companyData.adminEmail,
    generatedPassword,
    {
      name: `Admin ${companyData.name}`,
      role: 'Company Admin',
      company_id: company.id,
      avatar: `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(companyData.name)}`
    }
  );

  return {
    success: true,
    message: `Perusahaan berhasil dibuat. Password: ${generatedPassword} (simpan untuk login pertama kali)`
  };
};

export const updateCompany = async (id: string, data: Partial<CompanyProfile>) => {
  const { error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .update(data)
    .eq('id', id);

  if (error) throw error;
};

export const deleteCompany = async (id: string) => {
  const { error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getCompanies = async (): Promise<CompanyProfile[]> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CompanyProfile[];
};

export const getCompanyById = async (id: string): Promise<CompanyProfile | null> => {
  if (!id) return null;

  const { data, error } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as CompanyProfile | null;
};

export const blastAssessmentInvites = async (
  candidates: { name: string; email: string; role?: string }[],
  companyId: string,
  companyName: string
) => {
  const results = { success: 0, failed: 0 };

  for (const candidate of candidates) {
    try {
      const accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();

      const inviteData = {
        access_code: accessCode,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role || 'Kandidat',
        company_id: companyId,
        status: 'PENDING'
      };

      const { error } = await supabase
        .from(COLLECTIONS.INVITES)
        .insert(inviteData);

      if (error) throw error;

      const assessmentLink = `${window.location.origin}?mode=assess`;

      console.log(`
        📧 Email Invite for ${candidate.name}:
        Company: ${companyName}
        Access Code: ${accessCode}
        Link: ${assessmentLink}
      `);

      results.success++;
    } catch (error) {
      console.error(`Failed to invite ${candidate.email}:`, error);
      results.failed++;
    }
  }

  return results;
};

export const verifyAccessCode = async (code: string): Promise<AssessmentInvite | null> => {
  const { data, error } = await supabase
    .from(COLLECTIONS.INVITES)
    .select('*')
    .eq('access_code', code.toUpperCase().trim())
    .eq('status', 'PENDING')
    .maybeSingle();

  if (error) {
    console.error('Verification error:', error);
    return null;
  }

  return data as AssessmentInvite | null;
};

export const markAccessCodeUsed = async (
  code: string,
  status: 'ACCESSING' | 'IN_PROGRESS' | 'COMPLETED' = 'ACCESSING',
  sessionId?: string
) => {
  const updateData: any = { status };

  if (status === 'ACCESSING') {
    updateData.accessed_at = new Date().toISOString();
  } else if (status === 'IN_PROGRESS') {
    updateData.started_at = new Date().toISOString();
    if (sessionId) updateData.session_id = sessionId;
  } else if (status === 'COMPLETED') {
    updateData.completed_at = new Date().toISOString();
    if (sessionId) updateData.session_id = sessionId;
  }

  const { error } = await supabase
    .from(COLLECTIONS.INVITES)
    .update(updateData)
    .eq('access_code', code.toUpperCase().trim());

  if (error) console.error('Failed to update access code:', error);
};

export const subscribeToInvites = (
  companyId: string,
  onUpdate: (data: AssessmentInvite[]) => void
) => {
  const query = supabase
    .from(COLLECTIONS.INVITES)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  query.then(({ data }) => {
    if (data) onUpdate(data as AssessmentInvite[]);
  });

  const subscription = supabase
    .channel('invites-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: COLLECTIONS.INVITES,
        filter: `company_id=eq.${companyId}`
      },
      () => {
        query.then(({ data }) => {
          if (data) onUpdate(data as AssessmentInvite[]);
        });
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

export const seedRealDatabase = async () => {
  console.log('[Supabase] Checking for initial seed data...');

  const { data: existingCompanies } = await supabase
    .from(COLLECTIONS.COMPANIES)
    .select('id')
    .limit(1);

  if (existingCompanies && existingCompanies.length > 0) {
    console.log('[Supabase] Database already seeded');
    return;
  }

  console.log('[Supabase] Seeding initial data...');

  try {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const { data: systemCompany } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .insert({
        id: 'c83e87d5-8f90-4c5a-9d3b-1a2b3c4d5e6f',
        name: 'System Admin',
        tier: 'Enterprise',
        status: 'Active',
        admin_email: 'admin@fraudguard.id',
        joined_date: new Date().toISOString(),
        subscription_ends_at: new Date(2099, 11, 31).toISOString(),
        custom_candidate_limit: 999999,
        verification_credits: 999999,
        users_count: 1,
        brand_color: '#1e293b'
      })
      .select()
      .single();

    if (systemCompany) {
      await signUp(
        'admin@fraudguard.id',
        'admin123',
        {
          name: 'Super Admin',
          role: 'System Admin',
          company_id: systemCompany.id,
          avatar: 'https://ui-avatars.com/api/?background=0f172a&color=fff&name=Super+Admin'
        }
      );
    }

    const { data: demoCompany } = await supabase
      .from(COLLECTIONS.COMPANIES)
      .insert({
        name: 'PT Maju Bersama',
        tier: 'Enterprise',
        status: 'Active',
        admin_email: 'enterprise@fraudguard.id',
        joined_date: new Date().toISOString(),
        subscription_ends_at: oneYearFromNow.toISOString(),
        custom_candidate_limit: 0,
        verification_credits: 100,
        users_count: 1,
        brand_color: '#CC5500'
      })
      .select()
      .single();

    if (demoCompany) {
      await signUp(
        'enterprise@fraudguard.id',
        'password123',
        {
          name: 'Budi Santoso',
          role: 'Company Admin',
          company_id: demoCompany.id,
          avatar: 'https://ui-avatars.com/api/?background=CC5500&color=fff&name=Budi+Santoso'
        }
      );
    }

    console.log('[Supabase] Database seeded successfully');
  } catch (error) {
    console.error('[Supabase] Seeding error:', error);
  }
};
