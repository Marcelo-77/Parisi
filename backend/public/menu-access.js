(function () {
  const MENU_ACCESS_KEY = 'doubley_menu_access';
  const TAB_SESSION_KEY = 'doubley_tab_auth';
  const MENU_HEARTBEAT_MS = 30000;
  let heartbeatTimer = null;
  let inactivityTimer = null;

  function appFromHref(href) {
    if (!href) return null;
    const clean = String(href).trim().split('?')[0].split('#')[0];
    if (!clean || clean.startsWith('http')) return null;
    return clean.includes('.html') ? clean : null;
  }

  function normalizeAppName(name) {
    return name ? String(name).trim().toLowerCase() : '';
  }

  function getCurrentPageApp() {
    const path = window.location.pathname || '';
    const fileName = path.split('/').pop() || '';
    return fileName.endsWith('.html') ? fileName : null;
  }

  function cacheMenuAccess(data) {
    try {
      sessionStorage.setItem(MENU_ACCESS_KEY, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  }

  function readCachedMenuAccess() {
    try {
      const raw = sessionStorage.getItem(MENU_ACCESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function fetchMenuAccess() {
    const res = await fetch('/api/auth/menu-access');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Unable to load menu access');
    }
    cacheMenuAccess(data);
    return data;
  }

  function getItemApplication(element) {
    const explicit = element.getAttribute('data-app');
    if (explicit) return explicit;
    if (element.tagName === 'A') return appFromHref(element.getAttribute('href'));
    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function hasValidPhoto(photo) {
    const value = String(photo || '').trim();
    return value.length > 0 && value !== 'null' && value !== 'undefined';
  }

  function buildLoggedUserNameHtml(user) {
    const name = user.nome || user.email || 'User';
    const safeName = escapeHtml(name);

    if (!hasValidPhoto(user.photo)) {
      return safeName;
    }

    const safePhoto = escapeAttr(user.photo);
    return [
      `<span class="logged-session-name has-photo">`,
      safeName,
      `<span class="logged-session-photo-preview" aria-hidden="true">`,
      `<img src="${safePhoto}" alt="${safeName}">`,
      `</span>`,
      `</span>`
    ].join('');
  }

  function renderLoggedUserInfo(user) {
    if (!user) return;

    const headerContent = document.querySelector('.header-content');
    if (!headerContent) return;

    let el = document.getElementById('loggedSessionInfo');
    if (!el) {
      el = document.createElement('p');
      el.id = 'loggedSessionInfo';
      el.className = 'logged-session-info';

      const headerActions = headerContent.querySelector('.header-actions');
      const subtitle = headerContent.querySelector('p:not(.logged-session-info)');
      if (subtitle && !subtitle.classList.contains('header-page-title') && !subtitle.classList.contains('header-search-users-label')) {
        subtitle.classList.add('header-page-title');
      }
      if (subtitle) {
        subtitle.insertAdjacentElement('afterend', el);
      } else if (headerActions) {
        headerContent.insertBefore(el, headerActions);
      } else {
        headerContent.appendChild(el);
      }
    }

    const position = user.cargo || (user.isRoot ? 'System Administrator' : '—');
    const company = user.companyName || (user.isRoot ? 'All Companies' : '—');
    el.innerHTML = [
      `<i class="fas fa-user" aria-hidden="true"></i> ${buildLoggedUserNameHtml(user)}`,
      `<span class="logged-session-separator" aria-hidden="true">·</span>`,
      `<i class="fas fa-briefcase" aria-hidden="true"></i> ${escapeHtml(position)}`,
      `<span class="logged-session-separator" aria-hidden="true">·</span>`,
      `<i class="fas fa-industry" aria-hidden="true"></i> ${escapeHtml(company)}`
    ].join(' ');
  }

  async function fetchLoggedUserFallback() {
    const res = await fetch('/api/auth/check');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.authenticated && data.user) {
      renderLoggedUserInfo(data.user);
    }
  }

  function clearCachedMenuAccess() {
    try {
      sessionStorage.removeItem(MENU_ACCESS_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        const readyState = String(existing.readyState || '').toLowerCase();
        if (
          existing.dataset.loaded === 'true'
          || readyState === 'loaded'
          || readyState === 'complete'
        ) {
          existing.dataset.loaded = 'true';
          resolve();
          return;
        }
        // When scripts are included in HTML without async/defer, they are already
        // loaded/executed before this code runs, so there is no pending load event.
        if (document.readyState !== 'loading') {
          existing.dataset.loaded = 'true';
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureSystemSettingsScripts() {
    try {
      await loadScriptOnce('system-settings-shared.js');
      await loadScriptOnce('system-settings-apply.js');
    } catch (error) {
      console.warn('System settings scripts:', error.message);
    }
  }

  function loadStylesheetOnce(href) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${href}`));
      document.head.appendChild(link);
    });
  }

  async function ensureNewsAnnouncementScripts() {
    try {
      await loadStylesheetOnce('news-announcement.css');
      await loadScriptOnce('news-announcement.js');
    } catch (error) {
      console.warn('News announcement scripts:', error.message);
    }
  }

  async function ensureApplicationWriteAccessScripts() {
    try {
      await loadStylesheetOnce('application-write-access.css');
      await loadScriptOnce('application-write-access.js');
    } catch (error) {
      console.warn('Application write access scripts:', error.message);
    }
  }

  function notifyMenuAccessApplied(accessData) {
    if (window.DoubleYApplicationWriteAccess && typeof window.DoubleYApplicationWriteAccess.apply === 'function') {
      window.DoubleYApplicationWriteAccess.apply(accessData);
    }
    document.dispatchEvent(new CustomEvent('doubley:menu-access-applied', { detail: accessData }));
  }

  async function ensureSystemLogoutScripts() {
    try {
      await loadStylesheetOnce('system-logout.css');
      await loadScriptOnce('system-logout.js');
    } catch (error) {
      console.warn('System logout scripts:', error.message);
    }
  }

  async function bindSystemLogoutIfReady() {
    await ensureSystemLogoutScripts();
    if (window.DoubleYSystemLogout && typeof window.DoubleYSystemLogout.bind === 'function') {
      window.DoubleYSystemLogout.bind();
    }
  }

  async function showNewsAnnouncementsIfNeeded() {
    await ensureNewsAnnouncementScripts();
    if (window.DoubleYNewsAnnouncement && typeof window.DoubleYNewsAnnouncement.show === 'function') {
      try {
        await window.DoubleYNewsAnnouncement.show();
      } catch (error) {
        console.warn('News announcement:', error.message);
      }
    }
  }

  function updateSubmenuGroupsVisibility(dropdown) {
    if (!dropdown) return;

    dropdown.querySelectorAll('.dropdown-submenu-group').forEach((group) => {
      const visibleItems = Array.from(group.querySelectorAll('.dropdown-item')).filter((item) => item.style.display !== 'none');
      group.style.display = visibleItems.length > 0 ? '' : 'none';
    });
  }

  function updateMasterDataVisibility(headerActions) {
    const masterData = headerActions.querySelector('.master-data-dropdown');
    if (!masterData) return;

    updateSubmenuGroupsVisibility(masterData);

    const visibleGroups = Array.from(masterData.querySelectorAll('.dropdown-submenu-group')).filter((group) => group.style.display !== 'none');
    masterData.style.display = visibleGroups.length > 0 ? '' : 'none';
  }

  function updateApplicationsDropdownVisibility(headerActions) {
    const applications = headerActions.querySelector('.applications-dropdown');
    if (!applications) return;

    updateSubmenuGroupsVisibility(applications);

    const menu = applications.querySelector('.applications-dropdown-menu');
    const directItems = menu
      ? Array.from(menu.children).filter((el) => el.classList.contains('dropdown-item') && el.style.display !== 'none')
      : [];
    const visibleGroups = Array.from(applications.querySelectorAll('.dropdown-submenu-group')).filter((group) => group.style.display !== 'none');
    applications.style.display = (directItems.length > 0 || visibleGroups.length > 0) ? '' : 'none';
  }

  function resetMenuVisibility() {
    document.querySelectorAll('.header-actions [data-app], .header-actions a[href*=".html"], .header-actions .dropdown-item').forEach((item) => {
      item.style.display = '';
      item.removeAttribute('aria-hidden');
    });

    document.querySelectorAll('.header-actions .users-dropdown, .header-actions .master-data-dropdown, .header-actions .applications-dropdown, .header-actions .movement-dropdown, .header-actions .picking-dropdown, .header-actions .church-dropdown, .header-actions .help-dropdown').forEach((group) => {
      group.style.display = '';
    });

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.querySelectorAll('.dropdown-submenu-group').forEach((group) => {
        group.style.display = '';
      });
    }
  }

  function applyMenuAccess(accessData) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const isRoot = Boolean(accessData.isRoot);

    if (isRoot) {
      resetMenuVisibility();
      headerActions.setAttribute('data-menu-access-ready', 'true');
      notifyMenuAccessApplied(accessData);
      return;
    }

    const allowed = new Set(
      (accessData.applications || []).map((app) => normalizeAppName(app))
    );

    document.querySelectorAll('.header-actions [data-app], .header-actions a[href*=".html"]').forEach((item) => {
      const appName = getItemApplication(item);
      if (!appName) return;

      const alwaysAccessible = item.getAttribute('data-always-accessible') === 'true';
      const allowedItem = isRoot || alwaysAccessible || allowed.has(normalizeAppName(appName));
      item.style.display = allowedItem ? '' : 'none';
      if (allowedItem) {
        item.removeAttribute('aria-hidden');
      }
    });

    document.querySelectorAll('.header-actions .users-dropdown, .header-actions .movement-dropdown, .header-actions .picking-dropdown, .header-actions .church-dropdown, .header-actions .help-dropdown').forEach((group) => {
      const visibleItems = Array.from(group.querySelectorAll('.dropdown-item')).filter((item) => item.style.display !== 'none');
      group.style.display = visibleItems.length > 0 ? '' : 'none';
    });

    updateMasterDataVisibility(headerActions);
    updateApplicationsDropdownVisibility(headerActions);

    headerActions.setAttribute('data-menu-access-ready', 'true');
    notifyMenuAccessApplied(accessData);
  }

  function markMenuAccessPending() {
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.removeAttribute('data-menu-access-ready');
    }
  }

  function revealMenuWithoutFilter() {
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      resetMenuVisibility();
      headerActions.setAttribute('data-menu-access-ready', 'true');
    }
    notifyMenuAccessApplied({ isRoot: true, applications: [], accessByApplication: {} });
  }

  async function sendSessionHeartbeat() {
    if (window.location.pathname.endsWith('/login.html')) return;

    const app = getCurrentPageApp();
    try {
      await fetch('/api/auth/heartbeat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: app || null })
      });
    } catch {
      // ignore heartbeat errors
    }
  }

  function getSessionInactivityMinutes() {
    if (window.DoubleYSystemSettings && typeof window.DoubleYSystemSettings.readCachedSettings === 'function') {
      const cached = window.DoubleYSystemSettings.readCachedSettings();
      if (cached && Number.isInteger(cached.sessionInactivityMinutes)) {
        return cached.sessionInactivityMinutes;
      }
    }
    return 30;
  }

  async function forceLogoutByInactivity() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch {
      // ignore logout errors
    }

    try {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      clearCachedMenuAccess();
    } catch {
      // ignore storage errors
    }

    window.location.replace('/login.html');
  }

  function resetInactivityTimer() {
    if (window.location.pathname.endsWith('/login.html')) return;

    if (inactivityTimer) {
      window.clearTimeout(inactivityTimer);
    }

    const minutes = getSessionInactivityMinutes();
    inactivityTimer = window.setTimeout(forceLogoutByInactivity, minutes * 60 * 1000);
  }

  function bindInactivityListeners() {
    if (window.location.pathname.endsWith('/login.html')) return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    window.addEventListener('doubley:system-settings-applied', resetInactivityTimer);
    resetInactivityTimer();
  }

  function startSessionHeartbeat() {
    if (window.location.pathname.endsWith('/login.html')) return;

    sendSessionHeartbeat();
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
    }
    heartbeatTimer = window.setInterval(sendSessionHeartbeat, MENU_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        sendSessionHeartbeat();
      }
    });
  }

  async function initMenuAccess() {
    if (window.location.pathname.endsWith('/login.html')) return;

    await ensureSystemSettingsScripts();

    if (window.DoubleYHeaderMenu) {
      window.DoubleYHeaderMenu.ensure();
      window.DoubleYHeaderMenu.setupDropdowns();
    }

    await ensureApplicationWriteAccessScripts();
    await bindSystemLogoutIfReady();

    markMenuAccessPending();

    const cached = readCachedMenuAccess();
    if (cached && document.querySelector('.header-actions')) {
      applyMenuAccess(cached);
      renderLoggedUserInfo(cached.user);
    } else if (cached) {
      notifyMenuAccessApplied(cached);
    }

    try {
      const accessData = await fetchMenuAccess();
      if (document.querySelector('.header-actions')) {
        applyMenuAccess(accessData);
      } else {
        notifyMenuAccessApplied(accessData);
      }
      renderLoggedUserInfo(accessData.user);
      if (window.DoubleYHeaderMenu) {
        window.DoubleYHeaderMenu.setupDropdowns();
      }
      await bindSystemLogoutIfReady();
    } catch (error) {
      console.error('Menu access error:', error);
      if (cached) {
        if (document.querySelector('.header-actions')) {
          applyMenuAccess(cached);
        }
        renderLoggedUserInfo(cached.user);
      } else {
        await fetchLoggedUserFallback();
        revealMenuWithoutFilter();
      }
    }

    await showNewsAnnouncementsIfNeeded();
    startSessionHeartbeat();
    bindInactivityListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuAccess);
  } else {
    initMenuAccess();
  }

  window.DoubleYMenuAccess = {
    refresh: initMenuAccess,
    getCurrentPageApp,
    clearCache: clearCachedMenuAccess,
    renderLoggedUserInfo
  };
})();
