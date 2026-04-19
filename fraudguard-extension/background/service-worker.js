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

// ── Dynamic API base (set by content-script from page origin) ──
async function getApiBase() {
  const stored = await chrome.storage.local.get(['fg_api_base']);
  return stored.fg_api_base || CONFIG.API_BASE_DEFAULT;
}

// ============================================================
// MESSAGE HANDLER — popup.js & content-script.js communicate here
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'ANALYZE_HISTORY':
      handleAnalyzeHistory(message.token)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

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

    case 'PROCTOR_EVENT':
      if (proctoringActive && message.event) {
        proctoringEvents.push(message.event);
      }
      sendResponse({ success: true });
      break;

    case 'SET_API_BASE':
      chrome.storage.local.set({ fg_api_base: message.apiBase });
      sendResponse({ success: true });
      break;
  }
});

// ============================================================
// GAMBLING HISTORY ANALYSIS
// ============================================================

async function handleAnalyzeHistory(extensionToken) {
  console.log('[FG-EXT] Starting history analysis...');

  const startTime = Date.now() - (CONFIG.HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const historyItems = await chrome.history.search({
    text: '',
    startTime,
    maxResults: CONFIG.MAX_HISTORY_ITEMS
  });

  console.log(`[FG-EXT] Retrieved ${historyItems.length} history items`);

  const analysis = analyzeHistoryItems(historyItems);
  analysis.extensionVersion = CONFIG.EXTENSION_VERSION;
  analysis.timestamp = new Date().toISOString();
  analysis.consentToken = extensionToken;

  console.log(`[FG-EXT] Risk=${analysis.overallRisk}, Score=${analysis.riskScore}, Flagged=${analysis.flaggedSitesCount}`);

  const encryptedData = await encryptData(analysis, extensionToken);
  const signature = await generateSignature(analysis, extensionToken);

  const response = await callApi('submit-gambling', {
    encryptedData,
    signature,
    extensionToken,
    summary: {
      overallRisk: analysis.overallRisk,
      riskScore: analysis.riskScore,
      totalHistoryAnalyzed: analysis.totalHistoryAnalyzed,
      flaggedSitesCount: analysis.flaggedSitesCount,
      flaggedSites: analysis.flaggedSites,
      timePatterns: analysis.timePatterns,
      suspiciousPatterns: analysis.suspiciousPatterns,
      historyTooLow: analysis.historyTooLow
    }
  });

  console.log('[FG-EXT] Analysis submitted');

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

  const response = await callApi('validate-token', { extensionToken });

  if (response?.valid) {
    console.log('[FG-EXT] Token valid');
    return { success: true, config: response.config, sessionId: response.sessionId };
  } else {
    console.log('[FG-EXT] Token invalid');
    return { success: false, error: response?.message || 'Token tidak valid atau sudah kadaluarsa' };
  }
}

// ============================================================
// INTERVIEW PROCTORING
// ============================================================

function startProctoring(sessionId, token) {
  if (proctoringActive) return;

  console.log('[FG-EXT] Starting proctoring for session:', sessionId);
  proctoringActive = true;
  proctoringEvents = [];
  proctoringStartTime = Date.now();
  currentSessionId = sessionId;
  currentToken = token;

  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.webNavigation.onCompleted.addListener(onNavigationCompleted);

  chrome.action.setBadgeText({ text: '●' });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
}

async function stopProctoring() {
  if (!proctoringActive) return { success: true, score: 0, events: 0 };

  console.log('[FG-EXT] Stopping proctoring...');
  proctoringActive = false;

  chrome.tabs.onActivated.removeListener(onTabActivated);
  chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted);

  chrome.action.setBadgeText({ text: '' });

  const sessionDuration = Math.floor((Date.now() - proctoringStartTime) / 1000);
  const score = calculateProctoringScore(proctoringEvents);

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

  try {
    await callApi('submit-proctoring', proctoringReport);
    console.log(`[FG-EXT] Proctoring submitted: score=${score}, events=${proctoringEvents.length}`);
  } catch (err) {
    console.error('[FG-EXT] Failed to submit proctoring:', err);
  }

  proctoringEvents = [];
  proctoringStartTime = null;
  currentSessionId = null;
  currentToken = null;

  return { success: true, score, events: proctoringReport.totalEvents };
}

function onTabActivated(activeInfo) {
  if (!proctoringActive) return;
  proctoringEvents.push({
    type: 'tab_switch',
    timestamp: new Date().toISOString(),
    details: `Switched to tab ${activeInfo.tabId}`,
    severity: 'warning'
  });
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
  }

  if (isAIToolDomain(url)) {
    proctoringEvents.push({
      type: 'ai_tool_visit',
      timestamp: new Date().toISOString(),
      details: `Visited AI tool: ${new URL(url).hostname}`,
      severity: 'warning'
    });
  }
}

// ============================================================
// API CLIENT — calls the FraudGuard API server
// ============================================================

async function callApi(endpoint, data) {
  const apiBase = await getApiBase();
  const url = `${apiBase}/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server error ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[FG-EXT] API call /${endpoint} failed:`, error);
    throw error;
  }
}
