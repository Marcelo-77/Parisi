/**
 * In-memory remote status for Setting Location history migration.
 * Survives for the life of the Node process (one active job).
 */

const STALE_MS = 90 * 1000;

let job = null;

function nowIso() {
  return new Date().toISOString();
}

function emptyJob() {
  return {
    id: null,
    status: 'idle',
    fromScheme: null,
    toScheme: null,
    plannedTotal: 0,
    done: 0,
    failed: 0,
    skippedCount: 0,
    percent: 0,
    startedAt: null,
    updatedAt: null,
    finishedAt: null,
    startedBy: null,
    currentFrom: null,
    currentTo: null,
    lastError: null,
    summary: null,
    stale: false
  };
}

function computePercent(state) {
  const total = Number(state.plannedTotal || 0);
  if (total <= 0) {
    return state.status === 'completed' || state.status === 'failed' ? 100 : 0;
  }
  const processed = Number(state.done || 0) + Number(state.failed || 0);
  return Math.min(100, Math.round((processed / total) * 100));
}

function withDerived(state) {
  const snapshot = { ...(state || emptyJob()) };
  snapshot.percent = computePercent(snapshot);
  if (snapshot.status === 'running' || snapshot.status === 'planning') {
    const updatedMs = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
    snapshot.stale = !updatedMs || (Date.now() - updatedMs) > STALE_MS;
  } else {
    snapshot.stale = false;
  }
  return snapshot;
}

function getStatus() {
  if (!job) return withDerived(emptyJob());
  return withDerived(job);
}

function startPlanning({ fromScheme, toScheme, startedBy }) {
  job = {
    ...emptyJob(),
    id: `mig-${Date.now()}`,
    status: 'planning',
    fromScheme: fromScheme || null,
    toScheme: toScheme || null,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    startedBy: startedBy || null,
    summary: 'Building migration plan…'
  };
  return getStatus();
}

function startRunning(plan = {}, startedBy) {
  const plannedTotal = Number(plan.total != null ? plan.total : (plan.items || []).length) || 0;
  const skippedCount = Number(plan.skippedCount || 0) || 0;
  job = {
    ...(job && job.status === 'planning' ? job : emptyJob()),
    id: (job && job.id) || `mig-${Date.now()}`,
    status: plannedTotal > 0 ? 'running' : 'completed',
    fromScheme: plan.fromScheme || job?.fromScheme || null,
    toScheme: plan.toScheme || job?.toScheme || null,
    plannedTotal,
    done: 0,
    failed: 0,
    skippedCount,
    startedAt: job?.startedAt || nowIso(),
    updatedAt: nowIso(),
    finishedAt: plannedTotal > 0 ? null : nowIso(),
    startedBy: startedBy || job?.startedBy || null,
    currentFrom: null,
    currentTo: null,
    lastError: null,
    summary: plannedTotal > 0
      ? `Updating ${plannedTotal} location(s)…`
      : (skippedCount
        ? `No renames needed. Skipped: ${skippedCount}.`
        : 'No renames needed.')
  };
  return getStatus();
}

function markApplyStart(item = {}) {
  if (!job || (job.status !== 'running' && job.status !== 'planning')) {
    job = {
      ...emptyJob(),
      id: `mig-${Date.now()}`,
      status: 'running',
      plannedTotal: Math.max(1, Number(job?.plannedTotal || 0)),
      startedAt: nowIso(),
      startedBy: job?.startedBy || null
    };
  }
  job.status = 'running';
  job.updatedAt = nowIso();
  job.currentFrom = item.from || null;
  job.currentTo = item.to || null;
  job.lastError = null;
  job.summary = item.from && item.to
    ? `Updating ${item.from} → ${item.to}`
    : 'Updating locations…';
  return getStatus();
}

function markApplySuccess(item = {}) {
  if (!job) markApplyStart(item);
  job.done = Number(job.done || 0) + 1;
  job.updatedAt = nowIso();
  job.currentFrom = item.from || job.currentFrom;
  job.currentTo = item.to || job.currentTo;
  job.lastError = null;
  const processed = job.done + job.failed;
  job.summary = `Updated ${job.done} of ${job.plannedTotal || processed}`
    + (job.failed ? ` (failed: ${job.failed})` : '');
  if (job.plannedTotal > 0 && processed >= job.plannedTotal) {
    job.status = job.failed > 0 ? 'completed_with_errors' : 'completed';
    job.finishedAt = nowIso();
    job.summary = `Finished. Updated ${job.done} of ${job.plannedTotal}. Failed: ${job.failed}. Skipped: ${job.skippedCount}.`;
  }
  return getStatus();
}

function markApplyFailure(item = {}, errorMessage) {
  if (!job) markApplyStart(item);
  job.failed = Number(job.failed || 0) + 1;
  job.updatedAt = nowIso();
  job.currentFrom = item.from || job.currentFrom;
  job.currentTo = item.to || job.currentTo;
  job.lastError = errorMessage || 'Update failed';
  const processed = job.done + job.failed;
  job.summary = `Updated ${job.done} of ${job.plannedTotal || processed} (failed: ${job.failed})`;
  if (job.plannedTotal > 0 && processed >= job.plannedTotal) {
    job.status = 'completed_with_errors';
    job.finishedAt = nowIso();
    job.summary = `Finished with errors. Updated ${job.done} of ${job.plannedTotal}. Failed: ${job.failed}. Skipped: ${job.skippedCount}.`;
  }
  return getStatus();
}

function finish(payload = {}) {
  if (!job) {
    job = {
      ...emptyJob(),
      id: `mig-${Date.now()}`,
      status: 'completed',
      startedAt: nowIso()
    };
  }
  if (payload.status) job.status = String(payload.status);
  else if (job.failed > 0) job.status = 'completed_with_errors';
  else job.status = 'completed';

  if (payload.done != null) job.done = Number(payload.done) || 0;
  if (payload.failed != null) job.failed = Number(payload.failed) || 0;
  if (payload.skippedCount != null) job.skippedCount = Number(payload.skippedCount) || 0;
  if (payload.plannedTotal != null) job.plannedTotal = Number(payload.plannedTotal) || 0;
  if (payload.summary) job.summary = String(payload.summary);
  if (payload.lastError) job.lastError = String(payload.lastError);

  job.updatedAt = nowIso();
  job.finishedAt = nowIso();
  job.currentFrom = null;
  job.currentTo = null;
  return getStatus();
}

function fail(message) {
  if (!job) {
    job = { ...emptyJob(), id: `mig-${Date.now()}`, startedAt: nowIso() };
  }
  job.status = 'failed';
  job.lastError = message || 'Migration failed';
  job.summary = job.lastError;
  job.updatedAt = nowIso();
  job.finishedAt = nowIso();
  return getStatus();
}

function heartbeat() {
  if (!job) return getStatus();
  if (job.status === 'running' || job.status === 'planning') {
    job.updatedAt = nowIso();
  }
  return getStatus();
}

module.exports = {
  getStatus,
  startPlanning,
  startRunning,
  markApplyStart,
  markApplySuccess,
  markApplyFailure,
  finish,
  fail,
  heartbeat,
  STALE_MS
};
