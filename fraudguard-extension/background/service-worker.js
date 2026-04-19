// ============================================================
// FraudGuard Screening — Background Service Worker
// Handles: history analysis, proctoring monitoring, API calls
// ============================================================

import { CONFIG } from '../utils/constants.js';
import { analyzeHistoryItems, calculateProctoringScore, isGamblingDomain, isAIToolDomain } from '../utils/scoring.js';
import { encryptData, generateSignature } from '../utils/crypto.js';

// ── State ──
let proctoringActive = false;
let proctoringEvents = [];
let proctoringStartTime = null;
let currentSessionId = null;
let currentToken = null;

// ============================================================
// MESSAGE HANDLER — popup.js & content-script.js communicate here
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'ANALYZE_HISTORY':
      handleAnalyzeHistory(message.token)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // keep channel open for async

    case 'VALIDATE_TOKEN':
      validateToken(message.token)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'START_PROCTORING':
      startProctoring(message.sessionId, message.token);
      sendResponse({ success: true });
      break;

    case 'STOP_PROCTORING':
      stopProctoring()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_PROCTOR_STATUS':
      sendResponse({
        active: proctoringActive,
        eventCount: proctoringEvents.length,
        duration: proctoringStartTime ? Math.floor((Date.now() - proctoringStartTime) / 1000) : 0
      });
      break;
  }
});

// ============================================================
// GAMBLING HISTORY ANALYSIS
// ============================================================

async function handleAnalyzeHistory(extensionToken) {
  console.log('[FG-EXT] Starting history analysis...');

  // 1. Get browser history (last 30 days)
  const startTime = Date.now() - (CONFIG.HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const historyItems = await chrome.history.search({
    text: '',
    startTime,
    maxResults: CONFIG.MAX_HISTORY_ITEMS
  });

  console.log(`[FG-EXT] Retrieved ${historyItems.length} history items`);

  // 2. Analyze
  const analysis = analyzeHistoryItems(historyItems);
  analysis.extensionVersion = CONFIG.EXTENSION_VERSION;
  analysis.timestamp = new Date().toISOString();
  analysis.consentToken = extensionToken;

  console.log(`[FG-EXT] Analysis complete: Risk=${analysis.overallRisk}, Score=${analysis.riskScore}, Flagged=${analysis.flaggedSitesCount}`);

  // 3. Encrypt report
  const encryptedData = await encryptData(analysis, extensionToken);
  const signature = await generateSignature(analysis, extensionToken);

  // 4. Submit to backend
  const response = await submitToBackend('submitGamblingAnalysis', {
    encryptedData,
    signature,
    extensionToken,
    // Also send plaintext summary (non-sensitive) for quick processing
    summary: {
      overallRisk: analysis.overallRisk,
      riskScore: analysis.riskScore,
      totalHistoryAnalyzed: analysis.totalHistoryAnalyzed,
      flaggedSitesCount: analysis.flaggedSitesCount,
      historyTooLow: analysis.historyTooLow
    }
  });

  // 5. Clear sensitive data from memory
  console.log('[FG-EXT] Analysis submitted, clearing local data');

  return {
    ...analysis,
    reportId: response?.reportId || null,
    submitted: true
  };
}

// ============================================================
// TOKEN VALIDATION
// ============================================================

async function validateToken(extensionToken) {
  console.log('[FG-EXT] Validating token...');

  const response = await submitToBackend('getExtensionConfig', {
    extensionToken
  });

  if (response?.valid) {
    console.log('[FG-EXT] Token valid');
    return { success: true, config: response.config, sessionId: response.sessionId };
  } else {
    console.log('[FG-EXT] Token invalid');
    return { success: false, error: response?.message || 'Invalid or expired token' };
  }
}

// ============================================================
// INTERVIEW PROCTORING
// ============================================================

function startProctoring(sessionId, token) {
  if (proctoringActive) {
    console.log('[FG-EXT] Proctoring already active');
    return;
  }

  console.log('[FG-EXT] Starting proctoring for session:', sessionId);
  proctoringActive = true;
  proctoringEvents = [];
  proctoringStartTime = Date.now();
  currentSessionId = sessionId;
  currentToken = token;

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(onTabActivated);

  // Listen for URL navigations (detect gambling/AI visits)
  chrome.webNavigation.onCompleted.addListener(onNavigationCompleted);

  // Set badge to indicate proctoring is active
  chrome.action.setBadgeText({ text: '●' });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
}

async function stopProctoring() {
  if (!proctoringActive) {
    return { success: true, score: 0, events: 0 };
  }

  console.log('[FG-EXT] Stopping proctoring...');
  proctoringActive = false;

  // Cleanup listeners
  chrome.tabs.onActivated.removeListener(onTabActivated);
  chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted);

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  const sessionDuration = Math.floor((Date.now() - proctoringStartTime) / 1000);
  const score = calculateProctoringScore(proctoringEvents);

  // Count events by type
  const tabSwitchCount = proctoringEvents.filter(e => e.type === 'tab_switch').length;
  const windowBlurCount = proctoringEvents.filter(e => e.type === 'window_blur').length;

  const proctoringReport = {
    extensionToken: currentToken,
    sessionId: currentSessionId,
    totalEvents: proctoringEvents.length,
    events: proctoringEvents,
    tabSwitchCount,
    windowBlurCount,
    suspiciousActivityScore: score,
    sessionDuration,
    startedAt: new Date(proctoringStartTime).toISOString(),
    completedAt: new Date().toISOString()
  };

  // Submit to backend
  try {
    await submitToBackend('submitProctoringEvent', proctoringReport);
    console.log(`[FG-EXT] Proctoring report submitted: score=${score}, events=${proctoringEvents.length}`);
  } catch (err) {
    console.error('[FG-EXT] Failed to submit proctoring report:', err);
  }

  // Clear state
  proctoringEvents = [];
  proctoringStartTime = null;
  currentSessionId = null;
  currentToken = null;

  return { success: true, score, events: proctoringReport.totalEvents };
}

// ── Proctoring event handlers ──

function onTabActivated(activeInfo) {
  if (!proctoringActive) return;

  proctoringEvents.push({
    type: 'tab_switch',
    timestamp: new Date().toISOString(),
    details: `Switched to tab ${activeInfo.tabId}`,
    severity: 'warning'
  });

  console.log('[FG-EXT] [PROCTOR] Tab switch detected');
}

function onNavigationCompleted(details) {
  if (!proctoringActive || details.frameId !== 0) return;

  const url = details.url;

  if (isGamblingDomain(url)) {
    proctoringEvents.push({
      type: 'gambling_site_visit',
      timestamp: new Date().toISOString(),
      details: `Visited gambling site: ${new URL(url).hostname}`,
      severity: 'critical'
    });
    console.log('[FG-EXT] [PROCTOR] 🔴 Gambling site visit during assessment!');
  }

  if (isAIToolDomain(url)) {
    proctoringEvents.push({
      type: 'ai_tool_visit',
      timestamp: new Date().toISOString(),
      details: `Visited AI tool: ${new URL(url).hostname}`,
      severity: 'warning'
    });
    console.log('[FG-EXT] [PROCTOR] ⚠️ AI tool visit during assessment');
  }
}

// ============================================================
// API CLIENT — Calls Firebase Cloud Functions
// ============================================================

async function submitToBackend(functionName, data) {
  const url = `${CONFIG.API_BASE}/${functionName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result.result || result;
  } catch (error) {
    console.error(`[FG-EXT] API call ${functionName} failed:`, error);
    throw error;
  }
}
