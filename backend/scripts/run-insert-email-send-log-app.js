require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const emailSendLogService = require('../services/emailSendLogService');
const messageEmailService = require('../services/messageEmailService');

async function main() {
  const sqlPath = path.join(__dirname, 'insert-email-send-log-application.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await query(statement);
  }

  await emailSendLogService.ensureTable();
  await messageEmailService.ensureTable();
  console.log('Email send log table and Search Email Send Log application registered successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
