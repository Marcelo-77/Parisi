const express = require('express');
const messageRequestService = require('../services/messageRequestService');
const messageRequestNotifyService = require('../services/messageRequestNotifyService');
const funcionarioServiceDB = require('../services/funcionarioServiceDB');
const forkliftDriverService = require('../services/forkliftDriverService');
const smsService = require('../services/smsService');
const mailService = require('../services/mailService');
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
  try {
    const nextRequestNumber = await messageRequestService.peekNextRequestNumber();
    res.json({
      success: true,
      data: {
        messageTypes: messageRequestService.MESSAGE_TYPES,
        priorities: messageRequestService.PRIORITIES,
        statuses: messageRequestService.STATUSES,
        nextRequestNumber
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Error loading meta' });
  }
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
      recipientEmail: req.query.recipientEmail,
      activeOnly: true
    });
    res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Message request list error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error listing message requests' });
  }
});

router.post('/forklift', async (req, res) => {
  try {
    const creator = await getCreatorInfo(req, req.body);
    const driverNotDefined = req.body.driverNotDefined === true
      || String(req.body.assignedTo || '').trim() === '__NOT_DEFINED__';

    let assignedTo = req.body.assignedTo || null;
    let assignedToName = req.body.assignedToName || null;
    let recipientEmail = req.body.recipientEmail || null;
    let recipientPhone = req.body.recipientPhone || null;
    let recipientName = req.body.recipientName || assignedToName || null;

    const messageType = String(req.body.messageType || 'SMS').trim().toUpperCase();
    if (messageType !== 'SMS' && messageType !== 'EMAIL') {
      return res.status(400).json({ success: false, error: 'Request type must be SMS or Email' });
    }

    const subject = String(req.body.subject || 'Lower the pallet').trim() || 'Lower the pallet';
    const messageContent = String(req.body.messageContent || '').trim();
    if (!messageContent) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const priorityRaw = String(req.body.priority || 'NORMAL').trim().toUpperCase();
    const allowedPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    const priority = allowedPriorities.includes(priorityRaw) ? priorityRaw : 'NORMAL';

    if (driverNotDefined) {
      const created = await messageRequestService.criar({
        messageType,
        priority,
        subject,
        messageContent,
        recipientName: null,
        recipientEmail: null,
        recipientPhone: null,
        assignedTo: null,
        assignedToName: 'Driver not defined',
        attachmentNote: 'Forklift driver request from Location Product (waiting for driver)',
        initialStatus: 'WAITING_FOR_DRIVER',
        createdBy: creator.createdBy,
        createdByName: creator.createdByName
      });

      return res.status(201).json({
        success: true,
        message: 'Forklift request created — Waiting for driver for request',
        data: created,
        waitingForDriver: true
      });
    }

    if (!assignedTo) {
      return res.status(400).json({ success: false, error: 'Forklift driver is required' });
    }

    const user = await funcionarioServiceDB.buscarPorId(assignedTo);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Forklift driver not found' });
    }
    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    assignedToName = assignedToName || profile?.nome || profile?.email || 'Forklift driver';
    recipientName = recipientName || profile?.nome || assignedToName;
    if (!recipientEmail && profile?.email) recipientEmail = profile.email;
    if (!recipientPhone && profile?.telefone) recipientPhone = profile.telefone;

    if (messageType === 'EMAIL' && !recipientEmail) {
      return res.status(400).json({ success: false, error: 'Selected driver has no email registered' });
    }
    if (messageType === 'SMS' && !recipientPhone) {
      return res.status(400).json({ success: false, error: 'Selected driver has no phone registered' });
    }

    if (messageType === 'SMS' && !smsService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'SMS is not configured on Approval. Set SMS_PROVIDER, SMS_API_USER, SMS_API_PASS and SMS_SENDER.'
      });
    }
    if (messageType === 'EMAIL' && !mailService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Email is not configured on Approval. Set RESEND_API_KEY (or BREVO_API_KEY), or switch Send request by to SMS.'
      });
    }

    const created = await messageRequestService.criar({
      messageType,
      priority,
      subject,
      messageContent,
      recipientName,
      recipientEmail,
      recipientPhone,
      assignedTo,
      assignedToName,
      attachmentNote: 'Forklift driver request from Location Product',
      initialStatus: 'FORKLIFT_DRIVER_SELECTED',
      createdBy: creator.createdBy,
      createdByName: creator.createdByName
    });

    const actorName = creator.createdByName || 'User';

    // Respond immediately so Approval/Render does not time out while SMS/Email is sending.
    res.status(201).json({
      success: true,
      message: 'Forklift driver request created; notification is being sent',
      data: created,
      sendPending: true,
      waitingForDriver: false
    });

    setImmediate(() => {
      messageRequestNotifyService.sendOutboundMessage(created, {
        actorName,
        subject,
        content: messageContent
      }).then(async () => {
        await messageRequestService.appendHistoryLine(
          created.id,
          `Forklift driver notified by ${messageType} (${actorName})`
        );
      }).catch(async (sendError) => {
        console.error('Forklift background notify error:', sendError);
        try {
          await messageRequestService.appendHistoryLine(
            created.id,
            `Forklift notification failed: ${sendError.message || 'Send failed'}`
          );
        } catch (historyError) {
          console.error('Forklift history update error:', historyError);
        }
      });
    });
    return;
  } catch (error) {
    console.error('Forklift request create error:', error);
    if (!res.headersSent) {
      res.status(400).json({ success: false, error: error.message || 'Error creating forklift request' });
    }
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

    let notify = null;
    const createdType = String(created.messageType || '').toUpperCase();
    // Internal alert by email only for email/internal requests.
    // SMS/WhatsApp requests must not look like an outbound email send.
    if (createdType === 'EMAIL' || createdType === 'INTERNAL') {
      const mail = messageRequestNotifyService.buildStatusEmail(
        created,
        'Assigned to you',
        'A new message request was assigned to you.'
      );
      notify = await messageRequestNotifyService.notifyAssignee(created, {
        event: 'assigned',
        actorName: creator.createdByName,
        subject: mail.subject,
        bodyText: mail.bodyText.replace(
          `Hello ${created.createdByName || 'Requester'},`,
          `Hello ${created.assignedToName || 'Operator'},`
        )
      });
    } else {
      await messageRequestService.appendHistoryLine(
        created.id,
        `Assignee email notification skipped for ${createdType} request (use Search to process/send)`
      );
    }

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

router.post('/:id/forklift-assign', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const existing = await messageRequestService.buscarPorId(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Message request not found' });
    }

    if (String(existing.status || '').toUpperCase() !== 'WAITING_FOR_DRIVER') {
      return res.status(400).json({
        success: false,
        error: 'Request is not in Waiting for driver for request status'
      });
    }

    const userId = getSessionUserId(req);
    const isRoot = isRootSession(req);
    if (!isRoot) {
      const isDriver = await forkliftDriverService.isAssignedDriver(userId);
      if (!isDriver) {
        return res.status(403).json({
          success: false,
          error: 'Only registered forklift drivers can assign this request'
        });
      }
    }

    let assignedTo = req.body.assignedTo || userId || null;
    if (!assignedTo) {
      return res.status(400).json({ success: false, error: 'Forklift driver is required' });
    }

    const settings = await forkliftDriverService.getSettings();
    if (!isRoot && !settings.allowReassignToOtherDriver && String(assignedTo) !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Reassign to another driver is disabled. You can only assign yourself.'
      });
    }

    if (!isRoot) {
      const isTargetDriver = await forkliftDriverService.isAssignedDriver(assignedTo);
      if (!isTargetDriver) {
        return res.status(400).json({
          success: false,
          error: 'Selected user is not a registered forklift driver'
        });
      }
    }

    const user = await funcionarioServiceDB.buscarPorId(assignedTo);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Forklift driver not found' });
    }
    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const assignedToName = profile?.nome || profile?.email || 'Forklift driver';
    const recipientEmail = profile?.email || null;
    const recipientPhone = profile?.telefone || null;
    const messageType = String(existing.messageType || 'SMS').trim().toUpperCase();

    if (messageType === 'EMAIL' && !recipientEmail) {
      return res.status(400).json({ success: false, error: 'Selected driver has no email registered' });
    }
    if (messageType === 'SMS' && !recipientPhone) {
      return res.status(400).json({ success: false, error: 'Selected driver has no phone registered' });
    }

    const updated = await messageRequestService.assignForkliftDriver(req.params.id, actorName, {
      assignedTo,
      assignedToName,
      recipientName: assignedToName,
      recipientEmail,
      recipientPhone
    });

    let sendResult = null;
    try {
      sendResult = await messageRequestNotifyService.sendOutboundMessage(updated, {
        actorName,
        subject: updated.finalSubject || updated.subject,
        content: updated.finalContent || updated.messageContent
      });
      await messageRequestService.appendHistoryLine(
        updated.id,
        `Forklift driver notified by ${messageType} (${actorName})`
      );
    } catch (sendError) {
      await messageRequestService.appendHistoryLine(
        updated.id,
        `Forklift notification failed: ${sendError.message || 'Send failed'}`
      );
      const refreshed = await messageRequestService.buscarPorId(updated.id);
      return res.status(400).json({
        success: false,
        error: sendError.message || 'Driver assigned but message send failed',
        data: refreshed
      });
    }

    const driverName = updated.assignedToName || assignedToName || 'the forklift driver';
    const requestNo = updated.requestNumber != null ? updated.requestNumber : '—';
    const acceptedAt = new Date();
    const acceptedAtLabel = acceptedAt.toLocaleString('en-AU', {
      timeZone: process.env.APP_TIMEZONE || 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const requesterMail = messageRequestNotifyService.buildStatusEmail(
      updated,
      'Forklift driver selected',
      [
        `Your request #${requestNo} is now being handled by forklift driver ${driverName}.`,
        '',
        `Accepted on: ${acceptedAtLabel}`,
        'Status: Forklift driver request selected'
      ].join('\n')
    );
    const requesterNotify = await messageRequestNotifyService.notifyRequester(updated, {
      event: 'forklift_driver_selected',
      actorName,
      subject: requesterMail.subject,
      bodyText: requesterMail.bodyText
    });

    const refreshed = await messageRequestService.buscarPorId(updated.id);
    res.json({
      success: true,
      message: 'Driver assigned — Forklift driver request selected',
      data: refreshed,
      send: sendResult,
      requesterNotify
    });
  } catch (error) {
    console.error('Forklift assign error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error assigning forklift driver' });
  }
});

async function notifyRequesterDriverSelected(updated, actorName, driverName) {
  const requestNo = updated.requestNumber != null ? updated.requestNumber : '—';
  const acceptedAtLabel = new Date().toLocaleString('en-AU', {
    timeZone: process.env.APP_TIMEZONE || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const requesterMail = messageRequestNotifyService.buildStatusEmail(
    updated,
    'Forklift driver selected',
    [
      `Your request #${requestNo} is now being handled by forklift driver ${driverName}.`,
      '',
      `Accepted on: ${acceptedAtLabel}`,
      'Status: Forklift driver request selected'
    ].join('\n')
  );
  return messageRequestNotifyService.notifyRequester(updated, {
    event: 'forklift_driver_selected',
    actorName,
    subject: requesterMail.subject,
    bodyText: requesterMail.bodyText
  });
}

router.post('/:id/forklift-request', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const existing = await messageRequestService.buscarPorId(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Message request not found' });
    }
    if (String(existing.status || '').toUpperCase() !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Only Pending requests can request Waiting for driver or Forklift driver selected'
      });
    }

    const mode = String(req.body.mode || req.body.status || '').trim().toUpperCase();
    if (mode !== 'WAITING_FOR_DRIVER' && mode !== 'FORKLIFT_DRIVER_SELECTED') {
      return res.status(400).json({
        success: false,
        error: 'Select Waiting for driver for request or Forklift driver request selected'
      });
    }

    if (mode === 'WAITING_FOR_DRIVER') {
      const updated = await messageRequestService.setWaitingForDriver(req.params.id, actorName);
      return res.json({
        success: true,
        message: 'Request set to Waiting for driver for request',
        data: updated
      });
    }

    const assignedTo = req.body.assignedTo || null;
    if (!assignedTo) {
      return res.status(400).json({ success: false, error: 'Forklift driver is required' });
    }

    const isTargetDriver = await forkliftDriverService.isAssignedDriver(assignedTo);
    if (!isTargetDriver && !isRootSession(req)) {
      return res.status(400).json({
        success: false,
        error: 'Selected user is not a registered forklift driver'
      });
    }

    const user = await funcionarioServiceDB.buscarPorId(assignedTo);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Forklift driver not found' });
    }
    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const assignedToName = profile?.nome || profile?.email || 'Forklift driver';
    const recipientEmail = profile?.email || null;
    const recipientPhone = profile?.telefone || null;

    const settings = await forkliftDriverService.getSettings();
    const messageType = String(
      settings.preferredMessageType || existing.messageType || 'SMS'
    ).trim().toUpperCase();

    if (messageType === 'EMAIL' && !recipientEmail) {
      return res.status(400).json({ success: false, error: 'Selected driver has no email registered' });
    }
    if (messageType === 'SMS' && !recipientPhone) {
      return res.status(400).json({ success: false, error: 'Selected driver has no phone registered' });
    }

    // Align request channel with Settings preferred type when requesting selected driver.
    const updated = await messageRequestService.assignForkliftDriver(req.params.id, actorName, {
      assignedTo,
      assignedToName,
      recipientName: assignedToName,
      recipientEmail,
      recipientPhone,
      messageType,
      fromStatuses: ['PENDING']
    });

    let sendResult = null;
    try {
      sendResult = await messageRequestNotifyService.sendOutboundMessage(updated, {
        actorName,
        subject: updated.finalSubject || updated.subject,
        content: updated.finalContent || updated.messageContent
      });
      await messageRequestService.appendHistoryLine(
        updated.id,
        `Forklift driver notified by ${messageType} (${actorName})`
      );
    } catch (sendError) {
      await messageRequestService.appendHistoryLine(
        updated.id,
        `Forklift notification failed: ${sendError.message || 'Send failed'}`
      );
      const refreshed = await messageRequestService.buscarPorId(updated.id);
      return res.status(400).json({
        success: false,
        error: sendError.message || 'Driver selected but message send failed',
        data: refreshed
      });
    }

    const requesterNotify = await notifyRequesterDriverSelected(
      updated,
      actorName,
      updated.assignedToName || assignedToName
    );
    const refreshed = await messageRequestService.buscarPorId(updated.id);
    res.json({
      success: true,
      message: 'Request set to Forklift driver request selected',
      data: refreshed,
      send: sendResult,
      requesterNotify
    });
  } catch (error) {
    console.error('Forklift request from Pending error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error requesting forklift driver status'
    });
  }
});

router.post('/:id/forklift-response', async (req, res) => {
  try {
    const actorName = await getActorName(req);
    const existing = await messageRequestService.buscarPorId(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Message request not found' });
    }

    const userId = getSessionUserId(req);
    const isRoot = isRootSession(req);
    const assignedTo = existing.assignedTo != null ? String(existing.assignedTo) : '';
    if (!isRoot && (!userId || String(userId) !== assignedTo)) {
      return res.status(403).json({
        success: false,
        error: 'Only the assigned forklift operator can update this request'
      });
    }

    if (String(existing.status || '').toUpperCase() !== 'FORKLIFT_DRIVER_SELECTED') {
      return res.status(400).json({
        success: false,
        error: 'Request is not in Forklift driver request selected status'
      });
    }

    const nextStatus = String(req.body.status || '').trim().toUpperCase();
    const noteToRequester = String(req.body.noteToRequester || '').trim();

    const updated = await messageRequestService.respondForkliftDriver(req.params.id, actorName, {
      status: nextStatus,
      noteToRequester
    });

    let notify = null;
    if (nextStatus === 'PENDING') {
      const mail = messageRequestNotifyService.buildStatusEmail(
        updated,
        'Pending - operator update',
        [
          'The forklift operator updated your request to Pending.',
          '',
          'Message from operator:',
          noteToRequester
        ].join('\n')
      );
      notify = await messageRequestNotifyService.notifyRequester(updated, {
        event: 'forklift_pending',
        actorName,
        subject: mail.subject,
        bodyText: mail.bodyText
      });
    } else if (nextStatus === 'CANCELLED') {
      const mail = messageRequestNotifyService.buildStatusEmail(
        updated,
        'Cancelled by forklift operator',
        [
          'The forklift operator cancelled your request.',
          '',
          'Message from operator:',
          noteToRequester
        ].join('\n')
      );
      notify = await messageRequestNotifyService.notifyRequester(updated, {
        event: 'forklift_cancelled',
        actorName,
        subject: mail.subject,
        bodyText: mail.bodyText
      });
    } else if (nextStatus === 'COMPLETED') {
      const settings = await forkliftDriverService.getSettings();
      if (settings.notifyRequesterOnComplete) {
        const mail = messageRequestNotifyService.buildStatusEmail(
          updated,
          'Completed by forklift operator',
          'The forklift operator marked your request as Completed.'
            + (noteToRequester ? `\n\nNote from operator:\n${noteToRequester}` : '')
        );
        notify = await messageRequestNotifyService.notifyRequester(updated, {
          event: 'forklift_completed',
          actorName,
          subject: mail.subject,
          bodyText: mail.bodyText
        });
      }
    }

    const messageByStatus = {
      PENDING: 'Request set to Pending and requester notified',
      CANCELLED: 'Request set to Cancelled and requester notified',
      COMPLETED: notify
        ? 'Request set to Completed and requester notified'
        : 'Request set to Completed'
    };

    res.json({
      success: true,
      message: messageByStatus[nextStatus] || 'Request updated',
      data: updated,
      notify
    });
  } catch (error) {
    console.error('Forklift response error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error updating forklift request' });
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

    let notify = null;
    const completedType = String(completed.messageType || '').toUpperCase();
    // Requester completion alert stays email-based for EMAIL/INTERNAL only.
    if (completedType === 'EMAIL' || completedType === 'INTERNAL') {
      const mail = messageRequestNotifyService.buildStatusEmail(
        completed,
        'Completed',
        'Your message request was processed and the message was sent.'
      );
      notify = await messageRequestNotifyService.notifyRequester(completed, {
        event: 'completed',
        actorName,
        subject: mail.subject,
        bodyText: mail.bodyText
      });
    }

    const channelLabel = completedType === 'SMS'
      ? 'SMS'
      : (completedType === 'WHATSAPP' ? 'WhatsApp' : 'Message');

    res.json({
      success: true,
      message: `${channelLabel} sent and request completed`,
      data: completed,
      notify
    });
  } catch (error) {
    console.error('Message request send error:', error);
    res.status(400).json({ success: false, error: error.message || 'Error sending message' });
  }
});

module.exports = router;
