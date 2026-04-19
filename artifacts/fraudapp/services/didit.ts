import { supabase, COLLECTIONS } from './supabase';

export interface DiditVerificationSession {
  verificationSessionId: string;
  verification_url: string;
  status: 'pending' | 'in_progress' | 'approved' | 'declined' | 'in_review';
  createdAt: string;
}

export interface DiditSessionResponse {
  id: string;
  url: string;
  status: string;
  workflow_id: string;
  vendor_data: string;
  created_at: string;
}

export const createBackgroundCheckSession = async (
  _sessionId: string,
  _candidateName: string,
  _candidateEmail: string
): Promise<DiditVerificationSession> => {
  console.warn('[DIDIT] createBackgroundCheckSession: Cloud Functions removed (stubbed). Background check not available.');
  throw new Error('Background check service requires a backend function (not yet migrated).');
};

export const getVerificationSession = async (_verificationSessionId: string): Promise<DiditSessionResponse> => {
  console.warn('[DIDIT] getVerificationSession: Didit API calls require a backend proxy (stubbed).');
  throw new Error('Didit API calls must be made server-side. This function is stubbed until a backend proxy is set up.');
};

export const handleBackgroundCheckCallback = async (
  verificationSessionId: string,
  status: string,
  sessionId: string
) => {
  let actualSessionId = sessionId;
  if (!actualSessionId) {
    console.warn('[DIDIT] handleBackgroundCheckCallback: cannot resolve sessionId without Didit API access (stubbed).');
    throw new Error('Cannot resolve session from Didit callback — API is stubbed.');
  }

  let mappedStatus: 'pending' | 'approved' | 'declined' | 'in_review' = 'in_review';
  if (status.toLowerCase() === 'approved') mappedStatus = 'approved';
  else if (status.toLowerCase() === 'declined') mappedStatus = 'declined';

  const { error } = await supabase
    .from(COLLECTIONS.SESSIONS)
    .update({
      backgroundCheck: { status: mappedStatus },
      backgroundCheckStatus: mappedStatus,
      backgroundCheckCompletedAt: new Date().toISOString()
    })
    .eq('id', actualSessionId);

  if (error) throw error;
  return { success: true, status: mappedStatus };
};

export const openBackgroundCheckWindow = (verificationUrl: string) => {
  const width = 800, height = 900;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  window.open(
    verificationUrl,
    'DiditBackgroundCheck',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  );
};
