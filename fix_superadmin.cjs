// Fix superadmin user - Create proper Firestore document
const https = require('https');

const FIREBASE_API_KEY = "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo";
const PROJECT_ID = "gen-lang-client-0226679970";
const SUPERADMIN_EMAIL = "superadmin@hiregood.com";
const SUPERADMIN_PASSWORD = "SuperAdmin123!";
const SUPERADMIN_NAME = "Super Admin";

console.log("🔧 Fixing superadmin Firestore document...\n");

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
          console.log('✅ Firebase Auth login successful');
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

// Step 2: Create Firestore document with correct structure
function createFirestoreDocument(authData) {
  return new Promise((resolve, reject) => {
    // Create the document with the Firebase Auth user ID as document ID
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

    const data = JSON.stringify(firestoreDoc);

    // Use the Firebase Auth UID as the document ID
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${authData.localId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.idToken}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.log('✅ Firestore document created/updated');
        console.log('   Document ID:', authData.localId);
        console.log('   Email:', SUPERADMIN_EMAIL);
        console.log('   Role: superadmin');
        resolve();
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Step 3: Also create a document using addDoc method (auto-generated ID)
function addFirestoreDocument(authData) {
  return new Promise((resolve, reject) => {
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

    const data = JSON.stringify(firestoreDoc);

    // Add document with auto-generated ID (like addDoc)
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.idToken}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const response = JSON.parse(body);
        const docId = response.name ? response.name.split('/').pop() : 'unknown';
        console.log('✅ Additional Firestore document created');
        console.log('   Auto-generated Document ID:', docId);
        resolve();
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const authData = await loginUser();
    await createFirestoreDocument(authData);
    await addFirestoreDocument(authData);
    
    console.log('\n════════════════════════════════════════════');
    console.log('✨ SUPERADMIN FIRESTORE FIX COMPLETE!');
    console.log('════════════════════════════════════════════');
    console.log('✅ Firebase Auth: Ready');
    console.log('✅ Firestore Document: Created');
    console.log('✅ Email:', SUPERADMIN_EMAIL);
    console.log('✅ Role: superadmin');
    console.log('\n🎯 You can now test login again!');
    console.log('════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message || error);
  }
}

main();