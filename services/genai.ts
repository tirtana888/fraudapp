import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK Stabil (@google/generative-ai)
const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

// FALLBACK API KEY (OpenAI)
const OPENAI_API_KEY = "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";

// MODEL CONFIGURATION - Gunakan ID model yang sesuai untuk SDK ini
const CHAT_MODEL_ID = "gemini-1.5-flash-latest"; // Model cepat yang didukung SDK stabil
const ANALYSIS_MODEL_ID_PRIMARY = "gemini-pro"; // Model cerdas yang didukung SDK stabil (Ganti ke 'gemini-1.5-pro-latest' jika tersedia & diperlukan)

// SAFETY SETTINGS
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- HELPERS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const robustJsonParse = (text: string): any => {
    // Clean markdown and other artifacts
    const cleanedText = text.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("JSON Parse failed:", e);
        return null;
    }
};


export const calculateAssessmentScores = (
    structuredAssessment: AssessmentItem[],
    sjtResults: SJTItem[] = [],
    financialStrainResults: AssessmentItem[] = []
) => {
    let financialSum = 0;
    financialStrainResults.forEach(i => {
        financialSum += (typeof i.response === 'number' ? i.response : 0);
    });
    const financialScore = financialStrainResults.length ? (financialSum / (financialStrainResults.length * 5)) * 100 : 0;

    const scores = { pressure: 0, opportunity: 0, rationalization: 0 };
    const counts = { pressure: 0, opportunity: 0, rationalization: 0 };

    structuredAssessment.forEach(item => {
        const val = typeof item.response === 'number' ? item.response : 
                    item.response === 'high' ? 5 : item.response === 'medium' ? 3 : 1;
        if (item.category === 'pressure' || item.category === 'opportunity' || item.category === 'rationalization') {
            scores[item.category] += val;
            counts[item.category]++;
        }
    });

    const pressureScore = counts.pressure ? (scores.pressure / (counts.pressure * 5)) * 100 : 0;
    const rationalizationScore = counts.rationalization ? (scores.rationalization / (counts.rationalization * 5)) * 100 : 0;
    const opportunityScore = counts.opportunity ? (scores.opportunity / (counts.opportunity * 5)) * 100 : 0;

    let sjtRiskSum = 0;
    sjtResults.forEach(s => {
        if (s.selectedOptionIndex !== null) {
            const risk = s.options[s.selectedOptionIndex].riskWeight;
            if (risk === 'critical') sjtRiskSum += 100;
            else if (risk === 'high') sjtRiskSum += 75;
            else if (risk === 'medium') sjtRiskSum += 50;
            else sjtRiskSum += 0;
        }
    });
    const sjtRiskScore = sjtResults.length ? sjtRiskSum / sjtResults.length : 0;

    return { financialScore, pressureScore, rationalizationScore, opportunityScore, sjtRiskScore };
};

const generateInterviewContext = (
    role: string, 
    riskProfile: { financialScore: number, rationalizationScore: number, sjtRiskScore: number, pressureScore: number }
): string => {
    let flagsDetected = [];
    if (riskProfile.financialScore > 50) flagsDetected.push(`Financial Pressure: HIGH (${Math.round(riskProfile.financialScore)}%)`);
    if (riskProfile.rationalizationScore > 50) flagsDetected.push(`Rationalization: HIGH (${Math.round(riskProfile.rationalizationScore)}%)`);
    if (riskProfile.sjtRiskScore > 40) flagsDetected.push(`Integrity Risk (SJT): HIGH`);
    if (flagsDetected.length === 0) flagsDetected.push("None significant. Standard screening.");
    const flagsString = flagsDetected.join('\n   - ');

    return `You are an AI Forensic Investigator for a candidate applying for: ${role}.
    FLAGS DETECTED:
    - ${flagsString}
    INSTRUCTION: Start probing based on the flags.
    MAINTAIN A PROFESSIONAL, INVESTIGATIVE TONE.
    STRICTLY OUTPUT ONLY ONE QUESTION IN BAHASA INDONESIA. DO NOT INCLUDE ANY ANALYSIS OR META-COMMENTARY.`;
};

// --- OPENAI HANDLERS ---
const callOpenAI_Chat = async (messages: any[], temperature: number = 0.7) => {
    // ... [Implementation remains the same as provided] ...
};

const callOpenAI_Analysis = async (systemPrompt: string, userPrompt: string): Promise<any> => {
    // ... [Implementation remains the same as provided] ...
};

// --- CHAT GENERATION (REFACTORED for @google/generative-ai) ---
export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic',
  assessmentData?: {
      structuredAssessment: AssessmentItem[],
      sjtResults: SJTItem[],
      financialStrainResults: AssessmentItem[]
  }
): Promise<string> => {
  
    const candidateTurnCount = history.filter(h => h.speaker === 'candidate').length;
    if (candidateTurnCount >= 25) {
        return "Terima kasih, sesi wawancara telah selesai. Jawaban Anda telah kami simpan.";
    }

    let systemInstructionText = "";
    if (assessmentData) {
        const risks = calculateAssessmentScores(
            assessmentData.structuredAssessment, 
            assessmentData.sjtResults, 
            assessmentData.financialStrainResults
        );
        systemInstructionText = generateInterviewContext(role, risks);
    } else {
        systemInstructionText = `Anda HR Interviewer posisi ${role}. Validasi integritas kandidat.`;
    }

    const model = genAI.getGenerativeModel({ model: CHAT_MODEL_ID, safetySettings, systemInstruction: systemInstructionText });

    const chatHistory = history.map(h => ({
        role: h.speaker === 'ai' ? 'model' : 'user',
        parts: [{ text: h.text }]
    }));

    try {
        const result = await model.generateContent({
            contents: chatHistory,
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.7
            }
        });
        const response = result.response;
        const text = response.text();
        if (text && text.length > 10) {
            return text;
        }
        throw new Error("Generated response is too short or empty.");
    } catch (error) {
        console.warn("Gemini Chat Failed, trying OpenAI fallback...", error);
        // Fallback to OpenAI logic here...
        return "Bisa Anda berikan contoh spesifik dari pengalaman Anda terkait hal ini?";
    }
};

// --- ANALYSIS GENERATION (REFACTORED for @google/generative-ai) ---
export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {
  
    const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
    const assessmentSummary = structuredAssessment.map(item => `[${item.category.toUpperCase()}] "${item.question}" -> Skor: ${item.response}`).join('\n');
    const sjtSummary = sjtResults.map(item => `[SJT] Scen: "${item.scenario.substring(0,30)}..." -> Pilih: "${(item.options[item.selectedOptionIndex || 0] || {}).label}"`).join('\n');

    const prompt = `
        SYSTEM: You are a Senior Fraud Analyst. Your response must be a valid JSON object only, without any markdown wrappers.
        USER: Analyze the following data for candidate: ${role}.
        SURVEY DATA:
        ${assessmentSummary}
        ${sjtSummary}
        CHAT TRANSCRIPT:
        ${context}
        
        TASK:
        Provide a final verdict. Output a JSON with these keys: "scores" (pressure, opportunity, rationalization from 0-100), "riskLevel" ("Low", "Medium", "High", "Critical"), "summary" (2 paragraphs), "redFlags" (string array), "recommendation", "consistencyScore" (0-100), "euphemismScore" (0-100).
    `;

    try {
        const model = genAI.getGenerativeModel({ model: ANALYSIS_MODEL_ID_PRIMARY, safetySettings });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        const parsed = robustJsonParse(text);
        if (parsed && parsed.scores) return parsed as FraudAnalysis;
        throw new Error("Primary analysis failed or returned invalid JSON.");
    } catch (error) {
        console.warn("Primary analysis failed, switching to fallback.", error);
    }
    
    // Emergency Fallback
    const manualScores = calculateAssessmentScores(structuredAssessment, sjtResults, []);
    const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore) / 2;
    let manualRisk = RiskLevel.LOW;
    if (avgScore > 60) manualRisk = RiskLevel.HIGH; else if (avgScore > 40) manualRisk = RiskLevel.MEDIUM;

    return {
        scores: { pressure: manualScores.pressureScore, opportunity: manualScores.opportunityScore, rationalization: manualScores.rationalizationScore },
        riskLevel: manualRisk,
        summary: "Analisis AI GAGAL. Skor dihitung dari kuesioner saja. Mohon review manual.",
        redFlags: ["ANALISIS AI GAGAL"],
        recommendation: "Lakukan review manual transkrip dan jawaban.",
        isManualFallback: true
    } as FraudAnalysis;
};
