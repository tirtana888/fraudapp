
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

// Inisialisasi SDK baru
// Pastikan API Key tersedia di environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

// Menggunakan model stabil 1.5 Flash
const MODEL_NAME = "gemini-1.5-flash";

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

    Konteks Percakapan Sejauh Ini:
    ${context}

    Buat pertanyaan selanjutnya yang sangat spesifik untuk menggali karakter mereka:
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: systemInstruction // System instruction didukung di model terbaru
    });

    const result = await model.generateContent(
      context ? `Lanjutkan interogasi berdasarkan riwayat ini.` : `Mulai wawancara investigasi untuk posisi ${role}.`
    );

    const response = await result.response;
    return response.text() || "Ceritakan pengalaman di mana integritas Anda benar-benar diuji oleh atasan.";
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
    Anda adalah sistem analis FraudGuard. Lakukan analisis risiko fraud.
    
    DATA INPUT:
    1. ASESMEN:
    ${assessmentSummary}

    2. SJT (Jika ada):
    ${sjtSummary}

    3. TRANSKRIP:
    ${context}

    INSTRUKSI:
    ${extraInstructions}
    
    OUTPUT JSON WAJIB (Jangan gunakan markdown code block, kembalikan RAW JSON):
    - scores: (Pressure, Opportunity, Rationalization 0-100)
    - riskLevel: (Low/Medium/High/Critical)
    - summary: Ringkasan analisis
    - redFlags: Daftar indikator bahaya
    - recommendation: Rekomendasi tindakan
    ${tier === 'Enterprise' ? '- euphemismScore, euphemismDetected, consistencyScore, benchmarkComparison' : ''}
  `;

  // Schema Definition menggunakan SchemaType dari SDK baru
  const baseProperties = {
    scores: {
      type: SchemaType.OBJECT,
      properties: {
        pressure: { type: SchemaType.INTEGER },
        opportunity: { type: SchemaType.INTEGER },
        rationalization: { type: SchemaType.INTEGER }
      },
      required: ["pressure", "opportunity", "rationalization"]
    },
    riskLevel: { type: SchemaType.STRING, enum: ["Low", "Medium", "High", "Critical"] },
    summary: { type: SchemaType.STRING },
    redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    recommendation: { type: SchemaType.STRING }
  };

  const enterpriseProperties = {
    ...baseProperties,
    consistencyScore: { type: SchemaType.INTEGER },
    euphemismScore: { type: SchemaType.INTEGER },
    euphemismDetected: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    sentimentBreakdown: {
        type: SchemaType.OBJECT,
        properties: {
            positive: { type: SchemaType.INTEGER },
            neutral: { type: SchemaType.INTEGER },
            negative: { type: SchemaType.INTEGER }
        }
    },
    benchmarkComparison: {
        type: SchemaType.OBJECT,
        properties: {
            candidateAvg: { type: SchemaType.INTEGER },
            companyAvg: { type: SchemaType.INTEGER },
            industryAvg: { type: SchemaType.INTEGER }
        }
    }
  };

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: tier === 'Enterprise' ? enterpriseProperties : baseProperties,
          required: ["scores", "riskLevel", "summary", "recommendation"]
        }
      }
    });

    const result = await model.generateContent("Analisis Profil Risiko Fraud.");
    const response = await result.response;
    const text = response.text();
    
    return JSON.parse(text) as FraudAnalysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      scores: { pressure: 50, opportunity: 50, rationalization: 50 },
      riskLevel: RiskLevel.MEDIUM,
      summary: "Analisis gagal. Silakan coba lagi.",
      redFlags: ["System Error: Gagal terhubung ke AI"],
      recommendation: "Lakukan review manual."
    };
  }
};
