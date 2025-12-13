import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { FraudAnalysis, RiskLevel } from '../types';

// ==========================================
// GENAI SERVICE - Fraud Analysis with AI
// ==========================================

/**
 * Call Firebase Cloud Function to analyze fraud risk using AI
 * 
 * This function sends interview transcript and assessment responses
 * to a Cloud Function which uses Gemini/OpenAI to analyze fraud patterns
 * 
 * @param role - Candidate's role/position
 * @param transcript - Interview conversation history
 * @param ftAnswers - Fraud Triangle assessment answers
 * @param sjtAnswers - Situational Judgment Test answers (optional)
 * @param tier - Company subscription tier (affects analysis depth)
 * @returns FraudAnalysis object with scores and insights
 */
export const analyzeFraudRisk = async (
  role: string,
  transcript: Array<{ speaker: string; text: string }>,
  ftAnswers?: Record<string, any>,
  sjtAnswers?: Record<string, any>,
  tier: 'Freemium' | 'Premium' = 'Freemium'
): Promise<FraudAnalysis> => {
  try {
    console.log('[GENAI] Calling analyzeFraudRisk Cloud Function...');

    const analyzeRisk = httpsCallable(functions, "analyzeFraudRisk");
    const result = await analyzeRisk({
      role,
      history: transcript, // Cloud Function expects 'history', not 'transcript'
      structuredAssessment: ftAnswers || {}, // Cloud Function expects 'structuredAssessment'
      sjtResults: sjtAnswers || {}, // Cloud Function expects 'sjtResults'
      financialStrainResults: {}, // Add this field even if empty
      tier
    });

    console.log('[GENAI] ✅ Analysis completed');

    // Cloud Function returns { success, analysis, provider }
    // We need to extract the analysis property
    const responseData = result.data as { success?: boolean; analysis?: FraudAnalysis; provider?: string } | FraudAnalysis;

    // Check if response has nested analysis property (new format)
    if (responseData && 'analysis' in responseData && responseData.analysis) {
      console.log('[GENAI] Response format: { success, analysis, provider }');
      console.log('[GENAI] Provider used:', (responseData as any).provider);
      return responseData.analysis as FraudAnalysis;
    }

    // Fallback: response might be direct FraudAnalysis (old format)
    if (responseData && 'scores' in responseData) {
      console.log('[GENAI] Response format: direct FraudAnalysis');
      return responseData as FraudAnalysis;
    }

    // If neither format matches, throw error
    console.error('[GENAI] ❌ Unexpected response format:', responseData);
    throw new Error('Invalid response format from analyzeFraudRisk');

  } catch (error: any) {
    console.error('[GENAI] Error analyzing fraud risk:', error);

    // Return fallback analysis
    return {
      scores: {
        pressure: 50,
        rationalization: 50,
        opportunity: 50
      },
      riskLevel: RiskLevel.MEDIUM,
      summary: 'Unable to complete AI analysis. Manual review recommended.',
      redFlags: ['Analysis service unavailable'],
      recommendation: 'Conduct thorough background check and schedule follow-up interview',
      isManualFallback: true
    };
  }
};

/**
 * Generate comprehensive fraud risk report
 */
export const generateAIReport = async (
  sessionId: string,
  candidateData: any,
  tier: 'Freemium' | 'Premium' = 'Freemium',
  includeAdvancedAnalysis: boolean = false
): Promise<any> => {
  try {
    console.log('[GENAI] Generating AI report for session:', sessionId);

    const generateReport = httpsCallable(functions, "generateReport");
    const result = await generateReport({
      sessionId,
      candidateData,
      tier,
      includeAdvancedAnalysis
    });

    console.log('[GENAI] ✅ Report generated');
    return result.data;

  } catch (error: any) {
    console.error('[GENAI] Error generating report:', error);
    throw error;
  }
};


/**
 * Legacy function - Calculate assessment scores manually
 */
export const calculateAssessmentScores = (
  ftAnswers: Record<string, any>,
  sjtAnswers: Record<string, any>,
  finAnswers?: Record<string, any>
): { pressureScore: number; rationalizationScore: number; opportunityScore: number } => {
  return {
    pressureScore: 50,
    rationalizationScore: 50,
    opportunityScore: 50
  };
};

/**
 * Generate next interview question using AI
 * Calls Cloud Function to get contextual follow-up questions
 */
export const generateNextQuestion = async (context: {
  role: string;
  history: Array<{ speaker: string; text: string }>;
  assessmentData?: any;
}): Promise<string> => {
  try {
    console.log('[GENAI] Generating next AI question...');

    const generateAI = httpsCallable(functions, "generateAIResponse");
    const result = await generateAI({
      prompt: context.history[context.history.length - 1]?.text || '',
      role: context.role,
      history: context.history,
      assessmentData: context.assessmentData
    });

    const response = (result.data as any)?.response;

    if (!response) {
      throw new Error('No response from AI');
    }

    console.log('[GENAI] ✅ AI question generated');
    return response;

  } catch (error: any) {
    console.error('[GENAI] Error generating AI question:', error);

    // Fallback questions based on conversation length
    const questionCount = context.history.filter(h => h.speaker === 'ai').length;

    const fallbackQuestions = [
      'Ceritakan tentang pengalaman kerja Anda yang paling menantang.',
      'Bagaimana Anda menangani situasi di mana Anda harus membuat keputusan etis yang sulit?',
      'Apakah Anda pernah menghadapi tekanan untuk melanggar aturan? Bagaimana Anda meresponsnya?',
      'Apa yang akan Anda lakukan jika Anda melihat rekan kerja melakukan sesuatu yang tidak etis?',
      'Terima kasih atas jawaban Anda. Sesi wawancara telah selesai.'
    ];

    return fallbackQuestions[Math.min(questionCount, fallbackQuestions.length - 1)];
  }
};

