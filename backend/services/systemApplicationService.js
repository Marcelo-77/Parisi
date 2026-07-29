const { query } = require('../config/database');

const TABLE = 'system_applications';

function mapRow(row) {
  return {
    syapCdSeq: row.syap_cd_seq != null ? parseInt(row.syap_cd_seq, 10) : null,
    syapNmApplication: row.syap_nm_application != null ? String(row.syap_nm_application).trim() : null,
    syapDsDetailed: row.syap_ds_detailed != null ? String(row.syap_ds_detailed).trim() : null
  };
}

async function list(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.syapNmApplication && String(filters.syapNmApplication).trim()) {
    whereClauses.push(`syap_nm_application ILIKE $${idx++}`);
    values.push(`%${String(filters.syapNmApplication).trim()}%`);
  }
  if (filters.syapDsDetailed && String(filters.syapDsDetailed).trim()) {
    whereClauses.push(`syap_ds_detailed ILIKE $${idx++}`);
    values.push(`%${String(filters.syapDsDetailed).trim()}%`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
    FROM ${TABLE}
    ${where}
    ORDER BY syap_nm_application, syap_cd_seq
  `;

  try {
    const result = await query(sql, values);
    return (result.rows || []).map(mapRow);
  } catch (error) {
    console.error('❌ Error listing system applications:', error);
    throw new Error(`Error listing applications: ${error.message}`);
  }
}

async function create(data) {
  const name = (data.syapNmApplication != null && String(data.syapNmApplication).trim())
    ? String(data.syapNmApplication).trim().substring(0, 100)
    : null;
  const detailed = (data.syapDsDetailed != null && String(data.syapDsDetailed).trim())
    ? String(data.syapDsDetailed).trim().substring(0, 150)
    : null;

  if (!name) {
    throw new Error('Application name is required.');
  }

  const sql = `
    INSERT INTO ${TABLE} (syap_nm_application, syap_ds_detailed)
    VALUES ($1, $2)
    RETURNING *
  `;

  try {
    const result = await query(sql, [name, detailed]);
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('Application name already exists.');
    }
    console.error('❌ Error creating system application:', error);
    throw new Error(`Error creating application: ${error.message}`);
  }
}

async function updateDetailedDescription(syapCdSeq, syapDsDetailed) {
  const id = parseInt(syapCdSeq, 10);
  if (!id || Number.isNaN(id)) {
    throw new Error('Application ID is required.');
  }

  const detailed = (syapDsDetailed != null && String(syapDsDetailed).trim())
    ? String(syapDsDetailed).trim().substring(0, 150)
    : null;

  const sql = `
    UPDATE ${TABLE}
    SET syap_ds_detailed = $1
    WHERE syap_cd_seq = $2
    RETURNING *
  `;

  try {
    const result = await query(sql, [detailed, id]);
    if (!result.rows.length) {
      throw new Error('Application not found.');
    }
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error.message === 'Application not found.') throw error;
    console.error('❌ Error updating system application description:', error);
    throw new Error(`Error updating application description: ${error.message}`);
  }
}

module.exports = { list, create, updateDetailedDescription };
