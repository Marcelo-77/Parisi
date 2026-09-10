require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const messageRequestService = require('../services/messageRequestService');

async function main() {
  const sqlPath = path.join(__dirname, 'insert-message-request-application.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await query(statement);
  }

  await messageRequestService.ensureTable();
  console.log('Message Request applications and table registered successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
