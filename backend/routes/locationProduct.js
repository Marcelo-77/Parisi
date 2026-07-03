const express = require('express');
const { body, query, validationResult } = require('express-validator');
const locationProductService = require('../services/locationProductService');
const { getSessionUserKey } = require('../middleware/auth');

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

const validarCreate = [
  body('locationCode').isLength({ min: 1, max: 50 }).trim(),
  body('productCode').isLength({ min: 1, max: 50 }).trim(),
  body('entryDatetime').notEmpty().withMessage('Entry date/time is required'),
  body('siprSqNumber').isInt({ min: 1 }).withMessage('Situation is required'),
  body('quantityInformed').optional().isInt({ min: 0 }),
  body('quantityCurrent').optional().isInt({ min: 0 })
];

// GET /api/location-product/location-codes-with-quantity
router.get('/location-codes-with-quantity', async (req, res) => {
  try {
    const codes = await locationProductService.listarLocationCodesComQuantidadeInformed();
    res.json({ success: true, data: codes });
  } catch (error) {
    console.error('Error fetching location codes:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching location codes',
      message: error.message
    });
  }
});

// GET /api/location-product/log - pesquisa em location_product_log
router.get(
  '/log',
  [
    query('locationCodeLog').optional().trim(),
    query('productCodeLog').optional().trim(),
    query('entryFrom').optional().trim(),
    query('entryTo').optional().trim(),
    query('siprSqNumber').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filtros = {
        locationCodeLog: req.query.locationCodeLog,
        productCodeLog: req.query.productCodeLog,
        entryFrom: req.query.entryFrom,
        entryTo: req.query.entryTo,
        siprSqNumber: req.query.siprSqNumber ? parseInt(req.query.siprSqNumber) : undefined
      };
      const list = await locationProductService.buscarLog(filtros);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error fetching location-product log:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching log',
        message: error.message
      });
    }
  }
);

// GET /api/location-product/product-codes-with-location - product codes with quantity_current > 0
router.get('/product-codes-with-location', async (req, res) => {
  try {
    const codes = await locationProductService.listarProductCodesComQuantidadeAtiva();
    res.json({ success: true, data: codes, total: codes.length });
  } catch (error) {
    console.error('Error fetching product codes with location:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching product codes with location',
      message: error.message
    });
  }
});

// GET /api/location-product/by-product-full/:productCode - location_code e quantity_current onde situation=Full e stat_cd_id='A'
router.get('/by-product-full/:productCode', async (req, res) => {
  try {
    const list = await locationProductService.buscarPorProdutoFullStatus(req.params.productCode);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching location-product by product (Full):', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching product locations',
      message: error.message
    });
  }
});

// GET /api/location-product
router.get(
  '/',
  [
    query('locationCode').optional().trim(),
    query('productCode').optional().trim(),
    query('siprSqNumber').optional().isInt(),
    query('entryFrom').optional().trim(),
    query('entryTo').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filtros = {
        locationCode: req.query.locationCode,
        productCode: req.query.productCode,
        siprSqNumber: req.query.siprSqNumber ? parseInt(req.query.siprSqNumber) : undefined,
        entryFrom: req.query.entryFrom,
        entryTo: req.query.entryTo
      };
      const list = await locationProductService.buscarTodos(filtros);
      res.json({ success: true, data: list, total: list.length });
    } catch (error) {
      console.error('Error fetching location-product:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching records',
        message: error.message
      });
    }
  }
);

// POST /api/location-product
router.post('/', validarCreate, handleValidationErrors, async (req, res) => {
  try {
    const userKey = getSessionUserKey(req);
    const created = await locationProductService.criar({
      ...req.body,
      usuarioInseriu: userKey
    });
    res.status(201).json({
      success: true,
      message: 'Location product record created',
      data: created
    });
  } catch (error) {
    console.error('Error creating location-product:', error);
    res.status(400).json({
      success: false,
      error: 'Error creating record',
      message: error.message
    });
  }
});

// PUT /api/location-product - update quantity_informed and quantity_current (composite key in body)
router.put(
  '/',
  [
    body('locationCode').isLength({ min: 1 }).trim(),
    body('productCode').isLength({ min: 1 }).trim(),
    body('entryDatetime').notEmpty(),
    body('siprSqNumber').isInt({ min: 1 }),
    body('quantityInformed').optional().isInt({ min: 0 }),
    body('quantityCurrent').optional().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { locationCode, productCode, entryDatetime, siprSqNumber, quantityInformed, quantityCurrent } = req.body;
      const updated = await locationProductService.atualizarQuantidades(
        locationCode,
        productCode,
        entryDatetime,
        siprSqNumber,
        { quantityInformed, quantityCurrent }
      );
      res.json({ success: true, message: 'Record updated', data: updated });
    } catch (error) {
      console.error('Error updating location-product:', error);
      if (error.message === 'Record not found') {
        return res.status(404).json({ success: false, error: 'Record not found', message: error.message });
      }
      res.status(400).json({
        success: false,
        error: 'Error updating record',
        message: error.message
      });
    }
  }
);

// DELETE /api/location-product (composite key in query)
router.delete('/', async (req, res) => {
  try {
    const { locationCode, productCode, entryDatetime, siprSqNumber } = req.query;
    if (!locationCode || !productCode || !entryDatetime || siprSqNumber == null || siprSqNumber === '') {
      return res.status(400).json({
        success: false,
        error: 'locationCode, productCode, entryDatetime and siprSqNumber are required'
      });
    }
    const deleted = await locationProductService.deletar(
      locationCode,
      productCode,
      entryDatetime,
      parseInt(siprSqNumber)
    );
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Error deleting location-product:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting record',
      message: error.message
    });
  }
});

module.exports = router;
