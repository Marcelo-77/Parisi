(function () {
  const SESSION_KEYS = [
    'doubley_tab_auth',
    'doubley_menu_access',
    'doubley_news_announcement_shown'
  ];

  function clearClientSessionData() {
    SESSION_KEYS.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    });

    if (window.DoubleYMenuAccess && typeof window.DoubleYMenuAccess.clearCache === 'function') {
      window.DoubleYMenuAccess.clearCache();
    }
  }

  function showThankYouModal() {
    const existing = document.getElementById('systemExitOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'systemExitOverlay';
    overlay.className = 'system-exit-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'systemExitTitle');

    overlay.innerHTML = [
      '<div class="system-exit-modal">',
      '  <div class="system-exit-modal-header">',
      '    <h2 id="systemExitTitle">Thank you!</h2>',
      '  </div>',
      '  <div class="system-exit-modal-body">',
      '    <p>Thank you for using the Double-Y Warehouse System.',
      '    We appreciate your time and hope to see you again soon.</p>',
      '  </div>',
      '  <div class="system-exit-modal-footer">',
      '    <button type="button" class="btn btn-primary" id="systemExitOkBtn">OK</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const okBtn = document.getElementById('systemExitOkBtn');
    if (okBtn) {
      okBtn.focus();
      okBtn.addEventListener('click', () => {
        window.location.replace('/login.html');
      });
    }
  }

  async function exitSystem() {
    if (window.DoubleYHeaderMenu && typeof window.DoubleYHeaderMenu.closeAll === 'function') {
      window.DoubleYHeaderMenu.closeAll();
    }

    const exitBtn = document.getElementById('exitSystemBtn');
    if (exitBtn) {
      exitBtn.disabled = true;
      exitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exiting...';
    }

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch {
      // still clear client session and show thank-you
    }

    clearClientSessionData();
    showThankYouModal();
  }

  function bindExitButton() {
    if (window.location.pathname.endsWith('/login.html')) return;

    const btn = document.getElementById('exitSystemBtn');
    if (!btn || btn.dataset.logoutBound === 'true') return;

    btn.dataset.logoutBound = 'true';
    btn.addEventListener('click', () => {
      exitSystem();
    });
  }

  window.DoubleYSystemLogout = {
    bind: bindExitButton,
    exit: exitSystem
  };
})();
