// Employee service using PostgreSQL
const { query } = require('../config/database');
const Funcionario = require('../models/Funcionario');
const { verifyStoredPassword } = require('../middleware/auth');

class FuncionarioServiceDB {
  constructor() {
    this.tableName = 'funcionarios';
  }

  // Create new employee
  async criar(dados) {
    const funcionario = new Funcionario(dados);
    const erros = funcionario.validar();
    
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Check if email already exists
    const emailExistente = await this.buscarPorEmail(funcionario.email);
    if (emailExistente) {
      throw new Error('Email already registered for another employee');
    }

    const insertQuery = `
      INSERT INTO ${this.tableName} 
      (nome, email, telefone, cargo, departamento, data_admissao, photo, ativo, password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      funcionario.nome,
      funcionario.email,
      funcionario.telefone,
      funcionario.cargo,
      funcionario.departamento,
      funcionario.dataAdmissao,
      funcionario.photo || null,
      funcionario.ativo,
      funcionario.password || null
    ];

    try {
      const result = await query(insertQuery, values);
      const funcionarioCriado = this.mapRowToFuncionario(result.rows[0]);
      console.log(`✅ Employee created: ${funcionarioCriado.nome}`);
      return funcionarioCriado;
    } catch (error) {
      console.error('❌ Error creating employee:', error);
      throw new Error(`Error creating employee: ${error.message}`);
    }
  }

  // Find all employees with filters
  async buscarTodos(filtros = {}) {
    let whereClause = '';
    const values = [];
    let paramCount = 0;

    // Build WHERE clause based on filters
    const conditions = [];

    if (filtros.ativo !== undefined) {
      paramCount++;
      conditions.push(`ativo = $${paramCount}`);
      values.push(filtros.ativo);
    }

    if (filtros.departamento) {
      paramCount++;
      conditions.push(`departamento ILIKE $${paramCount}`);
      values.push(`%${filtros.departamento}%`);
    }

    if (filtros.cargo) {
      paramCount++;
      conditions.push(`cargo ILIKE $${paramCount}`);
      values.push(`%${filtros.cargo}%`);
    }

    if (filtros.nome) {
      paramCount++;
      conditions.push(`nome ILIKE $${paramCount}`);
      values.push(`%${filtros.nome}%`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Build ORDER BY clause
    let orderClause = '';
    if (filtros.ordenarPor) {
      const campo = filtros.ordenarPor;
      const direcao = filtros.direcao || 'asc';
      
      // Map fields to column names
      const campoMap = {
        'nome': 'nome',
        'cargo': 'cargo',
        'departamento': 'departamento',
        'dataAdmissao': 'data_admissao',
        'criadoEm': 'criado_em'
      };
      
      const campoDB = campoMap[campo] || 'nome';
      orderClause = `ORDER BY ${campoDB} ${direcao.toUpperCase()}`;
    } else {
      orderClause = 'ORDER BY nome ASC';
    }

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderClause}
    `;

    try {
      const result = await query(selectQuery, values);
      const funcionarios = result.rows.map(row => this.mapRowToFuncionario(row));
      console.log(`📊 Found ${funcionarios.length} employees`);
      return funcionarios;
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      throw new Error(`Error fetching employees: ${error.message}`);
    }
  }

  // Find employee by ID
  async buscarPorId(id) {
    const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    
    try {
      const result = await query(selectQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Employee not found');
      }
      
      return this.mapRowToFuncionario(result.rows[0]);
    } catch (error) {
      console.error('❌ Error fetching employee by ID:', error);
      throw error;
    }
  }

  // Find employee by email
  async buscarPorEmail(email) {
    const selectQuery = `SELECT * FROM ${this.tableName} WHERE email = $1`;
    
    try {
      const result = await query(selectQuery, [email]);
      return result.rows.length > 0 ? this.mapRowToFuncionario(result.rows[0]) : null;
    } catch (error) {
      console.error('❌ Error fetching employee by email:', error);
      throw error;
    }
  }

  async autenticar(email, senha) {
    const normalizedEmail = email != null ? String(email).trim().toLowerCase() : '';
    const password = senha != null ? String(senha) : '';

    if (!normalizedEmail || !password) {
      return null;
    }

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(email) = $1 AND ativo = true
    `;

    try {
      const result = await query(selectQuery, [normalizedEmail]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (!verifyStoredPassword(row.password, password)) {
        return null;
      }

      return this.mapRowToFuncionario(row);
    } catch (error) {
      console.error('❌ Error authenticating employee:', error);
      throw error;
    }
  }

  // Update employee
  async atualizar(id, dados) {
    // Check if employee exists
    await this.buscarPorId(id);
    
    // Check if email already exists in another employee
    if (dados.email) {
      const emailExistente = await this.buscarPorEmail(dados.email);
      if (emailExistente && emailExistente.id !== id) {
        throw new Error('Email already registered for another employee');
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['nome', 'email', 'telefone', 'cargo', 'departamento', 'dataAdmissao', 'photo', 'ativo', 'password'];
    
    allowedFields.forEach(field => {
      if (dados[field] !== undefined) {
        paramCount++;
        const dbField = field === 'dataAdmissao' ? 'data_admissao' : field;
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(dados[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    paramCount++;
    values.push(id);

    const updateQuery = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, values);
      const funcionarioAtualizado = this.mapRowToFuncionario(result.rows[0]);
      console.log(`✅ Employee updated: ${funcionarioAtualizado.nome}`);
      return funcionarioAtualizado;
    } catch (error) {
      console.error('❌ Error updating employee:', error);
      throw new Error(`Error updating employee: ${error.message}`);
    }
  }

  // Delete employee (soft delete)
  async excluir(id) {
    const updateQuery = `
      UPDATE ${this.tableName}
      SET ativo = false, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Employee not found');
      }
      
      const funcionarioExcluido = this.mapRowToFuncionario(result.rows[0]);
      console.log(`✅ Employee deactivated: ${funcionarioExcluido.nome}`);
      return funcionarioExcluido;
    } catch (error) {
      console.error('❌ Error deleting employee:', error);
      throw error;
    }
  }

  // Permanently delete employee
  async excluirPermanentemente(id) {
    const deleteQuery = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;

    try {
      const result = await query(deleteQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Employee not found');
      }
      
      const funcionarioExcluido = this.mapRowToFuncionario(result.rows[0]);
      console.log(`✅ Employee permanently deleted: ${funcionarioExcluido.nome}`);
      return funcionarioExcluido;
    } catch (error) {
      console.error('❌ Error permanently deleting employee:', error);
      throw error;
    }
  }

  // Get statistics
  async obterEstatisticas() {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ativo = true) as ativos,
        COUNT(*) FILTER (WHERE ativo = false) as inativos
      FROM ${this.tableName}
    `;

    const deptQuery = `
      SELECT departamento, COUNT(*) as count
      FROM ${this.tableName}
      WHERE ativo = true
      GROUP BY departamento
      ORDER BY count DESC
    `;

    const cargoQuery = `
      SELECT cargo, COUNT(*) as count
      FROM ${this.tableName}
      WHERE ativo = true
      GROUP BY cargo
      ORDER BY count DESC
    `;

    try {
      const [statsResult, deptResult, cargoResult] = await Promise.all([
        query(statsQuery),
        query(deptQuery),
        query(cargoQuery)
      ]);

      const stats = statsResult.rows[0];
      const departamentos = {};
      const cargos = {};

      deptResult.rows.forEach(row => {
        departamentos[row.departamento] = parseInt(row.count);
      });

      cargoResult.rows.forEach(row => {
        cargos[row.cargo] = parseInt(row.count);
      });

      return {
        total: parseInt(stats.total),
        ativos: parseInt(stats.ativos),
        inativos: parseInt(stats.inativos),
        departamentos,
        cargos
      };
    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      throw new Error(`Error getting statistics: ${error.message}`);
    }
  }

  // Map database row to Funcionario object
  mapRowToFuncionario(row) {
    return new Funcionario({
      id: row.id,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      cargo: row.cargo,
      departamento: row.departamento,
      dataAdmissao: row.data_admissao,
      photo: row.photo,
      ativo: row.ativo,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    });
  }
}

module.exports = new FuncionarioServiceDB();



