const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'doubleyitsystem@gmail.com';

let transporter = null;

function getFromAddress() {
  return String(process.env.SMTP_FROM || process.env.SMTP_USER || DEFAULT_FROM).trim();
}

function isConfigured() {
  return Boolean(String(process.env.SMTP_USER || '').trim() && String(process.env.SMTP_PASS || '').trim());
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS in config.env');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text: text || undefined,
    html: html || undefined
  };

  const info = await getTransporter().sendMail(mailOptions);
  return {
    messageId: info && info.messageId ? info.messageId : null,
    from: getFromAddress(),
    to
  };
}

module.exports = {
  DEFAULT_FROM,
  getFromAddress,
  isConfigured,
  sendMail
};
