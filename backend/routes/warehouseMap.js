const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const MAP_PUBLIC_PATH = path.join(__dirname, '..', 'public', 'WareHouseMap.xlsx');
const MAP_BACKEND_PATH = path.join(__dirname, '..', 'WareHouseMap.xlsx');
const IMAGE_FILE_PREFIX = 'WareHouseMap-image';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const LOCATIONS_JSON_PATH = path.join(__dirname, '..', 'public', 'WareHouseMap-locations.json');

function getImagePath(extension) {
  return path.join(__dirname, '..', 'public', `${IMAGE_FILE_PREFIX}${extension}`);
}

function getStoredImagePath() {
  return IMAGE_EXTENSIONS
    .map((ext) => getImagePath(ext))
    .find((filePath) => fs.existsSync(filePath)) || null;
}

function removeOldImages() {
  IMAGE_EXTENSIONS.forEach((ext) => {
    const filePath = getImagePath(ext);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
}

router.post('/upload', express.raw({ limit: '20mb', type: '*/*' }), (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({
        success: false,
        error: 'Empty file',
        message: 'No file content received.'
      });
    }

    const signature = req.body.slice(0, 12).toString('utf8');
    const isZipXlsx = signature.startsWith('PK');
    const isLegacyXls = req.body.slice(0, 8).toString('utf8').startsWith('\xD0\xCF\x11\xE0');
    const isPng = req.body.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const isJpeg = req.body.slice(0, 3).toString('hex') === 'ffd8ff';
    const isGif = req.body.slice(0, 6).toString('utf8') === 'GIF87a' || req.body.slice(0, 6).toString('utf8') === 'GIF89a';
    const isWebp = req.body.slice(0, 4).toString('utf8') === 'RIFF' && req.body.slice(8, 12).toString('utf8') === 'WEBP';
    const isImage = isPng || isJpeg || isGif || isWebp;

    if (!isZipXlsx && !isLegacyXls && !isImage) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file',
        message: 'File must be a valid Excel workbook (.xlsx/.xls) or image (.png/.jpg/.jpeg/.gif/.webp).'
      });
    }

    if (isImage) {
      removeOldImages();
      const ext = isPng ? '.png' : isJpeg ? '.jpg' : isGif ? '.gif' : '.webp';
      const imagePath = getImagePath(ext);
      fs.writeFileSync(imagePath, req.body);
      res.json({
        success: true,
        message: 'Warehouse map image uploaded successfully.',
        fileName: path.basename(imagePath),
        size: req.body.length,
        kind: 'image'
      });
      return;
    }

    fs.writeFileSync(MAP_PUBLIC_PATH, req.body);
    fs.writeFileSync(MAP_BACKEND_PATH, req.body);
    removeOldImages();

    res.json({
      success: true,
      message: 'WareHouseMap.xlsx uploaded successfully.',
      fileName: 'WareHouseMap.xlsx',
      size: req.body.length,
      kind: 'excel',
      locationsJsonRequired: true
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

router.get('/image', (req, res) => {
  try {
    const imagePath = getStoredImagePath();
    if (!imagePath) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'No warehouse map image found.'
      });
    }

    res.sendFile(imagePath);
  } catch (error) {
    console.error('Warehouse map image error:', error);
    res.status(500).json({
      success: false,
      error: 'Image failed',
      message: error.message
    });
  }
});

router.get('/locations', (req, res) => {
  try {
    if (!fs.existsSync(LOCATIONS_JSON_PATH)) {
      return res.json({
        success: true,
        exists: false
      });
    }

    const raw = fs.readFileSync(LOCATIONS_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    const locationCount = data && data.locations ? Object.keys(data.locations).length : 0;

    res.json({
      success: true,
      exists: true,
      data,
      locationCount,
      updatedAt: fs.statSync(LOCATIONS_JSON_PATH).mtime
    });
  } catch (error) {
    console.error('Warehouse map locations read error:', error);
    res.status(500).json({
      success: false,
      error: 'Locations failed',
      message: error.message
    });
  }
});

router.put('/locations', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || !payload.locations || typeof payload.locations !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        message: 'Location index must include a locations object.'
      });
    }

    const rowCount = Number(payload.rowCount) || 0;
    const colCount = Number(payload.colCount) || 0;
    if (!rowCount || !colCount) {
      return res.status(400).json({
        success: false,
        error: 'Invalid grid',
        message: 'Location index must include rowCount and colCount.'
      });
    }

    let imageArea = payload.imageArea;
    let imageCorners = payload.imageCorners;
    let calibrationAnchors = payload.calibrationAnchors;
    if (fs.existsSync(LOCATIONS_JSON_PATH)) {
      try {
        const existing = JSON.parse(fs.readFileSync(LOCATIONS_JSON_PATH, 'utf8'));
        if ((!imageArea || typeof imageArea !== 'object') && existing && existing.imageArea) {
          imageArea = existing.imageArea;
        }
        if ((!imageCorners || typeof imageCorners !== 'object') && existing && existing.imageCorners) {
          imageCorners = existing.imageCorners;
        }
        if ((!calibrationAnchors || typeof calibrationAnchors !== 'object') && existing && existing.calibrationAnchors) {
          calibrationAnchors = existing.calibrationAnchors;
        }
      } catch {
        imageArea = imageArea || null;
        imageCorners = imageCorners || null;
        calibrationAnchors = calibrationAnchors || null;
      }
    }

    const normalized = {
      version: 1,
      generatedAt: payload.generatedAt || new Date().toISOString(),
      source: payload.source || 'excel',
      rowCount,
      colCount,
      mapBounds: payload.mapBounds || null,
      imageArea: imageArea || {
        left: 0.165,
        top: 0.075,
        width: 0.71,
        height: 0.62
      },
      imageCorners: imageCorners || {
        tl: { x: 0.127, y: 0.056 },
        tr: { x: 0.948, y: 0.048 },
        bl: { x: 0.70, y: 0.82 },
        br: { x: 0.88, y: 0.80 }
      },
      calibrationAnchors: calibrationAnchors || {
        tl: 'I8',
        tr: 'H33',
        bl: 'A49',
        br: 'A72'
      },
      locations: payload.locations
    };

    if (!normalized.mapBounds || typeof normalized.mapBounds !== 'object') {
      const values = Object.values(normalized.locations);
      let minRow = Infinity;
      let maxRow = -1;
      let minCol = Infinity;
      let maxCol = -1;
      values.forEach((pos) => {
        minRow = Math.min(minRow, pos.row);
        maxRow = Math.max(maxRow, pos.row);
        minCol = Math.min(minCol, pos.col);
        maxCol = Math.max(maxCol, pos.col);
      });
      normalized.mapBounds = Number.isFinite(minRow)
        ? { minRow, maxRow, minCol, maxCol }
        : { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }

    fs.writeFileSync(LOCATIONS_JSON_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    const locationCount = Object.keys(normalized.locations).length;

    res.json({
      success: true,
      message: 'Warehouse map location coordinates saved.',
      locationCount,
      fileName: 'WareHouseMap-locations.json'
    });
  } catch (error) {
    console.error('Warehouse map locations write error:', error);
    res.status(500).json({
      success: false,
      error: 'Locations failed',
      message: error.message
    });
  }
});

router.get('/info', (req, res) => {
  try {
    const imageFile = getStoredImagePath();

    const excelExists = fs.existsSync(MAP_PUBLIC_PATH);
    if (!excelExists && !imageFile) {
      return res.json({
        success: true,
        exists: false,
        fileName: 'WareHouseMap.xlsx'
      });
    }

    const targetPath = imageFile || MAP_PUBLIC_PATH;
    const stats = fs.statSync(targetPath);
    const fileName = path.basename(targetPath);
    const locationsExists = fs.existsSync(LOCATIONS_JSON_PATH);
    let locationCount = 0;
    if (locationsExists) {
      try {
        const locationsData = JSON.parse(fs.readFileSync(LOCATIONS_JSON_PATH, 'utf8'));
        locationCount = locationsData && locationsData.locations
          ? Object.keys(locationsData.locations).length
          : 0;
      } catch {
        locationCount = 0;
      }
    }

    res.json({
      success: true,
      exists: true,
      fileName,
      size: stats.size,
      updatedAt: stats.mtime,
      kind: imageFile ? 'image' : 'excel',
      imageUrl: imageFile ? `/${path.basename(imageFile)}` : null,
      locationsExists,
      locationCount
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
