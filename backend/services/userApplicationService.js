const { query, getClient } = require('../config/database');
const systemApplicationService = require('./systemApplicationService');

const TABLE = 'user_applications';

function mapApplicationRow(row) {
  return {
    syapCdSeq: row.syap_cd_seq != null ? parseInt(row.syap_cd_seq, 10) : null,
    syapNmApplication: row.syap_nm_application != null ? String(row.syap_nm_application).trim() : null,
    syapDsDetailed: row.syap_ds_detailed != null ? String(row.syap_ds_detailed).trim() : null
  };
}

async function ensureFuncionarioExists(funcionarioId) {
  const result = await query(
    'SELECT id FROM funcionarios WHERE id = $1',
    [funcionarioId]
  );
  if (!result.rows.length) {
    throw new Error('Employee not found');
  }
}

async function listSelectedByFuncionario(funcionarioId) {
  const sql = `
    SELECT sa.syap_cd_seq, sa.syap_nm_application, sa.syap_ds_detailed
    FROM ${TABLE} ua
    INNER JOIN system_applications sa ON sa.syap_cd_seq = ua.syap_cd_seq
    WHERE ua.id_funcionario = $1
    ORDER BY sa.syap_nm_application, sa.syap_cd_seq
  `;

  const result = await query(sql, [funcionarioId]);
  return (result.rows || []).map(mapApplicationRow);
}

async function getAssignmentData(funcionarioId) {
  await ensureFuncionarioExists(funcionarioId);

  const allApplications = await systemApplicationService.list({});
  const selected = await listSelectedByFuncionario(funcionarioId);
  const selectedIds = new Set(selected.map((app) => app.syapCdSeq));
  const available = allApplications.filter((app) => !selectedIds.has(app.syapCdSeq));

  return {
    funcionarioId,
    available,
    selected
  };
}

async function replaceForFuncionario(funcionarioId, syapCdSeqList) {
  await ensureFuncionarioExists(funcionarioId);

  const uniqueIds = [...new Set(
    (syapCdSeqList || [])
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id >= 1 && id <= 9999)
  )];

  const client = await getClient();

  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${TABLE} WHERE id_funcionario = $1`, [funcionarioId]);

    if (uniqueIds.length > 0) {
      const values = [];
      const placeholders = uniqueIds.map((syapCdSeq, index) => {
        const base = index * 2;
        values.push(funcionarioId, syapCdSeq);
        return `($${base + 1}, $${base + 2})`;
      });

      await client.query(
        `INSERT INTO ${TABLE} (id_funcionario, syap_cd_seq) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error replacing user applications:', error);
    throw new Error(`Error saving user applications: ${error.message}`);
  } finally {
    client.release();
  }

  return getAssignmentData(funcionarioId);
}

async function listAccessibleApplications(funcionarioId) {
  return listSelectedByFuncionario(funcionarioId);
}

async function listAllApplications() {
  return systemApplicationService.list({});
}

async function hasApplicationAccess(funcionarioId, applicationName, isRoot = false) {
  if (isRoot) return true;
  if (!funcionarioId || !applicationName) return false;

  const normalizedApp = String(applicationName).trim().toLowerCase();
  const apps = await listAccessibleApplications(funcionarioId);
  return apps.some((app) => String(app.syapNmApplication || '').trim().toLowerCase() === normalizedApp);
}

module.exports = {
  getAssignmentData,
  replaceForFuncionario,
  listAccessibleApplications,
  listAllApplications,
  hasApplicationAccess
};
