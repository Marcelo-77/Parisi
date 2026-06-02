// Insere 4 registros na tabela situation_product: Full, Missing, Missing Lid, Missing Filter
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const REGISTROS = ['Full', 'Missing', 'Missing Lid', 'Missing Filter'];

async function insert() {
  const insertSql = `
    INSERT INTO situation_product (sipr_nm_description)
    VALUES ($1)
  `;

  for (const desc of REGISTROS) {
    await query(insertSql, [desc]);
    console.log('  Inserido:', desc);
  }

  console.log('\n✅ 4 registros inseridos em situation_product.');
  await closePool();
}

insert().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
