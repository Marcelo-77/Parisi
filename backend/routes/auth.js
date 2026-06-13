const express = require('express');
const {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
} = require('../middleware/auth');

const router = express.Router();

router.get('/check', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

router.post('/login', (req, res) => {
  const { password } = req.body || {};

  if (!verifyPassword(password)) {
    return res.status(401).json({
      error: 'Invalid password',
      message: 'Incorrect password. Please try again.',
    });
  }

  setSessionCookie(res);
  return res.json({ success: true, message: 'Login successful' });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
