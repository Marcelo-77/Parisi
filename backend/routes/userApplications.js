const express = require('express');
const { body, param, validationResult } = require('express-validator');
const userApplicationService = require('../services/userApplicationService');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid data', details: errors.array() });
  }
  next();
};

const validarFuncionarioId = [
  param('funcionarioId')
    .isUUID()
    .withMessage('Employee ID must be a valid UUID')
];

// GET /api/user-applications/:funcionarioId
router.get(
  '/:funcionarioId',
  validarFuncionarioId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const data = await userApplicationService.getAssignmentData(req.params.funcionarioId);
      res.json({ success: true, data });
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Error loading user applications'
      });
    }
  }
);

// PUT /api/user-applications/:funcionarioId
router.put(
  '/:funcionarioId',
  [
    ...validarFuncionarioId,
    body('syapCdSeqList').isArray().withMessage('syapCdSeqList must be an array'),
    body('syapCdSeqList.*').isInt({ min: 1, max: 9999 }).withMessage('Each application ID must be between 1 and 9999')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const data = await userApplicationService.replaceForFuncionario(
        req.params.funcionarioId,
        req.body.syapCdSeqList
      );
      res.json({
        success: true,
        message: 'User applications saved successfully',
        data
      });
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Error saving user applications'
      });
    }
  }
);

module.exports = router;
