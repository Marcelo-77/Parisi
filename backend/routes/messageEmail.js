const express = require('express');
const messageEmailService = require('../services/messageEmailService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession } = require('../middleware/auth');

const router = express.Router();

async function getCreatorInfo(req) {
  if (isRootSession(req)) {
    return { createdBy: null, createdByName: 'Root' };
  }

  const userId = getSessionUserId(req);
  if (!userId) return { createdBy: null, createdByName: 'Unknown' };

  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    createdBy: userId,
    createdByName: profile?.nome || profile?.email || 'User'
  };
}

router.get('/', async (req, res) => {
  try {
    const data = await messageEmailService.listar({
      messageCode: req.query.messageCode,
      subject: req.query.subject,
      body: req.query.body,
      notes: req.query.notes,
      category: req.query.category,
      status: req.query.status,
      createdByName: req.query.createdByName,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Message email list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing email messages'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await messageEmailService.buscarPorId(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Message email get error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading email message'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req);
    const created = await messageEmailService.criar({
      messageCode: req.body.messageCode,
      subject: req.body.subject,
      body: req.body.body,
      category: req.body.category,
      status: req.body.status,
      notes: req.body.notes,
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });
    res.status(201).json({
      success: true,
      message: 'Email message saved successfully',
      data: created
    });
  } catch (error) {
    console.error('Message email create error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving email message'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await messageEmailService.atualizar(req.params.id, {
      messageCode: req.body.messageCode,
      subject: req.body.subject,
      body: req.body.body,
      category: req.body.category,
      status: req.body.status,
      notes: req.body.notes
    });
    res.json({
      success: true,
      message: 'Email message updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Message email update error:', error);
    const status = /not found/i.test(error.message || '') ? 404 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Error updating email message'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await messageEmailService.excluir(req.params.id);
    res.json({
      success: true,
      message: 'Email message deleted successfully',
      data: deleted
    });
  } catch (error) {
    console.error('Message email delete error:', error);
    const status = /not found/i.test(error.message || '') ? 404 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Error deleting email message'
    });
  }
});

module.exports = router;
