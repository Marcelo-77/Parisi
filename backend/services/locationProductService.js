const { query, getClient } = require('../config/database');

const TABLE = 'location_product';
const TABLE_LOG = 'location_product_log';

function mapRow(row) {
  const out = {
    locationCode: row.location_code,
    productCode: row.product_code,
    barcode: row.barcode != null ? String(row.barcode).trim() : null,
    entryDatetime: row.entry_datetime,
    siprSqNumber: row.sipr_sq_number,
    quantityInformed: parseInt(row.quantity_informed) || 0,
    quantityCurrent: parseInt(row.quantity_current) || 0,
    statCdId: row.stat_cd_id != null ? String(row.stat_cd_id) : null
  };
  if (row.sipr_nm_description != null) out.situationDescription = row.sipr_nm_description;
  return out;
}

async function criar(dados) {
  const erros = validar(dados);
  if (erros.length > 0) {
    throw new Error(`Invalid data: ${erros.join(', ')}`);
  }

  const insertSql = `
    INSERT INTO ${TABLE}
      (location_code, product_code, entry_datetime, sipr_sq_number, quantity_informed, quantity_current, stat_cd_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    dados.locationCode,
    dados.productCode,
    dados.entryDatetime,
    dados.siprSqNumber,
    dados.quantityInformed ?? 0,
    dados.quantityCurrent ?? 0,
    dados.statCdId != null ? String(dados.statCdId).substring(0, 1) : 'A'
  ];

  const quantityCurrent = parseInt(dados.quantityCurrent, 10) || 0;
  const productCode = String(dados.productCode || '').trim();

  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Impedir duplicata: mesmo location + product + situation (sipr_sq_number) ativo
    const checkSql = `
      SELECT 1 FROM ${TABLE}
      WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3
        AND (stat_cd_id IS NULL OR stat_cd_id = 'A')
      LIMIT 1
    `;
    const checkResult = await client.query(checkSql, [
      dados.locationCode,
      String(dados.productCode || '').trim(),
      dados.siprSqNumber
    ]);
    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new Error('Já existe um registro ativo para este local, produto e situação. Não é permitido duplicar (ex.: mesmo Location + Product + Full).');
    }
    const result = await client.query(insertSql, values);
    const isFull = await client.query(
      `SELECT sipr_nm_description FROM situation_product WHERE sipr_sq_number = $1`,
      [dados.siprSqNumber]
    );
    const situationDesc = (isFull.rows[0] && isFull.rows[0].sipr_nm_description) ? String(isFull.rows[0].sipr_nm_description).trim() : '';
    const isFullSituation = situationDesc.toLowerCase() === 'full';
    if (isFullSituation && quantityCurrent > 0 && productCode) {
      const updateRes = await client.query(
        `UPDATE warehouse_items SET quantidade = COALESCE(quantidade, 0) + $1 WHERE codigo = $2`,
        [quantityCurrent, productCode]
      );
      if (updateRes.rowCount === 0) {
        console.warn(`⚠️ warehouse_items: nenhum registro com codigo="${productCode}" para atualizar quantidade`);
      }
    }
    await client.query('COMMIT');
    return mapRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      throw new Error('Record already exists for this location, product, date/time and situation.');
    }
    if (error.code === '23503') {
      throw new Error('Location, product or situation not found.');
    }
    console.error('❌ Error creating location_product:', error);
    throw new Error(`Error creating record: ${error.message}`);
  } finally {
    client.release();
  }
}

async function buscarTodos(filtros = {}) {
  const whereClauses = [
    'lp.quantity_current > 0',
    "lp.stat_cd_id = 'A'"
  ];
  const values = [];
  let idx = 1;

  if (filtros.locationCode) {
    whereClauses.push(`lp.location_code ILIKE $${idx++}`);
    values.push(`%${filtros.locationCode}%`);
  }
  if (filtros.productCode) {
    whereClauses.push(`lp.product_code ILIKE $${idx++}`);
    values.push(`%${filtros.productCode}%`);
  }
  if (filtros.siprSqNumber) {
    whereClauses.push(`lp.sipr_sq_number = $${idx++}`);
    values.push(filtros.siprSqNumber);
  }
  if (filtros.entryFrom) {
    whereClauses.push(`lp.entry_datetime >= $${idx++}`);
    values.push(filtros.entryFrom);
  }
  if (filtros.entryTo) {
    whereClauses.push(`lp.entry_datetime <= $${idx++}`);
    values.push(filtros.entryTo);
  }

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  const selectSql = `
    SELECT lp.*, sp.sipr_nm_description, wi.barcode
    FROM ${TABLE} lp
    LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
    LEFT JOIN warehouse_items wi ON TRIM(LOWER(wi.codigo)) = TRIM(LOWER(lp.product_code))
    ${where}
    ORDER BY lp.entry_datetime DESC, lp.location_code, lp.product_code
  `;

  try {
    const result = await query(selectSql, values);
    return result.rows.map(row => ({
      ...mapRow(row),
      situationDescription: row.sipr_nm_description
    }));
  } catch (error) {
    console.error('❌ Error fetching location_product:', error);
    throw new Error(`Error fetching records: ${error.message}`);
  }
}

async function atualizarQuantidades(locationCode, productCode, entryDatetime, siprSqNumber, dados) {
  const updates = [];
  const values = [];
  let idx = 1;

  if (dados.quantityInformed !== undefined) {
    updates.push(`quantity_informed = $${idx++}`);
    values.push(dados.quantityInformed);
  }
  if (dados.quantityCurrent !== undefined) {
    updates.push(`quantity_current = $${idx++}`);
    values.push(dados.quantityCurrent);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(locationCode, productCode, siprSqNumber);

  const updateSql = `
    UPDATE ${TABLE}
    SET ${updates.join(', ')}
    WHERE location_code = $${idx++} AND product_code = $${idx++} AND sipr_sq_number = $${idx}
    RETURNING *
  `;

  try {
    const result = await query(updateSql, values);
    if (result.rows.length === 0) throw new Error('Record not found');
    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating location_product:', error);
    throw new Error(`Error updating record: ${error.message}`);
  }
}

async function deletar(locationCode, productCode, entryDatetime, siprSqNumber) {
  const deleteSql = `
    DELETE FROM ${TABLE}
    WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3
  `;
  try {
    const result = await query(deleteSql, [locationCode, productCode, siprSqNumber]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('❌ Error deleting location_product:', error);
    throw new Error(`Error deleting record: ${error.message}`);
  }
}

function validar(dados) {
  const erros = [];

  if (!dados.locationCode || String(dados.locationCode).trim().length < 1) {
    erros.push('Location code is required');
  }
  if (!dados.productCode || String(dados.productCode).trim().length < 1) {
    erros.push('Product code is required');
  }
  if (!dados.entryDatetime) {
    erros.push('Entry date and time is required');
  }
  if (dados.siprSqNumber == null || dados.siprSqNumber === '') {
    erros.push('Situation is required');
  }
  if (dados.quantityInformed != null && (isNaN(dados.quantityInformed) || dados.quantityInformed < 0)) {
    erros.push('Quantity informed must be a non-negative number');
  }
  if (dados.quantityCurrent != null && (isNaN(dados.quantityCurrent) || dados.quantityCurrent < 0)) {
    erros.push('Quantity current must be a non-negative number');
  }

  return erros;
}

/** Distinct location_code from location_product where quantity_current > 0; se vazio, retorna todos os location_code */
async function listarLocationCodesComQuantidadeInformed() {
  const sqlWithQty = `
    SELECT DISTINCT location_code
    FROM ${TABLE}
    WHERE quantity_current > 0
    ORDER BY location_code
  `;
  try {
    let result = await query(sqlWithQty);
    let codes = (result.rows || []).map(row => row.location_code != null ? row.location_code : row.locationCode).filter(Boolean);
    if (codes.length === 0) {
      const sqlAll = `
        SELECT DISTINCT location_code
        FROM ${TABLE}
        ORDER BY location_code
      `;
      result = await query(sqlAll);
      codes = (result.rows || []).map(row => row.location_code != null ? row.location_code : row.locationCode).filter(Boolean);
    }
    return codes;
  } catch (error) {
    console.error('❌ Error fetching location codes:', error);
    throw new Error(`Error fetching location codes: ${error.message}`);
  }
}

/** Distinct product_code with quantity_current > 0, active status and valid entry date */
async function listarProductCodesComQuantidadeAtiva() {
  const sql = `
    SELECT DISTINCT TRIM(lp.product_code) AS product_code
    FROM ${TABLE} lp
    WHERE lp.quantity_current > 0
      AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
      AND lp.entry_datetime IS NOT NULL
    ORDER BY product_code
  `;
  try {
    const result = await query(sql);
    return (result.rows || [])
      .map((row) => (row.product_code != null ? String(row.product_code).trim() : ''))
      .filter(Boolean);
  } catch (error) {
    console.error('❌ Error fetching product codes with location:', error);
    throw new Error(`Error fetching product codes with location: ${error.message}`);
  }
}

/** location_code, quantity_current e access_type por product_code onde situation = Full e stat_cd_id = 'A' */
async function buscarPorProdutoFullStatus(productCode) {
  if (!productCode || String(productCode).trim() === '') return [];
  const code = String(productCode).trim();
  const sql = `
    SELECT lp.location_code, lp.quantity_current, wl.access_type
    FROM ${TABLE} lp
    INNER JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
    LEFT JOIN warehouse_locations wl ON TRIM(LOWER(wl.location)) = TRIM(LOWER(lp.location_code))
    WHERE (TRIM(LOWER(lp.product_code)) = TRIM(LOWER($1)) OR lp.product_code = $1)
      AND LOWER(TRIM(COALESCE(sp.sipr_nm_description, ''))) = 'full'
      AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
      AND lp.quantity_current > 0
      AND lp.entry_datetime IS NOT NULL
    ORDER BY lp.location_code
  `;
  try {
    const result = await query(sql, [code]);
    return (result.rows || []).map(row => ({
      locationCode: row.location_code,
      quantityCurrent: parseInt(row.quantity_current, 10) || 0,
      accessType: row.access_type != null ? String(row.access_type).trim() : ''
    }));
  } catch (error) {
    console.error('❌ Error fetching location_product by product (Full):', error);
    throw new Error(`Error fetching product locations: ${error.message}`);
  }
}

/** Pesquisa em location_product_log com filtros opcionais */
async function buscarLog(filtros = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;
  if (filtros.locationCodeLog) {
    whereClauses.push(`l.location_code_log ILIKE $${idx++}`);
    values.push(`%${filtros.locationCodeLog}%`);
  }
  if (filtros.productCodeLog) {
    whereClauses.push(`l.product_code_log ILIKE $${idx++}`);
    values.push(`%${filtros.productCodeLog}%`);
  }
  if (filtros.entryFrom) {
    whereClauses.push(`l.entry_datetime_log >= $${idx++}`);
    values.push(filtros.entryFrom);
  }
  if (filtros.entryTo) {
    whereClauses.push(`l.entry_datetime_log <= $${idx++}`);
    values.push(filtros.entryTo);
  }
  if (filtros.siprSqNumber != null && filtros.siprSqNumber !== '') {
    whereClauses.push(`l.sipr_sq_number = $${idx++}`);
    values.push(parseInt(filtros.siprSqNumber, 10));
  }
  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT l.location_code_log, l.product_code_log, l.entry_datetime_log,
           l.quantity_current_prev_log, l.quantity_current_log, l.sipr_sq_number,
           sp.sipr_nm_description AS situation_description
    FROM ${TABLE_LOG} l
    LEFT JOIN situation_product sp ON sp.sipr_sq_number = l.sipr_sq_number
    ${where}
    ORDER BY l.entry_datetime_log DESC
  `;
  try {
    const result = await query(sql, values);
    return (result.rows || []).map(row => ({
      locationCodeLog: row.location_code_log,
      productCodeLog: row.product_code_log,
      entryDatetimeLog: row.entry_datetime_log,
      quantityCurrentPrevLog: row.quantity_current_prev_log != null ? parseInt(row.quantity_current_prev_log, 10) : null,
      quantityCurrentLog: row.quantity_current_log != null ? parseInt(row.quantity_current_log, 10) : null,
      siprSqNumber: row.sipr_sq_number != null ? parseInt(row.sipr_sq_number, 10) : null,
      situationDescription: row.sipr_nm_description != null ? String(row.sipr_nm_description).trim() : ''
    }));
  } catch (error) {
    console.error('❌ Error fetching location_product_log:', error);
    throw new Error(`Error fetching log: ${error.message}`);
  }
}

module.exports = {
  criar,
  buscarTodos,
  atualizarQuantidades,
  deletar,
  listarLocationCodesComQuantidadeInformed,
  listarProductCodesComQuantidadeAtiva,
  buscarPorProdutoFullStatus,
  buscarLog
};
