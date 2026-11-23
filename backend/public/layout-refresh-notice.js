/**
 * One-time dialog after users adopt the new Screen Display layout.
 */
(function () {
  const NOTICE_VERSION = 'layout-refresh-2026-11';
  const LOCAL_KEY_PREFIX = 'doubley_layout_refresh_notice_';

  const FLAG_BR_SVG = `
    <svg class="layout-refresh-notice-flag" viewBox="0 0 22 15" aria-hidden="true">
      <rect width="22" height="15" fill="#009c3b"/>
      <polygon points="11,1.5 20,7.5 11,13.5 2,7.5" fill="#ffdf00"/>
      <circle cx="11" cy="7.5" r="3.2" fill="#002776"/>
    </svg>`;

  const FLAG_EN_SVG = `
    <svg class="layout-refresh-notice-flag" viewBox="0 0 22 15" aria-hidden="true">
      <rect width="22" height="15" fill="#012169"/>
      <path d="M0,0 L22,15 M22,0 L0,15" stroke="#fff" stroke-width="3"/>
      <path d="M0,0 L22,15 M22,0 L0,15" stroke="#c8102e" stroke-width="1.5"/>
      <path d="M11,0 V15 M0,7.5 H22" stroke="#fff" stroke-width="5"/>
      <path d="M11,0 V15 M0,7.5 H22" stroke="#c8102e" stroke-width="2.5"/>
    </svg>`;

  const COPY = {
    en: {
      title: 'System layout update',
      paragraphs: [
        'Dear Double Y Users,',
        'As part of our ongoing commitment to continuous improvement, we have made some updates to the Double Y IT System, refreshing the screen layouts to provide a more modern, dynamic, and user-friendly experience.',
        'These improvements are designed to make everyday activities easier, enhance navigation, and provide a more intuitive working environment.',
        'We are continuously working to improve our system and deliver a better experience for everyone.',
        'Thank you for being part of Double Y!'
      ],
      signoff: 'Double Y IT Team',
      ok: 'OK',
      langBr: 'Português',
      langEn: 'English'
    },
    pt: {
      title: 'Atualização do layout do sistema',
      paragraphs: [
        'Caros usuários Double Y,',
        'Como parte do nosso compromisso contínuo com a melhoria, atualizamos o Double Y IT System, renovando os layouts das telas para uma experiência mais moderna, dinâmica e fácil de usar.',
        'Essas melhorias foram pensadas para facilitar as atividades do dia a dia, aprimorar a navegação e oferecer um ambiente de trabalho mais intuitivo.',
        'Seguimos trabalhando para melhorar o sistema e entregar uma experiência melhor para todos.',
        'Obrigado por fazer parte da Double Y!'
      ],
      signoff: 'Equipe Double Y IT',
      ok: 'OK',
      langBr: 'Português',
      langEn: 'English'
    }
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readUser() {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem('doubley_menu_access') || 'null');
      return cached?.user || null;
    } catch {
      return null;
    }
  }

  function readScreenDisplay() {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem('doubley_menu_access') || 'null');
      return cached?.screenDisplay || null;
    } catch {
      return null;
    }
  }

  function readLang() {
    try {
      const fromSsd = window.DoubleYScreenDisplay?.getLang?.();
      if (fromSsd === 'pt' || fromSsd === 'en') return fromSsd;
    } catch {
      // ignore
    }
    try {
      const stored = String(window.localStorage.getItem('doubley_lang') || '').toLowerCase();
      if (stored === 'pt' || stored === 'en') return stored;
    } catch {
      // ignore
    }
    return 'en';
  }

  function ownerKey(user) {
    if (!user) return 'anonymous';
    return String(user.id || user.email || 'anonymous');
  }

  function localKey(user) {
    return `${LOCAL_KEY_PREFIX}${NOTICE_VERSION}_${ownerKey(user)}`;
  }

  function hasSeenLocal(user) {
    try {
      return window.localStorage.getItem(localKey(user)) === '1';
    } catch {
      return false;
    }
  }

  function markSeenLocal(user) {
    try {
      window.localStorage.setItem(localKey(user), '1');
    } catch {
      // ignore
    }
  }

  function shouldShow(accessData) {
    const user = accessData?.user || readUser();
    if (!user) return false;
    if (hasSeenLocal(user)) return false;

    const prefs = accessData?.screenDisplay || readScreenDisplay() || {};
    if (prefs.layoutNoticeSeen === true) {
      markSeenLocal(user);
      return false;
    }

    const mode = String(
      prefs.mode
      || window.DoubleYScreenDisplay?.getActiveMode?.()
      || window.DoubleYScreenDisplay?.getMode?.()
      || ''
    ).toLowerCase();
    if (mode !== 'sidebar') return false;

    const path = window.location.pathname || '';
    return path.endsWith('/warehouse-home.html') || path.endsWith('/Setting-Screen-Display.html');
  }

  async function markSeenServer() {
    try {
      const res = await fetch('/api/auth/screen-display', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutNoticeSeen: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.screenDisplay) {
        try {
          const cached = JSON.parse(window.sessionStorage.getItem('doubley_menu_access') || 'null') || {};
          cached.screenDisplay = { ...(cached.screenDisplay || {}), ...data.screenDisplay };
          window.sessionStorage.setItem('doubley_menu_access', JSON.stringify(cached));
        } catch {
          // ignore
        }
      }
    } catch {
      // local flag is enough as fallback
    }
  }

  function applyCopy(overlay, lang) {
    const copy = COPY[lang] || COPY.en;
    const title = overlay.querySelector('#layoutRefreshNoticeTitle');
    const body = overlay.querySelector('#layoutRefreshNoticeBody');
    const okBtn = overlay.querySelector('#layoutRefreshNoticeOkBtn');
    const brBtn = overlay.querySelector('#layoutRefreshNoticeLangBr');
    const enBtn = overlay.querySelector('#layoutRefreshNoticeLangEn');

    if (title) {
      title.innerHTML = `<i class="fas fa-info-circle" aria-hidden="true"></i> ${escapeHtml(copy.title)}`;
    }
    if (body) {
      body.innerHTML = copy.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('')
        + `<p class="layout-refresh-notice-signoff">${escapeHtml(copy.signoff)}</p>`;
    }
    if (okBtn) {
      okBtn.innerHTML = `<i class="fas fa-check" aria-hidden="true"></i> ${escapeHtml(copy.ok)}`;
    }
    brBtn?.classList.toggle('is-active', lang === 'pt');
    enBtn?.classList.toggle('is-active', lang === 'en');
    brBtn?.setAttribute('aria-pressed', lang === 'pt' ? 'true' : 'false');
    enBtn?.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    overlay.setAttribute('data-lang', lang);
  }

  function showDialog(user) {
    if (document.getElementById('layoutRefreshNoticeOverlay')) return;

    let lang = readLang();
    const overlay = document.createElement('div');
    overlay.id = 'layoutRefreshNoticeOverlay';
    overlay.className = 'layout-refresh-notice-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'layoutRefreshNoticeTitle');
    overlay.setAttribute('data-lang', lang);

    overlay.innerHTML = `
      <div class="layout-refresh-notice-modal">
        <div class="layout-refresh-notice-header">
          <h2 id="layoutRefreshNoticeTitle"></h2>
          <div class="layout-refresh-notice-langs" role="group" aria-label="Language">
            <button type="button" class="layout-refresh-notice-lang-btn" id="layoutRefreshNoticeLangBr" title="Português" aria-label="Português">
              ${FLAG_BR_SVG}
            </button>
            <button type="button" class="layout-refresh-notice-lang-btn" id="layoutRefreshNoticeLangEn" title="English" aria-label="English">
              ${FLAG_EN_SVG}
            </button>
          </div>
        </div>
        <div class="layout-refresh-notice-body" id="layoutRefreshNoticeBody"></div>
        <div class="layout-refresh-notice-footer">
          <button type="button" class="btn btn-primary" id="layoutRefreshNoticeOkBtn"></button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    applyCopy(overlay, lang);

    overlay.querySelector('#layoutRefreshNoticeLangBr')?.addEventListener('click', () => {
      lang = 'pt';
      applyCopy(overlay, lang);
    });
    overlay.querySelector('#layoutRefreshNoticeLangEn')?.addEventListener('click', () => {
      lang = 'en';
      applyCopy(overlay, lang);
    });

    const okBtn = overlay.querySelector('#layoutRefreshNoticeOkBtn');
    okBtn?.addEventListener('click', async () => {
      okBtn.disabled = true;
      markSeenLocal(user);
      await markSeenServer();
      overlay.remove();
      document.body.style.overflow = '';
    });

    okBtn?.focus();
  }

  async function maybeShow(accessData) {
    if (!shouldShow(accessData)) return;
    const user = accessData?.user || readUser();
    if (!document.getElementById('layout-refresh-notice-css')) {
      const link = document.createElement('link');
      link.id = 'layout-refresh-notice-css';
      link.rel = 'stylesheet';
      link.href = 'layout-refresh-notice.css?v=20261123notice2';
      document.head.appendChild(link);
    }
    showDialog(user);
  }

  function boot() {
    if (window.location.pathname.endsWith('/login.html')) return;

    document.addEventListener('doubley:menu-access-applied', (event) => {
      window.setTimeout(() => {
        void maybeShow(event.detail || null);
      }, 450);
    });

    window.addEventListener('doubley:screen-display-saved', () => {
      window.setTimeout(() => {
        void maybeShow(null);
      }, 300);
    });
  }

  boot();

  window.DoubleYLayoutRefreshNotice = {
    maybeShow,
    NOTICE_VERSION
  };
})();
