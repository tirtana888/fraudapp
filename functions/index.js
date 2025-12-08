const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const axios = require('axios');
const pdf = require('pdf-parse');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const resend = new Resend(functions.config().resend?.api_key);

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
    const { templateId, to, variables } = data;

    console.log(`[SEND-EMAIL] Sending ${templateId} to ${to}`);

    try {
      if (!resend) {
        throw new Error('Resend not configured');
      }

      let subject, htmlContent;

      switch (templateId) {
        case 'candidate_invitation':
          subject = `Undangan Asesmen dari ${variables.companyName}`;
          htmlContent = `
            <h2>Halo ${variables.candidateName},</h2>
            <p>Anda telah diundang untuk mengikuti asesmen untuk posisi <strong>${variables.role}</strong>.</p>
            <p>Kode akses Anda: <strong>${variables.accessCode}</strong></p>
            <p><a href="${variables.assessmentLink}">Klik di sini untuk memulai asesmen</a></p>
            <p>Terima kasih,<br/>${variables.companyName}</p>
          `;
          break;

        default:
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
      throw new functions.https.HttpsError('internal', error.message);
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
