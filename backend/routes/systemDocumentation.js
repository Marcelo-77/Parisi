const express = require('express');
const fs = require('fs');
const systemDocumentationService = require('../services/systemDocumentationService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession } = require('../middleware/auth');

const router = express.Router();

async function getUploaderInfo(req) {
  if (isRootSession(req)) {
    return { uploadedBy: null, uploadedByName: 'Root' };
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return { uploadedBy: null, uploadedByName: 'Unknown' };
  }

  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    uploadedBy: userId,
    uploadedByName: profile?.nome || profile?.email || 'User'
  };
}

router.get('/', async (req, res) => {
  try {
    const data = await systemDocumentationService.list({
      title: req.query.title,
      uploadedByName: req.query.uploadedByName,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    });

    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('System documentation list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing documentation'
    });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const fileInfo = await systemDocumentationService.getFileInfo(req.params.id);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const filePath = systemDocumentationService.getAbsolutePath(fileInfo.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    res.download(filePath, fileInfo.fileName);
  } catch (error) {
    console.error('System documentation download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error downloading documentation'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, fileName, mimeType, fileBase64 } = req.body || {};
    const uploader = await getUploaderInfo(req);

    const doc = await systemDocumentationService.create({
      title,
      description,
      fileName,
      mimeType,
      fileBase64,
      uploadedBy: uploader.uploadedBy,
      uploadedByName: uploader.uploadedByName
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('System documentation create error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving documentation'
    });
  }
});

module.exports = router;
