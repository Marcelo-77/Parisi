const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const MAP_PUBLIC_PATH = path.join(__dirname, '..', 'public', 'WareHouseMap.xlsx');
const MAP_BACKEND_PATH = path.join(__dirname, '..', 'WareHouseMap.xlsx');

router.post('/upload', express.raw({ limit: '20mb', type: '*/*' }), (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({
        success: false,
        error: 'Empty file',
        message: 'No file content received.'
      });
    }

    const signature = req.body.slice(0, 2).toString('utf8');
    const isZipXlsx = signature === 'PK';
    const isLegacyXls = req.body.slice(0, 8).toString('utf8').startsWith('\xD0\xCF\x11\xE0');

    if (!isZipXlsx && !isLegacyXls) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file',
        message: 'File must be a valid Excel workbook (.xlsx or .xls).'
      });
    }

    fs.writeFileSync(MAP_PUBLIC_PATH, req.body);
    fs.writeFileSync(MAP_BACKEND_PATH, req.body);

    res.json({
      success: true,
      message: 'WareHouseMap.xlsx uploaded successfully.',
      fileName: 'WareHouseMap.xlsx',
      size: req.body.length
    });
  } catch (error) {
    console.error('Warehouse map upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error.message
    });
  }
});

router.get('/info', (req, res) => {
  try {
    if (!fs.existsSync(MAP_PUBLIC_PATH)) {
      return res.json({
        success: true,
        exists: false,
        fileName: 'WareHouseMap.xlsx'
      });
    }

    const stats = fs.statSync(MAP_PUBLIC_PATH);
    res.json({
      success: true,
      exists: true,
      fileName: 'WareHouseMap.xlsx',
      size: stats.size,
      updatedAt: stats.mtime
    });
  } catch (error) {
    console.error('Warehouse map info error:', error);
    res.status(500).json({
      success: false,
      error: 'Info failed',
      message: error.message
    });
  }
});

module.exports = router;
