const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');

const router = express.Router();

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid data',
      details: errors.array()
    });
  }
  next();
};

// Validations
const validarFuncionario = [
  body('nome')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Email must have a valid format')
    .normalizeEmail(),
  body('telefone')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone must be between 10 and 20 characters')
    .trim(),
  body('cargo')
    .isLength({ min: 2, max: 50 })
    .withMessage('Position must be between 2 and 50 characters')
    .trim(),
  body('departamento')
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters')
    .trim(),
  body('companyId')
    .isUUID()
    .withMessage('Company must be a valid ID'),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password must be between 6 and 100 characters'),
  body('salario')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
  body('dataAdmissao')
    .optional()
    .isISO8601()
    .withMessage('Hire date must be in YYYY-MM-DD format'),
  body('ativo')
    .optional()
    .isBoolean()
    .withMessage('Active status must be true or false')
];

const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID')
];

// GET /api/funcionarios - List all employees
router.get('/', [
  query('ativo').optional().isBoolean().withMessage('Active filter must be true or false'),
  query('departamento').optional().isLength({ min: 1 }).trim(),
  query('cargo').optional().isLength({ min: 1 }).trim(),
  query('nome').optional().isLength({ min: 1 }).trim(),
  query('ordenarPor').optional().isIn(['nome', 'cargo', 'departamento', 'dataAdmissao']),
  query('direcao').optional().isIn(['asc', 'desc'])
], handleValidationErrors, async (req, res) => {
  try {
    const filtros = {
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : undefined,
      departamento: req.query.departamento,
      cargo: req.query.cargo,
      nome: req.query.nome,
      ordenarPor: req.query.ordenarPor,
      direcao: req.query.direcao
    };

    const funcionarios = await funcionarioServiceDB.buscarTodos(filtros);
    
    res.json({
      success: true,
      data: funcionarios,
      total: funcionarios.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching employees',
      message: error.message
    });
  }
});

// GET /api/funcionarios/estatisticas - Get statistics
router.get('/estatisticas', async (req, res) => {
  try {
    const estatisticas = await funcionarioServiceDB.obterEstatisticas();
    
    res.json({
      success: true,
      data: estatisticas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error getting statistics',
      message: error.message
    });
  }
});

// GET /api/funcionarios/:id - Find employee by ID
router.get('/:id', validarId, handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.buscarPorId(req.params.id);
    
    res.json({
      success: true,
      data: funcionario
    });
  } catch (error) {
    const status = error.message === 'Employee not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/funcionarios - Create new employee
router.post('/', validarFuncionario, handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.criar(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: funcionario
    });
  } catch (error) {
    const status = error.message.includes('already registered') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/funcionarios/:id - Update employee
router.put('/:id', [...validarId, ...validarFuncionario], handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.atualizar(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: funcionario
    });
  } catch (error) {
    let status = 500;
    if (error.message === 'Employee not found') {
      status = 404;
    } else if (error.message.includes('already registered') || error.message.includes('invalid')) {
      status = 400;
    }
    
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH /api/funcionarios/:id - Partial update of employee
router.patch('/:id', validarId, handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.atualizar(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: funcionario
    });
  } catch (error) {
    let status = 500;
    if (error.message === 'Employee not found') {
      status = 404;
    } else if (error.message.includes('already registered') || error.message.includes('invalid')) {
      status = 400;
    }
    
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/funcionarios/:id - Delete employee (soft delete)
router.delete('/:id', validarId, handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.excluir(req.params.id);
    
    res.json({
      success: true,
      message: 'Employee deactivated successfully',
      data: funcionario
    });
  } catch (error) {
    const status = error.message === 'Employee not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/funcionarios/:id/permanente - Permanently delete employee
router.delete('/:id/permanente', validarId, handleValidationErrors, async (req, res) => {
  try {
    const funcionario = await funcionarioServiceDB.excluirPermanentemente(req.params.id);
    
    res.json({
      success: true,
      message: 'Employee permanently deleted',
      data: funcionario
    });
  } catch (error) {
    const status = error.message === 'Employee not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

