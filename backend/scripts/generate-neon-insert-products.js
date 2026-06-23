/**
 * Gera SQL para sincronizar produtos no Neon com o ambiente LOCAL.
 *
 * Fonte padrao (igual ao local): backend/products.txt
 * Barcodes/nomes enriquecidos com BARCODEPARISI.csv quando houver match.
 *
 * Uso:
 *   node scripts/generate-neon-insert-products.js
 *   node scripts/generate-neon-insert-products.js --source=data_product
 *   node scripts/generate-neon-insert-products.js --source=csv
 *
 * Saida:
 *   backend/scripts/neon-insert-products.sql
 */
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const PRODUCTS_TXT_PATH = path.join(BACKEND_DIR, 'products.txt');
const CSV_PATH = path.join(BACKEND_DIR, 'BARCODEPARISI.csv');
const DATA_PRODUCT_PATH = path.join(BACKEND_DIR, 'public', 'data_product.txt');
const OUTPUT_PATH = path.join(__dirname, 'neon-insert-products.sql');

const CATEGORIA = 'TAPWARE';
const BATCH_SIZE = 250;

const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const source = sourceArg ? sourceArg.split('=')[1] : 'products';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function normalizeBarcode(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(0, 20);
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBarcode(value) {
  if (value == null) return 'NULL';
  return value;
}

function truncate(value, maxLen) {
  return String(value || '').trim().substring(0, maxLen);
}

function loadBarcodeLookup() {
  const lookup = new Map();
  if (!fs.existsSync(CSV_PATH)) {
    return lookup;
  }

  const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) return lookup;

  const header = parseCsvLine(lines[0]);
  const idxCodArt = header.indexOf('COD.ART');
  const idxDescription = header.indexOf('DESCRIPTION');
  const idxBarcode = header.indexOf('BARCODE');
  if (idxCodArt < 0 || idxDescription < 0 || idxBarcode < 0) {
    return lookup;
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const codigo = truncate(cols[idxCodArt], 50);
    if (!codigo) continue;
    lookup.set(codigo, {
      nome: truncate(cols[idxDescription] || codigo, 100),
      barcode: normalizeBarcode(cols[idxBarcode]),
    });
  }

  return lookup;
}

function enrichProduct(codigo, defaultNome, lookup) {
  const extra = lookup.get(codigo);
  return {
    codigo,
    nome: extra?.nome || defaultNome,
    barcode: extra?.barcode || null,
    categoria: CATEGORIA,
  };
}

function loadProductsFromProductsTxt(lookup) {
  if (!fs.existsSync(PRODUCTS_TXT_PATH)) {
    throw new Error(`Arquivo nao encontrado: ${PRODUCTS_TXT_PATH}`);
  }

  const lines = fs
    .readFileSync(PRODUCTS_TXT_PATH, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const byCode = new Map();
  for (const line of lines) {
    const codigo = truncate(line, 50);
    if (!codigo) continue;
    byCode.set(codigo, enrichProduct(codigo, truncate(line, 100), lookup));
  }

  return Array.from(byCode.values());
}

function loadProductsFromDataProduct(lookup) {
  if (!fs.existsSync(DATA_PRODUCT_PATH)) {
    throw new Error(`Arquivo nao encontrado: ${DATA_PRODUCT_PATH}`);
  }

  const lines = fs
    .readFileSync(DATA_PRODUCT_PATH, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const byCode = new Map();
  for (const line of lines) {
    const codigo = truncate(line, 50);
    if (!codigo) continue;
    byCode.set(codigo, enrichProduct(codigo, truncate(line, 100), lookup));
  }

  return Array.from(byCode.values());
}

function loadProductsFromCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Arquivo nao encontrado: ${CSV_PATH}`);
  }

  const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) {
    throw new Error('CSV sem dados.');
  }

  const header = parseCsvLine(lines[0]);
  const idxCodArt = header.indexOf('COD.ART');
  const idxDescription = header.indexOf('DESCRIPTION');
  const idxBarcode = header.indexOf('BARCODE');
  if (idxCodArt < 0 || idxDescription < 0 || idxBarcode < 0) {
    throw new Error('Cabecalho CSV invalido. Esperado: COD.ART, DESCRIPTION, BARCODE');
  }

  const byCode = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const codigo = truncate(cols[idxCodArt], 50);
    if (!codigo) continue;

    byCode.set(codigo, {
      codigo,
      nome: truncate(cols[idxDescription] || codigo, 100),
      barcode: normalizeBarcode(cols[idxBarcode]),
      categoria: CATEGORIA,
    });
  }

  return Array.from(byCode.values());
}

function sourceLabel() {
  if (source === 'data_product') return 'public/data_product.txt (+ BARCODEPARISI.csv quando existir match)';
  if (source === 'csv') return 'BARCODEPARISI.csv (catalogo completo)';
  return 'products.txt (+ BARCODEPARISI.csv quando existir match) - igual ao ambiente local';
}

function buildCodeInsertBatch(batch) {
  const values = batch.map((p) => `  (${sqlString(p.codigo)})`).join(',\n');
  return `INSERT INTO _sync_product_codes (codigo) VALUES\n${values}\nON CONFLICT (codigo) DO NOTHING;`;
}

function buildInsertBatch(batch) {
  const values = batch
    .map((p) => {
      return `  (${sqlString(p.codigo)}, ${sqlBarcode(p.barcode)}, ${sqlString(p.nome)}, ${sqlString(p.categoria)}, 0, 0, 0)`;
    })
    .join(',\n');

  return `INSERT INTO warehouse_items (codigo, barcode, nome, categoria, quantidade, quantidade_minima, preco_unitario)
VALUES
${values}
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  barcode = COALESCE(EXCLUDED.barcode, warehouse_items.barcode),
  categoria = EXCLUDED.categoria,
  atualizado_em = CURRENT_TIMESTAMP;`;
}

function generateSql(products) {
  const header = `-- =============================================================================
-- Double-Y Warehouse System - Sincronizar produtos no Neon
-- Gerado em: ${new Date().toISOString()}
-- Total de produtos: ${products.length}
-- Fonte: ${sourceLabel()}
--
-- Este script deixa o Neon igual ao ambiente LOCAL (products.txt).
-- Remove produtos extras e faz UPSERT da lista correta.
--
-- Como usar no Neon:
--   1) Execute antes: backend/scripts/neon-setup-completo.sql (criar tabelas)
--   2) SQL Editor -> cole este arquivo -> Run
--   3) Confira: SELECT COUNT(*) FROM warehouse_items;
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _sync_product_codes (
  codigo VARCHAR(50) PRIMARY KEY
);

`;

  const codeChunks = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    codeChunks.push(buildCodeInsertBatch(products.slice(i, i + BATCH_SIZE)));
  }

  const cleanup = `
-- Remove produtos que nao existem no ambiente local
DELETE FROM warehouse_items w
WHERE NOT EXISTS (
  SELECT 1 FROM _sync_product_codes s WHERE s.codigo = w.codigo
);

`;

  const insertChunks = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    insertChunks.push(buildInsertBatch(products.slice(i, i + BATCH_SIZE)));
  }

  const footer = `
COMMIT;

-- Verificacao (deve bater com o local):
-- SELECT COUNT(*) AS total_produtos FROM warehouse_items;
`;

  return header + codeChunks.join('\n\n') + cleanup + insertChunks.join('\n\n') + footer;
}

function loadProducts() {
  if (source === 'csv') {
    return loadProductsFromCsv();
  }

  const lookup = loadBarcodeLookup();
  if (source === 'data_product') {
    return loadProductsFromDataProduct(lookup);
  }

  return loadProductsFromProductsTxt(lookup);
}

function main() {
  const products = loadProducts();
  products.sort((a, b) => a.codigo.localeCompare(b.codigo));

  const withBarcode = products.filter((p) => p.barcode).length;
  const sql = generateSql(products);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');

  console.log(`✅ SQL gerado: ${OUTPUT_PATH}`);
  console.log(`📦 Produtos: ${products.length}`);
  console.log(`🏷️  Com barcode (CSV): ${withBarcode}`);
  console.log(`📄 Tamanho: ${(Buffer.byteLength(sql, 'utf8') / 1024).toFixed(0)} KB`);
  console.log('\nProximo passo: execute neon-insert-products.sql no Neon SQL Editor');
}

main();
