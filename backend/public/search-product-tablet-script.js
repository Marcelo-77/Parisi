(function () {
  const API_WAREHOUSE = '/api/warehouse';
  const API_LOCATION_PRODUCT = '/api/location-product';

  const els = {
    searchByField: document.getElementById('searchByField'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    status: document.getElementById('sptStatus'),
    resultsCount: document.getElementById('resultsCount'),
    productsBody: document.getElementById('productsBody'),
    locationsBody: document.getElementById('locationsBody'),
    selectedProductLabel: document.getElementById('selectedProductLabel'),
    totalItems: document.getElementById('totalItems'),
    lowStockItems: document.getElementById('lowStockItems'),
    totalEntradas: document.getElementById('totalEntradas'),
    totalSaidas: document.getElementById('totalSaidas')
  };

  let products = [];
  let selectedCode = '';

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
          <td>${escapeHtml(qty)}</td>
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
          <td>${escapeHtml(quantityCurrent)}</td>
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
    const searchBy = els.searchByField?.value === 'nome' ? 'nome' : 'codigo';

    if (!term) {
      setStatus('Enter a code or name to search.', true);
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
        return;
      }

      setStatus(`${list.length} products found. Select one to view locations.`);
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
    loadLocationsForProduct(product);
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
    els.productsBody?.addEventListener('click', onProductsClick);
    els.productsBody?.addEventListener('keydown', onProductsKeydown);
  }

  bindEvents();
  loadStatistics();
  els.searchInput?.focus();
})();
