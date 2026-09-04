/**
 * Gera SQL para inserir/atualizar no Neon Approval todos os produtos
 * do grupo BATH existentes na base LOCAL.
 *
 * Fonte:
 *   PostgreSQL local (config.env) -> warehouse_items WHERE categoria = 'BATH'
 *
 * Uso (a partir de backend/, com config.env apontando para LOCAL):
 *   node scripts/generate-neon-insert-bath-products-from-local.js
 *
 * Saida:
 *   backend/scripts/neon-insert-bath-products-from-local.sql
 *
 * Neon SQL Editor (Approval):
 *   1) Cole e execute neon-insert-bath-products-from-local.sql
 *   2) Confira:
 *        SELECT subcategoria, COUNT(*)
 *        FROM warehouse_items
 *        WHERE UPPER(TRIM(categoria)) = 'BATH'
 *        GROUP BY subcategoria
 *        ORDER BY 1;
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const OUTPUT_PATH = path.join(__dirname, 'neon-insert-bath-products-from-local.sql');
const CATEGORIA = 'BATH';
const BATCH_SIZE = 100;

function sqlString(value) {
  if (value == null || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBarcode(value) {
  if (value == null || value === '') return 'NULL';
  const digits = String(value).replace(/\.0$/, '').replace(/\D/g, '');
  if (!digits) return 'NULL';
  return digits;
}

function buildInsertBatch(batch) {
  const values = batch
    .map((p) => {
      return (
        `  (${sqlString(p.codigo)}, ${sqlBarcode(p.barcode)}, ${sqlString(p.nome)}, ` +
        `${sqlString(p.categoria)}, ${sqlString(p.subcategoria)}, ${sqlString(p.supplierProductCode)}, ` +
        `${Number(p.quantidade) || 0}, ${Number(p.quantidadeMinima) || 0}, 0)`
      );
    })
    .join(',\n');

  return `INSERT INTO warehouse_items (
  codigo, barcode, nome, categoria, subcategoria, supplier_product_code,
  quantidade, quantidade_minima, preco_unitario
)
VALUES
${values}
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  barcode = COALESCE(EXCLUDED.barcode, warehouse_items.barcode),
  categoria = EXCLUDED.categoria,
  subcategoria = EXCLUDED.subcategoria,
  supplier_product_code = COALESCE(EXCLUDED.supplier_product_code, warehouse_items.supplier_product_code),
  atualizado_em = CURRENT_TIMESTAMP;`;
}

function generateSql(products, subcategoryCounts) {
  const withBarcode = products.filter((p) => p.barcode).length;
  const withSupplier = products.filter((p) => p.supplierProductCode).length;
  const subLines = Object.entries(subcategoryCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => `--   ${name}: ${count}`)
    .join('\n');

  const header = `-- =============================================================================
-- Double-Y Warehouse System - BATH products from LOCAL DB for Neon Approval
-- Gerado em: ${new Date().toISOString()}
-- Origem: DB_HOST=${process.env.DB_HOST || 'localhost'} / DB_NAME=${process.env.DB_NAME || ''}
-- Total de produtos: ${products.length}
-- Com barcode: ${withBarcode}
-- Com supplier_product_code: ${withSupplier}
-- Categoria/grupo: ${CATEGORIA}
-- Subgrupos:
${subLines || '--   (nenhum)'}
--
-- Como usar no Neon SQL Editor (Approval):
--   1) Cole este arquivo completo e clique Run
--   2) Verifique os totais no final do script
-- =============================================================================

BEGIN;

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS barcode NUMERIC(20);

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(50);

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_subcategoria
  ON warehouse_items(subcategoria);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier_product_code
  ON warehouse_items(supplier_product_code);

`;

  const insertChunks = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    insertChunks.push(buildInsertBatch(products.slice(i, i + BATCH_SIZE)));
  }

  const footer = `
COMMIT;

-- Verificacao:
-- SELECT COUNT(*)::int AS total_bath
-- FROM warehouse_items
-- WHERE UPPER(TRIM(categoria)) = 'BATH';
--
-- SELECT subcategoria, COUNT(*)::int AS qtd
-- FROM warehouse_items
-- WHERE UPPER(TRIM(categoria)) = 'BATH'
-- GROUP BY subcategoria
-- ORDER BY subcategoria;
--
-- SELECT codigo, nome, subcategoria, supplier_product_code, barcode
-- FROM warehouse_items
-- WHERE UPPER(TRIM(codigo)) = 'ABFSSTP-M';
`;

  return header + insertChunks.join('\n\n') + footer;
}

async function loadBathProductsFromLocal() {
  const result = await query(
    `SELECT
       codigo,
       barcode::text AS barcode,
       nome,
       categoria,
       subcategoria,
       supplier_product_code,
       quantidade,
       quantidade_minima
     FROM warehouse_items
     WHERE UPPER(TRIM(categoria)) = $1
     ORDER BY codigo ASC`,
    [CATEGORIA]
  );

  return (result.rows || []).map((row) => ({
    codigo: row.codigo,
    barcode: row.barcode != null ? String(row.barcode).replace(/\.0$/, '') : null,
    nome: row.nome,
    categoria: row.categoria || CATEGORIA,
    subcategoria: row.subcategoria || null,
    supplierProductCode: row.supplier_product_code || null,
    quantidade: parseInt(row.quantidade, 10) || 0,
    quantidadeMinima: parseInt(row.quantidade_minima, 10) || 0
  }));
}

async function main() {
  console.log('=== Gerando SQL BATH a partir da base LOCAL ===');
  console.log(`DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`DB_NAME: ${process.env.DB_NAME || ''}`);
  console.log(`APP_ENV: ${process.env.APP_ENV || ''}`);

  const products = await loadBathProductsFromLocal();
  if (!products.length) {
    throw new Error('Nenhum produto com categoria BATH encontrado na base local.');
  }

  const subcategoryCounts = {};
  products.forEach((p) => {
    const key = p.subcategoria || '(sem subgrupo)';
    subcategoryCounts[key] = (subcategoryCounts[key] || 0) + 1;
  });

  const sql = generateSql(products, subcategoryCounts);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');

  console.log(`SQL gerado: ${OUTPUT_PATH}`);
  console.log(`Produtos BATH: ${products.length}`);
  console.log(`Com barcode: ${products.filter((p) => p.barcode).length}`);
  console.log(`Com supplier_product_code: ${products.filter((p) => p.supplierProductCode).length}`);
  console.log('Subgrupos:');
  Object.entries(subcategoryCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, count]) => console.log(`  - ${name}: ${count}`));
  console.log('\nProximo passo: execute neon-insert-bath-products-from-local.sql no Neon Approval SQL Editor.');
}

main()
  .catch((err) => {
    console.error('Erro ao gerar SQL BATH:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
