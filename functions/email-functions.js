/**
 * EMAIL FUNCTIONS MODULE
 * Handles all email operations using Resend API
 * Email types: Business invites, Candidate invites, Rejection, Hire
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { Resend } = require("resend");

// Lazy getter for db (admin initialized in index.js)
const getDb = () => admin.firestore();

// --- SECRETS ---
const resendApiKey = defineSecret("RESEND_API_KEY");

// Email templates will be loaded from separate file
const EMAIL_TEMPLATES = require('./email-templates');

// ==========================================
// EXPORTED FUNCTIONS
// ==========================================

/**
 * Send Email (Generic)
 * Supports multiple email types with templating
 */
exports.sendEmail = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [resendApiKey]
}, async (request) => {
    const { type, to, data } = request.data;
    if (!type || !to) {
        throw new HttpsError('invalid-argument', 'Parameter type dan to wajib diisi');
    }

    try {
        const resend = new Resend(resendApiKey.value());
        let emailTemplate;

        switch (type) {
            case 'business_invitation':
                emailTemplate = EMAIL_TEMPLATES.businessInvitation(data.companyName, data.adminEmail, data.tier, data.password);
                break;
            case 'candidate_invitation':
                emailTemplate = EMAIL_TEMPLATES.candidateInvitation(data.candidateName, data.candidateEmail, data.companyName, data.accessCode, data.assessmentLink, data.role);
                break;
            case 'interview_invitation':
                emailTemplate = EMAIL_TEMPLATES.interviewInvitation(
                    data.candidateName,
                    data.candidateEmail,
                    data.companyName,
                    data.role,
                    data.interviewDate,
                    data.interviewTime,
                    data.interviewLocation,
                    data.interviewType,
                    data.sessionId || ''
                );
                break;
            case 'background_check_invitation':
                emailTemplate = EMAIL_TEMPLATES.backgroundCheckInvitation(data.candidateName, data.candidateEmail, data.companyName, data.verificationLink, data.role);
                break;
            case 'rejection_email':
                emailTemplate = EMAIL_TEMPLATES.rejectionEmail(data.candidateName, data.companyName, data.role, data.customMessage);
                break;
            case 'hire_email':
                emailTemplate = EMAIL_TEMPLATES.hireEmail(data.candidateName, data.companyName, data.role, data.startDate, data.startTime, data.contactPerson, data.contactPhone, data.additionalInfo);
                break;
            default:
                throw new HttpsError('invalid-argument', `Email type '${type}' tidak dikenal`);
        }

        logger.info(`[EMAIL] Sending ${type} to ${to}`);
        const result = await resend.emails.send({
            from: emailTemplate.from,
            to: to,
            subject: emailTemplate.subject,
            html: emailTemplate.html
        });

        logger.info(`[EMAIL] Success! ID: ${result.id}`);
        return { success: true, messageId: result.id, message: 'Email berhasil dikirim' };
    } catch (error) {
        logger.error('[EMAIL] Error:', error);
        throw new HttpsError('internal', `Gagal mengirim email: ${error.message}`);
    }
});

/**
 * Send Rejection Email
 * Sends rejection notification to candidate
 */
exports.sendRejectionEmail = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [resendApiKey]
}, async (request) => {
    const { sessionId, customMessage } = request.data;
    if (!sessionId) throw new HttpsError('invalid-argument', 'Session ID required');

    const sessionDoc = await getDb().collection('interview_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found');

    const sessionData = sessionDoc.data();
    const companyDoc = await getDb().collection('companies').doc(sessionData.companyId).get();
    if (!companyDoc.exists) throw new HttpsError('not-found', 'Company not found');

    const resend = new Resend(resendApiKey.value());
    const emailTemplate = EMAIL_TEMPLATES.rejectionEmail(sessionData.candidate?.name, companyDoc.data().name, sessionData.candidate?.role || '', customMessage || '');

    await resend.emails.send({
        from: emailTemplate.from,
        to: sessionData.candidate?.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
    });

    return { success: true, message: 'Rejection email sent' };
});

/**
 * Send Hire Email
 * Sends job offer to candidate
 */
exports.sendHireEmail = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [resendApiKey]
}, async (request) => {
    const { sessionId, startDate, startTime, contactPerson, contactPhone, additionalInfo } = request.data;
    if (!sessionId) throw new HttpsError('invalid-argument', 'Session ID required');

    const sessionDoc = await getDb().collection('interview_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found');

    const sessionData = sessionDoc.data();
    const companyDoc = await getDb().collection('companies').doc(sessionData.companyId).get();

    const resend = new Resend(resendApiKey.value());
    const emailTemplate = EMAIL_TEMPLATES.hireEmail(sessionData.candidate?.name, companyDoc.data().name, sessionData.candidate?.role || '', startDate || '', startTime || '', contactPerson || '', contactPhone || '', additionalInfo || '');

    await resend.emails.send({
        from: emailTemplate.from,
        to: sessionData.candidate?.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
    });

    return { success: true, message: 'Hire email sent' };
});

/**
 * Send Welcome Email to Candidate
 * Sends welcome email with workflow steps when candidate first applies
 */
exports.sendCandidateWelcomeEmail = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [resendApiKey]
}, async (request) => {
    const { sessionId } = request.data;

    if (!sessionId) {
        throw new HttpsError('invalid-argument', 'Session ID required');
    }

    try {
        logger.info(`[WELCOME-EMAIL] Sending welcome email for session: ${sessionId}`);

        // Fetch session data
        const sessionDoc = await getDb().collection('interview_sessions').doc(sessionId).get();
        if (!sessionDoc.exists) {
            throw new HttpsError('not-found', 'Session not found');
        }

        const sessionData = sessionDoc.data();
        const candidateName = sessionData.candidate?.name || 'Kandidat';
        const candidateEmail = sessionData.candidate?.email;
        const candidateRole = sessionData.candidate?.role || '';

        if (!candidateEmail) {
            throw new HttpsError('invalid-argument', 'Candidate email not found');
        }

        // Fetch company data
        const companyDoc = await getDb().collection('companies').doc(sessionData.companyId).get();
        if (!companyDoc.exists) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyData = companyDoc.data();
        const companyName = companyData.name || 'Perusahaan';

        // Fetch workflow data if exists
        let workflowSteps = [];
        const workflowId = sessionData.workflowId;

        if (workflowId) {
            logger.info(`[WELCOME-EMAIL] Loading workflow: ${workflowId}`);
            const workflowDoc = await getDb().collection('workflows').doc(workflowId).get();

            if (workflowDoc.exists) {
                const workflowData = workflowDoc.data();
                // Filter only enabled steps and sort by order
                workflowSteps = (workflowData.steps || [])
                    .filter(step => step.isEnabled)
                    .sort((a, b) => a.order - b.order);

                logger.info(`[WELCOME-EMAIL] Loaded ${workflowSteps.length} enabled workflow steps`);
            }
        }

        // Determine current step (first enabled step or from session)
        const currentStep = sessionData.recruitmentStage || (workflowSteps.length > 0 ? workflowSteps[0].id : 'applied');

        // Generate email template
        const resend = new Resend(resendApiKey.value());
        const emailTemplate = EMAIL_TEMPLATES.candidateWelcomeEmail(
            candidateName,
            candidateEmail,
            companyName,
            candidateRole,
            workflowSteps,
            currentStep
        );

        // Send email
        const result = await resend.emails.send({
            from: emailTemplate.from,
            to: candidateEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html
        });

        logger.info(`[WELCOME-EMAIL] ✅ Email sent successfully! ID: ${result.id}`);

        return {
            success: true,
            messageId: result.id,
            message: 'Welcome email sent successfully',
            recipient: candidateEmail
        };

    } catch (error) {
        logger.error('[WELCOME-EMAIL] Error sending welcome email:', error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Failed to send welcome email: ${error.message}`);
    }
});

