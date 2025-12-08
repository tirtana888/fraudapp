
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

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

export interface ParsedCVData {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  rawText?: string;
}

export interface InterviewSession {
  id: string;
  candidate: Candidate;
  date: string;
  status: 'active' | 'completed' | 'pending_review';
  structuredAssessment?: AssessmentItem[];
  sjtResults?: SJTItem[];
  financialStrainResults?: AssessmentItem[];
  transcript: Array<{ speaker: 'ai' | 'user' | 'candidate'; text: string }>;
  analysis?: FraudAnalysis;
  companyId: string;
  source?: string;
  jobId?: string;
  applicationId?: string;
  cvUrl?: string;
  cvParsedData?: ParsedCVData;
  whatsapp?: string;
  recruitmentStage?: string;
  timeline?: Array<{
    stage: string;
    status: 'completed' | 'current' | 'pending';
    date?: string;
    note?: string;
  }>;
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
  password?: string; // Only for legacy users, Firebase Auth users don't store passwords
  emailVerified?: boolean; // Firebase Auth email verification status
  createdAt?: any; // Creation timestamp
}

export interface CompanyProfile {
  id: string;
  name: string;
  tier: 'Freemium' | 'Premium';
  status: 'Active' | 'Pending' | 'Suspended' | 'Past Due';
  adminEmail: string;
  joinedDate: string;
  usersCount?: number;
  credits: number;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  monthlyCredits?: number;
  createdAt?: any;
  logoUrl?: string;
  brandColor?: string;
  headerTitle?: string;
  welcomeMessage?: string;
  subscription_ends_at?: string;
  custom_candidate_limit?: number;
  verification_credits?: number;
  companySlug?: string;
  whatsapp?: string;
  address?: string;
}

export interface CreditTransaction {
  id?: string;
  companyId: string;
  type: 'debit' | 'credit';
  amount: number;
  action: 'KYC_VERIFICATION' | 'RESEND_INVITE' | 'UNLOCK_PROFILE' | 'TOP_UP' | 'SUBSCRIPTION' | 'INITIAL_CREDIT' | 'MONTHLY_REFILL';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
  metadata?: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
    paymentId?: string;
    invoiceId?: string;
  };
}

export const CREDIT_COSTS = {
  KYC_VERIFICATION: 100,
  RESEND_INVITE: 2,
  UNLOCK_PROFILE: 2
} as const;

export const SUBSCRIPTION_PLANS = {
  FREEMIUM: {
    name: 'Freemium',
    price: 0,
    initialCredits: 1000,
    monthlyCredits: 0,
    candidateViewLimit: 10,
    features: ['Unlimited Job Posting', 'Logo Upload', 'Career Page', 'Limited Candidate View (10)']
  },
  PREMIUM: {
    name: 'Premium',
    price: 150000,
    monthlyCredits: 1500,
    candidateViewLimit: null,
    features: ['All Freemium Features', 'Unlimited Candidate View', 'Full Contact Access', '1500 Monthly Credits']
  }
} as const;

export const CREDIT_TO_IDR_RATE = 100; // 1000 credits = Rp 100,000 (100 IDR per credit)

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
  jobId?: string;
  applicationId?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'SESSION' | 'INVITE';
  date: string;
  data: InterviewSession | AssessmentInvite;
}

export interface Job {
  id?: string;
  companyId: string;
  slug: string;
  title: string;
  location: string;
  jobType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  description: string;
  status: 'Active' | 'Closed';
  enableInstantAssessment: boolean;
  workflowId?: string; // Reference to selected workflow
  datePosted: string;
  applicantsCount?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface JobApplication {
  id?: string;
  jobId: string;
  companyId: string;
  fullName: string;
  email: string;
  whatsapp: string;
  cvUrl: string;
  status: 'Pending' | 'Reviewed' | 'Shortlisted' | 'Rejected';
  assessmentToken?: string;
  sessionId?: string;
  appliedAt: string;
  createdAt?: any;
}


// Workflow System
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  credits: number;
  isMandatory: boolean;
  isEnabled: boolean;
  order: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
}

export interface Workflow {
  id?: string;
  name: string;
  description: string;
  companyId: string;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalCredits: number; // Total credits for selected optional steps
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  credits: number;
  isMandatory: boolean;
  icon: string;
  category: 'assessment' | 'interview' | 'verification' | 'decision';
  isAvailable?: boolean; // false = coming soon
}

// Available workflow templates
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'integrity_assessment',
    name: 'Assessment Integritas',
    description: 'Test integritas dan AI chatbot untuk menilai kejujuran kandidat',
    credits: 0,
    isMandatory: false,
    icon: 'ShieldCheck',
    category: 'assessment'
  },
  {
    id: 'skill_interview',
    name: 'Wawancara Skill',
    description: 'Chatbot AI untuk menilai kemampuan teknis kandidat',
    credits: 5,
    isMandatory: false,
    icon: 'Brain',
    category: 'interview',
    isAvailable: false // Coming Soon
  },
  {
    id: 'live_proctoring',
    name: 'Live Proctoring',
    description: 'Monitoring real-time dengan AI untuk mencegah kecurangan',
    credits: 5,
    isMandatory: false,
    icon: 'Video',
    category: 'assessment',
    isAvailable: false // Coming Soon
  },
  {
    id: 'face_to_face_interview',
    name: 'Wawancara Tatap Muka',
    description: 'Interview langsung dengan HR atau hiring manager',
    credits: 0,
    isMandatory: false,
    icon: 'Users',
    category: 'interview'
  },
  {
    id: 'background_check',
    name: 'Cek Latar Belakang',
    description: 'KYC verification dengan Didit untuk validasi identitas',
    credits: 50,
    isMandatory: false,
    icon: 'Search',
    category: 'verification'
  },
  {
    id: 'document_forgery',
    name: 'Document Forgery Detection',
    description: 'AI detection untuk mendeteksi pemalsuan dokumen',
    credits: 50,
    isMandatory: false,
    icon: 'FileCheck',
    category: 'verification',
    isAvailable: false // Coming Soon
  },
  {
    id: 'social_media_screening',
    name: 'Social Media Screening',
    description: 'Analisis profil media sosial kandidat untuk risk assessment',
    credits: 50,
    isMandatory: false,
    icon: 'Share2',
    category: 'verification',
    isAvailable: false // Coming Soon
  },
  {
    id: 'hire_decision',
    name: 'Rekrut Kandidat',
    description: 'Keputusan untuk merekrut kandidat yang lolos seleksi',
    credits: 0,
    isMandatory: true,
    icon: 'CheckCircle',
    category: 'decision'
  },
  {
    id: 'reject_decision',
    name: 'Tolak Kandidat',
    description: 'Keputusan untuk menolak kandidat yang tidak memenuhi kriteria',
    credits: 0,
    isMandatory: true,
    icon: 'XCircle',
    category: 'decision'
  }
];
