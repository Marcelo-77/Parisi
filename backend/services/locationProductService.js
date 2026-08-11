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
    statCdId: row.stat_cd_id != null ? String(row.stat_cd_id) : null,
    usuarioInseriu: row.usuario_inseriu || null,
    usuarioInseriuNome: resolveUsuarioInseriuNome(row)
  };
  if (row.sipr_nm_description != null) out.situationDescription = row.sipr_nm_description;
  return out;
}

function resolveUsuarioInseriuNome(row) {
  if (row.usuario_inseriu_nome) return row.usuario_inseriu_nome;
  const key = row.usuario_inseriu != null ? String(row.usuario_inseriu).trim().toLowerCase() : '';
  if (key === 'root') return 'Root';
  return null;
}

function resolveUsuarioAlterouNome(row) {
  if (row.usuario_alterou_nome) return row.usuario_alterou_nome;
  const key = row.usuario_alterou_log != null ? String(row.usuario_alterou_log).trim().toLowerCase() : '';
  if (key === 'root') return 'Root';
  return null;
}

function isFullSituationDescription(description) {
  return String(description || '').trim().toLowerCase() === 'full';
}

async function fetchSituationDescription(client, siprSqNumber) {
  const result = await client.query(
    `SELECT sipr_nm_description FROM situation_product WHERE sipr_sq_number = $1`,
    [siprSqNumber]
  );
  return (result.rows[0] && result.rows[0].sipr_nm_description)
    ? String(result.rows[0].sipr_nm_description).trim()
    : '';
}

async function adjustWarehouseItemsQuantity(client, productCode, delta) {
  const code = productCode != null ? String(productCode).trim() : '';
  const change = parseInt(delta, 10) || 0;
  if (!code || change === 0) return;

  if (change < 0) {
    const check = await client.query(
      `SELECT quantidade FROM warehouse_items WHERE codigo = $1 FOR UPDATE`,
      [code]
    );
    if (!check.rows.length) {
      console.warn(`⚠️ warehouse_items: nenhum registro com codigo="${code}" para atualizar quantidade`);
      return;
    }
    const current = parseInt(check.rows[0].quantidade, 10) || 0;
    if (current + change < 0) {
      throw new Error(`Insufficient warehouse stock for product "${code}"`);
    }
  }

  const updateRes = await client.query(
    `UPDATE warehouse_items SET quantidade = COALESCE(quantidade, 0) + $1 WHERE codigo = $2`,
    [change, code]
  );
  if (updateRes.rowCount === 0) {
    console.warn(`⚠️ warehouse_items: nenhum registro com codigo="${code}" para atualizar quantidade`);
  }
}

async function insertLogEntry(client, {
  operation,
  locationCode,
  productCode,
  siprSqNumber,
  quantityPrev,
  quantityCurrent,
  usuario
}) {
  await client.query(
    `INSERT INTO ${TABLE_LOG} (
      location_code_log,
      product_code_log,
      entry_datetime_log,
      quantity_current_prev_log,
      quantity_current_log,
      sipr_sq_number,
      usuario_alterou_log,
      operation_log
    ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)`,
    [
      locationCode,
      productCode,
      quantityPrev,
      quantityCurrent,
      siprSqNumber,
      usuario || null,
      operation
    ]
  );
}

async function criar(dados) {
  const erros = validar(dados);
  if (erros.length > 0) {
    throw new Error(`Invalid data: ${erros.join(', ')}`);
  }

  const insertSql = `
    INSERT INTO ${TABLE}
      (location_code, product_code, entry_datetime, sipr_sq_number, quantity_informed, quantity_current, stat_cd_id, usuario_inseriu)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [
    dados.locationCode,
    dados.productCode,
    dados.entryDatetime,
    dados.siprSqNumber,
    dados.quantityInformed ?? 0,
    dados.quantityCurrent ?? 0,
    dados.statCdId != null ? String(dados.statCdId).substring(0, 1) : 'A',
    dados.usuarioInseriu || null
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
      throw new Error('An active record already exists for this location, product, and situation. Duplicates are not allowed (for example, same Location + Product + Full).');
    }
    const result = await client.query(insertSql, values);
    const createdRow = result.rows[0];
    await insertLogEntry(client, {
      operation: 'INSERT',
      locationCode: createdRow.location_code,
      productCode: createdRow.product_code,
      siprSqNumber: createdRow.sipr_sq_number,
      quantityPrev: null,
      quantityCurrent: parseInt(createdRow.quantity_current, 10) || 0,
      usuario: dados.usuarioInseriu || null
    });
    const situationDesc = await fetchSituationDescription(client, dados.siprSqNumber);
    if (isFullSituationDescription(situationDesc) && quantityCurrent > 0 && productCode) {
      await adjustWarehouseItemsQuantity(client, productCode, quantityCurrent);
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
    whereClauses.push(`TRIM(LOWER(lp.location_code)) LIKE TRIM(LOWER($${idx++})) || '%'`);
    values.push(String(filtros.locationCode).trim());
  }
  if (filtros.productCode) {
    whereClauses.push(`TRIM(LOWER(lp.product_code)) = TRIM(LOWER($${idx++}))`);
    values.push(String(filtros.productCode).trim());
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
  const categoria = filtros.categoria != null ? String(filtros.categoria).trim() : '';
  const subcategoria = filtros.subcategoria != null ? String(filtros.subcategoria).trim() : '';
  if (categoria) {
    whereClauses.push(`UPPER(TRIM(COALESCE(wi.categoria, ''))) = UPPER(TRIM($${idx++}))`);
    values.push(categoria);
  }
  if (subcategoria) {
    whereClauses.push(`UPPER(TRIM(COALESCE(wi.subcategoria, ''))) = UPPER(TRIM($${idx++}))`);
    values.push(subcategoria);
  }

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  const selectSql = `
    SELECT lp.*, sp.sipr_nm_description, wi.barcode,
      CASE
        WHEN LOWER(TRIM(COALESCE(lp.usuario_inseriu, ''))) = 'root' THEN 'Root'
        ELSE f.nome
      END AS usuario_inseriu_nome,
      COALESCE(
        (
          SELECT MAX(l.entry_datetime_log)
          FROM ${TABLE_LOG} l
          WHERE TRIM(LOWER(l.location_code_log)) = TRIM(LOWER(lp.location_code))
            AND TRIM(LOWER(l.product_code_log)) = TRIM(LOWER(lp.product_code))
            AND l.sipr_sq_number = lp.sipr_sq_number
        ),
        lp.entry_datetime
      ) AS last_update_datetime
    FROM ${TABLE} lp
    LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
    LEFT JOIN warehouse_items wi ON TRIM(LOWER(wi.codigo)) = TRIM(LOWER(lp.product_code))
    LEFT JOIN funcionarios f ON f.id::text = lp.usuario_inseriu
    ${where}
    ORDER BY lp.entry_datetime DESC, lp.location_code, lp.product_code
  `;

  try {
    const result = await query(selectSql, values);
    return result.rows.map(row => ({
      ...mapRow(row),
      situationDescription: row.sipr_nm_description,
      lastUpdateDatetime: row.last_update_datetime || row.entry_datetime || null
    }));
  } catch (error) {
    console.error('❌ Error fetching location_product:', error);
    throw new Error(`Error fetching records: ${error.message}`);
  }
}

async function atualizarQuantidades(locationCode, productCode, entryDatetime, siprSqNumber, dados) {
  const sourceLocationInput = locationCode != null ? String(locationCode).trim() : '';
  const productCodeInput = productCode != null ? String(productCode).trim() : '';
  const sipr = parseInt(siprSqNumber, 10);
  if (!sourceLocationInput || !productCodeInput || Number.isNaN(sipr)) {
    throw new Error('Location, product and situation are required');
  }

  const requestedNewLocation = dados.newLocationCode != null
    ? String(dados.newLocationCode).trim()
    : '';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT lp.location_code, lp.product_code, lp.sipr_sq_number, lp.quantity_informed,
              lp.quantity_current, lp.stat_cd_id, lp.entry_datetime, sp.sipr_nm_description
       FROM ${TABLE} lp
       LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
       WHERE TRIM(LOWER(lp.location_code)) = TRIM(LOWER($1))
         AND TRIM(LOWER(lp.product_code)) = TRIM(LOWER($2))
         AND lp.sipr_sq_number = $3
       FOR UPDATE OF lp`,
      [sourceLocationInput, productCodeInput, sipr]
    );
    if (!oldResult.rows.length) {
      await client.query('ROLLBACK');
      throw new Error('Record not found');
    }

    const oldRow = oldResult.rows[0];
    const sourceLocationExact = oldRow.location_code;
    const productExact = oldRow.product_code;
    const oldQtyCurrent = parseInt(oldRow.quantity_current, 10) || 0;
    const oldQtyInformed = parseInt(oldRow.quantity_informed, 10) || 0;
    const newQtyCurrent = dados.quantityCurrent !== undefined
      ? (parseInt(dados.quantityCurrent, 10) || 0)
      : oldQtyCurrent;
    const newQtyInformed = dados.quantityInformed !== undefined
      ? (parseInt(dados.quantityInformed, 10) || 0)
      : oldQtyInformed;

    if (dados.quantityInformed !== undefined && newQtyInformed <= 0) {
      throw new Error('Quantity informed must be greater than 0');
    }
    if (newQtyCurrent < 0) {
      throw new Error('Quantity current must be a non-negative number');
    }

    let targetLocationExact = sourceLocationExact;
    if (requestedNewLocation) {
      const resolved = await resolveWarehouseLocationCode(client, requestedNewLocation);
      if (!resolved) {
        throw new Error(`Location "${requestedNewLocation}" was not found`);
      }
      targetLocationExact = resolved;
    }

    const locationChanged = String(targetLocationExact).trim().toLowerCase()
      !== String(sourceLocationExact).trim().toLowerCase();

    // Same location: update quantities only
    if (!locationChanged) {
      if (
        dados.quantityInformed === undefined
        && dados.quantityCurrent === undefined
      ) {
        throw new Error('No fields to update');
      }

      const result = await client.query(
        `UPDATE ${TABLE}
         SET quantity_informed = $1,
             quantity_current = $2
         WHERE location_code = $3 AND product_code = $4 AND sipr_sq_number = $5
         RETURNING *`,
        [newQtyInformed, newQtyCurrent, sourceLocationExact, productExact, sipr]
      );
      const updatedRow = result.rows[0];

      if (
        dados.quantityCurrent !== undefined
        && isFullSituationDescription(oldRow.sipr_nm_description)
      ) {
        await adjustWarehouseItemsQuantity(
          client,
          updatedRow.product_code,
          newQtyCurrent - oldQtyCurrent
        );
      }

      await insertLogEntry(client, {
        operation: 'UPDATE',
        locationCode: updatedRow.location_code,
        productCode: updatedRow.product_code,
        siprSqNumber: updatedRow.sipr_sq_number,
        quantityPrev: oldQtyCurrent,
        quantityCurrent: newQtyCurrent,
        usuario: dados.usuarioAlterou || null
      });

      await client.query('COMMIT');
      return mapRow(updatedRow);
    }

    // Location changed: keep log integrity with DELETE (exit) + INSERT/UPDATE (entry)
    const destExisting = await client.query(
      `SELECT location_code, product_code, sipr_sq_number, quantity_informed, quantity_current
       FROM ${TABLE}
       WHERE TRIM(LOWER(location_code)) = TRIM(LOWER($1))
         AND TRIM(LOWER(product_code)) = TRIM(LOWER($2))
         AND sipr_sq_number = $3
       FOR UPDATE`,
      [targetLocationExact, productExact, sipr]
    );

    // Exit source (always)
    await client.query(
      `DELETE FROM ${TABLE}
       WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3`,
      [sourceLocationExact, productExact, sipr]
    );
    await insertLogEntry(client, {
      operation: 'DELETE',
      locationCode: sourceLocationExact,
      productCode: productExact,
      siprSqNumber: sipr,
      quantityPrev: oldQtyCurrent,
      quantityCurrent: 0,
      usuario: dados.usuarioAlterou || null
    });

    let finalRow = null;
    if (destExisting.rows.length) {
      const destRow = destExisting.rows[0];
      const destOldQty = parseInt(destRow.quantity_current, 10) || 0;
      const destOldInformed = parseInt(destRow.quantity_informed, 10) || 0;
      const destNewQty = destOldQty + newQtyCurrent;
      const destNewInformed = destOldInformed + newQtyInformed;

      const updated = await client.query(
        `UPDATE ${TABLE}
         SET quantity_current = $1,
             quantity_informed = $2
         WHERE location_code = $3 AND product_code = $4 AND sipr_sq_number = $5
         RETURNING *`,
        [destNewQty, destNewInformed, destRow.location_code, destRow.product_code, destRow.sipr_sq_number]
      );
      finalRow = updated.rows[0];

      await insertLogEntry(client, {
        operation: 'UPDATE',
        locationCode: finalRow.location_code,
        productCode: finalRow.product_code,
        siprSqNumber: finalRow.sipr_sq_number,
        quantityPrev: destOldQty,
        quantityCurrent: destNewQty,
        usuario: dados.usuarioAlterou || null
      });
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
          (location_code, product_code, entry_datetime, sipr_sq_number,
           quantity_informed, quantity_current, stat_cd_id, usuario_inseriu)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          targetLocationExact,
          productExact,
          sipr,
          newQtyInformed,
          newQtyCurrent,
          oldRow.stat_cd_id != null ? String(oldRow.stat_cd_id).substring(0, 1) : 'A',
          dados.usuarioAlterou || null
        ]
      );
      finalRow = inserted.rows[0];

      await insertLogEntry(client, {
        operation: 'INSERT',
        locationCode: finalRow.location_code,
        productCode: finalRow.product_code,
        siprSqNumber: finalRow.sipr_sq_number,
        quantityPrev: null,
        quantityCurrent: newQtyCurrent,
        usuario: dados.usuarioAlterou || null
      });
    }

    // Location relocation is net-zero for stock; only qty delta affects warehouse when Full
    if (
      dados.quantityCurrent !== undefined
      && isFullSituationDescription(oldRow.sipr_nm_description)
    ) {
      await adjustWarehouseItemsQuantity(
        client,
        productExact,
        newQtyCurrent - oldQtyCurrent
      );
    }

    await client.query('COMMIT');
    return mapRow(finalRow);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.message === 'Record not found') throw error;
    if (error.message && error.message.startsWith('Insufficient warehouse stock')) throw error;
    if (error.message && (
      error.message.includes('was not found')
      || error.message.includes('must be greater than 0')
      || error.message.includes('non-negative')
      || error.message.includes('No fields to update')
    )) throw error;
    console.error('❌ Error updating location_product:', error);
    throw new Error(`Error updating record: ${error.message}`);
  } finally {
    client.release();
  }
}

async function deletar(locationCode, productCode, entryDatetime, siprSqNumber, dados = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT lp.location_code, lp.product_code, lp.sipr_sq_number, lp.quantity_current,
              sp.sipr_nm_description
       FROM ${TABLE} lp
       LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
       WHERE lp.location_code = $1 AND lp.product_code = $2 AND lp.sipr_sq_number = $3`,
      [locationCode, productCode, siprSqNumber]
    );
    if (!oldResult.rows.length) {
      await client.query('ROLLBACK');
      return false;
    }
    const oldRow = oldResult.rows[0];
    const oldQtyCurrent = parseInt(oldRow.quantity_current, 10) || 0;

    if (isFullSituationDescription(oldRow.sipr_nm_description) && oldQtyCurrent > 0) {
      await adjustWarehouseItemsQuantity(client, oldRow.product_code, -oldQtyCurrent);
    }

    await client.query(
      `DELETE FROM ${TABLE}
       WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3`,
      [locationCode, productCode, siprSqNumber]
    );

    await insertLogEntry(client, {
      operation: 'DELETE',
      locationCode: oldRow.location_code,
      productCode: oldRow.product_code,
      siprSqNumber: oldRow.sipr_sq_number,
      quantityPrev: oldQtyCurrent,
      quantityCurrent: 0,
      usuario: dados.usuarioAlterou || null
    });

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.message && error.message.startsWith('Insufficient warehouse stock')) throw error;
    console.error('❌ Error deleting location_product:', error);
    throw new Error(`Error deleting record: ${error.message}`);
  } finally {
    client.release();
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
  if (dados.quantityInformed != null && (isNaN(dados.quantityInformed) || dados.quantityInformed <= 0)) {
    erros.push('Quantity informed must be greater than 0');
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

function formatOperationLabel(operation) {
  const value = operation != null ? String(operation).trim().toUpperCase() : '';
  if (value === 'INSERT') return 'Insert';
  if (value === 'UPDATE') return 'Update';
  if (value === 'DELETE') return 'Delete';
  return value || '-';
}

async function resolveWarehouseLocationCode(clientOrNull, locationCode) {
  const code = locationCode != null ? String(locationCode).trim() : '';
  if (!code) return null;
  const sql = `
    SELECT location
    FROM warehouse_locations
    WHERE TRIM(LOWER(location)) = TRIM(LOWER($1))
    LIMIT 1
  `;
  const result = clientOrNull
    ? await clientOrNull.query(sql, [code])
    : await query(sql, [code]);
  if (!result.rows.length) return null;
  return String(result.rows[0].location).trim();
}

async function fetchActiveBalancesAtLocation(clientOrNull, locationCode) {
  const sql = `
    SELECT lp.*, sp.sipr_nm_description, wi.barcode
    FROM ${TABLE} lp
    LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
    LEFT JOIN warehouse_items wi ON TRIM(LOWER(wi.codigo)) = TRIM(LOWER(lp.product_code))
    WHERE TRIM(LOWER(lp.location_code)) = TRIM(LOWER($1))
      AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
      AND lp.quantity_current > 0
    ORDER BY lp.product_code, lp.sipr_sq_number
  `;
  const result = clientOrNull
    ? await clientOrNull.query(sql, [locationCode])
    : await query(sql, [locationCode]);
  return (result.rows || []).map((row) => ({
    ...mapRow(row),
    situationDescription: row.sipr_nm_description != null
      ? String(row.sipr_nm_description).trim()
      : ''
  }));
}

function buildMovePreviewRows(sourceRows, destinationRows) {
  const destMap = new Map();
  destinationRows.forEach((row) => {
    const key = `${String(row.productCode).trim().toLowerCase()}|${row.siprSqNumber}`;
    destMap.set(key, row);
  });

  return sourceRows.map((source) => {
    const key = `${String(source.productCode).trim().toLowerCase()}|${source.siprSqNumber}`;
    const existing = destMap.get(key) || null;
    const moveQty = parseInt(source.quantityCurrent, 10) || 0;
    const destBeforeQty = existing ? (parseInt(existing.quantityCurrent, 10) || 0) : 0;
    const destAfterQty = destBeforeQty + moveQty;
    return {
      productCode: source.productCode,
      barcode: source.barcode || null,
      siprSqNumber: source.siprSqNumber,
      situationDescription: source.situationDescription || '',
      quantityInformed: parseInt(source.quantityInformed, 10) || 0,
      quantityCurrent: moveQty,
      sourceQuantityBefore: moveQty,
      sourceQuantityAfter: 0,
      destinationQuantityBefore: destBeforeQty,
      destinationQuantityAfter: destAfterQty,
      action: existing ? 'merge' : 'insert',
      actionLabel: existing ? 'Merge (UPDATE dest + DELETE source)' : 'INSERT dest + DELETE source'
    };
  });
}

function buildSelectionKey(productCode, siprSqNumber) {
  const code = String(productCode || '').trim().toLowerCase();
  const sipr = Number.parseInt(siprSqNumber, 10);
  return `${code}|${Number.isNaN(sipr) ? '' : sipr}`;
}

function normalizeSelectedBalances(selectedBalances) {
  if (!Array.isArray(selectedBalances)) return [];
  const normalized = [];
  for (const item of selectedBalances) {
    const productCode = item && item.productCode != null ? String(item.productCode).trim() : '';
    const siprSqNumber = Number.parseInt(item && item.siprSqNumber, 10);
    if (!productCode || Number.isNaN(siprSqNumber)) continue;
    normalized.push({ productCode, siprSqNumber });
  }
  return normalized;
}

function buildAfterDestinationRows(destinationRows, moveRows) {
  const byKey = new Map();
  destinationRows.forEach((row) => {
    const key = `${String(row.productCode).trim().toLowerCase()}|${row.siprSqNumber}`;
    byKey.set(key, { ...row });
  });

  moveRows.forEach((move) => {
    const key = `${String(move.productCode).trim().toLowerCase()}|${move.siprSqNumber}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantityCurrent = (parseInt(existing.quantityCurrent, 10) || 0)
        + (parseInt(move.quantityCurrent, 10) || 0);
      existing.quantityInformed = (parseInt(existing.quantityInformed, 10) || 0)
        + (parseInt(move.quantityInformed, 10) || 0);
    } else {
      byKey.set(key, {
        locationCode: null,
        productCode: move.productCode,
        barcode: move.barcode || null,
        siprSqNumber: move.siprSqNumber,
        situationDescription: move.situationDescription || '',
        quantityInformed: parseInt(move.quantityInformed, 10) || 0,
        quantityCurrent: parseInt(move.quantityCurrent, 10) || 0,
        statCdId: 'A'
      });
    }
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const pc = String(a.productCode).localeCompare(String(b.productCode));
    if (pc !== 0) return pc;
    return (parseInt(a.siprSqNumber, 10) || 0) - (parseInt(b.siprSqNumber, 10) || 0);
  });
}

/** Preview before/after for moving all product balances from source location to destination. */
async function previewMoveBetweenLocations(sourceLocationCode, destinationLocationCode) {
  const sourceInput = sourceLocationCode != null ? String(sourceLocationCode).trim() : '';
  const destInput = destinationLocationCode != null ? String(destinationLocationCode).trim() : '';

  if (!sourceInput) throw new Error('Source location code is required');
  if (!destInput) throw new Error('Destination location code is required');
  if (sourceInput.toLowerCase() === destInput.toLowerCase()) {
    throw new Error('Source and destination locations must be different');
  }

  const sourceResolved = await resolveWarehouseLocationCode(null, sourceInput);
  const destResolved = await resolveWarehouseLocationCode(null, destInput);

  if (!sourceResolved) {
    throw new Error(`Source location "${sourceInput}" was not found`);
  }
  if (!destResolved) {
    throw new Error(`Destination location "${destInput}" was not found`);
  }

  const sourceRows = await fetchActiveBalancesAtLocation(null, sourceResolved);
  const destinationRows = await fetchActiveBalancesAtLocation(null, destResolved);
  const moves = buildMovePreviewRows(sourceRows, destinationRows);
  const afterDestination = buildAfterDestinationRows(destinationRows, moves).map((row) => ({
    ...row,
    locationCode: destResolved
  }));

  return {
    sourceLocationCode: sourceResolved,
    destinationLocationCode: destResolved,
    moveCount: moves.length,
    before: {
      source: sourceRows,
      destination: destinationRows
    },
    after: {
      source: [],
      destination: afterDestination
    },
    moves
  };
}

async function listarSaldosMovimentaveisDaOrigem(sourceLocationCode) {
  const sourceInput = sourceLocationCode != null ? String(sourceLocationCode).trim() : '';
  if (!sourceInput) throw new Error('Source location code is required');
  const sourceResolved = await resolveWarehouseLocationCode(null, sourceInput);
  if (!sourceResolved) {
    throw new Error(`Source location "${sourceInput}" was not found`);
  }
  const sourceRows = await fetchActiveBalancesAtLocation(null, sourceResolved);
  return {
    sourceLocationCode: sourceResolved,
    balances: sourceRows
  };
}

async function previewMoveSelectedProductsBetweenLocations(
  sourceLocationCode,
  destinationLocationCode,
  selectedBalances
) {
  const basePreview = await previewMoveBetweenLocations(sourceLocationCode, destinationLocationCode);
  const selected = normalizeSelectedBalances(selectedBalances);
  if (!selected.length) {
    throw new Error('Select at least one product from source location');
  }

  const selectedKeys = new Set(selected.map((item) => buildSelectionKey(item.productCode, item.siprSqNumber)));
  const filteredSourceRows = (basePreview.before.source || []).filter((row) =>
    selectedKeys.has(buildSelectionKey(row.productCode, row.siprSqNumber))
  );
  if (!filteredSourceRows.length) {
    throw new Error('None of the selected products has active balance at source location');
  }

  const filteredMoves = (basePreview.moves || []).filter((move) =>
    selectedKeys.has(buildSelectionKey(move.productCode, move.siprSqNumber))
  );
  const afterDestination = buildAfterDestinationRows(basePreview.before.destination || [], filteredMoves).map((row) => ({
    ...row,
    locationCode: basePreview.destinationLocationCode
  }));

  return {
    sourceLocationCode: basePreview.sourceLocationCode,
    destinationLocationCode: basePreview.destinationLocationCode,
    moveCount: filteredMoves.length,
    before: {
      source: filteredSourceRows,
      destination: basePreview.before.destination || []
    },
    after: {
      source: [],
      destination: afterDestination
    },
    moves: filteredMoves,
    selectedBalances: selected
  };
}

/**
 * Move all active product balances from source to destination.
 * Logs DELETE on source and INSERT (or UPDATE when merging) on destination.
 * Does not change warehouse_items stock (net zero relocation).
 */
async function moveBetweenLocations(sourceLocationCode, destinationLocationCode, usuario) {
  const preview = await previewMoveBetweenLocations(sourceLocationCode, destinationLocationCode);
  if (!preview.moveCount) {
    throw new Error(`No product balances to move from location "${preview.sourceLocationCode}"`);
  }

  const userKey = usuario != null ? String(usuario).trim() : '';
  if (!userKey) {
    throw new Error('Logged-in user is required to move products between locations');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sourceResolved = preview.sourceLocationCode;
    const destResolved = preview.destinationLocationCode;

    const sourceResult = await client.query(
      `SELECT lp.location_code, lp.product_code, lp.sipr_sq_number, lp.quantity_informed,
              lp.quantity_current, lp.stat_cd_id, lp.entry_datetime
       FROM ${TABLE} lp
       WHERE TRIM(LOWER(lp.location_code)) = TRIM(LOWER($1))
         AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
         AND lp.quantity_current > 0
       ORDER BY lp.product_code, lp.sipr_sq_number
       FOR UPDATE`,
      [sourceResolved]
    );

    if (!sourceResult.rows.length) {
      throw new Error(`No product balances to move from location "${sourceResolved}"`);
    }

    let moved = 0;
    let inserted = 0;
    let merged = 0;

    for (const sourceRow of sourceResult.rows) {
      const productCode = String(sourceRow.product_code).trim();
      const siprSqNumber = sourceRow.sipr_sq_number;
      const qtyCurrent = parseInt(sourceRow.quantity_current, 10) || 0;
      const qtyInformed = parseInt(sourceRow.quantity_informed, 10) || 0;
      const sourceLocationExact = sourceRow.location_code;

      const destExisting = await client.query(
        `SELECT location_code, product_code, sipr_sq_number, quantity_informed, quantity_current
         FROM ${TABLE}
         WHERE TRIM(LOWER(location_code)) = TRIM(LOWER($1))
           AND TRIM(LOWER(product_code)) = TRIM(LOWER($2))
           AND sipr_sq_number = $3
         FOR UPDATE`,
        [destResolved, productCode, siprSqNumber]
      );

      if (destExisting.rows.length) {
        const destRow = destExisting.rows[0];
        const oldDestQty = parseInt(destRow.quantity_current, 10) || 0;
        const newDestQty = oldDestQty + qtyCurrent;
        const newDestInformed = (parseInt(destRow.quantity_informed, 10) || 0) + qtyInformed;

        await client.query(
          `UPDATE ${TABLE}
           SET quantity_current = $1,
               quantity_informed = $2
           WHERE location_code = $3 AND product_code = $4 AND sipr_sq_number = $5`,
          [newDestQty, newDestInformed, destRow.location_code, destRow.product_code, destRow.sipr_sq_number]
        );

        await insertLogEntry(client, {
          operation: 'UPDATE',
          locationCode: destRow.location_code,
          productCode: destRow.product_code,
          siprSqNumber: destRow.sipr_sq_number,
          quantityPrev: oldDestQty,
          quantityCurrent: newDestQty,
          usuario: userKey
        });
        merged += 1;
      } else {
        await client.query(
          `INSERT INTO ${TABLE}
            (location_code, product_code, entry_datetime, sipr_sq_number,
             quantity_informed, quantity_current, stat_cd_id, usuario_inseriu)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)`,
          [
            destResolved,
            productCode,
            siprSqNumber,
            qtyInformed,
            qtyCurrent,
            sourceRow.stat_cd_id != null ? String(sourceRow.stat_cd_id).substring(0, 1) : 'A',
            userKey
          ]
        );

        await insertLogEntry(client, {
          operation: 'INSERT',
          locationCode: destResolved,
          productCode,
          siprSqNumber,
          quantityPrev: null,
          quantityCurrent: qtyCurrent,
          usuario: userKey
        });
        inserted += 1;
      }

      await client.query(
        `DELETE FROM ${TABLE}
         WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3`,
        [sourceLocationExact, sourceRow.product_code, siprSqNumber]
      );

      await insertLogEntry(client, {
        operation: 'DELETE',
        locationCode: sourceLocationExact,
        productCode: sourceRow.product_code,
        siprSqNumber,
        quantityPrev: qtyCurrent,
        quantityCurrent: 0,
        usuario: userKey
      });

      moved += 1;
    }

    await client.query('COMMIT');

    const afterPreview = await previewMoveBetweenLocations(sourceResolved, destResolved);
    return {
      sourceLocationCode: sourceResolved,
      destinationLocationCode: destResolved,
      moved,
      inserted,
      merged,
      before: preview.before,
      after: {
        source: afterPreview.before.source,
        destination: afterPreview.before.destination
      }
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error moving products between locations:', error);
    throw new Error(error.message || 'Error moving products between locations');
  } finally {
    client.release();
  }
}

async function moveSelectedProductsBetweenLocations(
  sourceLocationCode,
  destinationLocationCode,
  selectedBalances,
  usuario
) {
  const preview = await previewMoveSelectedProductsBetweenLocations(
    sourceLocationCode,
    destinationLocationCode,
    selectedBalances
  );
  if (!preview.moveCount) {
    throw new Error(`No selected product balances to move from location "${preview.sourceLocationCode}"`);
  }

  const selected = normalizeSelectedBalances(selectedBalances);
  const selectedKeys = new Set(selected.map((item) => buildSelectionKey(item.productCode, item.siprSqNumber)));

  const userKey = usuario != null ? String(usuario).trim() : '';
  if (!userKey) {
    throw new Error('Logged-in user is required to move products between locations');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sourceResolved = preview.sourceLocationCode;
    const destResolved = preview.destinationLocationCode;

    const sourceResult = await client.query(
      `SELECT lp.location_code, lp.product_code, lp.sipr_sq_number, lp.quantity_informed,
              lp.quantity_current, lp.stat_cd_id, lp.entry_datetime
       FROM ${TABLE} lp
       WHERE TRIM(LOWER(lp.location_code)) = TRIM(LOWER($1))
         AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
         AND lp.quantity_current > 0
       ORDER BY lp.product_code, lp.sipr_sq_number
       FOR UPDATE`,
      [sourceResolved]
    );

    const selectedSourceRows = sourceResult.rows.filter((row) =>
      selectedKeys.has(buildSelectionKey(row.product_code, row.sipr_sq_number))
    );
    if (!selectedSourceRows.length) {
      throw new Error(`No selected product balances to move from location "${sourceResolved}"`);
    }

    let moved = 0;
    let inserted = 0;
    let merged = 0;

    for (const sourceRow of selectedSourceRows) {
      const productCode = String(sourceRow.product_code).trim();
      const siprSqNumber = sourceRow.sipr_sq_number;
      const qtyCurrent = parseInt(sourceRow.quantity_current, 10) || 0;
      const qtyInformed = parseInt(sourceRow.quantity_informed, 10) || 0;
      const sourceLocationExact = sourceRow.location_code;

      const destExisting = await client.query(
        `SELECT location_code, product_code, sipr_sq_number, quantity_informed, quantity_current
         FROM ${TABLE}
         WHERE TRIM(LOWER(location_code)) = TRIM(LOWER($1))
           AND TRIM(LOWER(product_code)) = TRIM(LOWER($2))
           AND sipr_sq_number = $3
         FOR UPDATE`,
        [destResolved, productCode, siprSqNumber]
      );

      if (destExisting.rows.length) {
        const destRow = destExisting.rows[0];
        const oldDestQty = parseInt(destRow.quantity_current, 10) || 0;
        const newDestQty = oldDestQty + qtyCurrent;
        const newDestInformed = (parseInt(destRow.quantity_informed, 10) || 0) + qtyInformed;

        await client.query(
          `UPDATE ${TABLE}
           SET quantity_current = $1,
               quantity_informed = $2
           WHERE location_code = $3 AND product_code = $4 AND sipr_sq_number = $5`,
          [newDestQty, newDestInformed, destRow.location_code, destRow.product_code, destRow.sipr_sq_number]
        );

        await insertLogEntry(client, {
          operation: 'UPDATE',
          locationCode: destRow.location_code,
          productCode: destRow.product_code,
          siprSqNumber: destRow.sipr_sq_number,
          quantityPrev: oldDestQty,
          quantityCurrent: newDestQty,
          usuario: userKey
        });
        merged += 1;
      } else {
        await client.query(
          `INSERT INTO ${TABLE}
            (location_code, product_code, entry_datetime, sipr_sq_number,
             quantity_informed, quantity_current, stat_cd_id, usuario_inseriu)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)`,
          [
            destResolved,
            productCode,
            siprSqNumber,
            qtyInformed,
            qtyCurrent,
            sourceRow.stat_cd_id != null ? String(sourceRow.stat_cd_id).substring(0, 1) : 'A',
            userKey
          ]
        );

        await insertLogEntry(client, {
          operation: 'INSERT',
          locationCode: destResolved,
          productCode,
          siprSqNumber,
          quantityPrev: null,
          quantityCurrent: qtyCurrent,
          usuario: userKey
        });
        inserted += 1;
      }

      await client.query(
        `DELETE FROM ${TABLE}
         WHERE location_code = $1 AND product_code = $2 AND sipr_sq_number = $3`,
        [sourceLocationExact, sourceRow.product_code, siprSqNumber]
      );

      await insertLogEntry(client, {
        operation: 'DELETE',
        locationCode: sourceLocationExact,
        productCode: sourceRow.product_code,
        siprSqNumber,
        quantityPrev: qtyCurrent,
        quantityCurrent: 0,
        usuario: userKey
      });

      moved += 1;
    }

    await client.query('COMMIT');

    const destinationAfterRows = await fetchActiveBalancesAtLocation(client, destResolved);
    return {
      sourceLocationCode: sourceResolved,
      destinationLocationCode: destResolved,
      moved,
      inserted,
      merged,
      before: preview.before,
      after: {
        source: [],
        destination: destinationAfterRows
      }
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error moving selected products between locations:', error);
    throw new Error(error.message || 'Error moving selected products between locations');
  } finally {
    client.release();
  }
}

/** Pesquisa em location_product_log com filtros opcionais */
async function buscarLog(filtros = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;
  if (filtros.locationCodeLog) {
    whereClauses.push(`l.location_code_log ILIKE $${idx++}`);
    values.push(`%${String(filtros.locationCodeLog).trim()}%`);
  }
  if (filtros.productCodeLog) {
    whereClauses.push(`l.product_code_log ILIKE $${idx++}`);
    values.push(`%${String(filtros.productCodeLog).trim()}%`);
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

  const categoria = filtros.categoria != null ? String(filtros.categoria).trim() : '';
  const subcategoria = filtros.subcategoria != null ? String(filtros.subcategoria).trim() : '';
  if (categoria || subcategoria) {
    const existsParts = [
      'TRIM(LOWER(wi.codigo)) = TRIM(LOWER(l.product_code_log))'
    ];
    if (categoria) {
      existsParts.push(`UPPER(TRIM(COALESCE(wi.categoria, ''))) = UPPER(TRIM($${idx++}))`);
      values.push(categoria);
    }
    if (subcategoria) {
      existsParts.push(`UPPER(TRIM(COALESCE(wi.subcategoria, ''))) = UPPER(TRIM($${idx++}))`);
      values.push(subcategoria);
    }
    whereClauses.push(
      `EXISTS (
        SELECT 1
        FROM warehouse_items wi
        WHERE ${existsParts.join(' AND ')}
      )`
    );
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT l.location_code_log, l.product_code_log, l.entry_datetime_log,
           l.quantity_current_prev_log, l.quantity_current_log, l.sipr_sq_number,
           l.usuario_alterou_log, l.operation_log,
           sp.sipr_nm_description AS situation_description,
           wi.categoria AS product_categoria,
           wi.subcategoria AS product_subcategoria,
           CASE
             WHEN LOWER(TRIM(COALESCE(l.usuario_alterou_log, ''))) = 'root' THEN 'Root'
             ELSE f.nome
           END AS usuario_alterou_nome
    FROM ${TABLE_LOG} l
    LEFT JOIN situation_product sp ON sp.sipr_sq_number = l.sipr_sq_number
    LEFT JOIN funcionarios f ON f.id::text = l.usuario_alterou_log
    LEFT JOIN warehouse_items wi ON TRIM(LOWER(wi.codigo)) = TRIM(LOWER(l.product_code_log))
    ${where}
    ORDER BY l.location_code_log ASC, l.product_code_log ASC, l.entry_datetime_log ASC
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
      situationDescription: row.sipr_nm_description != null ? String(row.sipr_nm_description).trim() : '',
      operationLog: row.operation_log || null,
      operationLabel: formatOperationLabel(row.operation_log),
      categoria: row.product_categoria != null ? String(row.product_categoria).trim() : '',
      subcategoria: row.product_subcategoria != null ? String(row.product_subcategoria).trim() : '',
      usuarioAlterouLog: row.usuario_alterou_log || null,
      usuarioAlterouNome: resolveUsuarioAlterouNome(row)
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
  buscarLog,
  previewMoveBetweenLocations,
  moveBetweenLocations,
  listarSaldosMovimentaveisDaOrigem,
  previewMoveSelectedProductsBetweenLocations,
  moveSelectedProductsBetweenLocations
};
