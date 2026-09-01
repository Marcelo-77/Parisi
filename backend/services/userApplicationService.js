const { query, getClient } = require('../config/database');
const systemApplicationService = require('./systemApplicationService');

const TABLE = 'user_applications';
const ACCESS_MODE_ALL = 'all';
const ACCESS_MODE_SEARCH = 'search';

function normalizeAccessMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === ACCESS_MODE_SEARCH ? ACCESS_MODE_SEARCH : ACCESS_MODE_ALL;
}

function mapApplicationRow(row) {
  return {
    syapCdSeq: row.syap_cd_seq != null ? parseInt(row.syap_cd_seq, 10) : null,
    syapNmApplication: row.syap_nm_application != null ? String(row.syap_nm_application).trim() : null,
    syapDsDetailed: row.syap_ds_detailed != null ? String(row.syap_ds_detailed).trim() : null,
    accessMode: normalizeAccessMode(row.access_mode)
  };
}

function normalizeAssignments(input) {
  if (Array.isArray(input?.assignments)) {
    const seen = new Set();
    const assignments = [];
    for (const item of input.assignments) {
      const syapCdSeq = parseInt(item?.syapCdSeq ?? item?.syap_cd_seq, 10);
      if (!Number.isInteger(syapCdSeq) || syapCdSeq < 1 || syapCdSeq > 9999 || seen.has(syapCdSeq)) {
        continue;
      }
      seen.add(syapCdSeq);
      assignments.push({
        syapCdSeq,
        accessMode: normalizeAccessMode(item?.accessMode ?? item?.access_mode)
      });
    }
    return assignments;
  }

  if (Array.isArray(input?.syapCdSeqList) || Array.isArray(input)) {
    const list = Array.isArray(input) ? input : input.syapCdSeqList;
    const seen = new Set();
    const assignments = [];
    for (const rawId of list) {
      const syapCdSeq = parseInt(rawId, 10);
      if (!Number.isInteger(syapCdSeq) || syapCdSeq < 1 || syapCdSeq > 9999 || seen.has(syapCdSeq)) {
        continue;
      }
      seen.add(syapCdSeq);
      assignments.push({ syapCdSeq, accessMode: ACCESS_MODE_ALL });
    }
    return assignments;
  }

  return [];
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
    SELECT sa.syap_cd_seq, sa.syap_nm_application, sa.syap_ds_detailed, ua.access_mode
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
  const available = allApplications
    .filter((app) => !selectedIds.has(app.syapCdSeq))
    .map((app) => ({
      ...app,
      accessMode: ACCESS_MODE_ALL
    }));

  return {
    funcionarioId,
    available,
    selected
  };
}

async function replaceForFuncionario(funcionarioId, payload) {
  await ensureFuncionarioExists(funcionarioId);

  const assignments = normalizeAssignments(payload);
  const client = await getClient();

  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${TABLE} WHERE id_funcionario = $1`, [funcionarioId]);

    if (assignments.length > 0) {
      const values = [];
      const placeholders = assignments.map((assignment, index) => {
        const base = index * 3;
        values.push(funcionarioId, assignment.syapCdSeq, assignment.accessMode);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      });

      await client.query(
        `INSERT INTO ${TABLE} (id_funcionario, syap_cd_seq, access_mode) VALUES ${placeholders.join(', ')}`,
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

async function getAccessMode(funcionarioId, applicationName, isRoot = false) {
  if (isRoot) return ACCESS_MODE_ALL;
  if (!funcionarioId || !applicationName) return null;

  const normalizedApp = String(applicationName).trim().toLowerCase();
  const apps = await listAccessibleApplications(funcionarioId);
  const match = apps.find((app) => String(app.syapNmApplication || '').trim().toLowerCase() === normalizedApp);
  return match ? match.accessMode : null;
}

function buildAccessByApplication(apps, isRoot = false) {
  if (isRoot) return {};
  const accessByApplication = {};
  for (const app of apps || []) {
    const name = app.syapNmApplication;
    if (!name) continue;
    accessByApplication[name] = normalizeAccessMode(app.accessMode);
  }
  return accessByApplication;
}

module.exports = {
  ACCESS_MODE_ALL,
  ACCESS_MODE_SEARCH,
  normalizeAccessMode,
  getAssignmentData,
  replaceForFuncionario,
  listAccessibleApplications,
  listAllApplications,
  hasApplicationAccess,
  getAccessMode,
  buildAccessByApplication
};
