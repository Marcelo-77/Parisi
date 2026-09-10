const express = require('express');
const messageRequestService = require('../services/messageRequestService');
const messageRequestNotifyService = require('../services/messageRequestNotifyService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const { getSessionUserId, isRootSession, ROOT_USER } = require('../middleware/auth');

const router = express.Router();

async function getActorName(req) {
  if (isRootSession(req)) return 'Root';
  const userId = getSessionUserId(req);
  if (!userId) return 'Unknown';
  const user = await funcionarioServiceDB.buscarPorId(userId);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  return profile?.nome || profile?.email || 'User';
}

async function getCreatorInfo(req, body = {}) {
  if (isRootSession(req)) {
    const createdBy = body.createdBy != null ? String(body.createdBy).trim() : '';
    if (!createdBy) {
      return { createdBy: null, createdByName: 'Root' };
    }
    if (createdBy === ROOT_USER || createdBy.toLowerCase() === 'root') {
      return { createdBy: null, createdByName: 'Root' };
    }
    const user = await funcionarioServiceDB.buscarPorId(createdBy);
    if (!user) throw new Error('Selected user not found');
    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    return {
      createdBy,
      createdByName: profile?.nome || profile?.email || 'User'
    };
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

router.get('/meta', async (req, res) => {
  res.json({
    success: true,
    data: {
      messageTypes: messageRequestService.MESSAGE_TYPES,
      priorities: messageRequestService.PRIORITIES,
      statuses: messageRequestService.STATUSES
    }
  });
});

router.get('/', async (req, res) => {
  try {
    const data = await messageRequestService.listar({
      requestNumber: req.query.requestNumber,
      status: req.query.status,
      messageType: req.query.messageType,
      priority: req.query.priority,
      subject: req.query.subject,
      createdByName: req.query.createdByName,
      assignedToName: req.query.assignedToName,
      recipientEmail: req.query.recipientEmail
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Message request list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error listing message requests' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await messageRequestService.buscarPorId(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Message request not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Error loading message request' });
  }
});

router.post('/', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req, req.body);
    let assignedTo = req.body.assignedTo || null;
    let assignedToName = req.body.assignedToName || null;

    if (assignedTo && !assignedToName) {
      const user = await funcionarioServiceDB.buscarPorId(assignedTo);
      const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
      assignedToName = profile?.nome || profile?.email || 'Operator';
    }

    const created = await messageRequestService.criar({
      ...req.body,
      assignedTo,
      assignedToName,
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });

    const mail = messageRequestNotifyService.buildStatusEmail(
      created,
      'Assigned to you',
      'A new message request was assigned to you.'
    );
    const notify = await messageRequestNotifyService.notifyAssignee(created, {
      event: 'assigned',
      actorName: creator.createdByName,
      subject: mail.subject,
      bodyText: mail.bodyText.replace(
        `Hello ${created.createdByName || 'Requester'},`,
        `Hello ${created.assignedToName || 'Operator'},`
      )
    });

    res.status(201).json({
      success: true,
      message: 'Message request created and assigned',
      data: created,
      notify
    });
  } catch (error) {
    console.error('Message request create error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error creating message request' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const updated = await messageRequestService.atualizar(req.params.id, req.body, actorName);
    res.json({ success: true, message: 'Message request updated', data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Error updating message request' });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    let assignedTo = req.body.assignedTo || null;
    let assignedToName = req.body.assignedToName || null;

    if (assignedTo && !assignedToName) {
      const user = await funcionarioServiceDB.buscarPorId(assignedTo);
      const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
      assignedToName = profile?.nome || profile?.email || 'Operator';
    }

    const updated = await messageRequestService.approveAndAssign(req.params.id, actorName, {
      assignedTo,
      assignedToName
    });

    const mail = messageRequestNotifyService.buildStatusEmail(
      updated,
      'Approved and assigned',
      'Your message request was approved and assigned to an operator.'
    );
    const notify = await messageRequestNotifyService.notifyRequester(updated, {
      event: 'approve',
      actorName,
      subject: mail.subject,
      bodyText: mail.bodyText
    });

    res.json({ success: true, message: 'Request approved and assigned', data: updated, notify });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Error approving request' });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const updated = await messageRequestService.reject(
      req.params.id,
      actorName,
      req.body.rejectionReason
    );
    const mail = messageRequestNotifyService.buildStatusEmail(
      updated,
      'Rejected',
      'Your message request was rejected.'
    );
    const notify = await messageRequestNotifyService.notifyRequester(updated, {
      event: 'reject',
      actorName,
      subject: mail.subject,
      bodyText: mail.bodyText
    });
    res.json({ success: true, message: 'Request rejected', data: updated, notify });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Error rejecting request' });
  }
});

router.post('/:id/hold', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const updated = await messageRequestService.putOnHold(req.params.id, actorName, req.body.note);
    res.json({ success: true, message: 'Request put On Hold', data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Error putting request on hold' });
  }
});

router.post('/:id/resume', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const updated = await messageRequestService.resumeProgress(req.params.id, actorName);
    res.json({ success: true, message: 'Request resumed', data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Error resuming request' });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const existing = await messageRequestService.buscarPorId(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Message request not found' });

    const finalSubject = req.body.finalSubject != null ? req.body.finalSubject : existing.finalSubject;
    const finalContent = req.body.finalContent != null ? req.body.finalContent : existing.finalContent;

    await messageRequestNotifyService.sendOutboundMessage(existing, {
      actorName,
      subject: finalSubject,
      content: finalContent
    });

    const completed = await messageRequestService.markCompleted(req.params.id, actorName, {
      finalSubject,
      finalContent
    });

    const mail = messageRequestNotifyService.buildStatusEmail(
      completed,
      'Completed',
      'Your message request was processed and the message was sent.'
    );
    const notify = await messageRequestNotifyService.notifyRequester(completed, {
      event: 'completed',
      actorName,
      subject: mail.subject,
      bodyText: mail.bodyText
    });

    res.json({
      success: true,
      message: 'Message sent and request completed',
      data: completed,
      notify
    });
  } catch (error) {
    console.error('Message request send error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error sending message' });
  }
});

module.exports = router;
