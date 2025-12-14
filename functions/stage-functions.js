/**
 * Stage Tracking Cloud Functions
 * 
 * Provides robust stage updates that work from public pages without authentication.
 * Uses Firebase Admin SDK to bypass security rules.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Stage definitions matching the 8-stage workflow
const VALID_STAGES = [
    'applied',
    'integrity_assessment',
    'assessment_completed',
    'interview',
    'background_check',
    'bc_completed',
    'hired',
    'rejected'
];

// Stage labels for timeline notes
const STAGE_LABELS = {
    'applied': 'Kandidat Apply',
    'integrity_assessment': 'Integrity Assessment',
    'assessment_completed': 'Need Review',
    'interview': 'Wawancara Scheduled',
    'background_check': 'Background Check Process',
    'bc_completed': 'Background Check Selesai',
    'hired': 'Hire',
    'rejected': 'Tolak'
};

/**
 * Update candidate's recruitment stage
 * Callable from both authenticated and unauthenticated contexts
 */
exports.updateCandidateStage = onCall({
    region: "europe-west1",
    cors: true,
}, async (request) => {
    const { sessionId, stage, note, applicationId } = request.data;

    logger.info(`[STAGE-FUNCTION] Updating stage for session: ${sessionId || 'from applicationId'} to ${stage}`);

    // Validate required fields
    if (!stage) {
        throw new HttpsError('invalid-argument', 'Stage is required');
    }

    // Validate stage is valid
    if (!VALID_STAGES.includes(stage)) {
        throw new HttpsError('invalid-argument', `Invalid stage: ${stage}. Valid stages: ${VALID_STAGES.join(', ')}`);
    }

    try {
        let targetSessionId = sessionId;

        // If applicationId provided, find the session from application
        if (!targetSessionId && applicationId) {
            const appDoc = await db.collection('job_applications').doc(applicationId).get();
            if (appDoc.exists) {
                targetSessionId = appDoc.data().sessionId;
                logger.info(`[STAGE-FUNCTION] Found sessionId from application: ${targetSessionId}`);
            }
        }

        if (!targetSessionId) {
            throw new HttpsError('not-found', 'Session not found');
        }

        // Build update data
        const now = new Date().toISOString();
        const updateData = {
            recruitmentStage: stage,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add timeline entry
        const timelineEntry = {
            stage: stage,
            status: 'current',
            date: now,
            note: note || `${STAGE_LABELS[stage]} - Stage updated`
        };

        // Update session
        await db.collection('interview_sessions').doc(targetSessionId).update({
            ...updateData,
            timeline: admin.firestore.FieldValue.arrayUnion(timelineEntry)
        });

        logger.info(`[STAGE-FUNCTION] ✅ Stage updated successfully to ${stage}`);

        return {
            success: true,
            sessionId: targetSessionId,
            stage: stage,
            message: `Stage updated to ${STAGE_LABELS[stage]}`
        };

    } catch (error) {
        logger.error(`[STAGE-FUNCTION] Error updating stage:`, error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Failed to update stage: ${error.message}`);
    }
});

/**
 * Get stage progress and workflow status for a candidate
 */
exports.getCandidateStageInfo = onCall({
    region: "europe-west1",
    cors: true,
}, async (request) => {
    const { sessionId } = request.data;

    if (!sessionId) {
        throw new HttpsError('invalid-argument', 'Session ID is required');
    }

    try {
        const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();

        if (!sessionDoc.exists) {
            throw new HttpsError('not-found', 'Session not found');
        }

        const data = sessionDoc.data();
        const currentStage = data.recruitmentStage || 'applied';
        const currentIndex = VALID_STAGES.indexOf(currentStage);
        const progress = Math.round(((currentIndex + 1) / VALID_STAGES.length) * 100);

        return {
            success: true,
            currentStage: currentStage,
            stageLabel: STAGE_LABELS[currentStage],
            progress: progress,
            timeline: data.timeline || [],
            validStages: VALID_STAGES,
            stageLabels: STAGE_LABELS
        };

    } catch (error) {
        logger.error(`[STAGE-FUNCTION] Error getting stage info:`, error);
        throw new HttpsError('internal', `Failed to get stage info: ${error.message}`);
    }
});
