const { query } = require('../config/database');
const locationService = require('./locationService');
const {
  composeBayLevelPositionCode,
  DEFAULTS
} = require('./locationCodeSettingsService');

const SIDE_TO_POS = { R: 1, L: 2, M: 3 };
const POS_TO_SIDE = { 1: 'R', 2: 'L', 3: 'M' };

function normalizeNumberValue(raw) {
  if (raw === '' || raw == null) return '';
  const value = Number(raw);
  return Number.isNaN(value) ? '' : String(value);
}

function emptyParts(extra = {}) {
  return {
    street: '',
    building: '',
    buildingX: '',
    level: '',
    side: '',
    sublevel: '',
    behind: '',
    levelZeroMode: '',
    ...extra
  };
}

/** Server-side classic parser (mirrors public/location-code-utils.js). */
function parseClassicLocationCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized || !/^[A-Z]/.test(normalized)) return emptyParts();

  const street = normalized[0];
  const rest = normalized.slice(1);
  if (!rest) return emptyParts({ street });

  const a21XMatch = rest.match(/^(\d+)X(\d+)-0(\d+)(B)?$/);
  if (a21XMatch) {
    return emptyParts({
      street,
      building: normalizeNumberValue(a21XMatch[1]),
      buildingX: normalizeNumberValue(a21XMatch[2]),
      level: '0',
      sublevel: normalizeNumberValue(a21XMatch[3]),
      behind: a21XMatch[4] === 'B' ? 'B' : '',
      levelZeroMode: 'sublevel'
    });
  }

  const dashedLevelSideMatch = rest.match(/^(\d+)-(\d+)([RLM])$/);
  if (dashedLevelSideMatch) {
    const level = dashedLevelSideMatch[2];
    return emptyParts({
      street,
      building: dashedLevelSideMatch[1],
      level,
      side: dashedLevelSideMatch[3],
      levelZeroMode: level === '0' ? 'side' : ''
    });
  }

  const dashedSublevelMatch = rest.match(/^(\d+)-0(\d+)(B)?$/);
  if (dashedSublevelMatch) {
    return emptyParts({
      street,
      building: dashedSublevelMatch[1] === '' ? '0' : dashedSublevelMatch[1],
      level: '0',
      sublevel: normalizeNumberValue(dashedSublevelMatch[2]),
      behind: dashedSublevelMatch[3] === 'B' ? 'B' : '',
      levelZeroMode: 'sublevel'
    });
  }

  const legacyDoubleDashSide = rest.match(/^(\d+)-(\d+)-([RLM])$/);
  if (legacyDoubleDashSide) {
    const level = legacyDoubleDashSide[2];
    return emptyParts({
      street,
      building: legacyDoubleDashSide[1],
      level,
      side: legacyDoubleDashSide[3],
      levelZeroMode: level === '0' ? 'side' : ''
    });
  }

  const legacyDoubleDashSublevel = rest.match(/^(\d+)-0-(\d+)(B)?$/);
  if (legacyDoubleDashSublevel) {
    return emptyParts({
      street,
      building: legacyDoubleDashSublevel[1] === '' ? '0' : legacyDoubleDashSublevel[1],
      level: '0',
      sublevel: normalizeNumberValue(legacyDoubleDashSublevel[2]),
      behind: legacyDoubleDashSublevel[3] === 'B' ? 'B' : '',
      levelZeroMode: 'sublevel'
    });
  }

  const legacySideMatch = rest.match(/^(.+)([RLM])$/);
  if (legacySideMatch) {
    const body = legacySideMatch[1];
    const side = legacySideMatch[2];
    const level = body.slice(-1);
    const building = body.slice(0, -1);
    const levelNumber = Number(level);
    if (!Number.isNaN(levelNumber) && levelNumber >= 0) {
      return emptyParts({
        street,
        building: building === '' ? '0' : building,
        level,
        side,
        levelZeroMode: levelNumber === 0 ? 'side' : ''
      });
    }
  }

  // Legacy no-dash Level 0 Sublevel: 101 / 100B → building + 0 + sublevel [+B]
  // Example: A101 → Street A, Building 1, Level 0, Sublevel 1
  const legacySublevelMatch = rest.match(/^(.+)0(\d+)(B)?$/);
  if (legacySublevelMatch) {
    return emptyParts({
      street,
      building: legacySublevelMatch[1] === '' ? '0' : legacySublevelMatch[1],
      level: '0',
      sublevel: normalizeNumberValue(legacySublevelMatch[2]),
      behind: legacySublevelMatch[3] === 'B' ? 'B' : '',
      levelZeroMode: 'sublevel'
    });
  }

  return emptyParts({ street });
}

function bayPrefixFromClassic(parts) {
  const street = String(parts.street || '').toUpperCase();
  const building = String(parts.building ?? '');
  const x = String(parts.buildingX || '').trim();
  if (!street || building === '') return '';
  if (x) return `${street}${building}X${x}`;
  return `${street}${building}`;
}

function convertClassicToNew(oldCode, settings) {
  const parts = parseClassicLocationCode(oldCode);
  const bay = bayPrefixFromClassic(parts);
  if (!bay) return { to: null, reason: 'Unable to parse classic code' };

  const level = Number(parts.level);
  if (!Number.isInteger(level) || level < 0) {
    return { to: null, reason: 'Invalid level in classic code' };
  }

  if (level === 0) {
    const behind = parts.behind === 'B' ? 'B' : '';
    if (parts.levelZeroMode === 'sublevel' || parts.sublevel !== '') {
      const sublevel = Number(parts.sublevel);
      if (!Number.isInteger(sublevel) || sublevel < 0) {
        return { to: null, reason: 'Invalid sublevel' };
      }
      const code = composeBayLevelPositionCode(
        { bay, street: parts.street, level: 0, zeroType: 'location', sublevel, behind },
        settings
      );
      return code
        ? { to: code, reason: null }
        : { to: null, reason: 'Could not compose Level 0 Location code' };
    }
    if (parts.side && SIDE_TO_POS[parts.side]) {
      const code = composeBayLevelPositionCode(
        {
          bay,
          street: parts.street,
          level: 0,
          zeroType: 'pallet',
          position: SIDE_TO_POS[parts.side]
        },
        settings
      );
      return code
        ? { to: code, reason: null }
        : { to: null, reason: 'Could not compose Level 0 Pallet code' };
    }
    return { to: null, reason: 'Level 0 classic code needs Side or Sublevel' };
  }

  if (!parts.side || !SIDE_TO_POS[parts.side]) {
    return { to: null, reason: 'Level > 0 classic code needs Side (R/L/M) to map Position' };
  }

  const code = composeBayLevelPositionCode(
    { bay, level, position: SIDE_TO_POS[parts.side] },
    settings
  );
  return code
    ? { to: code, reason: null }
    : { to: null, reason: 'Could not compose Level > 0 code' };
}

function parseNewSchemeCode(code, settings) {
  const normalized = String(code || '').trim().toUpperCase();
  const sep = String(settings.separator || '-');
  const letter = String(settings.levelZeroLocationLetter || 'L').toUpperCase();
  if (!normalized) return null;

  let working = normalized;
  let behind = '';
  if (working.endsWith('B') && working.length > 2) {
    // Trailing B may be Behind (Street A/H) — strip for parse, restore later
    const withoutB = working.slice(0, -1);
    if (/[0-9L]$/.test(withoutB) || withoutB.includes(sep)) {
      behind = 'B';
      working = withoutB;
    }
  }

  // Pallet: BAY-0-POS
  const pallet = working.match(new RegExp(`^([A-Z0-9]{1,10})${escapeReg(sep)}0${escapeReg(sep)}(\\d+)$`));
  if (pallet) {
    return { bay: pallet[1], level: 0, zeroType: 'pallet', position: Number(pallet[2]), behind };
  }

  // Location: BAY-L{sub} or BAY-L{sub}-POS
  const locWithPos = working.match(
    new RegExp(`^([A-Z0-9]{1,10})${escapeReg(sep)}${letter}(\\d+)${escapeReg(sep)}(\\d+)$`)
  );
  if (locWithPos) {
    return {
      bay: locWithPos[1],
      level: 0,
      zeroType: 'location',
      sublevel: Number(locWithPos[2]),
      position: Number(locWithPos[3]),
      behind
    };
  }
  const locOnly = working.match(
    new RegExp(`^([A-Z0-9]{1,10})${escapeReg(sep)}${letter}(\\d+)$`)
  );
  if (locOnly) {
    return {
      bay: locOnly[1],
      level: 0,
      zeroType: 'location',
      sublevel: Number(locOnly[2]),
      behind
    };
  }

  // Level > 0: BAY-LEVEL-POS
  const withPos = working.match(
    new RegExp(`^([A-Z0-9]{1,10})${escapeReg(sep)}(\\d+)${escapeReg(sep)}(\\d+)$`)
  );
  if (withPos) {
    return { bay: withPos[1], level: Number(withPos[2]), position: Number(withPos[3]), behind: '' };
  }

  return null;
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitBayToStreetBuilding(bay) {
  const s = String(bay || '').toUpperCase();
  const a21 = s.match(/^([A-Z])(\d+)X(\d+)$/);
  if (a21) {
    return { street: a21[1], building: a21[2], buildingX: a21[3] };
  }
  const m = s.match(/^([A-Z])(\d+)$/);
  if (m) return { street: m[1], building: m[2], buildingX: '' };
  return null;
}

function convertNewToClassic(oldCode, settings) {
  const parsed = parseNewSchemeCode(oldCode, settings);
  if (!parsed) return { to: null, reason: 'Unable to parse new-scheme code' };
  const sb = splitBayToStreetBuilding(parsed.bay);
  if (!sb) return { to: null, reason: 'Unable to split Street/Building from code' };

  if (parsed.level === 0 && parsed.zeroType === 'location') {
    const sub = Number(parsed.sublevel);
    if (!Number.isInteger(sub) || sub < 0) return { to: null, reason: 'Invalid sublevel' };
    const b = parsed.behind === 'B' && (sb.street === 'A' || sb.street === 'H') ? 'B' : '';
    if (sb.buildingX) {
      return { to: `${sb.street}${sb.building}X${sb.buildingX}-0${sub}${b}`, reason: null };
    }
    return { to: `${sb.street}${sb.building}-0${sub}${b}`, reason: null };
  }

  if (parsed.level === 0 && parsed.zeroType === 'pallet') {
    const side = POS_TO_SIDE[parsed.position];
    if (!side) return { to: null, reason: 'Position must be 1/2/3 to map Side R/L/M' };
    return { to: `${sb.street}${sb.building}-0${side}`, reason: null };
  }

  const side = POS_TO_SIDE[parsed.position];
  if (!side) return { to: null, reason: 'Position must be 1/2/3 to map Side R/L/M' };
  return { to: `${sb.street}${sb.building}-${parsed.level}${side}`, reason: null };
}

function convertLocationCode(oldCode, fromScheme, toScheme, settings) {
  const from = fromScheme === 'bay_level_position' ? 'bay_level_position' : 'classic';
  const to = toScheme === 'bay_level_position' ? 'bay_level_position' : 'classic';
  if (from === to) {
    return { to: oldCode, reason: null, unchanged: true };
  }
  if (from === 'classic' && to === 'bay_level_position') {
    return convertClassicToNew(oldCode, settings);
  }
  return convertNewToClassic(oldCode, settings);
}

async function buildMigrationPlan(fromScheme, toScheme, settingsInput = {}) {
  const settings = { ...DEFAULTS, ...settingsInput };
  const result = await query(
    `SELECT id, location, status, access_type, section
     FROM warehouse_locations
     ORDER BY location ASC`
  );

  const usedTargets = new Set();
  const existing = new Set(result.rows.map((r) => String(r.location).toUpperCase()));
  const items = [];
  const skipped = [];

  for (const row of result.rows) {
    const from = String(row.location || '').trim().toUpperCase();
    const converted = convertLocationCode(from, fromScheme, toScheme, settings);
    if (!converted.to) {
      skipped.push({ id: row.id, from, reason: converted.reason || 'Skipped' });
      continue;
    }
    const to = String(converted.to).trim().toUpperCase();
    if (to === from) {
      skipped.push({ id: row.id, from, to, reason: 'Already matches target scheme' });
      continue;
    }
    if (usedTargets.has(to)) {
      skipped.push({ id: row.id, from, to, reason: 'Target code already used by another migration' });
      continue;
    }
    if (existing.has(to) && to !== from) {
      // target exists as a different current location
      const conflict = result.rows.find((r) => String(r.location).toUpperCase() === to);
      if (conflict && String(conflict.id) !== String(row.id)) {
        skipped.push({ id: row.id, from, to, reason: 'Target location already exists' });
        continue;
      }
    }
    usedTargets.add(to);
    items.push({
      id: row.id,
      from,
      to,
      status: row.status,
      accessType: row.access_type,
      section: row.section
    });
  }

  return {
    fromScheme,
    toScheme,
    total: items.length,
    skippedCount: skipped.length,
    items,
    skippedPreview: skipped.slice(0, 200),
    skipped
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLogTimestamp(date = new Date()) {
  return (
    date.getFullYear()
    + '-' + pad2(date.getMonth() + 1)
    + '-' + pad2(date.getDate())
    + '_' + pad2(date.getHours())
    + pad2(date.getMinutes())
    + pad2(date.getSeconds())
  );
}

/**
 * Writes a detailed migration error log under backend/logs.
 * Returns { fileName, relativePath, absolutePath, lineCount }.
 */
async function writeMigrationErrorLog(report = {}) {
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(__dirname, '..', 'logs');
  await fs.promises.mkdir(logsDir, { recursive: true });

  const stamp = formatLogTimestamp();
  const fileName = `location-history-migrate-${stamp}.log`;
  const absolutePath = path.join(logsDir, fileName);
  const relativePath = path.join('logs', fileName).replace(/\\/g, '/');

  const lines = [];
  lines.push('================================================================================');
  lines.push('Setting Location — History migration error log');
  lines.push('================================================================================');
  lines.push(`Generated at : ${new Date().toISOString()}`);
  lines.push(`From scheme  : ${report.fromScheme || '-'}`);
  lines.push(`To scheme    : ${report.toScheme || '-'}`);
  lines.push(`User         : ${report.user || '-'}`);
  lines.push(`Summary      : ${report.summary || '-'}`);
  lines.push(`Planned      : ${report.plannedCount != null ? report.plannedCount : '-'}`);
  lines.push(`Updated      : ${report.updatedCount != null ? report.updatedCount : '-'}`);
  lines.push(`Failed apply : ${report.failedCount != null ? report.failedCount : '-'}`);
  lines.push(`Skipped      : ${report.skippedCount != null ? report.skippedCount : '-'}`);
  lines.push(`Problem rows : ${report.problemCount != null ? report.problemCount : '-'}`);
  if (report.settings && typeof report.settings === 'object') {
    lines.push('Settings     : ' + JSON.stringify(report.settings));
  }
  lines.push('--------------------------------------------------------------------------------');

  const problems = Array.isArray(report.problems) ? report.problems : [];
  if (!problems.length) {
    lines.push('No detailed problem rows were provided.');
  } else {
    lines.push(`Detailed problems (${problems.length}):`);
    lines.push('');
    problems.forEach((p, index) => {
      const n = String(index + 1).padStart(4, '0');
      const stage = p.stage || 'unknown';
      const id = p.id != null ? String(p.id) : '-';
      const from = p.from || '-';
      const to = p.to || '-';
      const reason = p.reason || p.message || 'Unknown error';
      lines.push(`[${n}] stage=${stage}`);
      lines.push(`      id=${id}`);
      lines.push(`      from=${from}`);
      lines.push(`      to=${to}`);
      lines.push(`      reason=${reason}`);
      if (p.detail) lines.push(`      detail=${p.detail}`);
      lines.push('');
    });
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push('End of log');
  lines.push('');

  const content = lines.join('\n');
  await fs.promises.writeFile(absolutePath, content, 'utf8');

  return {
    fileName,
    relativePath,
    absolutePath,
    lineCount: lines.length,
    content
  };
}

async function applyMigrationItem(item, usuarioAlterou) {
  if (!item?.id || !item?.to) {
    throw new Error('Invalid migration item');
  }
  const updated = await locationService.atualizar(item.id, {
    location: item.to,
    status: item.status,
    accessType: item.accessType,
    section: item.section,
    usuarioAlterou: usuarioAlterou || 'Setting Location migrate'
  });
  return updated;
}

module.exports = {
  buildMigrationPlan,
  applyMigrationItem,
  writeMigrationErrorLog,
  convertLocationCode,
  parseClassicLocationCode,
  SIDE_TO_POS,
  POS_TO_SIDE
};
