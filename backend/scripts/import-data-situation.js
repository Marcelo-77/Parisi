// Importa registros de public/data_situation.txt na tabela situation_product
// Cada linha do arquivo vira um registro com sipr_nm_description = conteúdo da linha
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

async function importDataSituation() {
  const filePath = path.join(__dirname, '..', 'public', 'data_situation.txt');

  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo não encontrado:', filePath);
    console.error('   Crie o arquivo com uma descrição por linha.');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    console.log('📭 Nenhuma linha válida no arquivo.');
    await closePool();
    return;
  }

  console.log(`\n📂 Arquivo: ${filePath}`);
  console.log(`📋 Linhas válidas: ${lines.length}\n`);

  let inserted = 0;

  const insertSql = `
    INSERT INTO situation_product (sipr_nm_description)
    VALUES ($1)
  `;

  for (const description of lines) {
    const desc = description.substring(0, 255);
    try {
      await query(insertSql, [desc]);
      inserted++;
    } catch (err) {
      console.error(`   Erro ao inserir "${desc.substring(0, 50)}...":`, err.message);
    }
  }

  console.log(`✅ Inseridos: ${inserted}`);
  console.log(`📊 Total: ${inserted} registros em situation_product.\n`);

  await closePool();
}

importDataSituation().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
