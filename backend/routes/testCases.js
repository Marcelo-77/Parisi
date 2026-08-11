const express = require('express');
const testCaseService = require('../services/testCaseService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession } = require('../middleware/auth');

const router = express.Router();

async function getCreatorInfo(req) {
  if (isRootSession(req)) {
    return { createdBy: null, createdByName: 'Root' };
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return { createdBy: null, createdByName: 'Unknown' };
  }

  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    createdBy: userId,
    createdByName: profile?.nome || profile?.email || 'User'
  };
}

router.get('/options', (req, res) => {
  res.json({
    success: true,
    data: {
      modules: testCaseService.MODULES,
      statuses: testCaseService.STATUSES,
      severities: testCaseService.SEVERITIES
    }
  });
});

router.get('/next-id', async (req, res) => {
  try {
    const data = await testCaseService.previewNextId();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Test case next-id error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error generating next Test Case ID'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await testCaseService.list({
      testCaseId: req.query.testCaseId,
      module: req.query.module,
      status: req.query.status,
      severity: req.query.severity,
      tester: req.query.tester,
      testScenario: req.query.testScenario,
      search: req.query.search
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Test case list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing test cases'
    });
  }
});

router.get('/:id/evidence', async (req, res) => {
  try {
    const file = await testCaseService.getEvidenceFile(req.params.id);
    if (!file || !file.buffer || !file.buffer.length) {
      return res.status(404).json({
        success: false,
        error: 'Evidence file not found.'
      });
    }

    const encodedName = encodeURIComponent(file.fileName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
    );
    if (file.mimeType) res.type(file.mimeType);
    return res.send(file.buffer);
  } catch (error) {
    console.error('Test case evidence download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Error downloading evidence'
      });
    }
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await testCaseService.findById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Test case not found.' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Test case get error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading test case'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req);
    const tester = req.body.tester && String(req.body.tester).trim()
      ? String(req.body.tester).trim()
      : creator.createdByName;
    const data = await testCaseService.create({
      ...req.body,
      tester,
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Test case create error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving test case'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await testCaseService.update(req.params.id, req.body || {});
    if (!data) {
      return res.status(404).json({ success: false, error: 'Test case not found.' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Test case update error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error updating test case'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await testCaseService.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Test case not found.' });
    }
    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Test case delete error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error deleting test case'
    });
  }
});

module.exports = router;
