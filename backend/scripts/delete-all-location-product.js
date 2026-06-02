// Script para apagar todos os registros da tabela location_product.
// Usa a mesma conexão do projeto (backend/config/database).
// Execute: node backend/scripts/delete-all-location-product.js

const { query, closePool } = require('../config/database');

async function deleteAll() {
  try {
    const res = await query('DELETE FROM location_product');
    const count = res.rowCount ?? 0;
    console.log(`✅ location_product: ${count} registro(s) apagado(s).`);
  } catch (err) {
    console.error('❌ Erro ao apagar:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

deleteAll();
