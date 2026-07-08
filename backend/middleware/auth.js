const crypto = require('crypto');

const AUTH_SECRET = process.env.AUTH_SECRET || 'double-y-auth-secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'yahusha';
const ROOT_USER = 'root';
const UNIVERSAL_APPLICATIONS = ['change-password.html'];
const SESSION_COOKIE = 'doubley_session';
const SESSION_PAYLOAD_SEPARATOR = ':';

function signToken(payload) {
  const signedPayload = payload ? String(payload) : 'authenticated';
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(signedPayload).digest('hex');
  return `${signedPayload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;

  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return null;

  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }

  return payload;
}

function parseSessionPayload(payload) {
  if (!payload || payload === 'authenticated') {
    return { sessionId: null, userKey: null };
  }

  const separatorIndex = payload.indexOf(SESSION_PAYLOAD_SEPARATOR);
  if (separatorIndex > 0) {
    return {
      sessionId: payload.slice(0, separatorIndex),
      userKey: payload.slice(separatorIndex + 1) || null
    };
  }

  return { sessionId: null, userKey: payload };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getSessionPayload(req) {
  return verifyToken(parseCookies(req)[SESSION_COOKIE]);
}

function isAuthenticated(req) {
  return Boolean(getSessionPayload(req));
}

function getSessionUserId(req) {
  const userKey = getSessionUserKey(req);
  if (!userKey || userKey === ROOT_USER) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userKey)
    ? userKey
    : null;
}

function getSessionUserKey(req) {
  const payload = getSessionPayload(req);
  const { userKey } = parseSessionPayload(payload);
  if (!userKey || userKey === 'authenticated') return null;
  return userKey;
}

function getSessionId(req) {
  const payload = getSessionPayload(req);
  const { sessionId } = parseSessionPayload(payload);
  return sessionId;
}

function isRootSession(req) {
  return getSessionUserKey(req) === ROOT_USER;
}

function verifyRootLogin(email, password) {
  const normalizedEmail = email != null ? String(email).trim().toLowerCase() : '';
  if (normalizedEmail !== ROOT_USER) return false;
  return verifyPassword(password);
}

function buildSessionToken(sessionId, userKey) {
  return signToken(`${sessionId}${SESSION_PAYLOAD_SEPARATOR}${userKey}`);
}

function setSessionCookie(res, sessionId, userKey) {
  const token = buildSessionToken(sessionId, userKey);
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function verifyPassword(password) {
  if (!password || typeof password !== 'string') return false;
  const expected = Buffer.from(APP_PASSWORD);
  const provided = Buffer.from(password);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function verifyStoredPassword(storedPassword, providedPassword) {
  if (!storedPassword || !providedPassword) return false;
  if (typeof storedPassword !== 'string' || typeof providedPassword !== 'string') return false;

  const expected = Buffer.from(storedPassword);
  const provided = Buffer.from(providedPassword);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function isPublicAsset(path) {
  return /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|txt|map|min\.js|pdf)$/i.test(path);
}

function getPageApplicationName(path) {
  if (path === '/') return 'warehouse.html';
  const fileName = path.replace(/^\//, '').split('?')[0].split('#')[0];
  return fileName.endsWith('.html') ? fileName : null;
}

async function touchSessionFromRequest(req, currentApp) {
  const sessionId = getSessionId(req);
  if (!sessionId) return;

  try {
    const userSessionService = require('../services/userSessionService');
    await userSessionService.touchSession(sessionId, {
      currentApp: currentApp || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null
    });
  } catch (error) {
    console.error('Session touch error:', error.message);
  }
}

async function protectPages(req, res, next) {
  if (req.method !== 'GET') return next();

  const path = req.path;

  if (isPublicAsset(path) || path === '/login.html' || path === '/health') {
    return next();
  }

  if (path === '/' || path.endsWith('.html')) {
    if (!isAuthenticated(req)) {
      return res.redirect('/login.html');
    }

    const pageApp = getPageApplicationName(path);
    touchSessionFromRequest(req, pageApp);

    if (isRootSession(req)) {
      return next();
    }

    if (!pageApp) {
      return next();
    }

    const userId = getSessionUserId(req);
    if (!userId) {
      return next();
    }

    try {
      const userApplicationService = require('../services/userApplicationService');

      if (UNIVERSAL_APPLICATIONS.includes(pageApp)) {
        return next();
      }

      const allowed = await userApplicationService.hasApplicationAccess(userId, pageApp, false);

      if (allowed) {
        return next();
      }

      const accessibleApps = await userApplicationService.listAccessibleApplications(userId);
      const firstApp = accessibleApps[0] && accessibleApps[0].syapNmApplication;
      if (firstApp) {
        return res.redirect(`/${firstApp}`);
      }

      clearSessionCookie(res);
      return res.redirect('/login.html');
    } catch (error) {
      console.error('Error checking page access:', error);
      return next(error);
    }
  }

  return next();
}

function requireAuth(req, res, next) {
  if (req.path.startsWith('/auth')) return next();

  if (!isAuthenticated(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Login required',
    });
  }

  return next();
}

module.exports = {
  APP_PASSWORD,
  ROOT_USER,
  UNIVERSAL_APPLICATIONS,
  SESSION_COOKIE,
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  verifyStoredPassword,
  verifyRootLogin,
  getSessionUserId,
  getSessionUserKey,
  getSessionId,
  getClientIp,
  isRootSession,
  protectPages,
  requireAuth,
};
