(function () {
  const API = '/api/location-code-settings/migrate-status';
  const badge = document.getElementById('migrateStatusBadge');
  const meta = document.getElementById('migrateStatusMeta');
  const bar = document.getElementById('migrateStatusBarFill');
  const staleEl = document.getElementById('migrateStatusStale');
  const refreshBtn = document.getElementById('migrateStatusRefreshBtn');

  function statusLabel(status) {
    const map = {
      idle: 'Idle',
      planning: 'Planning…',
      running: 'Processing…',
      completed: 'Completed',
      completed_with_errors: 'Completed with errors',
      failed: 'Failed'
    };
    return map[status] || status || 'Unknown';
  }

  function statusIcon(status) {
    if (status === 'running' || status === 'planning') return 'fas fa-sync-alt fa-spin';
    if (status === 'completed') return 'fas fa-check-circle';
    if (status === 'completed_with_errors' || status === 'failed') return 'fas fa-exclamation-triangle';
    return 'fas fa-clock';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(data) {
    const status = String(data.status || 'idle');
    if (badge) {
      badge.className = `migrate-status-badge is-${status}`;
      badge.innerHTML = `<i class="${statusIcon(status)}"></i> ${statusLabel(status)}`;
    }
    if (bar) bar.style.width = `${Number(data.percent || 0)}%`;
    if (staleEl) staleEl.hidden = !data.stale;

    const processed = Number(data.done || 0) + Number(data.failed || 0);
    const lines = [
      `<p><strong>Progress:</strong> ${escapeHtml(data.percent || 0)}% (${processed} of ${escapeHtml(data.plannedTotal || 0)})</p>`,
      `<p><strong>Updated:</strong> ${escapeHtml(data.done || 0)} &nbsp;|&nbsp; <strong>Failed:</strong> ${escapeHtml(data.failed || 0)} &nbsp;|&nbsp; <strong>Skipped:</strong> ${escapeHtml(data.skippedCount || 0)}</p>`,
      `<p><strong>Scheme:</strong> ${escapeHtml(data.fromScheme || '-')} → ${escapeHtml(data.toScheme || '-')}</p>`,
      `<p><strong>Current:</strong> ${escapeHtml(data.currentFrom || '-')}${data.currentTo ? ` → ${escapeHtml(data.currentTo)}` : ''}</p>`,
      `<p><strong>Started by:</strong> ${escapeHtml(data.startedBy || '-')}</p>`,
      `<p><strong>Started:</strong> ${escapeHtml(data.startedAt || '-')}</p>`,
      `<p><strong>Updated:</strong> ${escapeHtml(data.updatedAt || '-')}</p>`,
      `<p><strong>Finished:</strong> ${escapeHtml(data.finishedAt || '-')}</p>`,
      `<p><strong>Summary:</strong> ${escapeHtml(data.summary || '-')}</p>`
    ];
    if (data.lastError) {
      lines.push(`<p><strong>Last error:</strong> ${escapeHtml(data.lastError)}</p>`);
    }
    if (meta) meta.innerHTML = lines.join('');
  }

  async function loadStatus() {
    try {
      const res = await fetch(API, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to load migrate status');
      }
      render(data.data || {});
    } catch (error) {
      if (meta) {
        meta.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(error.message || 'Unable to load migrate status')}</p>`;
      }
    }
  }

  refreshBtn?.addEventListener('click', loadStatus);
  loadStatus();
  setInterval(loadStatus, 3000);
})();
