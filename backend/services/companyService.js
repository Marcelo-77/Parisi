const { query } = require('../config/database');

const TABLE = 'company';

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

async function list() {
  const result = await query(
    `SELECT id, name, criado_em, atualizado_em FROM ${TABLE} ORDER BY name ASC`
  );
  return (result.rows || []).map(mapRow);
}

async function findById(id) {
  const result = await query(
    `SELECT id, name, criado_em, atualizado_em FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

module.exports = {
  list,
  findById
};
