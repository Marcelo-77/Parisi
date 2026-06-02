// Script para migrar dados do arquivo JSON para PostgreSQL
const fs = require('fs').promises;
const path = require('path');
const { query } = require('../config/database');
const { initDatabase } = require('./init-database');

async function migrateFromJSON() {
  try {
    console.log('🔄 Iniciando migração de dados do JSON para PostgreSQL...');

    // Inicializar banco de dados
    await initDatabase();

    // Ler arquivo JSON
    const jsonPath = path.join(__dirname, '..', 'data', 'funcionarios.json');
    
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      const funcionarios = JSON.parse(jsonData);
      
      console.log(`📊 Encontrados ${funcionarios.length} funcionários no arquivo JSON`);

      // Verificar se já existem dados no banco
      const countResult = await query('SELECT COUNT(*) FROM funcionarios');
      const count = parseInt(countResult.rows[0].count);

      if (count > 0) {
        console.log(`⚠️  Banco já possui ${count} funcionários. Deseja continuar? (S/N)`);
        // Em um ambiente real, você pediria confirmação do usuário
        console.log('🔄 Continuando migração...');
      }

      let migrated = 0;
      let errors = 0;

      for (const funcionarioData of funcionarios) {
        try {
          // Verificar se funcionário já existe (por email)
          const existingResult = await query('SELECT id FROM funcionarios WHERE email = $1', [funcionarioData.email]);
          
          if (existingResult.rows.length > 0) {
            console.log(`⏭️  Funcionário ${funcionarioData.nome} já existe, pulando...`);
            continue;
          }

          // Inserir funcionário
          const insertQuery = `
            INSERT INTO funcionarios 
            (id, nome, email, telefone, cargo, departamento, salario, data_admissao, ativo, criado_em, atualizado_em)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;

          const values = [
            funcionarioData.id,
            funcionarioData.nome,
            funcionarioData.email,
            funcionarioData.telefone,
            funcionarioData.cargo,
            funcionarioData.departamento,
            funcionarioData.salario,
            funcionarioData.dataAdmissao,
            funcionarioData.ativo,
            funcionarioData.criadoEm,
            funcionarioData.atualizadoEm
          ];

          await query(insertQuery, values);
          migrated++;
          console.log(`✅ Migrado: ${funcionarioData.nome}`);

        } catch (error) {
          errors++;
          console.error(`❌ Erro ao migrar ${funcionarioData.nome}:`, error.message);
        }
      }

      console.log('\n📊 Resumo da Migração:');
      console.log(`✅ Funcionários migrados: ${migrated}`);
      console.log(`❌ Erros: ${errors}`);
      console.log(`📊 Total processados: ${funcionarios.length}`);

      // Verificar total no banco
      const finalCount = await query('SELECT COUNT(*) FROM funcionarios');
      console.log(`📊 Total de funcionários no banco: ${finalCount.rows[0].count}`);

      // Fazer backup do arquivo JSON
      const backupPath = path.join(__dirname, '..', 'data', `funcionarios_backup_${Date.now()}.json`);
      await fs.copyFile(jsonPath, backupPath);
      console.log(`💾 Backup criado: ${backupPath}`);

      console.log('🎉 Migração concluída com sucesso!');

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 Arquivo JSON não encontrado. Nenhuma migração necessária.');
        console.log('💡 O banco será inicializado com dados de exemplo.');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateFromJSON()
    .then(() => {
      console.log('✅ Script de migração concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no script de migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateFromJSON };



