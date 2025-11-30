
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK Stabil (@google/generative-ai)
// Menggunakan API Key dari environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

// MODEL CONFIGURATION
// Menggunakan Gemini 1.5 Flash untuk chat (Cepat & Low Latency)
// Menggunakan Gemini 1.5 Pro untuk analisis (Reasoning Kuat)
const CHAT_MODEL_ID = "gemini-1.5-flash";
const ANALYSIS_MODEL_ID = "gemini-1.5-pro";

export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>
): Promise<string> => {
  
  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const turnCount = Math.floor(history.length / 2);

  // DYNAMIC STAGING
  let stageInstruction = "";
  if (turnCount < 2) {
      stageInstruction = `
      FASE 1: BASELINING & RAPPORT
      - Tanyakan latar belakang profesional yang relevan dengan risiko posisi "${role}".
      - Tujuannya melihat gaya komunikasi normal kandidat.
      `;
  } else if (turnCount < 5) {
      stageInstruction = `
      FASE 2: BEHAVIORAL INVESTIGATION (Fraud Triangle Focus)
      - Gali area PRESSURE atau OPPORTUNITY.
      - Gunakan teknik 'Devil's Advocate'.
      - Paksa kandidat menggunakan metode STAR.
      `;
  } else {
      stageInstruction = `
      FASE 3: PROBING & PROJECTION (Rationalization Focus)
      - Gunakan 'Projective Questions'.
      - Tantang inkonsistensi dari jawaban sebelumnya.
      `;
  }
  
  const systemInstruction = `
    Anda adalah Investigator Forensik Senior (Certified Fraud Examiner) yang sedang mewawancarai kandidat untuk posisi: "${role}".
    
    TUJUAN:
    Mendeteksi potensi fraud tersembunyi (Pressure, Opportunity, Rationalization).

    ${stageInstruction}

    ATURAN PERTANYAAN (STRICT):
    1. HANYA SATU pertanyaan per giliran. Pendek, tajam.
    2. Gunakan Bahasa Indonesia profesional namun investigatif.
    3. Kejar jawaban klise.
  `;

  try {
    const model = genAI.getGenerativeModel({ model: CHAT_MODEL_ID });
    
    // Construct prompt manually for stateless request or use chatSession if state management is preferred.
    // Here we use single-turn generation with context injection for simplicity in this architecture.
    const prompt = `${systemInstruction}\n\nKonteks Percakapan:\n${context}\n\nBuat pertanyaan selanjutnya:`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Ceritakan pengalaman di mana integritas Anda diuji.";
  } catch (error) {
    console.error("Error generating question:", error);
    return "Bagaimana pandangan Anda tentang karyawan yang meminjam aset kantor tanpa izin?";
  }
};

export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults?: SJTItem[],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {
  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  
  const assessmentSummary = structuredAssessment.map(item => 
    `[${item.category.toUpperCase()}] Q: "${item.question}" -> A: ${item.response?.toUpperCase()}`
  ).join('\n');

  const sjtSummary = sjtResults && sjtResults.length > 0 ? sjtResults.map(item => 
    `[SJT-CASE] Skenario: "${item.scenario.substring(0, 50)}..." -> Pilihan: "${item.options[item.selectedOptionIndex!].label}" (Risk: ${item.options[item.selectedOptionIndex!].riskWeight})`
  ).join('\n') : "Tidak ada tes SJT.";

  let extraInstructions = "";
  if (tier === 'Enterprise') {
      extraInstructions = `
      1. **EUPHEMISM DETECTION**: Cari kata penghalus (misal: "meminjam" padahal mencuri).
      2. **BENCHMARK**: Bandingkan dengan rata-rata industri.
      3. **CONSISTENCY**: Cek inkonsistensi jawaban.
      `;
  }

  const systemInstruction = `
    Anda adalah sistem analis FraudGuard.
    
    DATA INPUT:
    1. ASESMEN: ${assessmentSummary}
    2. SJT: ${sjtSummary}
    3. TRANSKRIP: ${context}

    INSTRUKSI:
    ${extraInstructions}
    
    TUGAS:
    Analisis profil risiko fraud kandidat.
    
    Return JSON structure exactly matching the schema.
  `;

  try {
    const model = genAI.getGenerativeModel({
        model: ANALYSIS_MODEL_ID,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    scores: {
                        type: SchemaType.OBJECT,
                        properties: {
                            pressure: { type: SchemaType.NUMBER },
                            opportunity: { type: SchemaType.NUMBER },
                            rationalization: { type: SchemaType.NUMBER }
                        },
                        required: ["pressure", "opportunity", "rationalization"]
                    },
                    riskLevel: { type: SchemaType.STRING }, // Low, Medium, High, Critical
                    summary: { type: SchemaType.STRING },
                    redFlags: { 
                        type: SchemaType.ARRAY, 
                        items: { type: SchemaType.STRING }
                    },
                    recommendation: { type: SchemaType.STRING },
                    consistencyScore: { type: SchemaType.NUMBER },
                    euphemismScore: { type: SchemaType.NUMBER },
                    sentimentBreakdown: {
                        type: SchemaType.OBJECT,
                        properties: {
                            positive: { type: SchemaType.NUMBER },
                            neutral: { type: SchemaType.NUMBER },
                            negative: { type: SchemaType.NUMBER }
                        }
                    },
                    benchmarkComparison: {
                        type: SchemaType.OBJECT,
                        properties: {
                            candidateAvg: { type: SchemaType.NUMBER },
                            companyAvg: { type: SchemaType.NUMBER },
                            industryAvg: { type: SchemaType.NUMBER }
                        }
                    }
                }
            }
        }
    });

    const result = await model.generateContent(systemInstruction);
    const text = result.response.text();
    
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as FraudAnalysis;

  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      scores: { pressure: 50, opportunity: 50, rationalization: 50 },
      riskLevel: RiskLevel.MEDIUM,
      summary: "Analisis gagal terhubung ke AI Engine (Fallback).",
      redFlags: ["System Error: AI Connection Failed"],
      recommendation: "Lakukan review manual."
    };
  }
};
