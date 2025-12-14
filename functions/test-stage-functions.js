/**
 * Test Script for Stage Functions
 * Run this with: node test-stage-functions.js
 */

// Set environment to use emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    projectId: 'demo-test-project',
});

const db = admin.firestore();

// Import the stage functions
const { updateCandidateStage, getCandidateStageInfo } = require('./stage-functions');

// Test data
const TEST_SESSION_ID = 'test-session-123';
const TEST_COMPANY_ID = 'test-company-456';

async function setupTestData() {
    console.log('📝 Setting up test data...');

    // Create a test session
    await db.collection('interview_sessions').doc(TEST_SESSION_ID).set({
        sessionId: TEST_SESSION_ID,
        companyId: TEST_COMPANY_ID,
        candidate: {
            name: 'John Doe',
            email: 'john.doe@example.com'
        },
        recruitmentStage: 'applied',
        status: 'pending',
        timeline: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Test data created');
}

async function testUpdateStage() {
    console.log('\n🧪 Testing updateCandidateStage function...');

    try {
        // Simulate a callable function request
        const request = {
            data: {
                sessionId: TEST_SESSION_ID,
                stage: 'integrity_assessment',
                note: 'Candidate entered assessment code'
            }
        };

        // Call the function
        const result = await updateCandidateStage.run(request);

        console.log('✅ Stage update result:', JSON.stringify(result, null, 2));

        // Verify the update in Firestore
        const sessionDoc = await db.collection('interview_sessions').doc(TEST_SESSION_ID).get();
        const sessionData = sessionDoc.data();

        console.log('📊 Updated session data:');
        console.log('   - Current stage:', sessionData.recruitmentStage);
        console.log('   - Timeline entries:', sessionData.timeline.length);

    } catch (error) {
        console.error('❌ Error testing updateCandidateStage:', error);
    }
}

async function testGetStageInfo() {
    console.log('\n🧪 Testing getCandidateStageInfo function...');

    try {
        // Simulate a callable function request
        const request = {
            data: {
                sessionId: TEST_SESSION_ID
            }
        };

        // Call the function
        const result = await getCandidateStageInfo.run(request);

        console.log('✅ Stage info result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error testing getCandidateStageInfo:', error);
    }
}

async function testMultipleStageTransitions() {
    console.log('\n🧪 Testing multiple stage transitions...');

    const stages = [
        { stage: 'assessment_completed', note: 'Assessment completed successfully' },
        { stage: 'interview', note: 'Interview scheduled' },
        { stage: 'background_check', note: 'Background check initiated' },
        { stage: 'bc_completed', note: 'Background check completed' },
        { stage: 'hired', note: 'Candidate hired!' }
    ];

    for (const stageUpdate of stages) {
        try {
            const request = {
                data: {
                    sessionId: TEST_SESSION_ID,
                    ...stageUpdate
                }
            };

            const result = await updateCandidateStage.run(request);
            console.log(`✅ Updated to ${stageUpdate.stage}:`, result.message);

            // Small delay to ensure timestamps are different
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`❌ Error updating to ${stageUpdate.stage}:`, error);
        }
    }

    // Get final stage info
    const finalInfo = await getCandidateStageInfo.run({
        data: { sessionId: TEST_SESSION_ID }
    });

    console.log('\n📊 Final stage info:');
    console.log('   - Current stage:', finalInfo.currentStage);
    console.log('   - Stage label:', finalInfo.stageLabel);
    console.log('   - Progress:', finalInfo.progress + '%');
    console.log('   - Timeline entries:', finalInfo.timeline.length);
}

async function runTests() {
    console.log('🚀 Starting Stage Functions Tests\n');
    console.log('='.repeat(50));

    try {
        await setupTestData();
        await testUpdateStage();
        await testGetStageInfo();
        await testMultipleStageTransitions();

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.collection('interview_sessions').doc(TEST_SESSION_ID).delete();
        console.log('✅ Cleanup complete');

        process.exit(0);
    }
}

// Run the tests
runTests();
