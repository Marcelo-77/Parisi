const express = require('express');
const locationCodeSettingsService = require('../services/locationCodeSettingsService');
const locationCodeHistoryMigrateService = require('../services/locationCodeHistoryMigrateService');
const locationCodeMigrateStatusService = require('../services/locationCodeMigrateStatusService');

const router = express.Router();

function userKeyFromReq(req) {
  return req.session?.user?.email || req.session?.user?.username || 'Setting Location migrate';
}

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

/** Remote progress for history migration (check from another computer). */
router.get('/migrate-status', (req, res) => {
  res.json({ success: true, data: locationCodeMigrateStatusService.getStatus() });
});

router.post('/migrate-heartbeat', (req, res) => {
  res.json({ success: true, data: locationCodeMigrateStatusService.heartbeat() });
});

router.post('/migrate-finish', (req, res) => {
  const data = locationCodeMigrateStatusService.finish(req.body || {});
  res.json({ success: true, data });
});

/** Build rename plan when switching schemes (classic ↔ Street/Building/Level). */
router.post('/migrate-plan', async (req, res) => {
  const userKey = userKeyFromReq(req);
  try {
    const current = await locationCodeSettingsService.getSettings();
    const fromScheme = String(req.body?.fromScheme || current.activeScheme || 'classic');
    const toScheme = String(req.body?.toScheme || current.activeScheme || 'classic');
    const settings = { ...current, ...(req.body?.settings || {}) };

    locationCodeMigrateStatusService.startPlanning({ fromScheme, toScheme, startedBy: userKey });

    const plan = await locationCodeHistoryMigrateService.buildMigrationPlan(
      fromScheme,
      toScheme,
      settings
    );
    const status = locationCodeMigrateStatusService.startRunning(plan, userKey);
    res.json({ success: true, data: { ...plan, status } });
  } catch (error) {
    console.error('Location history migrate-plan error:', error);
    locationCodeMigrateStatusService.fail(error.message || 'Unable to build migration plan');
    res.status(400).json({
      success: false,
      error: error.message || 'Unable to build migration plan'
    });
  }
});

/** Apply one rename (updates warehouse_locations + location_product cascade + location_product_log). */
router.post('/migrate-apply', async (req, res) => {
  const item = req.body?.item;
  try {
    if (!item?.id || !item?.to) {
      return res.status(400).json({ success: false, error: 'item.id and item.to are required' });
    }
    locationCodeMigrateStatusService.markApplyStart(item);
    const userKey = userKeyFromReq(req);
    const updated = await locationCodeHistoryMigrateService.applyMigrationItem(item, userKey);
    const status = locationCodeMigrateStatusService.markApplySuccess(item);
    res.json({ success: true, data: updated, status });
  } catch (error) {
    console.error('Location history migrate-apply error:', error);
    const status = locationCodeMigrateStatusService.markApplyFailure(
      item || {},
      error.message || 'Unable to migrate location'
    );
    const httpStatus = String(error.message || '').includes('already registered') ? 409 : 400;
    res.status(httpStatus).json({
      success: false,
      error: error.message || 'Unable to migrate location',
      status
    });
  }
});

/** Apply a batch of renames in one request (much faster than one-by-one). */
router.post('/migrate-apply-batch', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    if (items.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 items per batch' });
    }

    const userKey = userKeyFromReq(req);
    const first = items[0] || {};
    locationCodeMigrateStatusService.markApplyStart(first);

    const result = await locationCodeHistoryMigrateService.applyMigrationBatch(items, userKey, {
      onItemStart: (item) => locationCodeMigrateStatusService.markApplyStart(item),
      onItemDone: (item) => locationCodeMigrateStatusService.markApplySuccess(item),
      onItemFail: (item, reason) => locationCodeMigrateStatusService.markApplyFailure(item, reason)
    });

    res.json({
      success: true,
      data: result,
      status: locationCodeMigrateStatusService.getStatus()
    });
  } catch (error) {
    console.error('Location history migrate-apply-batch error:', error);
    locationCodeMigrateStatusService.fail(error.message || 'Unable to migrate batch');
    res.status(500).json({
      success: false,
      error: error.message || 'Unable to migrate batch'
    });
  }
});

/** Preview Side L/M/R → Position remap (old R=1/L=2/M=3 → new L=1/M=2/R=3). */
router.post('/migrate-remap-side-plan', async (req, res) => {
  try {
    const plan = await locationCodeHistoryMigrateService.buildSidePositionRemapPlan();
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Location side-pos remap plan error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Unable to build side/position remap plan'
    });
  }
});

/** Apply Side/Position remap corrective. */
router.post('/migrate-remap-side-apply', async (req, res) => {
  try {
    const userKey = userKeyFromReq(req);
    const plan = await locationCodeHistoryMigrateService.buildSidePositionRemapPlan();
    locationCodeMigrateStatusService.startPlanning({
      fromScheme: 'bay_pos_old',
      toScheme: 'bay_pos_new',
      startedBy: userKey
    });
    locationCodeMigrateStatusService.startRunning(
      { fromScheme: 'bay_pos_old', toScheme: 'bay_pos_new', total: plan.total * 2, skippedCount: 0 },
      userKey
    );

    const result = await locationCodeHistoryMigrateService.applySidePositionRemap(userKey, {
      plan,
      onItemStart: (item) => locationCodeMigrateStatusService.markApplyStart(item),
      onItemDone: (item) => locationCodeMigrateStatusService.markApplySuccess(item),
      onItemFail: (item, reason) => locationCodeMigrateStatusService.markApplyFailure(item, reason)
    });

    locationCodeMigrateStatusService.finish({
      status: result.failed > 0 ? 'completed_with_errors' : 'completed',
      plannedTotal: plan.total * 2,
      done: result.done,
      failed: result.failed,
      skippedCount: 0,
      summary: `Side/Position remap finished. Updated ${result.done} of ${plan.total}. Failed: ${result.failed}. Scope: ${result.scope}.`
    });

    res.json({
      success: true,
      data: result,
      status: locationCodeMigrateStatusService.getStatus()
    });
  } catch (error) {
    console.error('Location side-pos remap apply error:', error);
    locationCodeMigrateStatusService.fail(error.message || 'Unable to remap side/position');
    res.status(500).json({
      success: false,
      error: error.message || 'Unable to remap side/position'
    });
  }
});

/** Persist a detailed migration error log under backend/logs and return file info. */
router.post('/migrate-log', async (req, res) => {
  try {
    const userKey = userKeyFromReq(req);
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
