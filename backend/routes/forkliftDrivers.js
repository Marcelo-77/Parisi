const express = require('express');
const forkliftDriverService = require('../services/forkliftDriverService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession } = require('../middleware/auth');

const router = express.Router();

async function getActor(req) {
  if (isRootSession(req)) {
    return { assignedBy: null, assignedByName: 'Root' };
  }
  const userId = getSessionUserId(req);
  if (!userId) return { assignedBy: null, assignedByName: 'Unknown' };
  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    assignedBy: userId,
    assignedByName: profile?.nome || profile?.email || 'User'
  };
}

router.get('/', async (req, res) => {
  try {
    const data = await forkliftDriverService.listAssignments();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Forklift drivers list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error loading forklift drivers' });
  }
});

router.get('/assigned', async (req, res) => {
  try {
    const result = await forkliftDriverService.listAssignedUsers();
    const userId = getSessionUserId(req);
    const isDriver = isRootSession(req)
      ? true
      : await forkliftDriverService.isAssignedDriver(userId);
    res.json({
      success: true,
      data: result.users,
      preferredMessageType: result.preferredMessageType,
      allowReassignToOtherDriver: !!result.allowReassignToOtherDriver,
      isForkliftDriver: isDriver,
      total: result.users.length
    });
  } catch (error) {
    console.error('Forklift drivers assigned list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error loading assigned forklift drivers' });
  }
});

router.put('/', async (req, res) => {
  try {
    const actor = await getActor(req);
    const assignedIds = req.body?.assignedIds || req.body?.assigned || [];
    const preferredMessageType = req.body?.preferredMessageType;
    const allowReassignToOtherDriver = req.body?.allowReassignToOtherDriver;
    const waitingTimeoutEnabled = req.body?.waitingTimeoutEnabled;
    const waitingTimeoutMinutes = req.body?.waitingTimeoutMinutes;
    const waitingTimeoutNotifyUserIds = req.body?.waitingTimeoutNotifyUserIds;
    const dailyInactiveEnabled = req.body?.dailyInactiveEnabled;
    const dailyInactiveTime = req.body?.dailyInactiveTime;
    const notifyRequesterOnComplete = req.body?.notifyRequesterOnComplete;
    const data = await forkliftDriverService.saveAssignments(
      assignedIds,
      actor,
      {
        preferredMessageType,
        allowReassignToOtherDriver,
        waitingTimeoutEnabled,
        waitingTimeoutMinutes,
        waitingTimeoutNotifyUserIds,
        dailyInactiveEnabled,
        dailyInactiveTime,
        notifyRequesterOnComplete
      }
    );
    res.json({
      success: true,
      message: 'Forklift driver settings saved',
      data
    });
  } catch (error) {
    console.error('Forklift drivers save error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error saving forklift drivers' });
  }
});

module.exports = router;
