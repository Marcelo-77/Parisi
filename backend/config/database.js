// =============================================================================
// EXEMPLO: conexao PostgreSQL no Neon
// Valores alinhados com backend/exemplo.env
//
// Como usar:
//   1) Copie backend/exemplo.env -> backend/config.env
//   2) Copie este arquivo -> backend/config/database.js  (so se quiser este modelo)
//   3) Rode na pasta backend: node server.js
//
// Nao commitar senhas reais no Git.
// =============================================================================

const { Pool } = require('pg');

// Connection string (opcional; prioridade se DATABASE_URL estiver definida)
const NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_1pO6RgmPxFzb@ep-nameless-forest-apd4r0pi-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Variaveis separadas (mesmos valores de exemplo.env)
const NEON_DEFAULTS = {
  host: 'ep-nameless-forest-apd4r0pi-pooler.c-7.us-east-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_1pO6RgmPxFzb',
  ssl: true,
};

function buildPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL || NEON_DATABASE_URL;

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    const parsed = new URL(databaseUrl);
    const config = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : NEON_DEFAULTS.port,
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || NEON_DEFAULTS.database),
      user: decodeURIComponent(parsed.username || NEON_DEFAULTS.user),
      password: decodeURIComponent(parsed.password || NEON_DEFAULTS.password),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    };
    return config;
  }

  const host = process.env.DB_HOST || NEON_DEFAULTS.host;
  const useSsl =
    process.env.DB_SSL === 'true' ||
    NEON_DEFAULTS.ssl ||
    (host && host.includes('neon.tech'));

  const config = {
    host,
    port: Number(process.env.DB_PORT) || NEON_DEFAULTS.port,
    database: process.env.DB_NAME || NEON_DEFAULTS.database,
    user: process.env.DB_USER || NEON_DEFAULTS.user,
    password: process.env.DB_PASSWORD || NEON_DEFAULTS.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: useSsl ? 10000 : 2000,
  };

  if (useSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

const pool = new Pool(buildPoolConfig());

pool.on('connect', () => {
  console.log('✅ Conectado ao banco de dados PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('❌ Erro na conexão com o banco de dados:', err);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query executada em ${duration}ms: ${text.substring(0, 50)}...`);
    return res;
  } catch (error) {
    console.error('❌ Erro na query:', error);
    throw error;
  }
};

const getClient = async () => {
  return await pool.connect();
};

const closePool = async () => {
  await pool.end();
};

module.exports = {
  query,
  getClient,
  closePool,
  pool,
};
