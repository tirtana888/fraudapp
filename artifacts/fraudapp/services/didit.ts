import { supabase, COLLECTIONS } from './supabase';

const DIDIT_API_BASE = import.meta.env.VITE_DIDIT_API_BASE || 'https://verification.didit.me/v2';
const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY;

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
  sessionId: string,
  candidateName: string,
  candidateEmail: string
): Promise<DiditVerificationSession> => {
  console.warn('[DIDIT] createBackgroundCheckSession: Cloud Functions removed. Cannot create Didit session server-side.');
  throw new Error('Background check service requires Cloud Functions (not migrated).');
};

export const getVerificationSession = async (verificationSessionId: string) => {
  const response = await fetch(`${DIDIT_API_BASE}/session/${verificationSessionId}`, {
    method: 'GET',
    headers: { 'accept': 'application/json', 'x-api-key': DIDIT_API_KEY }
  });
  if (!response.ok) throw new Error(`Didit API error: ${response.status}`);
  return response.json();
};

export const handleBackgroundCheckCallback = async (
  verificationSessionId: string,
  status: string,
  sessionId: string
) => {
  let actualSessionId = sessionId;
  if (!actualSessionId) {
    const sessionData = await getVerificationSession(verificationSessionId);
    actualSessionId = sessionData.vendor_data;
  }
  if (!actualSessionId) throw new Error('Could not determine session ID from vendor_data');

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
