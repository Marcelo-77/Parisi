// Warehouse service using PostgreSQL
const { query } = require('../config/database');
const {
  BATHWARE_SUBCATEGORIES,
  isValidBathwareSubcategory,
  normalizeBathwareSubcategory
} = require('../constants/bathwareSubcategories');

class WarehouseService {
  constructor() {
    this.tableName = 'warehouse_items';
  }

  // Create new item
  async criar(dados) {
    const erros = this.validar(dados);
    
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Check if code already exists
    const codigoExistente = await this.buscarPorCodigo(dados.codigo);
    if (codigoExistente) {
      throw new Error('Code already registered for another item');
    }

    const insertQuery = `
      INSERT INTO ${this.tableName} 
      (codigo, barcode, nome, categoria, subcategoria, quantidade, quantidade_minima, localizacao, preco_unitario, fornecedor, descricao, photo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      dados.codigo,
      dados.barcode ? String(dados.barcode) : null,
      dados.nome,
      dados.categoria,
      this.resolveSubcategoria(dados.categoria, dados.subcategoria),
      dados.quantidade || 0,
      dados.quantidadeMinima || 0,
      dados.localizacao || null,
      0, // preco_unitario - removed from frontend but kept in DB
      null, // fornecedor - removed from frontend but kept in DB
      dados.descricao || null,
      this.normalizePhoto(dados.photo)
    ];

    try {
      const result = await query(insertQuery, values);
      const itemCriado = this.mapRowToItem(result.rows[0]);
      console.log(`✅ Item created: ${itemCriado.nome}`);
      return itemCriado;
    } catch (error) {
      console.error('❌ Error creating item:', error);
      throw new Error(`Error creating item: ${error.message}`);
    }
  }

  // Find all items
  async buscarTodos(filtros = {}) {
    let whereClauses = [];
    let queryParams = [];
    let paramIndex = 1;

    if (filtros.categoria) {
      whereClauses.push(`categoria = $${paramIndex++}`);
      queryParams.push(filtros.categoria);
    }

    if (filtros.subcategoria) {
      whereClauses.push(`subcategoria = $${paramIndex++}`);
      queryParams.push(filtros.subcategoria);
    }

    if (filtros.codigo) {
      whereClauses.push(`codigo ILIKE $${paramIndex++}`);
      queryParams.push(`%${filtros.codigo}%`);
    }

    if (filtros.nome) {
      whereClauses.push(`nome ILIKE $${paramIndex++}`);
      queryParams.push(`%${filtros.nome}%`);
    }

    if (filtros.barcode) {
      whereClauses.push(`REGEXP_REPLACE(CAST(barcode AS TEXT), '[^0-9]', '', 'g') = REGEXP_REPLACE($${paramIndex++}, '[^0-9]', '', 'g')`);
      queryParams.push(String(filtros.barcode));
    }

    if (filtros.localizacao) {
      whereClauses.push(`localizacao ILIKE $${paramIndex++}`);
      queryParams.push(`%${filtros.localizacao}%`);
    }

    if (filtros.withLocation) {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM location_product lp
        WHERE TRIM(LOWER(lp.product_code)) = TRIM(LOWER(${this.tableName}.codigo))
          AND lp.quantity_current > 0
          AND TRIM(COALESCE(lp.stat_cd_id, '')) = 'A'
          AND lp.entry_datetime IS NOT NULL
      )`);
    }

    let orderBy = 'nome ASC';
    if (filtros.ordenarPor) {
      const direcao = filtros.direcao === 'desc' ? 'DESC' : 'ASC';
      orderBy = `${filtros.ordenarPor} ${direcao}`;
    }

    const whereClause = whereClauses.length > 0 
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const selectQuery = `
      SELECT id, codigo, barcode, nome, categoria, subcategoria, quantidade, quantidade_minima,
             localizacao, descricao, criado_em, atualizado_em,
             CASE
               WHEN photo IS NOT NULL AND TRIM(photo) <> '' AND LOWER(TRIM(photo)) NOT IN ('null', 'undefined')
               THEN TRUE ELSE FALSE
             END AS has_photo
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    try {
      const result = await query(selectQuery, queryParams);
      return result.rows.map(row => this.mapRowToItem(row));
    } catch (error) {
      console.error('❌ Error fetching items:', error);
      throw new Error(`Error fetching items: ${error.message}`);
    }
  }

  // Find item by ID
  async buscarPorId(id) {
    const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    
    try {
      const result = await query(selectQuery, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToItem(result.rows[0]);
    } catch (error) {
      console.error('❌ Error fetching item by ID:', error);
      throw new Error(`Error fetching item: ${error.message}`);
    }
  }

  // Find item by code (exact, then trimmed, then case-insensitive)
  async buscarPorCodigo(codigo) {
    if (!codigo || typeof codigo !== 'string') return null;
    const trimmed = codigo.trim();
    if (!trimmed) return null;

    try {
      let selectQuery = `SELECT * FROM ${this.tableName} WHERE codigo = $1`;
      let result = await query(selectQuery, [trimmed]);
      if (result.rows.length > 0) return this.mapRowToItem(result.rows[0]);

      selectQuery = `SELECT * FROM ${this.tableName} WHERE TRIM(codigo) = $1 LIMIT 1`;
      result = await query(selectQuery, [trimmed]);
      if (result.rows.length > 0) return this.mapRowToItem(result.rows[0]);

      selectQuery = `SELECT * FROM ${this.tableName} WHERE LOWER(TRIM(codigo)) = LOWER($1) LIMIT 1`;
      result = await query(selectQuery, [trimmed]);
      if (result.rows.length > 0) return this.mapRowToItem(result.rows[0]);

      return null;
    } catch (error) {
      console.error('❌ Error fetching item by code:', error);
      throw new Error(`Error fetching item: ${error.message}`);
    }
  }

  // Update item
  async atualizar(id, dados) {
    const erros = this.validar(dados, true);
    
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Check if code already exists in another item
    if (dados.codigo) {
      const itemExistente = await this.buscarPorCodigo(dados.codigo);
      if (itemExistente && itemExistente.id !== id) {
        throw new Error('Code already registered for another item');
      }
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const camposPermitidos = {
      codigo: 'codigo',
      barcode: 'barcode',
      nome: 'nome',
      categoria: 'categoria',
      subcategoria: 'subcategoria',
      quantidade: 'quantidade',
      quantidadeMinima: 'quantidade_minima',
      descricao: 'descricao',
      photo: 'photo'
    };

    for (const [key, dbColumn] of Object.entries(camposPermitidos)) {
      if (dados[key] !== undefined) {
        let value = dados[key];
        if (key === 'subcategoria') {
          const categoria = dados.categoria !== undefined
            ? dados.categoria
            : (await this.buscarPorId(id))?.categoria;
          value = this.resolveSubcategoria(categoria, value);
        }
        if (key === 'photo') {
          value = this.normalizePhoto(value);
        }
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (dados.categoria !== undefined && dados.subcategoria === undefined) {
      updateFields.push(`subcategoria = $${paramIndex++}`);
      values.push(this.resolveSubcategoria(dados.categoria, null));
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`atualizado_em = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, values);
      if (result.rows.length === 0) {
        throw new Error('Item não encontrado');
      }
      const itemAtualizado = this.mapRowToItem(result.rows[0]);
      console.log(`✅ Item updated: ${itemAtualizado.nome}`);
      return itemAtualizado;
    } catch (error) {
      console.error('❌ Error updating item:', error);
      throw new Error(`Error updating item: ${error.message}`);
    }
  }

  // Delete item
  async excluir(id) {
    const deleteQuery = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
    
    try {
      const result = await query(deleteQuery, [id]);
      if (result.rows.length === 0) {
        throw new Error('Item not found');
      }
      console.log(`✅ Item deleted: ${result.rows[0].nome}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      throw new Error(`Error deleting item: ${error.message}`);
    }
  }

  // Register stock movement
  async registrarMovimentacao(itemId, tipo, quantidade, motivo = null) {
    const item = await this.buscarPorId(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    let novaQuantidade;
    if (tipo === 'entrada') {
      novaQuantidade = item.quantidade + quantidade;
    } else if (tipo === 'saida') {
      novaQuantidade = item.quantidade - quantidade;
      if (novaQuantidade < 0) {
        throw new Error('Insufficient stock quantity');
      }
    } else {
      throw new Error('Invalid movement type. Use "entrada" or "saida"');
    }

    // Update item quantity
    await this.atualizar(itemId, { quantidade: novaQuantidade });

    // Register movement in history
    const insertMovimentacaoQuery = `
      INSERT INTO warehouse_movements 
      (item_id, tipo, quantidade, motivo, data_movimentacao)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    try {
      const result = await query(insertMovimentacaoQuery, [
        itemId,
        tipo,
        quantidade,
        motivo
      ]);
      console.log(`✅ Movement registered: ${tipo} of ${quantidade} units`);
      return {
        movimento: result.rows[0],
        item: await this.buscarPorId(itemId)
      };
    } catch (error) {
      console.error('❌ Error registering movement:', error);
      // If movements table doesn't exist, just update the item
      if (error.message.includes('does not exist')) {
        return {
          movimento: null,
          item: await this.buscarPorId(itemId)
        };
      }
      throw new Error(`Error registering movement: ${error.message}`);
    }
  }

  // Get statistics
  async obterEstatisticas() {
    try {
      const totalQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const totalResult = await query(totalQuery);
      const total = parseInt(totalResult.rows[0].total);

      const lowStockQuery = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName}
        WHERE quantidade <= quantidade_minima AND quantidade > 0
      `;
      const lowStockResult = await query(lowStockQuery);
      const estoqueBaixo = parseInt(lowStockResult.rows[0].total);

      const outOfStockQuery = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName}
        WHERE quantidade = 0
      `;
      const outOfStockResult = await query(outOfStockQuery);
      const esgotado = parseInt(outOfStockResult.rows[0].total);

      const today = new Date().toISOString().split('T')[0];
      const entradasQuery = `
        SELECT COUNT(*) as total 
        FROM warehouse_movements
        WHERE tipo = 'entrada' AND DATE(data_movimentacao) = $1
      `;
      const saidasQuery = `
        SELECT COUNT(*) as total 
        FROM warehouse_movements
        WHERE tipo = 'saida' AND DATE(data_movimentacao) = $1
      `;

      let entradas = 0;
      let saidas = 0;

      try {
        const entradasResult = await query(entradasQuery, [today]);
        entradas = parseInt(entradasResult.rows[0].total);
      } catch (error) {
        // Movements table may not exist
      }

      try {
        const saidasResult = await query(saidasQuery, [today]);
        saidas = parseInt(saidasResult.rows[0].total);
      } catch (error) {
        // Movements table may not exist
      }

      return {
        total,
        estoqueBaixo,
        esgotado,
        entradas,
        saidas
      };
    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      throw new Error(`Error getting statistics: ${error.message}`);
    }
  }

  resolveSubcategoria(categoria, subcategoria) {
    const category = String(categoria || '').trim().toUpperCase();
    if (category !== 'BATHWARE') {
      return null;
    }
    return normalizeBathwareSubcategory(subcategoria);
  }

  // Validate data
  validar(dados, isUpdate = false) {
    const erros = [];

    if (!isUpdate || dados.codigo !== undefined) {
      if (!dados.codigo || dados.codigo.trim().length < 2) {
        erros.push('Code must have at least 2 characters');
      }
    }

    if (!isUpdate || dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length < 2) {
        erros.push('Name must have at least 2 characters');
      }
    }

    if (!isUpdate || dados.categoria !== undefined) {
      if (!dados.categoria) {
        erros.push('Category is required');
      }
    }

    if (dados.quantidade !== undefined && dados.quantidade < 0) {
      erros.push('Quantity cannot be negative');
    }

    if (dados.quantidadeMinima !== undefined && dados.quantidadeMinima < 0) {
      erros.push('Minimum quantity cannot be negative');
    }

    if (dados.barcode !== undefined && dados.barcode !== null && dados.barcode !== '') {
      if (!/^\d{1,20}$/.test(String(dados.barcode))) {
        erros.push('Barcode must contain only digits and max 20 characters');
      }
    }

    if (dados.subcategoria !== undefined && !isValidBathwareSubcategory(dados.subcategoria)) {
      erros.push(`Subcategory must be one of: ${BATHWARE_SUBCATEGORIES.join(', ')}`);
    }

    return erros;
  }

  // Map database row to object
  normalizePhoto(photo) {
    const value = photo != null ? String(photo).trim() : '';
    if (!value || value === 'null' || value === 'undefined') return null;
    return value;
  }

  mapRowToItem(row) {
    const photo = this.normalizePhoto(row.photo);
    const hasPhoto = row.has_photo === true
      || row.has_photo === 't'
      || Boolean(photo);
    return {
      id: row.id,
      codigo: row.codigo,
      barcode: row.barcode != null ? String(row.barcode) : null,
      nome: row.nome,
      categoria: row.categoria,
      subcategoria: row.subcategoria || null,
      quantidade: parseInt(row.quantidade) || 0,
      quantidadeMinima: parseInt(row.quantidade_minima) || 0,
      localizacao: row.localizacao,
      descricao: row.descricao,
      photo: photo,
      hasPhoto: Boolean(hasPhoto),
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    };
  }
}

module.exports = new WarehouseService();
