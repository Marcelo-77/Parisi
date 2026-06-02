const { query, getClient } = require('../config/database');

/**
 * Lista itens de picking para a fase/phmo_sq_id = 2 e tipo de movimento (tymo_sq_id) = 1.
 * Exclui itens que já estão na fase 3 (Separation and Picking).
 */
async function listPicking() {
  const sql = `
    SELECT
      pmi.phmi_cd_id,
      pmi.phmo_sq_id,
      pmi.moit_cd_id,
      pmi.phmi_qt_movement,
      pmi.phmi_qt_picked,
      pmi.phmi_qt_double_checked,
      pmi.phmi_cd_motivo,
      pm.tymo_sq_id,
      m.move_cd_id,
      m.move_cd_movement,
      mi.product_code,
      wi.nome AS product_name
    FROM phase_movement_item pmi
    JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
    JOIN movement_item mi ON mi.moit_cd_id = pmi.moit_cd_id
    JOIN movement m ON m.move_cd_id = mi.move_cd_id
    JOIN warehouse_items wi ON wi.codigo = mi.product_code
    WHERE pm.phmo_sq_id = 2
      AND pm.tymo_sq_id = 1
      AND NOT EXISTS (
        SELECT 1
        FROM phase_movement_item p3
        WHERE p3.moit_cd_id = pmi.moit_cd_id
          AND p3.phmo_sq_id = 3
      )
    ORDER BY m.move_cd_id, pmi.phmi_cd_id;
  `;

  const result = await query(sql);
  return (result.rows || []).map(row => ({
    phmiCdId: row.phmi_cd_id != null ? parseInt(row.phmi_cd_id, 10) : null,
    phmoSqId: row.phmo_sq_id != null ? parseInt(row.phmo_sq_id, 10) : null,
    moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
    phmiQtMovement: row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null,
    phmiQtPicked: row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null,
    phmiQtDoubleChecked: row.phmi_qt_double_checked != null ? parseInt(row.phmi_qt_double_checked, 10) : null,
    phmiCdMotivo: row.phmi_cd_motivo != null ? parseInt(row.phmi_cd_motivo, 10) : null,
    tymoSqId: row.tymo_sq_id != null ? parseInt(row.tymo_sq_id, 10) : null,
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    moveCdMovement: row.move_cd_movement,
    productCode: row.product_code,
    productName: row.product_name
  }));
}

/**
 * Lista itens de Separation and Picking (fase phmo_sq_id = 3).
 * Não exibe itens que já estão na fase 4 (Sent for Double Checking).
 */
async function listSeparationPicking() {
  const sqlFull = `
    SELECT
      pmi.phmi_cd_id,
      pmi.phmo_sq_id,
      pmi.moit_cd_id,
      pmi.phmi_qt_movement,
      pmi.phmi_qt_picked,
      pmi.phmi_qt_double_checked,
      pmi.phmi_cd_motivo,
      pm.tymo_sq_id,
      m.move_cd_id,
      m.move_cd_movement,
      mi.product_code,
      wi.nome AS product_name
    FROM phase_movement_item pmi
    LEFT JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
    LEFT JOIN movement_item mi ON mi.moit_cd_id = pmi.moit_cd_id
    LEFT JOIN movement m ON m.move_cd_id = mi.move_cd_id
    LEFT JOIN warehouse_items wi ON wi.codigo = mi.product_code
    WHERE pmi.phmo_sq_id = 3
      AND NOT EXISTS (
        SELECT 1 FROM phase_movement_item p4
        WHERE p4.moit_cd_id = pmi.moit_cd_id AND p4.phmo_sq_id = 4
      )
    ORDER BY m.move_cd_id NULLS LAST, pmi.phmi_cd_id;
  `;

  let result;
  try {
    result = await query(sqlFull);
  } catch (e) {
    // Se der erro na query completa, faz fallback simples direto em phase_movement_item
    result = null;
  }

  let rows = (result && result.rows) ? result.rows : [];

  // Se por algum motivo nada foi retornado, mas existem registros na tabela base,
  // faz um SELECT direto em phase_movement_item para garantir que pelo menos os dados básicos apareçam.
  if (!rows.length) {
    const fallback = await query(`
      SELECT
        phmi_cd_id,
        phmo_sq_id,
        moit_cd_id,
        phmi_qt_movement,
        phmi_qt_picked,
        phmi_qt_double_checked,
        phmi_cd_motivo
      FROM phase_movement_item pmi
      WHERE pmi.phmo_sq_id = 3
        AND NOT EXISTS (
          SELECT 1 FROM phase_movement_item p4
          WHERE p4.moit_cd_id = pmi.moit_cd_id AND p4.phmo_sq_id = 4
        )
      ORDER BY phmi_cd_id
    `);
    rows = fallback.rows || [];
  }

  // Garantia: excluir qualquer moit_cd_id que já exista na fase 4
  const inPhase4 = await query(`
    SELECT DISTINCT moit_cd_id FROM phase_movement_item WHERE phmo_sq_id = 4
  `);
  const phase4MoitIds = new Set((inPhase4.rows || []).map(r => r.moit_cd_id));

  rows = rows.filter(row => !phase4MoitIds.has(row.moit_cd_id));

  return rows.map(row => ({
    phmiCdId: row.phmi_cd_id != null ? parseInt(row.phmi_cd_id, 10) : null,
    phmoSqId: row.phmo_sq_id != null ? parseInt(row.phmo_sq_id, 10) : null,
    moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
    phmiQtMovement: row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null,
    phmiQtPicked: row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null,
    phmiQtDoubleChecked: row.phmi_qt_double_checked != null ? parseInt(row.phmi_qt_double_checked, 10) : null,
    phmiCdMotivo: row.phmi_cd_motivo != null ? parseInt(row.phmi_cd_motivo, 10) : null,
    tymoSqId: row.tymo_sq_id != null ? parseInt(row.tymo_sq_id, 10) : null,
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    moveCdMovement: row.move_cd_movement || null,
    productCode: row.product_code || null,
    productName: row.product_name || null
  }));
}

/**
 * Lista itens de Sent for Double Checking (fase phmo_sq_id = 4).
 */
async function listDoubleChecking() {
  const sqlFull = `
    SELECT
      pmi.phmi_cd_id,
      pmi.phmo_sq_id,
      pmi.moit_cd_id,
      pmi.phmi_qt_movement,
      pmi.phmi_qt_picked,
      pmi.phmi_qt_double_checked,
      pmi.phmi_cd_motivo,
      pm.tymo_sq_id,
      m.move_cd_id,
      m.move_cd_movement,
      mi.product_code,
      wi.nome AS product_name
    FROM phase_movement_item pmi
    LEFT JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
    LEFT JOIN movement_item mi ON mi.moit_cd_id = pmi.moit_cd_id
    LEFT JOIN movement m ON m.move_cd_id = mi.move_cd_id
    LEFT JOIN warehouse_items wi ON wi.codigo = mi.product_code
    WHERE pmi.phmo_sq_id = 4
      AND pm.tymo_sq_id = 1
      AND NOT EXISTS (
        SELECT 1
        FROM phase_movement_item p_next
        WHERE p_next.moit_cd_id = pmi.moit_cd_id
          AND p_next.phmo_sq_id IN (5, 6)
      )
    ORDER BY m.move_cd_id NULLS LAST, pmi.phmi_cd_id;
  `;

  let result;
  try {
    result = await query(sqlFull);
  } catch (e) {
    result = null;
  }

  let rows = (result && result.rows) ? result.rows : [];

  if (!rows.length) {
    const fallback = await query(`
      SELECT
        pmi.phmi_cd_id,
        pmi.phmo_sq_id,
        pmi.moit_cd_id,
        pmi.phmi_qt_movement,
        pmi.phmi_qt_picked,
        pmi.phmi_qt_double_checked,
        pmi.phmi_cd_motivo
      FROM phase_movement_item pmi
      JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
      WHERE pmi.phmo_sq_id = 4
        AND pm.tymo_sq_id = 1
        AND NOT EXISTS (
          SELECT 1
          FROM phase_movement_item p_next
          WHERE p_next.moit_cd_id = pmi.moit_cd_id
            AND p_next.phmo_sq_id IN (5, 6)
        )
      ORDER BY pmi.phmi_cd_id
    `);
    rows = fallback.rows || [];
  }

  return rows.map(row => ({
    phmiCdId: row.phmi_cd_id != null ? parseInt(row.phmi_cd_id, 10) : null,
    phmoSqId: row.phmo_sq_id != null ? parseInt(row.phmo_sq_id, 10) : null,
    moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
    phmiQtMovement: row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null,
    phmiQtPicked: row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null,
    phmiQtDoubleChecked: row.phmi_qt_double_checked != null ? parseInt(row.phmi_qt_double_checked, 10) : null,
    phmiCdMotivo: row.phmi_cd_motivo != null ? parseInt(row.phmi_cd_motivo, 10) : null,
    tymoSqId: row.tymo_sq_id != null ? parseInt(row.tymo_sq_id, 10) : null,
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    moveCdMovement: row.move_cd_movement || null,
    productCode: row.product_code || null,
    productName: row.product_name || null
  }));
}

/**
 * Lista itens de Last check and Label (fase phmo_sq_id = 6).
 */
async function listLastCheckAndLabel() {
  const sqlFull = `
    SELECT
      pmi.phmi_cd_id,
      pmi.phmo_sq_id,
      pmi.moit_cd_id,
      pmi.phmi_qt_movement,
      pmi.phmi_qt_picked,
      pmi.phmi_qt_double_checked,
      pmi.phmi_cd_motivo,
      pm.tymo_sq_id,
      m.move_cd_id,
      m.move_cd_movement,
      mi.product_code,
      wi.nome AS product_name,
      pmi.phmi_ds_text
    FROM phase_movement_item pmi
    LEFT JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
    LEFT JOIN movement_item mi ON mi.moit_cd_id = pmi.moit_cd_id
    LEFT JOIN movement m ON m.move_cd_id = mi.move_cd_id
    LEFT JOIN warehouse_items wi ON wi.codigo = mi.product_code
    WHERE pmi.phmo_sq_id = 6
      AND pm.tymo_sq_id = 1
    ORDER BY m.move_cd_id NULLS LAST, pmi.phmi_cd_id;
  `;

  let result;
  try {
    result = await query(sqlFull);
  } catch (e) {
    result = null;
  }

  let rows = (result && result.rows) ? result.rows : [];

  if (!rows.length) {
    const fallback = await query(`
      SELECT
        pmi.phmi_cd_id,
        pmi.phmo_sq_id,
        pmi.moit_cd_id,
        pmi.phmi_qt_movement,
        pmi.phmi_qt_picked,
        pmi.phmi_qt_double_checked,
        pmi.phmi_cd_motivo,
        pmi.phmi_ds_text
      FROM phase_movement_item pmi
      JOIN phase_movement pm ON pm.phmo_sq_id = pmi.phmo_sq_id
      WHERE pmi.phmo_sq_id = 6
        AND pm.tymo_sq_id = 1
      ORDER BY pmi.phmi_cd_id
    `);
    rows = fallback.rows || [];
  }

  return rows.map(row => ({
    phmiCdId: row.phmi_cd_id != null ? parseInt(row.phmi_cd_id, 10) : null,
    phmoSqId: row.phmo_sq_id != null ? parseInt(row.phmo_sq_id, 10) : null,
    moitCdId: row.moit_cd_id != null ? parseInt(row.moit_cd_id, 10) : null,
    phmiQtMovement: row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null,
    phmiQtPicked: row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null,
    phmiQtDoubleChecked: row.phmi_qt_double_checked != null ? parseInt(row.phmi_qt_double_checked, 10) : null,
    phmiCdMotivo: row.phmi_cd_motivo != null ? parseInt(row.phmi_cd_motivo, 10) : null,
    tymoSqId: row.tymo_sq_id != null ? parseInt(row.tymo_sq_id, 10) : null,
    moveCdId: row.move_cd_id != null ? parseInt(row.move_cd_id, 10) : null,
    moveCdMovement: row.move_cd_movement || null,
    productCode: row.product_code || null,
    productName: row.product_name || null,
    phmiDsText: row.phmi_ds_text || null
  }));
}

/**
 * Garante que existe a fase 3 (Separation and Picking) em phase_movement.
 */
async function ensurePhase3Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 3 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Separation and Picking', 15)
  `);
}

/**
 * Garante que existe a fase 4 (Sent for Double Checking) em phase_movement.
 */
async function ensurePhase4Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 4 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Sent for Double Checking', 20)
  `);
}

/**
 * Garante que existe a fase 5 (Last check and Label) em phase_movement.
 */
async function ensurePhase5Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 5 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Last check and Label', 25)
  `);
}

/**
 * Garante que existe a fase 6 (Last check and Label / Error in Picking) em phase_movement.
 */
async function ensurePhase6Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 6 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Error in Picking', 30)
  `);
}

/**
 * Garante que existe a fase 7 (Loading onto the Truck) em phase_movement.
 */
async function ensurePhase7Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 7 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Loading onto the Truck', 35)
  `);
}

/**
 * Garante que existe a fase 10 (Error in Picking LC) em phase_movement.
 */
async function ensurePhase10Exists() {
  const check = await query(`
    SELECT 1 FROM phase_movement WHERE phmo_sq_id = 10 LIMIT 1
  `);
  if (check.rows && check.rows.length > 0) return;
  await query(`
    INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
    VALUES (1, 'Error in Picking LC', 50)
  `);
}

/**
 * Envia itens da fase 3 para a fase 4 (Double Checking).
 * items = [ { phmiCdId, phmiQtPicked, phmiCdMotivo } ]
 */
async function sendToDoubleChecking(items, funcionarioId = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items to send for double checking.');
  }

  await ensurePhase4Exists();

  const validItems = items
    .map(it => ({
      phmiCdId: it.phmiCdId != null ? parseInt(it.phmiCdId, 10) : null,
      phmiQtPicked: it.phmiQtPicked != null ? parseInt(it.phmiQtPicked, 10) : null,
      phmiCdMotivo: it.phmiCdMotivo != null ? parseInt(it.phmiCdMotivo, 10) : null
    }))
    .filter(it => it.phmiCdId != null && !isNaN(it.phmiCdId));

  if (validItems.length === 0) {
    throw new Error('Nenhum item válido para enviar ao double checking. Verifique que os itens da tabela possuem ID.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const it of validItems) {
      const sel = await client.query(`
        SELECT pmi.moit_cd_id, pmi.phmi_qt_movement
        FROM phase_movement_item pmi
        WHERE pmi.phmi_cd_id = $1 AND pmi.phmo_sq_id = 3
      `, [it.phmiCdId]);
      if (!sel.rows || sel.rows.length === 0) continue;

      const moitCdId = sel.rows[0].moit_cd_id;
      const phmiQtMovement = sel.rows[0].phmi_qt_movement != null ? parseInt(sel.rows[0].phmi_qt_movement, 10) : null;

      const ins = await client.query(`
        INSERT INTO phase_movement_item (
          phmo_sq_id,
          moit_cd_id,
          phmi_qt_movement,
          phmi_qt_picked,
          phmi_qt_double_checked,
          phmi_cd_motivo,
          id_funcionario
        )
        SELECT $1, $2, $3, $4, 0, $5, $6
        WHERE NOT EXISTS (
          SELECT 1 FROM phase_movement_item p4
          WHERE p4.moit_cd_id = $2 AND p4.phmo_sq_id = 4
        )
        RETURNING 1
      `, [4, moitCdId, phmiQtMovement, it.phmiQtPicked, it.phmiCdMotivo, funcionarioId || null]);
      if (ins.rows && ins.rows.length > 0) inserted++;
    }
    await client.query('COMMIT');
    if (inserted === 0 && validItems.length > 0) {
      throw new Error('Nenhum registro inserido (itens já podem estar na fase 4).');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Confirma os resultados do Double Checking (fase 4) e cria registros
 * nas fases 5 (erro) e 6 (OK) em phase_movement_item.
 * items = [ { phmiCdId, phmiQtDoubleChecked, phmiCdMotivo, phmiDsText } ]
 */
async function confirmDoubleChecking(items, funcionarioId = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items to confirm in double checking.');
  }

  await ensurePhase5Exists();
  await ensurePhase6Exists();

  const validItems = items
    .map(it => ({
      phmiCdId: it.phmiCdId != null ? parseInt(it.phmiCdId, 10) : null,
      phmiQtDoubleChecked: it.phmiQtDoubleChecked != null ? parseInt(it.phmiQtDoubleChecked, 10) : null,
      phmiCdMotivo: it.phmiCdMotivo != null ? parseInt(it.phmiCdMotivo, 10) : null,
      phmiDsText: typeof it.phmiDsText === 'string' && it.phmiDsText.trim()
        ? it.phmiDsText.trim().slice(0, 60)
        : null
    }))
    .filter(it =>
      it.phmiCdId != null &&
      !isNaN(it.phmiCdId) &&
      (it.phmiCdMotivo === 1 || it.phmiCdMotivo === 3)
    );

  if (validItems.length === 0) {
    throw new Error('Nenhum item válido com Reason = OK ou Double Check Error para confirmar.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    let inserted = 0;

    for (const it of validItems) {
      const sel = await client.query(`
        SELECT
          pmi.moit_cd_id,
          pmi.phmi_qt_movement,
          pmi.phmi_qt_picked
        FROM phase_movement_item pmi
        WHERE pmi.phmi_cd_id = $1 AND pmi.phmo_sq_id = 4
      `, [it.phmiCdId]);

      if (!sel.rows || sel.rows.length === 0) continue;

      const row = sel.rows[0];
      const moitCdId = row.moit_cd_id;
      const phmiQtMovement = row.phmi_qt_movement != null ? parseInt(row.phmi_qt_movement, 10) : null;
      const phmiQtPicked = row.phmi_qt_picked != null ? parseInt(row.phmi_qt_picked, 10) : null;

      // Reason 3 (Double Check Error) -> fase 5; Reason 1 (OK) -> fase 6
      const targetPhase = it.phmiCdMotivo === 3 ? 5 : 6;

      const ins = await client.query(`
        INSERT INTO phase_movement_item (
          phmo_sq_id,
          moit_cd_id,
          phmi_qt_movement,
          phmi_qt_picked,
          phmi_qt_double_checked,
          phmi_cd_motivo,
          id_funcionario,
          phmi_ds_text
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, $8
        WHERE NOT EXISTS (
          SELECT 1 FROM phase_movement_item p
          WHERE p.moit_cd_id = $2 AND p.phmo_sq_id = $1
        )
        RETURNING 1
      `, [
        targetPhase,
        moitCdId,
        phmiQtMovement,
        phmiQtPicked,
        isNaN(it.phmiQtDoubleChecked) ? null : it.phmiQtDoubleChecked,
        it.phmiCdMotivo,
        funcionarioId || null,
        it.phmiDsText
      ]);

      if (ins.rows && ins.rows.length > 0) inserted++;
    }

    await client.query('COMMIT');
    if (inserted === 0 && validItems.length > 0) {
      throw new Error('Nenhum registro inserido nas fases 5/6 (itens já podem ter sido processados).');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Cria registros de separação/picking (fase 3) para os itens selecionados.
 * Recebe uma lista de phmi_cd_id referentes à fase 2.
 */
async function separationAndPicking(phmiIds, funcionarioId = null) {
  if (!Array.isArray(phmiIds) || phmiIds.length === 0) {
    throw new Error('No items selected for Separation and Picking.');
  }

  const ids = phmiIds
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id));

  if (!ids.length) {
    throw new Error('Invalid item IDs for Separation and Picking.');
  }

  await ensurePhase3Exists();

  const sql = `
    INSERT INTO phase_movement_item (
      phmo_sq_id,
      moit_cd_id,
      phmi_qt_movement,
      phmi_qt_picked,
      phmi_qt_double_checked,
      phmi_cd_motivo,
      id_funcionario
    )
    SELECT
      3,
      p2.moit_cd_id,
      p2.phmi_qt_movement,
      0,
      0,
      NULL,
      $2
    FROM phase_movement_item p2
    JOIN phase_movement pm2 ON pm2.phmo_sq_id = p2.phmo_sq_id
    WHERE p2.phmi_cd_id = ANY($1::int[])
      AND pm2.phmo_sq_id = 2
      AND NOT EXISTS (
        SELECT 1
        FROM phase_movement_item p3
        WHERE p3.moit_cd_id = p2.moit_cd_id
          AND p3.phmo_sq_id = 3
      )
  `;

  await query(sql, [ids, funcionarioId || null]);
}

const PHASE_LAST_CHECK_LABEL = 6;
const PHASE_LOADING_TRUCK = 7;
const PHASE_ERROR_PICKING_LC = 10;

/**
 * Atualiza motivo e descrição dos itens da fase 6 (Last check and Label).
 * Em seguida: insere linhas com Reason OK (1) em phase_movement_item com phmo_sq_id = 7 (Loading onto the Truck);
 * insere linhas com Reason "Last check Error" (4) com phmo_sq_id = 10 (Error in Picking LC).
 * items = [ { phmiCdId, phmiCdMotivo, phmiDsText } ]
 */
async function saveLastCheckAndLabelItems(items, funcionarioId = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items to save for Last check and Label.');
  }

  await ensurePhase7Exists();
  await ensurePhase10Exists();

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      const phmiCdId = it.phmiCdId != null ? parseInt(it.phmiCdId, 10) : null;
      if (phmiCdId == null || isNaN(phmiCdId)) continue;

      const phmiCdMotivo = it.phmiCdMotivo !== '' && it.phmiCdMotivo != null
        ? parseInt(it.phmiCdMotivo, 10)
        : null;
      const phmiDsText = typeof it.phmiDsText === 'string' && it.phmiDsText.trim()
        ? it.phmiDsText.trim().slice(0, 255)
        : null;

      await client.query(
        `UPDATE phase_movement_item
         SET phmi_cd_motivo = $1, phmi_ds_text = $2${funcionarioId ? ', id_funcionario = $4' : ''}
         WHERE phmi_cd_id = $3 AND phmo_sq_id = ${PHASE_LAST_CHECK_LABEL}`,
        funcionarioId
          ? [phmiCdMotivo, phmiDsText, phmiCdId, funcionarioId]
          : [phmiCdMotivo, phmiDsText, phmiCdId]
      );
    }

    const idsOk = items
      .filter(it => it.phmiCdMotivo !== '' && it.phmiCdMotivo != null && parseInt(it.phmiCdMotivo, 10) === 1)
      .map(it => parseInt(it.phmiCdId, 10))
      .filter(id => !isNaN(id));
    const idsError = items
      .filter(it => it.phmiCdMotivo !== '' && it.phmiCdMotivo != null && parseInt(it.phmiCdMotivo, 10) === 4)
      .map(it => parseInt(it.phmiCdId, 10))
      .filter(id => !isNaN(id));

    if (idsOk.length > 0) {
      await client.query(`
        INSERT INTO phase_movement_item (
          phmo_sq_id, moit_cd_id, phmi_qt_movement, phmi_qt_picked,
          phmi_qt_double_checked, phmi_cd_motivo, id_funcionario, phmi_ds_text
        )
        SELECT $1, p.moit_cd_id, p.phmi_qt_movement, p.phmi_qt_picked,
               p.phmi_qt_double_checked, p.phmi_cd_motivo, p.id_funcionario, p.phmi_ds_text
        FROM phase_movement_item p
        WHERE p.phmi_cd_id = ANY($2::int[]) AND p.phmo_sq_id = ${PHASE_LAST_CHECK_LABEL}
          AND NOT EXISTS (
            SELECT 1 FROM phase_movement_item ex
            WHERE ex.moit_cd_id = p.moit_cd_id AND ex.phmo_sq_id = $1
          )
      `, [PHASE_LOADING_TRUCK, idsOk]);
    }
    if (idsError.length > 0) {
      await client.query(`
        INSERT INTO phase_movement_item (
          phmo_sq_id, moit_cd_id, phmi_qt_movement, phmi_qt_picked,
          phmi_qt_double_checked, phmi_cd_motivo, id_funcionario, phmi_ds_text
        )
        SELECT $1, p.moit_cd_id, p.phmi_qt_movement, p.phmi_qt_picked,
               p.phmi_qt_double_checked, p.phmi_cd_motivo, p.id_funcionario, p.phmi_ds_text
        FROM phase_movement_item p
        WHERE p.phmi_cd_id = ANY($2::int[]) AND p.phmo_sq_id = ${PHASE_LAST_CHECK_LABEL}
          AND NOT EXISTS (
            SELECT 1 FROM phase_movement_item ex
            WHERE ex.moit_cd_id = p.moit_cd_id AND ex.phmo_sq_id = $1
          )
      `, [PHASE_ERROR_PICKING_LC, idsError]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  listPicking,
  listSeparationPicking,
  listDoubleChecking,
  listLastCheckAndLabel,
  separationAndPicking,
  sendToDoubleChecking,
  confirmDoubleChecking,
  saveLastCheckAndLabelItems
};

