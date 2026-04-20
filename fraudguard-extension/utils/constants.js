// ============================================================
// FraudGuard Screening — Constants
// Gambling domains, keywords, and configuration
// ============================================================

export const GAMBLING_DOMAINS = [
  // ── International ──
  'pokerstars.com', 'pokerstars.net', 'partypoker.com', 'onlinepoker.com',
  '888poker.com', '888casino.com', 'casumo.com', 'leovegas.com',
  'bet365.com', 'betfair.com', 'betking.com', 'betway.com',
  'unibet.com', 'williamhill.com', 'paddypower.com', 'ladbrokes.com',
  '22bet.com', '1xbet.com', '1xbit.com', 'bwin.com', 'bovada.lv',
  '188bet.com', 'dafabet.com', 'sbobet.com', 'sbobet88.com', 'maxbet.com',
  'royalvegascasino.com', 'casinoeuropa.com', 'spinpalace.com', 'europalace.com',
  'betpawa.com', 'pinnacle.com', 'betvictor.com', 'mybookie.ag',
  'draftkings.com', 'fanduel.com', 'caesars.com', 'mgm.com',
  'stake.com', 'stake.us', 'roobet.com', 'duelbits.com', 'rollbit.com',
  'bcgame.io', 'bc.game', 'cloudbet.com', 'sportsbet.io', 'thunderpick.com',
  'betonline.ag', 'bookmaker.eu', 'casino.com', 'casinotop10.net',

  // ── Togel (Indonesia) ──
  'togelsingapore.com', 'togelhongkong.com', 'togelsydney.com',
  'datasydney.com', 'datahongkong.com', 'datasgp.com', 'datahk.com',
  'paito.net', 'paitowarna.com', 'paito-hk.com', 'paito-sgp.com',
  'live-draw-hk.com', 'live-draw-sgp.com', 'live-draw-sdy.com',
  'pengeluaransgp.com', 'pengeluaranhk.com', 'keluaransgp.com',
  'keluaranhk.com', 'totohk.com', 'totosgp.com', 'totomacau.com',
  'syairhk.com', 'syairsgp.com', 'syairsydney.com', 'forumsyair.com',
  'rumustogel.com', 'prediksitogel.com', 'angkajitu.com', 'angkamain.com',
  'mimpitogel.com', 'tafsirmimpi.com', 'bukumimpi.com',
  'togelhariini.com', 'togel4d.com', 'togel88.com', 'togelmacau.com',

  // ── Slot Online Indonesia ──
  'pragmaticplay.com', 'pragmaticplay.net', 'slot88.com', 'slot777.com',
  'slot888.com', 'slot138.com', 'slot5000.com', 'slotgacor.com',
  'joker123.com', 'joker388.com', 'joker8888.com',
  'habanero.com', 'pgsoft.com', 'pg-soft.com', 'spadegaming.com',
  'microgaming.com', 'playngo.com', 'netent.com', 'yggdrasilgaming.com',
  'rtgaming.com', 'reelkingdom.com', 'jiligaming.com',
  'gates-of-olympus.com', 'starlight-princess.com', 'sweet-bonanza.com',
  'mahjongways.com', 'mahjong-ways.com', 'aztecgems.com', 'wildwest-gold.com',
  'zeus-vs-hades.com', 'gemsaviator.com', 'sugarrush.com',

  // ── Sportsbook Indonesia ──
  'sbobet88.com', 'sbobetwap.com', 'nova88.com', 'nova88indo.com',
  'cmd368.com', 'cmd368id.com', 'ibcbet.com', 'maxbet.org',
  'judibola.com', 'agenbola.com', 'sbobet.app', 'agen-sbobet.com',

  // ── Casino Online Indonesia ──
  'idn-poker.com', 'idnpoker.com', 'idnplay.com', 'idnsport.com',
  'idnlive.com', 'idncasino.com', 'pkv-games.com', 'pkvgames.com',
  'qq-poker.com', 'qqpoker88.com', 'dominoqq.com', 'bandarqq.com',
  'qiu-qiu.com', 'capsasusun.com',
  'w88.com', 'w88indo.com', 'fun88.com', 'fun88indo.com',
  'm88.com', 'm88indo.com', '12bet.com', '188loto.com',

  // ── Aggregator / Agen / Bandar ──
  'mpo.com', 'mpoplay.com', 'mpo777.com', 'mpo500.com', 'mpo1000.com',
  'dewabet.com', 'dewa-poker.com', 'dewapoker.com', 'dewatogel.com',
  'rajabet.com', 'rajapoker.com', 'rajaslot.com', 'rajawali.com',
  'agenslot.com', 'agencasino.com', 'agentogel.com',
  'bandarslot.com', 'bandartogel.com', 'bandarbola.com', 'bandarjudi.com',
  'situsjudi.com', 'situsslot.com', 'situstogel.com', 'situsbola.com',
  'judionline.com', 'taruhanbola.com', 'taruhanjudi.com',

  // ── Crypto Casino / Crash / Mines ──
  'crash-game.com', 'mines-game.com', 'aviator-game.com',
  'spaceman-game.com', 'plinko-game.com', 'limbo-game.com',
];

export const GAMBLING_KEYWORDS = [
  // ── English (umum) ──
  'poker', 'casino', 'gamble', 'gambling', 'bet', 'betting', 'bookmaker',
  'slots', 'roulette', 'blackjack', 'baccarat', 'lottery', 'lotto',
  'sportsbet', 'sportsbetting', 'jackpot', 'wager', 'wagering',
  'sportsbook', 'parlay', 'odds', 'oddschecker', 'punters',
  'crash-game', 'aviator-game', 'plinko', 'mines-game', 'limbo-game',

  // ── Indonesian umum ──
  'judi', 'judionline', 'judi-online', 'perjudian', 'taruhan',
  'togel', 'toto', 'lotre', 'lotere', 'undian',
  'slot', 'slotonline', 'slot-online', 'slotgacor', 'slot-gacor',
  'casino', 'kasino', 'judikasino',
  'bandar', 'bandarjudi', 'agen', 'agenjudi', 'situsjudi', 'situs-judi',

  // ── Togel-specific ──
  'togelsgp', 'togelhk', 'togelsydney', 'togelhongkong', 'togelsingapore',
  'togelmacau', 'togelhariini', 'pengeluaran', 'keluaran', 'pengeluaransgp',
  'keluaranhk', 'pengeluaranhk', 'data-sgp', 'data-hk', 'data-sdy', 'datatogel',
  'live-draw', 'livedraw', 'live-result', 'liveresult',
  'paito', 'paitowarna', 'syair', 'forumsyair',
  'prediksi', 'prediksitogel', 'prediksisgp', 'prediksihk', 'angkajitu',
  'angka-main', 'angkamain', 'angka-keluar', 'mimpi-togel', 'tafsirmimpi',
  'bukumimpi', '2d', '3d', '4d', 'colok-bebas', 'colok-jitu', 'colokjitu',
  'shio', 'rumustogel', 'rumus-togel',

  // ── Slot-specific ──
  'rtp', 'rtpslot', 'rtp-slot', 'rtp-live', 'rtplive',
  'scatter', 'scatterhitam', 'maxwin', 'max-win', 'gacor', 'gacor-hari-ini',
  'jackpotslot', 'jackpot-slot', 'mega-jackpot', 'megawin',
  'gates-of-olympus', 'starlight-princess', 'sweet-bonanza', 'sweetbonanza',
  'mahjong-ways', 'mahjongways', 'aztec-gems', 'wild-west-gold',
  'koi-gate', 'lucky-neko', 'sugar-rush', 'fortune-tiger', 'wild-bandito',
  'spaceman', 'aviator', 'pragmatic', 'pragmaticplay', 'pgsoft', 'pg-soft',
  'habanero', 'spadegaming', 'microgaming', 'joker-gaming', 'jokergaming',
  'demoslot', 'demo-slot', 'akun-demo', 'akun-pro',
  'slot-deposit', 'slot-pulsa', 'slot-dana', 'slot-ovo', 'slot-gopay',
  'slot-bca', 'slot-bri', 'slot-mandiri', 'slot-bni', 'slot-qris',
  'slot-thailand', 'server-thailand', 'slot-luar-negeri',
  'free-spin', 'freespin', 'bonus-new-member', 'bonus-member-baru',
  'depo-10k', 'depo-25k', 'deposit-10rb', 'deposit-25rb', 'min-depo',
  'olympus1000', 'olympus-1000', 'zeus-1000', 'zeus1000',

  // ── Sportsbook / Bola ──
  'sportsbook', 'judibola', 'judi-bola', 'taruhanbola', 'taruhan-bola',
  'agenbola', 'agen-bola', 'sbobet', 'maxbet', 'ibcbet', 'cmd368', 'nova88',
  'mix-parlay', 'mixparlay', 'parlay', 'handicap', 'asian-handicap',
  'over-under', 'overunder', 'bandar-bola', 'bandarbola', 'bola-online',
  'bola-tangkas', 'bolatangkas', 'tebak-skor', 'tebakskor',
  'live-bet', 'livebet', 'live-betting',

  // ── Casino / Live Casino / Card games ──
  'baccarat', 'bakarat', 'sicbo', 'sic-bo', 'dragon-tiger', 'dragontiger',
  'live-casino', 'livecasino', 'live-dealer',
  'pkv', 'pkv-games', 'pkvgames', 'idnpoker', 'idn-poker', 'idnplay',
  'qq-online', 'dominoqq', 'domino-qq', 'bandarq', 'bandar-q',
  'capsa-susun', 'capsasusun', 'qiu-qiu', 'qiuqiu', 'sakong', 'adu-q', 'aduq',

  // ── Crypto / Crash / Mines ──
  'stake-com', 'stake.us', 'roobet', 'duelbits', 'rollbit', 'bc-game', 'bcgame',
  'thunderpick', 'cloudbet', 'sportsbet-io',
  'crash', 'crash-bet', 'aviator-bet', 'mines-bet', 'limbo-bet', 'plinko-bet',

  // ── Deposit / Withdraw / Promo ──
  'deposit-pulsa', 'deposit-dana', 'deposit-ovo', 'deposit-qris',
  'withdraw-cepat', 'wd-cepat', 'wd-tanpa-potongan', 'minimal-deposit',
  'bonus-cashback', 'bonus-rollingan', 'bonus-referral', 'bonus-deposit',
  'turnover', 'rolling', 'cashback-100', 'event-slot', 'event-judi',

  // ── Singkatan / slang ──
  'jp', 'jp-paus', 'jp-besar', 'maxwin-x500', 'maxwin-x1000',
  'gacor88', 'gacor138', 'gacor777', 'hoki', 'hoki-slot', 'hoki-togel',
];

// ============================================================
// Adult / Pornography (treated as a separate red-flag category)
// ============================================================
export const ADULT_DOMAINS = [
  // ── Tube / streaming besar ──
  'pornhub.com', 'pornhubpremium.com', 'rt.pornhub.com',
  'xvideos.com', 'xvideos2.com', 'xvideos3.com', 'xvideos.es',
  'xnxx.com', 'xnxx2.com', 'xnxx3.com', 'xnxx.tv',
  'xhamster.com', 'xhamster2.com', 'xhamster3.com', 'xhamsterlive.com',
  'redtube.com', 'redtube.net', 'youporn.com', 'tube8.com', 'tube8live.com',
  'spankbang.com', 'spankwire.com', 'extremetube.com', 'porntube.com',
  'tnaflix.com', 'empflix.com', 'beeg.com', 'porn.com', 'porn300.com',
  'porn4days.com', 'porndoe.com', 'pornone.com', 'porntrex.com',
  'eporner.com', 'hclips.com', 'hqporner.com', 'sex.com', 'sexvid.xxx',
  'drtuber.com', 'sunporno.com', 'gotporn.com', 'pornoxo.com',
  '4tube.com', 'fux.com', 'keezmovies.com', 'mofosex.com', 'pornhd.com',
  'txxx.com', 'upornia.com', 'vjav.com', 'fapality.com', 'fapster.xxx',

  // ── Premium / studio ──
  'brazzers.com', 'naughtyamerica.com', 'realitykings.com', 'bangbros.com',
  'mofos.com', 'digitalplayground.com', 'vivid.com', 'wicked.com',
  'evilangel.com', 'kink.com', 'twistys.com', 'babes.com',
  'blacked.com', 'tushy.com', 'vixen.com', 'deeper.com', 'slayed.com',
  'adulttime.com', 'wankz.com', 'team-skeet.com', 'teamskeet.com',

  // ── Cam / live ──
  'chaturbate.com', 'cam4.com', 'bongacams.com', 'stripchat.com',
  'livejasmin.com', 'myfreecams.com', 'cams.com', 'flirt4free.com',
  'streamate.com', 'camsoda.com', 'cherry.tv', 'jerkmate.com',

  // ── Creator / paywall ──
  'onlyfans.com', 'fansly.com', 'manyvids.com', 'clips4sale.com',
  'iwantclips.com', 'fancentro.com', 'justforfans.app', 'justfor.fans',
  'admireme.vip', 'avn.com',

  // ── Hentai / anime adult ──
  'nhentai.net', 'nhentai.to', 'nhentai.xxx', 'hanime.tv', 'hentaihaven.xxx',
  'hentai-foundry.com', 'hentai2read.com', 'hentaimama.io', 'hitomi.la',
  'ehentai.org', 'e-hentai.org', 'exhentai.org', 'fakku.net',
  'simply-hentai.com', 'rule34.xxx', 'rule34.us', 'rule34hentai.net',
  'gelbooru.com', 'danbooru.donmai.us',

  // ── Indonesia / regional ──
  'bokep.com', 'bokepindo.com', 'bokepindoxxx.com', 'bokephd.com',
  'bokepjepang.com', 'bokepbarat.com', 'bokepasia.com', 'bokepin.com',
  'bokepsin.com', 'bokeptube.com', 'bokep4d.com', 'bokep21.com',
  'simontok.com', 'simontok.app', 'simontox.com',
  'cerita-dewasa.com', 'ceritadewasa.com', 'ceritaseks.com',
  'ngentot.com', 'memek.com', 'tante-girang.com', 'tantegirang.com',

  // ── Aggregator / forum ──
  'motherless.com', 'thumbzilla.com', 'pornpics.com', 'sex.xxx',
  'thisvid.com', 'porn7.xxx', 'pornhat.com', 'pornky.com',
  'reddit.com/r/gonewild', 'reddit.com/r/nsfw',
];

export const ADULT_KEYWORDS = [
  // ── English umum ──
  'porn', 'porno', 'pornhub', 'xxx', 'xnxx', 'xvideos', 'xhamster',
  'redtube', 'youporn', 'tube8', 'spankbang', 'brazzers', 'onlyfans',
  'sex', 'sexy', 'sextape', 'sexcam', 'sexvid', 'sexvideo',
  'nude', 'nudes', 'naked', 'nsfw', 'milf', 'gilf', 'dilf',
  'hentai', 'doujin', 'rule34', 'ecchi', 'lewd',
  'camgirl', 'webcam-girl', 'chaturbate', 'stripchat', 'bongacams',
  'fansly', 'manyvids', 'clips4sale', 'fancentro',
  'erotic', 'erotica', 'fetish', 'bdsm', 'kink', 'kinky',
  'creampie', 'gangbang', 'threesome', 'orgy', 'hardcore', 'softcore',
  'masturbation', 'handjob', 'blowjob', 'deepthroat', 'anal',
  'cumshot', 'facial', 'bukkake', 'jav', 'jav-hd', 'javhd',

  // ── Indonesian / bahasa gaul ──
  'bokep', 'bokepindo', 'bokep-indo', 'bokephd', 'bokep-hd',
  'bokepjepang', 'bokep-jepang', 'bokepbarat', 'bokep-barat',
  'bokepasia', 'bokep-asia', 'bokepterbaru', 'bokepviral',
  'simontok', 'simontox',
  'cerita-dewasa', 'ceritadewasa', 'cerita-seks', 'ceritaseks',
  'ceritapanas', 'cerita-panas', 'cerpen-dewasa',
  'ngentot', 'ngewe', 'memek', 'kontol', 'tetek', 'toket',
  'tante-girang', 'tantegirang', 'janda-genit', 'abg-bispak',
  'foto-bugil', 'fotobugil', 'video-mesum', 'videomesum',
  'film-dewasa', 'filmdewasa', 'film-bokep', 'filmbokep',
];

// Domains that indicate AI tool usage (for proctoring)
export const AI_TOOL_DOMAINS = [
  'chat.openai.com', 'chatgpt.com', 'gemini.google.com',
  'claude.ai', 'perplexity.ai', 'bard.google.com',
  'copilot.microsoft.com', 'you.com', 'poe.com',
  'character.ai', 'phind.com', 'deepseek.com', 'mistral.ai',
  'kagi.com', 'huggingface.co'
];

export const CONFIG = {
  HISTORY_DAYS: 30,
  MAX_HISTORY_ITEMS: 10000,
  CONSENT_EXPIRY_HOURS: 24,
  LATE_NIGHT_START: 22,   // 10 PM
  LATE_NIGHT_END: 6,      // 6 AM
  MIN_HISTORY_THRESHOLD: 50, // Below this = suspicious (cleared history)
  EXTENSION_VERSION: '1.2.0',

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
