# 🗄️ Configuração do Banco de Dados PostgreSQL

## 📋 Pré-requisitos

1. **PostgreSQL instalado** (versão 12 ou superior)
2. **Node.js** (versão 14 ou superior)
3. **npm** ou **yarn**

## 🚀 Passos para Configuração

### 1. Instalar PostgreSQL

#### Windows:
- Baixe o PostgreSQL em: https://www.postgresql.org/download/windows/
- Instale com as configurações padrão
- Anote a senha do usuário `postgres` que você definiu

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### macOS:
```bash
brew install postgresql
brew services start postgresql
```

### 2. Configurar PostgreSQL

#### Criar banco de dados:
```sql
-- Conectar como postgres
psql -U postgres

-- Criar banco de dados
CREATE DATABASE funcionarios_db;

-- Criar usuário (opcional)
CREATE USER funcionarios_user WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE funcionarios_db TO funcionarios_user;

-- Sair
\q
```

### 3. Instalar Dependências do Node.js

```bash
# No diretório backend
npm install pg dotenv
```

### 4. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto backend com:

```env
# Configurações do Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=funcionarios_db
DB_USER=postgres
DB_PASSWORD=sua_senha_do_postgres
```

### 5. Inicializar o Banco de Dados

```bash
# Executar script de inicialização
node scripts/init-database.js
```

### 6. Iniciar o Servidor

```bash
# Iniciar servidor
npm start
# ou
node server.js
```

## 🔧 Configurações Alternativas

### Usando Docker (Recomendado)

Se preferir usar Docker, crie um arquivo `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: funcionarios_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Execute:
```bash
docker-compose up -d
```

### Usando SQLite (Para Desenvolvimento)

Se preferir usar SQLite (mais simples para desenvolvimento):

1. Instale sqlite3:
```bash
npm install sqlite3
```

2. Use o arquivo `funcionarioServiceSQLite.js` (será criado se necessário)

## 🧪 Testando a Configuração

1. **Verificar conexão:**
```bash
node -e "
const { query } = require('./config/database');
query('SELECT NOW()').then(r => console.log('✅ Conexão OK:', r.rows[0])).catch(e => console.error('❌ Erro:', e));
"
```

2. **Verificar tabelas:**
```bash
node -e "
const { query } = require('./config/database');
query('SELECT COUNT(*) FROM funcionarios').then(r => console.log('✅ Funcionários:', r.rows[0].count)).catch(e => console.error('❌ Erro:', e));
"
```

3. **Testar API:**
```bash
curl http://localhost:3000/api/funcionarios
```

## 🚨 Solução de Problemas

### Erro de Conexão
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no arquivo `.env`
- Teste a conexão manualmente: `psql -U postgres -d funcionarios_db`

### Erro de Permissão
- Verifique se o usuário tem permissões no banco
- Execute: `GRANT ALL PRIVILEGES ON DATABASE funcionarios_db TO postgres;`

### Erro de Porta
- Verifique se a porta 5432 está disponível
- Mude a porta no `.env` se necessário

## 📊 Estrutura do Banco

A tabela `funcionarios` será criada com:

```sql
CREATE TABLE funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  cargo VARCHAR(50) NOT NULL,
  departamento VARCHAR(50) NOT NULL,
  salario DECIMAL(10,2),
  data_admissao DATE,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Migração de Dados

Se você já tem dados no arquivo JSON, pode migrá-los:

```bash
node scripts/migrate-from-json.js
```

Este script lerá o arquivo `data/funcionarios.json` e inserirá os dados no banco PostgreSQL.



