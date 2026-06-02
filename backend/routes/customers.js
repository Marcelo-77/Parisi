const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const customerService = require('../services/customerService');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid data', details: errors.array() });
  }
  next();
};

// GET /api/customers - list (optional filters: custNmCustomer, custCdCode)
router.get(
  '/',
  [queryValidator('custNmCustomer').optional().trim(), queryValidator('custCdCode').optional().trim()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = { custNmCustomer: req.query.custNmCustomer, custCdCode: req.query.custCdCode };
      const list = await customerService.list(filters);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error listing customers:', error);
      res.status(500).json({
        success: false,
        error: 'Error listing customers',
        message: error.message
      });
    }
  }
);

// POST /api/customers - create new customer
router.post(
  '/',
  [
    body('custNmCustomer').optional().isLength({ max: 50 }).trim(),
    body('custCdCode').optional().isLength({ max: 20 }).trim(),
    body('custDsAddress').optional().isLength({ max: 100 }).trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const created = await customerService.create(req.body);
      res.status(201).json({ success: true, message: 'Customer created', data: created });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error creating customer'
      });
    }
  }
);

module.exports = router;
