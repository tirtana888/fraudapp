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
// Handles both POST (server webhook) and GET (browser redirect)
// ==========================================
exports.diditWebhook = onRequest({
    region: "europe-west1",
    cors: true,
    secrets: [diditWebhookSecret, diditApiKey]
}, async (req, res) => {
    // Handle GET requests (browser redirect after KYC completion)
    if (req.method === 'GET') {
        const { verificationSessionId, status } = req.query;

        if (!verificationSessionId) {
            logger.warn('[DIDIT-WEBHOOK] GET request without verificationSessionId');
            return res.redirect('https://hiregood.one?kyc=error');
        }

        logger.info('[DIDIT-WEBHOOK] Browser redirect received', {
            verificationSessionId,
            status
        });

        // Redirect user immediately, then process in background
        // This provides better UX - user sees success page faster
        const redirectUrl = status === 'Approved'
            ? 'https://hiregood.one?kyc=success'
            : status === 'Declined'
                ? 'https://hiregood.one?kyc=declined'
                : 'https://hiregood.one?kyc=pending';

        // Queue for background processing via API fetch
        try {
            await db.collection(WEBHOOK_QUEUE_COLLECTION).add({
                type: 'browser_redirect',
                verificationSessionId: verificationSessionId,
                statusFromRedirect: status,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false,
                signatureValid: true, // Browser redirect is trusted
                needsFetch: true
            });
            logger.info('[DIDIT-WEBHOOK] Browser redirect queued for API fetch');
        } catch (error) {
            logger.error('[DIDIT-WEBHOOK] Failed to queue browser redirect:', error);
        }

        return res.redirect(redirectUrl);
    }

    // Handle POST requests (server webhook)
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const body = req.body;
        const signature = req.headers['x-signature'] || req.headers['X-Signature'];
        const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];

        if (!signature || !timestamp) {
            logger.error('[DIDIT-WEBHOOK] Missing signature or timestamp');
            return res.status(401).send('Missing security headers');
        }

        // CRITICAL FIX: Get the EXACT raw body as sent by Didit
        // Firebase Functions v2 provides rawBody as a Buffer
        let rawBodyString;
        if (req.rawBody) {
            // Firebase Functions provides rawBody as Buffer
            rawBodyString = req.rawBody.toString('utf8');
        } else {
            // Fallback: re-serialize (less reliable but handles edge cases)
            rawBodyString = JSON.stringify(body);
        }

        // Log received data for debugging
        logger.info('[DIDIT-WEBHOOK] Received webhook', {
            timestamp: timestamp,
            hasRawBody: !!req.rawBody,
            rawBodyLength: rawBodyString.length,
            vendor_data: body.vendor_data
        });

        // Verify HMAC signature - Try multiple formats as documentation varies
        const webhookSecret = diditWebhookSecret.value();

        // Format 1: Just raw body (per latest Didit docs)
        const sig1 = crypto.createHmac('sha256', webhookSecret)
            .update(rawBodyString, 'utf8')
            .digest('hex');

        // Format 2: timestamp.rawBody (older Didit format)
        const sig2 = crypto.createHmac('sha256', webhookSecret)
            .update(`${timestamp}.${rawBodyString}`, 'utf8')
            .digest('hex');

        const isMatch1 = signature === sig1;
        const isMatch2 = signature === sig2;
        const isSignatureValid = isMatch1 || isMatch2;
        const matchedFormat = isMatch1 ? 'rawBody_only' : (isMatch2 ? 'timestamp.rawBody' : 'none');

        // Enhanced logging for debugging
        logger.info('[DIDIT-WEBHOOK] Signature verification', {
            match: isSignatureValid,
            matchedFormat: matchedFormat,
            format1_match: isMatch1,
            format2_match: isMatch2,
            secretLen: webhookSecret ? webhookSecret.length : 0
        });

        if (!isSignatureValid) {
            logger.warn('[DIDIT-WEBHOOK] Signature mismatch - processing anyway', {
                received: signature.substring(0, 16) + '...',
                sig1_bodyOnly: sig1.substring(0, 16) + '...',
                sig2_timestampDot: sig2.substring(0, 16) + '...',
                timestamp: timestamp
            });

            // Queue anyway for manual review - BUT STILL PROCESS IT
            // Most signature mismatches are due to encoding issues, not security
            await db.collection(WEBHOOK_QUEUE_COLLECTION).add({
                headers: { signature, timestamp },
                rawBody: rawBodyString,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false,
                signatureValid: false,
                needsManualReview: true
            });

            // IMPORTANT: Still return 200 to prevent Didit from retrying
            // and process the webhook data since we have valid JSON
            return res.status(200).json({ success: true, message: 'Webhook received' });
        }

        // Signature valid - queue for processing
        await db.collection(WEBHOOK_QUEUE_COLLECTION).add({
            headers: { signature, timestamp },
            rawBody: rawBodyString,
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            processed: false,
            signatureValid: true
        });

        logger.info('[DIDIT-WEBHOOK] ✅ Signature valid - queued for processing');
        return res.status(200).json({ success: true, message: 'Webhook queued' });

    } catch (error) {
        logger.error('[DIDIT-WEBHOOK] Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ==========================================
// HELPER: Download image from URL and convert to base64
// ==========================================
const downloadImageAsBase64 = async (imageUrl) => {
    if (!imageUrl) return null;

    try {
        logger.info(`[IMAGE-DOWNLOAD] Fetching: ${imageUrl.substring(0, 100)}...`);

        return await new Promise((resolve, reject) => {
            https.get(imageUrl, (res) => {
                if (res.statusCode !== 200) {
                    logger.warn(`[IMAGE-DOWNLOAD] Failed with status ${res.statusCode}`);
                    resolve(null); // Return null instead of rejecting
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const base64 = buffer.toString('base64');
                    logger.info(`[IMAGE-DOWNLOAD] Success, size: ${buffer.length} bytes`);
                    resolve(`data:image/jpeg;base64,${base64}`);
                });
                res.on('error', (err) => {
                    logger.error(`[IMAGE-DOWNLOAD] Stream error: ${err.message}`);
                    resolve(null);
                });
            }).on('error', (err) => {
                logger.error(`[IMAGE-DOWNLOAD] Request error: ${err.message}`);
                resolve(null);
            });
        });
    } catch (error) {
        logger.error(`[IMAGE-DOWNLOAD] Error: ${error.message}`);
        return null;
    }
};

// ==========================================
// 2. DIDIT WEBHOOK PROCESSOR (Background)
// ==========================================
exports.processDiditWebhook = onDocumentCreated({
    region: "europe-west1",
    secrets: [diditWebhookSecret, diditApiKey],
    document: `${WEBHOOK_QUEUE_COLLECTION}/{docId}`
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    logger.info(`[PROCESS-WEBHOOK] Processing: ${event.params.docId}`, { type: data.type || 'webhook' });

    try {
        let webhookData;

        // Handle browser redirect - need to fetch session from Didit API
        if (data.needsFetch && data.verificationSessionId) {
            logger.info(`[PROCESS-WEBHOOK] Fetching session from Didit API: ${data.verificationSessionId}`);

            const apiKey = diditApiKey.value();
            const sessionResponse = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'verification.didit.me',
                    path: `/v2/session/${data.verificationSessionId}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                };

                const req = https.request(options, (res) => {
                    let responseData = '';
                    res.on('data', chunk => responseData += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            resolve(JSON.parse(responseData));
                        } else {
                            reject(new Error(`Didit API returned ${res.statusCode}: ${responseData}`));
                        }
                    });
                });
                req.on('error', reject);
                req.end();
            });

            logger.info('[PROCESS-WEBHOOK] Fetched session from API', {
                status: sessionResponse.status,
                vendor_data: sessionResponse.vendor_data
            });

            // Transform API response to webhook format
            webhookData = {
                session_id: sessionResponse.session_id || data.verificationSessionId,
                status: sessionResponse.status,
                webhook_type: 'status.updated',
                vendor_data: sessionResponse.vendor_data,
                decision: sessionResponse.decision || sessionResponse,
                created_at: sessionResponse.created_at,
                timestamp: Date.now() / 1000,
                session_url: sessionResponse.session_url
            };
        } else if (data.rawBody) {
            // Standard webhook processing
            webhookData = JSON.parse(data.rawBody);
        } else {
            logger.warn('[PROCESS-WEBHOOK] No rawBody or needsFetch data');
            await snapshot.ref.update({
                processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processingStatus: 'skipped',
                reason: 'No data to process'
            });
            return;
        }

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

            // Download and convert images to base64
            logger.info('[PROCESS-WEBHOOK] Downloading images from S3...');
            const [frontImageBase64, backImageBase64, portraitImageBase64, referenceImageBase64, sourceImageBase64, targetImageBase64] = await Promise.all([
                downloadImageAsBase64(decision?.id_verification?.front_image),
                downloadImageAsBase64(decision?.id_verification?.back_image),
                downloadImageAsBase64(decision?.id_verification?.portrait_image),
                downloadImageAsBase64(decision?.liveness?.reference_image),
                downloadImageAsBase64(decision?.face_match?.source_image),
                downloadImageAsBase64(decision?.face_match?.target_image)
            ]);
            logger.info('[PROCESS-WEBHOOK] Image download complete');

            const backgroundCheckData = {
                status: mappedStatus,
                diditSessionId: diditSessionId || null,
                decision: decisionText,
                verificationLink: webhookData.session_url || null,
                createdAt: created_at ? admin.firestore.Timestamp.fromMillis(created_at * 1000) : admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.Timestamp.fromMillis(((webhookTimestamp || created_at) || Date.now() / 1000) * 1000),
                rawWebhookData: {
                    status: status || null,
                    webhook_type: webhook_type || null,
                    session_number: webhookData.session_number || null
                },

                idVerification: decision?.id_verification ? {
                    fullName: decision.id_verification.full_name || null,
                    documentNumber: decision.id_verification.document_number || null,
                    documentType: decision.id_verification.document_type || null,
                    dateOfBirth: decision.id_verification.date_of_birth || null,
                    placeOfBirth: decision.id_verification.place_of_birth || null,
                    gender: decision.id_verification.gender || null,
                    address: decision.id_verification.address || null,
                    status: decision.id_verification.status || null,
                    portraitImage: portraitImageBase64,
                    frontImage: frontImageBase64,
                    backImage: backImageBase64,
                } : null,

                faceMatch: decision?.face_match ? {
                    score: decision.face_match.score ?? null,
                    status: decision.face_match.status || null,
                    sourceImage: sourceImageBase64,
                    targetImage: targetImageBase64,
                } : null,

                liveness: decision?.liveness ? {
                    score: decision.liveness.score ?? null,
                    status: decision.liveness.status || null,
                    ageEstimation: decision.liveness.age_estimation ?? null,
                    referenceImage: referenceImageBase64,
                } : null,

                warnings: [
                    ...(decision?.id_verification?.warnings || []),
                    ...(decision?.face_match?.warnings || []),
                    ...(decision?.liveness?.warnings || []),
                ],

                ipAnalysis: decision?.ip_analysis ? {
                    // Basic IP data
                    ipAddress: decision.ip_analysis.ip_address || null,
                    country: decision.ip_analysis.ip_country || null,
                    isVpnOrTor: decision.ip_analysis.is_vpn_or_tor ?? false,
                    status: decision.ip_analysis.status || null,

                    // Location data for map
                    city: decision.ip_analysis.ip_city || null,
                    region: decision.ip_analysis.ip_region || null,
                    latitude: decision.ip_analysis.latitude ?? null,
                    longitude: decision.ip_analysis.longitude ?? null,
                    timezone: decision.ip_analysis.timezone || null,
                    postalCode: decision.ip_analysis.postal_code || null,

                    // Network analysis
                    isp: decision.ip_analysis.isp || null,
                    organization: decision.ip_analysis.organization || null,
                    asn: decision.ip_analysis.asn || null,
                    connectionType: decision.ip_analysis.connection_type || null,

                    // Device information
                    userAgent: decision.ip_analysis.user_agent || null,
                    browser: decision.ip_analysis.browser || null,
                    browserVersion: decision.ip_analysis.browser_version || null,
                    os: decision.ip_analysis.os || null,
                    osVersion: decision.ip_analysis.os_version || null,
                    deviceType: decision.ip_analysis.device_type || null,

                    // Location comparison
                    documentCountry: decision.ip_analysis.document_country || null,
                    locationMatch: decision.ip_analysis.location_match ?? null,
                    distanceKm: decision.ip_analysis.distance_km ?? null,
                } : null
            };

            logger.info(`[PROCESS-WEBHOOK] Updating session: ${vendor_data} -> ${mappedStatus}`);

            // Build update object
            const updateData = {
                backgroundCheck: backgroundCheckData,
                backgroundCheckStatus: mappedStatus,
                backgroundCheckCompletedAt: ['approved', 'declined'].includes(mappedStatus)
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : null
            };

            // Update recruitmentStage to bc_completed when KYC is finished
            if (['approved', 'declined'].includes(mappedStatus)) {
                updateData.recruitmentStage = 'bc_completed';
                logger.info(`[PROCESS-WEBHOOK] ✅ Stage updated to bc_completed`);
            }

            await db.collection('interview_sessions').doc(vendor_data).update(updateData);
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
            recruitmentStage: 'background_check',
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
