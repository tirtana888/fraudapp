import { supabase } from './supabase';
import type { PddiktiVerification } from '../types';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesi tidak aktif — silakan login ulang');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function verifyNim(sessionId: string): Promise<PddiktiVerification> {
  const headers = await getAuthHeader();
  const resp = await fetch('/api/pddikti/verify-nim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId }),
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || 'Gagal memverifikasi NIM');
  return json.verification as PddiktiVerification;
}

export async function selectMatch(
  sessionId: string,
  matchId: string,
): Promise<PddiktiVerification> {
  const headers = await getAuthHeader();
  const resp = await fetch('/api/pddikti/select-match', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, matchId }),
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || 'Gagal memilih data mahasiswa');
  return json.verification as PddiktiVerification;
}

export function pddiktiStatusLabel(
  status: PddiktiVerification['status'],
): string {
  switch (status) {
    case 'verified':
      return 'TERVERIFIKASI';
    case 'not_found':
      return 'TIDAK DITEMUKAN';
    case 'multiple_matches':
      return 'PERLU SELEKSI MANUAL';
    case 'pending':
      return 'MENUNGGU';
    case 'error':
      return 'ERROR';
    default:
      return 'BELUM DICEK';
  }
}

export function pddiktiStatusColor(
  status: PddiktiVerification['status'],
): string {
  switch (status) {
    case 'verified':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
    case 'not_found':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    case 'multiple_matches':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'pending':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    case 'error':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
  }
}
