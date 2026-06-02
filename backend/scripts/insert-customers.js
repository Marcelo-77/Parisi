// Script para inserir 10 clientes na tabela customer
const { query } = require('../config/database');

const customers = [
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST001', cust_ds_address: '100 George St, Sydney NSW 2000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST002', cust_ds_address: '250 Elizabeth St, Melbourne VIC 3000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST003', cust_ds_address: '270 Queen St, Brisbane QLD 4000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST004', cust_ds_address: '800 Hay St, Perth WA 6000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST005', cust_ds_address: '100 Rundle Mall, Adelaide SA 5000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST006', cust_ds_address: '3 Southport Central, Gold Coast QLD 4215' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST007', cust_ds_address: '1 Hunter St, Newcastle NSW 2300' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST008', cust_ds_address: '1 Canberra Centre, Canberra ACT 2601' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST009', cust_ds_address: '116 Liverpool St, Hobart TAS 7000' },
  { cust_nm_customer: 'Harvey Norman', cust_cd_code: 'CUST010', cust_ds_address: '159 Church St, Parramatta NSW 2150' }
];

async function insertCustomers() {
  try {
    console.log('Inserindo 10 clientes na tabela customer...');
    for (const c of customers) {
      await query(
        `INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address) VALUES ($1, $2, $3)`,
        [c.cust_nm_customer, c.cust_cd_code, c.cust_ds_address]
      );
      console.log('  Inserido:', c.cust_cd_code, '-', c.cust_nm_customer);
    }
    console.log('✅ 10 clientes inseridos com sucesso.');
  } catch (error) {
    if (error.code === '23505') {
      console.warn('⚠️ Algum código (cust_cd_code) já existe. Remova os registros ou use códigos diferentes.');
    } else {
      console.error('❌ Erro:', error.message);
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

insertCustomers();
