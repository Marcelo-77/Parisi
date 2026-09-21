const dns = require('dns');
const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'doubleyitsystem@gmail.com';

let transporter = null;
let transporterKey = '';

function getFromAddress() {
  return String(process.env.SMTP_FROM || process.env.SMTP_USER || DEFAULT_FROM).trim();
}

function isConfigured() {
  return Boolean(String(process.env.SMTP_USER || '').trim() && String(process.env.SMTP_PASS || '').trim());
}

/** Force A-record (IPv4) only — Render often has no IPv6 route (ENETUNREACH). */
function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG }, (err, address, family) => {
    if (err) {
      // ADDRCONFIG can fail on some hosts; retry plain IPv4.
      return dns.lookup(hostname, { family: 4 }, callback);
    }
    return callback(null, address, family || 4);
  });
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
    // Critical on Render/Approval: avoid smtp.gmail.com AAAA (IPv6) ENETUNREACH.
    family: 4,
    lookup: ipv4Lookup,
    name: hostName,
    tls: {
      servername: hostName
    },
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
  if (!isConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS in config.env');
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
    + 'Approval/Render may block outbound SMTP. '
    + 'Prefer Setting Forklift Driver "Send request by" = SMS, '
    + 'or use an HTTP email API. If using Gmail, keep SMTP_PORT=465 and SMTP_SECURE=true.'
  );
}

async function resolveHostIpv4(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

async function sendWithOptions(mailOptions, portSecure) {
  const hostName = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  let transport;
  try {
    // Prefer connecting to literal IPv4 so Node never opens an IPv6 socket.
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
    secure: portSecure.secure
  };
}

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text: text || undefined,
    html: html || undefined
  };

  const primary = getConfiguredPortSecure();
  try {
    return await sendWithOptions(mailOptions, primary);
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
      return await sendWithOptions(mailOptions, fallback);
    } catch (secondError) {
      throw smtpBlockedError(secondError);
    }
  }
}

module.exports = {
  DEFAULT_FROM,
  getFromAddress,
  isConfigured,
  sendMail,
  resetTransporter
};
