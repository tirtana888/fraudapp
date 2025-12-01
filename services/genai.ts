
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK Stabil (@google/generative-ai)
// Menggunakan API Key dari environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

// MODEL CONFIGURATION
// MENGGUNAKAN GEMINI 3 PRO PREVIEW (Advanced Reasoning & Nuance)
// Sesuai instruksi: "Selalu gunakan 3"
const CHAT_MODEL_ID = "gemini-3-pro-preview"; 
const ANALYSIS_MODEL_ID = "gemini-3-pro-preview";

export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>
): Promise<string> => {
  
  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const turnCount = Math.floor(history.length / 2);

  // DYNAMIC STAGING
  let stageInstruction = "";
  if (turnCount < 3) {
      stageInstruction = `
      FASE 1: BASELINING & RAPPORT (Deep Dive)
      - Tanyakan latar belakang profesional yang relevan dengan risiko posisi "${role}".
      - Tanyakan alasan spesifik meninggalkan pekerjaan sebelumnya (cari red flag: konflik/dipecat).
      `;
  } else if (turnCount < 7) {
      stageInstruction = `
      FASE 2: BEHAVIORAL INVESTIGATION (Fraud Triangle Focus)
      - Gali area PRESSURE: Tanyakan tentang pengelolaan gaya hidup vs pendapatan secara halus.
      - Gali area OPPORTUNITY: Tanyakan pengalaman bekerja tanpa pengawasan (Work From Home/Dinas Luar).
      - WAJIB: Tanyakan tentang "Conflict of Interest" (misal: memiliki bisnis sampingan yang sejenis).
      `;
  } else {
      stageInstruction = `
      FASE 3: PROBING & PROJECTION (Rationalization Focus)
      - Gunakan 'Projective Questions' (Contoh: "Menurut Anda, kenapa orang jujur bisa mencuri?").
      - Tanyakan sikap terhadap "Whistleblowing" (Apakah berani melapor jika atasan salah?).
      - Tes reaksi terhadap otoritas: "Bagaimana jika atasan meminta Anda melanggar SOP demi target?".
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
    3. Kejar jawaban klise atau jawaban yang terlalu umum ("Saya jujur", "Saya disiplin"). Minta contoh nyata.
    4. Jangan ragu untuk sedikit menekan (stress test) untuk melihat konsistensi emosi.
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
