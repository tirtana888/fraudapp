export interface PlanConfig {
  maxCandidates: number;
  maxInterviews: number;
  hasAdvancedAnalytics: boolean;
  hasAPIAccess: boolean;
  hasPrioritySupport: boolean;
  hasCustomBranding: boolean;
}

export const PLAN_LIMITS: Record<'Freemium' | 'Premium', PlanConfig> = {
  Freemium: {
    maxCandidates: 10,
    maxInterviews: 50,
    hasAdvancedAnalytics: false,
    hasAPIAccess: false,
    hasPrioritySupport: false,
    hasCustomBranding: false
  },
  Premium: {
    maxCandidates: -1, // Unlimited
    maxInterviews: -1, // Unlimited
    hasAdvancedAnalytics: true,
    hasAPIAccess: true,
    hasPrioritySupport: true,
    hasCustomBranding: true
  }
};
