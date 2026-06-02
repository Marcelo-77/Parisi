const express = require('express');
const { query } = require('../config/database');
const router = express.Router();

// GET /api/situations - Listar situation_product para dropdowns
// node-pg retorna colunas em minúsculas: sipr_sq_number, sipr_nm_description
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT sipr_sq_number, sipr_nm_description FROM situation_product ORDER BY sipr_sq_number'
    );
    const rows = result.rows || [];
    const data = rows.map(r => {
      const num = r.sipr_sq_number ?? r.siprSqNumber;
      const desc = r.sipr_nm_description ?? r.siprNmDescription ?? '';
      return {
        siprSqNumber: Number(num),
        siprNmDescription: String(desc).trim() || null
      };
    });
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching situations:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching situations',
      message: error.message
    });
  }
});

module.exports = router;
