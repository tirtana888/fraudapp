/**
 * Script untuk mengecek struktur data KYC di Firestore
 * Run: node check-kyc-structure.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkKYCStructure() {
    console.log('🔍 Checking KYC data structure...\n');

    try {
        const sessionsSnapshot = await db.collection('interview_sessions')
            .where('backgroundCheckStatus', 'in', ['approved', 'declined', 'in_review'])
            .limit(5)
            .get();

        if (sessionsSnapshot.empty) {
            console.log('❌ No sessions with background check found.');
            return;
        }

        console.log(`✅ Found ${sessionsSnapshot.size} sessions with background check\n`);

        sessionsSnapshot.forEach(doc => {
            const data = doc.data();
            const bgCheck = data.backgroundCheck || {};

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📄 Session ID: ${doc.id}`);
            console.log(`👤 Candidate: ${data.candidate?.name || 'N/A'}`);
            console.log(`📊 Status: ${bgCheck.status || 'N/A'}`);
            console.log(`🔗 Didit Session: ${bgCheck.diditSessionId || 'N/A'}`);
            console.log('');

            // Check structure
            const hasKycData = !!bgCheck.kycData;
            const hasIdVerification = !!bgCheck.idVerification;
            const hasFaceMatch = !!bgCheck.faceMatch;
            const hasLiveness = !!bgCheck.liveness;

            console.log('📦 Data Structure:');
            console.log(`   kycData:         ${hasKycData ? '✅ EXISTS (OLD)' : '❌ NOT FOUND'}`);
            console.log(`   idVerification:  ${hasIdVerification ? '✅ EXISTS (NEW)' : '❌ NOT FOUND'}`);
            console.log(`   faceMatch:       ${hasFaceMatch ? '✅ EXISTS (NEW)' : '❌ NOT FOUND'}`);
            console.log(`   liveness:        ${hasLiveness ? '✅ EXISTS (NEW)' : '❌ NOT FOUND'}`);
            console.log('');

            if (hasIdVerification) {
                console.log('✅ READY FOR NEW UI - No migration needed');
                console.log(`   - Full Name: ${bgCheck.idVerification.fullName || 'N/A'}`);
                console.log(`   - Document Number: ${bgCheck.idVerification.documentNumber || 'N/A'}`);
                console.log(`   - Has Front Image: ${!!bgCheck.idVerification.frontImage}`);
                console.log(`   - Has Portrait Image: ${!!bgCheck.idVerification.portraitImage}`);
            } else if (hasKycData) {
                console.log('⚠️  NEEDS MIGRATION - Using old structure');
                console.log(`   - Full Name: ${bgCheck.kycData.fullName || 'N/A'}`);
                console.log(`   - Document Number: ${bgCheck.kycData.documentNumber || 'N/A'}`);
            } else {
                console.log('❌ NO KYC DATA - Webhook might have failed');
            }

            console.log('');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('💡 Summary:');
        console.log('   - If "idVerification" exists → UI will work ✅');
        console.log('   - If only "kycData" exists → Need migration ⚠️');
        console.log('   - If neither exists → Webhook failed ❌\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

checkKYCStructure();
