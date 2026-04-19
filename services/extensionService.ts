import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { GamblingAnalysis, ProctoringData } from '../types';

// ============================================================
// EXTENSION SERVICE — Chrome Extension Integration
// Frontend calls for gambling screening & interview proctoring
// ============================================================

/**
 * Request a new extension token for a candidate.
 * Called by HR from CandidateDetail page.
 * Deducts credits from company balance.
 *
 * @param sessionId  - InterviewSession ID
 * @param candidateEmail - Candidate's email
 * @param type - 'gambling_check' or 'interview_proctor'
 * @returns Token string + expiry
 */
export const requestExtensionToken = async (
  sessionId: string,
  candidateEmail: string,
  type: 'gambling_check' | 'interview_proctor' = 'gambling_check'
): Promise<{ success: boolean; token: string; expiresAt: string; creditCost: number }> => {
  try {
    console.log(`[EXTENSION] Requesting ${type} token for session:`, sessionId);

    const getToken = httpsCallable(functions, 'getExtensionToken');
    const result = await getToken({ sessionId, candidateEmail, type });

    const data = result.data as {
      success: boolean;
      token: string;
      expiresAt: string;
      creditCost: number;
    };

    console.log(`[EXTENSION] ✅ Token generated: ${data.token.substring(0, 8)}...`);
    return data;
  } catch (error: any) {
    console.error('[EXTENSION] Error requesting token:', error);
    throw error;
  }
};

/**
 * Get the gambling analysis data from a session (if available).
 * This data is populated by the Chrome Extension via Cloud Functions.
 *
 * @param sessionData - The full InterviewSession object
 * @returns GamblingAnalysis or null
 */
export const getGamblingAnalysis = (sessionData: any): GamblingAnalysis | null => {
  if (!sessionData?.gamblingAnalysis) return null;
  return sessionData.gamblingAnalysis as GamblingAnalysis;
};

/**
 * Get the proctoring data from a session (if available).
 *
 * @param sessionData - The full InterviewSession object
 * @returns ProctoringData or null
 */
export const getProctoringData = (sessionData: any): ProctoringData | null => {
  if (!sessionData?.proctoringData) return null;
  return sessionData.proctoringData as ProctoringData;
};

/**
 * Generate the Chrome Extension install link with pre-filled token.
 * For now, returns a link to load the unpacked extension locally.
 * When published to Chrome Web Store, this will return the store link.
 */
export const getExtensionInstallUrl = (token: string): string => {
  // TODO: Replace with Chrome Web Store URL when published
  return `chrome-extension://EXTENSION_ID/popup/popup.html?token=${encodeURIComponent(token)}`;
};

/**
 * Generate WhatsApp message with extension install instructions.
 */
export const generateExtensionWhatsAppMessage = (
  candidateName: string,
  token: string,
  companyName: string,
  type: 'gambling_check' | 'interview_proctor' = 'gambling_check'
): string => {
  if (type === 'gambling_check') {
    return `Halo ${candidateName},

Sebagai bagian dari proses rekrutmen di ${companyName}, kami memerlukan Anda untuk menyelesaikan *Browser Screening*.

Langkah-langkah:
1. Install extension FraudGuard Screening di Chrome
2. Klik icon extension
3. Masukkan token berikut: *${token}*
4. Baca dan setujui ketentuan
5. Klik "Setuju & Lanjutkan"

Token ini berlaku selama *24 jam*.

Terima kasih atas partisipasi Anda. 🙏`;
  } else {
    return `Halo ${candidateName},

Pastikan extension *FraudGuard Screening* sudah terinstall di Chrome Anda sebelum memulai assessment.

Extension ini diperlukan untuk memastikan integritas proses assessment. Masukkan token berikut jika diminta: *${token}*

Terima kasih. 🙏`;
  }
};

/**
 * Helper: Get risk level color for UI display
 */
export const getRiskColor = (level: string): string => {
  switch (level?.toUpperCase()) {
    case 'LOW': return '#10b981';    // green
    case 'MEDIUM': return '#f59e0b'; // amber
    case 'HIGH': return '#ef4444';   // red
    default: return '#6b7280';       // gray
  }
};

/**
 * Helper: Get proctoring severity color
 */
export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
};
