// Script untuk membuat akun Superadmin
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createSuperAdmin() {
  try {
    const email = 'superadmin@hiregood.com';
    const password = 'SuperAdmin123!';
    const name = 'Super Admin';

    console.log('🚀 Creating Superadmin account...');
    console.log('Email:', email);
    console.log('Password:', password);

    // Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: name,
        emailVerified: true
      });
      console.log('✅ User created in Firebase Auth:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('⚠️  User already exists in Auth, fetching...');
        userRecord = await auth.getUserByEmail(email);
        console.log('✅ Found existing user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Create user document in Firestore
    const userDoc = {
      id: userRecord.uid,
      email: email,
      name: name,
      role: 'superadmin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      emailVerified: true
    };

    await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
    console.log('✅ User document created in Firestore');

    console.log('\n✨ Superadmin account created successfully!');
    console.log('=====================================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: superadmin');
    console.log('User ID:', userRecord.uid);
    console.log('=====================================');
    console.log('\n📝 IMPORTANT: Save these credentials securely!');
    console.log('You can now login at: http://localhost:3000');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating superadmin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
