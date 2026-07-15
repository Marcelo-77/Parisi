const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../config/database');
const systemDocumentationService = require('./systemDocumentationService');

const TABLE = 'news';
const LINK_TABLE = 'news_documentation';

const VALID_SECTORS = new Set([
  'TAPWARE', 'BATHWARE', 'WAREHOUSE2', 'FURNITUREWARE', 'DOORWARE', 'OTHER'
]);

function normalizeSectors(list) {
  if (!Array.isArray(list)) return [];
  const unique = [];
  const seen = new Set();
  list.forEach((item) => {
    const value = item != null ? String(item).trim().toUpperCase() : '';
    if (!value || !VALID_SECTORS.has(value) || seen.has(value)) return;
    seen.add(value);
    unique.push(value);
  });
  return unique;
}

function parseDateOnly(value) {
  const raw = value != null ? String(value).trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function mapDocumentationRow(row) {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    sector: row.sector || null
  };
}

function mapRow(row, documentation = []) {
  let sectors = [];
  if (row.sectors) {
    try {
      sectors = Array.isArray(row.sectors) ? row.sectors : JSON.parse(row.sectors);
    } catch {
      sectors = [];
    }
  }

  return {
    id: row.id,
    description: row.description || '',
    startDate: row.start_date,
    endDate: row.end_date,
    allSectors: Boolean(row.all_sectors),
    sectors,
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    documentation
  };
}

async function listDocumentationForNews(newsId) {
  const sql = `
    SELECT sd.id, sd.title, sd.file_name, sd.sector
    FROM ${LINK_TABLE} nd
    INNER JOIN system_documentation sd ON sd.id = nd.system_documentation_id
    WHERE nd.news_id = $1
    ORDER BY sd.title ASC, sd.file_name ASC
  `;
  const result = await query(sql, [newsId]);
  return (result.rows || []).map(mapDocumentationRow);
}

async function list(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.activeOnly) {
    whereClauses.push(`CURRENT_DATE BETWEEN n.start_date AND n.end_date`);
  }

  if (filters.description && String(filters.description).trim()) {
    whereClauses.push(`n.description ILIKE $${idx++}`);
    values.push(`%${String(filters.description).trim()}%`);
  }

  if (filters.createdByName && String(filters.createdByName).trim()) {
    whereClauses.push(`n.created_by_name ILIKE $${idx++}`);
    values.push(`%${String(filters.createdByName).trim()}%`);
  }

  if (filters.dateFrom) {
    whereClauses.push(`n.criado_em >= $${idx++}::timestamp`);
    values.push(`${String(filters.dateFrom).trim()} 00:00:00`);
  }

  if (filters.dateTo) {
    whereClauses.push(`n.criado_em <= $${idx++}::timestamp`);
    values.push(`${String(filters.dateTo).trim()} 23:59:59`);
  }

  if (filters.sector === '__all_sectors__') {
    whereClauses.push(`n.all_sectors = true`);
  } else if (filters.sector && String(filters.sector).trim()) {
    const sector = String(filters.sector).trim().toUpperCase();
    whereClauses.push(`(n.all_sectors = true OR n.sectors @> $${idx++}::jsonb)`);
    values.push(JSON.stringify([sector]));
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT n.id, n.description, n.start_date, n.end_date, n.all_sectors, n.sectors,
           n.created_by, n.created_by_name, n.criado_em, n.atualizado_em
    FROM ${TABLE} n
    ${where}
    ORDER BY n.start_date DESC, n.criado_em DESC
    LIMIT 200
  `;

  const result = await query(sql, values);
  const rows = result.rows || [];
  const mapped = [];
  for (let i = 0; i < rows.length; i += 1) {
    const documentation = await listDocumentationForNews(rows[i].id);
    mapped.push(mapRow(rows[i], documentation));
  }
  return mapped;
}

async function findById(id) {
  const result = await query(
    `SELECT id, description, start_date, end_date, all_sectors, sectors,
            created_by, created_by_name, criado_em, atualizado_em
     FROM ${TABLE}
     WHERE id = $1`,
    [id]
  );
  if (!result.rows.length) return null;
  const documentation = await listDocumentationForNews(id);
  return mapRow(result.rows[0], documentation);
}

function validateNewsPayload(data) {
  const description = data.description != null ? String(data.description).trim() : '';
  const startDate = parseDateOnly(data.startDate);
  const endDate = parseDateOnly(data.endDate);
  const allSectors = Boolean(data.allSectors);
  const sectors = normalizeSectors(data.sectors);
  const documentationIds = Array.isArray(data.documentationIds)
    ? [...new Set(data.documentationIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  if (!description) {
    throw new Error('Description is required.');
  }
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required (YYYY-MM-DD).');
  }
  if (endDate < startDate) {
    throw new Error('End date cannot be earlier than start date.');
  }
  if (!allSectors && !sectors.length) {
    throw new Error('Select at least one sector or choose All sectors.');
  }
  if (allSectors && sectors.length) {
    throw new Error('Cannot combine All sectors with specific sector selection.');
  }

  return {
    description,
    startDate,
    endDate,
    allSectors,
    sectors,
    documentationIds
  };
}

async function replaceDocumentationLinks(client, newsId, documentationIds) {
  await client.query(`DELETE FROM ${LINK_TABLE} WHERE news_id = $1`, [newsId]);

  if (!documentationIds.length) return;

  const placeholders = documentationIds.map((docId, index) => `($1, $${index + 2})`);
  await client.query(
    `INSERT INTO ${LINK_TABLE} (news_id, system_documentation_id)
     VALUES ${placeholders.join(', ')}`,
    [newsId, ...documentationIds]
  );
}

async function create(data) {
  const payload = validateNewsPayload(data);

  for (let i = 0; i < payload.documentationIds.length; i += 1) {
    const doc = await systemDocumentationService.findById(payload.documentationIds[i]);
    if (!doc) {
      throw new Error(`System documentation not found: ${payload.documentationIds[i]}`);
    }
  }

  const id = uuidv4();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO ${TABLE} (
        id, description, start_date, end_date, all_sectors, sectors,
        created_by, created_by_name
      ) VALUES ($1, $2, $3::date, $4::date, $5, $6::jsonb, $7, $8)
      RETURNING id, description, start_date, end_date, all_sectors, sectors,
                created_by, created_by_name, criado_em, atualizado_em`,
      [
        id,
        payload.description,
        payload.startDate,
        payload.endDate,
        payload.allSectors,
        JSON.stringify(payload.allSectors ? [] : payload.sectors),
        data.createdBy || null,
        data.createdByName || null
      ]
    );

    await replaceDocumentationLinks(client, id, payload.documentationIds);

    await client.query('COMMIT');

    const documentation = await listDocumentationForNews(id);
    return mapRow(insertResult.rows[0], documentation);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating news:', error);
    if (error.message && !error.message.startsWith('Error creating')) {
      throw error;
    }
    throw new Error(`Error creating news: ${error.message}`);
  } finally {
    client.release();
  }
}

async function update(id, data) {
  const existing = await findById(id);
  if (!existing) {
    throw new Error('News not found.');
  }

  const payload = validateNewsPayload(data);

  for (let i = 0; i < payload.documentationIds.length; i += 1) {
    const doc = await systemDocumentationService.findById(payload.documentationIds[i]);
    if (!doc) {
      throw new Error(`System documentation not found: ${payload.documentationIds[i]}`);
    }
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE ${TABLE}
       SET description = $2,
           start_date = $3::date,
           end_date = $4::date,
           all_sectors = $5,
           sectors = $6::jsonb,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, description, start_date, end_date, all_sectors, sectors,
                 created_by, created_by_name, criado_em, atualizado_em`,
      [
        id,
        payload.description,
        payload.startDate,
        payload.endDate,
        payload.allSectors,
        JSON.stringify(payload.allSectors ? [] : payload.sectors)
      ]
    );

    await replaceDocumentationLinks(client, id, payload.documentationIds);

    await client.query('COMMIT');

    const documentation = await listDocumentationForNews(id);
    return mapRow(updateResult.rows[0], documentation);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error updating news:', error);
    if (error.message === 'News not found.') throw error;
    throw new Error(`Error updating news: ${error.message}`);
  } finally {
    client.release();
  }
}

async function remove(id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
}

function normalizeUserSector(sector) {
  const value = sector != null ? String(sector).trim().toUpperCase() : '';
  return VALID_SECTORS.has(value) ? value : null;
}

async function listUnreadForUser({ userKey, isRoot = false, userSector = null }) {
  if (!userKey) return [];

  const sector = normalizeUserSector(userSector);
  const values = [userKey];
  let sectorClause = 'n.all_sectors = true';

  if (isRoot) {
    sectorClause = 'TRUE';
  } else if (sector) {
    values.push(JSON.stringify([sector]));
    sectorClause = `(n.all_sectors = true OR n.sectors @> $${values.length}::jsonb)`;
  }

  const sql = `
    SELECT n.id, n.description, n.start_date, n.end_date, n.all_sectors, n.sectors,
           n.created_by, n.created_by_name, n.criado_em, n.atualizado_em
    FROM ${TABLE} n
    LEFT JOIN news_read nr ON nr.news_id = n.id AND nr.user_key = $1
    WHERE CURRENT_DATE BETWEEN n.start_date AND n.end_date
      AND nr.news_id IS NULL
      AND ${sectorClause}
    ORDER BY n.start_date ASC, n.criado_em ASC
    LIMIT 20
  `;

  const result = await query(sql, values);
  const rows = result.rows || [];
  const mapped = [];
  for (let i = 0; i < rows.length; i += 1) {
    const documentation = await listDocumentationForNews(rows[i].id);
    mapped.push(mapRow(rows[i], documentation));
  }
  return mapped;
}

async function userCanAccessNews(newsId, { userKey, isRoot = false, userSector = null }) {
  const unread = await listUnreadForUser({ userKey, isRoot, userSector });
  return unread.some((item) => item.id === newsId);
}

async function markAsRead(newsId, { userKey, isRoot = false, userSector = null }) {
  if (!userKey) {
    throw new Error('User is required.');
  }

  const canAccess = await userCanAccessNews(newsId, { userKey, isRoot, userSector });
  if (!canAccess) {
    throw new Error('News not found or already read.');
  }

  await query(
    `INSERT INTO news_read (news_id, user_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [newsId, userKey]
  );
  return true;
}

module.exports = {
  list,
  findById,
  create,
  update,
  remove,
  listUnreadForUser,
  markAsRead,
  VALID_SECTORS
};
