const { query } = require('../config/database');

const TABLE = 'forklift_drivers';
const SETTINGS_TABLE = 'forklift_driver_settings';
const DEFAULT_MESSAGE_TYPE = 'SMS';
const DEFAULT_ALLOW_REASSIGN = false;
const DEFAULT_WAITING_TIMEOUT_ENABLED = false;
const DEFAULT_WAITING_TIMEOUT_MINUTES = 15;
const DEFAULT_DAILY_INACTIVE_ENABLED = false;
const DEFAULT_DAILY_INACTIVE_TIME = '15:52';
const DEFAULT_NOTIFY_REQUESTER_ON_COMPLETE = false;
const PARISI_COMPANY_FILTER = `EXISTS (
  SELECT 1
  FROM company c
  WHERE c.id = f.company_id
    AND c.name ILIKE '%Parisi%'
)`;

async function assertParisiActiveUsers(userIds, errorMessage) {
  const ids = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return [];

  const check = await query(
    `
    SELECT f.id
    FROM funcionarios f
    WHERE f.id = ANY($1::uuid[])
      AND f.ativo = true
      AND ${PARISI_COMPANY_FILTER}
  `,
    [ids]
  );
  if (check.rows.length !== ids.length) {
    throw new Error(errorMessage || 'One or more selected users are not active Parisi users');
  }
  return ids;
}

function normalizeMessageType(value) {
  const type = String(value || '').trim().toUpperCase();
  return type === 'EMAIL' ? 'EMAIL' : 'SMS';
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return fallback;
}

function normalizeMinutes(value, fallback = DEFAULT_WAITING_TIMEOUT_MINUTES) {
  const n = parseInt(String(value == null ? '' : value).trim(), 10);
  if (!Number.isInteger(n) || n < 1 || n > 24 * 60) return fallback;
  return n;
}

function normalizeTimeOfDay(value, fallback = DEFAULT_DAILY_INACTIVE_TIME) {
  const raw = String(value == null ? '' : value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) return fallback;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function getAppTimezone() {
  const tz = String(process.env.APP_TIMEZONE || 'Australia/Sydney').trim();
  return tz || 'Australia/Sydney';
}

function normalizeUserIdList(value) {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (_) {
      list = String(list)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(list)) return [];
  return Array.from(
    new Set(
      list
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      funcionario_id UUID PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      assigned_by UUID,
      assigned_by_name VARCHAR(100)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_forklift_drivers_assigned_at
    ON ${TABLE} (assigned_at DESC)
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      preferred_message_type VARCHAR(10) NOT NULL DEFAULT 'SMS',
      allow_reassign_to_other_driver BOOLEAN NOT NULL DEFAULT false,
      waiting_timeout_enabled BOOLEAN NOT NULL DEFAULT false,
      waiting_timeout_minutes INTEGER NOT NULL DEFAULT 15,
      waiting_timeout_notify_user_ids TEXT NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT forklift_driver_settings_type_chk
        CHECK (preferred_message_type IN ('SMS', 'EMAIL'))
    )
  `);
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS allow_reassign_to_other_driver BOOLEAN NOT NULL DEFAULT false
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS waiting_timeout_enabled BOOLEAN NOT NULL DEFAULT false
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS waiting_timeout_minutes INTEGER NOT NULL DEFAULT 15
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS waiting_timeout_notify_user_ids TEXT NOT NULL DEFAULT '[]'
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS daily_inactive_enabled BOOLEAN NOT NULL DEFAULT false
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS daily_inactive_time VARCHAR(5) NOT NULL DEFAULT '15:52'
  `).catch(() => {});
  await query(`
    ALTER TABLE ${SETTINGS_TABLE}
    ADD COLUMN IF NOT EXISTS notify_requester_on_complete BOOLEAN NOT NULL DEFAULT false
  `).catch(() => {});
  await query(
    `
    INSERT INTO ${SETTINGS_TABLE} (
      id, preferred_message_type, allow_reassign_to_other_driver,
      waiting_timeout_enabled, waiting_timeout_minutes, waiting_timeout_notify_user_ids,
      daily_inactive_enabled, daily_inactive_time, notify_requester_on_complete
    )
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING
  `,
    [
      DEFAULT_MESSAGE_TYPE,
      DEFAULT_ALLOW_REASSIGN,
      DEFAULT_WAITING_TIMEOUT_ENABLED,
      DEFAULT_WAITING_TIMEOUT_MINUTES,
      '[]',
      DEFAULT_DAILY_INACTIVE_ENABLED,
      DEFAULT_DAILY_INACTIVE_TIME,
      DEFAULT_NOTIFY_REQUESTER_ON_COMPLETE
    ]
  );
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    cargo: row.cargo || null,
    ativo: row.ativo !== false
  };
}

async function getSettings() {
  await ensureTable();
  const result = await query(
    `SELECT preferred_message_type, allow_reassign_to_other_driver,
            waiting_timeout_enabled, waiting_timeout_minutes, waiting_timeout_notify_user_ids,
            daily_inactive_enabled, daily_inactive_time, notify_requester_on_complete
     FROM ${SETTINGS_TABLE}
     WHERE id = 1`
  );
  const row = result.rows[0] || {};
  return {
    preferredMessageType: normalizeMessageType(row.preferred_message_type || DEFAULT_MESSAGE_TYPE),
    allowReassignToOtherDriver: normalizeBoolean(
      row.allow_reassign_to_other_driver,
      DEFAULT_ALLOW_REASSIGN
    ),
    waitingTimeoutEnabled: normalizeBoolean(
      row.waiting_timeout_enabled,
      DEFAULT_WAITING_TIMEOUT_ENABLED
    ),
    waitingTimeoutMinutes: normalizeMinutes(
      row.waiting_timeout_minutes,
      DEFAULT_WAITING_TIMEOUT_MINUTES
    ),
    waitingTimeoutNotifyUserIds: normalizeUserIdList(row.waiting_timeout_notify_user_ids),
    dailyInactiveEnabled: normalizeBoolean(
      row.daily_inactive_enabled,
      DEFAULT_DAILY_INACTIVE_ENABLED
    ),
    dailyInactiveTime: normalizeTimeOfDay(
      row.daily_inactive_time,
      DEFAULT_DAILY_INACTIVE_TIME
    ),
    notifyRequesterOnComplete: normalizeBoolean(
      row.notify_requester_on_complete,
      DEFAULT_NOTIFY_REQUESTER_ON_COMPLETE
    )
  };
}

async function getPreferredMessageType() {
  const settings = await getSettings();
  return settings.preferredMessageType;
}

async function setSettings({
  preferredMessageType,
  allowReassignToOtherDriver,
  waitingTimeoutEnabled,
  waitingTimeoutMinutes,
  waitingTimeoutNotifyUserIds,
  dailyInactiveEnabled,
  dailyInactiveTime,
  notifyRequesterOnComplete
} = {}) {
  await ensureTable();
  const current = await getSettings();
  const nextType = preferredMessageType != null && String(preferredMessageType).trim() !== ''
    ? normalizeMessageType(preferredMessageType)
    : current.preferredMessageType;
  const nextAllow = allowReassignToOtherDriver !== undefined
    ? normalizeBoolean(allowReassignToOtherDriver, current.allowReassignToOtherDriver)
    : current.allowReassignToOtherDriver;
  const nextTimeoutEnabled = waitingTimeoutEnabled !== undefined
    ? normalizeBoolean(waitingTimeoutEnabled, current.waitingTimeoutEnabled)
    : current.waitingTimeoutEnabled;
  const nextTimeoutMinutes = waitingTimeoutMinutes !== undefined
    ? normalizeMinutes(waitingTimeoutMinutes, current.waitingTimeoutMinutes)
    : current.waitingTimeoutMinutes;
  const nextNotifyIds = waitingTimeoutNotifyUserIds !== undefined
    ? normalizeUserIdList(waitingTimeoutNotifyUserIds)
    : current.waitingTimeoutNotifyUserIds;
  const nextDailyInactiveEnabled = dailyInactiveEnabled !== undefined
    ? normalizeBoolean(dailyInactiveEnabled, current.dailyInactiveEnabled)
    : current.dailyInactiveEnabled;
  const nextDailyInactiveTime = dailyInactiveTime !== undefined
    ? normalizeTimeOfDay(dailyInactiveTime, current.dailyInactiveTime)
    : current.dailyInactiveTime;
  const nextNotifyOnComplete = notifyRequesterOnComplete !== undefined
    ? normalizeBoolean(notifyRequesterOnComplete, current.notifyRequesterOnComplete)
    : current.notifyRequesterOnComplete;

  if (nextTimeoutEnabled && nextNotifyIds.length === 0) {
    throw new Error('Select at least one user to receive the Waiting for driver timeout message');
  }

  if (nextNotifyIds.length) {
    await assertParisiActiveUsers(
      nextNotifyIds,
      'One or more timeout notify users were not found, are inactive, or are not Parisi users'
    );
  }

  await query(
    `
    INSERT INTO ${SETTINGS_TABLE} (
      id, preferred_message_type, allow_reassign_to_other_driver,
      waiting_timeout_enabled, waiting_timeout_minutes, waiting_timeout_notify_user_ids,
      daily_inactive_enabled, daily_inactive_time, notify_requester_on_complete,
      updated_at
    )
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    ON CONFLICT (id)
    DO UPDATE SET
      preferred_message_type = EXCLUDED.preferred_message_type,
      allow_reassign_to_other_driver = EXCLUDED.allow_reassign_to_other_driver,
      waiting_timeout_enabled = EXCLUDED.waiting_timeout_enabled,
      waiting_timeout_minutes = EXCLUDED.waiting_timeout_minutes,
      waiting_timeout_notify_user_ids = EXCLUDED.waiting_timeout_notify_user_ids,
      daily_inactive_enabled = EXCLUDED.daily_inactive_enabled,
      daily_inactive_time = EXCLUDED.daily_inactive_time,
      notify_requester_on_complete = EXCLUDED.notify_requester_on_complete,
      updated_at = CURRENT_TIMESTAMP
  `,
    [
      nextType,
      nextAllow,
      nextTimeoutEnabled,
      nextTimeoutMinutes,
      JSON.stringify(nextNotifyIds),
      nextDailyInactiveEnabled,
      nextDailyInactiveTime,
      nextNotifyOnComplete
    ]
  );
  return getSettings();
}

async function setPreferredMessageType(messageType) {
  const settings = await setSettings({ preferredMessageType: messageType });
  return settings.preferredMessageType;
}

function withSettingsFields(settings) {
  return {
    preferredMessageType: settings.preferredMessageType,
    allowReassignToOtherDriver: settings.allowReassignToOtherDriver,
    waitingTimeoutEnabled: settings.waitingTimeoutEnabled,
    waitingTimeoutMinutes: settings.waitingTimeoutMinutes,
    waitingTimeoutNotifyUserIds: settings.waitingTimeoutNotifyUserIds,
    dailyInactiveEnabled: settings.dailyInactiveEnabled,
    dailyInactiveTime: settings.dailyInactiveTime,
    notifyRequesterOnComplete: settings.notifyRequesterOnComplete
  };
}

async function listAssignments() {
  await ensureTable();

  const assignedResult = await query(`
    SELECT f.id, f.nome, f.email, f.telefone, f.cargo, f.ativo
    FROM ${TABLE} fd
    INNER JOIN funcionarios f ON f.id = fd.funcionario_id
    WHERE f.ativo = true
      AND ${PARISI_COMPANY_FILTER}
    ORDER BY LOWER(TRIM(f.nome)) ASC, LOWER(TRIM(f.email)) ASC
  `);

  const availableResult = await query(`
    SELECT f.id, f.nome, f.email, f.telefone, f.cargo, f.ativo
    FROM funcionarios f
    WHERE f.ativo = true
      AND ${PARISI_COMPANY_FILTER}
      AND NOT EXISTS (
        SELECT 1 FROM ${TABLE} fd WHERE fd.funcionario_id = f.id
      )
    ORDER BY LOWER(TRIM(f.nome)) ASC, LOWER(TRIM(f.email)) ASC
  `);

  const settings = await getSettings();

  return {
    available: availableResult.rows.map(mapUser),
    assigned: assignedResult.rows.map(mapUser),
    ...withSettingsFields(settings)
  };
}

async function listAssignedUsers() {
  await ensureTable();
  const result = await query(`
    SELECT f.id, f.nome, f.email, f.telefone, f.cargo, f.ativo
    FROM ${TABLE} fd
    INNER JOIN funcionarios f ON f.id = fd.funcionario_id
    WHERE f.ativo = true
      AND ${PARISI_COMPANY_FILTER}
    ORDER BY LOWER(TRIM(f.nome)) ASC, LOWER(TRIM(f.email)) ASC
  `);
  const settings = await getSettings();
  return {
    users: result.rows.map(mapUser),
    ...withSettingsFields(settings)
  };
}

async function saveAssignments(assignedIds, actor = {}, options = {}) {
  await ensureTable();
  const ids = await assertParisiActiveUsers(
    assignedIds,
    'One or more selected users were not found, are inactive, or are not Parisi users'
  );

  await query(`DELETE FROM ${TABLE}`);

  if (ids.length) {
    await query(
      `
      INSERT INTO ${TABLE} (funcionario_id, assigned_by, assigned_by_name)
      SELECT unnest($1::uuid[]), $2::uuid, $3::varchar
    `,
      [ids, actor.assignedBy || null, actor.assignedByName || null]
    );
  }

  const hasSettingsUpdate = [
    'preferredMessageType',
    'allowReassignToOtherDriver',
    'waitingTimeoutEnabled',
    'waitingTimeoutMinutes',
    'waitingTimeoutNotifyUserIds',
    'dailyInactiveEnabled',
    'dailyInactiveTime',
    'notifyRequesterOnComplete'
  ].some((key) => options[key] !== undefined);

  if (hasSettingsUpdate) {
    await setSettings({
      preferredMessageType: options.preferredMessageType,
      allowReassignToOtherDriver: options.allowReassignToOtherDriver,
      waitingTimeoutEnabled: options.waitingTimeoutEnabled,
      waitingTimeoutMinutes: options.waitingTimeoutMinutes,
      waitingTimeoutNotifyUserIds: options.waitingTimeoutNotifyUserIds,
      dailyInactiveEnabled: options.dailyInactiveEnabled,
      dailyInactiveTime: options.dailyInactiveTime,
      notifyRequesterOnComplete: options.notifyRequesterOnComplete
    });
  }

  return listAssignments();
}

async function isAssignedDriver(funcionarioId) {
  const id = funcionarioId != null ? String(funcionarioId).trim() : '';
  if (!id) return false;
  await ensureTable();
  const result = await query(
    `SELECT 1 FROM ${TABLE} WHERE funcionario_id = $1 LIMIT 1`,
    [id]
  );
  return result.rows.length > 0;
}

module.exports = {
  ensureTable,
  getSettings,
  setSettings,
  getPreferredMessageType,
  setPreferredMessageType,
  listAssignments,
  listAssignedUsers,
  saveAssignments,
  normalizeMessageType,
  normalizeTimeOfDay,
  getAppTimezone,
  isAssignedDriver
};
