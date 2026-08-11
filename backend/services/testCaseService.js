const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

const TABLE = 'test_cases';
const MAX_EVIDENCE_SIZE = 7 * 1024 * 1024;

const MODULES = [
  'Sales Order',
  'Mobile Warehouse',
  'Picking',
  'Validation Code',
  'Integration',
  'PDA - Test'
];

const STATUSES = ['Not Executed', 'Pass', 'Fail', 'Blocked', 'In Progress'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const LIST_COLUMNS = `
  id, test_case_number, test_case_id, module, test_scenario, pre_condition,
  test_steps, expected_result, status, severity, tester, execution_date, comments,
  evidence_file_name, evidence_mime_type, evidence_file_size,
  created_by, created_by_name, criado_em, atualizado_em,
  (evidence_file_data IS NOT NULL AND octet_length(evidence_file_data) > 0) AS has_evidence
`;

let schemaReady = false;

function formatTestCaseId(number) {
  return `TC-${String(number).padStart(4, '0')}`;
}

function sanitizeFileName(name) {
  const base = String(name || 'evidence').split(/[/\\]/).pop().trim();
  return base.replace(/[^\w.\- ()]/g, '_').substring(0, 200) || 'evidence';
}

function mapRow(row) {
  return {
    id: row.id,
    testCaseNumber: row.test_case_number != null ? Number(row.test_case_number) : null,
    testCaseId: row.test_case_id,
    module: row.module,
    testScenario: row.test_scenario || '',
    preCondition: row.pre_condition || '',
    testSteps: row.test_steps || '',
    expectedResult: row.expected_result || '',
    status: row.status || 'Not Executed',
    severity: row.severity || 'Medium',
    tester: row.tester || '',
    executionDate: row.execution_date || null,
    comments: row.comments || '',
    evidenceFileName: row.evidence_file_name || null,
    evidenceMimeType: row.evidence_mime_type || null,
    evidenceFileSize: row.evidence_file_size != null ? Number(row.evidence_file_size) : null,
    hasEvidence: Boolean(row.has_evidence),
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function decodeBase64File(fileBase64) {
  if (!fileBase64) return null;
  const base64Data = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer.length) throw new Error('Evidence file content is empty.');
  if (buffer.length > MAX_EVIDENCE_SIZE) {
    throw new Error('Evidence file size must be less than 7 MB.');
  }
  return buffer;
}

function validatePayload(data, { requireScenario = true } = {}) {
  const moduleName = data.module != null ? String(data.module).trim() : '';
  const testScenario = data.testScenario != null ? String(data.testScenario).trim() : '';
  const status = data.status != null ? String(data.status).trim() : 'Not Executed';
  const severity = data.severity != null ? String(data.severity).trim() : 'Medium';

  if (!moduleName || !MODULES.includes(moduleName)) {
    throw new Error('Please select a valid module.');
  }
  if (requireScenario && !testScenario) {
    throw new Error('Test Scenario is required.');
  }
  if (!STATUSES.includes(status)) {
    throw new Error('Please select a valid status.');
  }
  if (!SEVERITIES.includes(severity)) {
    throw new Error('Please select a valid severity.');
  }

  return {
    module: moduleName,
    testScenario,
    preCondition: data.preCondition != null ? String(data.preCondition).trim() : '',
    testSteps: data.testSteps != null ? String(data.testSteps).trim() : '',
    expectedResult: data.expectedResult != null ? String(data.expectedResult).trim() : '',
    status,
    severity,
    tester: data.tester != null ? String(data.tester).trim().substring(0, 100) : '',
    executionDate: data.executionDate ? String(data.executionDate).trim() : null,
    comments: data.comments != null ? String(data.comments).trim() : ''
  };
}

async function ensureSchema() {
  if (schemaReady) return;
  await query(`CREATE SEQUENCE IF NOT EXISTS test_case_number_seq`);
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      test_case_number INTEGER UNIQUE NOT NULL DEFAULT nextval('test_case_number_seq'),
      test_case_id VARCHAR(20) UNIQUE NOT NULL,
      module VARCHAR(50) NOT NULL,
      test_scenario TEXT NOT NULL,
      pre_condition TEXT,
      test_steps TEXT,
      expected_result TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'Not Executed',
      severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
      tester VARCHAR(100),
      execution_date DATE,
      comments TEXT,
      evidence_file_name VARCHAR(200),
      evidence_mime_type VARCHAR(100),
      evidence_file_size INTEGER,
      evidence_file_data BYTEA,
      created_by UUID,
      created_by_name VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  schemaReady = true;
}

async function previewNextId() {
  await ensureSchema();
  const result = await query(`SELECT COALESCE(MAX(test_case_number), 0) + 1 AS n FROM ${TABLE}`);
  const number = Number(result.rows[0].n) || 1;
  return { testCaseNumber: number, testCaseId: formatTestCaseId(number) };
}

async function list(filters = {}) {
  await ensureSchema();
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.testCaseId && String(filters.testCaseId).trim()) {
    whereClauses.push(`test_case_id ILIKE $${idx++}`);
    values.push(`%${String(filters.testCaseId).trim()}%`);
  }
  if (filters.module && String(filters.module).trim()) {
    whereClauses.push(`module = $${idx++}`);
    values.push(String(filters.module).trim());
  }
  if (filters.status && String(filters.status).trim()) {
    whereClauses.push(`status = $${idx++}`);
    values.push(String(filters.status).trim());
  }
  if (filters.severity && String(filters.severity).trim()) {
    whereClauses.push(`severity = $${idx++}`);
    values.push(String(filters.severity).trim());
  }
  if (filters.tester && String(filters.tester).trim()) {
    whereClauses.push(`tester ILIKE $${idx++}`);
    values.push(`%${String(filters.tester).trim()}%`);
  }
  if (filters.testScenario && String(filters.testScenario).trim()) {
    whereClauses.push(`test_scenario ILIKE $${idx++}`);
    values.push(`%${String(filters.testScenario).trim()}%`);
  }
  if (filters.search && String(filters.search).trim()) {
    whereClauses.push(`(
      test_case_id ILIKE $${idx} OR
      test_scenario ILIKE $${idx} OR
      pre_condition ILIKE $${idx} OR
      test_steps ILIKE $${idx} OR
      expected_result ILIKE $${idx} OR
      comments ILIKE $${idx}
    )`);
    values.push(`%${String(filters.search).trim()}%`);
    idx += 1;
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT ${LIST_COLUMNS}
     FROM ${TABLE}
     ${where}
     ORDER BY test_case_number ASC`,
    values
  );
  return (result.rows || []).map(mapRow);
}

async function findById(id) {
  await ensureSchema();
  const result = await query(`SELECT ${LIST_COLUMNS} FROM ${TABLE} WHERE id = $1`, [id]);
  if (!result.rows.length) return null;
  return mapRow(result.rows[0]);
}

async function getEvidenceFile(id) {
  await ensureSchema();
  const result = await query(
    `SELECT evidence_file_name, evidence_mime_type, evidence_file_data
     FROM ${TABLE}
     WHERE id = $1`,
    [id]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  if (!row.evidence_file_data || !row.evidence_file_data.length) return null;
  return {
    fileName: row.evidence_file_name || 'evidence',
    mimeType: row.evidence_mime_type || 'application/octet-stream',
    buffer: Buffer.isBuffer(row.evidence_file_data)
      ? row.evidence_file_data
      : Buffer.from(row.evidence_file_data)
  };
}

async function create(data) {
  await ensureSchema();
  const payload = validatePayload(data);
  const evidenceBuffer = decodeBase64File(data.fileBase64);
  const evidenceName = evidenceBuffer ? sanitizeFileName(data.fileName) : null;
  const evidenceMime = evidenceBuffer
    ? String(data.mimeType || 'application/octet-stream').substring(0, 100)
    : null;

  const numberResult = await query(`SELECT nextval('test_case_number_seq') AS n`);
  const testCaseNumber = Number(numberResult.rows[0].n);
  const testCaseId = formatTestCaseId(testCaseNumber);
  const id = uuidv4();

  const result = await query(
    `INSERT INTO ${TABLE} (
      id, test_case_number, test_case_id, module, test_scenario, pre_condition,
      test_steps, expected_result, status, severity, tester, execution_date, comments,
      evidence_file_name, evidence_mime_type, evidence_file_size, evidence_file_data,
      created_by, created_by_name
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19
    )
    RETURNING ${LIST_COLUMNS}`,
    [
      id,
      testCaseNumber,
      testCaseId,
      payload.module,
      payload.testScenario,
      payload.preCondition || null,
      payload.testSteps || null,
      payload.expectedResult || null,
      payload.status,
      payload.severity,
      payload.tester || null,
      payload.executionDate || null,
      payload.comments || null,
      evidenceName,
      evidenceMime,
      evidenceBuffer ? evidenceBuffer.length : null,
      evidenceBuffer,
      data.createdBy || null,
      data.createdByName ? String(data.createdByName).trim().substring(0, 100) : null
    ]
  );

  return mapRow(result.rows[0]);
}

async function update(id, data) {
  await ensureSchema();
  const existing = await findById(id);
  if (!existing) return null;

  const payload = validatePayload(data);
  const evidenceBuffer = decodeBase64File(data.fileBase64);
  const clearEvidence = data.clearEvidence === true;

  const sets = [
    'module = $2',
    'test_scenario = $3',
    'pre_condition = $4',
    'test_steps = $5',
    'expected_result = $6',
    'status = $7',
    'severity = $8',
    'tester = $9',
    'execution_date = $10',
    'comments = $11',
    'atualizado_em = CURRENT_TIMESTAMP'
  ];
  const values = [
    id,
    payload.module,
    payload.testScenario,
    payload.preCondition || null,
    payload.testSteps || null,
    payload.expectedResult || null,
    payload.status,
    payload.severity,
    payload.tester || null,
    payload.executionDate || null,
    payload.comments || null
  ];
  let idx = 12;

  if (evidenceBuffer) {
    sets.push(`evidence_file_name = $${idx++}`);
    values.push(sanitizeFileName(data.fileName));
    sets.push(`evidence_mime_type = $${idx++}`);
    values.push(String(data.mimeType || 'application/octet-stream').substring(0, 100));
    sets.push(`evidence_file_size = $${idx++}`);
    values.push(evidenceBuffer.length);
    sets.push(`evidence_file_data = $${idx++}`);
    values.push(evidenceBuffer);
  } else if (clearEvidence) {
    sets.push('evidence_file_name = NULL');
    sets.push('evidence_mime_type = NULL');
    sets.push('evidence_file_size = NULL');
    sets.push('evidence_file_data = NULL');
  }

  const result = await query(
    `UPDATE ${TABLE}
     SET ${sets.join(', ')}
     WHERE id = $1
     RETURNING ${LIST_COLUMNS}`,
    values
  );
  if (!result.rows.length) return null;
  return mapRow(result.rows[0]);
}

async function remove(id) {
  await ensureSchema();
  const result = await query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows.length) return null;
  return { id: result.rows[0].id };
}

module.exports = {
  MODULES,
  STATUSES,
  SEVERITIES,
  formatTestCaseId,
  previewNextId,
  list,
  findById,
  getEvidenceFile,
  create,
  update,
  remove,
  ensureSchema
};
