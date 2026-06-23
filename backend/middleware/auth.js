const crypto = require('crypto');

const AUTH_SECRET = process.env.AUTH_SECRET || 'double-y-auth-secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'yahusha';
const ROOT_USER = 'root';
const UNIVERSAL_APPLICATIONS = ['change-password.html'];
const SESSION_COOKIE = 'doubley_session';

function signToken(userId) {
  const payload = userId ? String(userId) : 'authenticated';
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;

  const [payload, sig] = token.split('.');
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
  const payload = getSessionPayload(req);
  if (!payload || payload === 'authenticated' || payload === ROOT_USER) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload)
    ? payload
    : null;
}

function isRootSession(req) {
  return getSessionPayload(req) === ROOT_USER;
}

function verifyRootLogin(email, password) {
  const normalizedEmail = email != null ? String(email).trim().toLowerCase() : '';
  if (normalizedEmail !== ROOT_USER) return false;
  return verifyPassword(password);
}

function setSessionCookie(res, userId) {
  const token = signToken(userId);
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
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|txt|map|min\.js)$/i.test(path);
}

function getPageApplicationName(path) {
  if (path === '/') return 'warehouse.html';
  const fileName = path.replace(/^\//, '').split('?')[0].split('#')[0];
  return fileName.endsWith('.html') ? fileName : null;
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

    if (isRootSession(req)) {
      return next();
    }

    const pageApp = getPageApplicationName(path);
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
  isRootSession,
  protectPages,
  requireAuth,
};
