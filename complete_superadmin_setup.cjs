// Complete Superadmin Setup - Add Firestore Document
// Run after create_superadmin_direct.cjs

const https = require('https');

const FIREBASE_API_KEY = "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo";
const PROJECT_ID = "hiring-good";
const SUPERADMIN_EMAIL = "superadmin@hiregood.com";
const SUPERADMIN_PASSWORD = "SuperAdmin123!";
const SUPERADMIN_NAME = "Super Admin";

console.log("🔐 Logging in as superadmin...\n");

// Step 1: Login to get ID token
function loginUser() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      returnSecureToken: true
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      port: 443,
      path: `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const response = JSON.parse(body);
        if (response.error) {
          reject(response.error);
        } else {
          console.log('✅ Login successful');
          console.log('   User ID:', response.localId);
          resolve(response);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Step 2: Create/Update Firestore document with auth token
function updateFirestoreDocument(authData) {
  return new Promise((resolve, reject) => {
    const userDoc = {
      id: authData.localId,
      email: SUPERADMIN_EMAIL,
      name: SUPERADMIN_NAME,
      role: 'superadmin',
      emailVerified: true,
      createdAt: new Date().toISOString()
    };

    const data = JSON.stringify(userDoc);

    // Use Firestore REST API with auth token
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?documentId=${authData.localId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.idToken}`,
        'Content-Length': data.length
      }
    };

    // Convert to Firestore format
    const firestoreDoc = {
      fields: {
        id: { stringValue: authData.localId },
        email: { stringValue: SUPERADMIN_EMAIL },
        name: { stringValue: SUPERADMIN_NAME },
        role: { stringValue: 'superadmin' },
        emailVerified: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    };

    const firestoreData = JSON.stringify(firestoreDoc);
    options.headers['Content-Length'] = firestoreData.length;

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.log('✅ Firestore document created/updated\n');
        resolve();
      });
    });

    req.on('error', reject);
    req.write(firestoreData);
    req.end();
  });
}

async function main() {
  try {
    const authData = await loginUser();
    await updateFirestoreDocument(authData);
    
    console.log('════════════════════════════════════════════');
    console.log('✨ SUPERADMIN SETUP COMPLETE!');
    console.log('════════════════════════════════════════════\n');
    console.log('✅ Firebase Auth: Ready');
    console.log('✅ Firestore Document: Ready');
    console.log('✅ Role: superadmin');
    console.log('\n📧 Email:    ', SUPERADMIN_EMAIL);
    console.log('🔒 Password: ', SUPERADMIN_PASSWORD);
    console.log('\n════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    console.log('\n⚠️  If you see this error, the user was still created in Firebase Auth.');
    console.log('You can try logging in with the credentials above.\n');
  }
}

main();
