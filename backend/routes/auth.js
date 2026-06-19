const express = require('express');
const {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getSessionUserId,
} = require('../middleware/auth');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');

const router = express.Router();

router.get('/check', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.json({ authenticated: false });
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Invalid credentials',
      message: 'Email and password are required.',
    });
  }

  try {
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

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
