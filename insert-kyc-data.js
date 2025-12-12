// Script to manually insert KYC data for testing
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function insertKYCData() {
    const sessionId = 'VhNDXc3E2w4if62XmWNS';

    const kycData = {
        status: 'approved',
        diditSessionId: '5b861c18-d2b9-444b-9fe6-52fa68772909',
        decision: 'Verifikasi berhasil - Identitas valid',
        verificationLink: 'https://verify.didit.me/session/ncJ3N2QeTOER',
        createdAt: admin.firestore.Timestamp.fromMillis(1765455275 * 1000),
        lastUpdated: admin.firestore.Timestamp.fromMillis(1765455412 * 1000),
        rawWebhookData: {
            status: 'Approved',
            webhook_type: 'status.updated',
            session_number: 496
        },

        // ID Verification Data
        idVerification: {
            fullName: 'Arif Tirtana',
            documentNumber: '3311040812890006',
            documentType: 'Identity Card',
            dateOfBirth: '1909-12-08',
            placeOfBirth: 'Sragen',
            gender: 'M',
            address: 'Darmosari, 002/007, Gayam, Sukoharjo, Provinsi Jawa Tengah, Kabupaten Sukoharjo',
            status: 'Approved',
            portraitImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Placeholder
            frontImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Placeholder
            backImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Placeholder
        },

        // Face Match Data
        faceMatch: {
            score: 0.9558,
            status: 'Approved',
            sourceImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            targetImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },

        // Liveness Data
        liveness: {
            score: 0.988,
            status: 'Approved',
            ageEstimation: 31.76,
            referenceImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },

        // Warnings
        warnings: [
            'Possible duplicated approved user from other session'
        ],

        // IP Analysis
        ipAnalysis: {
            ipAddress: '202.6.192.8',
            country: 'Indonesia',
            isVpnOrTor: false,
            status: 'Approved',
        }
    };

    try {
        console.log('Updating session:', sessionId);
        await db.collection('interview_sessions').doc(sessionId).update({
            backgroundCheck: kycData,
            backgroundCheckStatus: 'approved',
            backgroundCheckCompletedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ KYC data inserted successfully!');
        console.log('Refresh your dashboard to see the changes.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inserting KYC data:', error);
        process.exit(1);
    }
}

insertKYCData();
