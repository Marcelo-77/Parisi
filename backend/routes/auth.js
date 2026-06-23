const express = require('express');
const {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getSessionUserId,
  isRootSession,
  verifyRootLogin,
  ROOT_USER,
  UNIVERSAL_APPLICATIONS,
} = require('../middleware/auth');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const userApplicationService = require('../services/userApplicationService');
const systemApplicationService = require('../services/systemApplicationService');

const router = express.Router();

router.get('/check', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.json({ authenticated: false });
  }

  if (isRootSession(req)) {
    return res.json({
      authenticated: true,
      user: {
        id: ROOT_USER,
        nome: 'Root',
        email: ROOT_USER,
        isRoot: true
      }
    });
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return res.json({ authenticated: true });
  }

  try {
    const user = await funcionarioServiceDB.buscarPorId(userId);
    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
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
      return res.json({
        success: true,
        isRoot: true,
        applications: allApps.map((app) => app.syapNmApplication).filter(Boolean)
      });
    }

    const userId = getSessionUserId(req);
    if (!userId) {
      return res.json({ success: true, isRoot: false, applications: [] });
    }

    const apps = await userApplicationService.listAccessibleApplications(userId);
    const applicationNames = apps.map((app) => app.syapNmApplication).filter(Boolean);
    UNIVERSAL_APPLICATIONS.forEach((app) => {
      if (!applicationNames.includes(app)) applicationNames.push(app);
    });

    return res.json({
      success: true,
      isRoot: false,
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
      setSessionCookie(res, ROOT_USER);
      return res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: ROOT_USER,
          nome: 'Root',
          email: ROOT_USER,
          isRoot: true
        }
      });
    }

    const user = await funcionarioServiceDB.autenticar(email, password);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password. Please try again.',
      });
    }

    setSessionCookie(res, user.id);
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
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

  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data',
      message: 'Current password, new password and confirmation are required.'
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

  try {
    await funcionarioServiceDB.alterarSenha(userId, currentPassword, newPassword);
    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    const status = error.message === 'Current password is incorrect' ? 401 : 400;
    return res.status(status).json({
      success: false,
      error: error.message || 'Error changing password',
      message: error.message || 'Unable to change password.'
    });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
