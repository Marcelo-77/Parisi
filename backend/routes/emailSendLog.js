const express = require('express');
const emailSendLogService = require('../services/emailSendLogService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await emailSendLogService.listar({
      messageCode: req.query.messageCode,
      toEmail: req.query.toEmail,
      toName: req.query.toName,
      subject: req.query.subject,
      sendStatus: req.query.sendStatus,
      referenceType: req.query.referenceType,
      referenceNumber: req.query.referenceNumber,
      sentByName: req.query.sentByName,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Email send log list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing email send logs'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await emailSendLogService.buscarPorId(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Email send log not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Email send log get error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading email send log'
    });
  }
});

module.exports = router;
