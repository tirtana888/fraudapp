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

/**
 * Analyze Fraud Risk
 * Comprehensive fraud analysis using AI
 */
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
    const financialSummary = (Array.isArray(financialStrainResults) ? financialStrainResults : []).map(item => `[FINANCIAL] "${item.question}" -> ${item.response}/5`).join('\n');

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

// NOTE: parseDocumentWithMistral has been moved to cv-parser.js for isolation
// This prevents changes to AI chat/analysis from affecting CV parsing

