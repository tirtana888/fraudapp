import { supabase, toSnakeCaseRow } from './supabase';

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
  const callbackUrl = `${window.location.origin}/?bgcb=1`;
  const resp = await fetch('/api/didit/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, candidateName, candidateEmail, callbackUrl }),
  });
  const data = await resp.json();
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Gagal membuat sesi Didit (HTTP ${resp.status})`);
  }
  return {
    verificationSessionId: data.verificationSessionId,
    verification_url: data.verification_url,
    status: data.status || 'pending',
    createdAt: new Date().toISOString(),
  };
};

export const getVerificationSession = async (
  verificationSessionId: string
): Promise<DiditSessionResponse> => {
  const resp = await fetch(`/api/didit/session/${encodeURIComponent(verificationSessionId)}`, {
    method: 'GET',
  });
  const data = await resp.json();
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Gagal mengambil sesi Didit (HTTP ${resp.status})`);
  }
  const d = data.data || {};
  return {
    id: d.session_id || d.id || verificationSessionId,
    url: d.url || '',
    status: d.status || 'pending',
    workflow_id: d.workflow_id || '',
    vendor_data: d.vendor_data || '',
    created_at: d.created_at || new Date().toISOString(),
  };
};

export const handleBackgroundCheckCallback = async (
  verificationSessionId: string,
  status: string,
  sessionId: string
) => {
  const actualSessionId = sessionId;
  if (!actualSessionId) {
    console.warn('[DIDIT] handleBackgroundCheckCallback: missing sessionId');
    return { success: false, status: 'pending' as const };
  }

  let mappedStatus: 'pending' | 'approved' | 'declined' | 'in_review' = 'in_review';
  const s = (status || '').toLowerCase();
  if (s === 'approved') mappedStatus = 'approved';
  else if (s === 'declined' || s === 'rejected') mappedStatus = 'declined';

  // Refresh from Didit (best-effort) so the local view has latest decision data
  try {
    if (verificationSessionId) await getVerificationSession(verificationSessionId);
  } catch (err) {
    console.warn('[DIDIT] refresh after callback failed:', err);
  }

  const { error } = await supabase
    .from('_interview_sessions')
    .update(toSnakeCaseRow({
      backgroundCheck: { status: mappedStatus, diditSessionId: verificationSessionId },
      backgroundCheckStatus: mappedStatus,
      backgroundCheckCompletedAt: new Date().toISOString()
    } as Record<string, unknown>))
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
