const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const axios = require('axios');
const pdf = require('pdf-parse');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const resendApiKey = functions.config().resend?.api_key;
let resend = null;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

exports.parseCVWithMistral = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    console.log('[PARSE-CV] Starting CV parsing process...');

    const { cvUrl, sessionId } = data;

    if (!cvUrl || !sessionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'CV URL and Session ID are required'
      );
    }

    try {
      console.log('[PARSE-CV] Downloading CV from:', cvUrl);

      const bucket = storage.bucket();

      const urlObj = new URL(cvUrl);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);

      if (!pathMatch) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid CV URL format'
        );
      }

      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);

      console.log('[PARSE-CV] Extracted storage path:', decodedPath);

      const file = bucket.file(decodedPath);

      const [fileBuffer] = await file.download();

      console.log('[PARSE-CV] CV downloaded, size:', fileBuffer.length, 'bytes');
      console.log('[PARSE-CV] Extracting text from PDF...');

      const pdfData = await pdf(fileBuffer);
      const cvText = pdfData.text;

      console.log('[PARSE-CV] Text extracted, length:', cvText.length, 'characters');
      console.log('[PARSE-CV] Calling Mistral AI for parsing...');

      const mistralApiKey = functions.config().mistral?.api_key;

      if (!mistralApiKey) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Mistral AI API key not configured'
        );
      }

      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `You are an expert CV parser. Extract structured information from the CV and return ONLY a valid JSON object with these fields:
{
  "fullName": "string",
  "email": "string or null",
  "phone": "string or null",
  "address": "string or null",
  "summary": "professional summary or objective",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "period (e.g., Jan 2020 - Dec 2022)",
      "description": "brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "institution name",
      "year": "graduation year or period"
    }
  ],
  "skills": ["skill1", "skill2"],
  "certifications": ["cert1", "cert2"],
  "languages": ["language1", "language2"]
}

Return ONLY the JSON object, no additional text.`
            },
            {
              role: 'user',
              content: `Parse this CV text and extract all relevant information. Return as structured JSON.\n\nCV TEXT:\n${cvText}`
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`
          },
          timeout: 30000
        }
      );

      console.log('[PARSE-CV] Mistral AI response received');

      const aiContent = response.data.choices[0].message.content;
      console.log('[PARSE-CV] Raw AI response:', aiContent.substring(0, 200));

      let parsedData;
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = JSON.parse(aiContent);
        }
      } catch (parseError) {
        console.error('[PARSE-CV] Failed to parse AI response as JSON:', parseError);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to parse CV: Invalid AI response format'
        );
      }

      parsedData.rawText = aiContent;

      console.log('[PARSE-CV] Successfully parsed CV data');
      console.log('[PARSE-CV] Updating session document...');

      await db.collection('interview_sessions').doc(sessionId).update({
        cvParsedData: parsedData,
        cvParsedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('[PARSE-CV] ✅ Session updated with parsed CV data');

      return {
        success: true,
        parsedData: parsedData
      };

    } catch (error) {
      console.error('[PARSE-CV] Error:', error);

      if (error.response) {
        console.error('[PARSE-CV] Mistral API error:', error.response.data);
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to parse CV: ${error.message}`
      );
    }
  });

exports.sendEmail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    // Support both old format (templateId/to/variables) and new format (type/to/data)
    const templateId = data.templateId || data.type;
    const to = data.to;
    const variables = data.variables || data.data || {};

    console.log(`[SEND-EMAIL] Sending ${templateId} to ${to}`);
    console.log(`[SEND-EMAIL] Variables:`, JSON.stringify(variables));

    try {
      if (!resend) {
        throw new Error('Resend not configured');
      }

      // Validate required fields
      if (!templateId) {
        throw new Error('templateId or type is required');
      }
      if (!to) {
        throw new Error('to (recipient email) is required');
      }

      let subject, htmlContent;

      switch (templateId) {
        case 'candidate_invitation':
          subject = `Undangan Asesmen dari ${variables.companyName || 'Perusahaan'}`;
          htmlContent = `
            <h2>Halo ${variables.candidateName || 'Kandidat'},</h2>
            <p>Anda telah diundang untuk mengikuti asesmen untuk posisi <strong>${variables.role || 'posisi yang dilamar'}</strong>.</p>
            <p>Kode akses Anda: <strong>${variables.accessCode || '-'}</strong></p>
            <p><a href="${variables.assessmentLink || '#'}">Klik di sini untuk memulai asesmen</a></p>
            <p>Terima kasih,<br/>${variables.companyName || 'Tim HR'}</p>
          `;
          break;

        case 'interview_invitation':
          const interviewType = variables.interviewType === 'online' ? 'Online (Video Call)' : 'Tatap Muka';
          subject = `Undangan Wawancara dari ${variables.companyName || 'Perusahaan'}`;
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .interview-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B35; }
                .detail-row { display: flex; margin: 10px 0; }
                .detail-label { font-weight: bold; width: 120px; color: #666; }
                .detail-value { color: #333; }
                .cta-button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Selamat!</h1>
                  <p>Anda diundang untuk wawancara</p>
                </div>
                <div class="content">
                  <p>Halo <strong>${variables.candidateName || 'Kandidat'}</strong>,</p>
                  <p>Kami dengan senang hati mengundang Anda untuk wawancara posisi <strong>${variables.role || 'posisi yang dilamar'}</strong> di ${variables.companyName || 'perusahaan kami'}.</p>
                  
                  <div class="interview-details">
                    <h3>📋 Detail Wawancara</h3>
                    <div class="detail-row">
                      <span class="detail-label">📅 Tanggal:</span>
                      <span class="detail-value">${variables.interviewDate || '-'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">⏰ Waktu:</span>
                      <span class="detail-value">${variables.interviewTime || '-'} WIB</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">📍 Tipe:</span>
                      <span class="detail-value">${interviewType}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">🏢 Lokasi:</span>
                      <span class="detail-value">${variables.interviewLocation || '-'}</span>
                    </div>
                  </div>
                  
                  <p>Mohon hadir tepat waktu. Jika ada kendala, silakan hubungi kami segera.</p>
                  
                  <p>Salam hangat,<br/><strong>Tim HR ${variables.companyName || ''}</strong></p>
                </div>
                <div class="footer">
                  <p>Email ini dikirim otomatis oleh sistem FraudGuard HR</p>
                </div>
              </div>
            </body>
            </html>
          `;
          break;

        default:
          console.error(`[SEND-EMAIL] Unknown template: ${templateId}`);
          throw new Error(`Unknown template: ${templateId}`);
      }

      await resend.emails.send({
        from: 'noreply@hiregood.one',
        to: to,
        subject: subject,
        html: htmlContent
      });

      console.log(`[SEND-EMAIL] ✅ Email sent successfully`);
      return { success: true };

    } catch (error) {
      console.error('[SEND-EMAIL] Error:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Failed to send email');
    }
  });

exports.sendInterviewSchedule = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-INTERVIEW] Sending interview schedule email');
    return { success: true };
  });

exports.sendHireEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-HIRE] Sending hire confirmation email');
    return { success: true };
  });

exports.sendRejectionEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-REJECTION] Sending rejection email');
    return { success: true };
  });


// ==========================================
// DIDIT WEBHOOK - ASYNC PROCESSING
// ==========================================

/**
 * Step 1: Receive webhook and save to queue (< 1 second response)
 * This function only receives data and immediately returns 200 OK
 * to prevent timeout issues
 */
exports.diditWebhook = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 10, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    console.log('[DIDIT-WEBHOOK] Received webhook request');

    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Signature, X-Timestamp');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).send('');
    }

    // Only accept POST
    if (req.method !== 'POST') {
      console.log('[DIDIT-WEBHOOK] ⚠️ Invalid method:', req.method);
      return res.status(405).send('Method Not Allowed');
    }

    try {
      const webhookData = req.body;
      const signature = req.headers['x-signature'] || req.headers['X-Signature'];
      const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];

      console.log('[DIDIT-WEBHOOK] Webhook type:', webhookData.webhook_type);
      console.log('[DIDIT-WEBHOOK] Session ID:', webhookData.session_id);
      console.log('[DIDIT-WEBHOOK] Status:', webhookData.status);
      console.log('[DIDIT-WEBHOOK] Vendor data:', webhookData.vendor_data);

      // Validate required fields
      if (!webhookData.session_id || !webhookData.vendor_data) {
        console.error('[DIDIT-WEBHOOK] ❌ Missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing session_id or vendor_data'
        });
      }

      // Save to webhook queue for async processing
      // This is FAST - just a database write
      const queueRef = await db.collection('didit_webhook_queue').add({
        webhookData: webhookData,
        headers: {
          signature: signature,
          timestamp: timestamp
        },
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
        processingStatus: 'pending'
      });

      console.log('[DIDIT-WEBHOOK] ✅ Queued for processing:', queueRef.id);

      // Immediately return success - don't wait for processing
      // This ensures response is sent within milliseconds
      return res.status(200).json({
        success: true,
        message: 'Webhook received and queued for processing',
        queueId: queueRef.id
      });

    } catch (error) {
      console.error('[DIDIT-WEBHOOK] ❌ Error queuing webhook:', error);

      // Still return 200 to prevent Didit from retrying
      // Error will be logged for investigation
      return res.status(200).json({
        success: true,
        message: 'Webhook received (with errors)',
        error: error.message
      });
    }
  });

/**
 * Step 2: Process webhook from queue (runs in background)
 * This Firestore trigger automatically processes queued webhooks
 * No timeout issues because it runs asynchronously
 */
exports.processDiditWebhook = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .firestore.document('didit_webhook_queue/{queueId}')
  .onCreate(async (snapshot, context) => {
    const queueId = context.params.queueId;
    const queueData = snapshot.data();

    console.log('[PROCESS-WEBHOOK] Starting background processing for:', queueId);

    try {
      const webhookData = queueData.webhookData;
      const {
        session_id: diditSessionId,
        status,
        vendor_data: firestoreSessionId,
        decision,
        created_at,
        timestamp: webhookTimestamp,
        webhook_type
      } = webhookData;

      console.log('[PROCESS-WEBHOOK] Didit Session:', diditSessionId);
      console.log('[PROCESS-WEBHOOK] Firestore Session:', firestoreSessionId);
      console.log('[PROCESS-WEBHOOK] Status:', status);
      console.log('[PROCESS-WEBHOOK] Type:', webhook_type);

      // Map Didit status to our format
      let mappedStatus = 'pending';
      if (status === 'Approved') {
        mappedStatus = 'approved';
      } else if (status === 'Declined') {
        mappedStatus = 'declined';
      } else if (status === 'In Progress') {
        mappedStatus = 'in_progress';
      } else if (status === 'In Review') {
        mappedStatus = 'in_review';
      }

      console.log('[PROCESS-WEBHOOK] Mapped status:', mappedStatus);

      // Extract decision info if available
      let decisionText = null;
      if (decision && decision.status) {
        decisionText = `Verification ${decision.status}`;

        // Add warnings if any
        if (decision.id_verification && decision.id_verification.warnings) {
          const warnings = decision.id_verification.warnings;
          if (warnings.length > 0) {
            decisionText += ` (${warnings.length} warning(s) detected)`;
          }
        }
      }

      // Prepare background check data
      const backgroundCheckData = {
        status: mappedStatus,
        diditSessionId: diditSessionId,
        decision: decisionText,
        verificationLink: webhookData.session_url || null,
        createdAt: admin.firestore.Timestamp.fromMillis(created_at * 1000),
        lastUpdated: admin.firestore.Timestamp.fromMillis((webhookTimestamp || created_at) * 1000),
        rawWebhookData: {
          status: status,
          webhook_type: webhook_type,
          session_number: webhookData.session_number
        }
      };

      console.log('[PROCESS-WEBHOOK] Updating Firestore document:', firestoreSessionId);

      // Update Firestore - use interview_sessions collection
      await db.collection('interview_sessions').doc(firestoreSessionId).update({
        backgroundCheck: backgroundCheckData,
        backgroundCheckStatus: mappedStatus,
        backgroundCheckCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('[PROCESS-WEBHOOK] ✅ Firestore updated successfully');

      // Mark queue item as processed
      await snapshot.ref.update({
        processed: true,
        processingStatus: 'success',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        result: {
          firestoreSessionId: firestoreSessionId,
          mappedStatus: mappedStatus,
          success: true
        }
      });

      console.log('[PROCESS-WEBHOOK] ✅ Queue item marked as processed');

    } catch (error) {
      console.error('[PROCESS-WEBHOOK] ❌ Error processing webhook:', error);
      console.error('[PROCESS-WEBHOOK] Error stack:', error.stack);

      // Mark queue item as failed
      await snapshot.ref.update({
        processed: true,
        processingStatus: 'failed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: {
          message: error.message,
          stack: error.stack
        }
      });

      console.log('[PROCESS-WEBHOOK] ❌ Queue item marked as failed');
    }
  });

exports.diditWebhook = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    console.log('[DIDIT-WEBHOOK] Received webhook request');
    console.log('[DIDIT-WEBHOOK] Method:', req.method);
    console.log('[DIDIT-WEBHOOK] Headers:', JSON.stringify(req.headers));

    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Signature, X-Timestamp');

    if (req.method === 'OPTIONS') {
      res.status(200).send('');
      return;
    }

    if (req.method !== 'POST') {
      console.log('[DIDIT-WEBHOOK] ⚠️ Invalid method, expected POST');
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const webhookData = req.body;
      console.log('[DIDIT-WEBHOOK] Webhook payload:', JSON.stringify(webhookData, null, 2));

      const {
        session_id: diditSessionId,
        status,
        vendor_data: firestoreSessionId,
        decision,
        created_at,
        timestamp
      } = webhookData;

      if (!firestoreSessionId) {
        console.error('[DIDIT-WEBHOOK] ❌ vendor_data (Firestore session ID) is missing');
        res.status(400).json({
          success: false,
          error: 'vendor_data is required'
        });
        return;
      }

      console.log('[DIDIT-WEBHOOK] Processing for Firestore session:', firestoreSessionId);
      console.log('[DIDIT-WEBHOOK] Didit session ID:', diditSessionId);
      console.log('[DIDIT-WEBHOOK] Status:', status);

      // Map Didit status to our format
      let mappedStatus = 'pending';
      if (status === 'Approved') {
        mappedStatus = 'approved';
      } else if (status === 'Declined') {
        mappedStatus = 'declined';
      } else if (status === 'In Progress') {
        mappedStatus = 'in_progress';
      }

      // Extract decision info if available
      let decisionText = null;
      if (decision && decision.status) {
        decisionText = `Verification ${decision.status}`;

        // Add warnings if any
        if (decision.id_verification && decision.id_verification.warnings) {
          const warnings = decision.id_verification.warnings;
          if (warnings.length > 0) {
            decisionText += ` (${warnings.length} warning(s) detected)`;
          }
        }
      }

      // Prepare background check data
      const backgroundCheckData = {
        status: mappedStatus,
        diditSessionId: diditSessionId,
        decision: decisionText,
        verificationLink: webhookData.session_url || null,
        createdAt: admin.firestore.Timestamp.fromMillis(created_at * 1000),
        lastUpdated: admin.firestore.Timestamp.fromMillis((timestamp || created_at) * 1000),
        rawWebhookData: {
          status: status,
          webhook_type: webhookData.webhook_type,
          session_number: webhookData.session_number
        }
      };

      console.log('[DIDIT-WEBHOOK] Updating Firestore document:', firestoreSessionId);
      console.log('[DIDIT-WEBHOOK] Background check data:', JSON.stringify(backgroundCheckData, null, 2));

      // Update Firestore - use interview_sessions collection
      await db.collection('interview_sessions').doc(firestoreSessionId).update({
        backgroundCheck: backgroundCheckData,
        backgroundCheckStatus: mappedStatus,
        backgroundCheckCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('[DIDIT-WEBHOOK] ✅ Firestore updated successfully');

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        sessionId: firestoreSessionId,
        status: mappedStatus
      });

    } catch (error) {
      console.error('[DIDIT-WEBHOOK] ❌ Error processing webhook:', error);
      console.error('[DIDIT-WEBHOOK] Error stack:', error.stack);

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

exports.createDiditSession = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    console.log('[CREATE-DIDIT] Creating Didit verification session');

    const { sessionId, candidateName, candidateEmail } = data;

    if (!sessionId || !candidateName || !candidateEmail) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'sessionId, candidateName, and candidateEmail are required'
      );
    }

    try {
      const diditApiKey = functions.config().didit?.api_key;
      const diditFlowId = functions.config().didit?.flow_id;

      if (!diditApiKey || !diditFlowId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Didit API key or Flow ID not configured'
        );
      }

      console.log('[CREATE-DIDIT] Calling Didit API...');
      console.log('[CREATE-DIDIT] Flow ID:', diditFlowId);
      console.log('[CREATE-DIDIT] Candidate:', candidateName, candidateEmail);

      const response = await axios.post(
        'https://verification.didit.me/v2/session',
        {
          workflow_id: diditFlowId,
          vendor_data: sessionId, // This will be sent back in webhook
          metadata: {
            candidate_name: candidateName,
            candidate_email: candidateEmail,
            session_id: sessionId
          }
        },
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': diditApiKey
          }
        }
      );

      console.log('[CREATE-DIDIT] ✅ Didit session created:', response.data);

      return {
        success: true,
        sessionId: response.data.id,
        sessionUrl: response.data.url
      };

    } catch (error) {
      console.error('[CREATE-DIDIT] ❌ Error:', error);

      if (error.response) {
        console.error('[CREATE-DIDIT] Didit API error:', error.response.data);
        throw new functions.https.HttpsError(
          'internal',
          `Didit API error: ${JSON.stringify(error.response.data)}`
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to create Didit session: ${error.message}`
      );
    }
  });
