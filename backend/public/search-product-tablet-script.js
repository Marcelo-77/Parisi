(function () {
  const API_WAREHOUSE = '/api/warehouse';
  const API_LOCATION_PRODUCT = '/api/location-product';
  const API_FORKLIFT_DRIVERS = '/api/forklift-drivers';
  const API_MESSAGE_REQUEST = '/api/message-request';

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
    locationsHint: document.getElementById('sptLocationsHint'),
    selectedProductLabel: document.getElementById('selectedProductLabel'),
    totalItems: document.getElementById('totalItems'),
    lowStockItems: document.getElementById('lowStockItems'),
    totalEntradas: document.getElementById('totalEntradas'),
    totalSaidas: document.getElementById('totalSaidas'),
    forkliftRequestModal: document.getElementById('sptForkliftRequestModal'),
    forkliftConfirmModal: document.getElementById('sptForkliftConfirmModal'),
    forkliftRequestForm: document.getElementById('sptForkliftRequestForm'),
    forkliftDriverSelect: document.getElementById('sptForkliftDriver'),
    forkliftMessageType: document.getElementById('sptForkliftMessageType'),
    forkliftDriverContact: document.getElementById('sptForkliftDriverContact'),
    forkliftConfirmText: document.getElementById('sptForkliftConfirmText'),
    forkliftConfirmSendBtn: document.getElementById('sptConfirmForkliftSendBtn')
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
  let selectedProduct = null;
  let lastLocations = [];
  let forkliftUseEnabled = false;
  let forkliftDrivers = [];
  let forkliftPreferredMessageType = 'SMS';
  let forkliftDriversLoadedAt = 0;
  let forkliftDriversLoading = null;
  let requesterLoading = null;
  let pendingForkliftPayload = null;
  let cachedRequesterName = null;
  let forkliftContext = null;
  const FORKLIFT_CACHE_TTL_MS = 90 * 1000;

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
        <td colspan="4">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function setProductsEmpty(message) {
    if (!els.productsBody) return;
    els.productsBody.innerHTML = `
      <tr class="spt-empty-row">
        <td colspan="4">${escapeHtml(message)}</td>
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
      const category = String(item.categoria || '').trim();
      const qty = item.quantidade != null ? item.quantidade : 0;
      const selected = code && code === selectedCode ? ' is-selected' : '';
      return `
        <tr data-code="${escapeHtml(code)}" class="${selected.trim()}" tabindex="0" role="button" aria-label="Select product ${escapeHtml(code)}">
          <td class="spt-col-code">${escapeHtml(code || '-')}</td>
          <td class="spt-col-name">${escapeHtml(name || '-')}</td>
          <td class="spt-col-category">${escapeHtml(category || '-')}</td>
          <td class="spt-col-qty">${escapeHtml(qty)}</td>
        </tr>
      `;
    }).join('');
  }

  function syncLocationsHint() {
    if (!els.locationsHint) return;
    els.locationsHint.textContent = forkliftUseEnabled
      ? 'Locations with situation Full and active status (A). Tap a Location Code to request a forklift driver.'
      : 'Locations with situation Full and active status (A).';
  }

  function renderLocations(list, product) {
    selectedProduct = product || selectedProduct;
    const code = product?.codigo || selectedCode || '';
    const name = product?.nome || '';
    if (els.selectedProductLabel) {
      els.selectedProductLabel.textContent = code
        ? `${code}${name ? ` — ${name}` : ''}`
        : '';
    }
    syncLocationsHint();

    if (!Array.isArray(list) || !list.length) {
      lastLocations = [];
      setLocationsEmpty('No locations (situation Full, status A) for this product.');
      return;
    }

    lastLocations = list.slice();
    els.locationsBody.innerHTML = list.map((row) => {
      const locationCode = String(row.locationCode != null ? row.locationCode : row.location_code || '').trim();
      const accessType = row.accessType != null ? row.accessType : (row.access_type ?? '');
      const section = row.section != null ? row.section : '';
      const quantityCurrent = row.quantityCurrent != null ? row.quantityCurrent : (row.quantity_current ?? 0);
      const locCell = forkliftUseEnabled && locationCode
        ? `<button type="button" class="spt-location-link" data-location="${escapeHtml(locationCode)}" data-section="${escapeHtml(section || '')}" title="Request forklift for ${escapeHtml(locationCode)}"><i class="fas fa-truck" aria-hidden="true"></i><span>${escapeHtml(locationCode)}</span></button>`
        : escapeHtml(locationCode || '-');
      return `
        <tr>
          <td class="spt-col-loc">${locCell}</td>
          <td class="spt-col-access">${escapeHtml(accessType || '-')}</td>
          <td class="spt-col-section">${escapeHtml(section || '-')}</td>
          <td class="spt-col-qty">${escapeHtml(quantityCurrent)}</td>
        </tr>
      `;
    }).join('');
  }

  function prepareSearchInputForNextEntry() {
    if (!els.searchInput) return;
    els.searchInput.value = '';
  }

  async function loadForkliftSettings(options = {}) {
    const { force = false, refreshLocations = true } = options;
    const fresh = !force
      && forkliftDriversLoadedAt
      && (Date.now() - forkliftDriversLoadedAt) < FORKLIFT_CACHE_TTL_MS;
    if (fresh) return;
    if (forkliftDriversLoading) return forkliftDriversLoading;

    forkliftDriversLoading = (async () => {
      try {
        const res = await fetch(`${API_FORKLIFT_DRIVERS}/assigned`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          forkliftUseEnabled = false;
          forkliftDrivers = [];
          forkliftPreferredMessageType = 'SMS';
          forkliftDriversLoadedAt = 0;
          syncLocationsHint();
          return;
        }
        const previousEnabled = forkliftUseEnabled;
        forkliftUseEnabled = data.useForklift !== false;
        forkliftDrivers = forkliftUseEnabled && Array.isArray(data.data) ? data.data.slice() : [];
        forkliftPreferredMessageType = String(data.preferredMessageType || 'SMS').trim().toUpperCase() === 'EMAIL'
          ? 'EMAIL'
          : 'SMS';
        forkliftDriversLoadedAt = Date.now();
        syncLocationsHint();
        if (refreshLocations && previousEnabled !== forkliftUseEnabled && lastLocations.length && selectedProduct) {
          renderLocations(lastLocations, selectedProduct);
        }
      } catch (error) {
        console.error('Error loading forklift settings:', error);
        forkliftUseEnabled = false;
        forkliftDrivers = [];
        forkliftPreferredMessageType = 'SMS';
        forkliftDriversLoadedAt = 0;
        syncLocationsHint();
      } finally {
        forkliftDriversLoading = null;
      }
    })();

    return forkliftDriversLoading;
  }

  function buildForkliftMessageContent({ locationCode, productCode, productName, requester, locationSection }) {
    const location = String(locationCode || '').trim();
    const code = String(productCode || '').trim();
    const name = String(productName || '').trim();
    const productLine = name ? `${code} - ${name}` : code;
    const section = String(locationSection || '').trim();
    const requestedBy = String(requester || '').trim();
    const lines = [];
    if (requestedBy) lines.push(`Requested by: ${requestedBy}`);
    if (section) lines.push(`Location section: ${section}`);
    lines.push(`Location Code: ${location}`);
    lines.push(`Product Code and name: ${productLine}`);
    return lines.join('\n');
  }

  async function getLoggedRequesterName() {
    if (cachedRequesterName) return cachedRequesterName;
    if (requesterLoading) return requesterLoading;

    requesterLoading = (async () => {
      try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();
        if (data.authenticated && data.user) {
          cachedRequesterName = data.user.isRoot
            ? 'Root'
            : (data.user.nome || data.user.email || 'User');
          return cachedRequesterName;
        }
      } catch (_) { /* ignore */ }
      return 'User';
    })().finally(() => {
      requesterLoading = null;
    });

    return requesterLoading;
  }

  async function fetchNextForkliftRequestNumber() {
    try {
      const metaRes = await fetch(`${API_MESSAGE_REQUEST}/meta`, { credentials: 'include' });
      const metaData = await metaRes.json();
      if (metaRes.ok && metaData.success && metaData.data?.nextRequestNumber != null) {
        return String(metaData.data.nextRequestNumber);
      }
    } catch (_) { /* ignore */ }
    return 'Next available';
  }

  function fillForkliftDriverOptions(messageType) {
    if (!els.forkliftDriverSelect) return;
    const type = String(messageType || 'SMS').toUpperCase();
    const filtered = forkliftDrivers.filter((user) => {
      if (type === 'EMAIL') return !!String(user.email || '').trim();
      return !!String(user.telefone || '').trim();
    });
    const previous = els.forkliftDriverSelect.value;
    let placeholder = 'Select forklift driver...';
    if (forkliftDrivers.length && !filtered.length) {
      placeholder = type === 'EMAIL'
        ? 'Select driver (none with email)...'
        : 'Select driver (none with phone)...';
    }
    els.forkliftDriverSelect.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`
      + '<option value="__NOT_DEFINED__">~Driver not defined</option>'
      + filtered.map((user) => {
        const id = user.id || '';
        const name = user.nome || user.email || id;
        const contact = type === 'EMAIL'
          ? String(user.email || '').trim()
          : String(user.telefone || '').trim();
        const label = contact ? `${name} (${contact})` : name;
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      }).join('');
    if (previous === '__NOT_DEFINED__'
      || (previous && filtered.some((user) => String(user.id) === String(previous)))) {
      els.forkliftDriverSelect.value = previous;
    }
    updateForkliftDriverContactHint();
  }

  function getSelectedForkliftDriver() {
    const id = els.forkliftDriverSelect?.value || '';
    if (!id || id === '__NOT_DEFINED__') return null;
    return forkliftDrivers.find((user) => String(user.id) === String(id)) || null;
  }

  function updateForkliftDriverContactHint() {
    if (!els.forkliftDriverContact) return;
    if (String(els.forkliftDriverSelect?.value || '') === '__NOT_DEFINED__') {
      els.forkliftDriverContact.textContent = 'No driver selected — request will wait for a forklift driver to assign.';
      return;
    }
    const driver = getSelectedForkliftDriver();
    if (!driver) {
      els.forkliftDriverContact.textContent = '';
      return;
    }
    const phone = String(driver.telefone || '').trim();
    const email = String(driver.email || '').trim();
    const parts = [];
    if (phone) parts.push(`Phone: ${phone}`);
    if (email) parts.push(`Email: ${email}`);
    els.forkliftDriverContact.textContent = parts.join(' · ');
  }

  function refreshForkliftMessageContent(context, requester) {
    const el = document.getElementById('sptForkliftMessageContent');
    if (!el || !context) return;
    el.value = buildForkliftMessageContent({
      locationCode: context.locationCode || '',
      productCode: context.productCode || '',
      productName: context.productName || '',
      requester: requester || document.getElementById('sptForkliftRequester')?.value || '',
      locationSection: context.locationSection || ''
    });
  }

  function showForkliftModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('show');
  }

  function hideForkliftModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove('show');
  }

  function closeForkliftRequestModal() {
    hideForkliftModal(els.forkliftRequestModal);
    pendingForkliftPayload = null;
    forkliftContext = null;
  }

  function closeForkliftConfirmModal() {
    hideForkliftModal(els.forkliftConfirmModal);
  }

  function openForkliftConfirmModal(payload) {
    pendingForkliftPayload = payload;
    if (els.forkliftConfirmText) {
      const priorityLabel = payload.priority || 'NORMAL';
      if (payload.driverNotDefined) {
        els.forkliftConfirmText.textContent =
          `Create forklift request without a driver?\n\n`
          + `Status will be: Waiting for driver for request\n`
          + `Priority: ${priorityLabel}\n\n`
          + `Subject: ${payload.subject}\n\n`
          + `${payload.messageContent}`;
      } else {
        els.forkliftConfirmText.textContent =
          `Send ${payload.messageType} to ${payload.assignedToName}?\n\n`
          + `Priority: ${priorityLabel}\n\n`
          + `Subject: ${payload.subject}\n\n`
          + `${payload.messageContent}`;
      }
    }
    showForkliftModal(els.forkliftConfirmModal);
  }

  async function openTabletForkliftRequest(locationCode, locationSection) {
    if (!forkliftUseEnabled && !forkliftDriversLoadedAt) {
      await loadForkliftSettings({ refreshLocations: false });
    }
    if (!forkliftUseEnabled) {
      alert('Forklift is disabled. Turn on Use forklift in Setting Forklift Driver to enable requests.');
      return;
    }
    const code = String(locationCode || '').trim();
    if (!code) return;

    const productCode = String(selectedProduct?.codigo || selectedCode || '').trim();
    const productName = String(selectedProduct?.nome || '').trim();
    forkliftContext = {
      locationCode: code,
      locationSection: String(locationSection || '').trim(),
      productCode,
      productName
    };
    pendingForkliftPayload = null;

    // Paint cached values immediately so the tablet dialog feels instant.
    document.getElementById('sptForkliftRequestNumber').value = 'Loading...';
    document.getElementById('sptForkliftRequestDatetime').value = new Date().toLocaleString();
    document.getElementById('sptForkliftSubject').value = 'Lower the pallet';
    document.getElementById('sptForkliftRequester').value = cachedRequesterName || 'Loading...';
    const prioritySelect = document.getElementById('sptForkliftPriority');
    if (prioritySelect) prioritySelect.value = 'NORMAL';
    if (els.forkliftMessageType) {
      els.forkliftMessageType.value = forkliftPreferredMessageType;
      els.forkliftMessageType.disabled = true;
    }
    fillForkliftDriverOptions(forkliftPreferredMessageType);
    refreshForkliftMessageContent(forkliftContext, cachedRequesterName || '');
    showForkliftModal(els.forkliftRequestModal);
    els.forkliftDriverSelect?.focus();

    try {
      const requesterPromise = getLoggedRequesterName();
      const driversPromise = loadForkliftSettings({ refreshLocations: false });
      const requestNumberPromise = fetchNextForkliftRequestNumber();

      const requester = await requesterPromise;
      document.getElementById('sptForkliftRequester').value = requester;
      refreshForkliftMessageContent(forkliftContext, requester);

      await driversPromise;
      if (!forkliftUseEnabled) {
        closeForkliftRequestModal();
        alert('Forklift is disabled. Turn on Use forklift in Setting Forklift Driver to enable requests.');
        return;
      }
      if (els.forkliftMessageType) {
        els.forkliftMessageType.value = forkliftPreferredMessageType;
      }
      fillForkliftDriverOptions(forkliftPreferredMessageType);

      const nextRequestNumber = await requestNumberPromise;
      document.getElementById('sptForkliftRequestNumber').value = nextRequestNumber;
    } catch (error) {
      console.error('Error preparing tablet forklift request:', error);
      document.getElementById('sptForkliftRequestNumber').value = 'Next available';
      const requesterEl = document.getElementById('sptForkliftRequester');
      if (!requesterEl.value || requesterEl.value === 'Loading...') {
        requesterEl.value = cachedRequesterName || 'User';
      }
      fillForkliftDriverOptions(forkliftPreferredMessageType);
      refreshForkliftMessageContent(forkliftContext, requesterEl.value);
    }
  }

  async function loadLocationsForProduct(product) {
    const code = String(product?.codigo || '').trim();
    selectedCode = code;
    selectedProduct = product || null;
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
      prepareSearchInputForNextEntry();
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

  function onLocationsClick(event) {
    const link = event.target.closest('.spt-location-link');
    if (!link || !els.locationsBody?.contains(link)) return;
    event.preventDefault();
    openTabletForkliftRequest(
      link.getAttribute('data-location') || '',
      link.getAttribute('data-section') || ''
    );
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
    els.locationsBody?.addEventListener('click', onLocationsClick);

    els.forkliftDriverSelect?.addEventListener('change', updateForkliftDriverContactHint);
    els.forkliftRequestForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const messageType = forkliftPreferredMessageType || String(els.forkliftMessageType?.value || 'SMS').toUpperCase();
      const priorityRaw = String(document.getElementById('sptForkliftPriority')?.value || 'NORMAL').trim().toUpperCase();
      const allowedPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
      const priority = allowedPriorities.includes(priorityRaw) ? priorityRaw : 'NORMAL';
      const subject = String(document.getElementById('sptForkliftSubject')?.value || '').trim() || 'Lower the pallet';
      const messageContent = String(document.getElementById('sptForkliftMessageContent')?.value || '').trim();
      const selectedValue = String(els.forkliftDriverSelect?.value || '');
      const driverNotDefined = selectedValue === '__NOT_DEFINED__';
      const driver = getSelectedForkliftDriver();

      if (!selectedValue) {
        alert('Select a forklift driver or ~Driver not defined.');
        els.forkliftDriverSelect?.focus();
        return;
      }
      if (!messageContent) {
        alert('Message content is required.');
        document.getElementById('sptForkliftMessageContent')?.focus();
        return;
      }

      if (driverNotDefined) {
        openForkliftConfirmModal({
          messageType,
          priority,
          subject,
          messageContent,
          driverNotDefined: true,
          assignedTo: '__NOT_DEFINED__',
          assignedToName: 'Driver not defined'
        });
        return;
      }

      const phone = String(driver?.telefone || '').trim();
      const email = String(driver?.email || '').trim();
      if (messageType === 'SMS' && !phone) {
        alert('Selected driver has no phone registered.');
        return;
      }
      if (messageType === 'EMAIL' && !email) {
        alert('Selected driver has no email registered.');
        return;
      }

      openForkliftConfirmModal({
        messageType,
        priority,
        subject,
        messageContent,
        driverNotDefined: false,
        assignedTo: driver.id,
        assignedToName: driver.nome || driver.email || 'Forklift driver',
        recipientName: driver.nome || driver.email || 'Forklift driver',
        recipientEmail: email || null,
        recipientPhone: phone || null
      });
    });

    els.forkliftConfirmSendBtn?.addEventListener('click', async () => {
      if (!pendingForkliftPayload) return;
      const btn = els.forkliftConfirmSendBtn;
      if (btn) btn.disabled = true;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 45000) : null;
      try {
        const res = await fetch(`${API_MESSAGE_REQUEST}/forklift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(pendingForkliftPayload),
          signal: controller?.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to send forklift request');
        }
        const reqNo = data.data?.requestNumber != null ? data.data.requestNumber : '';
        const waiting = !!pendingForkliftPayload.driverNotDefined || !!data.waitingForDriver;
        const driverName = pendingForkliftPayload.assignedToName || 'Driver not defined';
        pendingForkliftPayload = null;
        closeForkliftConfirmModal();
        closeForkliftRequestModal();
        if (waiting) {
          alert(`Request #${reqNo} created.\nStatus: Waiting for driver for request.`);
        } else if (data.sendPending) {
          alert(`Request #${reqNo} created.\nStatus: Forklift driver request selected.\nNotification is being sent to ${driverName}.`);
        } else {
          alert(`Request #${reqNo} created.\nStatus: Forklift driver request selected.\nMessage sent to ${driverName}.`);
        }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          alert('Request timed out waiting for the server. Check Search Message Request — the request may still have been created.');
        } else {
          alert(error.message || 'Error sending forklift request');
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById('sptCloseForkliftRequestModal')?.addEventListener('click', closeForkliftRequestModal);
    document.getElementById('sptCancelForkliftRequestBtn')?.addEventListener('click', closeForkliftRequestModal);
    document.getElementById('sptCloseForkliftConfirmModal')?.addEventListener('click', closeForkliftConfirmModal);
    document.getElementById('sptCancelForkliftConfirmBtn')?.addEventListener('click', closeForkliftConfirmModal);
    els.forkliftRequestModal?.addEventListener('click', (event) => {
      if (event.target === els.forkliftRequestModal) closeForkliftRequestModal();
    });
    els.forkliftConfirmModal?.addEventListener('click', (event) => {
      if (event.target === els.forkliftConfirmModal) closeForkliftConfirmModal();
    });
  }

  bindEvents();
  syncSearchByField(getSearchBy());
  loadStatistics();
  // Prefetch requester + drivers so opening the dialog is fast.
  getLoggedRequesterName().catch(() => {});
  loadForkliftSettings({ refreshLocations: true }).catch(() => {});

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
