const { query } = require('../config/database');

const TABLE = 'customer';

const DEFAULT_CUSTOMERS = [
  { name: 'Harvey Norman', code: 'CUST001', address: '100 George St, Sydney NSW 2000' },
  { name: 'Harvey Norman', code: 'CUST002', address: '250 Elizabeth St, Melbourne VIC 3000' },
  { name: 'Harvey Norman', code: 'CUST003', address: '270 Queen St, Brisbane QLD 4000' },
  { name: 'Harvey Norman', code: 'CUST004', address: '800 Hay St, Perth WA 6000' },
  { name: 'Harvey Norman', code: 'CUST005', address: '100 Rundle Mall, Adelaide SA 5000' },
  { name: 'Harvey Norman', code: 'CUST006', address: '3 Southport Central, Gold Coast QLD 4215' },
  { name: 'Harvey Norman', code: 'CUST007', address: '1 Hunter St, Newcastle NSW 2300' },
  { name: 'Harvey Norman', code: 'CUST008', address: '1 Canberra Centre, Canberra ACT 2601' },
  { name: 'Harvey Norman', code: 'CUST009', address: '116 Liverpool St, Hobart TAS 7000' },
  { name: 'Harvey Norman', code: 'CUST010', address: '159 Church St, Parramatta NSW 2150' }
];

async function list(filters = {}) {
  const whereClauses = [];
  const values = [];
  let idx = 1;
  if (filters.custNmCustomer && String(filters.custNmCustomer).trim()) {
    whereClauses.push(`cust_nm_customer ILIKE $${idx++}`);
    values.push(`%${String(filters.custNmCustomer).trim()}%`);
  }
  if (filters.custCdCode && String(filters.custCdCode).trim()) {
    whereClauses.push(`cust_cd_code ILIKE $${idx++}`);
    values.push(`%${String(filters.custCdCode).trim()}%`);
  }
  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `SELECT cust_cd_id, cust_nm_customer, cust_cd_code, cust_ds_address FROM ${TABLE} ${where} ORDER BY cust_nm_customer NULLS LAST, cust_cd_id`;
  try {
    let result = await query(sql, values);
    let rows = result.rows || [];
    if (rows.length === 0 && !where) {
      try {
        for (const c of DEFAULT_CUSTOMERS) {
          await query(
            `INSERT INTO ${TABLE} (cust_nm_customer, cust_cd_code, cust_ds_address) VALUES ($1, $2, $3)`,
            [c.name, c.code, c.address]
          );
        }
        result = await query(sql, values);
        rows = result.rows || [];
      } catch (insertErr) {
        console.warn('⚠️ customer seed on empty:', insertErr.message);
      }
    }
    return rows.map(row => ({
      custCdId: row.cust_cd_id != null ? parseInt(row.cust_cd_id, 10) : null,
      custNmCustomer: row.cust_nm_customer != null ? String(row.cust_nm_customer).trim() : null,
      custCdCode: row.cust_cd_code != null ? String(row.cust_cd_code).trim() : null,
      custDsAddress: row.cust_ds_address != null ? String(row.cust_ds_address).trim() : null
    }));
  } catch (error) {
    console.error('❌ Error listing customers:', error);
    throw new Error(`Error listing customers: ${error.message}`);
  }
}

async function create(data) {
  const name = (data.custNmCustomer != null && String(data.custNmCustomer).trim()) ? String(data.custNmCustomer).trim().substring(0, 50) : null;
  const code = (data.custCdCode != null && String(data.custCdCode).trim()) ? String(data.custCdCode).trim().substring(0, 20) : null;
  const address = (data.custDsAddress != null && String(data.custDsAddress).trim()) ? String(data.custDsAddress).trim().substring(0, 100) : null;
  if (!name && !code) throw new Error('Customer name or code is required.');
  const sql = `INSERT INTO ${TABLE} (cust_nm_customer, cust_cd_code, cust_ds_address) VALUES ($1, $2, $3) RETURNING *`;
  try {
    const result = await query(sql, [name, code, address]);
    const row = result.rows[0];
    return {
      custCdId: row.cust_cd_id != null ? parseInt(row.cust_cd_id, 10) : null,
      custNmCustomer: row.cust_nm_customer != null ? String(row.cust_nm_customer).trim() : null,
      custCdCode: row.cust_cd_code != null ? String(row.cust_cd_code).trim() : null,
      custDsAddress: row.cust_ds_address != null ? String(row.cust_ds_address).trim() : null
    };
  } catch (error) {
    if (error.code === '23505') throw new Error('Customer code already exists.');
    console.error('❌ Error creating customer:', error);
    throw new Error(`Error creating customer: ${error.message}`);
  }
}

module.exports = { list, create };
