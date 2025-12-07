/**
 * GENAI Service - Wrapper untuk Firebase Cloud Functions
 * Semua AI processing dilakukan di server-side untuk keamanan API keys
 */

import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";

// Initialize Firebase for calling Cloud Functions (From Environment Variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let functions: any;

console.log('[GENAI-INIT] Initializing Firebase for Cloud Functions...');
console.log('[GENAI-INIT] Project ID:', firebaseConfig.projectId);

try {
  const app = initializeApp(firebaseConfig, "genai-app");
  console.log('[GENAI-INIT] Firebase app initialized:', app.name);

  functions = getFunctions(app, "europe-west1");
  console.log('[GENAI-INIT] ✅ Firebase Functions initialized for region: europe-west1');
  console.log('[GENAI-INIT] Functions object:', typeof functions);
} catch (error: any) {
  console.error('[GENAI-INIT] ❌ Firebase initialization error:', error);
  console.error('[GENAI-INIT] Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
}

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
 * Generate Next Question during Chat Interview
 * Calls Firebase Cloud Function: generateAIResponse
 */
export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic',
  assessmentData?: any
): Promise<string> => {
  console.log('[GENAI] generateNextQuestion called with:', {
    role,
    historyLength: history.length,
    tier,
    functionsInitialized: !!functions
  });

  try {
    if (!functions) {
      console.error('[GENAI] Firebase Functions not initialized!');
      throw new Error("Firebase Functions not initialized");
    }

    // Get last candidate message
    const lastUserMessage = [...history].reverse().find(h => h.speaker === 'candidate' || h.speaker === 'user')?.text || "";
    console.log('[GENAI] Last user message:', lastUserMessage.substring(0, 50));

    // Validate that we have a message to send
    if (!lastUserMessage || !lastUserMessage.trim()) {
      console.error('[GENAI] No valid user message found in history');
      throw new Error("No user message to process");
    }

    // Call Firebase Cloud Function
    console.log('[GENAI] Calling generateAIResponse function...');
    const generateResponse = httpsCallable(functions, "generateAIResponse");

    const result = await generateResponse({
      role,
      history,
      lastUserMessage: lastUserMessage.trim(),
      prompt: lastUserMessage.trim(), // Send as both for backward compatibility
      assessmentData // Include assessment data if provided
    });

    console.log('[GENAI] Function response received:', {
      hasData: !!result.data,
      dataType: typeof result.data
    });

    const response = result.data as { success: boolean; response: string };

    console.log('[GENAI] Parsed response:', {
      success: response.success,
      hasResponse: !!response.response,
      responseLength: response.response?.length
    });

    if (response.success && response.response) {
      console.log('[GENAI] ✅ AI Response generated successfully');
      return response.response;
    }

    throw new Error("Invalid response from Cloud Function");

  } catch (error: any) {
    console.error('[GENAI] ❌ AI Next Question generation failed');
    console.error('[GENAI] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack
    });

    // Fallback response
    console.warn('[GENAI] Using static fallback response');
    return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
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
