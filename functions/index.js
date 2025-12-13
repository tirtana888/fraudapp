/**
 * BACKEND FRAUDGUARD SAAS WITH RESEND & CV PARSER
 * Integrated System: Email, AI (Gemini/Mistral), Fraud Analysis, Didit KYC, CV Parser
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten, onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const https = require("https");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { Resend } = require("resend");
const axios = require("axios");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

admin.initializeApp();
const db = getFirestore();
const storage = getStorage();

// --- EMAIL SENDERS ---
const EMAIL_SENDERS = {
  business: "no-reply@hiregood.one",
  interview: "interview@hiregood.one"
};

// --- SECRETS ---
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");
const diditApiKey = defineSecret("DIDIT_API_KEY");
const diditWebhookSecret = defineSecret("DIDIT_WEBHOOK_SECRET");
const mistralApiKey = defineSecret("MISTRAL_API_KEY");
const xenditApiKey = defineSecret("XENDIT_API_KEY");
const xenditWebhookToken = defineSecret("XENDIT_WEBHOOK_TOKEN");

// Import Didit functions
const {
  diditWebhook,
  processDiditWebhook,
  createDiditSession,
  initiateBackgroundCheck
} = require('./didit-functions');

// Import Xendit functions
const {
  createXenditInvoice,
  handleXenditWebhook,
  getPaymentStatus
} = require('./xendit-functions');

// Import AI functions
const {
  generateAIResponse,
  analyzeFraudRisk
} = require('./ai-functions');

// Import CV Parser (isolated)
const {
  parseDocumentWithMistral
} = require('./cv-parser');

// Import Email functions
const {
  sendEmail,
  sendRejectionEmail,
  sendHireEmail
} = require('./email-functions');

// Re-export Didit functions
exports.diditWebhook = diditWebhook;
exports.processDiditWebhook = processDiditWebhook;
exports.createDiditSession = createDiditSession;
exports.initiateBackgroundCheck = initiateBackgroundCheck;

// Re-export Xendit functions
exports.createXenditInvoice = createXenditInvoice;
exports.handleXenditWebhook = handleXenditWebhook;
exports.getPaymentStatus = getPaymentStatus;

// Re-export AI functions
exports.generateAIResponse = generateAIResponse;
exports.analyzeFraudRisk = analyzeFraudRisk;
exports.parseDocumentWithMistral = parseDocumentWithMistral;

// Re-export Email functions
exports.sendEmail = sendEmail;
exports.sendRejectionEmail = sendRejectionEmail;
exports.sendHireEmail = sendHireEmail;

// Email templates will be loaded from separate file
const EMAIL_TEMPLATES = require('./email-templates');

// ==========================================
// CORE FUNCTIONS (Remaining in index.js)
// ==========================================
// Note: AI and Email functions have been moved to separate modules



// --- STATS TRIGGER ---
exports.updateGlobalStats = onDocumentWritten({
  document: "interview_sessions/{sessionId}",
  region: "europe-west1"
}, async (event) => {
  try {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after || !after.exists) return;

    const beforeData = before?.exists ? before.data() : null;
    const afterData = after.data();
    const statsRef = db.collection('stats').doc('global_metrics');
    const statsDoc = await statsRef.get();
    const currentStats = statsDoc.exists ? statsDoc.data() : {
      total_assessments: 0,
      completed_assessments: 0,
      email_usage: 0,
      kyc_usage: 0,
      risk_distribution: { High: 0, Medium: 0, Low: 0 },
      last_updated: new Date().toISOString()
    };

    let updates = {};
    let needsUpdate = false;

    if (!beforeData) {
      updates.total_assessments = (currentStats.total_assessments || 0) + 1;
      needsUpdate = true;
    }

    if (!beforeData?.status === 'completed' && afterData.status === 'completed') {
      updates.completed_assessments = (currentStats.completed_assessments || 0) + 1;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.last_updated = new Date().toISOString();
      await statsRef.set(updates, { merge: true });
    }
  } catch (error) {
    logger.error('[STATS] Error:', error);
  }
});


// ==========================================
// IN-APP NOTIFICATION TRIGGERS
// ==========================================


// Trigger: New Candidate Applied
exports.onNewCandidateApplied = onDocumentCreated({
  document: "interview_sessions/{sessionId}",
  region: "europe-west1"
}, async (event) => {
  const session = event.data.data();

  // Only trigger for job applications
  if (session.source !== 'job_application') {
    logger.info('[NOTIF] Skipping - not a job application');
    return;
  }

  try {
    // Get company preferences
    const companyDoc = await db.collection('companies').doc(session.companyId).get();
    if (!companyDoc.exists) {
      logger.warn('[NOTIF] Company not found:', session.companyId);
      return;
    }

    const company = companyDoc.data();

    // Check if notification is enabled (default: true)
    const isEnabled = company.notificationPreferences?.newCandidateApplied !== false;
    if (!isEnabled) {
      logger.info('[NOTIF] New candidate notification disabled for company:', session.companyId);
      return;
    }

    // Get job details
    let jobTitle = 'Unknown Position';
    if (session.jobId) {
      const jobDoc = await db.collection('jobs').doc(session.jobId).get();
      if (jobDoc.exists) {
        jobTitle = jobDoc.data().title;
      }
    }

    // Create notification document
    await db.collection('notifications').add({
      companyId: session.companyId,
      type: 'new_candidate',
      title: 'New Candidate Applied',
      message: `${session.candidate.name} applied for ${jobTitle}`,
      icon: '👤',
      link: `/candidates/${event.params.sessionId}`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        candidateId: event.params.sessionId,
        candidateName: session.candidate.name,
        jobTitle: jobTitle,
        sessionId: event.params.sessionId
      }
    });

    logger.info('[NOTIF] ✅ New candidate notification created for:', session.candidate.name);
  } catch (error) {
    logger.error('[NOTIF] Error creating notification:', error);
  }
});

// Trigger: Assessment Completed
exports.onAssessmentCompleted = onDocumentUpdated({
  document: "interview_sessions/{sessionId}",
  region: "europe-west1"
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only trigger when status changes to 'completed'
  if (before.status === 'completed' || after.status !== 'completed') {
    return;
  }

  try {
    // Get company preferences
    const companyDoc = await db.collection('companies').doc(after.companyId).get();
    if (!companyDoc.exists) {
      logger.warn('[NOTIF] Company not found:', after.companyId);
      return;
    }

    const company = companyDoc.data();

    // Check if notification is enabled (default: true)
    const isEnabled = company.notificationPreferences?.assessmentCompleted !== false;
    if (!isEnabled) {
      logger.info('[NOTIF] Assessment completed notification disabled for company:', after.companyId);
      return;
    }

    const riskLevel = after.analysis?.riskLevel || 'Medium';
    const riskEmoji = {
      'Low': '🟢',
      'Medium': '🟡',
      'High': '🟠',
      'Critical': '🔴'
    }[riskLevel] || '⚪';

    // Create notification document
    await db.collection('notifications').add({
      companyId: after.companyId,
      type: 'assessment_completed',
      title: 'Assessment Completed',
      message: `${after.candidate.name} completed assessment - ${riskEmoji} ${riskLevel} Risk`,
      icon: '✅',
      link: `/candidates/${event.params.sessionId}`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        candidateId: event.params.sessionId,
        candidateName: after.candidate.name,
        sessionId: event.params.sessionId,
        riskLevel: riskLevel
      }
    });

    logger.info('[NOTIF] ✅ Assessment completed notification created for:', after.candidate.name);
  } catch (error) {
    logger.error('[NOTIF] Error creating notification:', error);
  }
});

// ==========================================
// DAILY DIGEST EMAIL
// ==========================================

// Send Daily Digest Email at 8:00 AM WIB (01:00 UTC)
exports.sendDailyDigest = onSchedule({
  schedule: '0 1 * * *', // Every day at 01:00 UTC (08:00 WIB)
  timeZone: 'UTC',
  region: 'europe-west1',
  secrets: [resendApiKey]
}, async (event) => {
  logger.info('[DAILY-DIGEST] Starting daily digest email job...');

  try {
    // Get all companies with dailyDigest enabled
    const companiesSnapshot = await db.collection('companies')
      .where('notificationPreferences.dailyDigest', '==', true)
      .get();

    if (companiesSnapshot.empty) {
      logger.info('[DAILY-DIGEST] No companies with digest enabled');
      return;
    }

    logger.info(`[DAILY-DIGEST] Found ${companiesSnapshot.size} companies with digest enabled`);

    // Calculate 24 hours ago timestamp
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const resend = new Resend(resendApiKey.value());
    let emailsSent = 0;
    let emailsFailed = 0;

    // Process each company
    for (const companyDoc of companiesSnapshot.docs) {
      const company = companyDoc.data();
      const companyId = companyDoc.id;

      try {
        logger.info(`[DAILY-DIGEST] Processing company: ${company.name}`);

        // Query notifications from last 24 hours
        const notificationsSnapshot = await db.collection('notifications')
          .where('companyId', '==', companyId)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(yesterday))
          .where('includedInDigest', '!=', true)
          .orderBy('includedInDigest')
          .orderBy('createdAt', 'desc')
          .get();

        if (notificationsSnapshot.empty) {
          logger.info(`[DAILY-DIGEST] No new notifications for ${company.name}, skipping email`);
          continue;
        }

        // Aggregate notifications by type
        const newCandidates = [];
        const completedAssessments = [];

        for (const notifDoc of notificationsSnapshot.docs) {
          const notif = notifDoc.data();

          if (notif.type === 'new_candidate') {
            newCandidates.push({
              name: notif.metadata?.candidateName || 'Unknown',
              jobTitle: notif.metadata?.jobTitle || ''
            });
          } else if (notif.type === 'assessment_completed') {
            completedAssessments.push({
              name: notif.metadata?.candidateName || 'Unknown',
              jobTitle: notif.metadata?.jobTitle || '',
              riskLevel: notif.metadata?.riskLevel || 'Medium'
            });
          }

          // Mark notification as included in digest
          await notifDoc.ref.update({
            includedInDigest: true,
            includedInDigestAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Skip if no activity
        if (newCandidates.length === 0 && completedAssessments.length === 0) {
          logger.info(`[DAILY-DIGEST] No relevant activity for ${company.name}`);
          continue;
        }

        // Generate email template
        const emailTemplate = EMAIL_TEMPLATES.dailyDigest(
          company.name,
          company.adminEmail,
          now.toISOString(),
          newCandidates,
          completedAssessments,
          'https://hiregood.one/candidates'
        );

        // Send email
        const result = await resend.emails.send({
          from: emailTemplate.from,
          to: company.adminEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });

        logger.info(`[DAILY-DIGEST] ✅ Email sent to ${company.adminEmail} (ID: ${result.id})`);
        emailsSent++;

      } catch (companyError) {
        logger.error(`[DAILY-DIGEST] Error processing company ${company.name}:`, companyError);
        emailsFailed++;
      }
    }

    logger.info(`[DAILY-DIGEST] Job completed. Sent: ${emailsSent}, Failed: ${emailsFailed}`);

  } catch (error) {
    logger.error('[DAILY-DIGEST] Fatal error:', error);
    throw error;
  }
});
