// Importa registros de locations.txt na tabela warehouse_locations
// status = active, access_type = Shelf By Fork, datas usam CURRENT_TIMESTAMP (defaults da tabela)
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const STATUS = 'active';
const ACCESS_TYPE = 'Shelf By Fork';

async function importLocationsFromTxt() {
  const filePath = path.join(__dirname, '..', 'locations.txt');

  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo não encontrado:', filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    console.log('📭 Nenhuma linha válida no arquivo.');
    await closePool();
    return;
  }

  console.log(`\n📂 Arquivo: ${filePath}`);
  console.log(`📋 Linhas válidas: ${lines.length}`);
  console.log(`   status = "${STATUS}", access_type = "${ACCESS_TYPE}"\n`);

  let inserted = 0;
  let skipped = 0;

  const insertSql = `
    INSERT INTO warehouse_locations (location, status, access_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (location) DO NOTHING
  `;

  for (const location of lines) {
    try {
      const result = await query(insertSql, [location, STATUS, ACCESS_TYPE]);
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`   Erro ao inserir "${location}":`, err.message);
    }
  }

  console.log(`✅ Inseridos: ${inserted}`);
  console.log(`⏭️  Já existiam (ignorados): ${skipped}`);
  console.log(`📊 Total na tabela: ${inserted + skipped} linhas processadas.\n`);

  await closePool();
}

importLocationsFromTxt().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});

