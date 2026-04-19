/**
 * FRAUDGUARD EXTENSION FUNCTIONS
 * Backend for Chrome Extension: Gambling Screening + Interview Proctoring
 * 
 * Functions:
 *   - getExtensionToken     → HR generates a token for a candidate
 *   - getExtensionConfig    → Extension validates token & gets config
 *   - submitGamblingAnalysis→ Extension submits encrypted gambling report
 *   - submitProctoringEvent → Extension submits proctoring events
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const logger = require("firebase-functions/logger");

const db = getFirestore();

// ── Gambling domains served to extension (kept in sync with extension constants) ──
const GAMBLING_DOMAINS = [
  'pokerstars.com', 'betfair.com', 'bet365.com', 'betking.com',
  '188bet.com', 'dafabet.com', 'sbobet.com', 'maxbet.com',
  'royalvegascasino.com', 'casinoeuropa.com', 'onlinepoker.com',
  'unibet.com', 'williamhill.com', 'paddypower.com',
  'ladbrokes.com', '22bet.com', '1xbet.com', 'bwin.com',
  'betway.com', 'draftkings.com', 'fanduel.com',
  '888casino.com', '888poker.com', 'casumo.com', 'leovegas.com',
  // Indonesia
  'togelsingapore.com', 'togelhongkong.com', 'togelsydney.com',
  'datasydney.com', 'datahongkong.com', 'paito.net',
  'pragmaticplay.com', 'slot88.com', 'joker123.com',
  'habanero.com', 'pgsoft.com', 'spadegaming.com',
  'sbobet88.com', 'nova88.com', 'cmd368.com', 'ibcbet.com',
  'idn-poker.com', 'idnplay.com', 'w88.com', 'fun88.com', 'm88.com',
  'mpo.com', 'dewabet.com'
];

const GAMBLING_KEYWORDS = [
  'poker', 'casino', 'gamble', 'gambling', 'bet', 'betting',
  'slots', 'roulette', 'blackjack', 'baccarat', 'lottery',
  'sportsbet', 'jackpot', 'wager',
  'judi', 'togel', 'slot', 'bandar', 'agen judi',
  'situs judi', 'gacor', 'maxwin', 'rtp slot',
  'prediksi togel', 'parlay', 'mix parlay', 'slot online'
];

// ============================================================
// 1. GET EXTENSION TOKEN
//    Called by HR from FraudGuard dashboard
// ============================================================

const getExtensionToken = onCall({
  region: "europe-west1",
  cors: true
}, async (request) => {
  // Must be authenticated (HR user)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { sessionId, candidateEmail, type } = request.data;

  if (!sessionId || !candidateEmail) {
    throw new HttpsError('invalid-argument', 'sessionId and candidateEmail are required');
  }

  const tokenType = type || 'gambling_check';

  try {
    logger.info(`[EXT-TOKEN] Generating token for session: ${sessionId}, type: ${tokenType}`);

    // Verify session exists and belongs to user's company
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();

    const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      throw new HttpsError('not-found', 'Session not found');
    }
    const sessionData = sessionDoc.data();

    if (sessionData.companyId !== userData.companyId) {
      throw new HttpsError('permission-denied', 'Session does not belong to your company');
    }

    // Check credit balance
    const companyDoc = await db.collection('companies').doc(userData.companyId).get();
    const company = companyDoc.data();
    const creditCost = tokenType === 'gambling_check' ? 50 : 10;

    if ((company.credits || 0) < creditCost) {
      throw new HttpsError('failed-precondition', `Insufficient credits. Need ${creditCost}, have ${company.credits || 0}`);
    }

    // Deduct credits
    await db.collection('companies').doc(userData.companyId).update({
      credits: FieldValue.increment(-creditCost)
    });

    // Log credit transaction
    await db.collection('credit_transactions').add({
      companyId: userData.companyId,
      type: 'debit',
      amount: creditCost,
      action: tokenType === 'gambling_check' ? 'GAMBLING_SCREENING' : 'PROCTORED_ASSESSMENT',
      description: `${tokenType === 'gambling_check' ? 'Gambling screening' : 'Proctored assessment'} for ${candidateEmail}`,
      balanceBefore: company.credits,
      balanceAfter: (company.credits || 0) - creditCost,
      timestamp: new Date().toISOString(),
      metadata: {
        candidateId: sessionId,
        candidateName: sessionData.candidate?.name || '',
        sessionId: sessionId
      }
    });

    // Generate token
    const extensionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Save token
    await db.collection('extension_tokens').doc(extensionToken).set({
      sessionId,
      companyId: userData.companyId,
      candidateEmail,
      type: tokenType,
      status: 'pending',
      consentGiven: false,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy: request.auth.uid
    });

    // Update session with pending gambling/proctoring status
    const updateField = tokenType === 'gambling_check'
      ? { 'gamblingAnalysis.status': 'pending' }
      : { 'proctoringData.status': 'monitoring' };

    await db.collection('interview_sessions').doc(sessionId).update(updateField);

    logger.info(`[EXT-TOKEN] ✅ Token generated: ${extensionToken.substring(0, 8)}...`);

    return {
      success: true,
      token: extensionToken,
      expiresAt: expiresAt.toISOString(),
      creditCost
    };

  } catch (error) {
    logger.error('[EXT-TOKEN] Error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Failed to generate token: ${error.message}`);
  }
});

// ============================================================
// 2. GET EXTENSION CONFIG
//    Called by Chrome Extension to validate token & get config
//    No auth required (candidate doesn't have FraudGuard account)
// ============================================================

const getExtensionConfig = onCall({
  region: "europe-west1",
  cors: true
}, async (request) => {
  const { extensionToken } = request.data;

  if (!extensionToken) {
    throw new HttpsError('invalid-argument', 'extensionToken is required');
  }

  try {
    const tokenDoc = await db.collection('extension_tokens').doc(extensionToken).get();

    if (!tokenDoc.exists) {
      return { valid: false, message: 'Token not found' };
    }

    const tokenData = tokenDoc.data();

    // Check expiry
    if (new Date(tokenData.expiresAt) < new Date()) {
      await tokenDoc.ref.update({ status: 'expired' });
      return { valid: false, message: 'Token has expired' };
    }

    // Check if already completed
    if (tokenData.status === 'completed') {
      return { valid: false, message: 'Token has already been used' };
    }

    // Mark as active
    await tokenDoc.ref.update({
      status: 'active',
      activatedAt: new Date().toISOString()
    });

    logger.info(`[EXT-CONFIG] Token validated: ${extensionToken.substring(0, 8)}..., type: ${tokenData.type}`);

    return {
      valid: true,
      sessionId: tokenData.sessionId,
      type: tokenData.type,
      config: {
        domains: GAMBLING_DOMAINS,
        keywords: GAMBLING_KEYWORDS,
        historyDays: 30,
        maxItems: 5000,
        lateNightStart: 22,
        lateNightEnd: 6
      }
    };

  } catch (error) {
    logger.error('[EXT-CONFIG] Error:', error);
    throw new HttpsError('internal', `Failed to validate token: ${error.message}`);
  }
});

// ============================================================
// 3. SUBMIT GAMBLING ANALYSIS
//    Called by Chrome Extension after analysis is complete
// ============================================================

const submitGamblingAnalysis = onCall({
  region: "europe-west1",
  cors: true
}, async (request) => {
  const { encryptedData, signature, extensionToken, summary } = request.data;

  if (!extensionToken || !summary) {
    throw new HttpsError('invalid-argument', 'extensionToken and summary are required');
  }

  try {
    // Validate token
    const tokenDoc = await db.collection('extension_tokens').doc(extensionToken).get();
    if (!tokenDoc.exists) {
      throw new HttpsError('not-found', 'Token not found');
    }

    const tokenData = tokenDoc.data();

    if (tokenData.status === 'completed') {
      throw new HttpsError('already-exists', 'Analysis already submitted for this token');
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      throw new HttpsError('deadline-exceeded', 'Token has expired');
    }

    logger.info(`[EXT-SUBMIT] Receiving gambling analysis for session: ${tokenData.sessionId}`);

    // Generate report ID
    const reportId = crypto.randomUUID();

    // Save analysis to interview session
    const gamblingAnalysis = {
      status: 'completed',
      overallRisk: summary.overallRisk || 'LOW',
      riskScore: summary.riskScore || 0,
      totalHistoryAnalyzed: summary.totalHistoryAnalyzed || 0,
      flaggedSitesCount: summary.flaggedSitesCount || 0,
      historyTooLow: summary.historyTooLow || false,
      consentToken: extensionToken,
      reportId,
      completedAt: new Date().toISOString(),
      // Store encrypted data for audit (can be decrypted later if needed)
      encryptedReport: encryptedData || null,
      reportSignature: signature || null
    };

    await db.collection('interview_sessions').doc(tokenData.sessionId).update({
      gamblingAnalysis
    });

    // Mark token as completed
    await tokenDoc.ref.update({
      status: 'completed',
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
      usedAt: new Date().toISOString()
    });

    // Create notification for HR
    await db.collection('notifications').add({
      companyId: tokenData.companyId,
      type: 'gambling_screening_completed',
      title: 'Gambling Screening Complete',
      message: `Gambling screening completed — ${getRiskEmoji(summary.overallRisk)} ${summary.overallRisk} Risk (Score: ${summary.riskScore}/100)`,
      icon: '🎰',
      link: `/candidates/${tokenData.sessionId}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      metadata: {
        sessionId: tokenData.sessionId,
        riskLevel: summary.overallRisk,
        riskScore: summary.riskScore,
        reportId
      }
    });

    logger.info(`[EXT-SUBMIT] ✅ Gambling analysis saved. Risk: ${summary.overallRisk}, Score: ${summary.riskScore}`);

    return {
      success: true,
      reportId,
      riskLevel: summary.overallRisk
    };

  } catch (error) {
    logger.error('[EXT-SUBMIT] Error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Failed to submit analysis: ${error.message}`);
  }
});

// ============================================================
// 4. SUBMIT PROCTORING EVENT
//    Called by Chrome Extension after interview/assessment ends
// ============================================================

const submitProctoringEvent = onCall({
  region: "europe-west1",
  cors: true
}, async (request) => {
  const { extensionToken, sessionId, events, totalEvents, tabSwitchCount, windowBlurCount, suspiciousActivityScore, sessionDuration, startedAt, completedAt } = request.data;

  if (!extensionToken) {
    throw new HttpsError('invalid-argument', 'extensionToken is required');
  }

  try {
    // Validate token
    const tokenDoc = await db.collection('extension_tokens').doc(extensionToken).get();
    if (!tokenDoc.exists) {
      throw new HttpsError('not-found', 'Token not found');
    }

    const tokenData = tokenDoc.data();
    const targetSessionId = sessionId || tokenData.sessionId;

    logger.info(`[EXT-PROCTOR] Receiving proctoring data for session: ${targetSessionId}, events: ${totalEvents}`);

    // Determine status based on score
    let proctoringStatus = 'completed';
    if (suspiciousActivityScore > 50) {
      proctoringStatus = 'flagged';
    }

    // Save proctoring data to interview session
    const proctoringData = {
      status: proctoringStatus,
      totalEvents: totalEvents || 0,
      alerts: (events || []).map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        details: e.details || '',
        severity: e.severity || 'info'
      })),
      tabSwitchCount: tabSwitchCount || 0,
      windowBlurCount: windowBlurCount || 0,
      suspiciousActivityScore: suspiciousActivityScore || 0,
      sessionDuration: sessionDuration || 0,
      startedAt: startedAt || new Date().toISOString(),
      completedAt: completedAt || new Date().toISOString()
    };

    await db.collection('interview_sessions').doc(targetSessionId).update({
      proctoringData
    });

    // Mark token as completed
    await tokenDoc.ref.update({
      status: 'completed',
      usedAt: new Date().toISOString()
    });

    // If flagged, create notification
    if (proctoringStatus === 'flagged') {
      await db.collection('notifications').add({
        companyId: tokenData.companyId,
        type: 'proctoring_flagged',
        title: '⚠️ Proctoring Alert',
        message: `Suspicious activity detected during assessment (Score: ${suspiciousActivityScore}/100)`,
        icon: '👁️',
        link: `/candidates/${targetSessionId}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        metadata: {
          sessionId: targetSessionId,
          suspiciousActivityScore,
          totalEvents
        }
      });
    }

    logger.info(`[EXT-PROCTOR] ✅ Proctoring data saved. Status: ${proctoringStatus}, Score: ${suspiciousActivityScore}`);

    return {
      success: true,
      score: suspiciousActivityScore,
      status: proctoringStatus
    };

  } catch (error) {
    logger.error('[EXT-PROCTOR] Error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Failed to submit proctoring data: ${error.message}`);
  }
});

// ── Helper ──
function getRiskEmoji(level) {
  return { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' }[level] || '⚪';
}

module.exports = {
  getExtensionToken,
  getExtensionConfig,
  submitGamblingAnalysis,
  submitProctoringEvent
};
