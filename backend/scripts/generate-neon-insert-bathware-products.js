/**
 * Gera SQL para inserir/atualizar produtos Bathware (Flaminia, Tecla, Valdama) no Neon.
 *
 * Fontes:
 *   backend/flaminia_new.xlsx  -> subcategoria FLAMINIA
 *   backend/valdama_new.xlsx   -> subcategoria VALDAMA
 *   backend/tecla_new.xlsx     -> subcategoria TECLA
 *
 * Uso:
 *   node scripts/generate-neon-insert-bathware-products.js
 *
 * Saida:
 *   backend/scripts/neon-insert-bathware-products.sql
 *
 * Producao (Neon SQL Editor):
 *   1) Cole e execute neon-insert-bathware-products.sql
 *   2) Confira: SELECT subcategoria, COUNT(*) FROM warehouse_items
 *              WHERE UPPER(categoria) = 'BATHWARE' GROUP BY subcategoria;
 */
const fs = require('fs');
const path = require('path');
const { loadRowsFromExcel, CATEGORIA } = require('./import-bathware-products-lib');

const BACKEND_DIR = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(__dirname, 'neon-insert-bathware-products.sql');
const BATCH_SIZE = 200;

const BRANDS = [
  { file: 'flaminia_new.xlsx', subcategoria: 'FLAMINIA', label: 'Flaminia' },
  { file: 'valdama_new.xlsx', subcategoria: 'VALDAMA', label: 'Valdama' },
  { file: 'tecla_new.xlsx', subcategoria: 'TECLA', label: 'Tecla' }
];

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBarcode(value) {
  if (value == null) return 'NULL';
  return value;
}

function loadAllProducts() {
  const all = [];
  const seen = new Map();

  for (const brand of BRANDS) {
    const filePath = path.join(BACKEND_DIR, brand.file);
    const { products } = loadRowsFromExcel(filePath);
    for (const product of products) {
      const key = String(product.codigo || '').trim().toUpperCase();
      if (!key) continue;
      seen.set(key, {
        codigo: product.codigo,
        nome: product.nome,
        barcode: product.barcode,
        categoria: CATEGORIA,
        subcategoria: brand.subcategoria
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function buildInsertBatch(batch) {
  const values = batch
    .map((p) => {
      return `  (${sqlString(p.codigo)}, ${sqlBarcode(p.barcode)}, ${sqlString(p.nome)}, ${sqlString(p.categoria)}, ${sqlString(p.subcategoria)}, 0, 0, 0)`;
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
  const counts = BRANDS.map((brand) => {
    const n = products.filter((p) => p.subcategoria === brand.subcategoria).length;
    return `--   ${brand.label}: ${n}`;
  }).join('\n');

  const header = `-- =============================================================================
-- Double-Y Warehouse System - Bathware products for Neon (production)
-- Gerado em: ${new Date().toISOString()}
-- Total de produtos: ${products.length}
${counts}
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
-- SELECT subcategoria, COUNT(*)::int AS total
-- FROM warehouse_items
-- WHERE UPPER(TRIM(categoria)) = 'BATHWARE'
-- GROUP BY subcategoria
-- ORDER BY subcategoria;
`;

  return header + insertChunks.join('\n\n') + footer;
}

function main() {
  const products = loadAllProducts();
  const withBarcode = products.filter((p) => p.barcode).length;
  const sql = generateSql(products);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');

  console.log(`SQL gerado: ${OUTPUT_PATH}`);
  console.log(`Produtos Bathware: ${products.length}`);
  console.log(`Com barcode: ${withBarcode}`);
  BRANDS.forEach((brand) => {
    const count = products.filter((p) => p.subcategoria === brand.subcategoria).length;
    console.log(`  ${brand.label}: ${count}`);
  });
  console.log('\nProximo passo: execute neon-insert-bathware-products.sql no Neon SQL Editor (producao).');
}

main();
