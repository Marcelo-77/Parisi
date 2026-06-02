// Atualiza produtos a partir do arquivo BARCODEPARISI.csv
// Regra: quando warehouse_items.codigo = CSV["COD.ART"],
//        atualizar nome = CSV["DESCRIPTION"] e barcode = CSV["BARCODE"].
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { getClient, closePool } = require('../config/database');

const CSV_PATH = path.join(__dirname, '..', 'BARCODEPARISI.csv');
const TABLE_NAME = 'warehouse_items';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Escaped quote ("")
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
  return out.map(v => v.trim());
}

function normalizeBarcode(raw) {
  if (raw == null) return null;
  const onlyDigits = String(raw).replace(/\D/g, '');
  if (!onlyDigits) return null;
  // barcode no banco: NUMERIC(20)
  return onlyDigits.slice(0, 20);
}

function codeVariants(code) {
  const base = String(code || '').trim();
  const variants = new Set([base]);
  // Fallback comum encontrado na base: "-D1." vs "-D."
  variants.add(base.replace(/-D1\./gi, '-D.'));
  return Array.from(variants).filter(Boolean);
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Arquivo não encontrado: ${CSV_PATH}`);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('Arquivo CSV sem dados para processar.');
  }

  const header = parseCsvLine(lines[0]);
  const idxCodArt = header.indexOf('COD.ART');
  const idxDescription = header.indexOf('DESCRIPTION');
  const idxBarcode = header.indexOf('BARCODE');
  if (idxCodArt < 0 || idxDescription < 0 || idxBarcode < 0) {
    throw new Error('Cabeçalho inválido. Esperado: COD.ART, DESCRIPTION, BARCODE.');
  }

  const client = await getClient();
  let updated = 0;
  let notFound = 0;
  let invalid = 0;

  try {
    await client.query('BEGIN');

    // Garante a coluna barcode para bases antigas
    await client.query(`
      ALTER TABLE ${TABLE_NAME}
      ADD COLUMN IF NOT EXISTS barcode NUMERIC(20)
    `);

    const sql = `
      UPDATE ${TABLE_NAME}
      SET nome = $1,
          barcode = $2::NUMERIC(20),
          atualizado_em = NOW()
      WHERE UPPER(TRIM(codigo)) = ANY($3::text[])
    `;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const codArt = (cols[idxCodArt] || '').trim();
      const description = (cols[idxDescription] || '').trim();
      const barcode = normalizeBarcode(cols[idxBarcode]);

      if (!codArt || !description) {
        invalid++;
        continue;
      }

      const variants = codeVariants(codArt).map(v => v.toUpperCase().trim());
      const res = await client.query(sql, [description.slice(0, 100), barcode, variants]);
      if ((res.rowCount || 0) > 0) updated++;
      else notFound++;
    }

    const stats = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(barcode)::int AS with_barcode
      FROM ${TABLE_NAME}
    `);

    await client.query('COMMIT');
    if (stats.rows && stats.rows[0]) {
      console.log(`   Itens na tabela: ${stats.rows[0].total}`);
      console.log(`   Itens com barcode preenchido: ${stats.rows[0].with_barcode}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await closePool();
  }

  console.log('✅ Atualização concluída.');
  console.log(`   Atualizados: ${updated}`);
  console.log(`   Não encontrados (codigo != COD.ART): ${notFound}`);
  console.log(`   Linhas inválidas: ${invalid}`);
}

run().catch(err => {
  console.error('❌ Erro ao atualizar produtos:', err.message);
  process.exit(1);
});

