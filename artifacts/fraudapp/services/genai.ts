import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from '../types';
import { supabase } from './supabase';
import { API_BASE } from './apiBase';

// ==========================================
// GENAI SERVICE
// Interview chat -> /api/ai/interview-question
// Fraud analysis -> /api/ai/fraud-analysis
// Both backed by Gemini (primary) / DeepSeek (fallback) on the server.
// ==========================================

const numericResponse = (resp: AssessmentItem['response']): number => {
  if (typeof resp === 'number') return resp;
  if (resp === 'high') return 5;
  if (resp === 'medium') return 3;
  if (resp === 'low') return 1;
  return 0;
};

export const calculateAssessmentScores = (
  ftAnswersInput: AssessmentItem[] | unknown = [],
  sjtAnswersInput: SJTItem[] | unknown = [],
  finAnswersInput: AssessmentItem[] | unknown = []
): { pressureScore: number; rationalizationScore: number; opportunityScore: number } => {
  // Defensive: legacy session rows sometimes store these as objects rather than arrays.
  // for...of on a non-iterable would throw and crash the page that called us.
  const ftAnswers: AssessmentItem[] = Array.isArray(ftAnswersInput) ? ftAnswersInput as AssessmentItem[] : [];
  const sjtAnswers: SJTItem[] = Array.isArray(sjtAnswersInput) ? sjtAnswersInput as SJTItem[] : [];
  const finAnswers: AssessmentItem[] = Array.isArray(finAnswersInput) ? finAnswersInput as AssessmentItem[] : [];

  const buckets = { pressure: 0, opportunity: 0, rationalization: 0 };
  const counts = { pressure: 0, opportunity: 0, rationalization: 0 };

  for (const item of ftAnswers) {
    const cat = item.category;
    if (cat === 'pressure' || cat === 'opportunity' || cat === 'rationalization') {
      buckets[cat] += numericResponse(item.response);
      counts[cat] += 1;
    }
  }

  // Financial strain feeds into the pressure dimension.
  for (const item of finAnswers) {
    buckets.pressure += numericResponse(item.response);
    counts.pressure += 1;
  }

  // SJT: bias the opportunity score because risky-choice scenarios reflect
  // willingness to exploit opportunity.
  let sjtOppSum = 0;
  let sjtOppCount = 0;
  for (const sjt of sjtAnswers) {
    if (sjt.selectedOptionIndex == null) continue;
    const opt = sjt.options?.[sjt.selectedOptionIndex];
    if (!opt) continue;
    const w = opt.riskWeight === 'critical' ? 5
      : opt.riskWeight === 'high' ? 4
      : opt.riskWeight === 'medium' ? 3
      : 1;
    sjtOppSum += w;
    sjtOppCount += 1;
  }
  if (sjtOppCount > 0) {
    buckets.opportunity += sjtOppSum;
    counts.opportunity += sjtOppCount;
  }

  const pct = (sum: number, count: number) => count ? Math.round((sum / (count * 5)) * 100) : 50;

  return {
    pressureScore: pct(buckets.pressure, counts.pressure),
    rationalizationScore: pct(buckets.rationalization, counts.rationalization),
    opportunityScore: pct(buckets.opportunity, counts.opportunity),
  };
};

const buildManualFallback = (
  ftAnswers: AssessmentItem[],
  sjtAnswers: SJTItem[],
  finAnswers: AssessmentItem[],
  reason: string
): FraudAnalysis => {
  const scores = calculateAssessmentScores(ftAnswers, sjtAnswers, finAnswers);
  const avg = (scores.pressureScore + scores.opportunityScore + scores.rationalizationScore) / 3;
  const riskLevel = avg > 75 ? RiskLevel.CRITICAL
    : avg > 50 ? RiskLevel.HIGH
    : avg > 30 ? RiskLevel.MEDIUM
    : RiskLevel.LOW;

  return {
    scores: {
      pressure: scores.pressureScore,
      opportunity: scores.opportunityScore,
      rationalization: scores.rationalizationScore,
    },
    riskLevel,
    summary: `Analisis AI tidak tersedia (${reason}). Skor di bawah ini dihitung otomatis dari kuesioner kandidat. Mohon lakukan review manual sebelum mengambil keputusan.`,
    redFlags: ['Analisis AI gagal — review manual diperlukan'],
    recommendation: 'Lakukan review manual atas transkrip wawancara dan jawaban kuesioner kandidat.',
    isManualFallback: true,
    consistencyScore: 0,
    euphemismScore: 0,
    sentimentBreakdown: { positive: 33, neutral: 34, negative: 33 },
    benchmarkComparison: { candidateAvg: Math.round(avg), companyAvg: 48, industryAvg: 45 },
  };
};

export const analyzeFraudRisk = async (
  role: string,
  transcript: Array<{ speaker: string; text: string }>,
  ftAnswers: AssessmentItem[] = [],
  sjtAnswers: SJTItem[] = [],
  tier: 'Freemium' | 'Premium' = 'Freemium',
  finAnswers: AssessmentItem[] = [],
  sessionId?: string,
): Promise<FraudAnalysis> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_BASE}/api/ai/fraud-analysis`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        role,
        transcript,
        ftAnswers,
        sjtAnswers,
        finAnswers,
        tier,
      }),
    });

    const json = await resp.json().catch(() => null) as
      | { success?: boolean; analysis?: Partial<FraudAnalysis>; error?: string }
      | null;

    if (resp.ok && json?.success && json.analysis && json.analysis.scores) {
      const a = json.analysis;
      // Normalize riskLevel string to enum value if possible
      const rawLevel = String(a.riskLevel || '').toLowerCase();
      const riskLevel = rawLevel === 'critical' ? RiskLevel.CRITICAL
        : rawLevel === 'high' ? RiskLevel.HIGH
        : rawLevel === 'medium' ? RiskLevel.MEDIUM
        : rawLevel === 'low' ? RiskLevel.LOW
        : (a.riskLevel as RiskLevel) ?? RiskLevel.MEDIUM;

      return {
        scores: {
          pressure: Number(a.scores?.pressure ?? 0),
          opportunity: Number(a.scores?.opportunity ?? 0),
          rationalization: Number(a.scores?.rationalization ?? 0),
        },
        riskLevel,
        summary: a.summary || '',
        redFlags: Array.isArray(a.redFlags) ? a.redFlags : [],
        recommendation: a.recommendation || '',
        consistencyScore: a.consistencyScore,
        euphemismScore: a.euphemismScore,
        sentimentBreakdown: a.sentimentBreakdown,
        benchmarkComparison: a.benchmarkComparison,
        isManualFallback: false,
      };
    }

    const reason = json?.error || `HTTP ${resp.status}`;
    console.warn('[GENAI] fraud-analysis failed:', reason);
    return buildManualFallback(ftAnswers, sjtAnswers, finAnswers, reason);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error';
    console.error('[GENAI] fraud-analysis request error:', err);
    return buildManualFallback(ftAnswers, sjtAnswers, finAnswers, reason);
  }
};

export const generateAIReport = async (
  _sessionId: string,
  _candidateData: any,
  _tier: 'Freemium' | 'Premium' = 'Freemium',
  _includeAdvancedAnalysis: boolean = false
): Promise<any> => {
  console.warn('[GENAI] generateAIReport: not yet implemented in API server.');
  return null;
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

  const attempt = async (): Promise<GeneratedQuestion | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_BASE}/api/ai/interview-question`, {
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
    return null;
  };

  // Try up to 2 times before falling back to hardcoded questions
  for (let i = 0; i < 2; i++) {
    try {
      const result = await attempt();
      if (result) return result;
      if (i === 0) console.warn('[GENAI] interview-question attempt 1 failed, retrying...');
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Network error';
      if (i === 0) console.warn('[GENAI] interview-question attempt 1 error, retrying...', errorMessage);
    }
  }

  console.warn('[GENAI] interview-question failed after 2 attempts:', errorMessage);

  // Fallback: rotate through hardcoded questions so the assessment is never blocked,
  // but signal to the caller so they can show a notice.
  const questionCount = context.history.filter(h => h.speaker === 'ai').length;
  return {
    question: FALLBACK_QUESTIONS[Math.min(questionCount, FALLBACK_QUESTIONS.length - 1)],
    fallbackUsed: true,
    error: errorMessage,
  };
};
