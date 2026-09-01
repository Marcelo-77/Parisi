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

const validarAssignments = [
  body('assignments').optional().isArray().withMessage('assignments must be an array'),
  body('assignments.*.syapCdSeq').optional().isInt({ min: 1, max: 9999 }),
  body('assignments.*.accessMode').optional().isIn(['all', 'search']),
  body('syapCdSeqList').optional().isArray().withMessage('syapCdSeqList must be an array'),
  body('syapCdSeqList.*').optional().isInt({ min: 1, max: 9999 })
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
    ...validarAssignments,
    body().custom((value, { req }) => {
      const hasAssignments = Array.isArray(req.body.assignments);
      const hasLegacyList = Array.isArray(req.body.syapCdSeqList);
      if (!hasAssignments && !hasLegacyList) {
        throw new Error('assignments or syapCdSeqList is required');
      }
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const data = await userApplicationService.replaceForFuncionario(
        req.params.funcionarioId,
        req.body
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
