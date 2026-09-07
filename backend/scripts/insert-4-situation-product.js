// Insere registros em situation_product (idempotente por descrição)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const REGISTROS = ['Full', 'Missing', 'Missing Lid', 'Missing Filter', 'Damaged'];

async function insert() {
  const insertSql = `
    INSERT INTO situation_product (sipr_nm_description)
    SELECT $1
    WHERE NOT EXISTS (
      SELECT 1 FROM situation_product
      WHERE LOWER(TRIM(sipr_nm_description)) = LOWER(TRIM($1))
    )
  `;

  for (const desc of REGISTROS) {
    const result = await query(insertSql, [desc]);
    console.log(result.rowCount ? '  Inserido:' : '  Já existe:', desc);
  }

  console.log('\n✅ situation_product verificado.');
  await closePool();
}

insert().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
