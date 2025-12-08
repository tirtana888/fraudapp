import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { FraudAnalysis } from '../types';

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
      transcript,
      ftAnswers: ftAnswers || {},
      sjtAnswers: sjtAnswers || {},
      tier
    });

    console.log('[GENAI] ✅ Analysis completed');
    return result.data as FraudAnalysis;

  } catch (error: any) {
    console.error('[GENAI] Error analyzing fraud risk:', error);
    
    // Return fallback analysis
    return {
      scores: {
        pressure: 50,
        rationalization: 50,
        opportunity: 50,
        overall: 50
      },
      riskLevel: 'Medium',
      riskScore: 50,
      keyFindings: ['Unable to complete AI analysis. Manual review recommended.'],
      recommendations: ['Conduct thorough background check', 'Schedule follow-up interview'],
      redFlags: [],
      strengths: [],
      behavioralPatterns: [],
      transcript: [],
      assessment: {},
      timestamp: new Date().toISOString()
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
 * Legacy function - Generate next question
 */
export const generateNextQuestion = async (context: any): Promise<string> => {
  return 'Ceritakan tentang pengalaman kerja Anda.';
};

