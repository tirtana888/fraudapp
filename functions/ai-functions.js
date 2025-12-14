/**
 * AI FUNCTIONS MODULE
 * Handles all AI-related operations: Chatbot, Fraud Analysis, CV Parsing
 * Providers: Gemini (primary), OpenAI (fallback), Mistral (CV parsing)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Ensure admin is initialized (fallback if index.js fails)
if (!admin.apps.length) {
    console.warn('[AI-FUNCTIONS] Admin not initialized in index.js, initializing now...');
    admin.initializeApp();
}

// Safe lazy getters with error handling
const getDb = () => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        return admin.firestore();
    } catch (error) {
        console.error('[AI-FUNCTIONS] getDb error:', error);
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
        console.error('[AI-FUNCTIONS] getStorage error:', error);
        throw error;
    }
};

// --- SECRETS ---
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const openaiApiKey = defineSecret("OPENAI_API_KEY");
// NOTE: mistralApiKey moved to cv-parser.js

// ==========================================
// AI HELPER FUNCTION
// ==========================================

/**
 * Generate AI response with automatic fallback
 * Tries Gemini first, falls back to OpenAI if Gemini fails
 */
async function generateWithFallback(prompt, secrets, options = {}) {
    let responseText = "";
    let usedModel = "gemini-2.0-flash-exp";
    let tokensUsed = 0;

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

        // Extract token usage from Gemini response
        tokensUsed = result.response?.usageMetadata?.totalTokenCount || 0;
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

            // Extract token usage from OpenAI response
            tokensUsed = completion.usage?.total_tokens || 0;
        } catch (openaiError) {
            logger.error("Semua AI gagal:", openaiError.message);
            throw new Error("Sistem AI sedang sibuk. Silakan coba sesaat lagi.");
        }
    }
    return { text: responseText, model: usedModel, tokens: tokensUsed };
}

/**
 * Track token usage to Firestore
 * Saves AI token usage data for analytics
 */
async function trackTokenUsage(sessionId, model, tokens, feature) {
    if (!sessionId || tokens === 0) return;

    try {
        const db = getDb();
        const sessionRef = db.collection('interview-sessions').doc(sessionId);

        // Determine AI provider
        const provider = model.toLowerCase().includes('gpt') ? 'openai' :
            model.toLowerCase().includes('mistral') ? 'mistral' : 'gemini';

        // Calculate cost (adjust rates as needed)
        const costPerToken = provider === 'openai' ? 0.002 :
            provider === 'mistral' ? 0.0015 : 0.001;
        const cost = tokens * costPerToken;

        // Update session with token usage
        await sessionRef.set({
            aiUsage: {
                [provider]: admin.firestore.FieldValue.increment(tokens)
            },
            aiCost: {
                [provider]: admin.firestore.FieldValue.increment(cost)
            },
            tokenUsage: {
                [feature]: admin.firestore.FieldValue.increment(tokens)
            },
            lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        logger.info(`[TOKEN-TRACKING] ${sessionId}: ${tokens} tokens (${provider}, ${feature})`);
    } catch (error) {
        logger.error('[TOKEN-TRACKING] Error:', error.message);
        // Don't throw - token tracking failure shouldn't break AI functions
    }
}


// ==========================================
// EXPORTED FUNCTIONS
// ==========================================

/**
 * Generate AI Response for Interview Chatbot
 * Used during live candidate interviews
 */
exports.generateAIResponse = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [geminiApiKey, openaiApiKey]
}, async (request) => {
    const { prompt, assessmentData, history, role, sessionId } = request.data;
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

        // Track token usage if sessionId provided
        if (sessionId && result.tokens > 0) {
            await trackTokenUsage(sessionId, result.model, result.tokens, 'assessment');
        }

        return { success: true, response: result.text, provider: result.model };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Analyze Fraud Risk
 * Comprehensive fraud analysis using AI
 */
exports.analyzeFraudRisk = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [geminiApiKey, openaiApiKey]
}, async (request) => {
    const { role, history, structuredAssessment, sjtResults, financialStrainResults, sessionId } = request.data;
    if (!role || !history || !structuredAssessment) {
        throw new HttpsError('invalid-argument', 'Missing required data');
    }

    const conversationSummary = (Array.isArray(history) ? history : []).slice(-10).map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
    const structuredSummary = (Array.isArray(structuredAssessment) ? structuredAssessment : []).map(item => `[${item.category}] "${item.question}" -> ${item.response}/5`).join('\n');
    const sjtSummary = (Array.isArray(sjtResults) ? sjtResults : []).map((item, idx) => {
        const selected = item.options[item.selectedOptionIndex || 0];
        return `[SJT ${idx + 1}] "${selected?.label}" (Risk: ${selected?.riskWeight})`;
    }).join('\n');
    const financialSummary = (Array.isArray(financialStrainResults) ? financialStrainResults : []).map(item => `[FINANCIAL] "${item.question}" -> ${item.response}/5`).join('\n');

    const analysisPrompt = `Analyze fraud risk for ${role}:\n\nCONVERSATION:\n${conversationSummary}\n\nSTRUCTURED ASSESSMENT:\n${structuredSummary}\n\nBEHAVIORAL CHOICES:\n${sjtSummary}\n\nFINANCIAL STRAIN:\n${financialSummary}\n\nProvide JSON: {"scores":{"pressure":0-100,"opportunity":0-100,"rationalization":0-100},"riskLevel":"Low/Medium/High","summary":"...","redFlags":["..."],"recommendations":["..."],"sentimentBreakdown":{"positive":0-100,"neutral":0-100,"negative":0-100},"benchmarkComparison":{"candidateAvg":0-100,"companyAvg":0-100,"industryAvg":0-100}}`;

    try {
        const result = await generateWithFallback(analysisPrompt, { gemini: geminiApiKey, openai: openaiApiKey }, { maxTokens: 2000 });

        // Track token usage if sessionId provided
        if (sessionId && result.tokens > 0) {
            await trackTokenUsage(sessionId, result.model, result.tokens, 'fraudAnalysis');
        }

        const cleanJson = result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
                summary: "Analysis completed with fallback data due to processing error.",
                redFlags: ["Unable to perform detailed analysis"],
                recommendations: ["Manual review recommended"],
                sentimentBreakdown: { positive: 33, neutral: 34, negative: 33 },
                benchmarkComparison: { candidateAvg: 50, companyAvg: 48, industryAvg: 45 }
            },
            provider: 'manual-fallback'
        };
    }
});

// NOTE: parseDocumentWithMistral has been moved to cv-parser.js for isolation
// This prevents changes to AI chat/analysis from affecting CV parsing

