// ============================================================
// FraudGuard Screening — Background Service Worker
// Handles: history analysis, proctoring monitoring, API calls,
// and the persistent monitor window for camera + tab tracking.
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
let monitorWindowId = null;

// ── Dynamic API base ──
async function getApiBase() {
  const stored = await chrome.storage.local.get(['fg_api_base']);
  return stored.fg_api_base || CONFIG.API_BASE_DEFAULT;
}

// ============================================================
// MESSAGE HANDLER
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
        duration: proctoringStartTime ? Math.floor((Date.now() - proctoringStartTime) / 1000) : 0,
        sessionId: currentSessionId
      });
      break;

    case 'PROCTOR_EVENT':
      if (proctoringActive && message.event) {
        proctoringEvents.push(message.event);
        // Persist event to backend immediately (best-effort)
        postEvent(message.event).catch(() => {});
      }
      sendResponse({ success: true });
      break;

    case 'OPEN_PROCTOR_MONITOR':
      // Called from popup after consent. Opens the persistent monitor window.
      openMonitorWindow(message.sessionId, message.token, message.accessCode, message.candidateUrl)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'PROCTOR_MONITOR_READY':
      // Monitor window finished loading + camera ready
      if (!proctoringActive) {
        startProctoring(message.sessionId, message.token);
      }
      sendResponse({ success: true });
      break;

    case 'PROCTOR_FINISH_AND_SCAN':
      // Called by monitor.js when candidate clicks "Saya Sudah Selesai"
      finishAndScan()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SET_API_BASE':
      chrome.storage.local.set({ fg_api_base: message.apiBase });
      sendResponse({ success: true });
      break;
  }
});

// ============================================================
// MONITOR WINDOW (camera + persistent UI)
// ============================================================

async function openMonitorWindow(sessionId, token, accessCode, candidateUrl) {
  // Persist session info so monitor.js can read it
  await chrome.storage.local.set({
    extensionToken: token,
    sessionId,
    proctoringAccessCode: accessCode || '',
    proctoringCandidateUrl: candidateUrl || ''
  });

  // Tell backend we're starting proctoring (records consent + start time)
  try {
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/proctoring/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionToken: token, sessionId })
    });
  } catch (err) {
    console.warn('[FG-EXT] proctoring/start failed:', err);
  }

  if (monitorWindowId !== null) {
    try {
      await chrome.windows.update(monitorWindowId, { focused: true });
      return { success: true, windowId: monitorWindowId };
    } catch {
      monitorWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('monitor/monitor.html'),
    type: 'popup',
    width: 720,
    height: 520,
    focused: true
  });
  monitorWindowId = win.id;

  chrome.windows.onRemoved.addListener(function handler(closedId) {
    if (closedId === monitorWindowId) {
      monitorWindowId = null;
      // If proctoring was still active, mark it stopped
      if (proctoringActive) {
        stopProctoring().catch(() => {});
      }
      chrome.windows.onRemoved.removeListener(handler);
    }
  });

  return { success: true, windowId: monitorWindowId };
}

async function finishAndScan() {
  // 1. Stop proctoring (uploads aggregated proctoring_data)
  await stopProctoring();
  // 2. Run history analysis
  try {
    const stored = await chrome.storage.local.get(['extensionToken']);
    if (stored.extensionToken) {
      await handleAnalyzeHistory(stored.extensionToken);
    }
  } catch (err) {
    console.warn('[FG-EXT] Auto-history-scan failed:', err);
  }
  return { success: true };
}

// ============================================================
// HISTORY ANALYSIS
// ============================================================
async function handleAnalyzeHistory(extensionToken) {
  console.log('[FG-EXT] Starting history analysis...');
  const startTime = Date.now() - (CONFIG.HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const historyItems = await chrome.history.search({
    text: '', startTime, maxResults: CONFIG.MAX_HISTORY_ITEMS
  });

  const analysis = analyzeHistoryItems(historyItems);
  analysis.extensionVersion = CONFIG.EXTENSION_VERSION;
  analysis.timestamp = new Date().toISOString();
  analysis.consentToken = extensionToken;

  const encryptedData = await encryptData(analysis, extensionToken);
  const signature = await generateSignature(analysis, extensionToken);

  const response = await callApi('submit-gambling', {
    encryptedData, signature, extensionToken,
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

  return { ...analysis, reportId: response?.reportId || null, submitted: true };
}

// ============================================================
// TOKEN VALIDATION
// ============================================================
async function validateToken(extensionToken) {
  const response = await callApi('validate-token', { extensionToken });
  if (response?.valid) {
    return {
      success: true,
      config: response.config,
      sessionId: response.sessionId,
      accessCode: response.accessCode,
      candidateUrl: response.candidateUrl
    };
  }
  return { success: false, error: response?.message || 'Token tidak valid' };
}

// ============================================================
// PROCTORING (tab-switch / nav / blur)
// ============================================================
function startProctoring(sessionId, token) {
  if (proctoringActive) return;
  console.log('[FG-EXT] Start proctoring:', sessionId);
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
  proctoringActive = false;
  chrome.tabs.onActivated.removeListener(onTabActivated);
  chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted);
  chrome.action.setBadgeText({ text: '' });

  const sessionDuration = Math.floor((Date.now() - proctoringStartTime) / 1000);
  const score = calculateProctoringScore(proctoringEvents);
  const tabSwitchCount = proctoringEvents.filter(e => e.type === 'tab_switch').length;
  const windowBlurCount = proctoringEvents.filter(e => e.type === 'window_blur').length;

  const proctoringReport = {
    extensionToken: currentToken, sessionId: currentSessionId,
    totalEvents: proctoringEvents.length, events: proctoringEvents,
    tabSwitchCount, windowBlurCount, suspiciousActivityScore: score,
    sessionDuration,
    startedAt: new Date(proctoringStartTime).toISOString(),
    completedAt: new Date().toISOString()
  };

  try {
    await callApi('submit-proctoring', proctoringReport);
  } catch (err) {
    console.error('[FG-EXT] submit-proctoring failed:', err);
  }

  proctoringEvents = []; proctoringStartTime = null;
  currentSessionId = null; currentToken = null;
  return { success: true, score, events: proctoringReport.totalEvents };
}

function onTabActivated(activeInfo) {
  if (!proctoringActive) return;
  const evt = {
    type: 'tab_switch', timestamp: new Date().toISOString(),
    details: `Switched to tab ${activeInfo.tabId}`, severity: 'warning'
  };
  proctoringEvents.push(evt);
  postEvent(evt).catch(() => {});
}

function onNavigationCompleted(details) {
  if (!proctoringActive || details.frameId !== 0) return;
  const url = details.url;
  let evt = null;
  if (isGamblingDomain(url)) {
    evt = { type: 'gambling_site_visit', timestamp: new Date().toISOString(),
            details: `Visited gambling site: ${new URL(url).hostname}`, severity: 'critical' };
  } else if (isAIToolDomain(url)) {
    evt = { type: 'ai_tool_visit', timestamp: new Date().toISOString(),
            details: `Visited AI tool: ${new URL(url).hostname}`, severity: 'warning' };
  }
  if (evt) {
    proctoringEvents.push(evt);
    postEvent(evt).catch(() => {});
  }
}

async function postEvent(event) {
  if (!currentToken || !currentSessionId) return;
  const apiBase = await getApiBase();
  await fetch(`${apiBase}/proctoring/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extensionToken: currentToken,
      sessionId: currentSessionId,
      event
    })
  });
}

// ============================================================
// API CLIENT
// ============================================================
async function callApi(endpoint, data) {
  const apiBase = await getApiBase();
  const url = `${apiBase}/${endpoint}`;
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
}
