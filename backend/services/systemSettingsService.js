const { query } = require('../config/database');

const TABLE = 'system_settings';

const DEFAULTS = {
  show_header_stats: 'true',
  background_color: '#667eea',
  background_color_end: '#764ba2',
  session_inactivity_minutes: '30'
};

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const [key, value] of Object.entries(DEFAULTS)) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ($1, $2)
       ON CONFLICT (setting_key) DO NOTHING`,
      [key, value]
    );
  }

  schemaReady = true;
}

function toPublicSettings(map) {
  const showHeaderStats = String(map.show_header_stats ?? DEFAULTS.show_header_stats).toLowerCase() !== 'false';
  const backgroundColor = map.background_color || DEFAULTS.background_color;
  const backgroundColorEnd = map.background_color_end || DEFAULTS.background_color_end;
  const inactivityRaw = parseInt(String(map.session_inactivity_minutes ?? DEFAULTS.session_inactivity_minutes), 10);
  const sessionInactivityMinutes = Number.isInteger(inactivityRaw) && inactivityRaw >= 1 && inactivityRaw <= 240
    ? inactivityRaw
    : parseInt(DEFAULTS.session_inactivity_minutes, 10);

  return {
    showHeaderStats,
    backgroundColor,
    backgroundColorEnd,
    sessionInactivityMinutes
  };
}

async function getSettings() {
  await ensureSchema();
  const result = await query(`SELECT setting_key, setting_value FROM ${TABLE}`);
  const map = { ...DEFAULTS };
  (result.rows || []).forEach((row) => {
    map[row.setting_key] = row.setting_value;
  });
  return toPublicSettings(map);
}

async function updateSettings(payload) {
  await ensureSchema();

  const showHeaderStats = payload.showHeaderStats !== false;
  const backgroundColor = String(payload.backgroundColor || DEFAULTS.background_color).trim();
  const backgroundColorEnd = String(payload.backgroundColorEnd || DEFAULTS.background_color_end).trim();
  const inactivityInput = parseInt(String(payload.sessionInactivityMinutes ?? DEFAULTS.session_inactivity_minutes), 10);
  const sessionInactivityMinutes = Number.isInteger(inactivityInput) ? inactivityInput : NaN;

  if (!/^#[0-9A-Fa-f]{6}$/.test(backgroundColor) || !/^#[0-9A-Fa-f]{6}$/.test(backgroundColorEnd)) {
    throw new Error('Background colors must be valid hex values (e.g. #667eea).');
  }
  if (!Number.isInteger(sessionInactivityMinutes) || sessionInactivityMinutes < 1 || sessionInactivityMinutes > 240) {
    throw new Error('Session inactivity time must be between 1 and 240 minutes.');
  }

  const entries = [
    ['show_header_stats', showHeaderStats ? 'true' : 'false'],
    ['background_color', backgroundColor],
    ['background_color_end', backgroundColorEnd],
    ['session_inactivity_minutes', String(sessionInactivityMinutes)]
  ];

  for (const [key, value] of entries) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
  ensureSchema,
  DEFAULTS
};
