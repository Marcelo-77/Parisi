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

  function applyMenuAccess(accessData) {
    const allowed = new Set(
      (accessData.applications || []).map((app) => normalizeAppName(app))
    );
    const isRoot = Boolean(accessData.isRoot);

    document.querySelectorAll('.header-actions [data-app], .header-actions a[href*=".html"]').forEach((item) => {
      const appName = getItemApplication(item);
      if (!appName) return;

      const alwaysAccessible = item.getAttribute('data-always-accessible') === 'true';
      const allowedItem = isRoot || alwaysAccessible || allowed.has(normalizeAppName(appName));
      item.style.display = allowedItem ? '' : 'none';
      item.setAttribute('aria-hidden', allowedItem ? 'false' : 'true');
    });

    document.querySelectorAll('.header-actions .users-dropdown, .header-actions .customer-dropdown, .header-actions .product-dropdown, .header-actions .applications-dropdown, .header-actions .location-dropdown, .header-actions .movement-dropdown, .header-actions .picking-dropdown, .header-actions .help-dropdown').forEach((group) => {
      const visibleItems = Array.from(group.querySelectorAll('.dropdown-item')).filter((item) => item.style.display !== 'none');
      group.style.display = visibleItems.length > 0 ? '' : 'none';
    });

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.setAttribute('data-menu-access-ready', 'true');
    }
  }

  async function initMenuAccess() {
    if (window.location.pathname.endsWith('/login.html')) return;

    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    try {
      const accessData = await fetchMenuAccess();
      applyMenuAccess(accessData);
    } catch (error) {
      console.error('Menu access error:', error);
      const cached = readCachedMenuAccess();
      if (cached) {
        applyMenuAccess(cached);
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
    getCurrentPageApp
  };
})();
