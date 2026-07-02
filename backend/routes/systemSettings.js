const express = require('express');
const systemSettingsService = require('../services/systemSettingsService');

const router = express.Router();

router.put('/', async (req, res) => {
  try {
    const data = await systemSettingsService.updateSettings(req.body || {});
    res.json({ success: true, data, message: 'System settings saved.' });
  } catch (error) {
    console.error('System settings update error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving system settings'
    });
  }
});

module.exports = router;
