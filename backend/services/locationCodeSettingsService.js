const { query } = require('../config/database');

const SETTINGS_TABLE = 'location_code_settings';
const SCHEMES = ['classic', 'bay_level_position'];

const DEFAULTS = {
  activeScheme: 'classic',
  levelOnlyUsesLPrefix: true,
  withPositionOmitsL: true,
  separator: '-',
  allowLevelOnly: true,
  allowPosition: true,
  bayPatternHint: 'A1, A2, B1...',
  minLevel: 0,
  maxLevel: 99,
  minPosition: 1,
  maxPosition: 99
};

function normalizeScheme(value) {
  const scheme = String(value || '').trim().toLowerCase();
  return SCHEMES.includes(scheme) ? scheme : DEFAULTS.activeScheme;
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function normalizeSeparator(value) {
  const sep = String(value == null ? DEFAULTS.separator : value).trim();
  return sep || DEFAULTS.separator;
}

function normalizeInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  if (n < min || n > max) return fallback;
  return n;
}

function mapSettings(row) {
  if (!row) return { ...DEFAULTS };
  return {
    activeScheme: normalizeScheme(row.active_scheme),
    levelOnlyUsesLPrefix: normalizeBoolean(row.level_only_uses_l_prefix, DEFAULTS.levelOnlyUsesLPrefix),
    withPositionOmitsL: normalizeBoolean(row.with_position_omits_l, DEFAULTS.withPositionOmitsL),
    separator: normalizeSeparator(row.separator),
    allowLevelOnly: normalizeBoolean(row.allow_level_only, DEFAULTS.allowLevelOnly),
    allowPosition: normalizeBoolean(row.allow_position, DEFAULTS.allowPosition),
    bayPatternHint: String(row.bay_pattern_hint || DEFAULTS.bayPatternHint).trim() || DEFAULTS.bayPatternHint,
    minLevel: normalizeInt(row.min_level, DEFAULTS.minLevel, 0, 999),
    maxLevel: normalizeInt(row.max_level, DEFAULTS.maxLevel, 0, 999),
    minPosition: normalizeInt(row.min_position, DEFAULTS.minPosition, 1, 999),
    maxPosition: normalizeInt(row.max_position, DEFAULTS.maxPosition, 1, 999)
  };
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      active_scheme VARCHAR(40) NOT NULL DEFAULT 'classic',
      level_only_uses_l_prefix BOOLEAN NOT NULL DEFAULT true,
      with_position_omits_l BOOLEAN NOT NULL DEFAULT true,
      separator VARCHAR(5) NOT NULL DEFAULT '-',
      allow_level_only BOOLEAN NOT NULL DEFAULT true,
      allow_position BOOLEAN NOT NULL DEFAULT true,
      bay_pattern_hint VARCHAR(80) NOT NULL DEFAULT 'A1, A2, B1...',
      min_level INTEGER NOT NULL DEFAULT 0,
      max_level INTEGER NOT NULL DEFAULT 99,
      min_position INTEGER NOT NULL DEFAULT 1,
      max_position INTEGER NOT NULL DEFAULT 99,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT location_code_settings_scheme_chk
        CHECK (active_scheme IN ('classic', 'bay_level_position'))
    )
  `);

  await query(`
    INSERT INTO ${SETTINGS_TABLE} (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function getSettings() {
  await ensureTable();
  const result = await query(`SELECT * FROM ${SETTINGS_TABLE} WHERE id = 1`);
  return mapSettings(result.rows[0]);
}

async function saveSettings(payload = {}) {
  await ensureTable();
  const current = await getSettings();

  const next = {
    activeScheme: normalizeScheme(payload.activeScheme ?? current.activeScheme),
    levelOnlyUsesLPrefix: normalizeBoolean(
      payload.levelOnlyUsesLPrefix ?? current.levelOnlyUsesLPrefix,
      DEFAULTS.levelOnlyUsesLPrefix
    ),
    withPositionOmitsL: normalizeBoolean(
      payload.withPositionOmitsL ?? current.withPositionOmitsL,
      DEFAULTS.withPositionOmitsL
    ),
    separator: normalizeSeparator(payload.separator ?? current.separator),
    allowLevelOnly: normalizeBoolean(payload.allowLevelOnly ?? current.allowLevelOnly, DEFAULTS.allowLevelOnly),
    allowPosition: normalizeBoolean(payload.allowPosition ?? current.allowPosition, DEFAULTS.allowPosition),
    bayPatternHint: String(payload.bayPatternHint ?? current.bayPatternHint).trim() || DEFAULTS.bayPatternHint,
    minLevel: normalizeInt(payload.minLevel ?? current.minLevel, DEFAULTS.minLevel, 0, 999),
    maxLevel: normalizeInt(payload.maxLevel ?? current.maxLevel, DEFAULTS.maxLevel, 0, 999),
    minPosition: normalizeInt(payload.minPosition ?? current.minPosition, DEFAULTS.minPosition, 1, 999),
    maxPosition: normalizeInt(payload.maxPosition ?? current.maxPosition, DEFAULTS.maxPosition, 1, 999)
  };

  if (next.minLevel > next.maxLevel) {
    throw new Error('Minimum level cannot be greater than maximum level');
  }
  if (next.minPosition > next.maxPosition) {
    throw new Error('Minimum position cannot be greater than maximum position');
  }
  if (!next.allowLevelOnly && !next.allowPosition) {
    throw new Error('Enable at least Level-only or Level + Position');
  }

  await query(
    `
    INSERT INTO ${SETTINGS_TABLE} (
      id, active_scheme, level_only_uses_l_prefix, with_position_omits_l, separator,
      allow_level_only, allow_position, bay_pattern_hint,
      min_level, max_level, min_position, max_position, updated_at
    ) VALUES (
      1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      active_scheme = EXCLUDED.active_scheme,
      level_only_uses_l_prefix = EXCLUDED.level_only_uses_l_prefix,
      with_position_omits_l = EXCLUDED.with_position_omits_l,
      separator = EXCLUDED.separator,
      allow_level_only = EXCLUDED.allow_level_only,
      allow_position = EXCLUDED.allow_position,
      bay_pattern_hint = EXCLUDED.bay_pattern_hint,
      min_level = EXCLUDED.min_level,
      max_level = EXCLUDED.max_level,
      min_position = EXCLUDED.min_position,
      max_position = EXCLUDED.max_position,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      next.activeScheme,
      next.levelOnlyUsesLPrefix,
      next.withPositionOmitsL,
      next.separator,
      next.allowLevelOnly,
      next.allowPosition,
      next.bayPatternHint,
      next.minLevel,
      next.maxLevel,
      next.minPosition,
      next.maxPosition
    ]
  );

  return getSettings();
}

function composeBayLevelPositionCode(parts = {}, settings = DEFAULTS) {
  const bay = String(parts.bay || '').trim().toUpperCase();
  const levelRaw = parts.level;
  const positionRaw = parts.position;
  const sep = normalizeSeparator(settings.separator);

  if (!bay) return '';
  if (!/^[A-Z0-9]{1,10}$/.test(bay)) return '';

  const level = Number(levelRaw);
  if (!Number.isInteger(level) || level < settings.minLevel || level > settings.maxLevel) {
    return '';
  }

  const hasPosition = positionRaw !== '' && positionRaw != null;
  if (!hasPosition) {
    if (!settings.allowLevelOnly) return '';
    const levelToken = settings.levelOnlyUsesLPrefix ? `L${level}` : String(level);
    return `${bay}${sep}${levelToken}`;
  }

  if (!settings.allowPosition) return '';
  const position = Number(positionRaw);
  if (!Number.isInteger(position) || position < settings.minPosition || position > settings.maxPosition) {
    return '';
  }

  const levelToken = settings.withPositionOmitsL ? String(level) : `L${level}`;
  return `${bay}${sep}${levelToken}${sep}${position}`;
}

module.exports = {
  SCHEMES,
  DEFAULTS,
  ensureTable,
  getSettings,
  saveSettings,
  composeBayLevelPositionCode,
  mapSettings
};
