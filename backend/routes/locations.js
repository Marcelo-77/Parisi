const express = require('express');
const { body, query, validationResult } = require('express-validator');
const locationService = require('../services/locationService');
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

const validarLocation = [
  body('location')
    .isLength({ min: 2, max: 50 })
    .withMessage('Location must be between 2 and 50 characters')
    .trim(),
  body('status')
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  body('accessType')
    .isIn(['Shelf by Hand', 'Shelf by Wave', 'Shelf By Fork'])
    .withMessage('Access type is invalid'),
  body('section')
    .isIn(['TAPWARE', 'BATHWARE', 'CENTRAL', 'WAREHOUSE2', 'FURNITUREWARE', 'DOORWARE', 'OTHER'])
    .withMessage('Section is invalid')
];

// GET /api/locations
router.get(
  '/',
  [
    query('location').optional().isLength({ min: 1 }).trim(),
    query('status').optional().isIn(['active', 'inactive']),
    query('accessType')
      .optional()
      .isIn(['Shelf by Hand', 'Shelf by Wave', 'Shelf By Fork']),
    query('section')
      .optional()
      .isIn(['TAPWARE', 'BATHWARE', 'CENTRAL', 'WAREHOUSE2', 'FURNITUREWARE', 'DOORWARE', 'OTHER'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filtros = {
        location: req.query.location,
        status: req.query.status,
        accessType: req.query.accessType,
        section: req.query.section
      };

      const locations = await locationService.buscarTodos(filtros);
      res.json({
        success: true,
        data: locations,
        total: locations.length
      });
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching locations',
        message: error.message
      });
    }
  }
);

// GET /api/locations/code/:locationCode
router.get('/code/:locationCode', async (req, res) => {
  try {
    const location = await locationService.buscarPorLocation(req.params.locationCode);
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
        message: 'Location not found'
      });
    }
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Error fetching location by code:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching location',
      message: error.message
    });
  }
});

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  try {
    const location = await locationService.buscarPorId(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
        message: 'Location not found'
      });
    }
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching location',
      message: error.message
    });
  }
});

// POST /api/locations
router.post('/', validarLocation, handleValidationErrors, async (req, res) => {
  try {
    const userKey = getSessionUserKey(req);
    const location = await locationService.criar({
      ...req.body,
      usuarioInseriu: userKey,
      usuarioAlterou: userKey
    });
    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: location
    });
  } catch (error) {
    console.error('Error creating location:', error);
    const status = error.message.includes('already registered') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: 'Error creating location',
      message: error.message
    });
  }
});

// PUT /api/locations/:id
router.put('/:id', validarLocation, handleValidationErrors, async (req, res) => {
  try {
    const userKey = getSessionUserKey(req);
    const location = await locationService.atualizar(req.params.id, {
      ...req.body,
      usuarioAlterou: userKey
    });
    res.json({
      success: true,
      message: 'Location updated successfully',
      data: location
    });
  } catch (error) {
    console.error('Error updating location:', error);
    if (error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
        message: error.message
      });
    }
    const status = error.message.includes('already registered') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: 'Error updating location',
      message: error.message
    });
  }
});

// DELETE /api/locations/:id
router.delete('/:id', async (req, res) => {
  try {
    await locationService.deletar(req.params.id);
    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    if (error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: 'Error deleting location',
      message: error.message
    });
  }
});

module.exports = router;

