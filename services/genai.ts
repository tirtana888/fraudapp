import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const calculateAssessmentScores = (
    structuredAssessment: AssessmentItem[],
    sjtResults: SJTItem[] = [],
    financialStrainResults: AssessmentItem[] = []
) => {
    let financialSum = 0;
    financialStrainResults.forEach(i => {
        financialSum += (typeof i.response === 'number' ? i.response : 0);
    });
    const financialScore = financialStrainResults.length ? (financialSum / (financialStrainResults.length * 5)) * 100 : 0;

    const scores = { pressure: 0, opportunity: 0, rationalization: 0 };
    const counts = { pressure: 0, opportunity: 0, rationalization: 0 };

    structuredAssessment.forEach(item => {
        const val = typeof item.response === 'number' ? item.response :
                    item.response === 'high' ? 5 : item.response === 'medium' ? 3 : 1;
        if (item.category === 'pressure' || item.category === 'opportunity' || item.category === 'rationalization') {
            scores[item.category] += val;
            counts[item.category]++;
        }
    });

    const pressureScore = counts.pressure ? (scores.pressure / (counts.pressure * 5)) * 100 : 0;
    const rationalizationScore = counts.rationalization ? (scores.rationalization / (counts.rationalization * 5)) * 100 : 0;
    const opportunityScore = counts.opportunity ? (scores.opportunity / (counts.opportunity * 5)) * 100 : 0;

    let sjtRiskSum = 0;
    sjtResults.forEach(s => {
        if (s.selectedOptionIndex !== null) {
            const risk = s.options[s.selectedOptionIndex].riskWeight;
            if (risk === 'critical') sjtRiskSum += 100;
            else if (risk === 'high') sjtRiskSum += 75;
            else if (risk === 'medium') sjtRiskSum += 50;
            else sjtRiskSum += 0;
        }
    });
    const sjtRiskScore = sjtResults.length ? sjtRiskSum / sjtResults.length : 0;

    return { financialScore, pressureScore, rationalizationScore, opportunityScore, sjtRiskScore };
};

const callGeminiEdgeFunction = async (prompt: string, type: 'question' | 'analysis' = 'question'): Promise<string> => {
    const apiUrl = `${SUPABASE_URL}/functions/v1/gemini-ai`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, type })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Edge Function error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
};

export const generateNextQuestion = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic',
  assessmentData?: {
      structuredAssessment: AssessmentItem[],
      sjtResults: SJTItem[],
      financialStrainResults: AssessmentItem[]
  }
): Promise<string> => {

    try {
        const candidateTurnCount = history.filter(h => h.speaker === 'candidate').length;

        if (candidateTurnCount >= 20) {
            return "Terima kasih atas partisipasi Anda. Sesi wawancara telah selesai. Kami akan menghubungi Anda segera.";
        }

        const conversationContext = history
            .slice(-6)
            .map(h => `${h.speaker === 'candidate' ? 'Kandidat' : 'AI'}: ${h.text}`)
            .join('\n');

        let assessmentContext = '';
        if (assessmentData) {
            const scores = calculateAssessmentScores(
                assessmentData.structuredAssessment,
                assessmentData.sjtResults,
                assessmentData.financialStrainResults
            );
            assessmentContext = `\n\nData Penilaian:
- Tekanan Finansial: ${scores.financialScore.toFixed(1)}%
- Pressure: ${scores.pressureScore.toFixed(1)}%
- Opportunity: ${scores.opportunityScore.toFixed(1)}%
- Rationalization: ${scores.rationalizationScore.toFixed(1)}%`;
        }

        const prompt = `Anda adalah AI interviewer untuk fraud risk assessment. Posisi kandidat: ${role}.

Percakapan sejauh ini:
${conversationContext}${assessmentContext}

Tier perusahaan: ${tier}

Tugas Anda: Generate 1 pertanyaan follow-up yang:
1. Natural dan conversational
2. Menggali deeper tentang integrity, pressure handling, atau ethical decision making
3. Relevan dengan posisi ${role}
4. Tidak terlalu panjang (max 2 kalimat)

PENTING: Berikan HANYA pertanyaan tanpa penjelasan tambahan.`;

        const question = await callGeminiEdgeFunction(prompt, 'question');
        return question.trim();

    } catch (error) {
        console.error("Generate question failed:", error);
        return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
    }
};

export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {

    try {
        const manualScores = calculateAssessmentScores(structuredAssessment, sjtResults, []);

        const conversationText = history
            .filter(h => h.speaker === 'candidate')
            .map(h => h.text)
            .join('\n');

        const prompt = `Anda adalah fraud risk analyst expert. Analisis kandidat berikut:

**Posisi:** ${role}
**Tier Perusahaan:** ${tier}

**Skor Assessment:**
- Pressure: ${manualScores.pressureScore.toFixed(1)}%
- Opportunity: ${manualScores.opportunityScore.toFixed(1)}%
- Rationalization: ${manualScores.rationalizationScore.toFixed(1)}%
- SJT Risk: ${manualScores.sjtRiskScore.toFixed(1)}%

**Transkrip Wawancara:**
${conversationText}

Berikan analisis dalam format JSON berikut (tanpa markdown, hanya JSON murni):
{
  "scores": {
    "pressure": <number 0-100>,
    "opportunity": <number 0-100>,
    "rationalization": <number 0-100>
  },
  "riskLevel": "<Low|Medium|High|Critical>",
  "summary": "<ringkasan singkat 2-3 kalimat>",
  "redFlags": ["<red flag 1>", "<red flag 2>"],
  "recommendation": "<rekomendasi HR>",
  "consistencyScore": <number 0-100>,
  "euphemismScore": <number 0-100>
}

PENTING: Berikan HANYA JSON, tidak ada teks lain.`;

        const response = await callGeminiEdgeFunction(prompt, 'analysis');

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const analysisData = JSON.parse(jsonMatch[0]);

        return {
            scores: analysisData.scores,
            riskLevel: analysisData.riskLevel as RiskLevel,
            summary: analysisData.summary,
            redFlags: analysisData.redFlags || [],
            recommendation: analysisData.recommendation,
            consistencyScore: analysisData.consistencyScore || 0,
            euphemismScore: analysisData.euphemismScore || 0
        } as FraudAnalysis;

    } catch (error) {
        console.error("Fraud analysis failed:", error);

        const manualScores = calculateAssessmentScores(structuredAssessment, sjtResults, []);
        const avgScore = (manualScores.pressureScore + manualScores.rationalizationScore + manualScores.opportunityScore) / 3;

        let manualRisk = RiskLevel.LOW;
        if (avgScore > 75) manualRisk = RiskLevel.CRITICAL;
        else if (avgScore > 50) manualRisk = RiskLevel.HIGH;
        else if (avgScore > 30) manualRisk = RiskLevel.MEDIUM;

        return {
            scores: {
                pressure: manualScores.pressureScore,
                opportunity: manualScores.opportunityScore,
                rationalization: manualScores.rationalizationScore
            },
            riskLevel: manualRisk,
            summary: "Analisis AI gagal. Skor dihitung dari assessment saja. Mohon review manual.",
            redFlags: ["AI ANALYSIS UNAVAILABLE"],
            recommendation: "Lakukan review manual transkrip dan jawaban.",
            isManualFallback: true,
            consistencyScore: 0,
            euphemismScore: 0,
        } as FraudAnalysis;
    }
};
