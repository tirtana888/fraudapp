
export interface PlanConfig {
  max_candidates: number | 'unlimited';
  data_retention_days: number | 'unlimited';
  allow_manual_interview_copilot: boolean;
  allow_sjt_test: boolean;
  allow_financial_strain: boolean;
  allow_euphemism_detection: boolean;
  allow_consistency_score: boolean;
  allow_doc_forgery_detection: boolean;
  allow_3rd_party_check: boolean;
  allow_permanent_link: boolean;
  white_label: boolean;
  ai_model_type: 'Standard' | 'Forensic'; // New Flag for AI Personality
}

export const PLAN_LIMITS: Record<'Basic' | 'Premium' | 'Enterprise', PlanConfig> = {
  Basic: {
    max_candidates: 15,
    data_retention_days: 30,
    allow_manual_interview_copilot: false,
    allow_sjt_test: false,
    allow_financial_strain: false, 
    allow_euphemism_detection: false,
    allow_consistency_score: false,
    allow_doc_forgery_detection: false,
    allow_3rd_party_check: false,
    allow_permanent_link: false, // Random Link concept (Manual)
    white_label: false,
    ai_model_type: 'Standard',
  },
  Premium: {
    max_candidates: 9999, // Unlimited Candidate Links
    data_retention_days: 'unlimited',
    allow_manual_interview_copilot: true,
    allow_sjt_test: true,
    allow_financial_strain: true,
    allow_euphemism_detection: true, // "Killer AI" Features Enabled
    allow_consistency_score: true,   // "Killer AI" Features Enabled
    allow_doc_forgery_detection: true,
    allow_3rd_party_check: false,
    allow_permanent_link: true,
    white_label: false,
    ai_model_type: 'Forensic',
  },
  Enterprise: {
    max_candidates: 'unlimited',
    data_retention_days: 'unlimited',
    allow_manual_interview_copilot: true,
    allow_sjt_test: true,
    allow_financial_strain: true,
    allow_euphemism_detection: true,
    allow_consistency_score: true,
    allow_doc_forgery_detection: true,
    allow_3rd_party_check: true, // SLIK/Dukcapil
    allow_permanent_link: true,
    white_label: true,
    ai_model_type: 'Forensic',
  }
};
