/**
 * BACKEND FRAUDGUARD SAAS WITH RESEND & CV PARSER
 * Integrated System: Email, AI (Gemini/Mistral), Fraud Analysis, Didit KYC, CV Parser
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
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

// Re-export Didit functions
exports.diditWebhook = diditWebhook;
exports.processDiditWebhook = processDiditWebhook;
exports.createDiditSession = createDiditSession;
exports.initiateBackgroundCheck = initiateBackgroundCheck;

// Re-export Xendit functions
exports.createXenditInvoice = createXenditInvoice;
exports.handleXenditWebhook = handleXenditWebhook;
exports.getPaymentStatus = getPaymentStatus;

// Email templates will be loaded from separate file
const EMAIL_TEMPLATES = require('./email-templates');

// ==========================================
// CORE FUNCTIONS
// ==========================================

// --- SEND EMAIL ---
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
        emailTemplate = EMAIL_TEMPLATES.interviewInvitation(data.candidateName, data.candidateEmail, data.companyName, data.role, data.interviewDate, data.interviewTime, data.interviewLocation, data.interviewType);
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

// --- AI HELPER ---
async function generateWithFallback(prompt, secrets, options = {}) {
  let responseText = "";
  let usedModel = "gemini-2.0-flash-exp";

  try {
    const genAI = new GoogleGenerativeAI(secrets.gemini.value());
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    responseText = response.text();
    responseText = responseText.replace(/^AI:/i, "").replace(/^Interviewer:/i, "").trim();
  } catch (geminiError) {
    logger.warn(`Gemini Gagal (${geminiError.message}). Beralih ke GPT-4o...`);
    try {
      usedModel = "GPT-4o";
      const { OpenAI } = require("openai");
      const openai = new OpenAI({ apiKey: secrets.openai.value() });
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o",
        max_tokens: options.maxTokens || 1500,
        temperature: options.temperature || 0.7
      });
      responseText = completion.choices[0].message.content;
    } catch (openaiError) {
      logger.error("Semua AI gagal:", openaiError.message);
      throw new Error("Sistem AI sedang sibuk. Silakan coba sesaat lagi.");
    }
  }
  return { text: responseText, model: usedModel };
}

// --- GENERATE AI RESPONSE ---
exports.generateAIResponse = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [geminiApiKey, openaiApiKey]
}, async (request) => {
  const { prompt, assessmentData, history, role } = request.data;
  if (!prompt) throw new HttpsError('invalid-argument', 'Prompt kosong');

  let assessmentContext = "";
  if (assessmentData) {
    const { structuredAssessment, sjtResults } = assessmentData;
    if (structuredAssessment?.length > 0) {
      assessmentContext += 'FRAUD RISK INDICATORS:\n';
      structuredAssessment.forEach(item => {
        const score = typeof item.response === 'number' ? item.response : 0;
        if (score >= 4 || score <= 2) {
          assessmentContext += `- Topik: "${item.category}" | Skor: ${score}/5\n`;
        }
      });
    }
    if (sjtResults?.length > 0) {
      assessmentContext += '\nBEHAVIORAL CHOICES:\n';
      sjtResults.forEach((item, idx) => {
        const selected = item.options[item.selectedOptionIndex || 0];
        if (selected) {
          assessmentContext += `- Skenario ${idx + 1}: "${selected.label}" (Risk: ${selected.riskWeight})\n`;
        }
      });
    }
  }
  if (!assessmentContext) assessmentContext = "Data assessment tidak tersedia.";

  const contextHistory = (history || []).slice(-6).map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const systemPrompt = `PERAN: HR Interviewer untuk ${role || 'Karyawan'}. ATURAN: Jangan sebutkan "Assessment" atau "Skor". Langsung tanya. Max 2 kalimat. Bahasa Indonesia natural.\n\nDATA RAHASIA:\n${assessmentContext}\n\nRIWAYAT:\n${contextHistory}\n\nJAWABAN KANDIDAT: "${prompt}"\n\nRESPON:`;

  try {
    const result = await generateWithFallback(systemPrompt, { gemini: geminiApiKey, openai: openaiApiKey });
    return { success: true, response: result.text, provider: result.model };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// --- ANALYZE FRAUD RISK ---
exports.analyzeFraudRisk = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [geminiApiKey, openaiApiKey]
}, async (request) => {
  const { role, history, structuredAssessment, sjtResults, financialStrainResults } = request.data;
  if (!role || !history || !structuredAssessment) {
    throw new HttpsError('invalid-argument', 'Parameter role, history, dan structuredAssessment wajib diisi.');
  }

  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const assessmentSummary = structuredAssessment.map(item => `[${item.category.toUpperCase()}] "${item.question}" -> ${item.response}/5`).join('\n');
  const sjtSummary = (sjtResults || []).map((item, idx) => {
    const selected = item.options[item.selectedOptionIndex || 0] || {};
    return `[SJT #${idx + 1}] "${item.scenario.substring(0, 60)}..." -> "${selected.label}" (Risk: ${selected.riskWeight})`;
  }).join('\n');
  const financialSummary = (financialStrainResults || []).map(item => `[FINANCIAL] "${item.question}" -> ${item.response}/5`).join('\n');

  const analysisPrompt = `SISTEM: Senior Fraud Analyst.\n\nDATA KANDIDAT: ${role}\n\n1. ASSESSMENT:\n${assessmentSummary}\n\n2. SJT:\n${sjtSummary}\n\n3. FINANCIAL:\n${financialSummary || 'N/A'}\n\n4. TRANSKRIP:\n${context}\n\nOUTPUT JSON:\n{\n  "scores": {"pressure": 0-100, "opportunity": 0-100, "rationalization": 0-100},\n  "riskLevel": "Low|Medium|High|Critical",\n  "summary": "Analisis spesifik kandidat (Bahasa Indonesia)",\n  "redFlags": ["flag1"],\n  "recommendation": "Rekomendasi",\n  "consistencyScore": 0-100,\n  "euphemismScore": 0-100,\n  "sentimentBreakdown": {"positive": 0, "neutral": 0, "negative": 0},\n  "benchmarkComparison": {"candidateAvg": 0, "companyAvg": 48, "industryAvg": 45}\n}`;

  try {
    const result = await generateWithFallback(analysisPrompt, { gemini: geminiApiKey, openai: openaiApiKey }, { maxTokens: 2000, temperature: 0.5 });
    let cleanJson = result.text.replace(/```json\s*|\s*```/g, '').trim();
    const analysis = JSON.parse(cleanJson);
    logger.info(`[ANALYSIS] Completed using ${result.model}`);
    return { success: true, analysis: analysis, provider: result.model };
  } catch (error) {
    logger.error("[ANALYSIS] Error:", error);
    return {
      success: true,
      analysis: {
        scores: { pressure: 50, opportunity: 50, rationalization: 50 },
        riskLevel: "Medium",
        summary: "Analisis gagal, nilai default.",
        redFlags: ["AI Analysis Failed"],
        recommendation: "Review manual diperlukan.",
        consistencyScore: 0,
        euphemismScore: 0,
        sentimentBreakdown: { positive: 33, neutral: 34, negative: 33 },
        benchmarkComparison: { candidateAvg: 50, companyAvg: 48, industryAvg: 45 }
      },
      provider: 'manual-fallback'
    };
  }
});

// --- SEND REJECTION EMAIL ---
exports.sendRejectionEmail = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [resendApiKey]
}, async (request) => {
  const { sessionId, customMessage } = request.data;
  if (!sessionId) throw new HttpsError('invalid-argument', 'Session ID required');

  const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();
  if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found');

  const sessionData = sessionDoc.data();
  const companyDoc = await db.collection('companies').doc(sessionData.companyId).get();
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

// --- SEND HIRE EMAIL ---
exports.sendHireEmail = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [resendApiKey]
}, async (request) => {
  const { sessionId, startDate, startTime, contactPerson, contactPhone, additionalInfo } = request.data;
  if (!sessionId) throw new HttpsError('invalid-argument', 'Session ID required');

  const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();
  if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found');

  const sessionData = sessionDoc.data();
  const companyDoc = await db.collection('companies').doc(sessionData.companyId).get();

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

// --- CV PARSER ---
exports.parseDocumentWithMistral = onCall({
  region: 'europe-west1',
  cors: true,
  timeoutSeconds: 300,
  memory: '2GiB',
  secrets: [mistralApiKey]
}, async (request) => {
  const { documentUrl, sessionId } = request.data;
  if (!documentUrl || !sessionId) throw new HttpsError('invalid-argument', 'Missing params');

  try {
    const bucket = storage.bucket();
    const urlObj = new URL(documentUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch) throw new HttpsError('invalid-argument', 'Invalid URL');

    const file = bucket.file(decodeURIComponent(pathMatch[1]));
    const [fileBuffer] = await file.download();

    let documentText = "";
    const contentType = (await file.getMetadata())[0].contentType || '';

    if (contentType.includes('pdf')) {
      const data = await pdf(fileBuffer);
      documentText = data.text || "";
    } else if (contentType.includes('word')) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      documentText = result.value || "";
    } else {
      documentText = fileBuffer.toString('utf8');
    }

    documentText = documentText.replace(/\s+/g, ' ').trim();

    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: 'mistral-large-latest',
      messages: [{
        role: 'system',
        content: 'Extract CV data as JSON: {fullName, email, phone, address, summary, totalYearsExperience, experience[], education[], skills[], certifications[], languages[]}'
      }, {
        role: 'user',
        content: `Extract:\n\n${documentText.substring(0, 15000)}`
      }],
      temperature: 0.1,
      max_tokens: 4000
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey.value()}`
      },
      timeout: 90000
    });

    const aiContent = response.data.choices[0].message.content;
    const cleanJson = aiContent.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    await db.collection('interview_sessions').doc(sessionId).update({
      cvParsedData: parsed,
      cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
      documentProcessed: true
    });

    return { success: true, parsedData: parsed };
  } catch (error) {
    logger.error('[DOC-PARSE] Error:', error);
    throw new HttpsError('internal', `Parsing failed: ${error.message}`);
  }
});
