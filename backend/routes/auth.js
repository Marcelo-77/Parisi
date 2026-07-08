const express = require('express');
const crypto = require('crypto');
const {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getSessionUserId,
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

const router = express.Router();

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
  } catch {
    clearSessionCookie(res);
    return res.json({ authenticated: false });
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
      return res.json({
        success: true,
        isRoot: true,
        user,
        applications: allApps.map((app) => app.syapNmApplication).filter(Boolean)
      });
    }

    const userId = getSessionUserId(req);
    if (!userId) {
      return res.json({ success: true, isRoot: false, user: null, applications: [] });
    }

    const apps = await userApplicationService.listAccessibleApplications(userId);
    const applicationNames = apps.map((app) => app.syapNmApplication).filter(Boolean);
    UNIVERSAL_APPLICATIONS.forEach((app) => {
      if (!applicationNames.includes(app)) applicationNames.push(app);
    });

    const user = await getSessionUserProfile(req);

    return res.json({
      success: true,
      isRoot: false,
      user,
      applications: applicationNames
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Invalid credentials',
      message: 'Email and password are required.',
    });
  }

  try {
    if (verifyRootLogin(email, password)) {
      const user = {
        id: ROOT_USER,
        nome: 'Root',
        email: ROOT_USER,
        cargo: 'System Administrator',
        isRoot: true,
        companyName: 'All Companies'
      };
      await startUserSession(req, res, user);
      return res.json({
        success: true,
        message: 'Login successful',
        user
      });
    }

    const user = await funcionarioServiceDB.autenticar(email, password);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password. Please try again.',
      });
    }

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
      photo: profile.photo || null
    };
    await startUserSession(req, res, sessionUser);
    return res.json({
      success: true,
      message: 'Login successful',
      user: sessionUser
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
