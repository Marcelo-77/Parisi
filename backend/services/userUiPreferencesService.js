const { query } = require('../config/database');

const DEFAULTS = {
  mode: 'classic',
  color: '#101d35',
  tone: 50,
  layoutNoticeSeen: false
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
      layout_notice_seen BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE user_ui_preferences
    ADD COLUMN IF NOT EXISTS layout_notice_seen BOOLEAN NOT NULL DEFAULT FALSE
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

function normalizeBool(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value == null) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return fallback;
}

function toPublic(row, saved) {
  if (!row) {
    return { ...DEFAULTS, saved: false };
  }
  return {
    mode: normalizeMode(row.screen_display_mode),
    color: normalizeColor(row.screen_display_color),
    tone: normalizeTone(row.screen_display_tone),
    layoutNoticeSeen: normalizeBool(row.layout_notice_seen, false),
    saved: saved !== false
  };
}

async function getForOwner(ownerKey, alternateKeys = []) {
  if (!ownerKey) return { ...DEFAULTS, saved: false };
  await ensureSchema();
  const keys = [String(ownerKey), ...alternateKeys.map((k) => String(k || '').trim()).filter(Boolean)]
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
  const result = await query(
    `SELECT owner_key, screen_display_mode, screen_display_color, screen_display_tone, layout_notice_seen
     FROM user_ui_preferences
     WHERE owner_key = ANY($1::text[])
     ORDER BY CASE WHEN owner_key = $2 THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1`,
    [keys, String(ownerKey)]
  );
  if (!result.rows[0]) return { ...DEFAULTS, saved: false };
  return toPublic(result.rows[0], true);
}

async function upsertForOwner(ownerKey, prefs = {}) {
  if (!ownerKey) {
    throw new Error('Owner key required');
  }
  await ensureSchema();
  const existing = await getForOwner(ownerKey);
  const mode = prefs.mode !== undefined ? normalizeMode(prefs.mode) : existing.mode;
  const color = prefs.color !== undefined ? normalizeColor(prefs.color) : existing.color;
  const tone = prefs.tone !== undefined ? normalizeTone(prefs.tone) : existing.tone;
  const layoutNoticeSeen = prefs.layoutNoticeSeen !== undefined
    ? normalizeBool(prefs.layoutNoticeSeen, false)
    : Boolean(existing.layoutNoticeSeen);

  const result = await query(
    `INSERT INTO user_ui_preferences (
       owner_key, screen_display_mode, screen_display_color, screen_display_tone, layout_notice_seen, updated_at
     ) VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (owner_key) DO UPDATE SET
       screen_display_mode = EXCLUDED.screen_display_mode,
       screen_display_color = EXCLUDED.screen_display_color,
       screen_display_tone = EXCLUDED.screen_display_tone,
       layout_notice_seen = EXCLUDED.layout_notice_seen,
       updated_at = NOW()
     RETURNING screen_display_mode, screen_display_color, screen_display_tone, layout_notice_seen`,
    [String(ownerKey), mode, color, tone, layoutNoticeSeen]
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
