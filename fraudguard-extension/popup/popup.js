// ============================================================
// FraudGuard Screening — Popup Logic
// Manages the 4-step flow: Token → Consent → Analysis → Results
// ============================================================

// ── DOM Elements ──
const steps = {
  token:    document.getElementById('step-token'),
  consent:  document.getElementById('step-consent'),
  analysis: document.getElementById('step-analysis'),
  results:  document.getElementById('step-results')
};

const tokenInput    = document.getElementById('token-input');
const btnValidate   = document.getElementById('btn-validate');
const tokenError    = document.getElementById('token-error');

const consentCheck  = document.getElementById('consent-check');
const btnConsent    = document.getElementById('btn-consent');

const analysisStatus = document.getElementById('analysis-status');

const riskBadge     = document.getElementById('risk-badge');
const riskLevel     = document.getElementById('risk-level');
const statScore     = document.getElementById('stat-score');
const statTotal     = document.getElementById('stat-total');
const statFlagged   = document.getElementById('stat-flagged');
const patNight      = document.getElementById('pat-night');
const patWeekend    = document.getElementById('pat-weekend');
const patFrequent   = document.getElementById('pat-frequent');
const generalDomainsList = document.getElementById('general-domains-list');
const flaggedList   = document.getElementById('flagged-list');
const suspiciousSection = document.getElementById('suspicious-section');
const suspiciousList = document.getElementById('suspicious-list');
const submitStatus  = document.getElementById('submit-status');
const btnClear      = document.getElementById('btn-clear');

const proctorBar    = document.getElementById('proctor-bar');
const proctorEvents = document.getElementById('proctor-events');

let currentToken = null;
let proctorInterval = null;

// ============================================================
// STEP NAVIGATION
// ============================================================

function showStep(stepName) {
  Object.values(steps).forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });
  steps[stepName].classList.add('active');
  steps[stepName].classList.remove('hidden');
}

// ============================================================
// STEP 1: TOKEN VALIDATION
// ============================================================

btnValidate.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showError('Token tidak boleh kosong');
    return;
  }

  btnValidate.disabled = true;
  btnValidate.textContent = 'Memvalidasi...';
  hideError();

  try {
    const response = await sendMessage({ type: 'VALIDATE_TOKEN', token });

    if (response?.success) {
      currentToken = token;
      // Store token temporarily
      await chrome.storage.local.set({ extensionToken: token, sessionId: response.sessionId });
      showStep('consent');
    } else {
      showError(response?.error || 'Token tidak valid atau sudah kadaluarsa');
    }
  } catch (err) {
    showError('Gagal memvalidasi token. Periksa koneksi internet Anda.');
    console.error('[FG-EXT] Token validation error:', err);
  } finally {
    btnValidate.disabled = false;
    btnValidate.textContent = 'Validasi Token';
  }
});

// Also validate on Enter key
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnValidate.click();
});

function showError(msg) {
  tokenError.textContent = msg;
  tokenError.classList.remove('hidden');
}

function hideError() {
  tokenError.classList.add('hidden');
}

// ============================================================
// STEP 2: CONSENT
// ============================================================

consentCheck.addEventListener('change', () => {
  btnConsent.disabled = !consentCheck.checked;
});

btnConsent.addEventListener('click', () => {
  if (!consentCheck.checked) return;
  showStep('analysis');
  startAnalysis();
});

// ============================================================
// STEP 3: ANALYSIS
// ============================================================

async function startAnalysis() {
  analysisStatus.textContent = 'Memindai riwayat browser...';

  // Small delay for UX
  await sleep(500);
  analysisStatus.textContent = 'Menganalisis URL dan domain...';

  try {
    const response = await sendMessage({
      type: 'ANALYZE_HISTORY',
      token: currentToken
    });

    if (response?.success) {
      analysisStatus.textContent = 'Mengenkripsi dan mengirim laporan...';
      await sleep(800);
      displayResults(response.data);
    } else {
      analysisStatus.textContent = '❌ Analisis gagal: ' + (response?.error || 'Unknown error');
    }
  } catch (err) {
    analysisStatus.textContent = '❌ Error: ' + err.message;
    console.error('[FG-EXT] Analysis error:', err);
  }
}

// ============================================================
// STEP 4: DISPLAY RESULTS
// ============================================================

function displayResults(data) {
  showStep('results');

  // Risk badge
  riskLevel.textContent = data.overallRisk;
  riskBadge.className = 'risk-badge risk-' + data.overallRisk.toLowerCase();

  // Stats
  statScore.textContent = data.riskScore;
  statTotal.textContent = formatNumber(data.totalHistoryAnalyzed);
  statFlagged.textContent = data.flaggedSitesCount;

  // Time patterns
  patNight.textContent = data.timePatterns?.lateNightAccess || 0;
  patWeekend.textContent = data.timePatterns?.weekendAccess || 0;
  patFrequent.textContent = data.timePatterns?.frequentAccess || 0;

  // Top General domains
  if (data.topGeneralDomains && data.topGeneralDomains.length > 0) {
    generalDomainsList.innerHTML = data.topGeneralDomains.map(d => `
      <li><strong style="color:var(--primary);">${escapeHtml(d.domain)}</strong> (${d.count}x)</li>
    `).join('');
  } else {
    generalDomainsList.innerHTML = '<p class="empty-text">Tidak ada aktivitas terdeteksi.</p>';
  }

  // Flagged sites
  if (data.flaggedSites && data.flaggedSites.length > 0) {
    flaggedList.innerHTML = data.flaggedSites.map(site => {
      const urlsHtml = (site.urls || []).slice(0, 3).map(u => 
        `<div style="font-size: 0.75rem; color: #666; margin-top:0.25rem; word-break: break-all; border-left: 2px solid var(--danger); padding-left: 5px;">${escapeHtml(u.title || u.url)}</div>`
      ).join('');
      
      return `
      <div class="flagged-item" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between;">
          <span class="domain">${escapeHtml(site.domain)}</span>
          <span class="visits">${site.visitCount}x kunjungan</span>
        </div>
        ${urlsHtml}
      </div>
    `}).join('');
  } else {
    flaggedList.innerHTML = '<p class="empty-text">Tidak ada situs yang ditandai ✅</p>';
  }

  // Suspicious patterns
  if (data.suspiciousPatterns && data.suspiciousPatterns.length > 0) {
    suspiciousSection.classList.remove('hidden');
    suspiciousList.innerHTML = data.suspiciousPatterns
      .map(p => `<li>⚠️ ${escapeHtml(p)}</li>`)
      .join('');
  }

  // Submit status
  if (data.submitted) {
    submitStatus.textContent = '✅ Laporan telah dikirim ke perusahaan.';
    submitStatus.style.color = 'var(--success)';
  } else {
    submitStatus.textContent = '⚠️ Laporan gagal dikirim. Silakan coba lagi.';
    submitStatus.style.color = 'var(--warning)';
  }
}

// ============================================================
// CLEAR DATA
// ============================================================

btnClear.addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionToken', 'sessionId']);
  currentToken = null;
  tokenInput.value = '';
  consentCheck.checked = false;
  btnConsent.disabled = true;
  showStep('token');
});

// ============================================================
// PROCTORING STATUS (check if active)
// ============================================================

async function checkProctoringStatus() {
  try {
    const response = await sendMessage({ type: 'GET_PROCTOR_STATUS' });
    if (response?.active) {
      proctorBar.classList.remove('hidden');
      proctorEvents.textContent = response.eventCount;
    } else {
      proctorBar.classList.add('hidden');
    }
  } catch {
    // ignore
  }
}

// Check proctoring status every 3s
proctorInterval = setInterval(checkProctoringStatus, 3000);
checkProctoringStatus(); // initial check

// ============================================================
// UTILITIES
// ============================================================

function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Restore state if token is saved ──
(async function init() {
  const stored = await chrome.storage.local.get(['extensionToken']);
  if (stored.extensionToken) {
    tokenInput.value = stored.extensionToken;
  }
})();
