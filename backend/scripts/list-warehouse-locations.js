// Lista registros da tabela warehouse_locations
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

async function listLocations() {
  try {
    const result = await query('SELECT * FROM warehouse_locations ORDER BY location ASC');
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('\n📭 Nenhum registro na tabela warehouse_locations.\n');
      return;
    }

    console.log('\n📋 Registros da tabela warehouse_locations (' + rows.length + '):\n');
    console.table(rows.map(r => ({
      id: r.id,
      location: r.location,
      status: r.status,
      access_type: r.access_type,
      criado_em: r.criado_em,
      atualizado_em: r.atualizado_em
    })));
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await closePool();
  }
}

listLocations();
