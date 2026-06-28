const { Pool, types } = require('pg');

// Keep PostgreSQL DATE values as YYYY-MM-DD strings (avoid timezone day shifts).
types.setTypeParser(1082, (value) => value);

// Configurações do banco de dados (lidas de backend/config.env)
const host = process.env.DB_HOST || 'localhost';
const useSsl =
  process.env.DB_SSL === 'true' ||
  (host && host.includes('neon.tech'));

const dbConfig = {
  host,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'funcionarios_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: useSsl ? 10000 : 2000,
};

if (useSsl) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('✅ Conectado ao banco de dados PostgreSQL');
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
