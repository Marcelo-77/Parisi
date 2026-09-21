const { query } = require('../config/database');
const forkliftDriverService = require('./forkliftDriverService');
const messageRequestService = require('./messageRequestService');

const CHECK_INTERVAL_MS = 60 * 1000;
let timer = null;
let running = false;

async function ensureActiveColumn() {
  await query(`
    ALTER TABLE message_requests
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_message_requests_is_active
    ON message_requests (is_active)
  `).catch(() => {});
}

async function processDailyInactiveCutoff() {
  if (running) return { skipped: true, reason: 'busy' };
  running = true;
  try {
    await forkliftDriverService.ensureTable();
    await ensureActiveColumn();
    await messageRequestService.ensureTable();

    const settings = await forkliftDriverService.getSettings();
    if (!settings.dailyInactiveEnabled) {
      return { processed: 0, disabled: true };
    }

    const cutoff = settings.dailyInactiveTime || '15:52';
    const timezone = forkliftDriverService.getAppTimezone();

    const clock = await query(
      `
      SELECT
        to_char((CURRENT_TIMESTAMP AT TIME ZONE $1), 'HH24:MI') AS current_hm,
        to_char((CURRENT_TIMESTAMP AT TIME ZONE $1), 'YYYY-MM-DD') AS current_day
    `,
      [timezone]
    );
    const currentHm = clock.rows[0]?.current_hm || '';
    const currentDay = clock.rows[0]?.current_day || '';
    if (!currentHm || currentHm < cutoff) {
      return { processed: 0, beforeCutoff: true, currentHm, cutoff };
    }

    const historyStamp = `${currentDay} ${currentHm}`;
    const historyLine = `[${historyStamp}] Marked Inactive by daily cutoff (${cutoff})`;

    const result = await query(
      `
      UPDATE message_requests
      SET is_active = false,
          atualizado_em = CURRENT_TIMESTAMP,
          request_history = CASE
            WHEN COALESCE(TRIM(request_history), '') = '' THEN $3
            ELSE request_history || E'\\n' || $3
          END
      WHERE is_active = true
        AND (criado_em AT TIME ZONE $1)::date = $2::date
      RETURNING id
    `,
      [timezone, currentDay, historyLine]
    );

    return {
      processed: (result.rows || []).length,
      cutoff,
      currentHm,
      currentDay,
      timezone
    };
  } finally {
    running = false;
  }
}

function startDailyInactiveMonitor() {
  if (timer) return;
  const tick = () => {
    processDailyInactiveCutoff().catch((err) => {
      console.error('Daily inactive cutoff monitor error:', err.message || err);
    });
  };
  tick();
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('⏱️  Message-request daily inactive cutoff monitor started');
}

function stopDailyInactiveMonitor() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  processDailyInactiveCutoff,
  startDailyInactiveMonitor,
  stopDailyInactiveMonitor,
  ensureActiveColumn
};
