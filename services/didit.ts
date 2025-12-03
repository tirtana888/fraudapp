import { doc, updateDoc } from 'firebase/firestore';
import { db, COLLECTIONS, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

const DIDIT_API_BASE = 'https://verification.didit.me/v2';
const DIDIT_FLOW_ID = import.meta.env.VITE_DIDIT_FLOW_ID;
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
  console.log('[DIDIT] Creating background check session via Firebase Function for:', { sessionId, candidateName, candidateEmail });

  try {
    const createDiditSession = httpsCallable(functions, 'createDiditSession');

    const result = await createDiditSession({
      sessionId,
      candidateName,
      candidateEmail
    });

    const data = result.data as { success: boolean; sessionUrl: string; sessionId: string };

    console.log('[DIDIT] Session created successfully via Firebase:', data);

    const verificationSession: DiditVerificationSession = {
      verificationSessionId: data.sessionId,
      verification_url: data.sessionUrl,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
      backgroundCheck: verificationSession,
      backgroundCheckStatus: 'pending',
      backgroundCheckInitiatedAt: new Date().toISOString()
    });

    console.log('[DIDIT] Session data saved to Firestore');

    return verificationSession;
  } catch (error) {
    console.error('[DIDIT] Error creating session:', error);
    throw error;
  }
};

export const getVerificationSession = async (verificationSessionId: string) => {
  console.log('[DIDIT] Fetching verification session:', verificationSessionId);

  try {
    const response = await fetch(`${DIDIT_API_BASE}/session/${verificationSessionId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': DIDIT_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DIDIT] API Error:', response.status, errorText);
      throw new Error(`Didit API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[DIDIT] Session fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('[DIDIT] Error fetching session:', error);
    throw error;
  }
};

export const handleBackgroundCheckCallback = async (
  verificationSessionId: string,
  status: string,
  sessionId: string
) => {
  console.log('[DIDIT] Processing callback:', { verificationSessionId, status, sessionId });

  try {
    let mappedStatus: 'pending' | 'approved' | 'declined' | 'in_review' = 'in_review';

    if (status.toLowerCase() === 'approved') {
      mappedStatus = 'approved';
    } else if (status.toLowerCase() === 'declined') {
      mappedStatus = 'declined';
    }

    await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
      'backgroundCheck.status': mappedStatus,
      backgroundCheckStatus: mappedStatus,
      backgroundCheckCompletedAt: new Date().toISOString()
    });

    console.log('[DIDIT] Callback processed successfully');
    return { success: true, status: mappedStatus };
  } catch (error) {
    console.error('[DIDIT] Error processing callback:', error);
    throw error;
  }
};

export const openBackgroundCheckWindow = (verificationUrl: string) => {
  const width = 800;
  const height = 900;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  window.open(
    verificationUrl,
    'DiditBackgroundCheck',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  );
};
