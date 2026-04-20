import { supabase } from './supabase';

export interface ReferenceCheckResponse {
  id: string;
  prevCompanyName: string;
  prevRole: string | null;
  prevPeriod: string | null;
  prevHrName: string | null;
  prevHrPhone: string;
  twilioMessageSid: string | null;
  sentAt: string | null;
  status: 'pending' | 'confirmed' | 'denied' | 'no_response';
  responseText: string | null;
  respondedAt: string | null;
  resendCount: number;
  lastResendAt: string | null;
  createdAt: string;
}

export interface ReferenceCheckRequest {
  id: string;
  sessionId: string;
  candidateId: string | null;
  companyId: string | null;
  requestToken: string;
  status: 'pending' | 'submitted' | 'expired' | 'cancelled';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  responses: ReferenceCheckResponse[];
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesi tidak aktif — silakan login ulang');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function createReferenceRequest(args: {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  companyName?: string;
  forceNew?: boolean;
}): Promise<{ requestId: string; requestToken: string; formLink: string; emailSent: boolean; waSent: boolean }> {
  const headers = await getAuthHeader();
  const r = await fetch('/api/reference/create-request', {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal membuat permintaan referensi');
  return json;
}

// Convenience wrapper for the "Tambah Referensi" flow — issues a fresh form
// even when a previous request is already submitted.
export async function requestAdditionalReferences(args: {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  companyName?: string;
}) {
  return createReferenceRequest({ ...args, forceNew: true });
}

export async function listReferenceRequests(sessionId: string): Promise<ReferenceCheckRequest[]> {
  const headers = await getAuthHeader();
  const r = await fetch(`/api/reference/by-session/${encodeURIComponent(sessionId)}`, { headers });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengambil data referensi');
  return json.requests as ReferenceCheckRequest[];
}

export async function resendReferenceMessage(requestId: string, responseId: string): Promise<void> {
  const headers = await getAuthHeader();
  const r = await fetch(`/api/reference/${requestId}/resend/${responseId}`, {
    method: 'POST',
    headers,
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengirim ulang');
}

// ── Public (no auth) endpoints used by the candidate-facing form ─────────────

export async function fetchReferenceForm(token: string): Promise<{
  candidateName: string;
  candidateRole: string;
  companyName: string;
  status: string;
}> {
  const r = await fetch(`/api/reference/${encodeURIComponent(token)}`);
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Token tidak valid');
  return json;
}

export async function submitReferenceForm(
  token: string,
  references: Array<{
    prevCompanyName: string;
    prevRole?: string;
    prevPeriod?: string;
    prevHrName?: string;
    prevHrPhone: string;
  }>,
): Promise<{ requestId: string }> {
  const r = await fetch(`/api/reference/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ references }),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengirim form');
  return json;
}

export function refStatusLabel(s: ReferenceCheckResponse['status']): string {
  switch (s) {
    case 'confirmed': return 'TERKONFIRMASI';
    case 'denied': return 'DITOLAK';
    case 'no_response': return 'TIDAK MERESPON';
    default: return 'PENDING';
  }
}

export function refStatusColor(s: ReferenceCheckResponse['status']): string {
  switch (s) {
    case 'confirmed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
    case 'denied': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    case 'no_response': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    default: return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}
