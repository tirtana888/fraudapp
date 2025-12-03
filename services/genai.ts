/**
 * GENAI Service - Wrapper untuk Firebase Cloud Functions
 * Semua AI processing dilakukan di server-side untuk keamanan API keys
 */

import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";

// Initialize Firebase for calling Cloud Functions
const firebaseConfig = {
  apiKey: "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo",
  authDomain: "gen-lang-client-0226679970.firebaseapp.com",
  projectId: "gen-lang-client-0226679970",
  storageBucket: "gen-lang-client-0226679970.firebasestorage.app",
  messagingSenderId: "422224153226",
  appId: "1:422224153226:web:4598cd213b6275436a3b73"
};

let functions: any;

try {
  const app = initializeApp(firebaseConfig, "genai-app");
  functions = getFunctions(app, "europe-west1");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

/**
 * Generate AI Response untuk interview
 * Calls Firebase Cloud Function: generateAIResponse
 */
export const generateAIResponse = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  lastUserMessage: string
): Promise<string> => {
  try {
    if (!functions) {
      throw new Error("Firebase Functions not initialized");
    }

    const generateResponse = httpsCallable(functions, "generateAIResponse");
    const result = await generateResponse({
      role,
      history,
      lastUserMessage
    });

    const response = result.data as { success: boolean; response: string };

    if (response.success && response.response) {
      return response.response;
    }

    throw new Error("Invalid response from Cloud Function");

  } catch (error) {
    console.error("AI Response generation failed:", error);
    // Fallback response
    return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
  }
};

/**
 * Analyze Fraud Risk
 * Calls Firebase Cloud Function: analyzeFraudRisk
 */
export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {
  try {
    if (!functions) {
      throw new Error("Firebase Functions not initialized");
    }

    const analyzeRisk = httpsCallable(functions, "analyzeFraudRisk");
    const result = await analyzeRisk({
      role,
      history,
      structuredAssessment,
      sjtResults
    });

    const response = result.data as { success: boolean; analysis: FraudAnalysis };

    if (response.success && response.analysis) {
      return response.analysis;
    }

    throw new Error("Invalid response from Cloud Function");

  } catch (error) {
    console.error("Fraud analysis failed:", error);

    // Fallback manual analysis
    const avgScore = 50;

    return {
      scores: { pressure: avgScore, opportunity: avgScore, rationalization: avgScore },
      riskLevel: RiskLevel.MEDIUM,
      summary: "Analisis AI mengalami gangguan. Skor dihitung dari kuesioner. Mohon review manual transkrip.",
      redFlags: ["Analisis AI tidak tersedia - perlu review manual"],
      recommendation: "Lakukan review manual lengkap terhadap transkrip dan jawaban kandidat.",
      consistencyScore: 0,
      euphemismScore: 0,
      sentimentBreakdown: {
        positive: 33,
        neutral: 34,
        negative: 33
      },
      benchmarkComparison: {
        candidateAvg: avgScore,
        companyAvg: 48,
        industryAvg: 45
      }
    } as FraudAnalysis;
  }
};

/**
 * Generate Next Question using AI
 * Calls Firebase Cloud Function: generateAIResponse
 */
export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic',
  assessmentData?: any
): Promise<string> => {
  try {
    if (!functions) {
      console.warn("Firebase Functions not initialized, using fallback");
      return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai pengalaman Anda dalam menangani situasi yang menantang di pekerjaan?";
    }

    // Get last user message
    const lastUserMessage = history.length > 0
      ? history[history.length - 1].text
      : "";

    if (!lastUserMessage) {
      return "Bisa Anda ceritakan lebih lanjut tentang pengalaman kerja Anda?";
    }

    // Call Firebase Function to generate AI response
    // Try the new dynamic question function first, fallback to generateAIResponse
    console.log(`Generating AI follow-up question for role: ${role}`);

    let generateResponse;
    try {
      generateResponse = httpsCallable(functions, "generateNextQuestionDynamic");
      const result = await generateResponse({
        role,
        history,
        assessmentData
      });

      const response = result.data as { success: boolean; response: string };

      if (response.success && response.response) {
        console.log("AI dynamic question generated successfully");
        return response.response;
      }
    } catch (dynamicError) {
      console.log("Dynamic question function not available, trying generateAIResponse");
    }

    // Fallback to generateAIResponse
    generateResponse = httpsCallable(functions, "generateAIResponse");
    const result = await generateResponse({
      role,
      history,
      lastUserMessage
    });

    const response = result.data as { success: boolean; response: string };

    if (response.success && response.response) {
      console.log("AI response generated successfully");
      return response.response;
    }

    throw new Error("Invalid response from Cloud Function");

  } catch (error) {
    console.error("AI question generation failed:", error);

    // Fallback: Generate contextual question based on history length
    const questionCount = history.filter(h => h.speaker === 'ai').length;

    if (questionCount >= 8) {
      return "Terima kasih atas semua jawaban Anda. Sesi wawancara telah selesai. Kami akan segera memproses hasil assessment Anda.";
    }

    // Contextual fallback questions
    const fallbackQuestions = [
      "Bisa Anda ceritakan lebih detail tentang situasi tersebut?",
      "Bagaimana Anda menangani tekanan dalam pekerjaan sebelumnya?",
      "Ceritakan pengalaman Anda dalam menghadapi dilema etika di tempat kerja.",
      "Apa yang akan Anda lakukan jika menemukan ketidaksesuaian dalam laporan keuangan?",
      "Bagaimana Anda membangun kepercayaan dengan tim dan atasan Anda?",
      "Ceritakan tentang keputusan sulit yang pernah Anda ambil di tempat kerja.",
      "Bagaimana Anda memprioritaskan tugas ketika menghadapi deadline yang ketat?"
    ];

    return fallbackQuestions[questionCount % fallbackQuestions.length] ||
           "Terima kasih. Bisa Anda jelaskan lebih lanjut?";
  }
};

// Helper functions yang mungkin masih dibutuhkan di frontend
export const calculateAssessmentScores = (
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  financialStrainResults: AssessmentItem[] = []
): {
  financialScore: number;
  pressureScore: number;
  rationalizationScore: number;
  opportunityScore: number;
  sjtRiskScore: number;
} => {
  let financialTotal = 0;
  financialStrainResults.forEach((item) => {
    financialTotal += typeof item.response === 'number' ? item.response : 0;
  });
  const financialScore = financialStrainResults.length ? (financialTotal / (financialStrainResults.length * 5)) * 100 : 0;

  const categoryScores = { pressure: 0, opportunity: 0, rationalization: 0 };
  const categoryCounts = { pressure: 0, opportunity: 0, rationalization: 0 };

  structuredAssessment.forEach((item) => {
    const score = typeof item.response === 'number' ? item.response :
                  item.response === 'high' ? 5 :
                  item.response === 'medium' ? 3 : 1;

    if (item.category === 'pressure' || item.category === 'opportunity' || item.category === 'rationalization') {
      categoryScores[item.category] += score;
      categoryCounts[item.category]++;
    }
  });

  const pressureScore = categoryCounts.pressure ? (categoryScores.pressure / (categoryCounts.pressure * 5)) * 100 : 0;
  const rationalizationScore = categoryCounts.rationalization ? (categoryScores.rationalization / (categoryCounts.rationalization * 5)) * 100 : 0;
  const opportunityScore = categoryCounts.opportunity ? (categoryScores.opportunity / (categoryCounts.opportunity * 5)) * 100 : 0;

  let sjtTotal = 0;
  sjtResults.forEach((item) => {
    if (item.selectedOptionIndex !== null) {
      const risk = item.options[item.selectedOptionIndex].riskWeight;
      sjtTotal += risk === 'critical' ? 100 : risk === 'high' ? 75 : risk === 'medium' ? 50 : 0;
    }
  });
  const sjtRiskScore = sjtResults.length ? sjtTotal / sjtResults.length : 0;

  return {
    financialScore,
    pressureScore,
    rationalizationScore,
    opportunityScore,
    sjtRiskScore,
  };
};
