// ============================================================
// FraudGuard Screening — Content Script
// Injected into FraudGuard pages to bridge React app ↔ extension
// Also sets the API base URL dynamically from page origin.
// ============================================================

(function () {
  'use strict';

  console.log('[FG-EXT] Content script loaded on:', window.location.hostname);

  // ── Tell background the API base URL based on current page origin ──
  // This allows the extension to work on both dev (Replit) and production.
  const apiBase = window.location.origin + '/api/extension';
  chrome.runtime.sendMessage({ type: 'SET_API_BASE', apiBase });

  // ── Listen for messages FROM the FraudGuard React app ──
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    const { type, sessionId, token } = event.data;

    switch (type) {

      case 'FRAUDGUARD_PROCTOR_START':
        chrome.runtime.sendMessage({
          type: 'START_PROCTORING',
          sessionId,
          token
        }, (response) => {
          window.postMessage({
            type: 'FRAUDGUARD_PROCTOR_STARTED',
            success: response?.success || false
          }, '*');
        });
        break;

      case 'FRAUDGUARD_PROCTOR_STOP':
        chrome.runtime.sendMessage({ type: 'STOP_PROCTORING' }, (response) => {
          window.postMessage({
            type: 'FRAUDGUARD_PROCTOR_STOPPED',
            success: response?.success || false,
            score: response?.score || 0,
            events: response?.events || 0
          }, '*');
        });
        break;

      case 'FRAUDGUARD_PROCTOR_STATUS':
        chrome.runtime.sendMessage({ type: 'GET_PROCTOR_STATUS' }, (response) => {
          window.postMessage({
            type: 'FRAUDGUARD_PROCTOR_STATUS_RESPONSE',
            ...response
          }, '*');
        });
        break;
    }
  });

  // ── Monitor copy-paste events on assessment pages ──
  document.addEventListener('copy', () => {
    if (!isAssessmentPage()) return;
    chrome.runtime.sendMessage({
      type: 'PROCTOR_EVENT',
      event: {
        type: 'copy_paste',
        timestamp: new Date().toISOString(),
        details: 'Copy action detected during assessment',
        severity: 'critical'
      }
    });
  });

  document.addEventListener('paste', () => {
    if (!isAssessmentPage()) return;
    chrome.runtime.sendMessage({
      type: 'PROCTOR_EVENT',
      event: {
        type: 'copy_paste',
        timestamp: new Date().toISOString(),
        details: 'Paste action detected during assessment',
        severity: 'critical'
      }
    });
  });

  // ── Monitor window blur ──
  document.addEventListener('visibilitychange', () => {
    if (!isAssessmentPage()) return;
    if (document.hidden) {
      chrome.runtime.sendMessage({
        type: 'PROCTOR_EVENT',
        event: {
          type: 'window_blur',
          timestamp: new Date().toISOString(),
          details: 'Assessment tab lost visibility',
          severity: 'warning'
        }
      });
    }
  });

  // ── Detect DevTools (resize heuristic) ──
  let devtoolsOpen = false;
  const devtoolsThreshold = 160;

  function checkDevtools() {
    const widthDiff = window.outerWidth - window.innerWidth > devtoolsThreshold;
    const heightDiff = window.outerHeight - window.innerHeight > devtoolsThreshold;

    if ((widthDiff || heightDiff) && !devtoolsOpen) {
      devtoolsOpen = true;
      chrome.runtime.sendMessage({
        type: 'PROCTOR_EVENT',
        event: {
          type: 'devtools_open',
          timestamp: new Date().toISOString(),
          details: 'Developer tools opened during assessment',
          severity: 'critical'
        }
      });
    } else if (!widthDiff && !heightDiff) {
      devtoolsOpen = false;
    }
  }

  setInterval(() => {
    if (isAssessmentPage()) checkDevtools();
  }, 2000);

  function isAssessmentPage() {
    const url = window.location.href.toLowerCase();
    return url.includes('mode=assess') ||
           url.includes('mode=interview') ||
           url.includes('/assessment') ||
           url.includes('/test');
  }

  // ── Notify page that extension is installed ──
  window.postMessage({
    type: 'FRAUDGUARD_EXTENSION_INSTALLED',
    version: '1.1.0'
  }, '*');

})();
