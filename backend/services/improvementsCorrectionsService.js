const { query } = require('../config/database');

const TABLE = 'improvements_corrections';
const REQUEST_TYPES = ['IMPROVEMENT', 'CORRECTION', 'NEW_FUNCTIONALITY'];
const SITUATIONS = ['NOT_STARTED', 'IN_DEVELOPMENT', 'IN_TESTING', 'IN_CLIENT_VALIDATION', 'LIVE', 'CANCELLED'];
const REQUEST_NUMBER_SEQ = 'improvements_corrections_request_number_seq';

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query(`CREATE SEQUENCE IF NOT EXISTS ${REQUEST_NUMBER_SEQ}`);
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_number BIGINT UNIQUE NOT NULL DEFAULT nextval('${REQUEST_NUMBER_SEQ}'),
      description TEXT NOT NULL,
      request_type VARCHAR(30) NOT NULL,
      application_name VARCHAR(100),
      application_menu VARCHAR(150),
      situation VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
      request_date DATE,
      finish_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
      created_by_name VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT improvements_corrections_type_chk
        CHECK (request_type IN ('IMPROVEMENT', 'CORRECTION', 'NEW_FUNCTIONALITY'))
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_improvements_corrections_criado ON ${TABLE}(criado_em DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_improvements_corrections_type ON ${TABLE}(request_type)`);
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS request_number BIGINT`).catch(() => {});
  await query(`ALTER TABLE ${TABLE} ALTER COLUMN request_number SET DEFAULT nextval('${REQUEST_NUMBER_SEQ}')`).catch(() => {});
  await query(`UPDATE ${TABLE} SET request_number = nextval('${REQUEST_NUMBER_SEQ}') WHERE request_number IS NULL`).catch(() => {});
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_improvements_corrections_request_number ON ${TABLE}(request_number)`).catch(() => {});
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS situation VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'`).catch(() => {});
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS request_date DATE`).catch(() => {});
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS finish_date DATE`).catch(() => {});
  tableReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.request_number || null,
    description: row.description,
    requestType: row.request_type,
    applicationName: row.application_name || null,
    applicationMenu: row.application_menu || null,
    situation: row.situation || 'NOT_STARTED',
    requestDate: row.request_date || null,
    finishDate: row.finish_date || null,
    status: row.status || 'OPEN',
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function normalizeRequestType(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'IMPROVEMENTS') return 'IMPROVEMENT';
  if (normalized === 'CORRECTIONS') return 'CORRECTION';
  if (normalized === 'NEW_FUNCTIONALITY' || normalized === 'NEW_FUNCTIONALITIES') return 'NEW_FUNCTIONALITY';
  return normalized;
}

function requiresApplication(requestType) {
  return requestType === 'IMPROVEMENT' || requestType === 'CORRECTION';
}

function normalizeSituation(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function validate(dados) {
  const erros = [];
  const description = dados.description != null ? String(dados.description).trim() : '';
  const requestType = normalizeRequestType(dados.requestType);
  const applicationName = dados.applicationName != null ? String(dados.applicationName).trim() : '';
  const situationRaw = dados.situation != null ? normalizeSituation(dados.situation) : 'NOT_STARTED';
  const situation = SITUATIONS.includes(situationRaw) ? situationRaw : null;
  const requestDate = dados.requestDate ? String(dados.requestDate) : null;
  const finishDate = dados.finishDate ? String(dados.finishDate) : null;

  if (!description) erros.push('Description is required');
  if (description.length > 4000) erros.push('Description must be at most 4000 characters');
  if (!REQUEST_TYPES.includes(requestType)) {
    erros.push('Request type must be Improvements, Corrections or New Functionality');
  }
  if (requiresApplication(requestType) && !applicationName) {
    erros.push('Application is required for Improvements and Corrections');
  }

  if (!situation) {
    erros.push('Situation must be Not started, In development, In testing, In client validation, Live or Cancelled');
  }

  return { erros, description, requestType, applicationName, situation, requestDate, finishDate };
}

async function criar(dados) {
  await ensureTable();
  const { erros, description, requestType, applicationName, situation, requestDate, finishDate } = validate(dados);
  if (erros.length) {
    throw new Error(erros.join(', '));
  }

  const applicationMenu = dados.applicationMenu != null
    ? String(dados.applicationMenu).trim().substring(0, 150)
    : null;

  const result = await query(
    `INSERT INTO ${TABLE} (
      description, request_type, application_name, application_menu,
      situation, request_date, finish_date, status, created_by, created_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9)
    RETURNING *`,
    [
      description,
      requestType,
      requiresApplication(requestType) ? applicationName.substring(0, 100) : null,
      requiresApplication(requestType) ? (applicationMenu || null) : null,
      situation,
      requestDate,
      finishDate,
      dados.createdBy || null,
      dados.createdByName || null
    ]
  );
  return mapRow(result.rows[0]);
}

async function listar(filtros = {}) {
  await ensureTable();
  const where = [];
  const values = [];
  let idx = 1;

  if (filtros.requestNumber != null && String(filtros.requestNumber).trim() !== '') {
    const parsed = Number(String(filtros.requestNumber).trim());
    if (!Number.isNaN(parsed)) {
      where.push(`request_number = $${idx++}`);
      values.push(parsed);
    }
  }

  if (filtros.requestType) {
    where.push(`request_type = $${idx++}`);
    values.push(normalizeRequestType(filtros.requestType));
  }
  if (filtros.applicationName) {
    where.push(`TRIM(LOWER(application_name)) = TRIM(LOWER($${idx++}))`);
    values.push(String(filtros.applicationName).trim());
  }

  const situationFilter = filtros.situation || filtros.status; // compat
  if (situationFilter) {
    where.push(`UPPER(TRIM(situation)) = UPPER(TRIM($${idx++}))`);
    values.push(normalizeSituation(situationFilter));
  }

  if (filtros.requestDateFrom) {
    where.push(`COALESCE(request_date, criado_em::date) >= $${idx++}`);
    values.push(String(filtros.requestDateFrom));
  }

  if (filtros.requestDateTo) {
    where.push(`COALESCE(request_date, criado_em::date) <= $${idx++}`);
    values.push(String(filtros.requestDateTo));
  }

  if (filtros.finishDateFrom) {
    where.push(`finish_date >= $${idx++}`);
    values.push(String(filtros.finishDateFrom));
  }

  if (filtros.finishDateTo) {
    where.push(`finish_date <= $${idx++}`);
    values.push(String(filtros.finishDateTo));
  }

  if (filtros.description) {
    where.push(`description ILIKE '%' || $${idx++} || '%'`);
    values.push(String(filtros.description).trim());
  }

  if (filtros.createdByName) {
    where.push(`created_by_name ILIKE '%' || $${idx++} || '%'`);
    values.push(String(filtros.createdByName).trim());
  }

  const sql = `
    SELECT *
    FROM ${TABLE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY criado_em DESC
    LIMIT 200
  `;
  const result = await query(sql, values);
  return (result.rows || []).map(mapRow);
}

async function buscarPorId(id) {
  await ensureTable();
  const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return mapRow(result.rows[0] || null);
}

async function atualizar(id, dados) {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) {
    throw new Error('Request not found');
  }

  const { erros, description, requestType, applicationName, situation, requestDate, finishDate } = validate(dados);
  if (erros.length) {
    throw new Error(erros.join(', '));
  }

  const applicationMenu = dados.applicationMenu != null
    ? String(dados.applicationMenu).trim().substring(0, 150)
    : null;

  const createdBy = Object.prototype.hasOwnProperty.call(dados, 'createdBy')
    ? (dados.createdBy || null)
    : existing.createdBy;
  const createdByName = Object.prototype.hasOwnProperty.call(dados, 'createdByName')
    ? (dados.createdByName || null)
    : existing.createdByName;

  const result = await query(
    `UPDATE ${TABLE} SET
      description = $1,
      request_type = $2,
      application_name = $3,
      application_menu = $4,
      situation = $5,
      request_date = $6,
      finish_date = $7,
      created_by = $8,
      created_by_name = $9,
      atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING *`,
    [
      description,
      requestType,
      requiresApplication(requestType) ? applicationName.substring(0, 100) : null,
      requiresApplication(requestType) ? (applicationMenu || null) : null,
      situation,
      requestDate,
      finishDate,
      createdBy,
      createdByName,
      id
    ]
  );
  return mapRow(result.rows[0]);
}

async function excluir(id) {
  await ensureTable();
  const result = await query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING *`, [id]);
  if (!result.rows[0]) {
    throw new Error('Request not found');
  }
  return mapRow(result.rows[0]);
}

module.exports = {
  ensureTable,
  criar,
  listar,
  buscarPorId,
  atualizar,
  excluir,
  REQUEST_TYPES,
  normalizeRequestType,
  requiresApplication,
  SITUATIONS
};
