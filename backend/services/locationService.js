const { query, getClient } = require('../config/database');

const VALID_SECTIONS = ['TAPWARE', 'BATHWARE', 'WAREHOUSE2', 'FURNITUREWARE', 'DOORWARE', 'OTHER'];
const VALID_ACCESS_TYPES = ['Shelf by Hand', 'Shelf by Wave', 'Shelf By Fork'];

class LocationService {
  constructor() {
    this.tableName = 'warehouse_locations';
  }

  async criar(dados) {
    const erros = this.validar(dados);
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    const existente = await this.buscarPorLocation(dados.location);
    if (existente) {
      throw new Error('Location already registered');
    }

    const insertQuery = `
      INSERT INTO ${this.tableName}
        (location, status, access_type, section, usuario_inseriu, usuario_alterou)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      dados.location,
      dados.status,
      dados.accessType,
      dados.section,
      dados.usuarioInseriu || null,
      dados.usuarioAlterou || dados.usuarioInseriu || null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('❌ Error creating location:', error);
      throw new Error(`Error creating location: ${error.message}`);
    }
  }

  async buscarTodos(filtros = {}) {
    const whereClauses = [];
    const values = [];
    let idx = 1;

    if (filtros.location) {
      whereClauses.push(`wl.location ILIKE $${idx++}`);
      values.push(`%${filtros.location}%`);
    }

    if (filtros.status) {
      whereClauses.push(`wl.status = $${idx++}`);
      values.push(filtros.status);
    }

    if (filtros.accessType) {
      whereClauses.push(`wl.access_type = $${idx++}`);
      values.push(filtros.accessType);
    }

    if (filtros.section) {
      whereClauses.push(`wl.section = $${idx++}`);
      values.push(filtros.section);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectQuery = `
      SELECT wl.*,
        CASE
          WHEN LOWER(TRIM(COALESCE(wl.usuario_inseriu, ''))) = 'root' THEN 'Root'
          ELSE f.nome
        END AS usuario_inseriu_nome
      FROM ${this.tableName} wl
      LEFT JOIN funcionarios f ON f.id::text = wl.usuario_inseriu
      ${where}
      ORDER BY wl.location ASC
    `;

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.mapRowToLocation(row));
    } catch (error) {
      console.error('❌ Error fetching locations:', error);
      throw new Error(`Error fetching locations: ${error.message}`);
    }
  }

  async buscarPorId(id) {
    if (!id || String(id).trim() === '') return null;
    const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = $1::uuid`;
    try {
      const result = await query(selectQuery, [String(id).trim()]);
      if (!result.rows.length) return null;
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('❌ Error fetching location by id:', error);
      throw new Error(`Error fetching location: ${error.message}`);
    }
  }

  async buscarPorLocation(location) {
    if (!location || String(location).trim() === '') return null;
    const selectQuery = `SELECT * FROM ${this.tableName} WHERE TRIM(LOWER(location)) = TRIM(LOWER($1))`;
    try {
      const result = await query(selectQuery, [String(location).trim()]);
      if (!result.rows.length) return null;
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('❌ Error fetching location by code:', error);
      throw new Error(`Error fetching location: ${error.message}`);
    }
  }

  async ensureLocationProductFkCascade(client) {
    await client.query(`
      ALTER TABLE location_product
      DROP CONSTRAINT IF EXISTS location_product_location_code_fkey
    `);
    await client.query(`
      ALTER TABLE location_product
      ADD CONSTRAINT location_product_location_code_fkey
      FOREIGN KEY (location_code)
      REFERENCES warehouse_locations(location)
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);
  }

  async atualizar(id, dados) {
    const idStr = id ? String(id).trim() : '';
    const existente = await this.buscarPorId(idStr);
    if (!existente) {
      throw new Error('Location not found');
    }

    const erros = this.validar(dados);
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    const requestedLocation = dados.location ? String(dados.location).trim() : existente.location;
    const sameLocationIgnoringCase =
      String(requestedLocation).trim().toLowerCase() === String(existente.location).trim().toLowerCase();
    const locationToSave = requestedLocation;
    const locationChanged = locationToSave !== existente.location;

    if (!sameLocationIgnoringCase) {
      const outro = await this.buscarPorLocation(requestedLocation);
      if (outro && String(outro.id) !== idStr) {
        throw new Error('Location already registered');
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      if (locationChanged) {
        await this.ensureLocationProductFkCascade(client);
      }

      const updateQuery = `
        UPDATE ${this.tableName}
        SET location = $2,
            status = COALESCE($3, status),
            access_type = COALESCE($4, access_type),
            section = COALESCE($5, section),
            usuario_alterou = COALESCE($6, usuario_alterou),
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
        RETURNING *
      `;

      const values = [
        idStr,
        locationToSave,
        dados.status || existente.status,
        dados.accessType || existente.accessType,
        dados.section || existente.section,
        dados.usuarioAlterou || null
      ];

      const result = await client.query(updateQuery, values);

      if (locationChanged) {
        await client.query(
          `UPDATE location_product_log
           SET location_code_log = $1
           WHERE TRIM(LOWER(location_code_log)) = TRIM(LOWER($2))`,
          [locationToSave, existente.location]
        );
      }

      await client.query('COMMIT');
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      console.error('❌ Error updating location:', error);
      throw new Error(`Error updating location: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async deletar(id) {
    const idStr = id ? String(id).trim() : '';
    const existente = await this.buscarPorId(idStr);
    if (!existente) {
      throw new Error('Location not found');
    }

    const deleteQuery = `DELETE FROM ${this.tableName} WHERE id = $1::uuid`;
    try {
      await query(deleteQuery, [idStr]);
      return true;
    } catch (error) {
      console.error('❌ Error deleting location:', error);
      throw new Error(`Error deleting location: ${error.message}`);
    }
  }

  validar(dados) {
    const erros = [];

    if (!dados.location || dados.location.trim().length < 2) {
      erros.push('Location must have at least 2 characters');
    }

    if (!['active', 'inactive'].includes(dados.status)) {
      erros.push('Status must be active or inactive');
    }

    if (!VALID_ACCESS_TYPES.includes(dados.accessType)) {
      erros.push('Access type is invalid');
    }

    if (!VALID_SECTIONS.includes(dados.section)) {
      erros.push('Section is invalid');
    }

    return erros;
  }

  resolveUsuarioInseriuNome(row) {
    if (row.usuario_inseriu_nome) return row.usuario_inseriu_nome;
    const key = row.usuario_inseriu != null ? String(row.usuario_inseriu).trim().toLowerCase() : '';
    if (key === 'root') return 'Root';
    return null;
  }

  mapRowToLocation(row) {
    return {
      id: row.id,
      location: row.location,
      status: row.status,
      accessType: row.access_type,
      section: row.section || 'OTHER',
      usuarioInseriu: row.usuario_inseriu || null,
      usuarioAlterou: row.usuario_alterou || null,
      usuarioInseriuNome: this.resolveUsuarioInseriuNome(row),
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    };
  }
}

module.exports = new LocationService();
