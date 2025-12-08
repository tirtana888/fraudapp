// Check if superadmin user exists in Firestore
const https = require('https');

const FIREBASE_API_KEY = "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo";
const PROJECT_ID = "gen-lang-client-0226679970";
const SUPERADMIN_EMAIL = "superadmin@hiregood.com";
const SUPERADMIN_PASSWORD = "SuperAdmin123!";

console.log("🔍 Checking superadmin user in Firestore...\n");

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
          console.log('   Email verified:', response.emailVerified);
          resolve(response);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Step 2: Query Firestore users collection
function queryFirestoreUsers(authData) {
  return new Promise((resolve, reject) => {
    // Query users collection for documents with email = superadmin@hiregood.com
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.idToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          console.log('\n📋 Firestore users collection query result:');
          
          if (response.documents) {
            console.log(`   Found ${response.documents.length} documents in users collection`);
            
            // Look for superadmin user
            const superadminDoc = response.documents.find(doc => {
              const emailField = doc.fields?.email?.stringValue;
              return emailField === SUPERADMIN_EMAIL;
            });
            
            if (superadminDoc) {
              console.log('\n✅ Superadmin document found:');
              console.log('   Document ID:', superadminDoc.name.split('/').pop());
              console.log('   Email:', superadminDoc.fields?.email?.stringValue);
              console.log('   Name:', superadminDoc.fields?.name?.stringValue);
              console.log('   Role:', superadminDoc.fields?.role?.stringValue);
              console.log('   ID field:', superadminDoc.fields?.id?.stringValue);
              console.log('   Email verified:', superadminDoc.fields?.emailVerified?.booleanValue);
            } else {
              console.log('\n❌ No superadmin document found with email:', SUPERADMIN_EMAIL);
              console.log('\n📝 Available documents:');
              response.documents.forEach((doc, index) => {
                const email = doc.fields?.email?.stringValue || 'No email';
                const name = doc.fields?.name?.stringValue || 'No name';
                const role = doc.fields?.role?.stringValue || 'No role';
                console.log(`   ${index + 1}. Email: ${email}, Name: ${name}, Role: ${role}`);
              });
            }
          } else {
            console.log('   No documents found in users collection');
            if (response.error) {
              console.log('   Error:', response.error);
            }
          }
          
          resolve(response);
        } catch (error) {
          console.error('Error parsing response:', error);
          console.log('Raw response:', body);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const authData = await loginUser();
    await queryFirestoreUsers(authData);
    
    console.log('\n════════════════════════════════════════════');
    console.log('🔍 SUPERADMIN CHECK COMPLETE');
    console.log('════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error.message || error);
  }
}

main();