
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
  category: 'pressure' | 'opportunity' | 'rationalization' | 'financial_strain';
  question: string;
  response: 'low' | 'medium' | 'high' | null | number; // Updated to accept number (Likert 1-5)
}

// New: Situational Judgment Test Item
export interface SJTItem {
  id: string;
  scenario: string;
  options: {
    label: string;
    riskWeight: 'low' | 'medium' | 'high' | 'critical';
  }[];
  selectedOptionIndex: number | null;
}

export interface InterviewSession {
  id: string;
  candidate: Candidate;
  date: string;
  status: 'active' | 'completed' | 'pending_review';
  structuredAssessment?: AssessmentItem[]; 
  sjtResults?: SJTItem[];
  financialStrainResults?: AssessmentItem[]; // New
  transcript: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>; 
  analysis?: FraudAnalysis;
  companyId: string;
  source?: string; // 'public_link' or undefined
}

export interface FraudAnalysis {
  scores: FraudTriangleScore;
  riskLevel: RiskLevel;
  summary: string;
  redFlags: string[];
  recommendation: string;
  consistencyScore?: number; 
  euphemismScore?: number;
  euphemismDetected?: string[];
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
  isManualFallback?: boolean;
}

export interface UserProfile {
  id?: string;
  name: string;
  role: 'System Admin' | 'Company Admin' | 'User' | 'Lead Investigator'; 
  avatar: string;
  email: string;
  companyId?: string; 
  password?: string; 
}

export interface CompanyProfile {
  id: string;
  name: string;
  tier: 'Basic' | 'Premium' | 'Enterprise'; 
  status: 'Active' | 'Pending' | 'Suspended' | 'Past Due';
  adminEmail: string;
  joinedDate: string;
  usersCount?: number;
  createdAt?: any;
  logoUrl?: string;
  brandColor?: string; 
  headerTitle?: string;
  welcomeMessage?: string;
  subscription_ends_at?: string;
  custom_candidate_limit?: number;
  verification_credits?: number;
}

export interface SelfAssessmentAnswers {
    candidateName: string;
    candidateEmail: string;
    candidateRole: string;
    answers: AssessmentItem[];
}

export interface AssessmentInvite {
  id?: string;
  access_code: string;
  email: string;
  name: string;
  role?: string;
  companyId: string;
  status: 'PENDING' | 'ACCESSING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  createdAt: string;
  accessedAt?: string;
  startedAt?: string;
  completedAt?: string;
  sessionId?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'SESSION' | 'INVITE';
  date: string;
  data: InterviewSession | AssessmentInvite;
}
