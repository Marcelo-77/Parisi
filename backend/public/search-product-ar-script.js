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
          if (result.data.url) return result.data.url;
          if (result.data.relativeUrl) return `${window.location.origin}${result.data.relativeUrl}`;
        }
        return null;
      })
      .catch(() => null);
  }

  async function resolveArModelUrl(item, glbBase64, timeoutMs = 14000) {
    const fallback = `${window.location.origin}/public-ar/${item.id}.glb`;
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

  function launchSceneViewerIntent(modelUrl, title) {
    const cleanUrl = String(modelUrl || '').split('#')[0].split('?')[0];
    const fallback = window.location.href;
    const params = new URLSearchParams({
      file: cleanUrl,
      mode: 'ar_preferred',
      title: String(title || 'Product AR').slice(0, 80)
    });
    const intent =
      `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}` +
      `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
    const anchor = document.createElement('a');
    anchor.href = intent;
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function launchProductAr() {
    if (!productArReady || !els.arViewer) return;
    const platform = detectArPlatform();
    const title = currentItem ? `${currentItem.codigo || ''} ${currentItem.nome || ''}`.trim() : 'Product AR';
    try {
      if (platform.isAndroid && productArPublicModelUrl) {
        launchSceneViewerIntent(productArPublicModelUrl, title);
        return;
      }
      if (typeof els.arViewer.activateAR === 'function') {
        await els.arViewer.activateAR();
        return;
      }
      const nativeBtn = document.querySelector('.product-ar-native-btn');
      if (nativeBtn) nativeBtn.click();
    } catch (error) {
      console.error('Launch AR failed:', error);
      setProductArStatus(error.message || 'Could not open camera AR.', true);
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
      els.arViewer.setAttribute('ar-modes', 'scene-viewer quick-look webxr');
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
      previewUrl = await resolveArModelUrl(currentItem, glbBase64);
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
      if (previewUrl === '/models/product-box.glb') {
        setProductArStatus('Could not embed the photo quickly. Using default model — tap Open Camera AR.', true);
      } else if (platform.isIOS) {
        setProductArStatus('Ready. Tap Open Camera AR — then use the shutter button in Quick Look to save a photo.');
      } else if (platform.isAndroid) {
        setProductArStatus('Ready. Tap Open Camera AR — then use the camera icon in Scene Viewer to take a photo or video.');
      } else {
        setProductArStatus('Product photo preview ready. Use an Android/iPhone to place it in AR.');
      }
    } catch (error) {
      console.error('AR prepare error:', error);
      els.arViewer.src = '/models/product-box.glb';
      productArPublicModelUrl = `${window.location.origin}/models/product-box.glb`;
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
    els.arLaunchBtn?.addEventListener('click', () => { void launchProductAr(); });
    els.arModal?.addEventListener('click', (event) => {
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
