const express = require('express');
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
    const file = await systemDocumentationService.getDownloadFile(req.params.id);
    if (!file || !file.buffer || !file.buffer.length) {
      return res.status(404).json({
        success: false,
        error: 'File not found. Please upload the document again.'
      });
    }

    const encodedName = encodeURIComponent(file.fileName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
    );
    if (file.mimeType) {
      res.type(file.mimeType);
    }

    return res.send(file.buffer);
  } catch (error) {
    console.error('System documentation download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Error downloading documentation'
      });
    }
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
