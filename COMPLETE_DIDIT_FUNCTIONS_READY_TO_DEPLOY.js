// ==========================================
// DIDIT WEBHOOK - ASYNC PROCESSING SOLUTION
// ==========================================
// This replaces your existing diditWebhook function
// Copy and paste this entire section into your index.js

const crypto = require('crypto');

// --- STEP 1: FAST WEBHOOK RECEIVER (< 1 second response) ---
exports.diditWebhook = onRequest({
  region: "europe-west1",
  cors: true,
  secrets: [diditWebhookSecret],
  timeoutSeconds: 10,  // Short timeout - only for receiving
  memory: "256MB"       // Low memory - minimal processing
}, async (req, res) => {
  logger.info('[DIDIT-WEBHOOK] Received webhook request');
  
  if (req.method !== 'POST') {
    logger.warn('[DIDIT-WEBHOOK] Invalid method:', req.method);
    return res.status(405).send('Method Not Allowed');
  }

  // 1. Read and parse body
  let rawBodyBuffer = Buffer.from([]);
  let body;
  try {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        rawBodyBuffer = Buffer.concat(chunks);
        try {
          resolve(JSON.parse(rawBodyBuffer.toString('utf8')));
        } catch (e) {
          reject(new Error('Invalid JSON body format'));
        }
      });
      req.on('error', reject);
    });
  } catch(e) {
    logger.error('[DIDIT-WEBHOOK] Error reading/parsing body:', e);
    return res.status(400).send('Invalid Request Body');
  }

  // 2. Get headers
  const signature = req.headers['x-signature'] || req.headers['X-Signature'];
  const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];
  
  if (!signature || !timestamp) {
    logger.error('[DIDIT-WEBHOOK] Missing signature or timestamp');
    return res.status(401).send('Missing security headers');
  }
  
  // 3. Quick validation of required fields
  const { session_id, vendor_data, webhook_type } = body;
  if (!session_id || !vendor_data) {
    logger.error('[DIDIT-WEBHOOK] Missing required fields');
    return res.status(400).json({ error: 'Missing session_id or vendor_data' });
  }
  
  logger.info(`[DIDIT-WEBHOOK] Webhook type: ${webhook_type}, Status: ${body.status}, Vendor: ${vendor_data}`);
  
  try {
    // 4. Save to queue for async processing (FAST - just a database write)
    const queueRef = await db.collection('didit_webhook_queue').add({
      webhookData: body,
      headers: {
        signature: signature,
        timestamp: timestamp,
        rawBody: rawBodyBuffer.toString('utf8')
      },
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
      processingStatus: 'pending'
    });
    
    logger.info(`[DIDIT-WEBHOOK] ✅ Queued for processing: ${queueRef.id}`);
    
    // 5. Immediately return success (< 1 second)
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook received and queued for processing',
      queueId: queueRef.id
    });
    
  } catch (error) {
    logger.error('[DIDIT-WEBHOOK] Error queuing webhook:', error);
    
    // Still return 200 to prevent Didit from retrying
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook received (with errors)',
      error: error.message 
    });
  }
});

// --- STEP 2: BACKGROUND PROCESSOR (Firestore Trigger) ---
exports.processDiditWebhook = functions
  .region('europe-west1')
  .runWith({ 
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: [diditWebhookSecret]
  })
  .firestore.document('didit_webhook_queue/{queueId}')
  .onCreate(async (snapshot, context) => {
    const queueId = context.params.queueId;
    const queueData = snapshot.data();
    
    logger.info(`[PROCESS-WEBHOOK] Starting background processing for: ${queueId}`);
    
    try {
      const webhookData = queueData.webhookData;
      const headers = queueData.headers;
      
      // 1. Verify signature (now in background, no timeout pressure)
      try {
        const verifiableString = `${headers.timestamp}.${headers.rawBody}`;
        const webhookSecret = diditWebhookSecret.value();

        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(verifiableString)
          .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(headers.signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))) {
          throw new Error('Invalid signature');
        }
        
        logger.info(`[PROCESS-WEBHOOK] ✅ Signature verified`);
      } catch (secError) {
        logger.error('[PROCESS-WEBHOOK] Signature verification failed:', secError);
        throw secError;
      }
      
      // 2. Extract webhook data
      const { 
        session_id: diditSessionId, 
        status, 
        vendor_data: firestoreSessionId,
        decision,
        created_at,
        timestamp: webhookTimestamp,
        webhook_type
      } = webhookData;
      
      logger.info(`[PROCESS-WEBHOOK] Didit Session: ${diditSessionId}`);
      logger.info(`[PROCESS-WEBHOOK] Firestore Session: ${firestoreSessionId}`);
      logger.info(`[PROCESS-WEBHOOK] Status: ${status}`);
      logger.info(`[PROCESS-WEBHOOK] Type: ${webhook_type}`);
      
      // 3. Process based on webhook type
      if (webhook_type === 'status.updated') {
        // Map status
        let mappedStatus = 'pending';
        if (status === 'Approved') mappedStatus = 'approved';
        else if (status === 'Declined' || status === 'Abandoned') mappedStatus = 'declined';
        else if (status === 'In Review') mappedStatus = 'in_review';
        else if (status === 'In Progress') mappedStatus = 'in_progress';
        
        logger.info(`[PROCESS-WEBHOOK] Mapped status: ${mappedStatus}`);
        
        // Extract decision info
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
        
        // Prepare update data
        const updateData = {
          'backgroundCheck.status': mappedStatus,
          'backgroundCheck.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
          'backgroundCheck.diditSessionId': diditSessionId,
          'backgroundCheck.decision': decisionText || decision,
          'backgroundCheckStatus': mappedStatus
        };
        
        if (['approved', 'declined'].includes(mappedStatus)) {
          updateData['backgroundCheckCompletedAt'] = admin.firestore.FieldValue.serverTimestamp();
        }
        
        // Update Firestore
        logger.info(`[PROCESS-WEBHOOK] Updating Firestore document: ${firestoreSessionId}`);
        await db.collection('interview_sessions').doc(firestoreSessionId).update(updateData);
        logger.info(`[PROCESS-WEBHOOK] ✅ Firestore updated successfully`);
        
      } else if (webhook_type === 'data.updated') {
        // Handle data update
        await db.collection('interview_sessions').doc(firestoreSessionId).update({
          'backgroundCheck.dataUpdated': true,
          'backgroundCheck.lastDataUpdate': admin.firestore.FieldValue.serverTimestamp(),
          'backgroundCheck.decision': decision || null
        });
        logger.info(`[PROCESS-WEBHOOK] ✅ Data update processed`);
      }
      
      // 4. Mark queue item as processed
      await snapshot.ref.update({
        processed: true,
        processingStatus: 'success',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        result: {
          firestoreSessionId: firestoreSessionId,
          mappedStatus: webhookData.status,
          success: true
        }
      });
      
      logger.info(`[PROCESS-WEBHOOK] ✅ Queue item marked as processed`);
      
    } catch (error) {
      logger.error('[PROCESS-WEBHOOK] ❌ Error processing webhook:', error);
      logger.error('[PROCESS-WEBHOOK] Error stack:', error.stack);
      
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
      
      logger.error(`[PROCESS-WEBHOOK] ❌ Queue item marked as failed`);
    }
  });

// --- FUNGSI 5: CREATE DIDIT SESSION (FIXED CALLBACK URL) ---
exports.createDiditSession = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [diditApiKey]
}, async (request) => {
  const { sessionId, candidateName, candidateEmail } = request.data;
  if (!sessionId || !candidateName || !candidateEmail) {
    throw new HttpsError('invalid-argument', 'Data tidak lengkap.');
  }

  try {
    const payload = JSON.stringify({
      workflow_id: DIDIT_FLOW_ID,
      vendor_data: sessionId,
      callback: 'https://webhook.hiregood.one/webhook',  // ✅ FIXED: Added HTTPS
      metadata: { 
        candidate_name: candidateName, 
        candidate_email: candidateEmail, 
        session_id: sessionId 
      }
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'verification.didit.me',
        path: '/v2/session/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': diditApiKey.value(),
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
           if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
           else reject(new Error(`Didit API error: ${res.statusCode} - ${data}`));
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    await db.collection('interview_sessions').doc(sessionId).update({
      'backgroundCheck.diditSessionId': response.session_id,
      'backgroundCheck.status': 'pending',
      'backgroundCheck.createdAt': admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, sessionUrl: response.url, sessionId: response.session_id };

  } catch (error) {
    throw new HttpsError('internal', `Failed to create Didit session: ${error.message}`);
  }
});

// --- FUNGSI: INITIATE BACKGROUND CHECK (FIXED CALLBACK URL) ---
exports.initiateBackgroundCheck = onCall({
  region: "europe-west1",
  cors: true,
  secrets: [diditApiKey, resendApiKey]
}, async (request) => {
  const { sessionId } = request.data;

  if (!sessionId) {
    throw new HttpsError('invalid-argument', 'Session ID is required');
  }

  try {
    logger.info(`[BG-CHECK] Initiating background check for session: ${sessionId}`);

    // Get candidate data
    const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      throw new HttpsError('not-found', 'Session not found');
    }

    const sessionData = sessionDoc.data();
    const candidateName = sessionData.candidate?.name;
    const candidateEmail = sessionData.candidate?.email;
    const candidateRole = sessionData.candidate?.role || '';
    const companyId = sessionData.companyId;

    if (!candidateName || !candidateEmail) {
      throw new HttpsError('failed-precondition', 'Candidate information is incomplete');
    }

    // Get company data
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      throw new HttpsError('not-found', 'Company not found');
    }

    const companyData = companyDoc.data();
    const companyName = companyData.name;

    // Create Didit verification session
    const diditPayload = JSON.stringify({
      workflow_id: DIDIT_FLOW_ID,
      vendor_data: sessionId,
      callback: 'https://webhook.hiregood.one/webhook',  // ✅ FIXED: Added HTTPS
      metadata: {
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        session_id: sessionId,
        company_id: companyId
      }
    });

    logger.info(`[BG-CHECK] Creating Didit session for ${candidateEmail}`);

    const diditResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'verification.didit.me',
        path: '/v2/session/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': diditApiKey.value(),
          'Content-Length': Buffer.byteLength(diditPayload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Didit API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => reject(error));
      req.write(diditPayload);
      req.end();
    });

    const verificationLink = diditResponse.url;
    const diditSessionId = diditResponse.session_id;

    logger.info(`[BG-CHECK] Didit session created: ${diditSessionId}`);

    // Update session with background check info
    await db.collection('interview_sessions').doc(sessionId).update({
      'backgroundCheck': {
        diditSessionId: diditSessionId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationLink: verificationLink
      },
      recruitmentStage: 'bc_check',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`[BG-CHECK] Sending email to ${candidateEmail}`);

    // Send email with verification link
    const resend = new Resend(resendApiKey.value());
    const emailTemplate = EMAIL_TEMPLATES.backgroundCheckInvitation(
      candidateName,
      candidateEmail,
      companyName,
      verificationLink,
      candidateRole
    );

    await resend.emails.send({
      from: emailTemplate.from,
      to: candidateEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });

    logger.info(`[BG-CHECK] Background check initiated successfully for ${sessionId}`);

    return {
      success: true,
      message: 'Background check email sent successfully',
      verificationLink: verificationLink,
      diditSessionId: diditSessionId
    };

  } catch (error) {
    logger.error(`[BG-CHECK] Error: ${error.message}`);
    throw new HttpsError('internal', `Failed to initiate background check: ${error.message}`);
  }
});
