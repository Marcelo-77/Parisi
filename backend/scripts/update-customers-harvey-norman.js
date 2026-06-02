// Atualizar os 10 registros da tabela customer: nome "Harvey Norman", endereços Austrália
const { query } = require('../config/database');

const updates = [
  { code: 'CUST001', address: '100 George St, Sydney NSW 2000' },
  { code: 'CUST002', address: '250 Elizabeth St, Melbourne VIC 3000' },
  { code: 'CUST003', address: '270 Queen St, Brisbane QLD 4000' },
  { code: 'CUST004', address: '800 Hay St, Perth WA 6000' },
  { code: 'CUST005', address: '100 Rundle Mall, Adelaide SA 5000' },
  { code: 'CUST006', address: '3 Southport Central, Gold Coast QLD 4215' },
  { code: 'CUST007', address: '1 Hunter St, Newcastle NSW 2300' },
  { code: 'CUST008', address: '1 Canberra Centre, Canberra ACT 2601' },
  { code: 'CUST009', address: '116 Liverpool St, Hobart TAS 7000' },
  { code: 'CUST010', address: '159 Church St, Parramatta NSW 2150' }
];

async function run() {
  try {
    console.log('Atualizando 10 clientes para Harvey Norman (endereços Austrália)...');
    for (const u of updates) {
      const res = await query(
        `UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = $1 WHERE cust_cd_code = $2`,
        [u.address, u.code]
      );
      if (res.rowCount > 0) console.log('  OK:', u.code, '-', u.address);
      else console.log('  (não encontrado):', u.code);
    }
    console.log('✅ Atualização concluída.');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
