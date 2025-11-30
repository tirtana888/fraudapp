
import { GoogleGenAI, Type } from "@google/genai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK Stabil (@google/genai)
// SDK ini mendukung model baru (Gemini 2.5/3) via string model name.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// MODEL CONFIGURATION
// Gemini 2.5 Flash: Cepat, efisien, latency rendah. Cocok untuk Chat interaktif.
const CHAT_MODEL = "gemini-2.5-flash";

// Gemini 3 Pro Preview: Penalaran kompleks, instruksi panjang, analisis mendalam.
const ANALYSIS_MODEL = "gemini-1.5-pro"; // Fallback ke 1.5 Pro agar stabil di production.

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
      - Tujuannya melihat gaya komunikasi normal kandidat (jujur vs dibuat-buat).
      - Contoh: "Ceritakan tantangan terbesar Anda di peran sebelumnya yang menguji kesabaran Anda."
      `;
  } else if (turnCount < 5) {
      stageInstruction = `
      FASE 2: BEHAVIORAL INVESTIGATION (Fraud Triangle Focus)
      - Gali area PRESSURE atau OPPORTUNITY.
      - Gunakan teknik 'Devil's Advocate': Berikan skenario di mana melanggar aturan terlihat menguntungkan.
      - Paksa kandidat menggunakan metode STAR (Situation, Task, Action, Result). Jika jawaban terlalu umum, kejar detailnya.
      - Contoh: "Pernahkah Anda berada di situasi di mana aturan perusahaan justru menghambat target? Apa yang Anda lakukan?"
      `;
  } else {
      stageInstruction = `
      FASE 3: PROBING & PROJECTION (Rationalization Focus)
      - Gunakan 'Projective Questions': Tanya pendapat mereka tentang ketidakjujuran orang lain (biasanya mencerminkan diri sendiri).
      - Tantang inkonsistensi dari jawaban sebelumnya.
      - Contoh: "Menurut Anda, mengapa karyawan yang baik kadang-kadang terpaksa memanipulasi data? Apakah itu bisa dimaklumi?"
      `;
  }
  
  const systemInstruction = `
    Anda adalah Investigator Forensik Senior (Certified Fraud Examiner) yang sedang mewawancarai kandidat untuk posisi berisiko tinggi: "${role}".
    
    TUJUAN:
    Mendeteksi potensi fraud tersembunyi (Pressure, Opportunity, Rationalization) dengan menggali karakter asli kandidat di balik jawaban normatif.

    ${stageInstruction}

    ATURAN PERTANYAAN (STRICT):
    1. HANYA SATU pertanyaan per giliran. Pendek, tajam, menusuk.
    2. Gunakan Bahasa Indonesia yang profesional namun mengintimidasi secara halus (investigatif).
    3. JANGAN terima jawaban klise seperti "Saya jujur" atau "Saya ikut aturan". Kejar dengan "Bagaimana jika..." atau "Berikan contoh spesifik...".
    4. Deteksi 'Micro-expressions' lewat teks: Jika kandidat ragu atau menjawab terlalu singkat, tekan bagian itu.
    5. Variasikan topik: Tekanan Finansial, Hubungan dengan Atasan, Kepatuhan vs Target, dan Integritas Moral.
  `;

  try {
    const prompt = `${systemInstruction}\n\nKonteks Percakapan Sejauh Ini:\n${context}\n\nBuat pertanyaan selanjutnya:`;
    
    const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt
    });
    return response.text || "Ceritakan pengalaman di mana integritas Anda benar-benar diuji oleh atasan.";
  } catch (error) {
    console.error("Error generating question:", error);
    return "Bagaimana pandangan Anda tentang karyawan yang meminjam aset kantor tanpa izin untuk keperluan mendesak?";
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
    `[SJT-CASE] Skenario: "${item.scenario.substring(0, 50)}..." -> Pilihan Kandidat: "${item.options[item.selectedOptionIndex!].label}" (Risk Weight: ${item.options[item.selectedOptionIndex!].riskWeight})`
  ).join('\n') : "Tidak ada tes SJT (Paket Basic).";

  let extraInstructions = "";
  if (tier === 'Enterprise') {
      extraInstructions = `
      1. **EUPHEMISM DETECTION**: Cari kata-kata penghalus dosa. Contoh: "Meminjam" (mencuri), "Adjustment" (manipulasi).
      2. **BENCHMARK**: Bandingkan kandidat dengan rata-rata industri.
      3. **CONSISTENCY**: Cek inkonsistensi jawaban.
      `;
  } else {
      extraInstructions = "Fokus pada analisis dasar risiko fraud.";
  }

  const systemInstruction = `
    Anda adalah sistem analis FraudGuard.
    
    DATA INPUT:
    1. ASESMEN:
    ${assessmentSummary}

    2. SJT (Jika ada):
    ${sjtSummary}

    3. TRANSKRIP:
    ${context}

    INSTRUKSI:
    ${extraInstructions}
    
    TUGAS:
    Analisis profil psikologis kandidat, pola bahasa, dan konsistensi jawaban untuk menentukan risiko Fraud.
    
    FORMAT JSON (STRICT):
    Return JSON only with this structure:
    {
      "scores": { "pressure": 0-100, "opportunity": 0-100, "rationalization": 0-100 },
      "riskLevel": "Low" | "Medium" | "High" | "Critical",
      "summary": "String",
      "redFlags": ["String"],
      "recommendation": "String",
      "consistencyScore": 0-100,
      "euphemismScore": 0-100,
      "sentimentBreakdown": { "positive": 0, "neutral": 0, "negative": 0 },
      "benchmarkComparison": { "candidateAvg": 0, "companyAvg": 0, "industryAvg": 0 }
    }
  `;

  try {
    const response = await ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: systemInstruction,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    scores: {
                    type: Type.OBJECT,
                    properties: {
                        pressure: { type: Type.INTEGER },
                        opportunity: { type: Type.INTEGER },
                        rationalization: { type: Type.INTEGER }
                    },
                    required: ["pressure", "opportunity", "rationalization"]
                    },
                    riskLevel: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    redFlags: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }
                    },
                    recommendation: { type: Type.STRING },
                    consistencyScore: { type: Type.INTEGER },
                    euphemismScore: { type: Type.INTEGER },
                    sentimentBreakdown: {
                    type: Type.OBJECT,
                    properties: {
                        positive: { type: Type.INTEGER },
                        neutral: { type: Type.INTEGER },
                        negative: { type: Type.INTEGER }
                    }
                    },
                    benchmarkComparison: {
                    type: Type.OBJECT,
                    properties: {
                        candidateAvg: { type: Type.INTEGER },
                        companyAvg: { type: Type.INTEGER },
                        industryAvg: { type: Type.INTEGER }
                    }
                    }
                }
            }
        }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as FraudAnalysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      scores: { pressure: 50, opportunity: 50, rationalization: 50 },
      riskLevel: RiskLevel.MEDIUM,
      summary: "Analisis gagal terhubung ke AI Engine. Silakan coba lagi.",
      redFlags: ["System Error: Gagal terhubung ke AI"],
      recommendation: "Lakukan review manual."
    };
  }
};
