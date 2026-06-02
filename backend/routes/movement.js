const express = require('express');
const { query: queryValidator, body, validationResult } = require('express-validator');
const movementService = require('../services/movementService');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data',
      details: errors.array()
    });
  }
  next();
};

// GET /api/movement/types - list type_movement for dropdowns
router.get('/types', async (req, res) => {
  try {
    const list = await movementService.listTypes();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error listing movement types:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing movement types',
      message: error.message
    });
  }
});

// GET /api/movement - list with optional filters
router.get(
  '/',
  [
    queryValidator('tymoCdId').optional().isInt(),
    queryValidator('moveDtFrom').optional().trim(),
    queryValidator('moveDtTo').optional().trim(),
    queryValidator('moveCdMovement').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = {
        tymoCdId: req.query.tymoCdId,
        moveDtFrom: req.query.moveDtFrom,
        moveDtTo: req.query.moveDtTo,
        moveCdMovement: req.query.moveCdMovement
      };
      const list = await movementService.list(filters);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error listing movements:', error);
      res.status(500).json({
        success: false,
        error: 'Error listing movements',
        message: error.message
      });
    }
  }
);

// GET /api/movement/situation - full history of phase_movement_item per movement
router.get(
  '/situation',
  [
    queryValidator('tymoCdId').optional().isInt(),
    queryValidator('moveDtFrom').optional().trim(),
    queryValidator('moveDtTo').optional().trim(),
    queryValidator('moveCdMovement').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = {
        tymoCdId: req.query.tymoCdId,
        moveDtFrom: req.query.moveDtFrom,
        moveDtTo: req.query.moveDtTo,
        moveCdMovement: req.query.moveCdMovement
      };
      const list = await movementService.listSituation(filters);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error listing movement situation:', error);
      res.status(500).json({
        success: false,
        error: 'Error listing movement situation',
        message: error.message
      });
    }
  }
);

// GET /api/movement/:id - get one movement with items
router.get('/:id', async (req, res) => {
  try {
    const movement = await movementService.getById(req.params.id);
    if (!movement) {
      return res.status(404).json({ success: false, error: 'Movement not found' });
    }
    res.json({ success: true, data: movement });
  } catch (error) {
    console.error('Error getting movement:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting movement',
      message: error.message
    });
  }
});

// POST /api/movement - create movement with items
router.post(
  '/',
  [
    body('tymoCdId').isInt({ min: 1 }).withMessage('Type movement is required'),
    body('custCdId').optional().isInt({ min: 1 }),
    body('moveCdDestination').optional().isInt({ min: 1, max: 3 }),
    body('moveDtMovement').optional().trim(),
    body('moveCdMovement').optional().isLength({ max: 50 }).trim(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productCode').notEmpty().trim(),
    body('items.*.moveQtMovement').isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const created = await movementService.create(req.body);
      res.status(201).json({
        success: true,
        message: 'Movement created',
        data: created
      });
    } catch (error) {
      console.error('Error creating movement:', error);
      res.status(400).json({
        success: false,
        error: 'Error creating movement',
        message: error.message
      });
    }
  }
);

// POST /api/movement/:id/send-picking - send movement items to picking phase (phmo_sq_id = 2)
router.post('/:id/send-picking', async (req, res) => {
  try {
    await movementService.sendToPicking(req.params.id);
    res.json({
      success: true,
      message: 'Movement items sent to picking phase.'
    });
  } catch (error) {
    console.error('Error sending movement to picking:', error);
    res.status(400).json({
      success: false,
      error: 'Error sending movement to picking',
      message: error.message
    });
  }
});

module.exports = router;
