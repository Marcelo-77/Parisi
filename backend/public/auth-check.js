(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';

  // Header stats on all screens when System Settings enables them.
  try {
    let showHeaderStats = true;
    const raw = localStorage.getItem('doubley_system_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.showHeaderStats === false) showHeaderStats = false;
    }
    if (!showHeaderStats) {
      document.documentElement.classList.add('header-stats-hidden');
      if (document.body) document.body.classList.add('header-stats-hidden');
    }
  } catch {
    // ignore storage/parse errors
  }

  // Apply cached Total/Low/Entries/Exits early so screen changes do not wait on async scripts.
  function applyCachedHeaderStatsEarly() {
    try {
      const raw = localStorage.getItem('doubley_header_stats') || sessionStorage.getItem('doubley_header_stats');
      if (!raw) return;
      const stats = JSON.parse(raw);
      if (!stats || typeof stats !== 'object') return;
      const paint = () => {
        const totalEl = document.getElementById('totalItems');
        const lowEl = document.getElementById('lowStockItems');
        const entriesEl = document.getElementById('totalEntradas');
        const exitsEl = document.getElementById('totalSaidas');
        if (totalEl) totalEl.textContent = String(stats.total ?? 0);
        if (lowEl) lowEl.textContent = String((stats.estoqueBaixo ?? 0) + (stats.esgotado ?? 0));
        if (entriesEl) entriesEl.textContent = String(stats.entradas ?? 0);
        if (exitsEl) exitsEl.textContent = String(stats.saidas ?? 0);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', paint, { once: true });
      } else {
        paint();
      }
    } catch {
      // ignore
    }
  }
  applyCachedHeaderStatsEarly();

  if (window.location.pathname.endsWith('/login.html')) return;

  function goLogin() {
    sessionStorage.removeItem(TAB_SESSION_KEY);
    try {
      sessionStorage.removeItem('doubley_header_stats');
      localStorage.removeItem('doubley_header_stats');
    } catch {
      // ignore
    }
    window.location.replace('/login.html');
  }

  function markTabAuthenticated() {
    sessionStorage.setItem(TAB_SESSION_KEY, '1');
  }

  function checkCookieSession() {
    const hadTabSession = Boolean(sessionStorage.getItem(TAB_SESSION_KEY));
    return fetch('/api/auth/check', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data && data.authenticated) {
          markTabAuthenticated();
          return true;
        }
        // Confirmed unauthenticated response only.
        goLogin();
        return false;
      })
      .catch(() => {
        // Network/server busy (common during history migrate): do not force logout.
        if (hadTabSession) return false;
        // New tab with no local marker: retry once shortly before giving up.
        return new Promise((resolve) => {
          window.setTimeout(() => {
            fetch('/api/auth/check', { credentials: 'include' })
              .then((res) => res.json().catch(() => ({})))
              .then((data) => {
                if (data && data.authenticated) {
                  markTabAuthenticated();
                  resolve(true);
                  return;
                }
                goLogin();
                resolve(false);
              })
              .catch(() => {
                // Still unreachable: keep page if server already authorized the HTML.
                resolve(false);
              });
          }, 1200);
        });
      });
  }

  // New tabs (target=_blank) do not share sessionStorage. Recover from cookie
  // instead of logging the user out of every open tab.
  checkCookieSession();
})();
