(function () {
  const MENU_ACCESS_KEY = 'doubley_menu_access';

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

    const name = user.nome || user.email || 'User';
    const position = user.cargo || (user.isRoot ? 'System Administrator' : '—');
    const company = user.companyName || (user.isRoot ? 'All Companies' : '—');
    el.innerHTML = [
      `<i class="fas fa-user" aria-hidden="true"></i> ${escapeHtml(name)}`,
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

  function resetMenuVisibility() {
    document.querySelectorAll('.header-actions [data-app], .header-actions a[href*=".html"], .header-actions .dropdown-item').forEach((item) => {
      item.style.display = '';
      item.removeAttribute('aria-hidden');
    });

    document.querySelectorAll('.header-actions .users-dropdown, .header-actions .customer-dropdown, .header-actions .product-dropdown, .header-actions .applications-dropdown, .header-actions .location-dropdown, .header-actions .movement-dropdown, .header-actions .picking-dropdown, .header-actions .church-dropdown, .header-actions .help-dropdown').forEach((group) => {
      group.style.display = '';
    });
  }

  function applyMenuAccess(accessData) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const isRoot = Boolean(accessData.isRoot);

    if (isRoot) {
      resetMenuVisibility();
      headerActions.setAttribute('data-menu-access-ready', 'true');
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

    document.querySelectorAll('.header-actions .users-dropdown, .header-actions .customer-dropdown, .header-actions .product-dropdown, .header-actions .applications-dropdown, .header-actions .location-dropdown, .header-actions .movement-dropdown, .header-actions .picking-dropdown, .header-actions .church-dropdown, .header-actions .help-dropdown').forEach((group) => {
      const visibleItems = Array.from(group.querySelectorAll('.dropdown-item')).filter((item) => item.style.display !== 'none');
      group.style.display = visibleItems.length > 0 ? '' : 'none';
    });

    headerActions.setAttribute('data-menu-access-ready', 'true');
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
  }

  async function initMenuAccess() {
    if (window.location.pathname.endsWith('/login.html')) return;

    if (window.DoubleYHeaderMenu) {
      window.DoubleYHeaderMenu.ensure();
      window.DoubleYHeaderMenu.setupDropdowns();
    }

    markMenuAccessPending();

    const cached = readCachedMenuAccess();
    if (cached && document.querySelector('.header-actions')) {
      applyMenuAccess(cached);
      renderLoggedUserInfo(cached.user);
    }

    try {
      const accessData = await fetchMenuAccess();
      if (document.querySelector('.header-actions')) {
        applyMenuAccess(accessData);
      }
      renderLoggedUserInfo(accessData.user);
      if (window.DoubleYHeaderMenu) {
        window.DoubleYHeaderMenu.setupDropdowns();
      }
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
