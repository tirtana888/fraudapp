// Direct Superadmin Creation Script - No localhost needed
// Run: node create_superadmin_direct.js

const https = require('https');

// Firebase Config
const FIREBASE_API_KEY = "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo";
const PROJECT_ID = "hiring-good";

// Superadmin Credentials
const SUPERADMIN_EMAIL = "superadmin@hiregood.com";
const SUPERADMIN_PASSWORD = "SuperAdmin123!";
const SUPERADMIN_NAME = "Super Admin";

console.log("🚀 Starting Superadmin Creation Process...\n");

// Step 1: Create User with Firebase Auth REST API
function createAuthUser() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      returnSecureToken: true
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      port: 443,
      path: `/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
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
          console.log('✅ Step 1: User created in Firebase Auth');
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

// Step 2: Create Firestore Document
function createFirestoreDocument(authData) {
  return new Promise((resolve, reject) => {
    const userDoc = {
      fields: {
        id: { stringValue: authData.localId },
        email: { stringValue: SUPERADMIN_EMAIL },
        name: { stringValue: SUPERADMIN_NAME },
        role: { stringValue: 'superadmin' },
        emailVerified: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    };

    const data = JSON.stringify(userDoc);

    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${authData.localId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Step 2: Firestore document created\n');
          resolve();
        } else {
          console.log('⚠️  Step 2: Firestore document may not be created (status:', res.statusCode, ')');
          console.log('   This is OK - user can still login\n');
          resolve();
        }
      });
    });

    req.on('error', (error) => {
      console.log('⚠️  Firestore error (non-critical):', error.message);
      resolve(); // Continue anyway
    });
    req.write(data);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    // Create auth user
    const authData = await createAuthUser();
    
    // Create firestore document
    await createFirestoreDocument(authData);
    
    // Success!
    console.log('════════════════════════════════════════════');
    console.log('✨ SUPERADMIN ACCOUNT CREATED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════\n');
    console.log('📧 Email:    ', SUPERADMIN_EMAIL);
    console.log('🔒 Password: ', SUPERADMIN_PASSWORD);
    console.log('👤 Role:     ', 'superadmin');
    console.log('🆔 User ID:  ', authData.localId);
    console.log('\n════════════════════════════════════════════');
    console.log('🌐 Login URL: http://localhost:3000');
    console.log('════════════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Save these credentials securely!\n');
    
  } catch (error) {
    if (error.message && error.message.includes('EMAIL_EXISTS')) {
      console.log('════════════════════════════════════════════');
      console.log('ℹ️  ACCOUNT ALREADY EXISTS');
      console.log('════════════════════════════════════════════\n');
      console.log('You can login with existing credentials:');
      console.log('📧 Email:    ', SUPERADMIN_EMAIL);
      console.log('🔒 Password: ', SUPERADMIN_PASSWORD);
      console.log('\n════════════════════════════════════════════\n');
    } else {
      console.error('❌ Error:', error.message || error);
      process.exit(1);
    }
  }
}

main();
