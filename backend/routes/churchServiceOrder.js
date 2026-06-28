const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const churchServiceOrderService = require('../services/churchServiceOrderService');
const { getSessionUserId } = require('../middleware/auth');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid data', details: errors.array() });
  }
  next();
};

router.get(
  '/',
  [
    queryValidator('serviceDateFrom').optional().isISO8601(),
    queryValidator('serviceDateTo').optional().isISO8601(),
    queryValidator('dirigente').optional().trim(),
    queryValidator('churchName').optional().trim(),
    queryValidator('title').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const list = await churchServiceOrderService.list({
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        dirigente: req.query.dirigente,
        churchName: req.query.churchName,
        title: req.query.title
      });
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error listing church service orders:', error);
      res.status(500).json({
        success: false,
        error: 'Error listing church service orders',
        message: error.message
      });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const item = await churchServiceOrderService.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Not found', message: 'Order of service not found.' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error loading church service order:', error);
    res.status(500).json({
      success: false,
      error: 'Error loading church service order',
      message: error.message
    });
  }
});

const orderBodyValidators = [
  body('title').optional().isLength({ min: 1, max: 150 }).trim(),
  body('serviceDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('churchName').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('dirigente').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('openingAct').optional({ nullable: true }).isLength({ max: 300 }).trim(),
  body('worshipSongs').optional().isArray(),
  body('scriptureReader').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('praiseLeader').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('praiseStatus').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('offeringsInstruction').optional({ nullable: true }).isLength({ max: 500 }).trim(),
  body('messageSpeaker').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('closingPrayerLeader').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('priestlyBlessingLeader').optional({ nullable: true }).isLength({ max: 150 }).trim(),
  body('announcementsPosition').optional({ nullable: true }).isInt({ min: 1, max: 9 })
];

router.post('/', orderBodyValidators, handleValidationErrors, async (req, res) => {
  try {
    const created = await churchServiceOrderService.create(req.body, getSessionUserId(req));
    res.status(201).json({ success: true, message: 'Order of service saved', data: created });
  } catch (error) {
    console.error('Error creating church service order:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving order of service'
    });
  }
});

router.put('/:id', orderBodyValidators, handleValidationErrors, async (req, res) => {
  try {
    const updated = await churchServiceOrderService.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Not found', message: 'Order of service not found.' });
    }
    res.json({ success: true, message: 'Order of service updated', data: updated });
  } catch (error) {
    console.error('Error updating church service order:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error updating order of service'
    });
  }
});

module.exports = router;
