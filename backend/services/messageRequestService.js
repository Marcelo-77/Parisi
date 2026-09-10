const { query } = require('../config/database');

const TABLE = 'message_requests';
const REQUEST_NUMBER_SEQ = 'message_requests_request_number_seq';

const MESSAGE_TYPES = ['EMAIL', 'INTERNAL', 'SMS'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUSES = ['PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'];

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;

  await query(`CREATE SEQUENCE IF NOT EXISTS ${REQUEST_NUMBER_SEQ}`);
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_number BIGINT UNIQUE NOT NULL DEFAULT nextval('${REQUEST_NUMBER_SEQ}'),
      message_type VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
      recipient_name VARCHAR(150),
      recipient_email VARCHAR(255),
      subject VARCHAR(255) NOT NULL,
      message_content TEXT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
      desired_date DATE,
      attachment_note VARCHAR(255),
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      assigned_to UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
      assigned_to_name VARCHAR(100),
      rejection_reason TEXT,
      final_subject VARCHAR(255),
      final_content TEXT,
      request_history TEXT,
      created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
      created_by_name VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT message_requests_type_chk
        CHECK (message_type IN ('EMAIL', 'INTERNAL', 'SMS')),
      CONSTRAINT message_requests_priority_chk
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
      CONSTRAINT message_requests_status_chk
        CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'))
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_message_requests_criado ON ${TABLE}(criado_em DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_message_requests_status ON ${TABLE}(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_message_requests_number ON ${TABLE}(request_number)`);

  tableReady = true;
}

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePriority(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeMessageType(value) {
  return String(value || '').trim().toUpperCase();
}

function formatStatusLabel(status) {
  const value = normalizeStatus(status);
  if (value === 'PENDING') return 'Pending';
  if (value === 'UNDER_REVIEW') return 'Under Review';
  if (value === 'IN_PROGRESS') return 'In Progress';
  if (value === 'COMPLETED') return 'Completed';
  if (value === 'CANCELLED') return 'Cancelled';
  if (value === 'ON_HOLD') return 'On Hold';
  return status || '-';
}

function formatPriorityLabel(priority) {
  const value = normalizePriority(priority);
  if (value === 'LOW') return 'Low';
  if (value === 'NORMAL') return 'Normal';
  if (value === 'HIGH') return 'High';
  if (value === 'URGENT') return 'Urgent';
  return priority || '-';
}

function formatMessageTypeLabel(type) {
  const value = normalizeMessageType(type);
  if (value === 'EMAIL') return 'Email';
  if (value === 'INTERNAL') return 'Internal';
  if (value === 'SMS') return 'SMS';
  return type || '-';
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
    .filter(Boolean)
    .map((line) => `[${historyTimestamp()}] ${line}`);
  if (!nextLines.length) return previous;
  return previous ? `${previous}\n${nextLines.join('\n')}` : nextLines.join('\n');
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.request_number || null,
    messageType: row.message_type || 'EMAIL',
    recipientName: row.recipient_name || null,
    recipientEmail: row.recipient_email || null,
    subject: row.subject,
    messageContent: row.message_content,
    priority: row.priority || 'NORMAL',
    desiredDate: row.desired_date || null,
    attachmentNote: row.attachment_note || null,
    status: row.status || 'PENDING',
    assignedTo: row.assigned_to || null,
    assignedToName: row.assigned_to_name || null,
    rejectionReason: row.rejection_reason || null,
    finalSubject: row.final_subject || null,
    finalContent: row.final_content || null,
    requestHistory: row.request_history || '',
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function validateCreate(dados) {
  const errors = [];
  const messageType = normalizeMessageType(dados.messageType || 'EMAIL');
  const priority = normalizePriority(dados.priority || 'NORMAL');
  const subject = String(dados.subject || '').trim();
  const messageContent = String(dados.messageContent || '').trim();
  const recipientEmail = String(dados.recipientEmail || '').trim();
  const assignedTo = dados.assignedTo != null ? String(dados.assignedTo).trim() : '';
  const assignedToName = String(dados.assignedToName || '').trim();

  if (!MESSAGE_TYPES.includes(messageType)) errors.push('Invalid message type');
  if (!PRIORITIES.includes(priority)) errors.push('Invalid priority');
  if (!subject) errors.push('Subject is required');
  if (!messageContent) errors.push('Message content is required');
  if (!assignedTo && !assignedToName) errors.push('Responsible user is required');
  if (messageType === 'EMAIL' && !recipientEmail) errors.push('Recipient email is required for Email type');
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    errors.push('Recipient email is invalid');
  }
  return errors;
}

async function criar(dados) {
  await ensureTable();
  const errors = validateCreate(dados);
  if (errors.length) throw new Error(errors.join('; '));

  const messageType = normalizeMessageType(dados.messageType || 'EMAIL');
  const priority = normalizePriority(dados.priority || 'NORMAL');
  const subject = String(dados.subject || '').trim();
  const messageContent = String(dados.messageContent || '').trim();
  const recipientName = String(dados.recipientName || '').trim() || null;
  const recipientEmail = String(dados.recipientEmail || '').trim() || null;
  const desiredDate = dados.desiredDate || null;
  const attachmentNote = String(dados.attachmentNote || '').trim() || null;
  const assignedTo = dados.assignedTo || null;
  const assignedToName = String(dados.assignedToName || '').trim() || null;
  const actor = String(dados.createdByName || 'User').trim() || 'User';

  const history = appendHistory('', [
    `Request created by ${actor}`,
    `Assigned to ${assignedToName || 'responsible user'}`,
    `Status set to In Progress`
  ]);

  const result = await query(
    `INSERT INTO ${TABLE} (
      message_type, recipient_name, recipient_email, subject, message_content,
      priority, desired_date, attachment_note, status,
      assigned_to, assigned_to_name, request_history,
      created_by, created_by_name, final_subject, final_content
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'IN_PROGRESS',$9,$10,$11,$12,$13,$4,$5)
    RETURNING *`,
    [
      messageType,
      recipientName,
      recipientEmail,
      subject,
      messageContent,
      priority,
      desiredDate || null,
      attachmentNote,
      assignedTo,
      assignedToName,
      history,
      dados.createdBy || null,
      actor
    ]
  );

  return mapRow(result.rows[0]);
}

async function listar(filtros = {}) {
  await ensureTable();
  const where = [];
  const values = [];
  let idx = 1;

  if (filtros.requestNumber) {
    where.push(`request_number = $${idx++}`);
    values.push(parseInt(filtros.requestNumber, 10));
  }
  if (filtros.status) {
    where.push(`status = $${idx++}`);
    values.push(normalizeStatus(filtros.status));
  }
  if (filtros.messageType) {
    where.push(`message_type = $${idx++}`);
    values.push(normalizeMessageType(filtros.messageType));
  }
  if (filtros.priority) {
    where.push(`priority = $${idx++}`);
    values.push(normalizePriority(filtros.priority));
  }
  if (filtros.subject) {
    where.push(`subject ILIKE $${idx++}`);
    values.push(`%${String(filtros.subject).trim()}%`);
  }
  if (filtros.createdByName) {
    where.push(`created_by_name ILIKE $${idx++}`);
    values.push(`%${String(filtros.createdByName).trim()}%`);
  }
  if (filtros.assignedToName) {
    where.push(`assigned_to_name ILIKE $${idx++}`);
    values.push(`%${String(filtros.assignedToName).trim()}%`);
  }
  if (filtros.recipientEmail) {
    where.push(`recipient_email ILIKE $${idx++}`);
    values.push(`%${String(filtros.recipientEmail).trim()}%`);
  }

  const sql = `
    SELECT * FROM ${TABLE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY criado_em DESC
    LIMIT 500
  `;
  const result = await query(sql, values);
  return (result.rows || []).map(mapRow);
}

async function buscarPorId(id) {
  await ensureTable();
  const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return mapRow(result.rows[0]);
}

async function atualizar(id, dados, actorName = 'User') {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');

  const messageType = normalizeMessageType(dados.messageType || existing.messageType);
  const priority = normalizePriority(dados.priority || existing.priority);
  const subject = String(dados.subject != null ? dados.subject : existing.subject).trim();
  const messageContent = String(
    dados.messageContent != null ? dados.messageContent : existing.messageContent
  ).trim();
  const recipientName = dados.recipientName != null
    ? (String(dados.recipientName).trim() || null)
    : existing.recipientName;
  const recipientEmail = dados.recipientEmail != null
    ? (String(dados.recipientEmail).trim() || null)
    : existing.recipientEmail;
  const desiredDate = dados.desiredDate !== undefined ? (dados.desiredDate || null) : existing.desiredDate;
  const attachmentNote = dados.attachmentNote !== undefined
    ? (String(dados.attachmentNote || '').trim() || null)
    : existing.attachmentNote;
  const finalSubject = dados.finalSubject != null
    ? String(dados.finalSubject).trim()
    : (existing.finalSubject || subject);
  const finalContent = dados.finalContent != null
    ? String(dados.finalContent).trim()
    : (existing.finalContent || messageContent);

  if (!subject) throw new Error('Subject is required');
  if (!messageContent) throw new Error('Message content is required');

  const history = appendHistory(existing.requestHistory, `Request updated by ${actorName}`);

  const result = await query(
    `UPDATE ${TABLE}
     SET message_type = $1,
         recipient_name = $2,
         recipient_email = $3,
         subject = $4,
         message_content = $5,
         priority = $6,
         desired_date = $7,
         attachment_note = $8,
         final_subject = $9,
         final_content = $10,
         request_history = $11,
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $12
     RETURNING *`,
    [
      messageType,
      recipientName,
      recipientEmail,
      subject,
      messageContent,
      priority,
      desiredDate,
      attachmentNote,
      finalSubject,
      finalContent,
      history,
      id
    ]
  );
  return mapRow(result.rows[0]);
}

async function setStatus(id, nextStatus, actorName, extra = {}) {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');

  const status = normalizeStatus(nextStatus);
  if (!STATUSES.includes(status)) throw new Error('Invalid status');

  const historyLines = [
    `Status changed from ${formatStatusLabel(existing.status)} to ${formatStatusLabel(status)} by ${actorName}`
  ];
  if (extra.historyNote) historyLines.push(String(extra.historyNote));

  const history = appendHistory(existing.requestHistory, historyLines);
  const result = await query(
    `UPDATE ${TABLE}
     SET status = $1,
         assigned_to = COALESCE($2, assigned_to),
         assigned_to_name = COALESCE($3, assigned_to_name),
         rejection_reason = COALESCE($4, rejection_reason),
         final_subject = COALESCE($5, final_subject),
         final_content = COALESCE($6, final_content),
         request_history = $7,
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING *`,
    [
      status,
      extra.assignedTo !== undefined ? extra.assignedTo : null,
      extra.assignedToName !== undefined ? extra.assignedToName : null,
      extra.rejectionReason !== undefined ? extra.rejectionReason : null,
      extra.finalSubject !== undefined ? extra.finalSubject : null,
      extra.finalContent !== undefined ? extra.finalContent : null,
      history,
      id
    ]
  );
  return mapRow(result.rows[0]);
}

async function submitForReview(id, actorName) {
  return setStatus(id, 'UNDER_REVIEW', actorName, {
    historyNote: `Submitted for manager review by ${actorName}`
  });
}

async function approveAndAssign(id, actorName, { assignedTo, assignedToName }) {
  if (!assignedTo && !assignedToName) {
    throw new Error('Operator assignment is required');
  }
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  if (!['PENDING', 'UNDER_REVIEW', 'ON_HOLD'].includes(normalizeStatus(existing.status))) {
    throw new Error('Only Pending, Under Review or On Hold requests can be approved and assigned');
  }
  return setStatus(id, 'IN_PROGRESS', actorName, {
    assignedTo: assignedTo || null,
    assignedToName: assignedToName || null,
    historyNote: `Approved and assigned to ${assignedToName || 'operator'} by ${actorName}`
  });
}

async function reject(id, actorName, rejectionReason) {
  const reason = String(rejectionReason || '').trim();
  if (!reason) throw new Error('Rejection reason is required');
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  if (!['PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'ON_HOLD'].includes(normalizeStatus(existing.status))) {
    throw new Error('This request cannot be rejected in its current status');
  }
  return setStatus(id, 'CANCELLED', actorName, {
    rejectionReason: reason,
    historyNote: `Rejected by ${actorName}: ${reason}`
  });
}

async function putOnHold(id, actorName, note) {
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  if (normalizeStatus(existing.status) !== 'IN_PROGRESS') {
    throw new Error('Only In Progress requests can be put On Hold');
  }
  return setStatus(id, 'ON_HOLD', actorName, {
    historyNote: `Put On Hold by ${actorName}${note ? `: ${note}` : ''}`
  });
}

async function resumeProgress(id, actorName) {
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  if (normalizeStatus(existing.status) !== 'ON_HOLD') {
    throw new Error('Only On Hold requests can be resumed');
  }
  return setStatus(id, 'IN_PROGRESS', actorName, {
    historyNote: `Resumed to In Progress by ${actorName}`
  });
}

async function markCompleted(id, actorName, { finalSubject, finalContent } = {}) {
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  if (!['IN_PROGRESS', 'ON_HOLD'].includes(normalizeStatus(existing.status))) {
    throw new Error('Only In Progress or On Hold requests can be completed');
  }
  return setStatus(id, 'COMPLETED', actorName, {
    finalSubject: finalSubject != null ? String(finalSubject).trim() : existing.finalSubject || existing.subject,
    finalContent: finalContent != null ? String(finalContent).trim() : existing.finalContent || existing.messageContent,
    historyNote: `Message marked Completed by ${actorName}`
  });
}

async function appendHistoryLine(id, line) {
  await ensureTable();
  const existing = await buscarPorId(id);
  if (!existing) throw new Error('Message request not found');
  const history = appendHistory(existing.requestHistory, line);
  const result = await query(
    `UPDATE ${TABLE}
     SET request_history = $1, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [history, id]
  );
  return mapRow(result.rows[0]);
}

module.exports = {
  MESSAGE_TYPES,
  PRIORITIES,
  STATUSES,
  ensureTable,
  formatStatusLabel,
  formatPriorityLabel,
  formatMessageTypeLabel,
  criar,
  listar,
  buscarPorId,
  atualizar,
  submitForReview,
  approveAndAssign,
  reject,
  putOnHold,
  resumeProgress,
  markCompleted,
  appendHistoryLine
};
