const express = require('express');
const newsService = require('../services/newsService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession, isAuthenticated, ROOT_USER } = require('../middleware/auth');

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

router.get('/', async (req, res) => {
  try {
    const data = await newsService.list({
      activeOnly: req.query.activeOnly === 'true' || req.query.activeOnly === '1',
      description: req.query.description,
      createdByName: req.query.createdByName,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sector: req.query.sector
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('News list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listing news'
    });
  }
});

async function getNewsUserContext(req) {
  if (!isAuthenticated(req)) {
    return null;
  }

  if (isRootSession(req)) {
    return { userKey: ROOT_USER, isRoot: true, userSector: null };
  }

  const userId = getSessionUserId(req);
  if (!userId) return null;

  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    userKey: userId,
    isRoot: false,
    userSector: profile?.sector || null
  };
}

router.get('/unread', async (req, res) => {
  try {
    const context = await getNewsUserContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const data = await newsService.listUnreadForUser(context);
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('News unread error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading unread news'
    });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const context = await getNewsUserContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await newsService.markAsRead(req.params.id, context);
    res.json({ success: true, message: 'News marked as read.' });
  } catch (error) {
    console.error('News mark read error:', error);
    const status = error.message === 'News not found or already read.' ? 404 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Error marking news as read'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const news = await newsService.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found.' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('News get error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading news'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req);
    const body = req.body || {};

    const news = await newsService.create({
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      allSectors: body.allSectors,
      sectors: body.sectors,
      documentationIds: body.documentationIds,
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });

    res.status(201).json({ success: true, data: news });
  } catch (error) {
    console.error('News create error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error saving news'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const news = await newsService.update(req.params.id, {
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      allSectors: body.allSectors,
      sectors: body.sectors,
      documentationIds: body.documentationIds
    });
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('News update error:', error);
    const status = error.message === 'News not found.' ? 404 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Error updating news'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await newsService.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'News not found.' });
    }
    res.json({ success: true, message: 'News deleted successfully.' });
  } catch (error) {
    console.error('News delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error deleting news'
    });
  }
});

module.exports = router;
