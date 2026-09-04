/**
 * Carga de produtos a partir de backend/bath LIST.xls
 *
 * Regras:
 * - Categoria/grupo: BATH (Bath)
 * - Subcategoria/subgrupo: primeira palavra da Description (ex.: Rotondo -> ROTONDO)
 * - Campos: Product (codigo), Description (nome), Supplier Product Code, Barcode (EAN)
 * - Se codigo NAO existir: INSERT
 * - Se codigo JA existir: UPDATE nome, barcode, categoria, subcategoria, supplier_product_code
 * - Gera log em backend/logs/import-bath-list-products-YYYYMMDD_HHMMSS.log
 *
 * Uso (a partir de backend/):
 *   node scripts/import-bath-list-products.js
 *   node scripts/import-bath-list-products.js --dry-run
 *   node scripts/import-bath-list-products.js --file="bath LIST.xls"
 *   node scripts/import-bath-list-products.js --sheet=Sheet1
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const XLSX = require('xlsx');
const { getClient, closePool } = require('../config/database');
const { normalizeBathwareSubcategory } = require('../constants/bathwareSubcategories');

const TABLE_NAME = 'warehouse_items';
const CATEGORIA = 'BATH';
const DEFAULT_FILE = path.join(__dirname, '..', 'bath LIST.xls');

function normalizeBarcode(raw) {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(0, 20);
}

function truncate(value, maxLen) {
  return String(value || '').trim().substring(0, maxLen);
}

function findHeaderKey(row, candidates) {
  const keys = Object.keys(row || {});
  for (const candidate of candidates) {
    const found = keys.find((k) => String(k).trim().toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function timestampForFile(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '_' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function ensureLogDir() {
  const dir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseSheetArg(argv) {
  const sheetArg = argv.find((a) => a.startsWith('--sheet='));
  if (sheetArg) return sheetArg.split('=').slice(1).join('=');
  const idx = argv.indexOf('--sheet');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return null;
}

function resolveFilePath(argv) {
  const fileArg = argv.find((a) => a.startsWith('--file='));
  if (fileArg) {
    const raw = fileArg.split('=').slice(1).join('=');
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  const idx = argv.indexOf('--file');
  if (idx >= 0 && argv[idx + 1]) {
    const raw = argv[idx + 1];
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return DEFAULT_FILE;
}

function subcategoryFromDescription(description) {
  const firstWord = String(description || '').trim().split(/\s+/)[0] || '';
  return normalizeBathwareSubcategory(firstWord);
}

function loadProducts(filePath, sheetName = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const resolvedSheetName = sheetName || workbook.SheetNames[0];
  if (!resolvedSheetName) throw new Error('Planilha Excel sem abas.');
  if (!workbook.SheetNames.includes(resolvedSheetName)) {
    throw new Error(
      `Aba "${resolvedSheetName}" nao encontrada. Disponiveis: ${workbook.SheetNames.join(', ')}`
    );
  }

  const sheet = workbook.Sheets[resolvedSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) throw new Error('Planilha Excel sem dados.');

  const sample = rows[0];
  const productKey = findHeaderKey(sample, ['Product', 'product', 'codigo', 'code']);
  const descriptionKey = findHeaderKey(sample, ['Description', 'description', 'nome']);
  const supplierKey = findHeaderKey(sample, [
    'Supplier Product Code',
    'Supplier_Product_Code',
    'Supplier Product code',
    'supplier product code'
  ]);
  const barcodeKey = findHeaderKey(sample, ['Barcode (EAN)', 'Barcode', 'BARCODE', 'barcode', 'EAN']);

  if (!productKey || !descriptionKey) {
    throw new Error(
      `Cabecalho invalido. Esperado Product e Description. Encontrado: ${Object.keys(sample).join(', ')}`
    );
  }

  const products = [];
  let invalid = 0;
  const subcategoryCounts = {};

  rows.forEach((row, index) => {
    const codigo = truncate(row[productKey], 50);
    const nome = truncate(row[descriptionKey], 100);
    const supplierProductCode = supplierKey
      ? truncate(row[supplierKey], 100) || null
      : null;
    const barcode = barcodeKey ? normalizeBarcode(row[barcodeKey]) : null;
    const subcategoria = subcategoryFromDescription(row[descriptionKey]);
    const excelRow = index + 2;

    if (!codigo || !nome || !subcategoria) {
      invalid += 1;
      return;
    }

    subcategoryCounts[subcategoria] = (subcategoryCounts[subcategoria] || 0) + 1;
    products.push({
      codigo,
      nome,
      barcode,
      supplierProductCode,
      subcategoria,
      excelRow
    });
  });

  return {
    sheetName: resolvedSheetName,
    products,
    invalid,
    productKey,
    descriptionKey,
    supplierKey,
    barcodeKey,
    subcategoryCounts
  };
}

function writeLogFile(logLines, startedAt) {
  const logDir = ensureLogDir();
  const logFile = path.join(logDir, `import-bath-list-products-${timestampForFile(startedAt)}.log`);
  fs.writeFileSync(logFile, logLines.join('\n') + '\n', 'utf8');
  return logFile;
}

async function main() {
  const argv = process.argv;
  const filePath = resolveFilePath(argv);
  const sheetName = parseSheetArg(argv);
  const dryRun = argv.includes('--dry-run');
  const startedAt = new Date();
  const logLines = [];
  const log = (line) => {
    const text = String(line);
    logLines.push(text);
    console.log(text);
  };

  log('=== Carga Bath LIST -> warehouse_items (grupo BATH) ===');
  log(`Started: ${startedAt.toISOString()}`);
  log(`DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
  log(`DB_NAME: ${process.env.DB_NAME || ''}`);
  log(`Arquivo: ${filePath}`);
  log(`Categoria/grupo: ${CATEGORIA}`);
  log('Subcategoria/subgrupo: primeira palavra da Description');
  if (dryRun) log('Modo: DRY-RUN (nao grava no banco)');

  const loaded = loadProducts(filePath, sheetName);
  log(`Aba: ${loaded.sheetName}`);
  log(
    `Colunas: Product="${loaded.productKey}", Description="${loaded.descriptionKey}", ` +
      `Supplier Product Code="${loaded.supplierKey || '(ausente)'}", Barcode="${loaded.barcodeKey || '(ausente)'}"`
  );
  log(`Linhas validas: ${loaded.products.length}`);
  log(`Linhas invalidas: ${loaded.invalid}`);
  log('Subgrupos detectados:');
  Object.entries(loaded.subcategoryCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([name, count]) => log(`  - ${name}: ${count}`));
  log('');

  if (!loaded.products.length) {
    throw new Error('Nenhum produto valido para processar.');
  }

  if (dryRun) {
    loaded.products.slice(0, 15).forEach((p) => {
      log(
        `DRY-RUN row ${p.excelRow}: ${p.codigo} | ${p.subcategoria} | ${p.nome} | ` +
          `supplier=${p.supplierProductCode || '-'} | barcode=${p.barcode || '-'}`
      );
    });
    if (loaded.products.length > 15) {
      log(`... mais ${loaded.products.length - 15} linha(s)`);
    }
    log('');
    log('Dry-run concluido. Nenhuma alteracao feita.');
    const logFile = writeLogFile(logLines, startedAt);
    log(`Log: ${logFile}`);
    return;
  }

  const client = await getClient();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE ${TABLE_NAME}
      ADD COLUMN IF NOT EXISTS barcode NUMERIC(20)
    `);
    await client.query(`
      ALTER TABLE ${TABLE_NAME}
      ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(50)
    `);
    await client.query(`
      ALTER TABLE ${TABLE_NAME}
      ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier_product_code
      ON ${TABLE_NAME}(supplier_product_code)
    `).catch(() => {});

    const selectSql = `
      SELECT id, codigo, nome, barcode::text AS barcode, categoria, subcategoria, supplier_product_code
      FROM ${TABLE_NAME}
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM($1))
      LIMIT 1
    `;

    const insertSql = `
      INSERT INTO ${TABLE_NAME}
        (codigo, barcode, nome, categoria, subcategoria, supplier_product_code, quantidade, quantidade_minima, preco_unitario)
      VALUES ($1, $2::NUMERIC(20), $3, $4, $5, $6, 0, 0, 0)
      RETURNING id
    `;

    const updateSql = `
      UPDATE ${TABLE_NAME}
      SET nome = $2,
          barcode = $3::NUMERIC(20),
          categoria = $4,
          subcategoria = $5,
          supplier_product_code = $6,
          atualizado_em = NOW()
      WHERE id = $1
    `;

    for (const product of loaded.products) {
      const existing = await client.query(selectSql, [product.codigo]);

      if (!existing.rows.length) {
        await client.query(insertSql, [
          product.codigo,
          product.barcode,
          product.nome,
          CATEGORIA,
          product.subcategoria,
          product.supplierProductCode
        ]);
        inserted += 1;
        log(
          `INSERT row ${product.excelRow}: ${product.codigo} | ${product.subcategoria} | ${product.nome} | ` +
            `supplier=${product.supplierProductCode || '-'} | barcode=${product.barcode || '-'}`
        );
        continue;
      }

      const row = existing.rows[0];
      const currentBarcode = row.barcode != null ? String(row.barcode).replace(/\.0$/, '') : null;
      const nextBarcode = product.barcode != null ? String(product.barcode) : null;
      const currentSupplier = row.supplier_product_code != null ? String(row.supplier_product_code).trim() : null;
      const nextSupplier = product.supplierProductCode != null ? String(product.supplierProductCode).trim() : null;
      const needsUpdate =
        String(row.nome || '') !== product.nome ||
        String(row.categoria || '').toUpperCase() !== CATEGORIA ||
        String(row.subcategoria || '').toUpperCase() !== product.subcategoria ||
        currentBarcode !== nextBarcode ||
        currentSupplier !== nextSupplier;

      if (!needsUpdate) {
        unchanged += 1;
        log(`UNCHANGED row ${product.excelRow}: ${product.codigo}`);
        continue;
      }

      await client.query(updateSql, [
        row.id,
        product.nome,
        product.barcode,
        CATEGORIA,
        product.subcategoria,
        product.supplierProductCode
      ]);
      updated += 1;
      log(
        `UPDATE row ${product.excelRow}: ${product.codigo} | ${product.subcategoria} | ` +
          `supplier=${product.supplierProductCode || '-'} | barcode=${product.barcode || '-'} | ` +
          `prev_sub=${row.subcategoria || '-'} | prev_supplier=${currentSupplier || '-'}`
      );
    }

    await client.query('COMMIT');

    const stats = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(TRIM(categoria)) = $1)::int AS bathware_count,
        COUNT(supplier_product_code)::int AS with_supplier_code
      FROM ${TABLE_NAME}
    `, [CATEGORIA]);

    log('');
    log('Carga concluida.');
    log(`  Inseridos: ${inserted}`);
    log(`  Atualizados: ${updated}`);
    log(`  Sem mudanca: ${unchanged}`);
    log(`  Invalidos: ${loaded.invalid}`);
    if (stats.rows && stats.rows[0]) {
      log(`  Total warehouse_items: ${stats.rows[0].total}`);
      log(`  Total categoria ${CATEGORIA}: ${stats.rows[0].bathware_count}`);
      log(`  Com supplier_product_code: ${stats.rows[0].with_supplier_code}`);
    }

    const logFile = writeLogFile(logLines, startedAt);
    log(`Log: ${logFile}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log('');
    log(`ERRO: ${err.message}`);
    try {
      const logFile = writeLogFile(logLines, startedAt);
      log(`Log parcial: ${logFile}`);
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('Erro na carga Bath LIST:', err.message);
  process.exit(1);
});
