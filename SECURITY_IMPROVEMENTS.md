# Security Improvements & Recommendations

## Current Security Status

### ✅ Implemented (Current Release)
1. Session encryption (Base64)
2. Session expiry (24 hours)
3. Auto session cleanup
4. Secure logout mechanism
5. Session validation on restore

### ⚠️ Critical Issues (Need Immediate Fix)
1. Plaintext passwords in database
2. No password hashing
3. API keys exposed in frontend
4. No rate limiting
5. No CSRF protection

### 🔄 Recommended Improvements
1. Migrate to Firebase Authentication
2. Implement password hashing (bcrypt)
3. Move API keys to backend
4. Add rate limiting
5. Implement 2FA
6. Add audit logging

---

## Priority 1: Password Security

### Problem
```typescript
// services/firebase.ts:175
if (userData.password?.trim() !== cleanPass) {
  throw new Error("Kata sandi salah.");
}
```
Password stored as plaintext in Firestore!

### Solution: Implement Password Hashing

#### Step 1: Install bcrypt
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

#### Step 2: Update Registration Function
```typescript
import bcrypt from 'bcryptjs';

export const registerUser = async (email: string, password: string) => {
  // Hash password before storing
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Store hash, not plaintext
  await addDoc(collection(db, COLLECTIONS.USERS), {
    email,
    passwordHash,  // NOT password!
    createdAt: new Date().toISOString()
  });
};
```

#### Step 3: Update Login Function
```typescript
export const loginWithFirestore = async (email: string, password: string) => {
  const q = query(usersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("User not found");
  }

  const userData = querySnapshot.docs[0].data();

  // Compare password with hash
  const isValid = await bcrypt.compare(password, userData.passwordHash);

  if (!isValid) {
    throw new Error("Invalid password");
  }

  return userData;
};
```

#### Step 4: Data Migration
```typescript
// One-time migration script
export const migratePasswordsToHash = async () => {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const snapshot = await getDocs(usersRef);

  for (const doc of snapshot.docs) {
    const userData = doc.data();

    if (userData.password && !userData.passwordHash) {
      const hash = await bcrypt.hash(userData.password, 10);

      await updateDoc(doc.ref, {
        passwordHash: hash,
        password: deleteField()  // Remove plaintext
      });

      console.log(`Migrated user: ${userData.email}`);
    }
  }
};
```

---

## Priority 2: API Key Security

### Problem
```typescript
// services/didit.ts
const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY;
```
API keys exposed in frontend code!

### Solution: Already Fixed!
Didit API calls sudah dipindahkan ke Firebase Cloud Function:
- ✅ API key di server-side
- ✅ Not exposed to client
- ✅ CORS handled properly

### Additional API Keys to Secure:
```typescript
// services/genai.ts
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
```

**Fix:** Move Gemini calls to Cloud Function
```typescript
// functions/index.js
exports.analyzeWithGemini = onCall({ region: "europe-west1" }, async (request) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;  // Server-side
  // ... analysis logic
});
```

---

## Priority 3: Authentication Best Practices

### Migrate to Firebase Authentication

#### Why?
- Industry-standard security
- Built-in password hashing
- Session management
- Multi-factor authentication
- OAuth providers
- Email verification
- Password reset

#### Migration Steps:

**1. Enable Firebase Auth**
```bash
# Firebase Console
Authentication > Get Started > Email/Password
```

**2. Update Login Logic**
```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth(app);

export const login = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error('Login failed');
  }
};
```

**3. Auth State Listener**
```typescript
// App.tsx
useEffect(() => {
  const auth = getAuth();
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
    setIsCheckingAuth(false);
  });

  return () => unsubscribe();
}, []);
```

**4. Update Security Rules**
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Priority 4: Rate Limiting

### Problem
No protection against brute force attacks on login.

### Solution: Implement Rate Limiting

#### Option 1: Cloud Function Rate Limiting
```typescript
// functions/index.js
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

exports.secureLogin = onCall({ region: "europe-west1" }, async (request) => {
  const { email, password } = request.data;
  const clientIP = request.rawRequest.ip;

  // Check rate limit
  const attempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };

  if (attempts.count >= MAX_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_TIME) {
      throw new HttpsError('resource-exhausted', 'Too many login attempts. Try again in 15 minutes.');
    } else {
      loginAttempts.delete(clientIP);
    }
  }

  // Attempt login
  try {
    const user = await loginWithFirestore(email, password);
    loginAttempts.delete(clientIP); // Reset on success
    return user;
  } catch (error) {
    // Increment failed attempts
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(clientIP, attempts);
    throw error;
  }
});
```

#### Option 2: Firestore Rate Limiting
```typescript
// Track failed attempts in Firestore
export const trackLoginAttempt = async (email: string, success: boolean) => {
  const attemptRef = doc(db, 'login_attempts', email);

  if (success) {
    await deleteDoc(attemptRef);
  } else {
    const data = (await getDoc(attemptRef)).data() || { count: 0, lastAttempt: 0 };
    await setDoc(attemptRef, {
      count: data.count + 1,
      lastAttempt: Date.now()
    });
  }
};

export const isAccountLocked = async (email: string): Promise<boolean> => {
  const attemptRef = doc(db, 'login_attempts', email);
  const data = (await getDoc(attemptRef)).data();

  if (!data) return false;

  const timeSince = Date.now() - data.lastAttempt;
  const isLocked = data.count >= 5 && timeSince < 15 * 60 * 1000;

  return isLocked;
};
```

---

## Priority 5: CSRF Protection

### Problem
No CSRF token validation for state-changing operations.

### Solution: Implement CSRF Tokens

```typescript
// Generate CSRF token on login
export const generateCSRFToken = (): string => {
  return crypto.randomUUID();
};

// Store in session
const handleLogin = (user: UserProfile) => {
  const csrfToken = generateCSRFToken();
  saveSession({ ...user, csrfToken });
  setCurrentUser(user);
};

// Validate on sensitive operations
export const validateCSRF = (token: string): boolean => {
  const session = getSession();
  return session?.csrfToken === token;
};

// Add to requests
const makeSecureRequest = async (data: any) => {
  const session = getSession();

  await fetch('/api/sensitive-operation', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': session.csrfToken
    },
    body: JSON.stringify(data)
  });
};
```

---

## Priority 6: XSS Prevention

### Current Risk
User-generated content bisa contain malicious scripts.

### Solution: Content Sanitization

```typescript
import DOMPurify from 'dompurify';

// Sanitize before rendering
export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty);
};

// Use in components
const SafeContent = ({ html }: { html: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }} />;
};
```

---

## Priority 7: Audit Logging

### Track Security Events

```typescript
// services/auditLog.ts
export const logSecurityEvent = async (event: {
  type: 'login' | 'logout' | 'failed_login' | 'password_reset';
  userId?: string;
  email: string;
  ip?: string;
  userAgent?: string;
}) => {
  await addDoc(collection(db, 'audit_logs'), {
    ...event,
    timestamp: new Date().toISOString()
  });
};

// Usage
const handleLogin = async (email: string, password: string) => {
  try {
    const user = await loginWithFirestore(email, password);
    await logSecurityEvent({
      type: 'login',
      userId: user.id,
      email: user.email
    });
    return user;
  } catch (error) {
    await logSecurityEvent({
      type: 'failed_login',
      email
    });
    throw error;
  }
};
```

---

## Priority 8: Two-Factor Authentication

### Implementation Guide

```typescript
// Generate TOTP secret
import speakeasy from 'speakeasy';

export const enable2FA = async (userId: string) => {
  const secret = speakeasy.generateSecret({ length: 20 });

  await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
    totpSecret: secret.base32,
    twoFactorEnabled: true
  });

  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
};

export const verify2FA = (token: string, secret: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token
  });
};

// Update login flow
export const loginWith2FA = async (email: string, password: string, totpToken?: string) => {
  const user = await loginWithFirestore(email, password);

  if (user.twoFactorEnabled) {
    if (!totpToken) {
      throw new Error('2FA_REQUIRED');
    }

    const isValid = verify2FA(totpToken, user.totpSecret);
    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }
  }

  return user;
};
```

---

## Security Checklist

### Authentication
- [ ] Migrate to Firebase Auth
- [ ] Implement password hashing (bcrypt)
- [ ] Add rate limiting (5 attempts / 15 min)
- [ ] Add account lockout mechanism
- [ ] Implement 2FA
- [ ] Add email verification
- [ ] Secure password reset flow

### Session Management
- [x] Session encryption
- [x] Session expiry
- [ ] Refresh token mechanism
- [ ] Session revocation
- [ ] Device management
- [ ] Activity monitoring

### API Security
- [x] Move API keys to backend (Didit)
- [ ] Move Gemini API to backend
- [ ] Add request validation
- [ ] Implement rate limiting
- [ ] Add CORS configuration
- [ ] API key rotation policy

### Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Implement field-level encryption
- [ ] Add data retention policy
- [ ] Implement data backup
- [ ] Add audit logging
- [ ] GDPR compliance

### Frontend Security
- [ ] Content Security Policy (CSP)
- [ ] XSS prevention (sanitize inputs)
- [ ] CSRF protection
- [ ] Secure cookies
- [ ] Input validation
- [ ] Output encoding

### Infrastructure
- [ ] HTTPS enforcement
- [ ] Security headers (HSTS, X-Frame-Options)
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection
- [ ] Regular security audits
- [ ] Penetration testing

---

## Quick Wins (Implement First)

### 1. Environment Variables Security
```bash
# .env (NEVER commit!)
VITE_GEMINI_API_KEY=xxx
DIDIT_API_KEY=xxx
DIDIT_WEBHOOK_SECRET=xxx

# Add to .gitignore
.env
.env.local
.env.production
```

### 2. Security Headers
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  }
});
```

### 3. Input Validation
```typescript
// Validate all user inputs
export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};
```

---

## Resources & References

### Security Standards
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Firebase Security: https://firebase.google.com/docs/rules
- bcrypt.js: https://github.com/dcodeIO/bcrypt.js

### Tools
- Security Headers: https://securityheaders.com/
- SSL Test: https://www.ssllabs.com/ssltest/
- OWASP ZAP: https://www.zaproxy.org/

### Best Practices
- Never store passwords in plaintext
- Always use HTTPS in production
- Implement proper session management
- Validate and sanitize all inputs
- Use parameterized queries
- Keep dependencies updated
- Regular security audits
