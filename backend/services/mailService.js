const dns = require('dns');
const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'doubleyitsystem@gmail.com';
const HTTP_FETCH_TIMEOUT_MS = Number(process.env.EMAIL_HTTP_TIMEOUT_MS || 15000);

let transporter = null;
let transporterKey = '';

function getFromAddress() {
  return String(
    process.env.EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || DEFAULT_FROM
  ).trim();
}

function isRenderHost() {
  return String(process.env.RENDER || '').toLowerCase() === 'true'
    || Boolean(String(process.env.RENDER_SERVICE_ID || '').trim())
    || String(process.env.NODE_ENV || '').toLowerCase() === 'approval';
}

function hasResend() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function hasBrevo() {
  return Boolean(String(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim());
}

function isHttpConfigured() {
  return hasResend() || hasBrevo();
}

function isSmtpConfigured() {
  return Boolean(String(process.env.SMTP_USER || '').trim() && String(process.env.SMTP_PASS || '').trim());
}

function isConfigured() {
  return isHttpConfigured() || isSmtpConfigured();
}

function getTransportMode() {
  const mode = String(process.env.EMAIL_TRANSPORT || 'auto').trim().toLowerCase();
  if (mode === 'http' || mode === 'resend' || mode === 'brevo' || mode === 'smtp') return mode;
  // auto: prefer HTTP on Render (SMTP ports are usually blocked)
  if (isHttpConfigured()) return 'http';
  if (isRenderHost() && String(process.env.SMTP_ALLOW_ON_RENDER || '').toLowerCase() !== 'true') {
    return 'http-required';
  }
  return 'smtp';
}

function createFetchTimeoutSignal(ms = HTTP_FETCH_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Force A-record (IPv4) only — Render often has no IPv6 route (ENETUNREACH). */
function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  dns.lookup(hostname, { family: 4 }, callback);
}

function getConfiguredPortSecure() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || (!secureEnv && port === 465);
  return { port, secure };
}

function buildTransportOptions({ port, secure }) {
  const hostName = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  return {
    host: hostName,
    port: Number(port),
    secure: !!secure,
    family: 4,
    lookup: ipv4Lookup,
    name: hostName,
    tls: { servername: hostName },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 12000)
  };
}

function getTransporter(forceOptions) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS, or set RESEND_API_KEY for HTTP email.');
  }

  const opts = forceOptions || getConfiguredPortSecure();
  const key = `${opts.port}:${opts.secure ? 1 : 0}`;
  if (transporter && transporterKey === key) return transporter;

  transporter = nodemailer.createTransport(buildTransportOptions(opts));
  transporterKey = key;
  return transporter;
}

function resetTransporter() {
  transporter = null;
  transporterKey = '';
}

function isSmtpConnectivityError(error) {
  const msg = String(error && error.message ? error.message : error || '').toLowerCase();
  const code = String(error && error.code ? error.code : '').toUpperCase();
  return (
    code === 'ETIMEDOUT'
    || code === 'ESOCKET'
    || code === 'ECONNECTION'
    || code === 'ENETUNREACH'
    || code === 'EHOSTUNREACH'
    || code === 'ECONNREFUSED'
    || msg.includes('connection timeout')
    || msg.includes('greeting never received')
    || msg.includes('enetunreach')
    || msg.includes('timed out')
  );
}

function smtpBlockedError(originalError) {
  const detail = originalError && originalError.message ? originalError.message : 'Connection timeout';
  return new Error(
    `Email SMTP failed (${detail}). `
    + 'Approval/Render blocks outbound SMTP. '
    + 'Set RESEND_API_KEY (https://resend.com) or BREVO_API_KEY, '
    + 'or switch Setting Forklift Driver "Send request by" to SMS.'
  );
}

function httpRequiredError() {
  return new Error(
    'Email over SMTP is blocked on Approval/Render. '
    + 'Set RESEND_API_KEY (recommended) or BREVO_API_KEY in Render env, '
    + 'or switch Setting Forklift Driver "Send request by" to SMS.'
  );
}

async function sendViaResend({ to, subject, text, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = getFromAddress();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: text || undefined,
      html: html || undefined
    }),
    signal: createFetchTimeoutSignal()
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(`Resend email failed: ${msg}`);
  }
  return {
    messageId: body?.id || null,
    from,
    to,
    provider: 'resend'
  };
}

async function sendViaBrevo({ to, subject, text, html }) {
  const apiKey = String(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  const from = getFromAddress();
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: to }],
      subject,
      textContent: text || undefined,
      htmlContent: html || undefined
    }),
    signal: createFetchTimeoutSignal()
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(`Brevo email failed: ${msg}`);
  }
  return {
    messageId: body?.messageId || null,
    from,
    to,
    provider: 'brevo'
  };
}

async function sendViaHttp(mailOptions) {
  const mode = String(process.env.EMAIL_TRANSPORT || 'auto').trim().toLowerCase();
  if (mode === 'brevo' || (!hasResend() && hasBrevo())) {
    return sendViaBrevo(mailOptions);
  }
  if (hasResend()) {
    return sendViaResend(mailOptions);
  }
  if (hasBrevo()) {
    return sendViaBrevo(mailOptions);
  }
  throw httpRequiredError();
}

async function resolveHostIpv4(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

async function sendWithSmtpOptions(mailOptions, portSecure) {
  const hostName = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  let transport;
  try {
    const ipv4 = await resolveHostIpv4(hostName);
    const key = `${ipv4}:${portSecure.port}:${portSecure.secure ? 1 : 0}`;
    if (!transporter || transporterKey !== key) {
      transporter = nodemailer.createTransport({
        ...buildTransportOptions(portSecure),
        host: ipv4,
        name: hostName,
        tls: { servername: hostName }
      });
      transporterKey = key;
    }
    transport = transporter;
  } catch (_) {
    transport = getTransporter(portSecure);
  }

  const info = await transport.sendMail(mailOptions);
  return {
    messageId: info && info.messageId ? info.messageId : null,
    from: getFromAddress(),
    to: mailOptions.to,
    port: portSecure.port,
    secure: portSecure.secure,
    provider: 'smtp'
  };
}

async function sendViaSmtp(mailOptions) {
  const primary = getConfiguredPortSecure();
  try {
    return await sendWithSmtpOptions(mailOptions, primary);
  } catch (firstError) {
    if (!isSmtpConnectivityError(firstError)) {
      throw firstError;
    }

    const fallback = { port: 465, secure: true };
    if (primary.port === fallback.port && primary.secure === fallback.secure) {
      throw smtpBlockedError(firstError);
    }

    resetTransporter();
    try {
      return await sendWithSmtpOptions(mailOptions, fallback);
    } catch (secondError) {
      throw smtpBlockedError(secondError);
    }
  }
}

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text: text || undefined,
    html: html || undefined
  };

  const mode = getTransportMode();
  if (mode === 'http' || mode === 'resend' || mode === 'brevo') {
    return sendViaHttp(mailOptions);
  }
  if (mode === 'http-required') {
    if (isHttpConfigured()) return sendViaHttp(mailOptions);
    throw httpRequiredError();
  }
  if (mode === 'smtp') {
    return sendViaSmtp(mailOptions);
  }

  // auto
  if (isHttpConfigured()) {
    return sendViaHttp(mailOptions);
  }
  return sendViaSmtp(mailOptions);
}

module.exports = {
  DEFAULT_FROM,
  getFromAddress,
  isConfigured,
  isHttpConfigured,
  isSmtpConfigured,
  sendMail,
  resetTransporter
};
