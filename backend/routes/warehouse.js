const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const warehouseService = require('../services/warehouseService');

const router = express.Router();

// Middleware para tratar erros de validação
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

// Validações
const validarItem = [
  body('codigo')
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .trim(),
  body('nome')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('categoria')
    .isLength({ min: 1, max: 50 })
    .withMessage('Category is required')
    .trim(),
  body('subcategoria')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 50 })
    .withMessage('Subcategory must be between 1 and 50 characters')
    .trim(),
  body('supplierProductCode')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('Supplier product code must be at most 100 characters')
    .trim(),
  body('barcode')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{1,20}$/)
    .withMessage('Barcode must contain only digits and max 20 characters'),
  body('quantidade')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('quantidadeMinima')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum quantity must be a non-negative integer'),
  body('descricao')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must have at most 500 characters')
    .trim(),
  body('photo')
    .optional({ nullable: true })
    .isString()
    .withMessage('Photo must be a string')
];

const validarMovimentacao = [
  body('tipo')
    .isIn(['entrada', 'saida'])
    .withMessage('Type must be "entrada" or "saida"'),
  body('quantidade')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('motivo')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Reason must have at most 200 characters')
    .trim()
];

// GET /api/warehouse - Listar todos os itens
router.get('/', [
  query('categoria').optional().isLength({ min: 1 }).trim(),
  query('subcategoria').optional().isLength({ min: 1, max: 50 }).trim(),
  query('codigo').optional().isLength({ min: 1 }).trim(),
  query('nome').optional().isLength({ min: 1 }).trim(),
  query('barcode').optional().isLength({ min: 1 }).trim(),
  query('localizacao').optional().isLength({ min: 1 }).trim(),
  query('withLocation').optional().isIn(['true', '1', 'yes']),
  query('ordenarPor').optional().isIn(['nome', 'codigo', 'categoria', 'quantidade']),
  query('direcao').optional().isIn(['asc', 'desc'])
], handleValidationErrors, async (req, res) => {
  try {
    const filtros = {
      categoria: req.query.categoria,
      subcategoria: req.query.subcategoria,
      codigo: req.query.codigo,
      nome: req.query.nome,
      barcode: req.query.barcode,
      withLocation: ['true', '1', 'yes'].includes(String(req.query.withLocation || '').toLowerCase()),
      ordenarPor: req.query.ordenarPor,
      direcao: req.query.direcao
    };

    const itens = await warehouseService.buscarTodos(filtros);
    
    res.json({
      success: true,
      data: itens,
      total: itens.length
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching items',
      message: error.message
    });
  }
});

// GET /api/warehouse/estatisticas - Obter estatísticas
router.get('/estatisticas', async (req, res) => {
  try {
    const estatisticas = await warehouseService.obterEstatisticas();
    res.json({
      success: true,
      data: estatisticas
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting statistics',
      message: error.message
    });
  }
});

// GET /api/warehouse/by-code/:codigo - Buscar item por código
router.get('/by-code/:codigo', async (req, res) => {
  try {
    const codigo = req.params.codigo;
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }
    const item = await warehouseService.buscarPorCodigo(codigo.trim());
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching item by code:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching item',
      message: error.message
    });
  }
});

// GET /api/warehouse/:id - Buscar item por ID
router.get('/:id', [
  param('id').isUUID().withMessage('ID must be a valid UUID')
], handleValidationErrors, async (req, res) => {
  try {
    const item = await warehouseService.buscarPorId(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching item',
      message: error.message
    });
  }
});

// POST /api/warehouse/:id/prepare-ar-model - Cache public GLB for Scene Viewer / WebXR
router.post('/:id/prepare-ar-model', [
  param('id').isUUID().withMessage('ID must be a valid UUID')
], handleValidationErrors, async (req, res) => {
  try {
    const item = await warehouseService.buscarPorId(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const warehouseArGlbService = require('../services/warehouseArGlbService');
    const photoOverride = req.body && req.body.photo ? req.body.photo : null;
    const glbBase64 = req.body && req.body.glbBase64 ? req.body.glbBase64 : null;
    const prepared = warehouseArGlbService.writeProductArModel(item, photoOverride, glbBase64);
    const absoluteUrl = `${req.protocol}://${req.get('host')}${prepared.relativeUrl}?v=${Date.now()}`;

    res.json({
      success: true,
      data: {
        url: absoluteUrl,
        relativeUrl: prepared.relativeUrl,
        hasPhoto: prepared.hasPhoto,
        photoError: prepared.photoError,
        fileName: prepared.fileName,
        byteLength: prepared.byteLength
      }
    });
  } catch (error) {
    console.error('Error preparing AR model:', error);
    res.status(500).json({
      success: false,
      error: 'Error preparing AR model',
      message: error.message
    });
  }
});

// POST /api/warehouse - Criar novo item
router.post('/', validarItem, handleValidationErrors, async (req, res) => {
  try {
    const item = await warehouseService.criar(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(400).json({
      success: false,
      error: 'Error creating item',
      message: error.message
    });
  }
});

// PUT /api/warehouse/:id - Atualizar item
router.put('/:id', [
  param('id').isUUID().withMessage('ID must be a valid UUID'),
  ...validarItem
], handleValidationErrors, async (req, res) => {
  try {
    const item = await warehouseService.atualizar(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating item:', error);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: 'Error updating item',
      message: error.message
    });
  }
});

// DELETE /api/warehouse/:id - Excluir item
router.delete('/:id', [
  param('id').isUUID().withMessage('ID must be a valid UUID')
], handleValidationErrors, async (req, res) => {
  try {
    await warehouseService.excluir(req.params.id);
    
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Error deleting item',
      message: error.message
    });
  }
});

// POST /api/warehouse/:id/movement - Registrar movimentação de estoque
router.post('/:id/movement', [
  param('id').isUUID().withMessage('ID must be a valid UUID'),
  ...validarMovimentacao
], handleValidationErrors, async (req, res) => {
  try {
    const { tipo, quantidade, motivo } = req.body;
    const resultado = await warehouseService.registrarMovimentacao(
      req.params.id,
      tipo,
      quantidade,
      motivo
    );
    
    res.json({
      success: true,
      message: `Movement of ${tipo} registered successfully`,
      data: resultado
    });
  } catch (error) {
    console.error('Error registering movement:', error);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: 'Error registering movement',
      message: error.message
    });
  }
});

module.exports = router;
