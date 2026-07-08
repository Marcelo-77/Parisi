const REFRESH_INTERVAL_MS = 8000;

let refreshTimer = null;

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatDuration(loginAt) {
  if (!loginAt) return '—';
  const start = new Date(loginAt).getTime();
  if (Number.isNaN(start)) return '—';

  const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function summarizeUserAgent(userAgent) {
  if (!userAgent) return 'Unknown browser';
  const value = String(userAgent);
  if (value.length <= 72) return value;
  return `${value.slice(0, 69)}...`;
}

function setMessage(text, type) {
  const el = document.getElementById('loggedInUsersMessage');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'logged-in-users-message';
  if (type) el.classList.add(type);
}

function renderSessions(payload) {
  const tbody = document.getElementById('loggedInUsersBody');
  const summaryActiveCount = document.getElementById('summaryActiveCount');
  const summaryStaleMinutes = document.getElementById('summaryStaleMinutes');
  const summaryLastUpdate = document.getElementById('summaryLastUpdate');

  if (!tbody) return;

  const sessions = (payload && payload.data) ? payload.data : [];
  if (summaryActiveCount) summaryActiveCount.textContent = String(payload.count || sessions.length);
  if (summaryStaleMinutes && payload.staleMinutes != null) {
    summaryStaleMinutes.textContent = `${payload.staleMinutes} min`;
  }
  if (summaryLastUpdate) summaryLastUpdate.textContent = new Date().toLocaleTimeString();

  if (!sessions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="logged-in-users-empty">
            <i class="fas fa-user-slash"></i>
            <p>No active users right now.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sessions.map((session) => {
    const userName = session.userName || session.userEmail || session.userKey || 'Unknown user';
    const userEmail = session.userEmail && session.userEmail !== userName ? session.userEmail : '';
    const appLabel = session.currentAppLabel || session.currentApp || '—';
    const appFile = session.currentApp && session.currentApp !== appLabel ? session.currentApp : '';

    return `
      <tr>
        <td class="user-cell">
          <strong>${escapeHtml(userName)}</strong>
          ${userEmail ? `<small>${escapeHtml(userEmail)}</small>` : ''}
        </td>
        <td class="location-cell">${escapeHtml(session.ipAddress || '—')}</td>
        <td class="duration-cell">${escapeHtml(formatDuration(session.loginAt))}</td>
        <td class="app-cell">
          <strong>${escapeHtml(appLabel)}</strong>
          ${appFile ? `<small>${escapeHtml(appFile)}</small>` : ''}
        </td>
        <td class="seen-cell">${escapeHtml(formatDateTime(session.lastSeenAt))}</td>
      </tr>
    `;
  }).join('');
}

async function loadSessions() {
  const liveStatusText = document.getElementById('liveStatusText');
  if (liveStatusText) liveStatusText.textContent = 'Updating...';

  try {
    const res = await fetch('/api/logged-in-users', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Unable to load active sessions');
    }
    renderSessions(data);
    setMessage(`Showing users active within the last ${data.staleMinutes} minutes.`);
    if (liveStatusText) liveStatusText.textContent = 'Live';
  } catch (error) {
    console.error(error);
    setMessage(error.message || 'Error loading active sessions.', 'error');
    if (liveStatusText) liveStatusText.textContent = 'Error';
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadSessions, REFRESH_INTERVAL_MS);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshSessionsBtn')?.addEventListener('click', loadSessions);
  loadSessions();
  startAutoRefresh();
});

window.addEventListener('beforeunload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
});
