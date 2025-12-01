
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";
import { PLAN_LIMITS } from "../constants/plans";

// Inisialisasi SDK Stabil (@google/genai)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// FALLBACK API KEY (OpenAI)
const OPENAI_API_KEY = "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";

// MODEL CONFIGURATION
const CHAT_MODEL_ID = "gemini-2.5-flash"; 
const ANALYSIS_MODEL_ID_PRIMARY = "gemini-3-pro-preview"; 
const ANALYSIS_MODEL_ID_BACKUP = "gemini-2.5-flash"; // Backup model for analysis

// SAFETY SETTINGS
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- HELPERS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const calculateAssessmentScores = (
    structuredAssessment: AssessmentItem[],
    sjtResults: SJTItem[] = [],
    financialStrainResults: AssessmentItem[] = []
) => {
    // 1. Calculate Financial Strain
    let financialSum = 0;
    financialStrainResults.forEach(i => {
        financialSum += (typeof i.response === 'number' ? i.response : 0);
    });
    const financialScore = financialStrainResults.length ? (financialSum / (financialStrainResults.length * 5)) * 100 : 0;

    // 2. Calculate Fraud Triangle Scores
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

    // 3. SJT Integrity Score
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
    
    // Determine FLAGS DETECTED based on risk profile
    let flagsDetected = [];
    if (riskProfile.financialScore > 50) flagsDetected.push(`Financial Pressure: HIGH (${Math.round(riskProfile.financialScore)}%)`);
    if (riskProfile.rationalizationScore > 50) flagsDetected.push(`Rationalization: HIGH (${Math.round(riskProfile.rationalizationScore)}%)`);
    if (riskProfile.sjtRiskScore > 40) flagsDetected.push(`Integrity Risk (SJT): HIGH`);
    if (riskProfile.pressureScore > 60) flagsDetected.push(`General Pressure: HIGH`);

    if (flagsDetected.length === 0) flagsDetected.push("None significant. Standard screening.");

    const flagsString = flagsDetected.join('\n   - ');

    // Persona & Instruction
    return `
    You are an AI Forensic Investigator. The candidate is applying for: ${role}.
    The candidate has completed a preliminary survey.
    
    FLAGS DETECTED:
    - ${flagsString}
    
    INSTRUCTION:
    Do not ask generic questions. Start the conversation by probing their situation delicately based on the FLAGS above.
    
    - If Financial Pressure is HIGH: Verify if this correlates with potential fraud risk (e.g., desperation).
    - If Rationalization is HIGH: Play 'Devil's Advocate' to test their moral compass.
    - If Integrity Risk is HIGH: Ask about ethical dilemmas they faced.
    
    Maintain a professional but investigative tone. 
    OUTPUT HANYA SATU PERTANYAAN DALAM BAHASA INDONESIA.
    `;
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
        return data.choices[0].message.content?.trim();
    } catch (error) {
        console.error("OpenAI Chat Failed:", error);
        return null;
    }
};

const callOpenAI_Analysis = async (systemPrompt: string, userPrompt: string): Promise<any> => {
    try {
        console.log("Switching to OpenAI (Analysis - GPT-4o)...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" }, // FORCE JSON
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
        const content = data.choices[0].message.content;
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
  // Increase turn limit to prevent premature cutoff
  if (candidateTurnCount >= 25) {
      return "Terima kasih, sesi wawancara telah selesai. Jawaban Anda telah kami simpan.";
  }

  const recentHistory = history.slice(-8); 
  const context = recentHistory.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const lastCandidateMessage = [...history].reverse().find(h => h.speaker === 'candidate' || h.speaker === 'user')?.text || "";

  let systemInstructionText = "";
  
  if (assessmentData) {
      const risks = calculateAssessmentScores(
          assessmentData.structuredAssessment, 
          assessmentData.sjtResults, 
          assessmentData.financialStrainResults
      );
      // Use the new Context-Aware Generator
      systemInstructionText = generateInterviewContext(role, risks);
  } else {
      systemInstructionText = `Anda HR Interviewer posisi ${role}. Validasi integritas kandidat.`;
  }

  let attempts = 0;
  const maxRetries = 3;

  while (attempts < maxRetries) {
      let dynamicPrompt = `Transkrip:\n${context}\n\nJawaban Terakhir Kandidat: "${lastCandidateMessage}"\n\nTUGAS: Buat 1 pertanyaan tindak lanjut spesifik.`;
      
      let resultText: string | null | undefined = null;

      try {
          if (attempts === 0) {
              // Priority 1: Gemini Flash
              const response = await Promise.race([
                  ai.models.generateContent({
                    model: CHAT_MODEL_ID, 
                    contents: dynamicPrompt,
                    config: { 
                        systemInstruction: systemInstructionText, 
                        safetySettings,
                        maxOutputTokens: 150, 
                        temperature: 0.7 + (attempts * 0.1)
                    }
                  }),
                  new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
              ]);
              resultText = response.text;
          } else {
              throw new Error("Trigger Fallback"); 
          }
      } catch (geminiError) {
          console.warn(`Gemini attempt ${attempts + 1} failed. Trying OpenAI GPT-4o...`);
          const openAiMessages = [
              { role: "system", content: systemInstructionText },
              ...recentHistory.map(h => ({ role: h.speaker === 'ai' ? 'assistant' : 'user', content: h.text })),
              { role: "user", content: dynamicPrompt }
          ];
          resultText = await callOpenAI_Chat(openAiMessages);
      }

      let cleanText = resultText?.trim();
      if (cleanText) {
          cleanText = cleanText.replace(/Analisis:.*?\n/gi, "").replace(/^AI:/i, "").replace(/Interviewer:/i, "").trim();
      }

      // STRICT VALIDATION
      if (cleanText && cleanText.length > 10 && !cleanText.includes("jelaskan lebih detail")) {
          return cleanText;
      }

      attempts++;
      if (attempts < maxRetries) await delay(1000);
  }

  // LAST RESORT IF BOTH AI FAIL
  return "Bisa Anda berikan contoh spesifik dari pengalaman Anda terkait hal ini?";
};

// --- ANALYSIS GENERATION (ROBUST FALLBACK) ---
export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {
  
  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const isEnterprise = tier === 'Enterprise';

  // Format Data for Prompt
  const assessmentSummary = structuredAssessment.map(item => 
    `[${item.category.toUpperCase()}] "${item.question}" -> Skor: ${item.response}`
  ).join('\n');

  const sjtSummary = sjtResults.map(item => {
      const selected = item.options[item.selectedOptionIndex || 0] || { label: "Tidak Menjawab", riskWeight: "unknown" };
      return `[SJT] Scen: "${item.scenario.substring(0,30)}..." -> Pilih: "${selected.label}" (Risk: ${selected.riskWeight})`;
  }).join('\n');

  const promptContent = `
    Anda adalah Senior Fraud Analyst. Lakukan FINAL VERDICT untuk kandidat: ${role}.
    
    DATA 1: HASIL SURVEY
    ${assessmentSummary}
    ${sjtSummary}
    
    DATA 2: TRANSKRIP CHAT
    ${context}

    TUGAS:
    Analisis konsistensi, deteksi pengakuan risiko, dan berikan skor akhir.
    Return JSON ONLY.
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
        scores: {
            type: Type.OBJECT,
            properties: {
                pressure: { type: Type.NUMBER },
                opportunity: { type: Type.NUMBER },
                rationalization: { type: Type.NUMBER }
            },
            required: ["pressure", "opportunity", "rationalization"]
        },
        riskLevel: { type: Type.STRING },
        summary: { type: Type.STRING },
        redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendation: { type: Type.STRING },
        consistencyScore: { type: Type.NUMBER },
        euphemismScore: { type: Type.NUMBER },
        sentimentBreakdown: {
            type: Type.OBJECT,
            properties: {
                positive: { type: Type.NUMBER },
                neutral: { type: Type.NUMBER },
                negative: { type: Type.NUMBER }
            }
        },
        benchmarkComparison: {
            type: Type.OBJECT,
            properties: {
                candidateAvg: { type: Type.NUMBER },
                companyAvg: { type: Type.NUMBER },
                industryAvg: { type: Type.NUMBER }
            }
        }
    }
  };

  const cleanJson = (text: string) => text.replace(/^```json\s*/, "").replace(/\s*```$/, "");

  // --- ROBUST ANALYSIS RETRY LOOP ---
  // Strategy: Gemini Pro -> Gemini Flash -> OpenAI GPT-4o -> Fallback
  
  // 1. Attempt Gemini 3 Pro
  try {
      console.log(`Analyzing with Gemini 3 Pro...`);
      const response = await Promise.race([
          ai.models.generateContent({
            model: ANALYSIS_MODEL_ID_PRIMARY,
            contents: promptContent,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                safetySettings
            }
          }),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
      ]);
      const parsed = JSON.parse(cleanJson(response.text || '{}')) as FraudAnalysis;
      if (parsed && parsed.scores) return parsed;
  } catch (error) {
      console.warn(`Gemini 3 Pro Failed. Retrying...`);
  }

  // 2. Attempt Gemini Flash
  try {
      console.log(`Analyzing with Gemini Flash...`);
      const response = await ai.models.generateContent({
          model: ANALYSIS_MODEL_ID_BACKUP,
          contents: promptContent,
          config: {
              responseMimeType: "application/json",
              responseSchema: schema,
              safetySettings
          }
      });
      const parsed = JSON.parse(cleanJson(response.text || '{}')) as FraudAnalysis;
      if (parsed && parsed.scores) return parsed;
  } catch (error) {
      console.warn(`Gemini Flash Failed. Switching to OpenAI...`);
  }

  // 3. Attempt OpenAI GPT-4o (New Layer)
  try {
      const openAiParsed = await callOpenAI_Analysis(
          "Anda adalah Senior Fraud Analyst. Output harus dalam format JSON sesuai schema yang diminta.",
          promptContent + "\n\nSCHEMA:\n" + JSON.stringify(schema.properties)
      );
      if (openAiParsed && openAiParsed.scores) {
          console.log("OpenAI Analysis Success.");
          return openAiParsed as FraudAnalysis;
      }
  } catch (error) {
      console.error("OpenAI Analysis Failed.");
  }

  // --- FINAL FALLBACK (NEVER THROW ERROR) ---
  console.error("All Analysis Models Failed. Using Statistical Fallback.");
  
  // Calculate scores manually from survey to ensure report is not empty
  const manualScores = calculateAssessmentScores(structuredAssessment, sjtResults, []);
  
  let manualRisk = RiskLevel.LOW;
  const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore + manualScores.opportunityScore) / 3;
  if (avgScore > 75) manualRisk = RiskLevel.CRITICAL;
  else if (avgScore > 50) manualRisk = RiskLevel.HIGH;
  else if (avgScore > 30) manualRisk = RiskLevel.MEDIUM;

  return {
    scores: { 
        pressure: manualScores.pressureScore || 50, 
        opportunity: manualScores.opportunityScore || 50, 
        rationalization: manualScores.rationalizationScore || 50 
    },
    riskLevel: manualRisk,
    summary: "Analisis AI mendalam tidak tersedia karena gangguan jaringan pada semua provider (Google & OpenAI). Skor dihitung berdasarkan jawaban kuesioner saja. Mohon review manual transkrip chat untuk detail lebih lanjut.",
    redFlags: ["Analisis Otomatis Tertunda", "Cek Transkrip Manual"],
    recommendation: "Lakukan wawancara tatap muka untuk verifikasi.",
    consistencyScore: 50,
    euphemismScore: 0,
    sentimentBreakdown: { positive: 33, neutral: 33, negative: 34 },
    benchmarkComparison: { candidateAvg: avgScore, companyAvg: 50, industryAvg: 55 },
    isManualFallback: true
  };
};
