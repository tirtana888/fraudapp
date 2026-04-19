// ============================================================
// FraudGuard Screening — Content Script
// Injected into FraudGuard pages (hiregood.one / localhost:3000)
// Bridges communication between React app and extension
// ============================================================

(function () {
  'use strict';

  console.log('[FG-EXT] Content script loaded on:', window.location.hostname);

  // ── Listen for messages FROM the FraudGuard React app ──
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    const { type, sessionId, token } = event.data;

    switch (type) {

      case 'FRAUDGUARD_PROCTOR_START':
        console.log('[FG-EXT] Received START_PROCTORING from page');
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
        console.log('[FG-EXT] Received STOP_PROCTORING from page');
        chrome.runtime.sendMessage({
          type: 'STOP_PROCTORING'
        }, (response) => {
          window.postMessage({
            type: 'FRAUDGUARD_PROCTOR_STOPPED',
            success: response?.success || false,
            score: response?.score || 0,
            events: response?.events || 0
          }, '*');
        });
        break;

      case 'FRAUDGUARD_PROCTOR_STATUS':
        chrome.runtime.sendMessage({
          type: 'GET_PROCTOR_STATUS'
        }, (response) => {
          window.postMessage({
            type: 'FRAUDGUARD_PROCTOR_STATUS_RESPONSE',
            ...response
          }, '*');
        });
        break;
    }
  });

  // ── Monitor copy-paste events on FraudGuard assessment pages ──
  document.addEventListener('copy', () => {
    if (!isAssessmentPage()) return;
    console.log('[FG-EXT] [PROCTOR] Copy event detected on assessment page');
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
    console.log('[FG-EXT] [PROCTOR] Paste event detected on assessment page');
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

  // ── Monitor window blur (user leaving the assessment tab) ──
  document.addEventListener('visibilitychange', () => {
    if (!isAssessmentPage()) return;
    if (document.hidden) {
      console.log('[FG-EXT] [PROCTOR] Window blur — user left assessment tab');
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

  // ── Detect devtools open (resize-based heuristic) ──
  let devtoolsOpen = false;
  const devtoolsThreshold = 160;

  function checkDevtools() {
    const widthDiff = window.outerWidth - window.innerWidth > devtoolsThreshold;
    const heightDiff = window.outerHeight - window.innerHeight > devtoolsThreshold;

    if ((widthDiff || heightDiff) && !devtoolsOpen) {
      devtoolsOpen = true;
      console.log('[FG-EXT] [PROCTOR] 🔴 DevTools opened!');
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

  // Check devtools every 2 seconds (only on assessment pages)
  setInterval(() => {
    if (isAssessmentPage()) {
      checkDevtools();
    }
  }, 2000);

  // ── Helper ──
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
    version: '1.0.0'
  }, '*');

})();
