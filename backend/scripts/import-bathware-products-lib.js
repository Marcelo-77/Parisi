const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const XLSX = require('xlsx');
const { getClient, closePool } = require('../config/database');

const TABLE_NAME = 'warehouse_items';
const CATEGORIA = 'BATHWARE';

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

function loadRowsFromExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Planilha Excel sem abas.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) {
    throw new Error('Planilha Excel sem dados.');
  }

  const sample = rows[0];
  const productKey = findHeaderKey(sample, ['Product', 'product', 'COD.ART', 'codigo', 'code']);
  const descriptionKey = findHeaderKey(sample, ['Description', 'description', 'DESCRIPTION', 'nome']);
  const barcodeKey = findHeaderKey(sample, ['Barcode (EAN)', 'Barcode', 'BARCODE', 'barcode', 'EAN']);

  if (!productKey || !descriptionKey) {
    throw new Error(
      `Cabecalho invalido. Esperado Product e Description. Encontrado: ${Object.keys(sample).join(', ')}`
    );
  }

  const products = [];
  let invalid = 0;

  for (const row of rows) {
    const codigo = truncate(row[productKey], 50);
    const nome = truncate(row[descriptionKey], 100);
    const barcode = barcodeKey ? normalizeBarcode(row[barcodeKey]) : null;

    if (!codigo || !nome) {
      invalid += 1;
      continue;
    }

    products.push({ codigo, nome, barcode });
  }

  return { sheetName, products, invalid, productKey, descriptionKey, barcodeKey };
}

function resolveFilePath(defaultFile, argv) {
  const fileArg = argv.find((a) => a.startsWith('--file='));
  return fileArg
    ? path.resolve(process.cwd(), fileArg.split('=').slice(1).join('='))
    : defaultFile;
}

async function runBathwareImport({ brandLabel, subcategoria, defaultFile, argv = process.argv }) {
  const filePath = resolveFilePath(defaultFile, argv);
  const dryRun = argv.includes('--dry-run');

  console.log(`Carga ${brandLabel} -> warehouse_items`);
  console.log(`Arquivo: ${filePath}`);
  console.log(`Categoria: ${CATEGORIA}`);
  console.log(`Subcategoria: ${subcategoria}`);
  if (dryRun) console.log('Modo: DRY-RUN (nao grava no banco)');

  const { sheetName, products, invalid, productKey, descriptionKey, barcodeKey } =
    loadRowsFromExcel(filePath);

  console.log(`Aba: ${sheetName}`);
  console.log(`Colunas: Product="${productKey}", Description="${descriptionKey}", Barcode="${barcodeKey || '(ausente)'}"`);
  console.log(`Linhas validas: ${products.length}`);
  console.log(`Linhas invalidas (sem Product/Description): ${invalid}`);

  if (!products.length) {
    throw new Error('Nenhum produto valido para processar.');
  }

  if (dryRun) {
    console.log('Exemplos:');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.codigo} | ${p.nome} | barcode=${p.barcode || '-'}`);
    });
    console.log('Dry-run concluido. Nenhuma alteracao feita.');
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

    const selectSql = `
      SELECT id, codigo, nome, barcode::text AS barcode, categoria, subcategoria
      FROM ${TABLE_NAME}
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM($1))
      LIMIT 1
    `;

    const insertSql = `
      INSERT INTO ${TABLE_NAME}
        (codigo, barcode, nome, categoria, subcategoria, quantidade, quantidade_minima, preco_unitario)
      VALUES ($1, $2::NUMERIC(20), $3, $4, $5, 0, 0, 0)
      RETURNING id
    `;

    const updateSql = `
      UPDATE ${TABLE_NAME}
      SET nome = $2,
          barcode = $3::NUMERIC(20),
          categoria = $4,
          subcategoria = $5,
          atualizado_em = NOW()
      WHERE id = $1
    `;

    for (const product of products) {
      const existing = await client.query(selectSql, [product.codigo]);

      if (!existing.rows.length) {
        await client.query(insertSql, [
          product.codigo,
          product.barcode,
          product.nome,
          CATEGORIA,
          subcategoria
        ]);
        inserted += 1;
        continue;
      }

      const row = existing.rows[0];
      const currentBarcode = row.barcode != null ? String(row.barcode).replace(/\.0$/, '') : null;
      const nextBarcode = product.barcode != null ? String(product.barcode) : null;
      const needsUpdate =
        String(row.nome || '') !== product.nome ||
        String(row.categoria || '').toUpperCase() !== CATEGORIA ||
        String(row.subcategoria || '').toUpperCase() !== subcategoria ||
        currentBarcode !== nextBarcode;

      if (!needsUpdate) {
        unchanged += 1;
        continue;
      }

      await client.query(updateSql, [
        row.id,
        product.nome,
        product.barcode,
        CATEGORIA,
        subcategoria
      ]);
      updated += 1;
    }

    await client.query('COMMIT');

    const stats = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(TRIM(categoria)) = $1)::int AS bathware_count,
        COUNT(*) FILTER (WHERE UPPER(TRIM(subcategoria)) = $2)::int AS subcategory_count,
        COUNT(barcode)::int AS with_barcode
      FROM ${TABLE_NAME}
    `, [CATEGORIA, subcategoria]);

    console.log('Carga concluida.');
    console.log(`  Inseridos: ${inserted}`);
    console.log(`  Atualizados: ${updated}`);
    console.log(`  Sem mudanca: ${unchanged}`);
    console.log(`  Invalididos: ${invalid}`);
    if (stats.rows && stats.rows[0]) {
      console.log(`  Total warehouse_items: ${stats.rows[0].total}`);
      console.log(`  Total categoria ${CATEGORIA}: ${stats.rows[0].bathware_count}`);
      console.log(`  Total subcategoria ${subcategoria}: ${stats.rows[0].subcategory_count}`);
      console.log(`  Com barcode: ${stats.rows[0].with_barcode}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

module.exports = {
  runBathwareImport,
  loadRowsFromExcel,
  TABLE_NAME,
  CATEGORIA
};
