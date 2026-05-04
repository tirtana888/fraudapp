
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
  inviteSource?: string;
  timeline?: Array<{
    stage: string;
    status: 'completed' | 'current' | 'pending';
    date?: string;
    note?: string;
    credits?: number;
    isMandatory?: boolean;
  }>;
  backgroundCheck?: BackgroundCheckData;
  backgroundCheckStatus?: string;
  backgroundCheckCompletedAt?: string;
  unlockedAt?: string;
  unlockedByCompanyId?: string;
  workflowId?: string;
  riskScore?: number;
  gamblingAnalysis?: GamblingAnalysis;
  proctoringData?: ProctoringData;
  proctoringConsentAt?: string;
  proctoringStartedAt?: string;
  proctoringFinishedAt?: string;
  pddiktiVerification?: PddiktiVerification;
}

// ========== PDDikti NIM Verification ==========

export interface PddiktiMatchedStudent {
  id: string;
  nama: string;
  nim: string;
  nama_pt: string;
  prodi: string;
  jenjang: string;
  status_saat_ini: string;
  tanggal_masuk?: string | null;
}

export interface PddiktiSearchMatch {
  id: string;
  nama: string;
  nim: string;
  nama_pt: string;
  nama_prodi: string;
}

export interface PddiktiAIAnalysis {
  confidence: number;
  reasoning: string;
  bestMatchIndex: number;
}

export interface PddiktiVerification {
  status: 'verified' | 'not_found' | 'multiple_matches' | 'pending' | 'error';
  verifiedAt?: string;
  searchKeyword?: string;
  institution?: string;
  degree?: string;
  graduationYear?: string;
  matchedStudent?: PddiktiMatchedStudent | null;
  allMatches?: PddiktiSearchMatch[];
  aiAnalysis?: PddiktiAIAnalysis | null;
  error?: string | null;
}

// ========== KYC / Background Check Types ==========

export interface KYCData {
  // OCR-extracted personal information
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  nationality?: string;

  // Document information
  documentType?: string;
  documentNumber?: string;
  issuingState?: string;
  dateOfIssue?: string;
  expirationDate?: string;

  // Address information
  address?: string;
  placeOfBirth?: string;

  // Images (Base64 encoded)
  portraitImage?: string;
  frontDocumentImage?: string;
  backDocumentImage?: string;

  // Verification results
  idVerification?: {
    status?: string;
    warnings?: string[];
    confidence?: number;
  };
  faceMatch?: {
    status?: string;
    confidence?: number;
  };

  // Metadata
  extractedAt?: any; // Firestore Timestamp
}

// ========== IP Data Interface ==========
export interface IPData {
  ipAddress?: string;
  country?: string;
  isVpnOrTor?: boolean;
  status?: string;
  isp?: string;
  timezone?: string;
  city?: string;
  region?: string;
  connectionType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: string;
  userAgent?: string;
}

export interface GamblingFlaggedSite {
  domain: string;
  visitCount: number;
  lastVisit: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  matchType: 'domain' | 'keyword';
  category?: 'gambling' | 'adult';
}

export interface GamblingAnalysis {
  overallRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  totalHistoryAnalyzed: number;
  flaggedSitesCount: number;
  gamblingSitesCount?: number;
  adultSitesCount?: number;
  flaggedSites: GamblingFlaggedSite[];
  timePatterns: {
    lateNightAccess: number;
    weekendAccess: number;
    frequentAccess: number;
  };
  suspiciousPatterns: string[];
  historyTooLow: boolean;
  completedAt: string;
}

export interface ProctoringEvent {
  type: 'tab_switch' | 'window_blur' | 'copy_paste' | 'devtools_open' | 'gambling_site_visit' | 'ai_tool_visit';
  timestamp: string;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ProctoringData {
  totalEvents: number;
  events: ProctoringEvent[];
  tabSwitchCount: number;
  windowBlurCount: number;
  suspiciousActivityScore: number;
  sessionDuration: number;
  isFlagged: boolean;
  startedAt: string;
  completedAt: string;
  submittedAt: string;
}

export interface BackgroundCheckData {
  status?: 'pending' | 'in_progress' | 'approved' | 'declined' | 'in_review';
  diditSessionId?: string;
  decision?: string;
  verificationLink?: string;
  createdAt?: string | { seconds: number };
  lastUpdated?: string | { seconds: number };
  kycData?: KYCData;
  ipAnalysis?: IPData;
  warnings?: Array<string | { short_description?: string; long_description?: string; risk?: string }>;
  rawWebhookData?: {
    status?: string;
    webhook_type?: string;
    session_number?: string;
  };
  idVerification?: {
    fullName?: string;
    documentNumber?: string;
    documentType?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    gender?: string;
    address?: string;
    status?: string;
    portraitImage?: string;
    frontImage?: string;
    backImage?: string;
    confidence?: number;
    warnings?: string[];
  };
  faceMatch?: {
    score?: number;
    status?: string;
    sourceImage?: string;
    targetImage?: string;
  };
  liveness?: {
    score?: number;
    status?: string;
    ageEstimation?: number;
    referenceImage?: string;
  };
}

// ========== End KYC Types ==========

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
  role: 'System Admin' | 'Company Admin' | 'User' | 'Lead Investigator' | 'superadmin';
  avatar?: string;
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
  notificationPreferences?: {
    newCandidateApplied?: boolean;
    assessmentCompleted?: boolean;
    dailyDigest?: boolean;
    soundEnabled?: boolean;
    digestTime?: string; // "08:00"
  };
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

export interface Notification {
  id?: string;
  companyId: string;
  type: 'new_candidate' | 'assessment_completed';
  title: string;
  message: string;
  icon: string;
  link: string;
  read: boolean;
  createdAt: any;
  metadata?: {
    candidateId?: string;
    candidateName?: string;
    jobTitle?: string;
    sessionId?: string;
    riskLevel?: string;
  };
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
    credits: 2,
    isMandatory: true,
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
  },
  {
    id: 'live_proctoring',
    name: 'Proctored Wawancara',
    description: 'Monitoring real-time dengan AI untuk mencegah kecurangan saat wawancara',
    credits: 5,
    isMandatory: false,
    icon: 'Video',
    category: 'assessment',
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
    id: 'reference_check',
    name: 'Cek Referensi Kerja',
    description: 'Verifikasi pengalaman kerja kandidat via WhatsApp ke HR perusahaan sebelumnya',
    credits: 30,
    isMandatory: false,
    icon: 'PhoneCall',
    category: 'verification'
  },
  {
    id: 'gambling_screening',
    name: 'Test Judol (Browser History)',
    description: 'Screening riwayat browser kandidat untuk mendeteksi aktivitas judi online via Chrome Extension',
    credits: 50,
    isMandatory: false,
    icon: 'Globe',
    category: 'verification'
  },
  {
    id: 'document_forgery',
    name: 'Document Forgery Detection',
    description: 'AI detection untuk mendeteksi pemalsuan dokumen (ijazah, KTP, SKCK)',
    credits: 50,
    isMandatory: false,
    icon: 'FileCheck',
    category: 'verification',
  },
  {
    id: 'social_media_screening',
    name: 'Social Media Screening',
    description: 'Analisis profil media sosial kandidat untuk risk assessment',
    credits: 50,
    isMandatory: false,
    icon: 'Share2',
    category: 'verification',
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

// ========== Promo Code Interface ==========
export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
