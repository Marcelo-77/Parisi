const { query } = require('../config/database');

class LocationService {
  constructor() {
    this.tableName = 'warehouse_locations';
  }

  async criar(dados) {
    const erros = this.validar(dados);
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Verificar se location já existe
    const existente = await this.buscarPorLocation(dados.location);
    if (existente) {
      throw new Error('Location already registered');
    }

    const insertQuery = `
      INSERT INTO ${this.tableName}
        (location, status, access_type)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [
      dados.location,
      dados.status,
      dados.accessType
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
      whereClauses.push(`location ILIKE $${idx++}`);
      values.push(`%${filtros.location}%`);
    }

    if (filtros.status) {
      whereClauses.push(`status = $${idx++}`);
      values.push(filtros.status);
    }

    if (filtros.accessType) {
      whereClauses.push(`access_type = $${idx++}`);
      values.push(filtros.accessType);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      ${where}
      ORDER BY location ASC
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

    // Se está alterando o código da location, verificar se já existe em outro registro
    if (dados.location && dados.location.trim() !== existente.location) {
      const outro = await this.buscarPorLocation(dados.location.trim());
      if (outro) {
        throw new Error('Location already registered');
      }
    }

    const updateQuery = `
      UPDATE ${this.tableName}
      SET location = COALESCE($2, location),
          status = COALESCE($3, status),
          access_type = COALESCE($4, access_type),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1::uuid
      RETURNING *
    `;

    const values = [
      idStr,
      dados.location ? dados.location.trim() : existente.location,
      dados.status || existente.status,
      dados.accessType || existente.accessType
    ];

    try {
      const result = await query(updateQuery, values);
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('❌ Error updating location:', error);
      throw new Error(`Error updating location: ${error.message}`);
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

    const validAccess = ['Shelf by Hand', 'Shelf by Wave', 'Shelf By Fork'];
    if (!validAccess.includes(dados.accessType)) {
      erros.push('Access type is invalid');
    }

    return erros;
  }

  mapRowToLocation(row) {
    return {
      id: row.id,
      location: row.location,
      status: row.status,
      accessType: row.access_type,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    };
  }
}

module.exports = new LocationService();

