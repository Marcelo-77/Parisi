require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../config/database');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'system-documentation');

async function clearUploadFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log('No upload directory found.');
    return 0;
  }

  const files = fs.readdirSync(UPLOAD_DIR);
  let removed = 0;
  for (const file of files) {
    const fullPath = path.join(UPLOAD_DIR, file);
    if (fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      removed += 1;
    }
  }
  console.log(`Removed ${removed} file(s) from uploads/system-documentation`);
  return removed;
}

async function main() {
  const countResult = await query('SELECT COUNT(*)::int AS total FROM system_documentation');
  const total = countResult.rows[0]?.total || 0;

  await query('DELETE FROM system_documentation');
  console.log(`Deleted ${total} row(s) from system_documentation`);

  await clearUploadFiles();
  await closePool();
}

main().catch(async (error) => {
  console.error('Error clearing system documentation:', error.message);
  await closePool();
  process.exit(1);
});
