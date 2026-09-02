require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const messageEmailService = require('../services/messageEmailService');

async function main() {
  const sqlPath = path.join(__dirname, 'insert-message-email-application.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await query(statement);
  }

  await messageEmailService.ensureTable();
  console.log('Message Email applications and table registered successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
