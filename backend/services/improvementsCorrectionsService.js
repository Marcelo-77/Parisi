const { query } = require('../config/database');

const TABLE = 'improvements_corrections';
const REQUEST_TYPES = ['IMPROVEMENT', 'CORRECTION', 'NEW_FUNCTIONALITY'];
const SITUATIONS = ['NOT_STARTED', 'IN_DEVELOPMENT', 'IN_TESTING', 'IN_CLIENT_VALIDATION', 'APPROVED', 'NOT_APPROVED', 'LIVE', 'CANCELLED'];
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
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS request_history TEXT`).catch(() => {});
  await query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS improvements_corrections_situation_chk`).catch(() => {});
  await query(`
    ALTER TABLE ${TABLE}
    ADD CONSTRAINT improvements_corrections_situation_chk
    CHECK (situation IN (
      'NOT_STARTED', 'IN_DEVELOPMENT', 'IN_TESTING', 'IN_CLIENT_VALIDATION',
      'APPROVED', 'NOT_APPROVED', 'LIVE', 'CANCELLED'
    ))
  `).catch(() => {});
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
    requestHistory: row.request_history || '',
    status: row.status || 'OPEN',
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function formatSituationLabel(situation) {
  const value = normalizeSituation(situation);
  if (value === 'NOT_STARTED') return 'Not started';
  if (value === 'IN_DEVELOPMENT') return 'In development';
  if (value === 'IN_TESTING') return 'In testing';
  if (value === 'IN_CLIENT_VALIDATION') return 'In approval validation';
  if (value === 'APPROVED') return 'Approved';
  if (value === 'NOT_APPROVED') return 'Not Approved';
  if (value === 'LIVE') return 'Live';
  if (value === 'CANCELLED') return 'Cancelled';
  return situation || '-';
}

function formatRequestTypeLabel(type) {
  const value = normalizeRequestType(type);
  if (value === 'IMPROVEMENT') return 'Improvements';
  if (value === 'CORRECTION') return 'Corrections';
  if (value === 'NEW_FUNCTIONALITY') return 'New Functionality';
  return type || '-';
}

function formatDateLabel(value) {
  if (!value) return '-';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function sameDate(a, b) {
  return formatDateLabel(a) === formatDateLabel(b);
}

function historyTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function appendHistory(existing, lines) {
  const previous = existing != null ? String(existing).trim() : '';
  const nextLines = (Array.isArray(lines) ? lines : [lines])
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  if (!nextLines.length) return previous;
  const stamped = nextLines.map((line) => `[${historyTimestamp()}] ${line}`);
  return previous ? `${previous}\n${stamped.join('\n')}` : stamped.join('\n');
}

function buildCreateHistoryEntry(dados, createdByName) {
  const actor = createdByName || 'Unknown';
  const typeLabel = formatRequestTypeLabel(dados.requestType);
  const situationLabel = formatSituationLabel(dados.situation);
  const appLabel = dados.applicationMenu || dados.applicationName || (dados.requestType === 'NEW_FUNCTIONALITY' ? 'New Functionality' : '-');
  return `Request created by ${actor} · Type: ${typeLabel} · Situation: ${situationLabel} · Application: ${appLabel} · Request date: ${formatDateLabel(dados.requestDate)}`;
}

function buildUpdateHistoryLines(existing, next, actorName) {
  const actor = actorName || 'Unknown';
  const lines = [];

  if (normalizeRequestType(existing.requestType) !== normalizeRequestType(next.requestType)) {
    lines.push(`Type changed by ${actor}: ${formatRequestTypeLabel(existing.requestType)} → ${formatRequestTypeLabel(next.requestType)}`);
  }

  if (normalizeSituation(existing.situation) !== normalizeSituation(next.situation)) {
    lines.push(`Situation changed by ${actor}: ${formatSituationLabel(existing.situation)} → ${formatSituationLabel(next.situation)}`);
  }

  const prevApp = existing.applicationMenu || existing.applicationName || '-';
  const nextApp = next.applicationMenu || next.applicationName || '-';
  if (String(prevApp).trim() !== String(nextApp).trim()) {
    lines.push(`Application changed by ${actor}: ${prevApp} → ${nextApp}`);
  }

  if (!sameDate(existing.requestDate, next.requestDate)) {
    lines.push(`Request date changed by ${actor}: ${formatDateLabel(existing.requestDate)} → ${formatDateLabel(next.requestDate)}`);
  }

  if (!sameDate(existing.finishDate, next.finishDate)) {
    lines.push(`Finish date changed by ${actor}: ${formatDateLabel(existing.finishDate)} → ${formatDateLabel(next.finishDate)}`);
  }

  if (String(existing.description || '').trim() !== String(next.description || '').trim()) {
    lines.push(`Description updated by ${actor}`);
  }

  if (String(existing.createdByName || '') !== String(next.createdByName || '')
    || String(existing.createdBy || '') !== String(next.createdBy || '')) {
    lines.push(`Requester changed by ${actor}: ${existing.createdByName || '-'} → ${next.createdByName || '-'}`);
  }

  const note = next.historyNote != null ? String(next.historyNote).trim() : '';
  if (note) {
    lines.push(`Note by ${actor}: ${note}`);
  }

  if (!lines.length) {
    lines.push(`Request saved by ${actor} (no field changes)`);
  }

  return lines;
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

function isSituationLocked(situation) {
  const value = normalizeSituation(situation);
  return value === 'LIVE' || value === 'CANCELLED';
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
    erros.push('Situation must be Not started, In development, In testing, In approval validation, Approved, Not Approved, Live or Cancelled');
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

  const requestHistory = appendHistory(
    '',
    buildCreateHistoryEntry(
      {
        requestType,
        situation,
        applicationName,
        applicationMenu,
        requestDate
      },
      dados.createdByName
    )
  );

  const result = await query(
    `INSERT INTO ${TABLE} (
      description, request_type, application_name, application_menu,
      situation, request_date, finish_date, request_history, status, created_by, created_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9, $10)
    RETURNING *`,
    [
      description,
      requestType,
      requiresApplication(requestType) ? applicationName.substring(0, 100) : null,
      requiresApplication(requestType) ? (applicationMenu || null) : null,
      situation,
      requestDate,
      finishDate,
      requestHistory,
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

  if (isSituationLocked(existing.situation)) {
    throw new Error('Requests with situation Live or Cancelled cannot be updated');
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

  const nextSnapshot = {
    description,
    requestType,
    applicationName: requiresApplication(requestType) ? applicationName.substring(0, 100) : null,
    applicationMenu: requiresApplication(requestType) ? (applicationMenu || null) : null,
    situation,
    requestDate,
    finishDate,
    createdBy,
    createdByName,
    historyNote: dados.historyNote
  };

  const historyLines = buildUpdateHistoryLines(existing, nextSnapshot, dados.updatedByName || 'Unknown');
  const requestHistory = appendHistory(existing.requestHistory, historyLines);

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
      request_history = $10,
      atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
      description,
      requestType,
      nextSnapshot.applicationName,
      nextSnapshot.applicationMenu,
      situation,
      requestDate,
      finishDate,
      createdBy,
      createdByName,
      requestHistory,
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

async function appendHistoryLines(id, lines) {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) {
    throw new Error('Request not found');
  }
  const requestHistory = appendHistory(existing.requestHistory, lines);
  const result = await query(
    `UPDATE ${TABLE}
     SET request_history = $1, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [requestHistory, id]
  );
  return mapRow(result.rows[0]);
}

module.exports = {
  ensureTable,
  criar,
  listar,
  buscarPorId,
  atualizar,
  excluir,
  appendHistoryLines,
  REQUEST_TYPES,
  normalizeRequestType,
  requiresApplication,
  isSituationLocked,
  SITUATIONS
};
