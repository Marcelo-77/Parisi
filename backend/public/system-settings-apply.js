(function () {
  if (window.location.pathname.endsWith('/login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.DoubleYSystemSettings) {
        window.DoubleYSystemSettings.loadAndApplySystemSettings();
      }
    });
    return;
  }

  function boot() {
    if (!window.DoubleYSystemSettings) return;
    window.DoubleYSystemSettings.loadAndApplySystemSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
