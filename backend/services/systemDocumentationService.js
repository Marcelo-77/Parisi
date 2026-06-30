const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

const TABLE = 'system_documentation';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'system-documentation');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    fileName: row.file_name,
    mimeType: row.mime_type || null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    uploadedBy: row.uploaded_by || null,
    uploadedByName: row.uploaded_by_name || null,
    criadoEm: row.criado_em
  };
}

function sanitizeFileName(name) {
  const base = path.basename(String(name || 'document').trim());
  return base.replace(/[^\w.\- ()]/g, '_').substring(0, 200) || 'document';
}

function getFileExtension(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  return ext || '';
}

function getAbsolutePath(storedName) {
  return path.join(UPLOAD_DIR, storedName);
}

async function list(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.title && String(filters.title).trim()) {
    whereClauses.push(`(sd.title ILIKE $${idx} OR sd.description ILIKE $${idx} OR sd.file_name ILIKE $${idx})`);
    values.push(`%${String(filters.title).trim()}%`);
    idx += 1;
  }

  if (filters.uploadedByName && String(filters.uploadedByName).trim()) {
    whereClauses.push(`sd.uploaded_by_name ILIKE $${idx++}`);
    values.push(`%${String(filters.uploadedByName).trim()}%`);
  }

  if (filters.dateFrom) {
    whereClauses.push(`sd.criado_em >= $${idx++}::timestamp`);
    values.push(`${String(filters.dateFrom).trim()} 00:00:00`);
  }

  if (filters.dateTo) {
    whereClauses.push(`sd.criado_em <= $${idx++}::timestamp`);
    values.push(`${String(filters.dateTo).trim()} 23:59:59`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT sd.*
    FROM ${TABLE} sd
    ${where}
    ORDER BY sd.criado_em DESC, sd.title ASC
    LIMIT 500
  `;

  try {
    const result = await query(sql, values);
    return (result.rows || []).map(mapRow);
  } catch (error) {
    console.error('Error listing system documentation:', error);
    throw new Error(`Error listing system documentation: ${error.message}`);
  }
}

async function findById(id) {
  const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  if (!result.rows.length) return null;
  return mapRow(result.rows[0]);
}

async function getFileInfo(id) {
  const result = await query(
    `SELECT file_name, stored_name FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  if (!result.rows.length) return null;
  return {
    fileName: result.rows[0].file_name,
    storedName: result.rows[0].stored_name
  };
}

async function create(data) {
  const title = String(data.title || '').trim();
  const description = data.description ? String(data.description).trim() : null;
  const fileName = sanitizeFileName(data.fileName);
  const mimeType = data.mimeType ? String(data.mimeType).trim().substring(0, 100) : null;
  const fileBase64 = data.fileBase64;

  if (!title) throw new Error('Title is required.');
  if (!fileName) throw new Error('File name is required.');
  if (!fileBase64) throw new Error('File content is required.');

  const base64Data = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer.length) throw new Error('File content is empty.');

  const maxSize = 7 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error('File size must be less than 7MB.');
  }

  ensureUploadDir();

  const id = uuidv4();
  const ext = getFileExtension(fileName);
  const storedName = `${id}${ext}`;
  const absolutePath = getAbsolutePath(storedName);

  fs.writeFileSync(absolutePath, buffer);

  const sql = `
    INSERT INTO ${TABLE}
      (id, title, description, file_name, stored_name, mime_type, file_size, uploaded_by, uploaded_by_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  try {
    const result = await query(sql, [
      id,
      title.substring(0, 200),
      description,
      fileName,
      storedName,
      mimeType,
      buffer.length,
      data.uploadedBy || null,
      data.uploadedByName ? String(data.uploadedByName).trim().substring(0, 100) : null
    ]);
    return mapRow(result.rows[0]);
  } catch (error) {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    console.error('Error creating system documentation:', error);
    throw new Error(`Error saving documentation: ${error.message}`);
  }
}

module.exports = {
  list,
  findById,
  getFileInfo,
  create,
  getAbsolutePath,
  ensureUploadDir
};
