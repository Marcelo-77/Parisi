(function (window) {
  function getInitials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  }

  function hasValidImage(imageSrc) {
    const value = String(imageSrc || '').trim();
    return value.length > 0 && value !== 'null' && value !== 'undefined';
  }

  function companyLogoSrc(companyId, logo) {
    if (hasValidImage(logo)) return String(logo).trim();
    if (companyId) return `/api/companies/${encodeURIComponent(companyId)}/logo`;
    return null;
  }

  function userPhotoSrc(userId, photo) {
    if (hasValidImage(photo)) return String(photo).trim();
    if (userId && String(userId) !== 'root') {
      return `/api/funcionarios/${encodeURIComponent(userId)}/photo`;
    }
    return null;
  }

  function hideBrandImage(wrap, img, initialsEl) {
    if (!wrap) return;
    wrap.hidden = true;
    wrap.setAttribute('aria-hidden', 'true');
    if (img) {
      img.onerror = null;
      img.onload = null;
      img.removeAttribute('src');
      img.hidden = true;
    }
    if (initialsEl) {
      initialsEl.textContent = '';
      initialsEl.hidden = true;
    }
  }

  function showBrandInitials(img, initialsEl, label) {
    if (img) {
      img.hidden = true;
      img.removeAttribute('src');
      img.onerror = null;
    }
    if (initialsEl) {
      initialsEl.textContent = getInitials(label);
      initialsEl.hidden = false;
    }
  }

  function setBrandImage(wrap, img, initialsEl, imageSrc, label) {
    if (!wrap) return;

    const displayLabel = String(label || '').trim();
    const validImage = hasValidImage(imageSrc);

    if (!validImage && !displayLabel) {
      hideBrandImage(wrap, img, initialsEl);
      return;
    }

    wrap.hidden = false;
    wrap.setAttribute('aria-hidden', 'false');

    if (validImage && img) {
      img.onerror = () => showBrandInitials(img, initialsEl, displayLabel);
      img.onload = () => {
        img.onerror = null;
      };
      img.src = imageSrc;
      img.alt = displayLabel ? `Logo of ${displayLabel}` : 'Company logo';
      img.hidden = false;
      if (initialsEl) initialsEl.hidden = true;
    } else {
      showBrandInitials(img, initialsEl, displayLabel);
    }
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBrandImageMarkup(imageSrc, label, sizeClass, options = {}) {
    const kind = options.kind || 'logo';
    const displayLabel = String(label || '').trim();
    const validImage = hasValidImage(imageSrc);
    const size = sizeClass || 'brand-image--table';
    const kindClass = kind === 'user' ? 'brand-image--user' : '';
    const classes = ['brand-image', size, kindClass].filter(Boolean).join(' ');
    const initials = escapeHtml(getInitials(displayLabel));
    const altPrefix = kind === 'user' ? 'Photo of' : 'Logo of';
    const fallbackAlt = kind === 'user' ? 'User photo' : 'Company logo';

    if (validImage) {
      const safeSrc = escapeHtml(imageSrc);
      const safeAlt = escapeHtml(displayLabel ? `${altPrefix} ${displayLabel}` : fallbackAlt);
      return `<div class="brand-image-wrap ${classes}" aria-hidden="false">
        <img class="brand-image-img" src="${safeSrc}" alt="${safeAlt}">
        <div class="brand-image-initials" hidden>${initials}</div>
      </div>`;
    }

    if (!displayLabel) {
      return '—';
    }

    return `<div class="brand-image-wrap ${classes}" aria-hidden="false">
      <img class="brand-image-img" alt="" hidden>
      <div class="brand-image-initials">${initials}</div>
    </div>`;
  }

  function renderUserImageMarkup(imageSrc, name, sizeClass) {
    return renderBrandImageMarkup(imageSrc, name, sizeClass, { kind: 'user' });
  }

  function closePhotoZoom() {
    const overlay = document.getElementById('doubleYPhotoZoom');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('dy-photo-zoom-open');
    const img = overlay.querySelector('.dy-photo-zoom-img');
    if (img) {
      img.removeAttribute('src');
      img.alt = '';
    }
  }

  function ensurePhotoZoomStyles() {
    if (document.getElementById('doubleYPhotoZoomStyle')) return;
    const style = document.createElement('style');
    style.id = 'doubleYPhotoZoomStyle';
    style.textContent = `
      .dy-photo-zoom-trigger{cursor:zoom-in}
      .dy-photo-zoom{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,16,32,.78);backdrop-filter:blur(4px)}
      .dy-photo-zoom[hidden]{display:none!important}
      .dy-photo-zoom-img{display:block;max-width:min(92vw,560px);max-height:min(86vh,560px);width:auto;height:auto;object-fit:contain;border-radius:18px;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dyPhotoZoomIn .18s ease-out}
      .dy-photo-zoom-close{position:absolute;top:16px;right:16px;width:44px;height:44px;border:0;border-radius:999px;background:rgba(255,255,255,.92);color:#10233f;font-size:1.6rem;line-height:1;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.2)}
      .dy-photo-zoom-close:hover{background:#fff}
      body.dy-photo-zoom-open{overflow:hidden}
      @keyframes dyPhotoZoomIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    `;
    document.head.appendChild(style);
  }

  function openPhotoZoom(src, alt) {
    if (!hasValidImage(src)) return;
    ensurePhotoZoomStyles();

    let overlay = document.getElementById('doubleYPhotoZoom');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'doubleYPhotoZoom';
      overlay.className = 'dy-photo-zoom';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Photo preview');
      overlay.innerHTML = `
        <button type="button" class="dy-photo-zoom-close" aria-label="Close">&times;</button>
        <img class="dy-photo-zoom-img" alt="">
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay || event.target.classList.contains('dy-photo-zoom-close')) {
          closePhotoZoom();
        }
      });
      if (!window.__doubleyPhotoZoomEscBound) {
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') closePhotoZoom();
        });
        window.__doubleyPhotoZoomEscBound = true;
      }
    }

    const img = overlay.querySelector('.dy-photo-zoom-img');
    if (img) {
      img.src = String(src).trim();
      img.alt = String(alt || 'User photo');
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dy-photo-zoom-open');
  }

  function bindPhotoZoom(root, options = {}) {
    if (!root) return;
    const img = root.matches?.('img')
      ? root
      : root.querySelector('img.brand-image-img, img');
    if (!img) return;

    const resolveSrc = () => {
      if (img.hidden) return '';
      return String(img.currentSrc || img.getAttribute('src') || '').trim();
    };
    if (!hasValidImage(resolveSrc()) && !options.allowMissing) return;

    root.classList.add('dy-photo-zoom-trigger');
    root.style.cursor = 'zoom-in';
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
    if (!root.getAttribute('role')) root.setAttribute('role', 'button');
    if (!root.getAttribute('aria-label')) {
      root.setAttribute('aria-label', options.label || 'View photo larger');
    }

    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const src = resolveSrc();
      if (!hasValidImage(src)) return;
      openPhotoZoom(src, img.alt || options.label || 'User photo');
    };

    root.onclick = open;
    root.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(event);
      }
    };
  }

  window.BrandImage = {
    getInitials,
    hasValidImage,
    companyLogoSrc,
    userPhotoSrc,
    setBrandImage,
    hideBrandImage,
    renderBrandImageMarkup,
    renderUserImageMarkup,
    openPhotoZoom,
    closePhotoZoom,
    bindPhotoZoom
  };
})(window);
