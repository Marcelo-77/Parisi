(function () {
  const SESSION_BANNER_ID = 'sessionContextBanner';

  function isLoginPage() {
    return window.location.pathname.endsWith('/login.html');
  }

  function shouldSkip() {
    return isLoginPage() || document.body?.dataset?.noHeaderSession === 'true';
  }

  function shouldHideBannerForRoot(user) {
    if (user?.companyId) return false;
    return Boolean(
      document.getElementById('rootCompanyMount')
      || document.body?.classList?.contains('business-partner-page')
    );
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true' || document.readyState !== 'loading') {
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

  async function ensureBrandImage() {
    if (window.BrandImage) return;
    try {
      await loadScriptOnce('brand-image.js?v=20261122photozoom1');
    } catch (error) {
      console.warn('Brand image script:', error.message);
    }
  }

  function prepareHeader() {
    document.querySelectorAll('.header .double-y-wordmark').forEach((el) => {
      if (el.closest('#sessionContextBanner') || el.classList.contains('double-y-wordmark--login')) {
        return;
      }
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });

    document.querySelectorAll('.header-content').forEach((headerContent) => {
      const title = headerContent.querySelector('h1');
      if (title) title.remove();

      const oldInfo = document.getElementById('loggedSessionInfo');
      if (oldInfo) oldInfo.remove();

      headerContent.classList.add('header-content--bp');
    });
  }

  function getCompanyRole(user) {
    const role = user?.cargo
      || user?.businessPartner?.role
      || user?.businessPartnerRole
      || user?.role
      || null;
    if (role && String(role).trim()) return String(role).trim();
    if (user?.isRoot) return 'System Administrator';
    return '—';
  }

  function applyUser(user) {
    const label = document.getElementById('sessionUserLabel');
    const nameEl = document.getElementById('sessionUserName');
    const roleEl = document.getElementById('sessionUserEmail');
    if (label) {
      label.hidden = true;
      label.textContent = '';
    }
    if (nameEl) nameEl.textContent = user?.nome || user?.email || '—';
    if (roleEl) roleEl.textContent = getCompanyRole(user);
  }

  function stripInlineWordmarks(root) {
    if (!root) return;
    root.querySelectorAll('.double-y-wordmark').forEach((el) => {
      if (el.id === 'doubleYCornerBrand' || el.classList.contains('double-y-wordmark--corner')) return;
      const divider = el.nextElementSibling;
      if (divider && divider.classList.contains('bp-hero-divider--brand')) {
        divider.remove();
      }
      el.remove();
    });
  }

  function bannerMarkup() {
    return `
      <div class="bp-hero-user">
        <div id="sessionUserPhotoWrap" class="brand-image-wrap brand-image--hero-user"></div>
        <div class="bp-hero-user-text">
          <strong id="sessionUserName">—</strong>
          <strong id="sessionUserEmail" class="session-user-role">—</strong>
        </div>
      </div>
      <div class="bp-hero-divider" aria-hidden="true"></div>
      <div class="bp-hero-company">
        <div id="sessionCompanyLogoWrap" class="brand-image-wrap brand-image--hero-company" hidden aria-hidden="true">
          <img id="sessionCompanyLogoImg" class="brand-image-img" src="" alt="" hidden>
          <div id="sessionCompanyLogoInitials" class="brand-image-initials" hidden></div>
        </div>
        <div class="bp-hero-company-text">
          <span class="bp-hero-label">Company</span>
          <strong id="sessionCompanyName">—</strong>
        </div>
      </div>
    `;
  }

  function ensureBanner(headerContent) {
    let banner = document.getElementById(SESSION_BANNER_ID);
    if (banner) {
      if (!banner.classList.contains('bp-header-session')) {
        banner.classList.add('bp-header-session');
      }
      stripInlineWordmarks(banner);
      return banner;
    }

    banner = document.createElement('div');
    banner.id = SESSION_BANNER_ID;
    banner.className = 'bp-hero-card bp-header-session';
    banner.hidden = true;
    banner.innerHTML = bannerMarkup();
    headerContent.insertBefore(banner, headerContent.firstElementChild || null);
    return banner;
  }

  function setBannerVisible(banner, visible) {
    if (!banner) return;
    banner.classList.toggle('bp-session-hidden', !visible);
    if (visible) {
      banner.removeAttribute('hidden');
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
    const headerContent = banner.parentElement || document.querySelector('.header-content');
    stripInlineWordmarks(headerContent);
    stripInlineWordmarks(banner);
    window.DoubleYLogo?.ensureHeaderBrandRow?.();
  }

  function renderSessionUserPhoto(photo, name, userId) {
    const wrap = document.getElementById('sessionUserPhotoWrap');
    if (!wrap || !window.BrandImage) return;
    const src = window.BrandImage.userPhotoSrc
      ? window.BrandImage.userPhotoSrc(userId, photo)
      : photo;
    wrap.innerHTML = window.BrandImage.renderUserImageMarkup(src, name, 'brand-image--hero-user');
    const trigger = wrap.querySelector('.brand-image-wrap') || wrap;
    window.BrandImage.bindPhotoZoom?.(trigger, {
      label: name ? `Photo of ${name}` : 'View photo larger'
    });
  }

  async function render(accessData) {
    if (shouldSkip()) return;

    prepareHeader();

    const headerContent = document.querySelector('.header-content');
    if (!headerContent) return;

    const banner = ensureBanner(headerContent);
    const user = accessData?.user || null;
    const isRoot = Boolean(accessData?.isRoot || user?.isRoot);

    if (!user) {
      setBannerVisible(banner, false);
      return;
    }

    if (isRoot && shouldHideBannerForRoot(user)) {
      setBannerVisible(banner, false);
      return;
    }

    await ensureBrandImage();

    setBannerVisible(banner, true);

    applyUser(user);

    const companyNameEl = document.getElementById('sessionCompanyName');

    const companyName = user.companyName
      || user.businessPartner?.companyName
      || (isRoot ? 'All Companies' : '—');
    if (companyNameEl) companyNameEl.textContent = companyName;

    renderSessionUserPhoto(user.photo, user.nome, user.id);

    window.DoubleYLogo?.ensureHeaderBrandRow?.();

    if (window.BrandImage) {
      const companyId = user.companyId || user.businessPartner?.companyId || null;
      const companyLogo = window.BrandImage.companyLogoSrc
        ? window.BrandImage.companyLogoSrc(companyId, user.companyLogo || user.businessPartner?.companyLogo)
        : (user.companyLogo || user.businessPartner?.companyLogo || null);
      window.BrandImage.setBrandImage(
        document.getElementById('sessionCompanyLogoWrap'),
        document.getElementById('sessionCompanyLogoImg'),
        document.getElementById('sessionCompanyLogoInitials'),
        companyLogo,
        companyName
      );
    }
  }

  window.DoubleYHeaderSession = {
    prepareHeader,
    render,
    setBannerVisible,
    applyUser,
    getCompanyRole
  };
})();
