import { FraudAnalysis, RiskLevel, AssessmentItem, SJTItem } from "../types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

// Initialize Firebase Functions
const functions = getFunctions(app, 'europe-west1');

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

/**
 * Generate next question - CALLS BACKEND CLOUD FUNCTION
 */
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
        const generateQuestion = httpsCallable(functions, 'generateNextQuestion');

        const result = await generateQuestion({
            candidateRole: role,
            chatHistory: history,
            tier: tier,
            assessmentData: assessmentData
        });

        const data = result.data as { question: string; isEnd: boolean };
        return data.question;

    } catch (error) {
        console.error("Backend generateNextQuestion failed:", error);

        // Fallback: Generic question
        const candidateTurnCount = history.filter(h => h.speaker === 'candidate').length;
        if (candidateTurnCount >= 20) {
            return "Terima kasih atas partisipasi Anda. Sesi wawancara telah selesai. Kami akan menghubungi Anda segera.";
        }

        return "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?";
    }
};

/**
 * Analyze fraud risk - CALLS BACKEND CLOUD FUNCTION
 */
export const analyzeFraudRisk = async (
  role: string,
  history: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>,
  structuredAssessment: AssessmentItem[],
  sjtResults: SJTItem[] = [],
  tier: 'Basic' | 'Premium' | 'Enterprise' = 'Basic'
): Promise<FraudAnalysis> => {

    try {
        const analyzeFraud = httpsCallable(functions, 'analyzeFraudRisk');

        const result = await analyzeFraud({
            candidateRole: role,
            chatHistory: history,
            ftAnswers: structuredAssessment,
            sjtAnswers: sjtResults,
            tier: tier
        });

        return result.data as FraudAnalysis;

    } catch (error) {
        console.error("Backend analyzeFraudRisk failed:", error);

        // Emergency Fallback: Manual scoring
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
            summary: "Analisis backend gagal. Skor dihitung dari kuesioner saja. Mohon review manual.",
            redFlags: ["BACKEND ANALYSIS FAILED"],
            recommendation: "Lakukan review manual transkrip dan jawaban.",
            isManualFallback: true,
            consistencyScore: 0,
            euphemismScore: 0,
        } as FraudAnalysis;
    }
};
