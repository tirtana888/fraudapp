export interface PlanConfig {
  maxCandidates: number;
  max_candidates: number; // Legacy support
  maxInterviews: number;
  hasAdvancedAnalytics: boolean;
  hasAPIAccess: boolean;
  hasPrioritySupport: boolean;
  hasCustomBranding: boolean;
  allow_permanent_link: boolean;
}

export const PLAN_LIMITS: Record<'Freemium' | 'Premium', PlanConfig> = {
  Freemium: {
    maxCandidates: 10,
    max_candidates: 10,
    maxInterviews: 50,
    hasAdvancedAnalytics: false,
    hasAPIAccess: false,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    allow_permanent_link: false
  },
  Premium: {
    maxCandidates: -1, // Unlimited
    max_candidates: -1,
    maxInterviews: -1, // Unlimited
    hasAdvancedAnalytics: true,
    hasAPIAccess: true,
    hasPrioritySupport: true,
    hasCustomBranding: true,
    allow_permanent_link: true
  }
};
