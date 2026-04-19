// ============================================================
// FraudGuard Screening — Crypto Utilities
// AES-256-GCM encryption + HMAC-SHA256 signing via Web Crypto API
// ============================================================

/**
 * Generate a random AES-256 key for encrypting reports.
 * The key is derived from extensionToken so server can decrypt.
 */
export async function deriveKey(extensionToken) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(extensionToken),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('FraudGuardScreening_v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM.
 * Returns base64 string of (iv + ciphertext).
 */
export async function encryptData(data, extensionToken) {
  const key = await deriveKey(extensionToken);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Generate HMAC-SHA256 signature for data integrity verification.
 */
export async function generateSignature(data, extensionToken) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(extensionToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(data))
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Generate a unique consent token (UUID v4 format).
 */
export function generateToken() {
  return crypto.randomUUID();
}
