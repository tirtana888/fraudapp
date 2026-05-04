import { supabase } from './supabase';
import { API_BASE } from './apiBase';

export async function requestExtensionToken(
  sessionId: string,
  candidateEmail: string
): Promise<{ token: string; expiresAt: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sesi tidak aktif — silakan login ulang');

  const resp = await fetch(`${API_BASE}/api/extension/generate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, candidateEmail }),
  });

  const json = await resp.json() as { success: boolean; token?: string; expiresAt?: string; error?: string };
  if (!json.success || !json.token) {
    throw new Error(json.error || 'Gagal membuat token');
  }
  return { token: json.token, expiresAt: json.expiresAt! };
}

export function generateExtensionWhatsAppMessage(
  candidateName: string,
  token: string,
  companyName: string
): string {
  return `Halo ${candidateName},

Anda diminta melakukan *Browser Screening* sebagai bagian dari proses seleksi di *${companyName}*.

Langkah-langkah:
1. Install Chrome Extension: *FraudGuard Screening*
   (minta link ke HR)
2. Klik icon extension di browser
3. Masukkan token berikut:

*${token}*

4. Ikuti instruksi di extension (baca dan setujui ketentuan, lalu klik Lanjutkan)

Token berlaku 24 jam. Jika ada pertanyaan, hubungi HR.

Terima kasih,
Tim Rekrutmen ${companyName}`;
}

export function getRiskColor(risk: string): string {
  switch (risk?.toUpperCase()) {
    case 'HIGH': return 'text-red-600 dark:text-red-400';
    case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400';
    default: return 'text-green-600 dark:text-green-400';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    default: return 'bg-gray-400';
  }
}
