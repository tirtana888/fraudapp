// ============================================================
// FraudGuard Screening — Constants
// Gambling domains, keywords, and configuration
// ============================================================

export const GAMBLING_DOMAINS = [
  // ── International ──
  'pokerstars.com', 'betfair.com', 'bet365.com', 'betking.com',
  '188bet.com', 'dafabet.com', 'sbobet.com', 'maxbet.com',
  'royalvegascasino.com', 'casinoeuropa.com', 'onlinepoker.com',
  'betpawa.com', 'spinpalace.com', 'europalace.com',
  'unibet.com', 'williamhill.com', 'paddypower.com',
  'ladbrokes.com', '22bet.com', '1xbet.com', 'bwin.com',
  'betway.com', 'draftkings.com', 'fanduel.com',
  'pokerstars.net', 'partypoker.com', '888casino.com',
  '888poker.com', 'casumo.com', 'leovegas.com',

  // ── Togel (Indonesia) ──
  'togelsingapore.com', 'togelhongkong.com', 'togelsydney.com',
  'datasydney.com', 'datahongkong.com', 'paito.net',
  'live-draw-hk.com', 'pengeluaransgp.com',

  // ── Slot Online Indonesia ──
  'pragmaticplay.com', 'slot88.com', 'joker123.com',
  'habanero.com', 'pgsoft.com', 'spadegaming.com',

  // ── Sportsbook Indonesia ──
  'sbobet88.com', 'nova88.com', 'cmd368.com',
  'ibcbet.com',

  // ── Casino Online Indonesia ──
  'idn-poker.com', 'idnplay.com',
  'w88.com', 'fun88.com', 'm88.com',

  // ── Aggregator / Agen ──
  'mpo.com', 'dewabet.com'
];

export const GAMBLING_KEYWORDS = [
  // English
  'poker', 'casino', 'gamble', 'gambling', 'bet', 'betting',
  'slots', 'roulette', 'blackjack', 'baccarat', 'lottery',
  'sportsbet', 'sportsbetting', 'jackpot', 'wager',

  // Indonesian
  'judi', 'togel', 'slot', 'bandar', 'agen judi',
  'situs judi', 'daftar slot', 'bonus new member',
  'rtp slot', 'scatter', 'maxwin', 'gacor',
  'prediksi togel', 'bocoran', 'angka main',
  'deposit pulsa', 'parlay', 'mix parlay',
  'handicap', 'over under', 'bandar bola',
  'slot online', 'judi online', 'taruhan'
];

// Domains that indicate AI tool usage (for proctoring)
export const AI_TOOL_DOMAINS = [
  'chat.openai.com', 'chatgpt.com', 'gemini.google.com',
  'claude.ai', 'perplexity.ai', 'bard.google.com',
  'copilot.microsoft.com', 'you.com', 'poe.com',
  'character.ai', 'phind.com'
];

export const CONFIG = {
  HISTORY_DAYS: 30,
  MAX_HISTORY_ITEMS: 5000,
  CONSENT_EXPIRY_HOURS: 24,
  LATE_NIGHT_START: 22,   // 10 PM
  LATE_NIGHT_END: 6,      // 6 AM
  MIN_HISTORY_THRESHOLD: 50, // Below this = suspicious (cleared history)
  EXTENSION_VERSION: '1.1.0',

  // API base: loaded dynamically from chrome.storage (set by content-script from page origin).
  // Falls back to the production HireGood domain.
  API_BASE_DEFAULT: 'https://hiregood.one/api/extension',

  // Scoring weights
  SCORE: {
    DOMAIN_MATCH: 15,
    KEYWORD_MATCH: 8,
    LATE_NIGHT_ACCESS: 3,
    MULTIPLE_SITES_BONUS: 20,
    FREQUENT_ACCESS: 5,
    MULTIPLE_SITES_THRESHOLD: 3,
    FREQUENT_DAYS_THRESHOLD: 5,
    MAX_SCORE: 100
  },

  // Risk level thresholds
  RISK: {
    LOW_MAX: 20,
    MEDIUM_MAX: 50
    // Above 50 = HIGH
  },

  // Proctoring scores
  PROCTOR_SCORE: {
    TAB_SWITCH: 5,
    WINDOW_BLUR: 3,
    COPY_PASTE: 15,
    DEVTOOLS_OPEN: 20,
    GAMBLING_SITE_VISIT: 25,
    AI_TOOL_VISIT: 10,
    MAX_SCORE: 100
  }
};
