const crypto = require('crypto');

const MAX_FAILED_ATTEMPTS = 7;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 minutes

const failedAttempts = new Map(); // key -> { count, firstAt, lastAt }
const captchaChallenges = new Map(); // id -> { answer, expiresAt }

function normalizeEmail(email) {
  return email != null ? String(email).trim().toLowerCase() : '';
}

function attemptKey(ip, email) {
  return `${ip || 'unknown'}|${normalizeEmail(email) || 'unknown'}`;
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of failedAttempts.entries()) {
    if (!entry || now - entry.firstAt > ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
  for (const [id, challenge] of captchaChallenges.entries()) {
    if (!challenge || challenge.expiresAt <= now) {
      captchaChallenges.delete(id);
    }
  }
}

function getAttemptRecord(ip, email) {
  pruneExpired();
  const key = attemptKey(ip, email);
  const entry = failedAttempts.get(key);
  if (!entry) return { key, count: 0 };
  if (Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(key);
    return { key, count: 0 };
  }
  return { key, count: entry.count || 0 };
}

function isCaptchaRequired(ip, email) {
  return getAttemptRecord(ip, email).count >= MAX_FAILED_ATTEMPTS;
}

function registerFailedAttempt(ip, email) {
  pruneExpired();
  const key = attemptKey(ip, email);
  const now = Date.now();
  const existing = failedAttempts.get(key);
  if (!existing || now - existing.firstAt > ATTEMPT_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstAt: now, lastAt: now });
    return { count: 1, captchaRequired: false };
  }
  existing.count += 1;
  existing.lastAt = now;
  failedAttempts.set(key, existing);
  return {
    count: existing.count,
    captchaRequired: existing.count >= MAX_FAILED_ATTEMPTS
  };
}

function clearFailedAttempts(ip, email) {
  failedAttempts.delete(attemptKey(ip, email));
}

function createCaptchaChallenge() {
  pruneExpired();
  const a = crypto.randomInt(1, 10);
  const b = crypto.randomInt(1, 10);
  const id = crypto.randomBytes(16).toString('hex');
  captchaChallenges.set(id, {
    answer: String(a + b),
    expiresAt: Date.now() + CAPTCHA_TTL_MS
  });
  return {
    captchaId: id,
    question: `What is ${a} + ${b}?`,
    expiresInSeconds: Math.floor(CAPTCHA_TTL_MS / 1000)
  };
}

function consumeCaptcha(captchaId, captchaAnswer) {
  pruneExpired();
  const id = captchaId != null ? String(captchaId).trim() : '';
  const answer = captchaAnswer != null ? String(captchaAnswer).trim() : '';
  if (!id || !answer) {
    return { ok: false, reason: 'missing' };
  }

  const challenge = captchaChallenges.get(id);
  captchaChallenges.delete(id);
  if (!challenge) {
    return { ok: false, reason: 'expired' };
  }
  if (Date.now() > challenge.expiresAt) {
    return { ok: false, reason: 'expired' };
  }
  if (challenge.answer !== answer) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true };
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  isCaptchaRequired,
  registerFailedAttempt,
  clearFailedAttempts,
  createCaptchaChallenge,
  consumeCaptcha,
  getAttemptRecord
};
