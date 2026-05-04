import { supabase } from './supabase';
import { API_BASE } from './apiBase';

export interface ReferenceCheckResponse {
  id: string;
  prevCompanyName: string;
  prevRole: string | null;
  prevPeriod: string | null;
  prevHrName: string | null;
  prevHrPhone: string;
  refEmail: string | null;
  twilioMessageSid: string | null;
  sentAt: string | null;
  status: 'pending' | 'confirmed' | 'denied' | 'no_response';
  responseText: string | null;
  respondedAt: string | null;
  resendCount: number;
  lastResendAt: string | null;
  emailSentAt: string | null;
  callStatus: string | null;
  callSid: string | null;
  callTranscript: Array<{ speaker: string; text: string; timestamp: string }> | null;
  callAnalysis: { confirmed: boolean; status: string; reasoning: string } | null;
  callDuration: number | null;
  callRecordingUrl: string | null;
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
  const r = await fetch(`${API_BASE}/api/reference/create-request`, {
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
  const r = await fetch(`${API_BASE}/api/reference/by-session/${encodeURIComponent(sessionId)}`, { headers });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengambil data referensi');
  return json.requests as ReferenceCheckRequest[];
}

export async function resendReferenceMessage(requestId: string, responseId: string): Promise<void> {
  const headers = await getAuthHeader();
  const r = await fetch(`${API_BASE}/api/reference/${requestId}/resend/${responseId}`, {
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
  const r = await fetch(`${API_BASE}/api/reference/${encodeURIComponent(token)}`);
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
  const r = await fetch(`${API_BASE}/api/reference/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ references }),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengirim form');
  return json;
}

// ── Direct WhatsApp to reference (Fitur 1) ──────────────────────────────────

export interface DirectReferenceInput {
  name: string;
  phone: string;
  company: string;
  role?: string;
  period?: string;
  email?: string;
}

export async function sendDirectWhatsapp(args: {
  sessionId: string;
  references: DirectReferenceInput[];
}): Promise<{ requestId: string; results: Array<{ id: string; name: string; ok: boolean; error?: string }> }> {
  const headers = await getAuthHeader();
  const r = await fetch(`${API_BASE}/api/reference/direct-whatsapp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengirim WhatsApp langsung');
  return json;
}

// ── Email reference (Fitur 2) ────────────────────────────────────────────────

export async function sendReferenceEmail(requestId: string, responseId: string): Promise<{ emailId: string }> {
  const headers = await getAuthHeader();
  const r = await fetch(`${API_BASE}/api/reference/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId, responseId }),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal mengirim email referensi');
  return json;
}

// ── AI Voice Call (Fitur 3) ──────────────────────────────────────────────────

export async function initiateAiCall(requestId: string, responseId: string): Promise<{ callSid: string }> {
  const headers = await getAuthHeader();
  const r = await fetch(`${API_BASE}/api/reference/ai-call`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId, responseId }),
  });
  const json = await r.json();
  if (!json.success) throw new Error(json.error || 'Gagal memulai panggilan AI');
  return json;
}

export function callStatusLabel(s: string | null): string {
  switch (s) {
    case 'in_progress': return 'SEDANG BERLANGSUNG';
    case 'completed': return 'SELESAI';
    case 'no_answer': return 'TIDAK DIANGKAT';
    case 'failed': return 'GAGAL';
    default: return '';
  }
}

export function callStatusColor(s: string | null): string {
  switch (s) {
    case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    case 'completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
    case 'no_answer': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    case 'failed': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    default: return '';
  }
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

export function getRecordingProxyUrl(callRecordingUrl: string): string {
  const match = callRecordingUrl.match(/Recordings\/(RE[0-9a-f]{32})/i);
  if (!match) return '';
  return `${API_BASE}/api/reference/recording/${match[1]}`;
}
