const express = require('express');
const crypto = require('crypto');
const {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getSessionUserId,
  getSessionUserKey,
  getSessionId,
  getClientIp,
  isRootSession,
  verifyRootLogin,
  ROOT_USER,
  UNIVERSAL_APPLICATIONS,
} = require('../middleware/auth');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const userApplicationService = require('../services/userApplicationService');
const systemApplicationService = require('../services/systemApplicationService');
const userSessionService = require('../services/userSessionService');
const loginProtectionService = require('../services/loginProtectionService');
const mailService = require('../services/mailService');
const userUiPreferencesService = require('../services/userUiPreferencesService');

const router = express.Router();

const GENERIC_FORGOT_MESSAGE =
  'If this email is registered, a new password has been sent. Please check your inbox.';

function getForgotPasswordEnvironmentLabel() {
  const env = String(process.env.APP_ENV || process.env.RENDER_SERVICE_NAME || 'production')
    .trim()
    .toLowerCase();
  if (!env || env === 'production' || env === 'prod' || env === 'live') return '';
  if (env.includes('approval')) return 'Approval';
  if (env.includes('homolog')) return 'Homolog';
  if (env.includes('dev')) return 'Development';
  return env.charAt(0).toUpperCase() + env.slice(1);
}

function createTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

async function startUserSession(req, res, user) {
  const sessionId = crypto.randomUUID();
  const userKey = user.isRoot ? ROOT_USER : user.id;
  const currentApp = 'login.html';

  await userSessionService.createSession({
    id: sessionId,
    userKey,
    userName: user.nome,
    userEmail: user.email,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    currentApp
  });

  setSessionCookie(res, sessionId, userKey);
}

async function getSessionUserProfile(req) {
  if (isRootSession(req)) {
    return {
      id: ROOT_USER,
      nome: 'Root',
      email: ROOT_USER,
      cargo: 'System Administrator',
      isRoot: true,
      companyName: 'All Companies'
    };
  }

  const userId = getSessionUserId(req);
  if (!userId) return null;

  const funcionario = await funcionarioServiceDB.buscarPorId(userId);
  const profile = typeof funcionario.toJSON === 'function' ? funcionario.toJSON() : funcionario;
  return {
    id: profile.id,
    nome: profile.nome,
    email: profile.email,
    cargo: profile.cargo || null,
    isRoot: false,
    sector: profile.sector || null,
    companyId: profile.companyId || null,
    companyName: profile.companyName || null,
    companyLogo: profile.companyLogo || null,
    photo: profile.photo || null
  };
}

router.get('/check', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await getSessionUserProfile(req);
    if (!user) {
      return res.json({ authenticated: true });
    }

    return res.json({
      authenticated: true,
      user
    });
  } catch (error) {
    // Keep the session on transient DB/profile errors (e.g. during heavy migrations).
    // Clearing the cookie here caused false logouts while background work continued.
    console.error('Auth check profile error:', error.message || error);
    return res.json({
      authenticated: true,
      profileUnavailable: true
    });
  }
});

async function getScreenDisplayForRequest(req) {
  const ownerKey = getSessionUserKey(req);
  if (!ownerKey) return { ...userUiPreferencesService.DEFAULTS, saved: false };
  try {
    return await userUiPreferencesService.getForOwner(ownerKey);
  } catch (error) {
    console.warn('Screen display prefs:', error.message);
    return { ...userUiPreferencesService.DEFAULTS, saved: false };
  }
}

router.get('/screen-display', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Login required' });
  }
  const screenDisplay = await getScreenDisplayForRequest(req);
  return res.json({ success: true, screenDisplay });
});

router.put('/screen-display', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Login required' });
  }
  const ownerKey = getSessionUserKey(req);
  if (!ownerKey) {
    return res.status(400).json({ success: false, error: 'No session owner' });
  }
  try {
    const body = req.body || {};
    const screenDisplay = await userUiPreferencesService.upsertForOwner(ownerKey, {
      mode: body.mode,
      color: body.color,
      tone: body.tone,
      layoutNoticeSeen: body.layoutNoticeSeen
    });
    return res.json({ success: true, screenDisplay });
  } catch (error) {
    console.error('Save screen display error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error saving screen display',
      message: error.message
    });
  }
});

router.get('/menu-access', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Login required'
    });
  }

  try {
    if (isRootSession(req)) {
      const allApps = await systemApplicationService.list({});
      const user = await getSessionUserProfile(req);
      const screenDisplay = await getScreenDisplayForRequest(req);
      return res.json({
        success: true,
        isRoot: true,
        user,
        applications: allApps.map((app) => app.syapNmApplication).filter(Boolean),
        accessByApplication: {},
        screenDisplay
      });
    }

    const userId = getSessionUserId(req);
    if (!userId) {
      return res.json({
        success: true,
        isRoot: false,
        user: null,
        applications: [],
        accessByApplication: {},
        screenDisplay: { ...userUiPreferencesService.DEFAULTS, saved: false }
      });
    }

    const apps = await userApplicationService.listAccessibleApplications(userId);
    const applicationNames = apps.map((app) => app.syapNmApplication).filter(Boolean);
    UNIVERSAL_APPLICATIONS.forEach((app) => {
      if (!applicationNames.includes(app)) applicationNames.push(app);
    });

    const user = await getSessionUserProfile(req);
    const accessByApplication = userApplicationService.buildAccessByApplication(apps, false);
    const screenDisplay = await getScreenDisplayForRequest(req);

    return res.json({
      success: true,
      isRoot: false,
      user,
      applications: applicationNames,
      accessByApplication,
      screenDisplay
    });
  } catch (error) {
    console.error('Menu access error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error loading menu access',
      message: error.message
    });
  }
});

router.get('/captcha', (req, res) => {
  const challenge = loginProtectionService.createCaptchaChallenge();
  return res.json({
    success: true,
    ...challenge
  });
});

router.post('/login', async (req, res) => {
  const { email, password, captchaId, captchaAnswer } = req.body || {};
  const clientIp = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({
      error: 'Invalid credentials',
      message: 'Email and password are required.',
    });
  }

  const captchaRequired = loginProtectionService.isCaptchaRequired(clientIp, email);
  if (captchaRequired) {
    const captchaResult = loginProtectionService.consumeCaptcha(captchaId, captchaAnswer);
    if (!captchaResult.ok) {
      const challenge = loginProtectionService.createCaptchaChallenge();
      const message = captchaResult.reason === 'missing'
        ? 'Please complete the verification to confirm you are not a robot.'
        : captchaResult.reason === 'expired'
          ? 'Verification expired. Please solve the new challenge.'
          : 'Incorrect verification answer. Please try again.';
      return res.status(429).json({
        success: false,
        error: 'Captcha required',
        message,
        captchaRequired: true,
        failedAttempts: loginProtectionService.getAttemptRecord(clientIp, email).count,
        maxFailedAttempts: loginProtectionService.MAX_FAILED_ATTEMPTS,
        captcha: challenge
      });
    }
  }

  try {
    if (verifyRootLogin(email, password)) {
      loginProtectionService.clearFailedAttempts(clientIp, email);
      const user = {
        id: ROOT_USER,
        nome: 'Root',
        email: ROOT_USER,
        cargo: 'System Administrator',
        isRoot: true,
        companyName: 'All Companies'
      };
      await startUserSession(req, res, user);
      // Cookie is only on the response — do not read prefs from the old request session.
      const screenDisplay = await userUiPreferencesService.getForOwner(ROOT_USER);
      return res.json({
        success: true,
        message: 'Login successful',
        user,
        screenDisplay
      });
    }

    const user = await funcionarioServiceDB.autenticar(email, password);

    if (!user) {
      const attempt = loginProtectionService.registerFailedAttempt(clientIp, email);
      const payload = {
        error: 'Invalid credentials',
        message: attempt.captchaRequired
          ? 'Too many failed attempts. Please confirm you are not a robot.'
          : 'Invalid email or password. Please try again.',
        failedAttempts: attempt.count,
        maxFailedAttempts: loginProtectionService.MAX_FAILED_ATTEMPTS,
        captchaRequired: attempt.captchaRequired
      };
      if (attempt.captchaRequired) {
        payload.captcha = loginProtectionService.createCaptchaChallenge();
      }
      return res.status(401).json(payload);
    }

    loginProtectionService.clearFailedAttempts(clientIp, email);
    const fullUser = await funcionarioServiceDB.buscarPorId(user.id);
    const profile = typeof fullUser.toJSON === 'function' ? fullUser.toJSON() : fullUser;
    const sessionUser = {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      cargo: profile.cargo || null,
      isRoot: false,
      sector: profile.sector || null,
      companyId: profile.companyId || null,
      companyName: profile.companyName || null,
      companyLogo: profile.companyLogo || null,
      photo: profile.photo || null
    };
    await startUserSession(req, res, sessionUser);
    // Cookie is only on the response — load prefs by the user who just signed in.
    const screenDisplay = await userUiPreferencesService.getForOwner(
      String(sessionUser.id),
      [sessionUser.email]
    );
    return res.json({
      success: true,
      message: 'Login successful',
      user: sessionUser,
      screenDisplay
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      message: 'Unable to sign in. Please try again.',
    });
  }
});

router.post('/change-password', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Login required'
    });
  }

  if (isRootSession(req)) {
    return res.status(400).json({
      success: false,
      error: 'Root password cannot be changed here',
      message: 'Root password is managed by system configuration.'
    });
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid session',
      message: 'Unable to identify the logged-in user.'
    });
  }

  const { currentPassword, newPassword, confirmPassword, email } = req.body || {};

  if (!currentPassword) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data',
      message: 'Current password is required.'
    });
  }

  const wantsPasswordChange = Boolean(newPassword || confirmPassword);
  const wantsEmailChange = email !== undefined && email !== null && String(email).trim();

  if (!wantsPasswordChange && !wantsEmailChange) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data',
      message: 'Provide a new email and/or a new password to update.'
    });
  }

  if (wantsPasswordChange) {
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data',
        message: 'New password and confirmation are required when changing password.'
      });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Password mismatch',
        message: 'New password and confirmation do not match.'
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
        message: 'New password must have at least 6 characters.'
      });
    }
  }

  if (wantsEmailChange) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email',
        message: 'Email must have a valid format.'
      });
    }
  }

  try {
    let updatedUser = null;
    let emailChanged = false;
    let passwordChanged = false;

    if (wantsEmailChange) {
      const before = await funcionarioServiceDB.buscarPorId(userId);
      updatedUser = await funcionarioServiceDB.alterarEmail(userId, currentPassword, email);
      const afterEmail = updatedUser.email ? String(updatedUser.email).trim().toLowerCase() : '';
      const beforeEmail = before.email ? String(before.email).trim().toLowerCase() : '';
      emailChanged = afterEmail !== beforeEmail;
    }

    if (wantsPasswordChange) {
      await funcionarioServiceDB.alterarSenha(userId, currentPassword, newPassword);
      passwordChanged = true;
      if (!updatedUser) {
        updatedUser = await funcionarioServiceDB.buscarPorId(userId);
      }
    }

    if (!emailChanged && !passwordChanged) {
      return res.status(400).json({
        success: false,
        error: 'No changes',
        message: 'No changes were made to your account.'
      });
    }

    const profile = updatedUser && typeof updatedUser.toJSON === 'function'
      ? updatedUser.toJSON()
      : await getSessionUserProfile(req);

    const messages = [];
    if (emailChanged) messages.push('email updated');
    if (passwordChanged) messages.push('password changed');

    return res.json({
      success: true,
      message: `Account updated successfully (${messages.join(' and ')}).`,
      emailChanged,
      passwordChanged,
      user: profile
    });
  } catch (error) {
    const status = error.message === 'Current password is incorrect'
      ? 401
      : error.message.includes('already registered')
        ? 409
        : 400;
    return res.status(status).json({
      success: false,
      error: error.message || 'Error updating account',
      message: error.message || 'Unable to update account.'
    });
  }
});

router.post('/heartbeat', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Login required'
    });
  }

  const sessionId = getSessionId(req);
  if (!sessionId) {
    return res.json({ success: true, tracked: false });
  }

  const app = req.body && req.body.app ? String(req.body.app).trim() : null;

  try {
    await userSessionService.touchSession(sessionId, {
      currentApp: app,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null
    });
    return res.json({ success: true, tracked: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error updating session'
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  const emailRaw = req.body && req.body.email != null ? String(req.body.email).trim() : '';
  const email = emailRaw.toLowerCase();

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email required',
      message: 'Enter your email to recover your password.'
    });
  }

  if (email === ROOT_USER) {
    return res.status(400).json({
      success: false,
      error: 'Root password cannot be recovered here',
      message: 'Root password is managed by system configuration.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email',
      message: 'Enter a valid email address.'
    });
  }

  try {
    const user = await funcionarioServiceDB.findActiveCredentialsByEmail(email);
    if (user && user.password) {
      const passwordToSend = createTemporaryPassword();
      await funcionarioServiceDB.setPasswordById(user.id, passwordToSend);

      const displayName = user.nome || 'there';
      const envLabel = getForgotPasswordEnvironmentLabel();
      const productName = envLabel
        ? `Double-Y Warehouse (${envLabel})`
        : 'Double-Y Warehouse';
      const subject = `${productName} — your password`;
      const intro = `A new password was issued for your ${productName} account.`;
      const text = [
        `Hello ${displayName},`,
        '',
        intro,
        '',
        `Email: ${user.email}`,
        `Password: ${passwordToSend}`,
        '',
        'If you did not request this, please contact office@doubleyitsystem.com.',
        '',
        'Double-Y IT Systems'
      ].join('\n');
      const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#17243a;line-height:1.5">
          <p>Hello ${displayName},</p>
          <p>${intro}</p>
          <p><strong>Email:</strong> ${user.email}<br>
          <strong>Password:</strong> ${String(passwordToSend).replace(/</g, '&lt;')}</p>
          <p>If you did not request this, please contact
            <a href="mailto:office@doubleyitsystem.com">office@doubleyitsystem.com</a>.
          </p>
          <p>Double-Y IT Systems</p>
        </div>
      `;
      await mailService.sendMail({
        to: user.email,
        subject,
        text,
        html
      });
    }

    return res.json({
      success: true,
      message: GENERIC_FORGOT_MESSAGE
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Forgot password failed',
      message: 'Unable to send password reminder. Please try again.'
    });
  }
});

router.post('/logout', async (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    try {
      await userSessionService.endSession(sessionId);
    } catch (error) {
      console.error('Logout session error:', error);
    }
  }
  clearSessionCookie(res);
  return res.json({
    success: true,
    message: 'You have been logged out successfully.'
  });
});

module.exports = router;
