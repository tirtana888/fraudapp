// ============================================================
// FraudGuard Screening — Scoring Engine
// Risk calculation for gambling history + proctoring events
// ============================================================

import { GAMBLING_DOMAINS, GAMBLING_KEYWORDS, AI_TOOL_DOMAINS, CONFIG } from './constants.js';

/**
 * Check if a URL's domain matches a known gambling domain.
 */
export function isGamblingDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return GAMBLING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL contains gambling-related keywords.
 */
export function hasGamblingKeyword(url) {
  const lowerUrl = url.toLowerCase();
  return GAMBLING_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
}

/**
 * Check if a URL belongs to an AI tool (for proctoring).
 */
export function isAIToolDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return AI_TOOL_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a visit timestamp falls in the "late night" window.
 */
export function isLateNight(timestamp) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  return hour >= CONFIG.LATE_NIGHT_START || hour < CONFIG.LATE_NIGHT_END;
}

/**
 * Check if a visit timestamp falls on a weekend.
 */
export function isWeekend(timestamp) {
  const day = new Date(timestamp).getDay();
  return day === 0 || day === 6;
}

/**
 * Analyze a list of browser history items and produce a gambling risk report.
 *
 * @param {Array<{url: string, visitCount: number, lastVisitTime: number}>} historyItems
 * @returns {Object} analysis report
 */
export function analyzeHistoryItems(historyItems) {
  const analysis = {
    overallRisk: 'LOW',
    riskScore: 0,
    totalHistoryAnalyzed: historyItems.length,
    flaggedSitesCount: 0,
    flaggedSites: [],         // { domain, visitCount, lastVisit, riskLevel, matchType }
    timePatterns: {
      lateNightAccess: 0,
      weekendAccess: 0,
      frequentAccess: 0
    },
    suspiciousPatterns: [],
    historyTooLow: false
  };

  // ── Anomaly: history count suspiciously low ──
  if (historyItems.length < CONFIG.MIN_HISTORY_THRESHOLD) {
    analysis.suspiciousPatterns.push('Browser history unusually low — possible history clearance');
    analysis.historyTooLow = true;
    analysis.riskScore += 10;
  }

  // ── Collect unique flagged domains ──
  const domainMap = new Map(); // domain -> { visitCount, lastVisit, riskLevel, matchType }
  const dailyVisits = new Map(); // dateString -> count

  for (const item of historyItems) {
    if (!item.url) continue;

    let hostname;
    try {
      hostname = new URL(item.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      continue;
    }

    const isDomain = isGamblingDomain(item.url);
    const isKeyword = !isDomain && hasGamblingKeyword(item.url);

    if (isDomain || isKeyword) {
      const existing = domainMap.get(hostname);
      const visitCount = item.visitCount || 1;
      const lastVisit = new Date(item.lastVisitTime).toISOString();

      if (existing) {
        existing.visitCount += visitCount;
        if (new Date(lastVisit) > new Date(existing.lastVisit)) {
          existing.lastVisit = lastVisit;
        }
      } else {
        domainMap.set(hostname, {
          domain: hostname,
          visitCount,
          lastVisit,
          riskLevel: isDomain ? 'HIGH' : 'MEDIUM',
          matchType: isDomain ? 'domain' : 'keyword'
        });
      }

      // Score
      if (isDomain) {
        analysis.riskScore += CONFIG.SCORE.DOMAIN_MATCH;
      } else {
        analysis.riskScore += CONFIG.SCORE.KEYWORD_MATCH;
      }

      // Time patterns
      if (isLateNight(item.lastVisitTime)) {
        analysis.timePatterns.lateNightAccess++;
        analysis.riskScore += CONFIG.SCORE.LATE_NIGHT_ACCESS;
      }
      if (isWeekend(item.lastVisitTime)) {
        analysis.timePatterns.weekendAccess++;
      }

      // Daily frequency
      const dateKey = new Date(item.lastVisitTime).toISOString().split('T')[0];
      dailyVisits.set(dateKey, (dailyVisits.get(dateKey) || 0) + 1);
    }
  }

  // ── Frequency scoring ──
  for (const [, count] of dailyVisits) {
    if (count > 10) {
      analysis.timePatterns.frequentAccess++;
      analysis.riskScore += CONFIG.SCORE.FREQUENT_ACCESS;
    }
  }

  // ── Pattern bonuses ──
  const uniqueSites = domainMap.size;
  if (uniqueSites >= CONFIG.SCORE.MULTIPLE_SITES_THRESHOLD) {
    analysis.riskScore += CONFIG.SCORE.MULTIPLE_SITES_BONUS;
    analysis.suspiciousPatterns.push(`Multiple gambling sites detected (${uniqueSites} sites)`);
  }
  if (dailyVisits.size >= CONFIG.SCORE.FREQUENT_DAYS_THRESHOLD) {
    analysis.riskScore += 15;
    analysis.suspiciousPatterns.push(`Frequent gambling access over ${dailyVisits.size} days`);
  }
  if (analysis.timePatterns.lateNightAccess > 5) {
    analysis.riskScore += 10;
    analysis.suspiciousPatterns.push('Significant late-night gambling activity');
  }

  // ── Cap score ──
  analysis.riskScore = Math.min(analysis.riskScore, CONFIG.SCORE.MAX_SCORE);

  // ── Risk level ──
  if (analysis.riskScore >= CONFIG.RISK.MEDIUM_MAX) {
    analysis.overallRisk = 'HIGH';
  } else if (analysis.riskScore >= CONFIG.RISK.LOW_MAX) {
    analysis.overallRisk = 'MEDIUM';
  } else {
    analysis.overallRisk = 'LOW';
  }

  // ── Flatten flagged sites ──
  analysis.flaggedSites = Array.from(domainMap.values())
    .sort((a, b) => b.visitCount - a.visitCount);
  analysis.flaggedSitesCount = analysis.flaggedSites.length;

  return analysis;
}

/**
 * Calculate a proctoring suspiciousness score from events.
 *
 * @param {Array<{type: string}>} events
 * @returns {number} score (0-100)
 */
export function calculateProctoringScore(events) {
  let score = 0;
  const S = CONFIG.PROCTOR_SCORE;

  for (const event of events) {
    switch (event.type) {
      case 'tab_switch':          score += S.TAB_SWITCH; break;
      case 'window_blur':         score += S.WINDOW_BLUR; break;
      case 'copy_paste':          score += S.COPY_PASTE; break;
      case 'devtools_open':       score += S.DEVTOOLS_OPEN; break;
      case 'gambling_site_visit': score += S.GAMBLING_SITE_VISIT; break;
      case 'ai_tool_visit':       score += S.AI_TOOL_VISIT; break;
    }
  }

  return Math.min(score, S.MAX_SCORE);
}
