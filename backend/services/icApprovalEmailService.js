const messageEmailService = require('./messageEmailService');
const emailSendLogService = require('./emailSendLogService');
const mailService = require('./mailService');
const funcionarioServiceDB = require('./funcionarioServiceDB');
const improvementsCorrectionsService = require('./improvementsCorrectionsService');

const APPROVAL_TEMPLATE_CODE = 'APPROVAL';
const REFERENCE_TYPE = 'IMPROVEMENTS_CORRECTIONS';

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeSituation(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function formatRequestTypeLabel(type) {
  const value = String(type || '').trim().toUpperCase();
  if (value === 'IMPROVEMENT') return 'Improvements';
  if (value === 'CORRECTION') return 'Corrections';
  if (value === 'NEW_FUNCTIONALITY') return 'New Functionality';
  return type || '-';
}

function functionalityLabel(request) {
  const menu = request.applicationMenu ? String(request.applicationMenu).trim() : '';
  const app = request.applicationName ? String(request.applicationName).trim() : '';
  const label = menu || app;
  return label ? label.replace(/_/g, ' ') : '';
}

function applyTemplateText(template, request, requesterName) {
  const functionality = functionalityLabel(request);
  const replacements = {
    '{{requestNumber}}': request.requestNumber != null ? String(request.requestNumber) : '',
    '{{description}}': request.description || '',
    '{{requestType}}': formatRequestTypeLabel(request.requestType),
    '{{applicationName}}': request.applicationName || '',
    '{{applicationMenu}}': functionality,
    '{{functionality}}': functionality,
    '{{requesterName}}': requesterName || request.createdByName || '',
    '{{situation}}': 'In approval validation'
  };

  let text = String(template || '');
  Object.entries(replacements).forEach(([token, value]) => {
    text = text.split(token).join(value);
  });
  return text;
}

function buildSubject(templateSubject, request) {
  let subject = applyTemplateText(templateSubject, request, request.createdByName);
  if (String(request.requestType || '').toUpperCase() === 'CORRECTION') {
    const functionality = functionalityLabel(request);
    if (functionality && !subject.includes(functionality)) {
      subject = `${subject.trim()} - ${functionality}`;
    }
  }
  return subject.trim().substring(0, 255);
}

async function resolveRequesterEmail(request) {
  if (!request || !request.createdBy) {
    return { email: null, name: request?.createdByName || null };
  }

  const user = await funcionarioServiceDB.buscarPorId(request.createdBy);
  const profile = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  const email = profile?.email ? String(profile.email).trim().toLowerCase() : null;
  const name = profile?.nome || request.createdByName || null;
  return {
    email: isValidEmail(email) ? email : null,
    name
  };
}

async function loadApprovalTemplate() {
  const template = await messageEmailService.buscarPorCodigo(APPROVAL_TEMPLATE_CODE);
  if (!template) {
    throw new Error('APPROVAL email template was not found. Create it in Message Email with code APPROVAL.');
  }
  if (String(template.status || '').toUpperCase() !== 'ACTIVE') {
    throw new Error('APPROVAL email template is inactive.');
  }
  return template;
}

function shouldSendApprovalEmail(existing, next, sendApprovalEmail) {
  if (!sendApprovalEmail) return false;
  if (!existing || !next) return false;
  return normalizeSituation(next.situation) === 'IN_CLIENT_VALIDATION'
    && normalizeSituation(existing.situation) !== 'IN_CLIENT_VALIDATION';
}

async function buildApprovalEmailPreview(request) {
  const fromEmail = mailService.getFromAddress();
  const requester = await resolveRequesterEmail(request);
  let template = null;
  let templateError = null;

  try {
    template = await loadApprovalTemplate();
  } catch (error) {
    templateError = error.message || 'APPROVAL template unavailable';
  }

  const subjectPreview = template
    ? buildSubject(template.subject, request)
    : null;

  return {
    fromEmail,
    templateCode: APPROVAL_TEMPLATE_CODE,
    recipientName: requester.name || request.createdByName || '-',
    recipientEmail: requester.email,
    hasValidRecipientEmail: Boolean(requester.email),
    subjectPreview,
    templateAvailable: Boolean(template),
    templateError,
    functionalityName: functionalityLabel(request) || null
  };
}

async function previewForRequestId(requestId) {
  const request = await improvementsCorrectionsService.buscarPorId(requestId);
  if (!request) {
    throw new Error('Request not found');
  }
  return buildApprovalEmailPreview(request);
}

async function sendApprovalEmail(request, { sentBy = null, sentByName = 'System' } = {}) {
  const fromEmail = mailService.getFromAddress();
  const requester = await resolveRequesterEmail(request);
  let template;

  try {
    template = await loadApprovalTemplate();
  } catch (error) {
    const log = await emailSendLogService.registrar({
      messageCode: APPROVAL_TEMPLATE_CODE,
      fromEmail,
      toEmail: requester.email,
      toName: requester.name || request.createdByName,
      subject: 'Approval request',
      bodyPreview: null,
      sendStatus: 'FAILED',
      errorMessage: error.message,
      referenceType: REFERENCE_TYPE,
      referenceId: request.id,
      referenceNumber: request.requestNumber,
      sentBy,
      sentByName
    });
    return {
      sent: false,
      skipped: false,
      log,
      error: error.message
    };
  }

  const subject = buildSubject(template.subject, request);
  const body = applyTemplateText(template.body, request, requester.name || request.createdByName);
  const bodyPreview = body.length > 500 ? `${body.slice(0, 499)}…` : body;

  if (!requester.email) {
    const log = await emailSendLogService.registrar({
      messageCode: APPROVAL_TEMPLATE_CODE,
      fromEmail,
      toEmail: null,
      toName: requester.name || request.createdByName,
      subject,
      bodyPreview,
      sendStatus: 'SKIPPED',
      errorMessage: 'Requester does not have a valid email address',
      referenceType: REFERENCE_TYPE,
      referenceId: request.id,
      referenceNumber: request.requestNumber,
      sentBy,
      sentByName
    });
    return {
      sent: false,
      skipped: true,
      log,
      error: 'Requester does not have a valid email address'
    };
  }

  if (!mailService.isConfigured()) {
    const log = await emailSendLogService.registrar({
      messageCode: APPROVAL_TEMPLATE_CODE,
      fromEmail,
      toEmail: requester.email,
      toName: requester.name || request.createdByName,
      subject,
      bodyPreview,
      sendStatus: 'FAILED',
      errorMessage: 'SMTP is not configured on the server',
      referenceType: REFERENCE_TYPE,
      referenceId: request.id,
      referenceNumber: request.requestNumber,
      sentBy,
      sentByName
    });
    return {
      sent: false,
      skipped: false,
      log,
      error: 'SMTP is not configured on the server'
    };
  }

  try {
    await mailService.sendMail({
      to: requester.email,
      subject,
      text: body
    });

    const log = await emailSendLogService.registrar({
      messageCode: APPROVAL_TEMPLATE_CODE,
      fromEmail,
      toEmail: requester.email,
      toName: requester.name || request.createdByName,
      subject,
      bodyPreview,
      sendStatus: 'SENT',
      errorMessage: null,
      referenceType: REFERENCE_TYPE,
      referenceId: request.id,
      referenceNumber: request.requestNumber,
      sentBy,
      sentByName
    });

    return {
      sent: true,
      skipped: false,
      log,
      recipientEmail: requester.email,
      subject
    };
  } catch (error) {
    const log = await emailSendLogService.registrar({
      messageCode: APPROVAL_TEMPLATE_CODE,
      fromEmail,
      toEmail: requester.email,
      toName: requester.name || request.createdByName,
      subject,
      bodyPreview,
      sendStatus: 'FAILED',
      errorMessage: error.message || 'Unable to send email',
      referenceType: REFERENCE_TYPE,
      referenceId: request.id,
      referenceNumber: request.requestNumber,
      sentBy,
      sentByName
    });
    return {
      sent: false,
      skipped: false,
      log,
      error: error.message || 'Unable to send email'
    };
  }
}

module.exports = {
  APPROVAL_TEMPLATE_CODE,
  REFERENCE_TYPE,
  shouldSendApprovalEmail,
  buildApprovalEmailPreview,
  previewForRequestId,
  sendApprovalEmail
};
