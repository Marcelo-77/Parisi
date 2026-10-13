const mailService = require('./mailService');
const smsService = require('./smsService');
const emailSendLogService = require('./emailSendLogService');
const funcionarioServiceDB = require('./funcionarioServiceDB');
const messageRequestService = require('./messageRequestService');

async function resolveRequesterEmail(request) {
  if (!request) return null;
  if (request.createdBy) {
    try {
      const user = await funcionarioServiceDB.buscarPorId(request.createdBy);
      const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
      const email = profile?.email ? String(profile.email).trim() : '';
      if (email) {
        return {
          email,
          name: profile?.nome || request.createdByName || 'Requester'
        };
      }
    } catch (_) {
      /* fall through */
    }
  }
  return null;
}

async function notifyRequester(request, {
  event,
  actorName,
  subject,
  bodyText
}) {
  const to = await resolveRequesterEmail(request);
  const fromEmail = mailService.getFromAddress();
  const payload = {
    messageCode: 'MSG-REQUEST',
    fromEmail,
    toEmail: to?.email || null,
    toName: to?.name || request.createdByName || null,
    subject,
    bodyPreview: String(bodyText || '').slice(0, 500),
    referenceType: 'MESSAGE_REQUEST',
    referenceId: request.id,
    referenceNumber: request.requestNumber != null ? Number(request.requestNumber) : null,
    sentBy: null,
    sentByName: actorName || 'System'
  };

  if (!to?.email) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'Requester email not found'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Requester notification skipped (${event}): no requester email`
    );
    return { sent: false, skipped: true, reason: 'no_requester_email' };
  }

  if (!mailService.isConfigured()) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'SMTP not configured'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Requester notification skipped (${event}): SMTP not configured`
    );
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  try {
    await mailService.sendMail({
      to: to.email,
      subject,
      text: bodyText
    });
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SENT'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Requester notified by email (${event}) to ${to.email}`
    );
    return { sent: true, skipped: false, to: to.email };
  } catch (error) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'FAILED',
      errorMessage: error.message || 'Send failed'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Requester notification failed (${event}): ${error.message || 'Send failed'}`
    );
    return { sent: false, skipped: false, failed: true, error: error.message };
  }
}

async function sendOutboundMessage(request, {
  actorName,
  subject,
  content
}) {
  const toEmail = String(request.recipientEmail || '').trim();
  const toName = String(request.recipientName || '').trim() || null;
  const fromEmail = mailService.getFromAddress();
  const finalSubject = String(subject || request.finalSubject || request.subject || '').trim();
  const finalContent = String(content || request.finalContent || request.messageContent || '').trim();

  const payload = {
    messageCode: 'MSG-REQUEST-OUTBOUND',
    fromEmail,
    toEmail: toEmail || null,
    toName,
    subject: finalSubject,
    bodyPreview: finalContent.slice(0, 500),
    referenceType: 'MESSAGE_REQUEST',
    referenceId: request.id,
    referenceNumber: request.requestNumber != null ? Number(request.requestNumber) : null,
    sentBy: null,
    sentByName: actorName || 'Operator'
  };

  const messageType = String(request.messageType || '').toUpperCase();
  if (messageType === 'INTERNAL') {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'Internal message recorded (no outbound email)'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Internal message recorded by ${actorName} (no outbound email)`
    );
    return { sent: false, skipped: true, reason: 'internal' };
  }

  if (messageType === 'WHATSAPP') {
    const phone = String(request.recipientPhone || '').trim() || 'n/a';
    await emailSendLogService.registrar({
      ...payload,
      toEmail: phone,
      sendStatus: 'SKIPPED',
      errorMessage: 'WHATSAPP recorded for manual send (integration not configured)'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `WHATSAPP marked complete by ${actorName} for phone ${phone} (manual send; no gateway yet)`
    );
    return { sent: false, skipped: true, reason: 'whatsapp', phone };
  }

  if (messageType === 'SMS') {
    const phone = String(request.recipientPhone || '').trim();
    const smsBody = [finalSubject, finalContent].filter(Boolean).join('\n\n').trim() || finalContent;

    payload.messageCode = 'MSG-REQUEST-SMS';
    payload.toEmail = phone || null;
    payload.bodyPreview = String(smsBody || '').slice(0, 500);

    if (!phone) {
      await emailSendLogService.registrar({
        ...payload,
        sendStatus: 'FAILED',
        errorMessage: 'Recipient phone is required'
      });
      throw new Error('Recipient phone is required to send SMS');
    }

    if (!smsService.isConfigured()) {
      await emailSendLogService.registrar({
        ...payload,
        sendStatus: 'SKIPPED',
        errorMessage: 'SMS gateway not configured'
      });
      throw new Error('SMS is not configured. Set SMS_PROVIDER, SMS_API_USER, SMS_API_PASS and SMS_SENDER.');
    }

    try {
      const result = await smsService.sendSms({
        to: phone,
        message: smsBody,
        customRef: `message-request-${request.requestNumber || request.id}`
      });
      await emailSendLogService.registrar({
        ...payload,
        toEmail: result.to,
        sendStatus: 'SENT'
      });
      await messageRequestService.appendHistoryLine(
        request.id,
        `Outbound SMS sent to ${result.to} by ${actorName} (sender ${result.sender})`
      );
      return { sent: true, to: result.to, provider: result.provider, messageId: result.messageId };
    } catch (error) {
      await emailSendLogService.registrar({
        ...payload,
        sendStatus: 'FAILED',
        errorMessage: error.message || 'SMS send failed'
      });
      await messageRequestService.appendHistoryLine(
        request.id,
        `Outbound SMS failed by ${actorName}: ${error.message || 'Send failed'}`
      );
      throw error;
    }
  }

  if (messageType !== 'EMAIL') {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: `Outbound channel ${request.messageType} not implemented yet`
    });
    throw new Error(`Sending via ${request.messageType} is not available yet. Use Email.`);
  }

  if (!toEmail) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'FAILED',
      errorMessage: 'Recipient email is required'
    });
    throw new Error('Recipient email is required to send');
  }

  if (!mailService.isConfigured()) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'SMTP not configured'
    });
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS.');
  }

  try {
    await mailService.sendMail({
      to: toEmail,
      subject: finalSubject,
      text: finalContent
    });
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SENT'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Outbound email sent to ${toEmail} by ${actorName}`
    );
    return { sent: true, to: toEmail };
  } catch (error) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'FAILED',
      errorMessage: error.message || 'Send failed'
    });
    throw error;
  }
}

async function resolveAssigneeEmail(request) {
  if (!request?.assignedTo) return null;
  try {
    const user = await funcionarioServiceDB.buscarPorId(request.assignedTo);
    const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const email = profile?.email ? String(profile.email).trim() : '';
    if (!email) return null;
    return {
      email,
      name: profile?.nome || request.assignedToName || 'Operator'
    };
  } catch (_) {
    return null;
  }
}

async function notifyAssignee(request, {
  event,
  actorName,
  subject,
  bodyText
}) {
  const to = await resolveAssigneeEmail(request);
  const fromEmail = mailService.getFromAddress();
  const payload = {
    messageCode: 'MSG-REQUEST',
    fromEmail,
    toEmail: to?.email || null,
    toName: to?.name || request.assignedToName || null,
    subject,
    bodyPreview: String(bodyText || '').slice(0, 500),
    referenceType: 'MESSAGE_REQUEST',
    referenceId: request.id,
    referenceNumber: request.requestNumber != null ? Number(request.requestNumber) : null,
    sentBy: null,
    sentByName: actorName || 'System'
  };

  if (!to?.email) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'Assignee email not found'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Assignee notification skipped (${event}): no assignee email`
    );
    return { sent: false, skipped: true, reason: 'no_assignee_email' };
  }

  if (!mailService.isConfigured()) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SKIPPED',
      errorMessage: 'SMTP not configured'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Assignee notification skipped (${event}): SMTP not configured`
    );
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  try {
    await mailService.sendMail({
      to: to.email,
      subject,
      text: bodyText
    });
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'SENT'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Assignee notified (${event}) at ${to.email}`
    );
    return { sent: true, to: to.email };
  } catch (error) {
    await emailSendLogService.registrar({
      ...payload,
      sendStatus: 'FAILED',
      errorMessage: error.message || 'Send failed'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Assignee notification failed (${event}): ${error.message || 'Send failed'}`
    );
    return { sent: false, skipped: false, failed: true, error: error.message };
  }
}

function buildStatusEmail(request, title, detail) {
  const number = request.requestNumber != null ? `#${request.requestNumber}` : '';
  return {
    subject: `[Message Request ${number}] ${title}`,
    bodyText: [
      `Hello ${request.createdByName || 'Requester'},`,
      '',
      detail,
      '',
      `Request #: ${request.requestNumber || '-'}`,
      `Subject: ${request.subject || '-'}`,
      `Status: ${messageRequestService.formatStatusLabel(request.status)}`,
      `Priority: ${messageRequestService.formatPriorityLabel(request.priority)}`,
      request.assignedToName ? `Assigned to: ${request.assignedToName}` : null,
      request.rejectionReason ? `Reason: ${request.rejectionReason}` : null,
      '',
      'Double-Y Warehouse System'
    ].filter((line) => line != null).join('\n')
  };
}

module.exports = {
  notifyRequester,
  notifyAssignee,
  sendOutboundMessage,
  buildStatusEmail
};
