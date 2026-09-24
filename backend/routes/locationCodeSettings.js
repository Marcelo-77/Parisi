const express = require('express');
const locationCodeSettingsService = require('../services/locationCodeSettingsService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await locationCodeSettingsService.getSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Location code settings load error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unable to load location code settings'
    });
  }
});

router.put('/', async (req, res) => {
  try {
    const data = await locationCodeSettingsService.saveSettings(req.body || {});
    res.json({
      success: true,
      message: 'Location code settings saved successfully.',
      data
    });
  } catch (error) {
    console.error('Location code settings save error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Unable to save location code settings'
    });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const settings = await locationCodeSettingsService.getSettings();
    const merged = { ...settings, ...(req.body?.settings || {}) };
    const code = locationCodeSettingsService.composeBayLevelPositionCode(
      req.body?.parts || {},
      merged
    );
    res.json({ success: true, data: { code, settings: merged } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Unable to preview location code'
    });
  }
});

module.exports = router;
