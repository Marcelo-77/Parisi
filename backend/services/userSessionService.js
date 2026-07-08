const { query } = require('../config/database');

const TABLE = 'user_sessions';
const STALE_MINUTES = Number(process.env.SESSION_STALE_MINUTES) || 5;

function mapRow(row) {
  return {
    id: row.id,
    userKey: row.user_key,
    userName: row.user_name,
    userEmail: row.user_email,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    loginAt: row.login_at,
    lastSeenAt: row.last_seen_at,
    logoutAt: row.logout_at,
    currentApp: row.current_app,
    currentAppLabel: row.current_app_label || row.current_app,
    isActive: row.is_active
  };
}

async function createSession({
  id,
  userKey,
  userName,
  userEmail,
  ipAddress,
  userAgent,
  currentApp
}) {
  await query(
    `INSERT INTO ${TABLE} (
      id, user_key, user_name, user_email, ip_address, user_agent, current_app, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
    [
      id,
      userKey,
      userName || null,
      userEmail || null,
      ipAddress || null,
      userAgent || null,
      currentApp || null
    ]
  );
}

async function touchSession(sessionId, { currentApp, ipAddress, userAgent } = {}) {
  if (!sessionId) return;

  const sets = ['last_seen_at = NOW()', 'is_active = TRUE'];
  const values = [sessionId];
  let idx = 2;

  if (currentApp) {
    sets.push(`current_app = $${idx++}`);
    values.push(currentApp);
  }
  if (ipAddress) {
    sets.push(`ip_address = $${idx++}`);
    values.push(ipAddress);
  }
  if (userAgent) {
    sets.push(`user_agent = $${idx++}`);
    values.push(userAgent);
  }

  await query(
    `UPDATE ${TABLE}
     SET ${sets.join(', ')}
     WHERE id = $1 AND logout_at IS NULL`,
    values
  );
}

async function endSession(sessionId) {
  if (!sessionId) return;
  await query(
    `UPDATE ${TABLE}
     SET logout_at = NOW(), is_active = FALSE, last_seen_at = NOW()
     WHERE id = $1 AND logout_at IS NULL`,
    [sessionId]
  );
}

async function expireStaleSessions() {
  await query(
    `UPDATE ${TABLE}
     SET is_active = FALSE
     WHERE is_active = TRUE
       AND logout_at IS NULL
       AND last_seen_at < NOW() - ($1::text || ' minutes')::interval`,
    [String(STALE_MINUTES)]
  );
}

async function listActiveSessions() {
  await expireStaleSessions();

  const result = await query(
    `SELECT
       us.id,
       us.user_key,
       us.user_name,
       us.user_email,
       us.ip_address,
       us.user_agent,
       us.login_at,
       us.last_seen_at,
       us.logout_at,
       us.current_app,
       us.is_active,
       COALESCE(sa.syap_ds_detailed, us.current_app) AS current_app_label
     FROM ${TABLE} us
     LEFT JOIN system_applications sa ON sa.syap_nm_application = us.current_app
     WHERE us.is_active = TRUE
       AND us.logout_at IS NULL
       AND us.last_seen_at >= NOW() - ($1::text || ' minutes')::interval
     ORDER BY us.login_at DESC`,
    [String(STALE_MINUTES)]
  );

  return (result.rows || []).map(mapRow);
}

module.exports = {
  STALE_MINUTES,
  createSession,
  touchSession,
  endSession,
  expireStaleSessions,
  listActiveSessions
};
