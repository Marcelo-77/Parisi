const crypto = require('crypto');

const AUTH_SECRET = process.env.AUTH_SECRET || 'double-y-auth-secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'yahusha';
const SESSION_COOKIE = 'doubley_session';

function signToken() {
  const payload = 'authenticated';
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return false;

  const [payload, sig] = token.split('.');
  if (payload !== 'authenticated' || !sig) return false;

  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function setSessionCookie(res) {
  const token = signToken();
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

function isPublicAsset(path) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|txt|map|min\.js)$/i.test(path);
}

function protectPages(req, res, next) {
  if (req.method !== 'GET') return next();

  const path = req.path;

  if (isPublicAsset(path) || path === '/login.html' || path === '/health') {
    return next();
  }

  if (path === '/' || path.endsWith('.html')) {
    if (!isAuthenticated(req)) {
      return res.redirect('/login.html');
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
  SESSION_COOKIE,
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  protectPages,
  requireAuth,
};
