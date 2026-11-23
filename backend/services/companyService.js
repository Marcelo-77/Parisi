const { query } = require('../config/database');

const TABLE = 'company';
const COMPANY_COLUMNS = `
  id, name, logo, responsible_name, email, phone, address, criado_em, atualizado_em
`;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS company (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL UNIQUE,
      logo TEXT,
      responsible_name VARCHAR(100),
      email VARCHAR(255),
      phone VARCHAR(20),
      address VARCHAR(255),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS logo TEXT`);
  await query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(100)`);
  await query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
  await query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
  await query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS address VARCHAR(255)`);
  schemaReady = true;
}

function mapRow(row, options = {}) {
  const includeLogo = options.includeLogo !== false;
  return {
    id: row.id,
    name: row.name,
    logo: includeLogo ? row.logo || null : undefined,
    hasLogo: Boolean(row.logo),
    responsibleName: row.responsible_name || null,
    email: row.email || null,
    phone: row.phone || null,
    address: row.address || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function normalizePayload(data, { requireName = false, existing = null } = {}) {
  const payload = {};

  if (data.name !== undefined || requireName) {
    payload.name = data.name != null ? String(data.name).trim().substring(0, 150) : '';
    if (!payload.name) {
      throw new Error('Company name is required.');
    }
  } else if (existing) {
    payload.name = existing.name;
  }

  if (data.responsibleName !== undefined) {
    payload.responsible_name = data.responsibleName != null
      ? String(data.responsibleName).trim().substring(0, 100) || null
      : null;
  }

  if (data.email !== undefined) {
    const email = data.email != null ? String(data.email).trim().substring(0, 255) : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email must have a valid format.');
    }
    payload.email = email || null;
  }

  if (data.phone !== undefined) {
    payload.phone = data.phone != null
      ? String(data.phone).trim().substring(0, 20) || null
      : null;
  }

  if (data.address !== undefined) {
    payload.address = data.address != null
      ? String(data.address).trim().substring(0, 255) || null
      : null;
  }

  if (data.logo !== undefined) {
    payload.logo = data.logo != null ? String(data.logo).trim() || null : null;
  }

  return payload;
}

async function list(filters = {}) {
  await ensureSchema();
  const whereClauses = [];
  const values = [];
  let idx = 1;

  if (filters.name && String(filters.name).trim()) {
    whereClauses.push(`name ILIKE $${idx++}`);
    values.push(`%${String(filters.name).trim()}%`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT ${COMPANY_COLUMNS} FROM ${TABLE} ${where} ORDER BY name ASC`,
    values
  );
  return (result.rows || []).map((row) => mapRow(row, { includeLogo: filters.includeLogo === true }));
}

async function findById(id) {
  await ensureSchema();
  const result = await query(
    `SELECT ${COMPANY_COLUMNS} FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

function logoUrl(companyId) {
  if (!companyId) return null;
  return `/api/companies/${encodeURIComponent(companyId)}/logo`;
}

function parseStoredLogo(logo) {
  const value = logo != null ? String(logo).trim() : '';
  if (!value) return null;

  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (match) {
    return {
      contentType: match[1] || 'image/png',
      buffer: Buffer.from(match[2], 'base64')
    };
  }

  return {
    contentType: 'image/png',
    buffer: Buffer.from(value, 'base64')
  };
}

async function findLogoById(id) {
  await ensureSchema();
  const result = await query(`SELECT logo FROM ${TABLE} WHERE id = $1`, [id]);
  if (!result.rows.length) return null;
  return parseStoredLogo(result.rows[0].logo);
}

async function create(data) {
  await ensureSchema();
  const payload = normalizePayload(data, { requireName: true });

  try {
    const result = await query(
      `INSERT INTO ${TABLE} (name, logo, responsible_name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        payload.name,
        payload.logo || null,
        payload.responsible_name || null,
        payload.email || null,
        payload.phone || null,
        payload.address || null
      ]
    );
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('Company name already exists.');
    }
    throw new Error(`Error creating company: ${error.message}`);
  }
}

async function update(id, data) {
  await ensureSchema();
  const existing = await findById(id);
  if (!existing) {
    throw new Error('Company not found');
  }

  const payload = normalizePayload(data, { existing });
  const fields = [];
  const values = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(payload.name);
  }
  if (data.logo !== undefined) {
    fields.push(`logo = $${idx++}`);
    values.push(payload.logo);
  }
  if (data.responsibleName !== undefined) {
    fields.push(`responsible_name = $${idx++}`);
    values.push(payload.responsible_name);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(payload.email);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(payload.phone);
  }
  if (data.address !== undefined) {
    fields.push(`address = $${idx++}`);
    values.push(payload.address);
  }

  if (!fields.length) {
    throw new Error('No fields to update');
  }

  values.push(id);

  try {
    const result = await query(
      `UPDATE ${TABLE}
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values
    );
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('Company name already exists.');
    }
    throw new Error(`Error updating company: ${error.message}`);
  }
}

module.exports = {
  list,
  findById,
  findLogoById,
  logoUrl,
  create,
  update
};
