(function () {
  const EFFECT_MS = 7000;
  const CONTACT_EMAIL = 'office@doubleyitsystem.com';
  const CONTACT_LABEL = 'Contact: office@doubleyitsystem.com';
  const WORDMARK_HTML = `
    <a class="double-y-wordmark double-y-wordmark--login double-y-wordmark--header double-y-wordmark--mark" href="mailto:office@doubleyitsystem.com" aria-label="Double Y - Contact office@doubleyitsystem.com" data-doubley-contact="true">
      <img src="DoubleYnew.png" alt="Double Y" class="double-y-logo-mark">
      <span class="double-y-contact-tip" role="tooltip">${CONTACT_LABEL}</span>
    </a>`;

  let timerStarted = false;
  let settled = false;

  function isLoginPage() {
    return window.location.pathname.endsWith('/login.html');
  }

  function settleLogoEffects() {
    settled = true;
    document.querySelectorAll('.double-y-wordmark').forEach(function (el) {
      el.classList.add('double-y-wordmark--settled');
    });
  }

  function startLogoTimer() {
    if (timerStarted) {
      if (settled) settleLogoEffects();
      return;
    }
    timerStarted = true;
    window.setTimeout(settleLogoEffects, EFFECT_MS);
  }

  function ensureContactTip(mark) {
    if (!mark || mark.querySelector('.double-y-contact-tip')) return;
    const tip = document.createElement('span');
    tip.className = 'double-y-contact-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = CONTACT_LABEL;
    mark.appendChild(tip);
  }

  function ensureCompositeMark(mark) {
    if (!mark) return;
    mark.classList.add('double-y-wordmark--mark');
    const existingMark = mark.querySelector('.double-y-logo-mark');
    if (existingMark) {
      existingMark.setAttribute('src', 'DoubleYnew.png');
      existingMark.setAttribute('alt', 'Double Y');
      return;
    }
    mark.querySelectorAll('.double-y-glyph, .double-y-name').forEach(function (node) {
      node.remove();
    });
    const img = document.createElement('img');
    img.src = 'DoubleYnew.png';
    img.alt = 'Double Y';
    img.className = 'double-y-logo-mark';
    const tip = mark.querySelector('.double-y-contact-tip');
    if (tip) {
      mark.insertBefore(img, tip);
    } else {
      mark.appendChild(img);
    }
  }

  function styleAsHeaderBrand(mark) {
    if (!mark) return;
    mark.classList.add('double-y-wordmark--login', 'double-y-wordmark--header', 'double-y-wordmark--mark');
    ensureCompositeMark(mark);
    mark.setAttribute('title', CONTACT_LABEL);
    mark.setAttribute('aria-label', 'Double Y - ' + CONTACT_LABEL);
    mark.dataset.doubleyContact = 'true';
    ensureContactTip(mark);

    if (mark.tagName === 'A') {
      mark.setAttribute('href', 'mailto:' + CONTACT_EMAIL);
      return;
    }

    if (mark.dataset.contactBound === 'true') return;
    mark.dataset.contactBound = 'true';
    mark.setAttribute('role', 'link');
    mark.tabIndex = 0;
    mark.style.cursor = 'pointer';
    mark.addEventListener('click', function (event) {
      event.preventDefault();
      window.location.href = 'mailto:' + CONTACT_EMAIL;
    });
    mark.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = 'mailto:' + CONTACT_EMAIL;
      }
    });
  }

  function injectWordmark(container, position) {
    if (!container || container.querySelector('.double-y-wordmark')) return;
    container.insertAdjacentHTML(position || 'afterbegin', WORDMARK_HTML);
  }

  function ensureHeaderBrandRow() {
    if (isLoginPage()) {
      startLogoTimer();
      return;
    }

    if (document.body?.dataset?.noDoubleYBrand === 'true') {
      startLogoTimer();
      return;
    }

    const statsMarks = document.querySelectorAll('.header-stats-row > .double-y-wordmark');
    if (statsMarks.length) {
      statsMarks.forEach(styleAsHeaderBrand);
      startLogoTimer();
      return;
    }

    const headers = document.querySelectorAll('.header');
    if (!headers.length) {
      const content = document.querySelector('.header-content');
      injectWordmark(content, 'afterbegin');
      startLogoTimer();
      return;
    }

    headers.forEach((header) => {
      const existingLogin = header.querySelector('.double-y-wordmark--login');
      if (existingLogin) {
        styleAsHeaderBrand(existingLogin);
        return;
      }

      let row = header.querySelector('.header-stats-row');
      if (row) {
        const mark = row.querySelector('.double-y-wordmark');
        if (mark) {
          styleAsHeaderBrand(mark);
        } else {
          row.insertAdjacentHTML('afterbegin', WORDMARK_HTML);
          const inserted = row.querySelector('.double-y-wordmark');
          styleAsHeaderBrand(inserted);
        }
        row.style.removeProperty('display');
        row.hidden = false;
        return;
      }

      const headerContent = header.querySelector('.header-content');
      injectWordmark(headerContent || header, 'afterbegin');
      styleAsHeaderBrand((headerContent || header).querySelector('.double-y-wordmark'));
    });

    startLogoTimer();
  }

  function initHeaderBrand() {
    ensureHeaderBrandRow();
    startLogoTimer();
  }

  window.DoubleYLogo = {
    ensureHeaderBrandRow,
    settle: settleLogoEffects
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderBrand);
  } else {
    initHeaderBrand();
  }
})();
