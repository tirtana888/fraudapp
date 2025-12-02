import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK Stabil (@google/generative-ai)
const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

// FALLBACK API KEY (OpenAI)
const OPENAI_API_KEY = "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";

// MODEL CONFIGURATION (Upgraded to latest stable versions)
const CHAT_MODEL_ID = "gemini-1.5-flash-latest"; 
const ANALYSIS_MODEL_ID_PRIMARY = "gemini-pro"; 

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
    FLAGS DETECTED FROM SURVEY:
    - ${flagsString}
    
    CORE OBJECTIVE:
    Validate if these flags represent a real fraud risk.
    
    RULES:
    1. MAINTAIN A PROFESSIONAL, INVESTIGATIVE TONE.
    2. STRICTLY OUTPUT ONLY ONE QUESTION IN BAHASA INDONESIA.
    3. DO NOT INCLUDE ANY ANALYSIS, LABELS (like "AI:", "Interviewer:"), OR META-COMMENTARY.
    4. IF CANDIDATE GIVES SHORT ANSWERS ("ya", "tidak"), ASK FOR ELABORATION.
    5. IF CANDIDATE IS CONFUSED ("tentang apa?"), CLARIFY THE CONTEXT.`;
};

// --- OPENAI HANDLERS ---
const callOpenAI_Chat = async (messages: any[], temperature: number = 0.7) => {
    try {
        console.log("Switching to OpenAI (Chat)...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                temperature: temperature,
                max_tokens: 150
            })
        });

        if (!response.ok) throw new Error("OpenAI API Error");
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim();
    } catch (error) {
        console.error("OpenAI Chat Failed:", error);
        return null;
    }
};

const callOpenAI_Analysis = async (systemPrompt: string, userPrompt: string): Promise<any> => {
    try {
        console.log("Switching to OpenAI (Analysis)...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" }, 
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 2000
            })
        });

        if (!response.ok) throw new Error("OpenAI API Error");
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("OpenAI Analysis Failed:", error);
        return null;
    }
};

// --- CHAT GENERATION ---
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

    // 1. Context Construction
    const recentHistory = history.slice(-10);
    const contextText = recentHistory.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
    const lastCandidateMessage = [...history].reverse().find(h => h.speaker === 'candidate' || h.speaker === 'user')?.text || "";

    // 2. System Instruction
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

    // 3. Dynamic Instruction based on Last Answer (Anti-Loop Logic)
    let dynamicInstruction = "TUGAS: Berikan 1 pertanyaan tindak lanjut yang relevan.";
    
    if (lastCandidateMessage.length < 5 || ["ya", "tidak", "bisa", "oke", "y"].includes(lastCandidateMessage.toLowerCase().trim())) {
        dynamicInstruction += " PERHATIAN: Kandidat menjawab terlalu singkat. Minta mereka menjelaskan alasan atau memberikan contoh konkret atas jawaban sebelumnya.";
    } else if (lastCandidateMessage.toLowerCase().includes("tentang apa") || lastCandidateMessage.toLowerCase().includes("maksudnya")) {
        dynamicInstruction += " PERHATIAN: Kandidat bingung. Jelaskan ulang konteks pertanyaan Anda sebelumnya dengan bahasa yang lebih sederhana, lalu tanya kembali.";
    } else {
        dynamicInstruction += " Gali lebih dalam mengenai perilaku (behavioral) atau situasi spesifik berdasarkan jawaban terakhir.";
    }

    const fullPrompt = `TRANSKRIP WAWANCARA:\n${contextText}\n\n${dynamicInstruction}`;

    // 4. Retry Mechanism (Gemini -> OpenAI)
    let attempts = 0;
    while (attempts < 2) {
        try {
            let resultText = "";

            if (attempts === 0) {
                // Try Gemini
                const model = genAI.getGenerativeModel({ 
                    model: CHAT_MODEL_ID, 
                    safetySettings, 
                    systemInstruction: systemInstructionText 
                });
                
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                    generationConfig: { maxOutputTokens: 150, temperature: 0.75 }
                });
                resultText = result.response.text();
            } else {
                // Try OpenAI Fallback
                console.log("Gemini failed, falling back to OpenAI...");
                const messages = [
                    { role: "system", content: systemInstructionText },
                    ...recentHistory.map(h => ({ role: h.speaker === 'ai' ? 'assistant' : 'user', content: h.text })),
                    { role: "user", content: dynamicInstruction }
                ];
                const openAiRes = await callOpenAI_Chat(messages);
                if (openAiRes) resultText = openAiRes;
            }

            // Cleaning & Validation
            let cleanText = resultText?.replace(/^AI:/i, "").replace(/^Interviewer:/i, "").trim();
            
            // Check for "lazy" responses
            if (cleanText && cleanText.length > 10 && !cleanText.includes("jelaskan lebih detail") && !cleanText.includes("contoh spesifik dari pengalaman Anda terkait hal ini")) {
                return cleanText;
            }
            
            // If text is valid but just generic, we might accept it if it's OpenAI (last resort)
            if (attempts === 1 && cleanText) return cleanText;

        } catch (error) {
            console.warn(`Attempt ${attempts + 1} failed.`, error);
        }
        attempts++;
        if (attempts < 2) await delay(1000);
    }

    // Final Fail-safe (Dynamic Generic)
    return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
};

// --- ANALYSIS GENERATION ---
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

    // Strategy: Gemini Pro -> OpenAI -> Manual
    try {
        const model = genAI.getGenerativeModel({ model: ANALYSIS_MODEL_ID_PRIMARY, safetySettings });
        const result = await model.generateContent(prompt);
        const parsed = robustJsonParse(result.response.text());
        if (parsed && parsed.scores) return parsed as FraudAnalysis;
        throw new Error("Primary analysis failed");
    } catch (error) {
        console.warn("Gemini Analysis failed, trying OpenAI...");
    }

    try {
        const openAiParsed = await callOpenAI_Analysis("You are a Senior Fraud Analyst. Output JSON only.", prompt);
        if (openAiParsed && openAiParsed.scores) return openAiParsed as FraudAnalysis;
    } catch (e) {
        console.error("OpenAI Analysis failed", e);
    }
    
    // Emergency Fallback
    const manualScores = calculateAssessmentScores(structuredAssessment, sjtResults, []);
    const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore) / 2;
    let manualRisk = RiskLevel.LOW;
    if (avgScore > 60) manualRisk = RiskLevel.HIGH; else if (avgScore > 40) manualRisk = RiskLevel.MEDIUM;

    return {
        scores: { pressure: manualScores.pressureScore, opportunity: manualScores.opportunityScore, rationalization: manualScores.rationalizationScore },
        riskLevel: manualRisk,
        summary: "Analisis AI GAGAL (Koneksi/Timeout). Skor dihitung dari kuesioner saja. Mohon review manual.",
        redFlags: ["ANALISIS AI GAGAL TOTAL"],
        recommendation: "Lakukan review manual transkrip dan jawaban.",
        isManualFallback: true,
        consistencyScore: 0,
        euphemismScore: 0,
    } as FraudAnalysis;
};