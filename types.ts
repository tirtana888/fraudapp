
export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export interface FraudTriangleScore {
  pressure: number; // 0-100
  opportunity: number; // 0-100
  rationalization: number; // 0-100
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface AssessmentItem {
  id: string;
  category: 'pressure' | 'opportunity' | 'rationalization' | 'financial_strain'; // Added Financial Strain
  question: string;
  response: 'low' | 'medium' | 'high' | null; 
}

// New: Situational Judgment Test Item
export interface SJTItem {
  id: string;
  scenario: string;
  options: {
    label: string;
    riskWeight: 'low' | 'medium' | 'high';
  }[];
  selectedOptionIndex: number | null;
}

export interface InterviewSession {
  id: string;
  candidate: Candidate;
  date: string;
  status: 'active' | 'completed' | 'pending_review';
  structuredAssessment?: AssessmentItem[]; 
  sjtResults?: SJTItem[]; // New: Store SJT results
  transcript: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>; 
  analysis?: FraudAnalysis;
  companyId: string;
}

export interface FraudAnalysis {
  scores: FraudTriangleScore;
  riskLevel: RiskLevel;
  summary: string;
  redFlags: string[];
  recommendation: string;
  // Enterprise Features
  consistencyScore?: number; 
  euphemismScore?: number; // New: 0-100 (Higher means more deceptive language)
  euphemismDetected?: string[]; // New: Words detected
  sentimentBreakdown?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  benchmarkComparison?: {
    candidateAvg: number;
    companyAvg: number;
    industryAvg: number;
  };
}

export interface UserProfile {
  id?: string;
  name: string;
  role: string; 
  avatar: string;
  email: string;
  companyId?: string; 
  password?: string; 
}

export interface CompanyProfile {
  id: string;
  name: string;
  tier: 'Basic' | 'Premium' | 'Enterprise'; // Updated Tiers
  status: 'Active' | 'Pending' | 'Suspended';
  adminEmail: string;
  joinedDate: string;
  usersCount?: number;
  createdAt?: any;
  logoUrl?: string;
  brandColor?: string; 
  headerTitle?: string;
  welcomeMessage?: string;
}

export interface SelfAssessmentAnswers {
    candidateName: string;
    candidateEmail: string;
    candidateRole: string;
    answers: AssessmentItem[];
}
