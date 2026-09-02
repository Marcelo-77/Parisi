const { query } = require('../config/database');

const TABLE = 'email_send_logs';
const STATUSES = ['SENT', 'FAILED', 'SKIPPED'];

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_code VARCHAR(50),
      from_email VARCHAR(255) NOT NULL,
      to_email VARCHAR(255),
      to_name VARCHAR(100),
      subject VARCHAR(255) NOT NULL,
      body_preview TEXT,
      send_status VARCHAR(20) NOT NULL DEFAULT 'FAILED',
      error_message TEXT,
      reference_type VARCHAR(50),
      reference_id UUID,
      reference_number BIGINT,
      sent_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
      sent_by_name VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT email_send_logs_status_chk
        CHECK (send_status IN ('SENT', 'FAILED', 'SKIPPED'))
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_send_logs_criado ON ${TABLE}(criado_em DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON ${TABLE}(send_status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_send_logs_reference ON ${TABLE}(reference_type, reference_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_send_logs_to_email ON ${TABLE}(to_email)`);
  tableReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    messageCode: row.message_code || null,
    fromEmail: row.from_email,
    toEmail: row.to_email || null,
    toName: row.to_name || null,
    subject: row.subject,
    bodyPreview: row.body_preview || '',
    sendStatus: row.send_status,
    errorMessage: row.error_message || '',
    referenceType: row.reference_type || null,
    referenceId: row.reference_id || null,
    referenceNumber: row.reference_number != null ? row.reference_number : null,
    sentBy: row.sent_by || null,
    sentByName: row.sent_by_name || null,
    criadoEm: row.criado_em
  };
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return STATUSES.includes(normalized) ? normalized : null;
}

async function registrar(entry) {
  await ensureTable();
  const result = await query(
    `INSERT INTO ${TABLE} (
      message_code, from_email, to_email, to_name, subject, body_preview,
      send_status, error_message, reference_type, reference_id, reference_number,
      sent_by, sent_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      entry.messageCode || null,
      entry.fromEmail,
      entry.toEmail || null,
      entry.toName || null,
      entry.subject,
      entry.bodyPreview || null,
      normalizeStatus(entry.sendStatus) || 'FAILED',
      entry.errorMessage || null,
      entry.referenceType || null,
      entry.referenceId || null,
      entry.referenceNumber != null ? entry.referenceNumber : null,
      entry.sentBy || null,
      entry.sentByName || null
    ]
  );
  return mapRow(result.rows[0]);
}

async function listar(filtros = {}) {
  await ensureTable();
  const where = [];
  const values = [];
  let idx = 1;

  if (filtros.messageCode) {
    where.push(`message_code ILIKE $${idx++}`);
    values.push('%' + String(filtros.messageCode).trim().toUpperCase() + '%');
  }
  if (filtros.toEmail) {
    where.push(`to_email ILIKE $${idx++}`);
    values.push('%' + String(filtros.toEmail).trim() + '%');
  }
  if (filtros.toName) {
    where.push(`to_name ILIKE $${idx++}`);
    values.push('%' + String(filtros.toName).trim() + '%');
  }
  if (filtros.subject) {
    where.push(`subject ILIKE $${idx++}`);
    values.push('%' + String(filtros.subject).trim() + '%');
  }
  if (filtros.sendStatus) {
    where.push(`send_status = $${idx++}`);
    values.push(normalizeStatus(filtros.sendStatus));
  }
  if (filtros.referenceType) {
    where.push(`reference_type = $${idx++}`);
    values.push(String(filtros.referenceType).trim().toUpperCase());
  }
  if (filtros.referenceNumber != null && String(filtros.referenceNumber).trim() !== '') {
    const parsed = Number(String(filtros.referenceNumber).trim());
    if (!Number.isNaN(parsed)) {
      where.push(`reference_number = $${idx++}`);
      values.push(parsed);
    }
  }
  if (filtros.sentByName) {
    where.push(`sent_by_name ILIKE $${idx++}`);
    values.push('%' + String(filtros.sentByName).trim() + '%');
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
      OR to_email ILIKE $${idx}
      OR to_name ILIKE $${idx}
      OR subject ILIKE $${idx}
      OR body_preview ILIKE $${idx}
      OR sent_by_name ILIKE $${idx}
      OR error_message ILIKE $${idx}
    )`);
    values.push(term);
    idx += 1;
  }

  const sql = `
    SELECT *
    FROM ${TABLE}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
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

module.exports = {
  ensureTable,
  registrar,
  listar,
  buscarPorId,
  STATUSES
};
