// Warehouse service using PostgreSQL
const { query } = require('../config/database');
const {
  isValidBathwareSubcategory,
  normalizeBathwareSubcategory,
  categorySupportsSubcategory
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
      (codigo, barcode, nome, categoria, subcategoria, supplier_product_code, quantidade, quantidade_minima, localizacao, preco_unitario, fornecedor, descricao, photo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      dados.codigo,
      dados.barcode ? String(dados.barcode) : null,
      dados.nome,
      dados.categoria,
      this.resolveSubcategoria(dados.categoria, dados.subcategoria),
      this.normalizeSupplierProductCode(dados.supplierProductCode),
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
      if (filtros.codigoExact) {
        whereClauses.push(`LOWER(TRIM(codigo)) = LOWER(TRIM($${paramIndex++}))`);
        queryParams.push(String(filtros.codigo));
      } else {
        whereClauses.push(`codigo ILIKE $${paramIndex++}`);
        queryParams.push(`%${filtros.codigo}%`);
      }
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
      SELECT id, codigo, barcode, nome, categoria, subcategoria, supplier_product_code,
             quantidade, quantidade_minima,
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
      supplierProductCode: 'supplier_product_code',
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
        if (key === 'supplierProductCode') {
          value = this.normalizeSupplierProductCode(value);
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

      // Entries/Exits Today = sum of location_product quantity deltas for the local day.
      // Entries: INSERT qty + UPDATE that increases qty.
      // Exits: DELETE prev qty + UPDATE that decreases qty.
      const timezone = String(process.env.APP_TIMEZONE || 'Australia/Sydney').trim() || 'Australia/Sydney';
      let entradas = 0;
      let saidas = 0;

      try {
        const movementResult = await query(
          `
          SELECT
            COALESCE(SUM(
              CASE
                WHEN UPPER(COALESCE(operation_log, '')) = 'INSERT'
                  THEN GREATEST(COALESCE(quantity_current_log, 0), 0)
                WHEN UPPER(COALESCE(operation_log, '')) = 'UPDATE'
                  AND COALESCE(quantity_current_log, 0) > COALESCE(quantity_current_prev_log, 0)
                  THEN COALESCE(quantity_current_log, 0) - COALESCE(quantity_current_prev_log, 0)
                ELSE 0
              END
            ), 0) AS entradas,
            COALESCE(SUM(
              CASE
                WHEN UPPER(COALESCE(operation_log, '')) = 'DELETE'
                  THEN GREATEST(COALESCE(quantity_current_prev_log, 0), 0)
                WHEN UPPER(COALESCE(operation_log, '')) = 'UPDATE'
                  AND COALESCE(quantity_current_prev_log, 0) > COALESCE(quantity_current_log, 0)
                  THEN COALESCE(quantity_current_prev_log, 0) - COALESCE(quantity_current_log, 0)
                ELSE 0
              END
            ), 0) AS saidas
          FROM location_product_log
          WHERE ((entry_datetime_log AT TIME ZONE 'UTC') AT TIME ZONE $1)::date
              = (CURRENT_TIMESTAMP AT TIME ZONE $1)::date
          `,
          [timezone]
        );
        entradas = parseInt(movementResult.rows[0]?.entradas, 10) || 0;
        saidas = parseInt(movementResult.rows[0]?.saidas, 10) || 0;
      } catch (error) {
        console.warn('⚠️ Entries/Exits Today from location_product_log unavailable:', error.message);
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

  /**
   * Entries/Exits Today broken down by category (or subcategory when category is provided).
   * tipo: 'entradas' | 'saidas'
   */
  async obterMovimentosHojeDetalhe(tipo, categoria = null) {
    const kind = String(tipo || '').trim().toLowerCase();
    if (kind !== 'entradas' && kind !== 'saidas') {
      throw new Error('Type must be "entradas" or "saidas"');
    }

    const timezone = String(process.env.APP_TIMEZONE || 'Australia/Sydney').trim() || 'Australia/Sydney';
    const qtyExpr = kind === 'entradas'
      ? `
        CASE
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'INSERT'
            THEN GREATEST(COALESCE(l.quantity_current_log, 0), 0)
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'UPDATE'
            AND COALESCE(l.quantity_current_log, 0) > COALESCE(l.quantity_current_prev_log, 0)
            THEN COALESCE(l.quantity_current_log, 0) - COALESCE(l.quantity_current_prev_log, 0)
          ELSE 0
        END
      `
      : `
        CASE
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'DELETE'
            THEN GREATEST(COALESCE(l.quantity_current_prev_log, 0), 0)
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'UPDATE'
            AND COALESCE(l.quantity_current_prev_log, 0) > COALESCE(l.quantity_current_log, 0)
            THEN COALESCE(l.quantity_current_prev_log, 0) - COALESCE(l.quantity_current_log, 0)
          ELSE 0
        END
      `;

    const categoryFilter = categoria != null && String(categoria).trim() !== ''
      ? String(categoria).trim().toUpperCase()
      : null;

    const groupLabel = categoryFilter
      ? `COALESCE(NULLIF(TRIM(wi.subcategoria), ''), 'NONE')`
      : `COALESCE(NULLIF(TRIM(wi.categoria), ''), 'UNCATEGORIZED')`;

    const params = [timezone];
    let categorySql = '';
    if (categoryFilter) {
      if (categoryFilter === 'UNCATEGORIZED') {
        categorySql = ` AND (wi.categoria IS NULL OR TRIM(wi.categoria) = '')`;
      } else {
        params.push(categoryFilter);
        categorySql = ` AND UPPER(TRIM(COALESCE(wi.categoria, ''))) = $${params.length}`;
      }
    }

    const result = await query(
      `
      SELECT
        ${groupLabel} AS label,
        COALESCE(SUM(${qtyExpr}), 0)::int AS quantity
      FROM location_product_log l
      LEFT JOIN warehouse_items wi
        ON UPPER(TRIM(wi.codigo)) = UPPER(TRIM(l.product_code_log))
      WHERE ((l.entry_datetime_log AT TIME ZONE 'UTC') AT TIME ZONE $1)::date
          = (CURRENT_TIMESTAMP AT TIME ZONE $1)::date
        ${categorySql}
      GROUP BY 1
      HAVING COALESCE(SUM(${qtyExpr}), 0) > 0
      ORDER BY quantity DESC, label ASC
      `,
      params
    );

    const items = (result.rows || []).map((row) => ({
      label: String(row.label || (categoryFilter ? 'NONE' : 'UNCATEGORIZED')),
      quantity: parseInt(row.quantity, 10) || 0
    }));

    const total = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      tipo: kind,
      level: categoryFilter ? 'subcategoria' : 'categoria',
      categoria: categoryFilter,
      total,
      items
    };
  }

  /**
   * Detail lines for today's Entries/Exits of one category + subcategory.
   * Quantities use the same rules as the pie chart (sum matches the slice).
   */
  async obterMovimentosHojeLinhas(tipo, categoria, subcategoria) {
    const kind = String(tipo || '').trim().toLowerCase();
    if (kind !== 'entradas' && kind !== 'saidas') {
      throw new Error('Type must be "entradas" or "saidas"');
    }

    const categoryFilter = categoria != null && String(categoria).trim() !== ''
      ? String(categoria).trim().toUpperCase()
      : null;
    const subcategoryFilter = subcategoria != null && String(subcategoria).trim() !== ''
      ? String(subcategoria).trim().toUpperCase()
      : null;

    if (!categoryFilter || !subcategoryFilter) {
      throw new Error('Category and subcategory are required');
    }

    const timezone = String(process.env.APP_TIMEZONE || 'Australia/Sydney').trim() || 'Australia/Sydney';
    const qtyExpr = kind === 'entradas'
      ? `
        CASE
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'INSERT'
            THEN GREATEST(COALESCE(l.quantity_current_log, 0), 0)
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'UPDATE'
            AND COALESCE(l.quantity_current_log, 0) > COALESCE(l.quantity_current_prev_log, 0)
            THEN COALESCE(l.quantity_current_log, 0) - COALESCE(l.quantity_current_prev_log, 0)
          ELSE 0
        END
      `
      : `
        CASE
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'DELETE'
            THEN GREATEST(COALESCE(l.quantity_current_prev_log, 0), 0)
          WHEN UPPER(COALESCE(l.operation_log, '')) = 'UPDATE'
            AND COALESCE(l.quantity_current_prev_log, 0) > COALESCE(l.quantity_current_log, 0)
            THEN COALESCE(l.quantity_current_prev_log, 0) - COALESCE(l.quantity_current_log, 0)
          ELSE 0
        END
      `;

    const params = [timezone];
    let categorySql = '';
    if (categoryFilter === 'UNCATEGORIZED') {
      categorySql = ` AND (wi.categoria IS NULL OR TRIM(wi.categoria) = '')`;
    } else {
      params.push(categoryFilter);
      categorySql = ` AND UPPER(TRIM(COALESCE(wi.categoria, ''))) = $${params.length}`;
    }

    let subcategorySql = '';
    if (subcategoryFilter === 'NONE') {
      subcategorySql = ` AND (wi.subcategoria IS NULL OR TRIM(wi.subcategoria) = '')`;
    } else {
      params.push(subcategoryFilter);
      subcategorySql = ` AND UPPER(TRIM(COALESCE(wi.subcategoria, ''))) = $${params.length}`;
    }

    const result = await query(
      `
      SELECT
        l.location_code_log AS location_code,
        l.product_code_log AS product_code,
        (${qtyExpr})::int AS quantity,
        COALESCE(
          CASE
            WHEN LOWER(TRIM(COALESCE(l.usuario_alterou_log, ''))) = 'root' THEN 'Root'
            ELSE NULLIF(TRIM(f.nome), '')
          END,
          NULLIF(TRIM(l.usuario_alterou_log), ''),
          ''
        ) AS changed_by,
        l.entry_datetime_log AS entry_datetime
      FROM location_product_log l
      LEFT JOIN warehouse_items wi
        ON UPPER(TRIM(wi.codigo)) = UPPER(TRIM(l.product_code_log))
      LEFT JOIN funcionarios f
        ON f.id::text = l.usuario_alterou_log
      WHERE ((l.entry_datetime_log AT TIME ZONE 'UTC') AT TIME ZONE $1)::date
          = (CURRENT_TIMESTAMP AT TIME ZONE $1)::date
        ${categorySql}
        ${subcategorySql}
        AND (${qtyExpr}) > 0
      ORDER BY l.entry_datetime_log DESC, l.location_code_log ASC, l.product_code_log ASC
      `,
      params
    );

    const items = (result.rows || []).map((row) => ({
      locationCode: row.location_code != null ? String(row.location_code) : '',
      productCode: row.product_code != null ? String(row.product_code) : '',
      quantityCurrent: parseInt(row.quantity, 10) || 0,
      usuarioInseriuNome: row.changed_by != null ? String(row.changed_by) : '',
      lastUpdateDatetime: row.entry_datetime || null,
      entryDatetime: row.entry_datetime || null
    }));

    const total = items.reduce((sum, item) => sum + (Number(item.quantityCurrent) || 0), 0);

    return {
      tipo: kind,
      categoria: categoryFilter,
      subcategoria: subcategoryFilter,
      total,
      items
    };
  }

  resolveSubcategoria(categoria, subcategoria) {
    if (!categorySupportsSubcategory(categoria)) {
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
      erros.push('Subcategory is invalid');
    }

    if (dados.supplierProductCode !== undefined && dados.supplierProductCode !== null && dados.supplierProductCode !== '') {
      if (String(dados.supplierProductCode).trim().length > 100) {
        erros.push('Supplier product code must be at most 100 characters');
      }
    }

    return erros;
  }

  // Map database row to object
  normalizePhoto(photo) {
    const value = photo != null ? String(photo).trim() : '';
    if (!value || value === 'null' || value === 'undefined') return null;
    return value;
  }

  normalizeSupplierProductCode(value) {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
      return null;
    }
    return trimmed.substring(0, 100);
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
      supplierProductCode: row.supplier_product_code || null,
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
