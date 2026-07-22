/**
 * Gera SQL para inserir/atualizar produtos Valdama (valdama_new2.xlsx) no Neon.
 *
 * Fonte:
 *   backend/valdama_new2.xlsx -> categoria BATHWARE, subcategoria VALDAMA
 *
 * Uso:
 *   node scripts/generate-neon-insert-valdama-new2-products.js
 *
 * Saida:
 *   backend/scripts/neon-insert-valdama-new2-products.sql
 *
 * Producao (Neon SQL Editor):
 *   1) Cole e execute neon-insert-valdama-new2-products.sql
 *   2) Confira: SELECT COUNT(*) FROM warehouse_items
 *              WHERE UPPER(subcategoria) = 'VALDAMA';
 */
const fs = require('fs');
const path = require('path');
const { loadRowsFromExcel, CATEGORIA } = require('./import-bathware-products-lib');

const BACKEND_DIR = path.join(__dirname, '..');
const INPUT_FILE = path.join(BACKEND_DIR, 'valdama_new2.xlsx');
const OUTPUT_PATH = path.join(__dirname, 'neon-insert-valdama-new2-products.sql');
const SUBCATEGORIA = 'VALDAMA';
const BATCH_SIZE = 200;

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBarcode(value) {
  if (value == null) return 'NULL';
  return value;
}

function buildInsertBatch(batch) {
  const values = batch
    .map((p) => {
      return `  (${sqlString(p.codigo)}, ${sqlBarcode(p.barcode)}, ${sqlString(p.nome)}, ${sqlString(CATEGORIA)}, ${sqlString(SUBCATEGORIA)}, 0, 0, 0)`;
    })
    .join(',\n');

  return `INSERT INTO warehouse_items (codigo, barcode, nome, categoria, subcategoria, quantidade, quantidade_minima, preco_unitario)
VALUES
${values}
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  barcode = COALESCE(EXCLUDED.barcode, warehouse_items.barcode),
  categoria = EXCLUDED.categoria,
  subcategoria = EXCLUDED.subcategoria,
  atualizado_em = CURRENT_TIMESTAMP;`;
}

function generateSql(products) {
  const withBarcode = products.filter((p) => p.barcode).length;
  const header = `-- =============================================================================
-- Double-Y Warehouse System - Valdama products (valdama_new2) for Neon
-- Gerado em: ${new Date().toISOString()}
-- Total de produtos: ${products.length}
-- Com barcode: ${withBarcode}
-- Categoria: ${CATEGORIA} | Subcategoria: ${SUBCATEGORIA}
--
-- Como usar no Neon SQL Editor:
--   1) Cole este arquivo completo e clique Run
--   2) Verifique os totais no final do script
-- =============================================================================

BEGIN;

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_subcategoria
  ON warehouse_items(subcategoria);

`;

  const insertChunks = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    insertChunks.push(buildInsertBatch(products.slice(i, i + BATCH_SIZE)));
  }

  const footer = `
COMMIT;

-- Verificacao:
-- SELECT COUNT(*)::int AS total_valdama
-- FROM warehouse_items
-- WHERE UPPER(TRIM(subcategoria)) = 'VALDAMA';
`;

  return header + insertChunks.join('\n\n') + footer;
}

function main() {
  const { products } = loadRowsFromExcel(INPUT_FILE);
  const sorted = products.sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sql = generateSql(sorted);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');

  const withBarcode = sorted.filter((p) => p.barcode).length;
  console.log(`SQL gerado: ${OUTPUT_PATH}`);
  console.log(`Produtos Valdama: ${sorted.length}`);
  console.log(`Com barcode: ${withBarcode}`);
  console.log('\nProximo passo: execute neon-insert-valdama-new2-products.sql no Neon SQL Editor (producao).');
}

main();
