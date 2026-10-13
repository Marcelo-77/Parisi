const { query } = require('../config/database');
const forkliftDriverService = require('./forkliftDriverService');
const messageRequestService = require('./messageRequestService');
const mailService = require('./mailService');
const emailSendLogService = require('./emailSendLogService');

const CHECK_INTERVAL_MS = 60 * 1000;
let timer = null;
let running = false;

async function ensureWaitingTimeoutColumn() {
  await query(`
    ALTER TABLE message_requests
    ADD COLUMN IF NOT EXISTS waiting_timeout_notified_at TIMESTAMP WITH TIME ZONE
  `).catch(() => {});
}

async function loadNotifyUsers(userIds) {
  if (!userIds.length) return [];
  const result = await query(
    `SELECT id, nome, email, telefone, ativo
     FROM funcionarios
     WHERE id = ANY($1::uuid[]) AND ativo = true`,
    [userIds]
  );
  return result.rows || [];
}

async function notifyUserAboutWaitingRequest(user, request, minutes) {
  const email = user.email ? String(user.email).trim() : '';
  if (!email) {
    await messageRequestService.appendHistoryLine(
      request.id,
      `Waiting timeout notify skipped for ${user.nome || user.id}: no email`
    );
    return { sent: false, skipped: true };
  }
  if (!mailService.isConfigured()) {
    await messageRequestService.appendHistoryLine(
      request.id,
      `Waiting timeout notify skipped: SMTP not configured`
    );
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  const subject = `[Message Request #${request.requestNumber}] Waiting for driver timeout`;
  const bodyText = [
    `Hello ${user.nome || 'User'},`,
    '',
    `A forklift request has been waiting for a driver for more than ${minutes} minute(s).`,
    '',
    `Request #: ${request.requestNumber}`,
    `Subject: ${request.subject || '-'}`,
    `Status: Waiting for driver for request`,
    `Requester: ${request.createdByName || '-'}`,
    '',
    'Please open Search Message Request and assign a forklift driver.',
    '',
    'Double-Y Warehouse System'
  ].join('\n');

  try {
    await mailService.sendMail({ to: email, subject, text: bodyText });
    await emailSendLogService.registrar({
      messageCode: 'MSG-REQUEST-WAITING-TIMEOUT',
      fromEmail: mailService.getFromAddress(),
      toEmail: email,
      toName: user.nome || null,
      subject,
      bodyPreview: bodyText.slice(0, 500),
      referenceType: 'MESSAGE_REQUEST',
      referenceId: request.id,
      referenceNumber: request.requestNumber != null ? Number(request.requestNumber) : null,
      sentBy: null,
      sentByName: 'System',
      sendStatus: 'SENT'
    });
    return { sent: true, to: email };
  } catch (error) {
    await emailSendLogService.registrar({
      messageCode: 'MSG-REQUEST-WAITING-TIMEOUT',
      fromEmail: mailService.getFromAddress(),
      toEmail: email,
      toName: user.nome || null,
      subject,
      bodyPreview: bodyText.slice(0, 500),
      referenceType: 'MESSAGE_REQUEST',
      referenceId: request.id,
      referenceNumber: request.requestNumber != null ? Number(request.requestNumber) : null,
      sentBy: null,
      sentByName: 'System',
      sendStatus: 'FAILED',
      errorMessage: error.message || 'Send failed'
    });
    await messageRequestService.appendHistoryLine(
      request.id,
      `Waiting timeout notify failed for ${email}: ${error.message || 'Send failed'}`
    );
    return { sent: false, failed: true, error: error.message };
  }
}

async function processWaitingDriverTimeouts() {
  if (running) return { skipped: true, reason: 'busy' };
  running = true;
  try {
    await forkliftDriverService.ensureTable();
    await ensureWaitingTimeoutColumn();
    await messageRequestService.ensureTable();

    const settings = await forkliftDriverService.getSettings();
    if (!settings.waitingTimeoutEnabled) {
      return { processed: 0, disabled: true };
    }
    const minutes = settings.waitingTimeoutMinutes;
    const notifyIds = settings.waitingTimeoutNotifyUserIds || [];
    if (!notifyIds.length) {
      return { processed: 0, noRecipients: true };
    }

    const overdue = await query(
      `
      SELECT id, request_number, subject, message_content, created_by_name, criado_em, atualizado_em
      FROM message_requests
      WHERE status = 'WAITING_FOR_DRIVER'
        AND waiting_timeout_notified_at IS NULL
        AND COALESCE(atualizado_em, criado_em) <= (CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute'))
      ORDER BY COALESCE(atualizado_em, criado_em) ASC
      LIMIT 50
    `,
      [minutes]
    );

    const users = await loadNotifyUsers(notifyIds);
    if (!users.length) {
      return { processed: 0, noActiveRecipients: true };
    }

    let processed = 0;
    for (const row of overdue.rows || []) {
      const request = {
        id: row.id,
        requestNumber: row.request_number,
        subject: row.subject,
        messageContent: row.message_content,
        createdByName: row.created_by_name
      };

      const results = [];
      for (const user of users) {
        results.push(await notifyUserAboutWaitingRequest(user, request, minutes));
      }

      await query(
        `UPDATE message_requests
         SET waiting_timeout_notified_at = CURRENT_TIMESTAMP,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id]
      );

      const notified = results.filter((r) => r.sent).map((r) => r.to).filter(Boolean);
      await messageRequestService.appendHistoryLine(
        request.id,
        notified.length
          ? `Waiting timeout alert sent after ${minutes} minute(s) to: ${notified.join(', ')}`
          : `Waiting timeout reached (${minutes} minute(s)); no notification email could be sent`
      );
      processed += 1;
    }

    return { processed, minutes, recipients: users.length };
  } finally {
    running = false;
  }
}

function startWaitingDriverTimeoutMonitor() {
  if (timer) return;
  const tick = () => {
    processWaitingDriverTimeouts().catch((err) => {
      console.error('Waiting driver timeout monitor error:', err.message || err);
    });
  };
  tick();
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('⏱️  Waiting-for-driver timeout monitor started');
}

function stopWaitingDriverTimeoutMonitor() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  processWaitingDriverTimeouts,
  startWaitingDriverTimeoutMonitor,
  stopWaitingDriverTimeoutMonitor,
  ensureWaitingTimeoutColumn
};
