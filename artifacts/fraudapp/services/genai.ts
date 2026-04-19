import { FraudAnalysis, RiskLevel } from '../types';

// ==========================================
// GENAI SERVICE - Fraud Analysis with AI
// Cloud Functions have been removed; all calls log a warning and return fallback.
// ==========================================

export const analyzeFraudRisk = async (
  role: string,
  transcript: Array<{ speaker: string; text: string }>,
  ftAnswers?: Record<string, any>,
  sjtAnswers?: Record<string, any>,
  tier: 'Freemium' | 'Premium' = 'Freemium'
): Promise<FraudAnalysis> => {
  console.warn('[GENAI] analyzeFraudRisk: Cloud Functions removed. Returning fallback analysis.');
  return {
    scores: { pressure: 50, rationalization: 50, opportunity: 50 },
    riskLevel: RiskLevel.MEDIUM,
    summary: 'Unable to complete AI analysis. Manual review recommended.',
    redFlags: ['Analysis service unavailable'],
    recommendation: 'Conduct thorough background check and schedule follow-up interview',
    isManualFallback: true
  };
};

export const generateAIReport = async (
  sessionId: string,
  candidateData: any,
  tier: 'Freemium' | 'Premium' = 'Freemium',
  includeAdvancedAnalysis: boolean = false
): Promise<any> => {
  console.warn('[GENAI] generateAIReport: Cloud Functions removed.');
  return null;
};

export const calculateAssessmentScores = (
  ftAnswers: Record<string, any>,
  sjtAnswers: Record<string, any>,
  finAnswers?: Record<string, any>
): { pressureScore: number; rationalizationScore: number; opportunityScore: number } => {
  return { pressureScore: 50, rationalizationScore: 50, opportunityScore: 50 };
};

export const generateNextQuestion = async (context: {
  role: string;
  history: Array<{ speaker: string; text: string }>;
  assessmentData?: any;
}): Promise<string> => {
  console.warn('[GENAI] generateNextQuestion: Cloud Functions removed. Using fallback questions.');
  const questionCount = context.history.filter(h => h.speaker === 'ai').length;
  const fallbackQuestions = [
    'Ceritakan tentang pengalaman kerja Anda yang paling menantang.',
    'Bagaimana Anda menangani situasi di mana Anda harus membuat keputusan etis yang sulit?',
    'Apakah Anda pernah menghadapi tekanan untuk melanggar aturan? Bagaimana Anda meresponsnya?',
    'Apa yang akan Anda lakukan jika Anda melihat rekan kerja melakukan sesuatu yang tidak etis?',
    'Terima kasih atas jawaban Anda. Sesi wawancara telah selesai.'
  ];
  return fallbackQuestions[Math.min(questionCount, fallbackQuestions.length - 1)];
};
