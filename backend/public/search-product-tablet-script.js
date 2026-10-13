(function () {
  const API_WAREHOUSE = '/api/warehouse';
  const API_LOCATION_PRODUCT = '/api/location-product';

  const els = {
    panel: document.getElementById('sptPanel'),
    searchBar: document.getElementById('sptSearchBar'),
    searchByField: document.getElementById('searchByField'),
    searchByRadios: Array.from(document.querySelectorAll('input[name="searchByFieldRadio"]')),
    exactCodeCheckbox: document.getElementById('exactCodeCheckbox'),
    exactCodeLabel: document.querySelector('label.spt-exact-code'),
    searchHelpBtn: document.getElementById('sptSearchHelpBtn'),
    searchHelpPanel: document.getElementById('sptSearchHelpPanel'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    status: document.getElementById('sptStatus'),
    resultsCount: document.getElementById('resultsCount'),
    productsBody: document.getElementById('productsBody'),
    locationsCard: document.getElementById('locationsCard'),
    locationsBody: document.getElementById('locationsBody'),
    selectedProductLabel: document.getElementById('selectedProductLabel'),
    totalItems: document.getElementById('totalItems'),
    lowStockItems: document.getElementById('lowStockItems'),
    totalEntradas: document.getElementById('totalEntradas'),
    totalSaidas: document.getElementById('totalSaidas')
  };

  let exactCodePreference = true;

  function getSearchBy() {
    const checked = els.searchByRadios.find((radio) => radio.checked);
    const value = checked?.value || els.searchByField?.value || 'codigo';
    return value === 'nome' ? 'nome' : 'codigo';
  }

  function isExactCodeEnabled() {
    return getSearchBy() === 'codigo' && !!els.exactCodeCheckbox?.checked;
  }

  function syncExactCodeCheckbox(searchBy) {
    if (!els.exactCodeCheckbox) return;
    if (searchBy === 'nome') {
      if (!els.exactCodeCheckbox.disabled && els.exactCodeLabel?.style.display !== 'none') {
        exactCodePreference = els.exactCodeCheckbox.checked;
      }
      els.exactCodeCheckbox.checked = false;
      els.exactCodeCheckbox.disabled = true;
      if (els.exactCodeLabel) els.exactCodeLabel.hidden = true;
      return;
    }
    els.exactCodeCheckbox.disabled = false;
    els.exactCodeCheckbox.checked = exactCodePreference !== false;
    if (els.exactCodeLabel) els.exactCodeLabel.hidden = false;
  }

  function syncSearchByField(value, options = {}) {
    const { clearInput = false } = options;
    const previous = els.searchByField?.value === 'nome' ? 'nome' : 'codigo';
    const next = value === 'nome' ? 'nome' : 'codigo';
    if (els.searchByField) els.searchByField.value = next;
    els.searchByRadios.forEach((radio) => {
      radio.checked = radio.value === next;
    });
    syncExactCodeCheckbox(next);
    if (els.searchInput) {
      if (clearInput && previous !== next) {
        els.searchInput.value = '';
      }
      els.searchInput.placeholder = next === 'nome'
        ? 'Enter name...'
        : (isExactCodeEnabled() ? 'Enter exact code...' : 'Enter code...');
    }
  }

  let products = [];
  let selectedCode = '';

  function isTabletOrPhone() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 1024px)').matches;
    const touch = (navigator.maxTouchPoints || 0) > 0;
    return coarse || touch || narrow;
  }

  function focusFullScreen(options = {}) {
    const { focusInput = false, scrollTarget = null } = options;
    const run = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      const target = scrollTarget || els.panel || document.body;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
      if (focusInput && els.searchInput) {
        try {
          els.searchInput.focus({ preventScroll: true });
        } catch (_) {
          els.searchInput.focus();
        }
      } else if (els.panel) {
        try {
          els.panel.focus({ preventScroll: true });
        } catch (_) {
          els.panel.focus();
        }
      }
    };
    requestAnimationFrame(() => {
      run();
      // Second pass helps iOS/Android after layout + keyboard chrome settle.
      setTimeout(run, 120);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(message, isError) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.toggle('is-error', Boolean(isError));
  }

  function setLocationsEmpty(message) {
    if (!els.locationsBody) return;
    els.locationsBody.innerHTML = `
      <tr class="spt-empty-row">
        <td colspan="3">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function setProductsEmpty(message) {
    if (!els.productsBody) return;
    els.productsBody.innerHTML = `
      <tr class="spt-empty-row">
        <td colspan="3">${escapeHtml(message)}</td>
      </tr>
    `;
    if (els.resultsCount) els.resultsCount.textContent = '0';
  }

  function renderProducts(list) {
    products = Array.isArray(list) ? list : [];
    if (els.resultsCount) els.resultsCount.textContent = String(products.length);

    if (!products.length) {
      setProductsEmpty('No products found.');
      selectedCode = '';
      if (els.selectedProductLabel) els.selectedProductLabel.textContent = '';
      setLocationsEmpty('Select a product to view locations.');
      return;
    }

    els.productsBody.innerHTML = products.map((item) => {
      const code = String(item.codigo || '').trim();
      const name = String(item.nome || '').trim();
      const qty = item.quantidade != null ? item.quantidade : 0;
      const selected = code && code === selectedCode ? ' is-selected' : '';
      return `
        <tr data-code="${escapeHtml(code)}" class="${selected.trim()}" tabindex="0" role="button" aria-label="Select product ${escapeHtml(code)}">
          <td>${escapeHtml(code || '-')}</td>
          <td>${escapeHtml(name || '-')}</td>
          <td class="spt-col-qty">${escapeHtml(qty)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderLocations(list, product) {
    const code = product?.codigo || selectedCode || '';
    const name = product?.nome || '';
    if (els.selectedProductLabel) {
      els.selectedProductLabel.textContent = code
        ? `${code}${name ? ` — ${name}` : ''}`
        : '';
    }

    if (!Array.isArray(list) || !list.length) {
      setLocationsEmpty('No locations (situation Full, status A) for this product.');
      return;
    }

    els.locationsBody.innerHTML = list.map((row) => {
      const locationCode = row.locationCode != null ? row.locationCode : row.location_code;
      const accessType = row.accessType != null ? row.accessType : (row.access_type ?? '');
      const quantityCurrent = row.quantityCurrent != null ? row.quantityCurrent : (row.quantity_current ?? 0);
      return `
        <tr>
          <td>${escapeHtml(locationCode || '-')}</td>
          <td>${escapeHtml(accessType || '-')}</td>
          <td class="spt-col-qty">${escapeHtml(quantityCurrent)}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadLocationsForProduct(product) {
    const code = String(product?.codigo || '').trim();
    selectedCode = code;
    renderProducts(products);

    if (!code) {
      setLocationsEmpty('Select a product to view locations.');
      return;
    }

    setLocationsEmpty('Loading locations…');
    try {
      const res = await fetch(`${API_LOCATION_PRODUCT}/by-product-full/${encodeURIComponent(code)}`, {
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `Unable to load locations (${res.status})`);
      }
      renderLocations(data.data || [], product);
    } catch (error) {
      console.error(error);
      setLocationsEmpty(error.message || 'Error loading locations.');
      setStatus(error.message || 'Error loading locations.', true);
    }
  }

  async function searchProducts() {
    const term = String(els.searchInput?.value || '').trim();
    const searchBy = getSearchBy();

    if (!term) {
      setStatus(searchBy === 'nome' ? 'Enter a name to search.' : 'Enter a code to search.', true);
      els.searchInput?.focus();
      return;
    }

    if (els.searchBtn) els.searchBtn.disabled = true;
    setStatus('Searching…');
    selectedCode = '';
    if (els.selectedProductLabel) els.selectedProductLabel.textContent = '';
    setLocationsEmpty('Select a product to view locations.');

    try {
      const params = new URLSearchParams();
      params.set(searchBy, term);
      if (searchBy === 'codigo' && isExactCodeEnabled()) {
        params.set('codigoExact', 'true');
      }
      params.set('ordenarPor', searchBy === 'nome' ? 'nome' : 'codigo');
      params.set('direcao', 'asc');

      const res = await fetch(`${API_WAREHOUSE}?${params.toString()}`, {
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `Search failed (${res.status})`);
      }

      const list = Array.isArray(data.data) ? data.data : [];
      renderProducts(list);

      if (!list.length) {
        setStatus('No products found.');
        return;
      }

      if (list.length === 1) {
        setStatus('1 product found. Showing locations.');
        await loadLocationsForProduct(list[0]);
        if (isTabletOrPhone()) {
          focusFullScreen({ scrollTarget: els.locationsCard || els.panel });
        }
        return;
      }

      setStatus(`${list.length} products found. Select one to view locations.`);
      if (isTabletOrPhone()) {
        focusFullScreen({ scrollTarget: els.panel });
      }
    } catch (error) {
      console.error(error);
      products = [];
      setProductsEmpty('Search failed.');
      setStatus(error.message || 'Search failed.', true);
    } finally {
      if (els.searchBtn) els.searchBtn.disabled = false;
    }
  }

  async function loadStatistics() {
    try {
      const res = await fetch(`${API_WAREHOUSE}/estatisticas`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.data) return;
      const d = data.data;
      if (els.totalItems) els.totalItems.textContent = d.total ?? 0;
      if (els.lowStockItems) els.lowStockItems.textContent = (d.estoqueBaixo ?? 0) + (d.esgotado ?? 0);
      if (els.totalEntradas) els.totalEntradas.textContent = d.entradas ?? 0;
      if (els.totalSaidas) els.totalSaidas.textContent = d.saidas ?? 0;
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  function onProductsClick(event) {
    const row = event.target.closest('tr[data-code]');
    if (!row || !els.productsBody.contains(row)) return;
    const code = row.getAttribute('data-code') || '';
    const product = products.find((item) => String(item.codigo || '').trim() === code);
    if (!product) return;
    loadLocationsForProduct(product).then(() => {
      if (isTabletOrPhone()) {
        focusFullScreen({ scrollTarget: els.locationsCard || els.panel });
      }
    });
  }

  function onProductsKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('tr[data-code]');
    if (!row || !els.productsBody.contains(row)) return;
    event.preventDefault();
    row.click();
  }

  function bindEvents() {
    els.searchBtn?.addEventListener('click', searchProducts);
    els.searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchProducts();
      }
    });
    els.searchByRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        syncSearchByField(radio.value, { clearInput: true });
        els.searchInput?.focus();
      });
    });
    els.exactCodeCheckbox?.addEventListener('change', () => {
      if (els.exactCodeCheckbox.disabled || els.exactCodeLabel?.hidden) return;
      exactCodePreference = els.exactCodeCheckbox.checked;
      if (els.searchInput && getSearchBy() === 'codigo') {
        els.searchInput.placeholder = isExactCodeEnabled()
          ? 'Enter exact code...'
          : 'Enter code...';
      }
    });
    els.searchHelpBtn?.addEventListener('click', () => {
      if (!els.searchHelpPanel) return;
      const open = els.searchHelpPanel.hasAttribute('hidden');
      if (open) {
        els.searchHelpPanel.removeAttribute('hidden');
      } else {
        els.searchHelpPanel.setAttribute('hidden', '');
      }
      els.searchHelpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    els.productsBody?.addEventListener('click', onProductsClick);
    els.productsBody?.addEventListener('keydown', onProductsKeydown);
  }

  bindEvents();
  syncSearchByField(getSearchBy());
  loadStatistics();

  if (isTabletOrPhone()) {
    focusFullScreen({ focusInput: true, scrollTarget: els.panel });
    window.addEventListener('pageshow', () => {
      focusFullScreen({ focusInput: true, scrollTarget: els.panel });
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => focusFullScreen({ scrollTarget: els.panel }), 200);
    });
  } else {
    try {
      els.searchInput?.focus({ preventScroll: true });
    } catch (_) {
      els.searchInput?.focus();
    }
  }
})();
