(function () {
  const API_BASE = '/api/warehouse';

  const els = {
    searchBy: document.getElementById('sparSearchBy'),
    searchInput: document.getElementById('sparSearchInput'),
    searchBtn: document.getElementById('sparSearchBtn'),
    clearBtn: document.getElementById('sparClearBtn'),
    closeBtn: document.getElementById('sparCloseBtn'),
    status: document.getElementById('sparStatus'),
    resultsCount: document.getElementById('sparResultsCount'),
    productsBody: document.getElementById('sparProductsBody'),
    viewModal: document.getElementById('sparViewModal'),
    viewBody: document.getElementById('sparViewBody'),
    viewCloseBtn: document.getElementById('sparViewCloseBtn'),
    viewCloseFooterBtn: document.getElementById('sparViewCloseFooterBtn'),
    viewArBtn: document.getElementById('sparViewArBtn'),
    arModal: document.getElementById('productArModal'),
    arCloseBtn: document.getElementById('closeProductArModal'),
    arCloseFooterBtn: document.getElementById('closeProductArFooterBtn'),
    arLaunchBtn: document.getElementById('productArLaunchBtn'),
    arViewer: document.getElementById('productArViewer'),
    arLabel: document.getElementById('productArProductLabel'),
    arStatus: document.getElementById('productArStatus'),
    arPhotoWrap: document.getElementById('productArPhotoWrap'),
    arPhotoImg: document.getElementById('productArPhotoImg')
  };

  let products = [];
  let currentItem = null;
  let productArModelObjectUrl = null;
  let productArPublicModelUrl = null;
  let productArReady = false;

  function escapeHtml(text) {
    if (text == null || text === '') return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCategory(categoria) {
    const normalized = String(categoria || '').trim().toUpperCase();
    if (normalized === 'BATH') return 'Bath';
    if (typeof SectionOptions !== 'undefined') {
      return SectionOptions.formatSectionLabel(categoria);
    }
    return categoria || '-';
  }

  function productHasPhoto(item) {
    if (!item) return false;
    if (item.hasPhoto === true || item.hasPhoto === 't') return true;
    const photo = item.photo != null ? String(item.photo).trim() : '';
    return Boolean(photo) && photo.toLowerCase() !== 'null' && photo.toLowerCase() !== 'undefined';
  }

  function setStatus(message, isError) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.toggle('is-error', Boolean(isError && message));
  }

  function syncSearchMode() {
    const mode = els.searchBy?.value || 'codigo';
    if (!els.searchInput) return;
    els.searchInput.disabled = false;
    if (mode === 'withPhoto') {
      els.searchInput.placeholder = 'Optional — leave blank to list all products with photo';
      return;
    }
    if (mode === 'nome') els.searchInput.placeholder = 'Enter name...';
    else if (mode === 'barcode') els.searchInput.placeholder = 'Enter barcode...';
    else els.searchInput.placeholder = 'Enter code...';
  }

  function renderEmpty(message, icon) {
    if (els.resultsCount) els.resultsCount.textContent = '0';
    if (!els.productsBody) return;
    els.productsBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="4" class="empty-state">
          <i class="fas ${escapeHtml(icon || 'fa-box-open')}"></i>
          <p>${message || 'No products found.'}</p>
        </td>
      </tr>
    `;
  }

  function bindResultActions() {
    if (!els.productsBody || els.productsBody.dataset.actionsBound === 'true') return;
    els.productsBody.dataset.actionsBound = 'true';
    els.productsBody.addEventListener('click', (event) => {
      const button = event.target.closest('.spar-view-btn, .spar-ar-btn');
      if (!button || button.disabled) return;
      const id = button.getAttribute('data-id');
      const item = products.find((row) => String(row.id) === String(id));
      if (!item) return;
      if (button.classList.contains('spar-ar-btn')) {
        void openProductArModal(item);
        return;
      }
      void openViewModal(item);
    });
  }

  function renderProducts(list) {
    products = Array.isArray(list) ? list : [];
    if (els.resultsCount) els.resultsCount.textContent = String(products.length);
    if (!els.productsBody) return;

    if (!products.length) {
      renderEmpty('No products found for this search.', 'fa-box-open');
      return;
    }

    els.productsBody.innerHTML = products.map((item) => {
      const hasPhoto = productHasPhoto(item);
      const arDisabled = hasPhoto ? '' : 'disabled';
      const arClass = hasPhoto ? '' : 'is-disabled';
      const arTitle = hasPhoto
        ? 'Open Augmented Reality'
        : 'AR disabled — this product has no linked photo';
      const code = escapeHtml(item.codigo || '-');
      const name = escapeHtml(item.nome || '-');
      const category = escapeHtml(formatCategory(item.categoria));
      const photoHtml = hasPhoto
        ? '<span class="spar-photo-yes"><i class="fas fa-check"></i> Yes</span>'
        : '<span class="spar-photo-no">No</span>';
      return `
        <tr class="item-data-row" data-id="${escapeHtml(item.id)}">
          <td data-label="Code"><strong>${code}</strong></td>
          <td data-label="Name">${name}</td>
          <td data-label="Category">${category}</td>
          <td data-label="Photo">${photoHtml}</td>
        </tr>
        <tr class="item-actions-row">
          <td colspan="4" class="action-buttons-cell">
            <div class="action-buttons">
              <button type="button" class="btn-action view spar-view-btn" data-id="${escapeHtml(item.id)}" title="View details">
                <i class="fas fa-eye"></i> <span>View</span>
              </button>
              <button type="button" class="btn-action ar spar-ar-btn ${arClass}" data-id="${escapeHtml(item.id)}" ${arDisabled} title="${arTitle}">
                <i class="fas fa-cube"></i> <span>AR</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindResultActions();
  }

  async function searchProducts() {
    const mode = els.searchBy?.value || 'codigo';
    const term = String(els.searchInput?.value || '').trim();

    if (mode !== 'withPhoto' && !term) {
      setStatus('Enter a search term, or choose With Photo to list products with photos.', true);
      return;
    }

    const query = new URLSearchParams();
    if (mode === 'withPhoto') {
      query.set('withPhoto', 'true');
      // Optional term narrows by code; blank lists all products that have a photo.
      if (term) query.set('codigo', term);
    } else if (mode === 'nome') {
      query.set('nome', term);
    } else if (mode === 'barcode') {
      query.set('barcode', term);
    } else {
      query.set('codigo', term);
    }
    query.set('ordenarPor', 'nome');
    query.set('direcao', 'asc');

    if (els.searchBtn) els.searchBtn.disabled = true;
    setStatus('Searching…');

    try {
      const response = await fetch(`${API_BASE}?${query.toString()}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Search failed');
      }
      const list = Array.isArray(data.data) ? data.data : [];
      renderProducts(list);
      setStatus(list.length
        ? `Found ${list.length} product${list.length === 1 ? '' : 's'}.`
        : 'No products found.');
    } catch (error) {
      console.error('Search Product AR failed:', error);
      products = [];
      renderEmpty('Could not load products.');
      setStatus(error.message || 'Search failed.', true);
    } finally {
      if (els.searchBtn) els.searchBtn.disabled = false;
    }
  }

  function clearSearch() {
    if (els.searchBy) els.searchBy.value = 'codigo';
    if (els.searchInput) els.searchInput.value = '';
    syncSearchMode();
    products = [];
    renderEmpty('Use filters and click <strong>Search</strong> to load products.', 'fa-search');
    setStatus('');
    closeViewModal();
    closeProductArModal();
  }

  async function loadProductDetails(item) {
    if (!item?.id) return item;
    try {
      const response = await fetch(`${API_BASE}/${item.id}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.data) {
        return { ...item, ...data.data, hasPhoto: Boolean(data.data.photo || data.data.hasPhoto || item.hasPhoto) };
      }
    } catch (error) {
      console.warn('Could not load product details:', error);
    }
    return item;
  }

  async function openViewModal(item) {
    currentItem = await loadProductDetails(item);
    const hasPhoto = productHasPhoto(currentItem);
    const photoSrc = hasPhoto && currentItem.photo ? String(currentItem.photo) : '';

    if (els.viewBody) {
      els.viewBody.innerHTML = `
        <div class="spar-view-grid">
          <div>
            ${photoSrc
              ? `<img class="spar-view-photo" src="${escapeHtml(photoSrc)}" alt="Product photo">`
              : `<div class="spar-view-photo-empty">No linked photo</div>`}
          </div>
          <div class="spar-view-meta">
            <p><span class="detail-label">Code:</span> ${escapeHtml(currentItem.codigo || '-')}</p>
            <p><span class="detail-label">Name:</span> ${escapeHtml(currentItem.nome || '-')}</p>
            <p><span class="detail-label">Barcode:</span> ${escapeHtml(currentItem.barcode != null ? currentItem.barcode : '-')}</p>
            <p><span class="detail-label">Category:</span> ${escapeHtml(formatCategory(currentItem.categoria))}</p>
            <p><span class="detail-label">Qty Total:</span> ${escapeHtml(currentItem.quantidade ?? 0)}</p>
            <p><span class="detail-label">Photo:</span> ${hasPhoto ? 'Yes' : 'No'}</p>
            ${currentItem.descricao
              ? `<p><span class="detail-label">Description:</span> ${escapeHtml(currentItem.descricao)}</p>`
              : ''}
          </div>
        </div>
      `;
    }

    if (els.viewArBtn) {
      els.viewArBtn.disabled = !hasPhoto;
      els.viewArBtn.classList.toggle('is-disabled', !hasPhoto);
      els.viewArBtn.title = hasPhoto
        ? 'Open Augmented Reality'
        : 'AR disabled — this product has no linked photo';
    }

    if (els.viewModal) {
      els.viewModal.style.display = 'block';
      els.viewModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeViewModal() {
    if (els.viewModal) {
      els.viewModal.style.display = 'none';
      els.viewModal.setAttribute('aria-hidden', 'true');
    }
  }

  function detectArPlatform() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    return { isIOS, isAndroid, isMobile: isIOS || isAndroid };
  }

  function setProductArStatus(message, isError) {
    if (!els.arStatus) return;
    els.arStatus.textContent = message || '';
    els.arStatus.classList.toggle('product-ar-status--error', Boolean(isError && message));
  }

  function revokeProductArModelUrl() {
    if (productArModelObjectUrl) {
      URL.revokeObjectURL(productArModelObjectUrl);
      productArModelObjectUrl = null;
    }
  }

  function setProductArPhotoPreview(photoSrc) {
    if (!els.arPhotoWrap || !els.arPhotoImg) return;
    if (photoSrc) {
      els.arPhotoImg.src = photoSrc;
      els.arPhotoWrap.hidden = false;
    } else {
      els.arPhotoImg.src = '';
      els.arPhotoWrap.hidden = true;
    }
  }

  function setProductArLaunchEnabled(enabled) {
    if (!els.arLaunchBtn) return;
    els.arLaunchBtn.disabled = !enabled;
    els.arLaunchBtn.classList.toggle('is-disabled', !enabled);
  }

  function withTimeout(promise, ms, message) {
    let timer = null;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message || 'Timed out')), ms);
      })
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function waitForModelViewerDefined(timeoutMs = 10000) {
    if (customElements.get('model-viewer')) return Promise.resolve();
    return withTimeout(customElements.whenDefined('model-viewer'), timeoutMs, 'Timed out loading model-viewer');
  }

  function waitForViewerModel(viewer, timeoutMs = 12000) {
    if (!viewer) return Promise.reject(new Error('AR viewer missing'));
    if (viewer.loaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        viewer.removeEventListener('load', onLoad);
        viewer.removeEventListener('error', onError);
        fn(arg);
      };
      const onLoad = () => finish(resolve);
      const onError = () => finish(reject, new Error('Failed to load the AR model'));
      const timer = setTimeout(() => finish(reject, new Error('Timed out loading the AR model')), timeoutMs);
      viewer.addEventListener('load', onLoad, { once: true });
      viewer.addEventListener('error', onError, { once: true });
    });
  }

  function toPublicHttpsModelUrl(urlOrPath, itemId) {
    const origin = window.location.origin;
    const fallback = itemId ? `${origin}/public-ar/${itemId}.glb` : '';
    if (!urlOrPath) return fallback;
    const raw = String(urlOrPath).trim().split('#')[0].split('?')[0];
    if (!raw || raw.startsWith('blob:')) return fallback;
    if (raw.startsWith('/')) return `${origin}${raw}`;
    try {
      const parsed = new URL(raw, origin);
      return `${origin}${parsed.pathname}`;
    } catch (_error) {
      return fallback;
    }
  }

  function queuePrepareArModel(itemId, glbBase64) {
    if (!itemId) return Promise.resolve(null);
    const body = glbBase64 ? { glbBase64 } : {};
    return fetch(`${API_BASE}/${itemId}/prepare-ar-model`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then((res) => res.json().catch(() => null))
      .then((result) => {
        if (result && result.success && result.data) {
          if (result.data.relativeUrl) {
            return toPublicHttpsModelUrl(result.data.relativeUrl, itemId);
          }
          if (result.data.url) {
            return toPublicHttpsModelUrl(result.data.url, itemId);
          }
        }
        return null;
      })
      .catch(() => null);
  }

  async function resolveArModelUrl(item, glbBase64, timeoutMs = 14000) {
    const fallback = toPublicHttpsModelUrl(null, item.id);
    try {
      const cached = await withTimeout(
        queuePrepareArModel(item.id, glbBase64),
        timeoutMs,
        'Timed out preparing AR model'
      );
      if (cached && String(cached).startsWith('http')) return cached;
    } catch (error) {
      console.warn('AR model prepare warning:', error);
    }
    return fallback;
  }

  function configureArModes(viewer, platform) {
    if (!viewer) return;
    // Android: WebXR only so AR stays in Chrome (Scene Viewer leaves/reloads the page).
    // iPhone: Quick Look (system viewer).
    if (platform.isIOS) {
      viewer.setAttribute('ar-modes', 'quick-look');
    } else {
      viewer.setAttribute('ar-modes', 'webxr');
    }
  }

  function launchProductAr() {
    const viewer = els.arViewer;
    if (!viewer) return;

    const platform = detectArPlatform();
    if (!platform.isMobile) {
      setProductArStatus(
        'Use an iPhone (Safari) or Android phone (Chrome) to open AR.',
        true
      );
      return;
    }

    if (!productArReady) {
      setProductArStatus('AR model is still loading. Wait a moment and tap again.', true);
      return;
    }

    if (String(window.location.protocol).toLowerCase() !== 'https:') {
      setProductArStatus('AR needs HTTPS. Open the deployed site on your phone.', true);
      return;
    }

    try {
      // Modes are set when the modal opens — do not change them here (async reselect breaks activateAR).
      if (platform.isIOS) {
        setProductArStatus('Opening AR… On iPhone this uses Quick Look.');
      } else {
        setProductArStatus('Opening AR in Chrome… Point the camera at the floor.');
      }

      if (typeof viewer.activateAR !== 'function') {
        setProductArStatus('AR is not available in this browser. Use Chrome (Android) or Safari (iPhone).', true);
        return;
      }

      const maybePromise = viewer.activateAR();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((error) => {
          console.error('activateAR failed:', error);
          setProductArStatus(
            (error && error.message ? `${error.message} ` : '') +
            'Could not start AR. On Android use Chrome with ARCore; on iPhone use Safari.',
            true
          );
        });
      }
    } catch (error) {
      console.error('AR launch error:', error);
      setProductArStatus(
        error && error.message
          ? error.message
          : 'Could not start AR. Check camera permission.',
        true
      );
    }
  }

  async function openProductArModal(item) {
    let nextItem = await loadProductDetails(item);
    if (!productHasPhoto(nextItem)) {
      setStatus('AR is disabled for products without a linked photo.', true);
      return;
    }
    currentItem = nextItem;

    if (!els.arModal || !els.arViewer) return;

    productArReady = false;
    productArPublicModelUrl = null;
    setProductArLaunchEnabled(false);
    setProductArStatus('Preparing AR model…');
    els.arModal.style.display = 'block';
    els.arModal.setAttribute('aria-hidden', 'false');

    try {
      const code = currentItem.codigo || '-';
      const name = currentItem.nome || '-';
      if (els.arLabel) els.arLabel.textContent = `${code} — ${name}`;

      const photoSrc = String(currentItem.photo || '').trim();
      setProductArPhotoPreview(photoSrc);
      revokeProductArModelUrl();

      els.arViewer.setAttribute('alt', `Product photo AR model for ${name}`);
      if (photoSrc) els.arViewer.setAttribute('poster', photoSrc);
      else els.arViewer.removeAttribute('poster');

      productArPublicModelUrl = `${window.location.origin}/public-ar/${currentItem.id}.glb`;
      configureArModes(els.arViewer, detectArPlatform());
      els.arViewer.removeAttribute('ios-src');

      let previewUrl = '/models/product-box.glb';
      let glbBase64 = null;
      if (photoSrc && window.WarehouseProductArGlb && typeof window.WarehouseProductArGlb.createProductPhotoGlbAssets === 'function') {
        setProductArStatus('Building photo model…');
        const assets = await withTimeout(
          window.WarehouseProductArGlb.createProductPhotoGlbAssets(photoSrc, {
            maxSideMeters: 0.42,
            depthMeters: 0.012,
            maxImageEdge: 512,
            cutout: true,
            removeBackground: true
          }),
          12000,
          'Timed out building the photo model'
        ).catch((error) => {
          console.warn('Client AR GLB build failed:', error);
          return null;
        });
        if (assets && assets.base64) glbBase64 = assets.base64;
      }

      setProductArStatus('Preparing AR for photo capture…');
      previewUrl = toPublicHttpsModelUrl(
        await resolveArModelUrl(currentItem, glbBase64),
        currentItem.id
      );
      productArPublicModelUrl = previewUrl;
      els.arViewer.src = previewUrl;

      await waitForModelViewerDefined(10000);
      try {
        await waitForViewerModel(els.arViewer, 12000);
      } catch (loadError) {
        console.warn('AR viewer load warning:', loadError);
      }

      productArReady = true;
      setProductArLaunchEnabled(true);

      const platform = detectArPlatform();
      if (!previewUrl || previewUrl.endsWith('/models/product-box.glb')) {
        setProductArStatus('Could not embed the photo quickly. Using default model — tap Open Camera AR.', true);
      } else if (platform.isIOS) {
        setProductArStatus('Ready. Tap View in your space / Open Camera AR (Quick Look).');
      } else if (platform.isAndroid) {
        setProductArStatus('Ready. Tap View in your space / Open Camera AR (stays in Chrome when WebXR is available).');
      } else {
        setProductArStatus('Product photo preview ready. Use an Android/iPhone to place it in AR.');
      }
    } catch (error) {
      console.error('AR prepare error:', error);
      const fallbackUrl = `${window.location.origin}/models/product-box.glb`;
      els.arViewer.src = fallbackUrl;
      productArPublicModelUrl = fallbackUrl;
      productArReady = true;
      setProductArLaunchEnabled(true);
      setProductArStatus(
        (error && error.message ? `${error.message} ` : '') +
        'Using default model. Tap Open Camera AR to try anyway.',
        true
      );
    }
  }

  function closeProductArModal() {
    if (els.arViewer) {
      els.arViewer.src = '/models/product-box.glb';
      els.arViewer.removeAttribute('poster');
    }
    revokeProductArModelUrl();
    productArReady = false;
    productArPublicModelUrl = null;
    setProductArLaunchEnabled(false);
    setProductArStatus('');
    setProductArPhotoPreview('');
    if (els.arModal) {
      els.arModal.style.display = 'none';
      els.arModal.setAttribute('aria-hidden', 'true');
    }
  }

  function bindEvents() {
    els.searchBy?.addEventListener('change', syncSearchMode);
    els.searchBtn?.addEventListener('click', () => { void searchProducts(); });
    els.clearBtn?.addEventListener('click', clearSearch);
    els.closeBtn?.addEventListener('click', () => {
      window.location.href = 'warehouse.html';
    });
    els.searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void searchProducts();
      }
    });

    els.viewCloseBtn?.addEventListener('click', closeViewModal);
    els.viewCloseFooterBtn?.addEventListener('click', closeViewModal);
    els.viewArBtn?.addEventListener('click', () => {
      if (!els.viewArBtn || els.viewArBtn.disabled || !currentItem) return;
      void openProductArModal(currentItem);
    });
    els.viewModal?.addEventListener('click', (event) => {
      if (event.target === els.viewModal) closeViewModal();
    });

    els.arCloseBtn?.addEventListener('click', closeProductArModal);
    els.arCloseFooterBtn?.addEventListener('click', closeProductArModal);
    els.arLaunchBtn?.addEventListener('click', () => { launchProductAr(); });
    // Single handler: AR button launches in-place; backdrop click closes.
    // stopPropagation avoids model-viewer also firing an intent that reloads/leaves the page.
    els.arModal?.addEventListener('click', (event) => {
      const nativeArBtn = event.target.closest('.product-ar-native-btn');
      if (nativeArBtn) {
        event.preventDefault();
        event.stopPropagation();
        launchProductAr();
        return;
      }
      if (event.target === els.arModal) closeProductArModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (els.arModal && els.arModal.style.display === 'block') {
        closeProductArModal();
        return;
      }
      if (els.viewModal && els.viewModal.style.display === 'block') {
        closeViewModal();
      }
    });

    if (window.DoubleYHeaderStats && typeof window.DoubleYHeaderStats.applyToDom === 'function') {
      window.DoubleYHeaderStats.applyToDom();
    }
  }

  syncSearchMode();
  renderEmpty('Use filters and click <strong>Search</strong> to load products.', 'fa-search');
  bindResultActions();
  bindEvents();
})();
