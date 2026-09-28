const express = require('express');
const locationCodeSettingsService = require('../services/locationCodeSettingsService');
const locationCodeHistoryMigrateService = require('../services/locationCodeHistoryMigrateService');

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

/** Build rename plan when switching schemes (classic ↔ Street/Building/Level). */
router.post('/migrate-plan', async (req, res) => {
  try {
    const current = await locationCodeSettingsService.getSettings();
    const fromScheme = String(req.body?.fromScheme || current.activeScheme || 'classic');
    const toScheme = String(req.body?.toScheme || current.activeScheme || 'classic');
    const settings = { ...current, ...(req.body?.settings || {}) };
    const plan = await locationCodeHistoryMigrateService.buildMigrationPlan(
      fromScheme,
      toScheme,
      settings
    );
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Location history migrate-plan error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Unable to build migration plan'
    });
  }
});

/** Apply one rename (updates warehouse_locations + location_product cascade + location_product_log). */
router.post('/migrate-apply', async (req, res) => {
  try {
    const item = req.body?.item;
    if (!item?.id || !item?.to) {
      return res.status(400).json({ success: false, error: 'item.id and item.to are required' });
    }
    const userKey = req.session?.user?.email || req.session?.user?.username || 'Setting Location migrate';
    const updated = await locationCodeHistoryMigrateService.applyMigrationItem(item, userKey);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Location history migrate-apply error:', error);
    const status = String(error.message || '').includes('already registered') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Unable to migrate location'
    });
  }
});

/** Persist a detailed migration error log under backend/logs and return file info. */
router.post('/migrate-log', async (req, res) => {
  try {
    const userKey = req.session?.user?.email || req.session?.user?.username || 'Setting Location migrate';
    const report = {
      ...(req.body || {}),
      user: req.body?.user || userKey
    };
    const saved = await locationCodeHistoryMigrateService.writeMigrationErrorLog(report);
    res.json({
      success: true,
      data: {
        fileName: saved.fileName,
        relativePath: saved.relativePath,
        lineCount: saved.lineCount,
        content: saved.content
      }
    });
  } catch (error) {
    console.error('Location history migrate-log error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unable to write migration error log'
    });
  }
});

module.exports = router;
