const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const companyService = require('../services/companyService');

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

const optionalCompanyFields = [
  body('responsibleName').optional({ nullable: true }).isLength({ max: 100 }).trim(),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email must have a valid format').normalizeEmail(),
  body('phone').optional({ nullable: true }).isLength({ max: 20 }).trim(),
  body('address').optional({ nullable: true }).isLength({ max: 255 }).trim(),
  body('logo').optional({ nullable: true }).isString()
];

router.get('/', [
  query('name').optional().isLength({ min: 1, max: 150 }).trim()
], handleValidationErrors, async (req, res) => {
  try {
    const companies = await companyService.list({
      name: req.query.name
    });
    res.json({
      success: true,
      data: companies,
      total: companies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error listing companies',
      message: error.message
    });
  }
});

router.get('/:id/logo', [
  param('id').isUUID().withMessage('ID must be a valid UUID')
], handleValidationErrors, async (req, res) => {
  try {
    const parsed = await companyService.findLogoById(req.params.id);
    if (!parsed || !parsed.buffer || !parsed.buffer.length) {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', parsed.contentType || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(parsed.buffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error fetching company logo',
      message: error.message
    });
  }
});

router.get('/:id', [
  param('id').isUUID().withMessage('ID must be a valid UUID')
], handleValidationErrors, async (req, res) => {
  try {
    const company = await companyService.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching company',
      message: error.message
    });
  }
});

router.post('/', [
  body('name').isLength({ min: 1, max: 150 }).withMessage('Company name is required').trim(),
  ...optionalCompanyFields
], handleValidationErrors, async (req, res) => {
  try {
    const company = await companyService.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    const status = error.message.includes('already exists') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

router.patch('/:id', [
  param('id').isUUID().withMessage('ID must be a valid UUID'),
  body('name').optional().isLength({ min: 1, max: 150 }).withMessage('Company name is required').trim(),
  ...optionalCompanyFields
], handleValidationErrors, async (req, res) => {
  try {
    const company = await companyService.update(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    const status = error.message === 'Company not found'
      ? 404
      : error.message.includes('already exists')
        ? 409
        : 400;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
