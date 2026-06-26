const express = require('express');
const companyService = require('../services/companyService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const companies = await companyService.list();
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

module.exports = router;
