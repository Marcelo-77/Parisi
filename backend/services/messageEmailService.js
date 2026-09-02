const { query } = require('../config/database');

const TABLE = 'message_emails';
const STATUSES = ['ACTIVE', 'INACTIVE'];
const CATEGORIES = ['GENERAL', 'WAREHOUSE', 'NOTIFICATION', 'WELCOME', 'OTHER'];

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_code VARCHAR(50) NOT NULL UNIQUE,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
      created_by_name VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT message_emails_status_chk
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
      CONSTRAINT message_emails_category_chk
        CHECK (category IN ('GENERAL', 'WAREHOUSE', 'NOTIFICATION', 'WELCOME', 'OTHER'))
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_message_emails_criado ON ${TABLE}(criado_em DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_message_emails_code ON ${TABLE}(message_code)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_message_emails_status ON ${TABLE}(status)`);
  tableReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    messageCode: row.message_code,
    subject: row.subject,
    body: row.body,
    category: row.category || 'GENERAL',
    status: row.status || 'ACTIVE',
    notes: row.notes || '',
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return CATEGORIES.includes(normalized) ? normalized : null;
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return STATUSES.includes(normalized) ? normalized : null;
}

function validatePayload(data, isUpdate = false) {
  const erros = [];
  const messageCode = normalizeCode(data.messageCode);
  const subject = data.subject != null ? String(data.subject).trim() : '';
  const body = data.body != null ? String(data.body).trim() : '';
  const notes = data.notes != null ? String(data.notes).trim() : '';
  const categoryRaw = data.category != null ? normalizeCategory(data.category) : 'GENERAL';
  const statusRaw = data.status != null ? normalizeStatus(data.status) : 'ACTIVE';

  if (!isUpdate && !messageCode) erros.push('Message code is required');
  if (messageCode && messageCode.length > 50) erros.push('Message code must be at most 50 characters');
  if (!subject) erros.push('Subject is required');
  if (subject.length > 255) erros.push('Subject must be at most 255 characters');
  if (!body) erros.push('Email body is required');
  if (body.length > 20000) erros.push('Email body must be at most 20000 characters');
  if (notes.length > 2000) erros.push('Notes must be at most 2000 characters');
  if (!categoryRaw) erros.push('Category is invalid');
  if (!statusRaw) erros.push('Status must be Active or Inactive');

  return {
    erros,
    messageCode,
    subject,
    body,
    notes,
    category: categoryRaw,
    status: statusRaw
  };
}

async function listar(filtros = {}) {
  await ensureTable();
  const where = [];
  const values = [];
  let idx = 1;

  if (filtros.messageCode) {
    where.push(`message_code ILIKE $${idx++}`);
    values.push('%' + normalizeCode(filtros.messageCode) + '%');
  }
  if (filtros.subject) {
    where.push(`subject ILIKE $${idx++}`);
    values.push('%' + String(filtros.subject).trim() + '%');
  }
  if (filtros.body) {
    where.push(`body ILIKE $${idx++}`);
    values.push('%' + String(filtros.body).trim() + '%');
  }
  if (filtros.notes) {
    where.push(`notes ILIKE $${idx++}`);
    values.push('%' + String(filtros.notes).trim() + '%');
  }
  if (filtros.category) {
    where.push(`category = $${idx++}`);
    values.push(normalizeCategory(filtros.category));
  }
  if (filtros.status) {
    where.push(`status = $${idx++}`);
    values.push(normalizeStatus(filtros.status));
  }
  if (filtros.createdByName) {
    where.push(`created_by_name ILIKE $${idx++}`);
    values.push('%' + String(filtros.createdByName).trim() + '%');
  }
  if (filtros.dateFrom) {
    where.push(`criado_em >= $${idx++}::timestamp`);
    values.push(String(filtros.dateFrom).trim() + ' 00:00:00');
  }
  if (filtros.dateTo) {
    where.push(`criado_em <= $${idx++}::timestamp`);
    values.push(String(filtros.dateTo).trim() + ' 23:59:59');
  }
  if (filtros.search && String(filtros.search).trim()) {
    const term = '%' + String(filtros.search).trim() + '%';
    where.push(`(
      message_code ILIKE $${idx}
      OR subject ILIKE $${idx}
      OR body ILIKE $${idx}
      OR notes ILIKE $${idx}
      OR created_by_name ILIKE $${idx}
    )`);
    values.push(term);
    idx += 1;
  }

  const sql = `
    SELECT *
    FROM ${TABLE}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY message_code ASC, criado_em DESC
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

async function buscarPorCodigo(messageCode) {
  await ensureTable();
  const result = await query(
    `SELECT * FROM ${TABLE} WHERE TRIM(UPPER(message_code)) = TRIM(UPPER($1))`,
    [normalizeCode(messageCode)]
  );
  return mapRow(result.rows[0] || null);
}

async function criar(dados) {
  await ensureTable();
  const { erros, messageCode, subject, body, notes, category, status } = validatePayload(dados, false);
  if (erros.length) throw new Error(erros.join(', '));

  const existing = await buscarPorCodigo(messageCode);
  if (existing) throw new Error('Message code already exists');

  const result = await query(
    `INSERT INTO ${TABLE} (
      message_code, subject, body, category, status, notes, created_by, created_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      messageCode,
      subject,
      body,
      category,
      status,
      notes || null,
      dados.createdBy || null,
      dados.createdByName || null
    ]
  );
  return mapRow(result.rows[0]);
}

async function atualizar(id, dados) {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message not found');

  const { erros, messageCode, subject, body, notes, category, status } = validatePayload({
    messageCode: dados.messageCode != null ? dados.messageCode : existing.messageCode,
    subject: dados.subject,
    body: dados.body,
    notes: dados.notes,
    category: dados.category,
    status: dados.status
  }, true);
  if (erros.length) throw new Error(erros.join(', '));

  if (messageCode !== normalizeCode(existing.messageCode)) {
    const duplicate = await buscarPorCodigo(messageCode);
    if (duplicate && duplicate.id !== id) throw new Error('Message code already exists');
  }

  const result = await query(
    `UPDATE ${TABLE} SET
      message_code = $1,
      subject = $2,
      body = $3,
      category = $4,
      status = $5,
      notes = $6,
      atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [messageCode, subject, body, category, status, notes || null, id]
  );
  return mapRow(result.rows[0]);
}

async function excluir(id) {
  await ensureTable();
  const result = await query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING *`, [id]);
  if (!result.rows[0]) throw new Error('Message not found');
  return mapRow(result.rows[0]);
}

module.exports = {
  ensureTable,
  listar,
  buscarPorId,
  buscarPorCodigo,
  criar,
  atualizar,
  excluir,
  STATUSES,
  CATEGORIES
};
