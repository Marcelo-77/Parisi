const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const systemApplicationService = require('../services/systemApplicationService');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid data', details: errors.array() });
  }
  next();
};

// GET /api/system-applications
router.get(
  '/',
  [
    queryValidator('syapNmApplication').optional().trim(),
    queryValidator('syapDsDetailed').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = {
        syapNmApplication: req.query.syapNmApplication,
        syapDsDetailed: req.query.syapDsDetailed
      };
      const list = await systemApplicationService.list(filters);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error listing system applications:', error);
      res.status(500).json({
        success: false,
        error: 'Error listing applications',
        message: error.message
      });
    }
  }
);

// POST /api/system-applications
router.post(
  '/',
  [
    body('syapNmApplication').isLength({ min: 1, max: 100 }).trim(),
    body('syapDsDetailed').optional().isLength({ max: 150 }).trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const created = await systemApplicationService.create(req.body);
      res.status(201).json({ success: true, message: 'Application created', data: created });
    } catch (error) {
      console.error('Error creating system application:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error creating application'
      });
    }
  }
);

module.exports = router;
