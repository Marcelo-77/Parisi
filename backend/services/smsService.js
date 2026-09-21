const { randomUUID } = require('crypto');

const API_BASE = 'https://api.mobilemessage.com.au';

function getProvider() {
  return String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
}

function isConfigured() {
  if (getProvider() !== 'mobilemessage') return false;
  return Boolean(
    String(process.env.SMS_API_USER || '').trim()
    && String(process.env.SMS_API_PASS || '').trim()
  );
}

function getSender() {
  return String(process.env.SMS_SENDER || process.env.SMS_FROM || '').trim();
}

/**
 * Normalize AU mobile numbers for Mobile Message.
 * Accepts: 04xxxxxxxx, +614xxxxxxxx, 614xxxxxxxx, 4xxxxxxxx
 */
function normalizeAuMobile(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;

  value = value.replace(/[\s\-().]/g, '');
  if (value.startsWith('+')) value = value.slice(1);

  if (value.startsWith('61') && value.length >= 11) {
    return value;
  }
  if (value.startsWith('0') && value.length === 10) {
    return value;
  }
  if (value.startsWith('4') && value.length === 9) {
    return `0${value}`;
  }

  return value;
}

function buildAuthHeader() {
  const user = String(process.env.SMS_API_USER || '').trim();
  const pass = String(process.env.SMS_API_PASS || '').trim();
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function listSenders() {
  if (!isConfigured()) {
    throw new Error('SMS is not configured. Set SMS_PROVIDER=mobilemessage, SMS_API_USER and SMS_API_PASS.');
  }

  const res = await fetch(`${API_BASE}/v1/senders`, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(),
      Accept: 'application/json'
    }
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(`Mobile Message senders failed: ${msg}`);
  }
  return body;
}

async function sendSms({ to, message, sender, customRef }) {
  if (!isConfigured()) {
    throw new Error('SMS is not configured. Set SMS_PROVIDER=mobilemessage, SMS_API_USER and SMS_API_PASS.');
  }

  const phone = normalizeAuMobile(to);
  if (!phone) {
    throw new Error('Recipient phone is required');
  }

  const text = String(message || '').trim();
  if (!text) {
    throw new Error('SMS message content is required');
  }

  const from = String(sender || getSender() || '').trim();
  if (!from) {
    throw new Error('SMS sender is required. Set SMS_SENDER in config.env');
  }

  const payload = {
    messages: [
      {
        to: phone,
        message: text,
        sender: from,
        custom_ref: customRef || `mr-${Date.now()}`
      }
    ]
  };

  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': randomUUID()
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(`Mobile Message send failed: ${msg}`);
  }

  const first = Array.isArray(body?.messages) ? body.messages[0] : null;
  const status = String(first?.status || body?.status || '').toLowerCase();
  if (status && status !== 'success' && status !== 'complete') {
    const err = first?.error || body?.error || `status=${status || 'unknown'}`;
    throw new Error(`Mobile Message rejected SMS: ${err}`);
  }

  return {
    provider: 'mobilemessage',
    to: phone,
    sender: from,
    messageId: first?.message_id || first?.id || body?.send_id || null,
    status: first?.status || body?.status || 'success',
    raw: body
  };
}

module.exports = {
  isConfigured,
  getProvider,
  getSender,
  normalizeAuMobile,
  listSenders,
  sendSms
};
