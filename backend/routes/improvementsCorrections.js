const express = require('express');
const improvementsCorrectionsService = require('../services/improvementsCorrectionsService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession, ROOT_USER } = require('../middleware/auth');

const router = express.Router();

async function getCreatorInfo(req, body = {}) {
  if (isRootSession(req)) {
    const createdBy = body.createdBy != null ? String(body.createdBy).trim() : '';
    if (!createdBy) {
      throw new Error('Please select the user who requested this');
    }

    if (createdBy === ROOT_USER || createdBy.toLowerCase() === 'root') {
      return { createdBy: null, createdByName: 'Root' };
    }

    const user = await funcionarioServiceDB.buscarPorId(createdBy);
    if (!user) {
      throw new Error('Selected user not found');
    }

    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    return {
      createdBy,
      createdByName: profile?.nome || profile?.email || 'User'
    };
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

router.get('/', async (req, res) => {
  try {
    const data = await improvementsCorrectionsService.listar({
      requestNumber: req.query.requestNumber,
      requestType: req.query.requestType,
      applicationName: req.query.applicationName,
      situation: req.query.situation,
      requestDateFrom: req.query.requestDateFrom,
      requestDateTo: req.query.requestDateTo,
      finishDateFrom: req.query.finishDateFrom,
      finishDateTo: req.query.finishDateTo,
      description: req.query.description,
      createdByName: req.query.createdByName
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Improvements/Corrections list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing requests'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req, req.body);
    const created = await improvementsCorrectionsService.criar({
      description: req.body.description,
      requestType: req.body.requestType,
      applicationName: req.body.applicationName,
      applicationMenu: req.body.applicationMenu,
      situation: req.body.situation,
      requestDate: req.body.requestDate,
      finishDate: req.body.finishDate,
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });
    res.status(201).json({
      success: true,
      message: 'Request saved successfully',
      data: created
    });
  } catch (error) {
    console.error('Improvements/Corrections create error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving request'
    });
  }
});

module.exports = router;
