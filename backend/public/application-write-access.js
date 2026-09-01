(function () {
  const ACCESS_MODE_SEARCH = 'search';

  function normalizeAppName(name) {
    return name ? String(name).trim().toLowerCase() : '';
  }

  function getCurrentPageApp() {
    if (window.DoubleYMenuAccess && typeof window.DoubleYMenuAccess.getCurrentPageApp === 'function') {
      return window.DoubleYMenuAccess.getCurrentPageApp();
    }
    const path = window.location.pathname || '';
    const fileName = path.split('/').pop() || '';
    return fileName.endsWith('.html') ? fileName : null;
  }

  function readCachedMenuAccess() {
    try {
      const raw = sessionStorage.getItem('doubley_menu_access');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getAccessModeForApp(accessData, appName) {
    if (!accessData || accessData.isRoot || !appName) return 'all';
    const map = accessData.accessByApplication || {};
    return map[appName] || map[normalizeAppName(appName)] || 'all';
  }

  function isSearchOnlyAccess(accessData) {
    const currentApp = getCurrentPageApp();
    if (!currentApp) return false;
    const data = accessData || readCachedMenuAccess();
    if (!data) return false;
    return getAccessModeForApp(data, currentApp) === ACCESS_MODE_SEARCH;
  }

  function shouldHideMenuWriteItem(item, accessData) {
    if (!accessData || accessData.isRoot) return false;
    if (item.getAttribute('data-always-accessible') === 'true') return false;
    if (item.getAttribute('data-write-menu') !== 'true') return false;

    const appName = item.getAttribute('data-app');
    if (!appName) return false;

    const allowed = new Set(
      (accessData.applications || []).map((app) => normalizeAppName(app))
    );
    if (!allowed.has(normalizeAppName(appName))) return true;

    return getAccessModeForApp(accessData, appName) === ACCESS_MODE_SEARCH;
  }

  function hideWriteControls(root) {
    const scope = root || document;
    const selectors = [
      '[data-write-action="true"]',
      '[data-action="edit"]',
      '[data-action="delete"]',
      '[data-action="move"]',
      '.btn-delete',
      '.btn-edit',
      '.btn-action.delete',
      '.btn-action.edit',
      '.btn-action.movement',
      '.btn-action.btn-delete',
      '.btn-action.btn-edit',
      '.loc-action-btn.btn-edit',
      '.loc-action-btn.btn-delete',
      '#editFromDetailsBtn',
      '#saveItemBtn',
      '#saveMovementBtn',
      '#itemModal',
      '#movementModal',
      '#newRecordBtn',
      '#saveNewRecordsBtn',
      '#addNewRecordLineBtn',
      '#newRecordsPanel',
      '.new-records-panel',
      '#saveApplicationBtn',
      '#saveEditApplicationBtn',
      '#newApplicationsSection',
      'button[id^="delete"]',
      'button[id*="Delete"]',
      'button[id*="delete"]'
    ];

    scope.querySelectorAll(selectors.join(',')).forEach((el) => {
      if (el.closest('.header-actions')) return;
      if (el.closest('[data-search-only-keep]')) return;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      if ('disabled' in el) el.disabled = true;
    });

    scope.querySelectorAll('form[data-write-form="true"], .write-form-panel').forEach((el) => {
      if (el.closest('.header-actions')) return;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function applyMenuWriteRestrictions(accessData) {
    document.querySelectorAll('.header-actions [data-write-menu="true"]').forEach((item) => {
      const hide = shouldHideMenuWriteItem(item, accessData);
      item.style.display = hide ? 'none' : '';
      if (hide) item.setAttribute('aria-hidden', 'true');
      else item.removeAttribute('aria-hidden');
    });
  }

  function applyWriteAccess(accessData) {
    const searchOnly = isSearchOnlyAccess(accessData);
    document.body.classList.toggle('app-access-search-only', searchOnly);
    applyMenuWriteRestrictions(accessData || readCachedMenuAccess());

    if (!searchOnly) return;

    hideWriteControls(document);

    if (!window.__doubleyWriteAccessObserver) {
      window.__doubleyWriteAccessObserver = new MutationObserver(() => {
        const cached = readCachedMenuAccess();
        if (isSearchOnlyAccess(cached)) {
          hideWriteControls(document);
        }
      });
      window.__doubleyWriteAccessObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  window.DoubleYApplicationWriteAccess = {
    apply: applyWriteAccess,
    isSearchOnlyAccess,
    getAccessModeForApp
  };

  document.addEventListener('doubley:menu-access-applied', (event) => {
    applyWriteAccess(event.detail || readCachedMenuAccess());
  });

  const cached = readCachedMenuAccess();
  if (cached) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyWriteAccess(cached));
    } else {
      applyWriteAccess(cached);
    }
  }
})();
