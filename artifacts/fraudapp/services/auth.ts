import { UserProfile } from '../types';

const SESSION_KEY = 'fraudguard_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface SessionData {
  user: UserProfile;
  timestamp: number;
  expiresAt: number;
}

const simpleEncrypt = (text: string): string => {
  return btoa(encodeURIComponent(text));
};

const simpleDecrypt = (encoded: string): string => {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return '';
  }
};

export const saveSession = (user: UserProfile): void => {
  const now = Date.now();
  const sessionData: SessionData = {
    user,
    timestamp: now,
    expiresAt: now + SESSION_DURATION
  };

  const encrypted = simpleEncrypt(JSON.stringify(sessionData));
  localStorage.setItem(SESSION_KEY, encrypted);

  console.log('[AUTH] Session saved successfully');
};

export const getSession = (): UserProfile | null => {
  try {
    const encrypted = localStorage.getItem(SESSION_KEY);
    if (!encrypted) {
      console.log('[AUTH] No session found');
      return null;
    }

    const decrypted = simpleDecrypt(encrypted);
    if (!decrypted) {
      console.log('[AUTH] Failed to decrypt session');
      clearSession();
      return null;
    }

    const sessionData: SessionData = JSON.parse(decrypted);

    const now = Date.now();
    if (now > sessionData.expiresAt) {
      console.log('[AUTH] Session expired');
      clearSession();
      return null;
    }

    console.log('[AUTH] Session restored successfully');
    return sessionData.user;
  } catch (error) {
    console.error('[AUTH] Error restoring session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
  console.log('[AUTH] Session cleared');
};

export const isSessionValid = (): boolean => {
  const session = getSession();
  return session !== null;
};

export const refreshSession = (user: UserProfile): void => {
  saveSession(user);
  console.log('[AUTH] Session refreshed');
};
