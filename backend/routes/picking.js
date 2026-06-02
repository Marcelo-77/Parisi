const express = require('express');
const pickingService = require('../services/pickingService');

const router = express.Router();

// GET /api/picking - lista itens de picking (fase 2, tipo 1)
router.get('/', async (req, res) => {
  try {
    const list = await pickingService.listPicking();
    res.json({ success: true, data: list, total: list.length });
  } catch (error) {
    console.error('Error listing picking items:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing picking items',
      message: error.message
    });
  }
});

// GET /api/picking/separation - lista itens da fase 3 (Separation and Picking)
router.get('/separation', async (req, res) => {
  try {
    const list = await pickingService.listSeparationPicking();
    res.json({ success: true, data: list, total: list.length });
  } catch (error) {
    console.error('Error listing separation picking items:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing separation picking items',
      message: error.message
    });
  }
});

// GET /api/picking/double-checking - lista itens da fase 4 (Sent for Double Checking)
router.get('/double-checking', async (req, res) => {
  try {
    const list = await pickingService.listDoubleChecking();
    res.json({ success: true, data: list, total: list.length });
  } catch (error) {
    console.error('Error listing double checking items:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing double checking items',
      message: error.message
    });
  }
});

// GET /api/picking/last-check-label - lista itens da fase 6 (Last check and Label)
router.get('/last-check-label', async (req, res) => {
  try {
    const list = await pickingService.listLastCheckAndLabel();
    res.json({ success: true, data: list, total: list.length });
  } catch (error) {
    console.error('Error listing last check and label items:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing last check and label items',
      message: error.message
    });
  }
});

// POST /api/picking/last-check-label/save - grava motivo e descrição dos itens da fase 6
router.post('/last-check-label/save', async (req, res) => {
  try {
    const { items, funcionarioId } = req.body || {};
    await pickingService.saveLastCheckAndLabelItems(items || [], funcionarioId || null);
    res.json({
      success: true,
      message: 'Last check and Label items saved successfully.'
    });
  } catch (error) {
    console.error('Error saving last check and label items:', error);
    res.status(400).json({
      success: false,
      error: 'Error saving last check and label items',
      message: error.message
    });
  }
});

// POST /api/picking/double-checking/confirm
// Recebe lista de itens da fase 4 com qty double checked, reason e descrição de erro;
// cria registros nas fases 5 (erro) e 6 (OK) em phase_movement_item.
router.post('/double-checking/confirm', async (req, res) => {
  try {
    const { items, funcionarioId } = req.body || {};
    await pickingService.confirmDoubleChecking(items || [], funcionarioId || null);
    res.json({
      success: true,
      message: 'Double Checking results saved and items sent to phases 5 and 6 successfully.'
    });
  } catch (error) {
    console.error('Error confirming double checking:', error);
    res.status(400).json({
      success: false,
      error: 'Error confirming double checking',
      message: error.message
    });
  }
});

// POST /api/picking/send-double-checking
// Recebe lista de itens da fase 3 com qty picked e reason; insere na fase 4.
router.post('/send-double-checking', async (req, res) => {
  try {
    const { items, funcionarioId } = req.body || {};
    await pickingService.sendToDoubleChecking(items || [], funcionarioId || null);
    res.json({
      success: true,
      message: 'Items sent for double checking successfully.'
    });
  } catch (error) {
    console.error('Error sending for double checking:', error);
    res.status(400).json({
      success: false,
      error: 'Error sending for double checking',
      message: error.message
    });
  }
});

// POST /api/picking/separation-and-picking
// Recebe lista de phmiIds (itens marcados com "Get it") e cria registros na fase 3.
router.post('/separation-and-picking', async (req, res) => {
  try {
    const { phmiIds, funcionarioId } = req.body || {};
    await pickingService.separationAndPicking(phmiIds || [], funcionarioId || null);
    res.json({
      success: true,
      message: 'Separation and Picking created successfully for selected items.'
    });
  } catch (error) {
    console.error('Error in Separation and Picking:', error);
    res.status(400).json({
      success: false,
      error: 'Error in Separation and Picking',
      message: error.message
    });
  }
});

module.exports = router;

