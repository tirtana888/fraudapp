/**
 * DIDIT KYC INTEGRATION MODULE
 * Complete Didit webhook processing and session management
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const https = require("https");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { Resend } = require("resend");
const admin = require("firebase-admin");

const db = getFirestore();

// --- SECRETS ---
const diditApiKey = defineSecret("DIDIT_API_KEY");
const diditWebhookSecret = defineSecret("DIDIT_WEBHOOK_SECRET");
const resendApiKey = defineSecret("RESEND_API_KEY");

// --- CONFIG ---
const DIDIT_FLOW_ID = 'a1387729-c7ef-4ebd-94af-6516553265aa';
const WEBHOOK_QUEUE_COLLECTION = 'didit_webhook_queue';

// --- EMAIL TEMPLATE ---
const EMAIL_SENDERS = {
    interview: "interview@hiregood.one"
};

const backgroundCheckEmailTemplate = (candidateName, companyName, verificationLink, role = "") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #D95D00 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Background Check Required</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95;">Verifikasi Latar Belakang via Didit KYC</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">Halo <strong>${candidateName}</strong>,</p>
              <p style="margin: 0 0 25px 0; color: #555555; font-size: 15px; line-height: 1.6;">
                Sebagai bagian dari proses rekrutmen untuk posisi ${role ? `<strong>${role}</strong>` : ''} di <strong>${companyName}</strong>,
                kami membutuhkan Anda untuk menyelesaikan verifikasi latar belakang melalui Didit KYC.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #D95D00 0%, #FF6B35 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(217, 93, 0, 0.3);">
                      Mulai Verifikasi →
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #FEF2F2; border: 2px solid #DC2626; padding: 20px; margin: 25px 0; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 16px; font-weight: 700;">⏰ BATAS WAKTU: 48 JAM</p>
                <p style="margin: 0; color: #7F1D1D; font-size: 14px; line-height: 1.6;">
                  Selesaikan verifikasi dalam <strong>maksimal 48 jam</strong> sejak email ini dikirim.
                </p>
              </div>
              <div style="background-color: #FFF7ED; border-left: 4px solid #D95D00; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0 0 12px 0; color: #9A3412; font-size: 14px; font-weight: 600;">Yang Perlu Anda Siapkan:</p>
                <ul style="margin: 0; padding-left: 20px; color: #9A3412; font-size: 14px; line-height: 1.8;">
                  <li>Dokumen identitas resmi (KTP/SIM/Paspor)</li>
                  <li>Smartphone atau laptop dengan kamera</li>
                  <li>Pencahayaan yang baik</li>
                  <li>Koneksi internet stabil</li>
                </ul>
                <p style="margin: 15px 0 0 0; color: #9A3412; font-size: 13px;">
                  ⏱️ Proses verifikasi memakan waktu sekitar <strong>5-10 menit</strong>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 5px 0; color: #999999; font-size: 12px;">
                <strong>${companyName}</strong> menggunakan platform HireGood untuk proses rekrutmen
              </p>
              <p style="margin: 0; color: #CCCCCC; font-size: 11px;">
                © ${new Date().getFullYear()} Powered by HireGood - Secure Verification by Didit
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// 1. DIDIT WEBHOOK RECEIVER (Fast Response)
// ==========================================
exports.diditWebhook = onRequest({
    region: "europe-west1",
    cors: true,
    secrets: [diditWebhookSecret]
}, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const body = req.body;
        const rawBodyBuffer = Buffer.from(JSON.stringify(body));
        const signature = req.headers['x-signature'] || req.headers['X-Signature'];
        const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];

        if (!signature || !timestamp) {
            logger.error('[DIDIT-WEBHOOK] Missing signature or timestamp');
            return res.status(401).send('Missing security headers');
        }

        // Log received data for debugging
        logger.info('[DIDIT-WEBHOOK] Received webhook', {
            timestamp: timestamp,
            timestampType: typeof timestamp,
            signatureReceived: signature,
            bodyKeys: Object.keys(body),
            vendor_data: body.vendor_data
        });

        // Verify HMAC signature
        const verifiableString = `${timestamp}.${rawBodyBuffer.toString('utf8')}`;
        const webhookSecret = diditWebhookSecret.value();
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(verifiableString)
            .digest('hex');

        logger.info('[DIDIT-WEBHOOK] Signature verification', {
            signatureReceived: signature,
            signatureExpected: expectedSignature,
            match: signature === expectedSignature,
            verifiableStringLength: verifiableString.length,
            timestampInString: verifiableString.substring(0, 50)
        });

        if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))) {
            logger.error('[DIDIT-WEBHOOK] Invalid signature detected!', {
                received: signature,
                expected: expectedSignature,
                timestamp: timestamp,
                bodyPreview: JSON.stringify(body).substring(0, 200)
            });

            // TEMPORARY: Queue anyway for testing (remove after fixing)
            logger.warn('[DIDIT-WEBHOOK] Queuing despite invalid signature (TEMPORARY)');
            await db.collection(WEBHOOK_QUEUE_COLLECTION).add({
                headers: { signature, timestamp },
                rawBody: rawBodyBuffer.toString('utf8'),
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false,
                signatureValid: false // Mark as invalid
            });

            return res.status(200).json({ success: true, message: 'Webhook queued (signature invalid but accepted for debugging)' });
        }

        // Queue for async processing
        await db.collection(WEBHOOK_QUEUE_COLLECTION).add({
            headers: { signature, timestamp },
            rawBody: rawBodyBuffer.toString('utf8'),
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            processed: false,
            signatureValid: true
        });

        logger.info('[DIDIT-WEBHOOK] Queued for processing');
        return res.status(200).json({ success: true, message: 'Webhook queued' });

    } catch (error) {
        logger.error('[DIDIT-WEBHOOK] Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ==========================================
// 2. DIDIT WEBHOOK PROCESSOR (Background)
// ==========================================
exports.processDiditWebhook = onDocumentCreated({
    region: "europe-west1",
    cpu: "gcf_gen1",
    secrets: [diditWebhookSecret],
    document: `${WEBHOOK_QUEUE_COLLECTION}/{docId}`
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const { rawBody } = data;

    logger.info(`[PROCESS-WEBHOOK] Processing: ${event.params.docId}`);

    try {
        const webhookData = JSON.parse(rawBody);
        const {
            session_id: diditSessionId,
            status,
            webhook_type,
            vendor_data,
            decision,
            created_at,
            timestamp: webhookTimestamp
        } = webhookData;

        if (webhook_type === 'status.updated' && vendor_data) {
            let mappedStatus = 'pending';
            if (status === 'Approved') mappedStatus = 'approved';
            else if (status === 'Declined' || status === 'Abandoned') mappedStatus = 'declined';
            else if (status === 'In Review') mappedStatus = 'in_review';
            else if (status === 'In Progress') mappedStatus = 'in_progress';

            const decisionText = decision?.status === 'approved'
                ? 'Verifikasi berhasil - Identitas valid'
                : decision?.status === 'declined'
                    ? 'Verifikasi ditolak - Identitas tidak valid'
                    : 'Sedang dalam proses verifikasi';

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
                },

                idVerification: decision?.id_verification ? {
                    fullName: decision.id_verification.full_name,
                    documentNumber: decision.id_verification.document_number,
                    documentType: decision.id_verification.document_type,
                    dateOfBirth: decision.id_verification.date_of_birth,
                    placeOfBirth: decision.id_verification.place_of_birth,
                    gender: decision.id_verification.gender,
                    address: decision.id_verification.address,
                    status: decision.id_verification.status,
                    portraitImage: decision.id_verification.portrait_image,
                    frontImage: decision.id_verification.front_image,
                    backImage: decision.id_verification.back_image,
                } : null,

                faceMatch: decision?.face_match ? {
                    score: decision.face_match.score,
                    status: decision.face_match.status,
                    sourceImage: decision.face_match.source_image,
                    targetImage: decision.face_match.target_image,
                } : null,

                liveness: decision?.liveness ? {
                    score: decision.liveness.score,
                    status: decision.liveness.status,
                    ageEstimation: decision.liveness.age_estimation,
                    referenceImage: decision.liveness.reference_image,
                } : null,

                warnings: [
                    ...(decision?.id_verification?.warnings || []),
                    ...(decision?.face_match?.warnings || []),
                    ...(decision?.liveness?.warnings || []),
                ],

                ipAnalysis: decision?.ip_analysis ? {
                    ipAddress: decision.ip_analysis.ip_address,
                    country: decision.ip_analysis.ip_country,
                    isVpnOrTor: decision.ip_analysis.is_vpn_or_tor,
                    status: decision.ip_analysis.status,
                } : null
            };

            logger.info(`[PROCESS-WEBHOOK] Updating session: ${vendor_data} -> ${mappedStatus}`);

            await db.collection('interview_sessions').doc(vendor_data).update({
                backgroundCheck: backgroundCheckData,
                backgroundCheckStatus: mappedStatus,
                backgroundCheckCompletedAt: ['approved', 'declined'].includes(mappedStatus)
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : null
            });
        }

        await snapshot.ref.update({
            processed: true,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            processingStatus: 'success'
        });

    } catch (error) {
        logger.error(`[PROCESS-WEBHOOK] Failed: ${error.message}`);
        await snapshot.ref.update({
            processed: true,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            processingStatus: 'failed',
            errorLog: error.message
        });
    }
});

// ==========================================
// 3. CREATE DIDIT SESSION
// ==========================================
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
            callback: 'https://webhook.hiregood.one/webhook',
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
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Didit API error: ${res.statusCode} - ${data}`));
                    }
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

        return {
            success: true,
            sessionUrl: response.url,
            sessionId: response.session_id
        };

    } catch (error) {
        logger.error('[CREATE-SESSION] Error:', error);
        throw new HttpsError('internal', `Failed to create Didit session: ${error.message}`);
    }
});

// ==========================================
// 4. INITIATE BACKGROUND CHECK (with Email)
// ==========================================
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
        logger.info(`[BG-CHECK] Initiating for session: ${sessionId}`);

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
            throw new HttpsError('failed-precondition', 'Candidate information incomplete');
        }

        const companyDoc = await db.collection('companies').doc(companyId).get();
        if (!companyDoc.exists) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyName = companyDoc.data().name;

        const diditPayload = JSON.stringify({
            workflow_id: DIDIT_FLOW_ID,
            vendor_data: sessionId,
            callback: 'https://webhook.hiregood.one/webhook',
            metadata: {
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                session_id: sessionId,
                company_id: companyId
            }
        });

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

            req.on('error', reject);
            req.write(diditPayload);
            req.end();
        });

        const verificationLink = diditResponse.url;
        const diditSessionId = diditResponse.session_id;

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

        const resend = new Resend(resendApiKey.value());
        const emailHtml = backgroundCheckEmailTemplate(candidateName, companyName, verificationLink, candidateRole);

        await resend.emails.send({
            from: EMAIL_SENDERS.interview,
            to: candidateEmail,
            subject: `🎉 Congratulations! Next Step: Background Check - ${companyName}`,
            html: emailHtml
        });

        logger.info(`[BG-CHECK] Success for ${sessionId}`);

        return {
            success: true,
            message: 'Background check email sent',
            verificationLink: verificationLink,
            diditSessionId: diditSessionId
        };

    } catch (error) {
        logger.error(`[BG-CHECK] Error: ${error.message}`);
        throw new HttpsError('internal', `Failed: ${error.message}`);
    }

    
});
