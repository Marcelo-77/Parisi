// Importa registros de products.txt na tabela warehouse_items
// Para cada linha: codigo = linha, nome = linha, categoria fixa, quantidades = 0.
// As datas criado_em/atualizado_em usam CURRENT_TIMESTAMP (NOW) definidos na tabela.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const CATEGORIA = 'TAPWARE';
const QUANTIDADE = 0;
const QUANTIDADE_MINIMA = 0;

async function importProductsFromTxt() {
  const filePath = path.join(__dirname, '..', 'products.txt');

  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo não encontrado:', filePath);
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
  console.log(`📋 Linhas válidas: ${lines.length}`);
  console.log(
    `   categoria = "${CATEGORIA}", quantidade = ${QUANTIDADE}, quantidade_minima = ${QUANTIDADE_MINIMA}\n`,
  );

  let inserted = 0;
  let skipped = 0;

  // warehouse_items: codigo UNIQUE, nome, categoria, quantidade, quantidade_minima, localizacao, preco_unitario, fornecedor, descricao
  const insertSql = `
    INSERT INTO warehouse_items (codigo, nome, categoria, quantidade, quantidade_minima, localizacao, preco_unitario, fornecedor, descricao)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (codigo) DO NOTHING
  `;

  for (const line of lines) {
    const codigo = line.substring(0, 50);
    const nome = line.substring(0, 100);
    try {
      const result = await query(insertSql, [
        codigo,
        nome,
        CATEGORIA,
        QUANTIDADE,
        QUANTIDADE_MINIMA,
        null, // localizacao
        0,    // preco_unitario
        null, // fornecedor
        null, // descricao
      ]);
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`   Erro ao inserir "${codigo}":`, err.message);
    }
  }

  console.log(`✅ Inseridos: ${inserted}`);
  console.log(`⏭️  Já existiam (ignorados): ${skipped}`);
  console.log(`📊 Total: ${inserted + skipped} linhas processadas.\n`);

  await closePool();
}

importProductsFromTxt().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});

