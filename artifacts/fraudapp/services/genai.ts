import { FraudAnalysis, RiskLevel } from '../types';
import { supabase } from './supabase';

// ==========================================
// GENAI SERVICE
// Interview chat now calls /api/ai/interview-question (OpenAI on the server).
// Other functions remain stubbed pending a separate implementation.
// ==========================================

export const analyzeFraudRisk = async (
  role: string,
  transcript: Array<{ speaker: string; text: string }>,
  ftAnswers?: Record<string, any>,
  sjtAnswers?: Record<string, any>,
  tier: 'Freemium' | 'Premium' = 'Freemium'
): Promise<FraudAnalysis> => {
  console.warn('[GENAI] analyzeFraudRisk: not yet implemented in API server. Returning fallback analysis.');
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
  console.warn('[GENAI] generateAIReport: not yet implemented in API server.');
  return null;
};

export const calculateAssessmentScores = (
  ftAnswers: Record<string, any>,
  sjtAnswers: Record<string, any>,
  finAnswers?: Record<string, any>
): { pressureScore: number; rationalizationScore: number; opportunityScore: number } => {
  return { pressureScore: 50, rationalizationScore: 50, opportunityScore: 50 };
};

const FALLBACK_QUESTIONS = [
  'Ceritakan tentang pengalaman kerja Anda yang paling menantang.',
  'Bagaimana Anda menangani situasi di mana Anda harus membuat keputusan etis yang sulit?',
  'Apakah Anda pernah menghadapi tekanan untuk melanggar aturan? Bagaimana Anda meresponsnya?',
  'Apa yang akan Anda lakukan jika Anda melihat rekan kerja melakukan sesuatu yang tidak etis?',
  'Terima kasih atas jawaban Anda. Sesi wawancara telah selesai.'
];

export interface GeneratedQuestion {
  question: string;
  fallbackUsed: boolean;
  error?: string;
}

export const generateNextQuestion = async (context: {
  sessionId?: string;
  role: string;
  history: Array<{ speaker: string; text: string }>;
  assessmentData?: any;
}): Promise<GeneratedQuestion> => {
  let errorMessage: string | undefined;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch('/api/ai/interview-question', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: context.sessionId,
        role: context.role,
        history: context.history,
        assessmentData: context.assessmentData,
      }),
    });

    const json = await resp.json().catch(() => null) as { success?: boolean; question?: string; error?: string } | null;
    if (resp.ok && json?.success && json.question) {
      return { question: json.question, fallbackUsed: false };
    }
    errorMessage = json?.error || `HTTP ${resp.status}`;
    console.warn('[GENAI] interview-question failed:', resp.status, errorMessage);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Network error';
    console.error('[GENAI] interview-question request error:', err);
  }

  // Fallback: rotate through hardcoded questions so the assessment is never blocked,
  // but signal to the caller so they can show a notice.
  const questionCount = context.history.filter(h => h.speaker === 'ai').length;
  return {
    question: FALLBACK_QUESTIONS[Math.min(questionCount, FALLBACK_QUESTIONS.length - 1)],
    fallbackUsed: true,
    error: errorMessage,
  };
};
