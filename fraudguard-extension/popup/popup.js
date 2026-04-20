// ============================================================
// FraudGuard Screening — Popup Logic
// Flow: Token → Mode → (Consent → Analysis → Results) OR
//                      (Proctor Consent → Open Monitor → Active)
// ============================================================

const steps = {
  token:           document.getElementById('step-token'),
  mode:            document.getElementById('step-mode'),
  consent:         document.getElementById('step-consent'),
  proctorConsent:  document.getElementById('step-proctor-consent'),
  analysis:        document.getElementById('step-analysis'),
  proctorActive:   document.getElementById('step-proctor-active'),
  results:         document.getElementById('step-results')
};

const tokenInput    = document.getElementById('token-input');
const btnValidate   = document.getElementById('btn-validate');
const tokenError    = document.getElementById('token-error');
const apiBaseInput  = document.getElementById('api-base-input');
const btnSaveServer = document.getElementById('btn-save-server');
const apiBaseStatus = document.getElementById('api-base-status');

const btnModeHistory  = document.getElementById('btn-mode-history');
const btnModeProctor  = document.getElementById('btn-mode-proctor');

const consentCheck    = document.getElementById('consent-check');
const btnConsent      = document.getElementById('btn-consent');

const proctorConsentCheck = document.getElementById('proctor-consent-check');
const btnProctorConsent   = document.getElementById('btn-proctor-consent');
const activeCode          = document.getElementById('active-code');
const btnFocusMonitor     = document.getElementById('btn-focus-monitor');

const analysisStatus = document.getElementById('analysis-status');
const riskBadge   = document.getElementById('risk-badge');
const riskLevel   = document.getElementById('risk-level');
const statScore   = document.getElementById('stat-score');
const statTotal   = document.getElementById('stat-total');
const statFlagged = document.getElementById('stat-flagged');
const patNight    = document.getElementById('pat-night');
const patWeekend  = document.getElementById('pat-weekend');
const patFrequent = document.getElementById('pat-frequent');
const flaggedList = document.getElementById('flagged-list');
const suspiciousSection = document.getElementById('suspicious-section');
const suspiciousList    = document.getElementById('suspicious-list');
const submitStatus      = document.getElementById('submit-status');
const btnClear          = document.getElementById('btn-clear');

const proctorBar    = document.getElementById('proctor-bar');
const proctorEvents = document.getElementById('proctor-events');

const DEFAULT_API_ORIGIN = 'https://hiregood.one';

let currentToken = null;
let currentSessionId = null;
let currentAccessCode = '';
let currentCandidateUrl = '';

// ── API base picker ──
function normalizeOrigin(value) {
  if (!value) return '';
  let v = value.trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try { return new URL(v).origin; } catch { return ''; }
}
(async function loadApiBase() {
  if (!apiBaseInput) return;
  try {
    const stored = await chrome.storage.local.get(['fg_api_base']);
    const base = stored.fg_api_base || (DEFAULT_API_ORIGIN + '/api/extension');
    apiBaseInput.value = base.replace(/\/api\/extension\/?$/, '');
  } catch {}
})();
btnSaveServer?.addEventListener('click', async () => {
  const origin = normalizeOrigin(apiBaseInput.value) || DEFAULT_API_ORIGIN;
  apiBaseInput.value = origin;
  await chrome.storage.local.set({ fg_api_base: origin + '/api/extension' });
  apiBaseStatus.textContent = '✓ Tersimpan';
  setTimeout(() => { apiBaseStatus.textContent = ''; }, 2500);
});

// ── Step navigation ──
function showStep(stepName) {
  Object.values(steps).forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });
  steps[stepName].classList.add('active');
  steps[stepName].classList.remove('hidden');
}

// ── STEP 1: Validate token ──
btnValidate.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) return showError('Token tidak boleh kosong');
  btnValidate.disabled = true;
  btnValidate.textContent = 'Memvalidasi...';
  hideError();
  try {
    const response = await sendMessage({ type: 'VALIDATE_TOKEN', token });
    if (response?.success) {
      currentToken = token;
      currentSessionId = response.sessionId;
      currentAccessCode = response.accessCode || '';
      currentCandidateUrl = response.candidateUrl || '';
      await chrome.storage.local.set({
        extensionToken: token,
        sessionId: response.sessionId,
        proctoringAccessCode: currentAccessCode,
        proctoringCandidateUrl: currentCandidateUrl
      });
      showStep('mode');
    } else {
      const stored = await chrome.storage.local.get(['fg_api_base']);
      const origin = (stored.fg_api_base || `${DEFAULT_API_ORIGIN}/api/extension`).replace(/\/api\/extension\/?$/, '');
      showError(`${response?.error || 'Token tidak valid atau sudah kadaluarsa'}\n\nServer: ${origin}\nUbah di "Pengaturan Server" jika salah.`);
    }
  } catch (err) {
    showError('Gagal memvalidasi token. Periksa koneksi internet.');
  } finally {
    btnValidate.disabled = false;
    btnValidate.textContent = 'Validasi Token';
  }
});
tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnValidate.click(); });

function showError(msg) { tokenError.textContent = msg; tokenError.classList.remove('hidden'); }
function hideError() { tokenError.classList.add('hidden'); }

// ── STEP 2: Mode picker ──
btnModeHistory.addEventListener('click', () => showStep('consent'));
btnModeProctor.addEventListener('click', () => showStep('proctorConsent'));

// ── STEP 3a: History consent ──
consentCheck.addEventListener('change', () => { btnConsent.disabled = !consentCheck.checked; });
btnConsent.addEventListener('click', () => {
  if (!consentCheck.checked) return;
  showStep('analysis');
  startAnalysis();
});

// ── STEP 3b: Proctor consent → open monitor window ──
proctorConsentCheck.addEventListener('change', () => {
  btnProctorConsent.disabled = !proctorConsentCheck.checked;
});
btnProctorConsent.addEventListener('click', async () => {
  if (!proctorConsentCheck.checked) return;
  btnProctorConsent.disabled = true;
  btnProctorConsent.textContent = 'Membuka monitor...';
  try {
    const r = await sendMessage({
      type: 'OPEN_PROCTOR_MONITOR',
      sessionId: currentSessionId,
      token: currentToken,
      accessCode: currentAccessCode,
      candidateUrl: currentCandidateUrl
    });
    if (r?.success) {
      activeCode.textContent = currentAccessCode || '———';
      showStep('proctorActive');
    } else {
      btnProctorConsent.disabled = false;
      btnProctorConsent.textContent = 'Coba Lagi';
      alert('Gagal membuka jendela monitor: ' + (r?.error || 'unknown'));
    }
  } catch (err) {
    btnProctorConsent.disabled = false;
    btnProctorConsent.textContent = 'Coba Lagi';
    alert('Error: ' + err.message);
  }
});

btnFocusMonitor?.addEventListener('click', async () => {
  // Re-open monitor window if it was closed
  await sendMessage({
    type: 'OPEN_PROCTOR_MONITOR',
    sessionId: currentSessionId,
    token: currentToken,
    accessCode: currentAccessCode,
    candidateUrl: currentCandidateUrl
  });
});

// ── ANALYSIS ──
async function startAnalysis() {
  analysisStatus.textContent = 'Memindai riwayat browser...';
  await sleep(500);
  analysisStatus.textContent = 'Menganalisis URL dan domain...';
  try {
    const response = await sendMessage({ type: 'ANALYZE_HISTORY', token: currentToken });
    if (response?.success) {
      analysisStatus.textContent = 'Mengirim laporan...';
      await sleep(800);
      displayResults(response.data);
    } else {
      analysisStatus.textContent = '❌ Analisis gagal: ' + (response?.error || 'Unknown error');
    }
  } catch (err) {
    analysisStatus.textContent = '❌ Error: ' + err.message;
  }
}

function displayResults(data) {
  showStep('results');
  riskLevel.textContent = data.overallRisk;
  riskBadge.className = 'risk-badge risk-' + data.overallRisk.toLowerCase();
  statScore.textContent = data.riskScore;
  statTotal.textContent = formatNumber(data.totalHistoryAnalyzed);
  statFlagged.textContent = data.flaggedSitesCount;
  patNight.textContent = data.timePatterns?.lateNightAccess || 0;
  patWeekend.textContent = data.timePatterns?.weekendAccess || 0;
  patFrequent.textContent = data.timePatterns?.frequentAccess || 0;
  if (data.flaggedSites?.length > 0) {
    flaggedList.innerHTML = data.flaggedSites.map(site => `
      <div class="flagged-item">
        <span class="domain">${escapeHtml(site.domain)}</span>
        <span class="visits">${site.visitCount}x kunjungan</span>
      </div>
    `).join('');
  } else {
    flaggedList.innerHTML = '<p class="empty-text">Tidak ada situs yang ditandai ✅</p>';
  }
  if (data.suspiciousPatterns?.length > 0) {
    suspiciousSection.classList.remove('hidden');
    suspiciousList.innerHTML = data.suspiciousPatterns.map(p => `<li>⚠️ ${escapeHtml(p)}</li>`).join('');
  }
  submitStatus.textContent = data.submitted ? '✅ Laporan telah dikirim ke perusahaan.' : '⚠️ Laporan gagal dikirim.';
  submitStatus.style.color = data.submitted ? 'var(--success)' : 'var(--warning)';
}

btnClear.addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionToken', 'sessionId', 'proctoringAccessCode', 'proctoringCandidateUrl']);
  currentToken = null;
  tokenInput.value = '';
  consentCheck.checked = false;
  btnConsent.disabled = true;
  proctorConsentCheck.checked = false;
  btnProctorConsent.disabled = true;
  showStep('token');
});

// ── Proctoring status poll ──
async function checkProctoringStatus() {
  try {
    const response = await sendMessage({ type: 'GET_PROCTOR_STATUS' });
    if (response?.active) {
      proctorBar.classList.remove('hidden');
      proctorEvents.textContent = response.eventCount;
    } else {
      proctorBar.classList.add('hidden');
    }
  } catch {}
}
setInterval(checkProctoringStatus, 3000);
checkProctoringStatus();

// ── Helpers ──
function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatNumber(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ── Restore state ──
(async function init() {
  const stored = await chrome.storage.local.get([
    'extensionToken', 'sessionId', 'proctoringAccessCode', 'proctoringCandidateUrl'
  ]);
  if (stored.extensionToken) {
    tokenInput.value = stored.extensionToken;
    currentToken = stored.extensionToken;
    currentSessionId = stored.sessionId;
    currentAccessCode = stored.proctoringAccessCode || '';
    currentCandidateUrl = stored.proctoringCandidateUrl || '';
  }
  // If proctoring is already active, jump to active screen
  const r = await sendMessage({ type: 'GET_PROCTOR_STATUS' });
  if (r?.active) {
    activeCode.textContent = currentAccessCode || '———';
    showStep('proctorActive');
  }
})();
