const express = require('express');
const userSessionService = require('../services/userSessionService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sessions = await userSessionService.listActiveSessions();
    return res.json({
      success: true,
      staleMinutes: userSessionService.STALE_MINUTES,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    console.error('Logged-in users error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error loading logged-in users'
    });
  }
});

module.exports = router;
