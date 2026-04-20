// ============================================================
// FraudGuard Proctor — Persistent Monitor Window
// Handles: camera snapshots, access-code display, finish-trigger
// ============================================================

const camEl       = document.getElementById('cam');
const snapCanvas  = document.getElementById('snap');
const camStatus   = document.getElementById('cam-status');
const codeEl      = document.getElementById('access-code');
const copyBtn     = document.getElementById('copy-code');
const openBtn     = document.getElementById('open-test');
const finishBtn   = document.getElementById('finish');
const timerEl     = document.getElementById('timer');
const snapCountEl = document.getElementById('snap-count');
const eventCountEl= document.getElementById('event-count');

const SNAPSHOT_INTERVAL_MS = 30_000; // every 30 seconds
const STATUS_POLL_MS = 3_000;

let session = null; // { token, sessionId, accessCode, candidateUrl }
let stream = null;
let snapshotTimer = null;
let statusTimer = null;
let startTime = Date.now();
let snapCount = 0;

// ── Load session ──
(async function init() {
  const stored = await chrome.storage.local.get([
    'extensionToken', 'sessionId', 'proctoringAccessCode', 'proctoringCandidateUrl'
  ]);

  session = {
    token: stored.extensionToken,
    sessionId: stored.sessionId,
    accessCode: stored.proctoringAccessCode || '———',
    candidateUrl: stored.proctoringCandidateUrl || ''
  };

  codeEl.textContent = session.accessCode;

  if (!session.token || !session.sessionId) {
    camStatus.textContent = '❌ Sesi tidak ditemukan — tutup jendela ini';
    return;
  }

  await startCamera();
  startSnapshotLoop();
  startTimerLoop();
  startStatusPoll();

  // Notify service worker that proctoring is now live
  chrome.runtime.sendMessage({
    type: 'PROCTOR_MONITOR_READY',
    sessionId: session.sessionId,
    token: session.token
  });
})();

// ── Camera ──
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: false
    });
    camEl.srcObject = stream;
    camStatus.textContent = '🔴 Live';
    camStatus.style.color = 'var(--danger)';
  } catch (err) {
    console.error('[FG-Monitor] Camera error:', err);
    camStatus.textContent = '❌ Kamera ditolak';
    // Log a critical event so HR sees this
    sendEvent('camera_denied', 'critical', err.message || 'getUserMedia failed');
  }
}

function startSnapshotLoop() {
  snapshotTimer = setInterval(async () => {
    if (!stream || !camEl.videoWidth) return;
    try {
      snapCanvas.width = camEl.videoWidth;
      snapCanvas.height = camEl.videoHeight;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(camEl, 0, 0);
      const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.55);
      const base64 = dataUrl.split(',')[1];

      const apiBase = await getApiBase();
      const resp = await fetch(`${apiBase}/proctoring/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionToken: session.token,
          sessionId: session.sessionId,
          imageBase64: base64,
          width: snapCanvas.width,
          height: snapCanvas.height
        })
      });
      if (resp.ok) {
        snapCount++;
        snapCountEl.textContent = snapCount;
      }
    } catch (err) {
      console.warn('[FG-Monitor] Snapshot upload failed:', err);
    }
  }, SNAPSHOT_INTERVAL_MS);
}

function startTimerLoop() {
  setInterval(() => {
    const secs = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function startStatusPoll() {
  statusTimer = setInterval(async () => {
    const r = await sendMessage({ type: 'GET_PROCTOR_STATUS' });
    if (r) eventCountEl.textContent = r.eventCount || 0;
  }, STATUS_POLL_MS);
}

// ── Buttons ──
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(session.accessCode);
  copyBtn.textContent = '✓ Disalin';
  setTimeout(() => { copyBtn.textContent = 'Salin'; }, 1500);
});

openBtn.addEventListener('click', () => {
  if (session.candidateUrl) {
    chrome.tabs.create({ url: session.candidateUrl });
  } else {
    alert('URL halaman tes belum diatur. Buka tab baru dan navigasi ke link tes dari HR.');
  }
});

finishBtn.addEventListener('click', async () => {
  if (!confirm('Yakin sudah selesai? Jendela ini akan menutup dan riwayat browser akan dianalisis.')) return;
  await finish();
});

async function finish() {
  if (snapshotTimer) clearInterval(snapshotTimer);
  if (statusTimer) clearInterval(statusTimer);
  if (stream) stream.getTracks().forEach(t => t.stop());

  // Stop proctoring + run history scan via service worker
  await sendMessage({ type: 'PROCTOR_FINISH_AND_SCAN' });

  // Notify backend that proctoring finished
  try {
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/proctoring/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionToken: session.token,
        sessionId: session.sessionId
      })
    });
  } catch {}

  await chrome.storage.local.remove(['proctoringAccessCode', 'proctoringCandidateUrl']);
  window.close();
}

// ── Helpers ──
function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

async function getApiBase() {
  const stored = await chrome.storage.local.get(['fg_api_base']);
  return stored.fg_api_base || 'https://hiregood.one/api/extension';
}

// Warn user before close
window.addEventListener('beforeunload', (e) => {
  if (snapshotTimer) {
    e.preventDefault();
    e.returnValue = 'Tes masih berjalan. Yakin tutup?';
    return e.returnValue;
  }
});
