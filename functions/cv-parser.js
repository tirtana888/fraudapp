/**
 * CV PARSER MODULE (ISOLATED)
 * Handles document parsing with Mistral AI
 * Isolated from other AI functions to prevent deployment conflicts
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// Initialize admin if not already initialized
if (!admin.apps.length) {
    console.log('[CV-PARSER] Initializing Firebase Admin...');
    admin.initializeApp();
}

// Safe getters with error handling
const getDb = () => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        return admin.firestore();
    } catch (error) {
        logger.error('[CV-PARSER] getDb error:', error);
        throw error;
    }
};

const getStorage = () => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        return admin.storage();
    } catch (error) {
        logger.error('[CV-PARSER] getStorage error:', error);
        throw error;
    }
};

// Secret for Mistral API
const mistralApiKey = defineSecret("MISTRAL_API_KEY");

/**
 * Parse CV/Resume with Mistral AI
 * Extracts structured data from PDF/DOCX documents
 * 
 * @param {Object} request.data
 * @param {string} request.data.documentUrl - Firebase Storage URL of the document
 * @param {string} request.data.sessionId - Session ID to update with parsed data
 * @returns {Object} { success: true, parsedData: {...} }
 */
exports.parseDocumentWithMistral = onCall({
    region: 'europe-west1',
    cors: true,
    timeoutSeconds: 300,
    memory: '2GiB',
    secrets: [mistralApiKey]
}, async (request) => {
    const { documentUrl, sessionId } = request.data;

    logger.info('[CV-PARSER] Starting document parsing', {
        sessionId,
        hasUrl: !!documentUrl
    });

    if (!documentUrl || !sessionId) {
        throw new HttpsError('invalid-argument', 'Missing documentUrl or sessionId');
    }

    try {
        // Step 1: Download document from Firebase Storage
        const bucket = getStorage().bucket();
        const urlObj = new URL(documentUrl);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);

        if (!pathMatch) {
            throw new HttpsError('invalid-argument', 'Invalid Firebase Storage URL format');
        }

        const filePath = decodeURIComponent(pathMatch[1]);
        const file = bucket.file(filePath);

        logger.info('[CV-PARSER] Downloading file from Storage', { filePath });
        const [fileBuffer] = await file.download();

        // Step 2: Extract text based on file type
        let documentText = "";
        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || '';

        logger.info('[CV-PARSER] Processing file', {
            contentType,
            size: fileBuffer.length
        });

        if (contentType.includes('pdf')) {
            const data = await pdf(fileBuffer);
            documentText = data.text || "";
            logger.info('[CV-PARSER] Extracted text from PDF', {
                length: documentText.length
            });
        } else if (contentType.includes('word') || contentType.includes('document')) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            documentText = result.value || "";
            logger.info('[CV-PARSER] Extracted text from DOCX', {
                length: documentText.length
            });
        } else {
            // Fallback: try to read as text
            documentText = fileBuffer.toString('utf8');
            logger.info('[CV-PARSER] Read as plain text', {
                length: documentText.length
            });
        }

        // Clean up whitespace
        documentText = documentText.replace(/\s+/g, ' ').trim();

        if (!documentText || documentText.length < 50) {
            throw new HttpsError('invalid-argument', 'Document appears to be empty or too short');
        }

        // Step 3: Call Mistral AI for parsing
        logger.info('[CV-PARSER] Calling Mistral AI for parsing...');

        const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
            model: 'mistral-large-latest',
            messages: [{
                role: 'system',
                content: 'You are a CV/Resume parser. Extract structured data and return ONLY valid JSON with these fields: {fullName, email, phone, address, summary, totalYearsExperience, experience: [{title, company, duration, description}], education: [{degree, institution, year}], skills: [], certifications: [], languages: []}. Do not include any markdown formatting or code blocks.'
            }, {
                role: 'user',
                content: `Extract CV data from this text:\n\n${documentText.substring(0, 15000)}`
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

        logger.info('[CV-PARSER] Mistral AI response received');

        // Step 4: Parse AI response
        const aiContent = response.data.choices[0].message.content;

        // Remove markdown code blocks if present
        const cleanJson = aiContent.replace(/```json\s*|\s*```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (parseError) {
            logger.error('[CV-PARSER] JSON parse error', {
                error: parseError.message,
                content: cleanJson.substring(0, 200)
            });
            throw new HttpsError('internal', 'Failed to parse AI response as JSON');
        }

        // Step 5: Update Firestore session with parsed data
        logger.info('[CV-PARSER] Updating Firestore session', { sessionId });

        await getDb().collection('interview_sessions').doc(sessionId).update({
            cvParsedData: parsed,
            cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
            documentProcessed: true
        });

        logger.info('[CV-PARSER] ✅ Document parsing completed successfully', {
            sessionId,
            hasName: !!parsed.fullName,
            hasEmail: !!parsed.email,
            experienceCount: parsed.experience?.length || 0
        });

        return {
            success: true,
            parsedData: parsed
        };

    } catch (error) {
        logger.error('[CV-PARSER] ❌ Parsing failed', {
            error: error.message,
            stack: error.stack?.substring(0, 500),
            sessionId
        });

        // Provide helpful error messages
        if (error.code === 'ECONNABORTED') {
            throw new HttpsError('deadline-exceeded', 'Mistral AI request timed out');
        }

        if (error.response?.status === 401) {
            throw new HttpsError('unauthenticated', 'Invalid Mistral API key');
        }

        if (error.response?.status === 429) {
            throw new HttpsError('resource-exhausted', 'Mistral API rate limit exceeded');
        }

        throw new HttpsError('internal', `Parsing failed: ${error.message}`);
    }
});
