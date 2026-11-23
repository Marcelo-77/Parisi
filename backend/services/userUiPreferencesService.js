const { query } = require('../config/database');

const DEFAULTS = {
  mode: 'classic',
  color: '#101d35',
  tone: 50
};

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_ui_preferences (
      owner_key TEXT PRIMARY KEY,
      screen_display_mode TEXT NOT NULL DEFAULT 'classic',
      screen_display_color TEXT NOT NULL DEFAULT '#101d35',
      screen_display_tone INTEGER NOT NULL DEFAULT 50,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

function normalizeMode(value) {
  return String(value || '').trim().toLowerCase() === 'sidebar' ? 'sidebar' : 'classic';
}

function normalizeColor(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return DEFAULTS.color;
  return `#${match[1].toLowerCase()}`;
}

function normalizeTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULTS.tone;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toPublic(row, saved) {
  if (!row) {
    return { ...DEFAULTS, saved: false };
  }
  return {
    mode: normalizeMode(row.screen_display_mode),
    color: normalizeColor(row.screen_display_color),
    tone: normalizeTone(row.screen_display_tone),
    saved: saved !== false
  };
}

async function getForOwner(ownerKey) {
  if (!ownerKey) return { ...DEFAULTS, saved: false };
  await ensureSchema();
  const result = await query(
    `SELECT screen_display_mode, screen_display_color, screen_display_tone
     FROM user_ui_preferences
     WHERE owner_key = $1
     LIMIT 1`,
    [String(ownerKey)]
  );
  if (!result.rows[0]) return { ...DEFAULTS, saved: false };
  return toPublic(result.rows[0], true);
}

async function upsertForOwner(ownerKey, prefs = {}) {
  if (!ownerKey) {
    throw new Error('Owner key required');
  }
  await ensureSchema();
  const mode = normalizeMode(prefs.mode);
  const color = normalizeColor(prefs.color);
  const tone = normalizeTone(prefs.tone);
  const result = await query(
    `INSERT INTO user_ui_preferences (
       owner_key, screen_display_mode, screen_display_color, screen_display_tone, updated_at
     ) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (owner_key) DO UPDATE SET
       screen_display_mode = EXCLUDED.screen_display_mode,
       screen_display_color = EXCLUDED.screen_display_color,
       screen_display_tone = EXCLUDED.screen_display_tone,
       updated_at = NOW()
     RETURNING screen_display_mode, screen_display_color, screen_display_tone`,
    [String(ownerKey), mode, color, tone]
  );
  return toPublic(result.rows[0], true);
}

module.exports = {
  DEFAULTS,
  getForOwner,
  upsertForOwner,
  normalizeMode,
  normalizeColor,
  normalizeTone
};
