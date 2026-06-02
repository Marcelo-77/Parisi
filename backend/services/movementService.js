const { query, getClient } = require('../config/database');

const TABLE = 'movement';
const TABLE_ITEM = 'movement_item';
const TABLE_TYPE = 'type_movement';

const DEFAULT_TYPE_MOVEMENTS = [
  ['Customer Order', 'Low'],
  ['Stock Adjustament', 'Down or UP'],
  ['Product Purchase', 'UP'],
  ['Count Check', 'Down ou UP'],
  ['Movement Between Locations', 'Down or UP']
];

async function listTypes() {
  const sql = `SELECT tymo_cd_id, tymo_nm_movement, tymo_cd_control FROM ${TABLE_TYPE} ORDER BY tymo_nm_movement`;
  try {
    let result = await query(sql);
    let rows = result.rows || [];
    if (rows.length === 0) {
      try {
        for (const [name, control] of DEFAULT_TYPE_MOVEMENTS) {
          await query(
            `INSERT INTO ${TABLE_TYPE} (tymo_nm_movement, tymo_cd_control) VALUES ($1, $2)`,
            [name, control]
          );
        }
        result = await query(sql);
        rows = result.rows || [];
      } catch (insertErr) {
        console.warn('⚠️ type_movement seed on empty:', insertErr.message);
      }
    }
    return rows.map(row => ({
      tymoCdId: parseInt(row.tymo_cd_id, 10),
      tymoNmMovement: row.tymo_nm_movement != null ? String(row.tymo_nm_movement).trim() : '',
      tymoCdControl: row.tymo_cd_control != null ? String(row.tymo_cd_control).trim() : null
    }));
  } catch (error) {
    console.error('❌ Error listing type_movement:', error);
    throw new Error(`Error listing types: ${error.message}`);
  }
}

function mapRow(row) {
  return {
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    tymoCdId: row.tymo_cd_id != null ? parseInt(row.tymo_cd_id, 10) : null,
    custCdId: row.cust_cd_id != null ? parseInt(row.cust_cd_id, 10) : null,
    moveCdDestination: row.move_cd_destination != null ? parseInt(row.move_cd_destination, 10) : null,
    moveDtMovement: row.move_dt_movement,
    moveCdMovement: row.move_cd_movement != null ? String(row.move_cd_movement).trim() : null
  };
}

function mapItemRow(row) {
  return {
    moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    productCode: row.product_code != null ? String(row.product_code).trim() : null,
    moveQtMovement: row.move_qt_movement != null ? parseInt(row.move_qt_movement, 10) : 0
  };
}

async function list(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.tymoCdId != null && filters.tymoCdId !== '') {
    whereClauses.push(`m.tymo_cd_id = $${idx++}`);
    values.push(parseInt(filters.tymoCdId, 10));
  }
  if (filters.moveDtFrom) {
    whereClauses.push(`m.move_dt_movement >= $${idx++}`);
    values.push(filters.moveDtFrom);
  }
  if (filters.moveDtTo) {
    whereClauses.push(`m.move_dt_movement <= $${idx++}`);
    values.push(filters.moveDtTo);
  }
  if (filters.moveCdMovement && String(filters.moveCdMovement).trim()) {
    whereClauses.push(`m.move_cd_movement ILIKE $${idx++}`);
    values.push(`%${String(filters.moveCdMovement).trim()}%`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      m.*,
      tm.tymo_nm_movement,
      c.cust_nm_customer,
      EXISTS (
        SELECT 1
        FROM ${TABLE_ITEM} mi
        JOIN phase_movement_item pmi ON pmi.moit_cd_id = mi.moit_cd_id
        WHERE mi.move_cd_id = m.move_cd_id
          AND pmi.phmo_sq_id = 1
      ) AS has_phase1,
      EXISTS (
        SELECT 1
        FROM ${TABLE_ITEM} mi2
        JOIN phase_movement_item pmi2 ON pmi2.moit_cd_id = mi2.moit_cd_id
        WHERE mi2.move_cd_id = m.move_cd_id
          AND pmi2.phmo_sq_id = 2
      ) AS has_phase2
    FROM ${TABLE} m
    LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
    LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
    ${where}
    ORDER BY m.move_dt_movement DESC NULLS LAST, m.move_cd_id DESC
  `;

  try {
    const result = await query(sql, values);
    return (result.rows || []).map(row => {
      const hasPhase1 = !!row.has_phase1;
      const hasPhase2 = !!row.has_phase2;
      return {
        ...mapRow(row),
        typeMovementName: row.tymo_nm_movement != null ? String(row.tymo_nm_movement).trim() : null,
        custNmCustomer: row.cust_nm_customer != null ? String(row.cust_nm_customer).trim() : null,
        canSendPicking: hasPhase1 && !hasPhase2
      };
    });
  } catch (error) {
    console.error('❌ Error listing movements:', error);
    throw new Error(`Error listing movements: ${error.message}`);
  }
}

/**
 * Lista a situação/histórico dos itens de movimento,
 * retornando todas as fases em phase_movement_item para os movimentos
 * que atendem aos mesmos filtros de Search Movement.
 */
async function listSituation(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.tymoCdId != null && filters.tymoCdId !== '') {
    whereClauses.push(`m.tymo_cd_id = $${idx++}`);
    values.push(parseInt(filters.tymoCdId, 10));
  }
  if (filters.moveDtFrom) {
    whereClauses.push(`m.move_dt_movement >= $${idx++}`);
    values.push(filters.moveDtFrom);
  }
  if (filters.moveDtTo) {
    whereClauses.push(`m.move_dt_movement <= $${idx++}`);
    values.push(filters.moveDtTo);
  }
  if (filters.moveCdMovement && String(filters.moveCdMovement).trim()) {
    whereClauses.push(`m.move_cd_movement ILIKE $${idx++}`);
    values.push(`%${String(filters.moveCdMovement).trim()}%`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      m.move_cd_id,
      m.move_cd_movement,
      m.move_dt_movement,
      tm.tymo_nm_movement,
      c.cust_nm_customer,
      mi.moit_cd_id,
      mi.product_code,
      wi.nome AS product_name,
      pmi.phmi_cd_id,
      pmi.phmo_sq_id,
      pm.phmo_ds_phase,
      pm.phmo_nr_sequence,
      pmi.phmi_qt_movement,
      pmi.phmi_qt_picked,
      pmi.phmi_qt_double_checked,
      pmi.phmi_cd_motivo,
      pmi.id_funcionario
    FROM ${TABLE} m
    JOIN ${TABLE_ITEM} mi ON mi.move_cd_id = m.move_cd_id
    JOIN phase_movement_item pmi ON pmi.moit_cd_id = mi.moit_cd_id
    LEFT JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
    LEFT JOIN ${TABLE_TYPE} tm ON tm.tymo_cd_id = m.tymo_cd_id
    LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
    LEFT JOIN warehouse_items wi ON wi.codigo = mi.product_code
    ${where}
    ORDER BY
      m.move_dt_movement DESC NULLS LAST,
      m.move_cd_id DESC,
      mi.moit_cd_id,
      pm.phmo_nr_sequence NULLS LAST,
      pmi.phmi_cd_id
  `;

  try {
    const result = await query(sql, values);
    return (result.rows || []).map(row => ({
      moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
      moveCdMovement: row.move_cd_movement != null ? String(row.move_cd_movement).trim() : null,
      moveDtMovement: row.move_dt_movement,
      typeMovementName: row.tymo_nm_movement != null ? String(row.tymo_nm_movement).trim() : null,
      custNmCustomer: row.cust_nm_customer != null ? String(row.cust_nm_customer).trim() : null,
      moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
      productCode: row.product_code != null ? String(row.product_code).trim() : null,
      productName: row.product_name != null ? String(row.product_name).trim() : null,
      phmiCdId: row.phmi_cd_id != null ? parseInt(row.phmi_cd_id, 10) : null,
      phmoSqId: row.phmo_sq_id != null ? parseInt(row.phmo_sq_id, 10) : null,
      phaseDescription: row.phmo_ds_phase != null ? String(row.phmo_ds_phase).trim() : null,
      phaseSequence: row.phmo_nr_sequence != null ? parseInt(row.phmo_nr_sequence, 10) : null,
      phmiQtMovement: row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null,
      phmiQtPicked: row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null,
      phmiQtDoubleChecked: row.phmi_qt_double_checked != null ? parseInt(row.phmi_qt_double_checked, 10) : null,
      phmiCdMotivo: row.phmi_cd_motivo != null ? parseInt(row.phmi_cd_motivo, 10) : null,
      funcionarioId: row.id_funcionario || null
    }));
  } catch (error) {
    console.error('❌ Error listing movement situation:', error);
    throw new Error(`Error listing movement situation: ${error.message}`);
  }
}
async function getById(moveCdId) {
  const id = parseInt(moveCdId, 10);
  if (isNaN(id)) return null;

  const sql = `
    SELECT m.*, tm.tymo_nm_movement, c.cust_nm_customer
    FROM ${TABLE} m
    LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
    LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
    WHERE m.move_cd_id = $1
  `;
  const itemSql = `
    SELECT mi.*
    FROM ${TABLE_ITEM} mi
    WHERE mi.move_cd_id = $1
    ORDER BY mi.product_code
  `;

  try {
    const [movRes, itemRes] = await Promise.all([
      query(sql, [id]),
      query(itemSql, [id])
    ]);
    if (!movRes.rows || movRes.rows.length === 0) return null;
    const movement = {
      ...mapRow(movRes.rows[0]),
      typeMovementName: movRes.rows[0].tymo_nm_movement != null ? String(movRes.rows[0].tymo_nm_movement).trim() : null,
      custNmCustomer: movRes.rows[0].cust_nm_customer != null ? String(movRes.rows[0].cust_nm_customer).trim() : null
    };
    movement.items = (itemRes.rows || []).map(mapItemRow);
    return movement;
  } catch (error) {
    console.error('❌ Error getting movement by id:', error);
    throw new Error(`Error getting movement: ${error.message}`);
  }
}

async function create(data) {
  const { tymoCdId, moveDtMovement, moveCdMovement, moveCdDestination, custCdId, items } = data || {};
  if (tymoCdId == null || tymoCdId === '') {
    throw new Error('Type of movement (tymoCdId) is required');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item (productCode and moveQtMovement) is required');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const insertMovement = `
      INSERT INTO ${TABLE} (tymo_cd_id, cust_cd_id, move_cd_destination, move_dt_movement, move_cd_movement)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const movRes = await client.query(insertMovement, [
      parseInt(tymoCdId, 10),
      (custCdId != null && custCdId !== '') ? parseInt(custCdId, 10) : null,
      (moveCdDestination != null && moveCdDestination !== '') ? parseInt(moveCdDestination, 10) : null,
      moveDtMovement || null,
      (moveCdMovement != null && String(moveCdMovement).trim()) ? String(moveCdMovement).trim().substring(0, 50) : null
    ]);
    const moveCdId = movRes.rows[0].move_cd_id;

    const insertItem = `
      INSERT INTO ${TABLE_ITEM} (move_cd_id, product_code, move_qt_movement)
      VALUES ($1, $2, $3)
      RETURNING moit_cd_id
    `;
    const insertPhaseItem = `
      INSERT INTO phase_movement_item (
        phmo_sq_id,
        moit_cd_id,
        phmi_qt_movement,
        phmi_qt_picked,
        phmi_qt_double_checked,
        phmi_cd_motivo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    for (const it of items) {
      const productCode = (it.productCode != null && String(it.productCode).trim()) ? String(it.productCode).trim() : null;
      const qty = parseInt(it.moveQtMovement, 10);
      if (!productCode || isNaN(qty) || qty < 0) continue;

      // Insere item do movimento e obtém o moit_cd_id gerado
      const itemRes = await client.query(insertItem, [moveCdId, productCode, qty]);
      const moitCdId = itemRes.rows && itemRes.rows[0] ? itemRes.rows[0].moit_cd_id : null;

      // Para cada item inserido, cria um registro na phase_movement_item
      // Fase inicial: phmo_sq_id = 1
      // Quantidades de picking/double check começam em 0; motivo nulo
      if (moitCdId != null) {
        await client.query(insertPhaseItem, [
          1,              // phmo_sq_id (fase 1)
          moitCdId,       // moit_cd_id do item
          qty,            // phmi_qt_movement
          0,              // phmi_qt_picked
          0,              // phmi_qt_double_checked
          null            // phmi_cd_motivo (sem motivo ainda)
        ]);
      }
    }

    await client.query('COMMIT');
    return getById(moveCdId);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') {
      throw new Error('Type movement or product not found.');
    }
    console.error('❌ Error creating movement:', error);
    throw new Error(`Error creating movement: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Envia um movimento para a fase de Picking (phmo_sq_id = 2).
 * Para todos os itens do movimento, cria registros em phase_movement_item
 * com phmo_sq_id = 2, se ainda não existirem nessa fase.
 */
async function sendToPicking(moveCdId) {
  const id = parseInt(moveCdId, 10);
  if (isNaN(id)) {
    throw new Error('Invalid movement id');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Verifica se o movimento existe
    const movRes = await client.query(
      `SELECT move_cd_id FROM ${TABLE} WHERE move_cd_id = $1`,
      [id]
    );
    if (!movRes.rows || movRes.rows.length === 0) {
      throw new Error('Movement not found');
    }

    // Verifica se já existem itens deste movimento na fase 2 (evita duplicar)
    const existsRes = await client.query(
      `SELECT 1
       FROM phase_movement_item pmi
       JOIN ${TABLE_ITEM} mi ON mi.moit_cd_id = pmi.moit_cd_id
       WHERE mi.move_cd_id = $1
         AND pmi.phmo_sq_id = 2
       LIMIT 1`,
      [id]
    );
    if (existsRes.rows && existsRes.rows.length > 0) {
      throw new Error('Movement already sent to picking phase.');
    }

    // Busca todos os itens do movimento
    const itemsRes = await client.query(
      `SELECT moit_cd_id, move_qt_movement
       FROM ${TABLE_ITEM}
       WHERE move_cd_id = $1`,
      [id]
    );
    const items = itemsRes.rows || [];
    if (!items.length) {
      throw new Error('Movement has no items to send to picking.');
    }

    // Cria registros na phase_movement_item para phmo_sq_id = 2
    const insertPhaseItem = `
      INSERT INTO phase_movement_item (
        phmo_sq_id,
        moit_cd_id,
        phmi_qt_movement,
        phmi_qt_picked,
        phmi_qt_double_checked,
        phmi_cd_motivo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const row of items) {
      const moitCdId = row.moit_cd_id;
      const qty = row.move_qt_movement != null ? parseInt(row.move_qt_movement, 10) : 0;
      if (moitCdId == null) continue;
      await client.query(insertPhaseItem, [
        2,          // phmo_sq_id = 2 (fase picking)
        moitCdId,   // item do movimento
        qty,        // quantidade do movimento
        0,          // ainda não pickado
        0,          // ainda não double checked
        null        // sem motivo
      ]);
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error sending movement to picking:', error);
    throw new Error(`Error sending movement to picking: ${error.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  listTypes,
  list,
  getById,
  create,
  sendToPicking,
  listSituation
};
