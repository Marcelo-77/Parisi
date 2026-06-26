(function () {
    const WAREHOUSE_API = '/api/warehouse';
    const LOCATION_PRODUCT_API = '/api/location-product';

    const MAP_ZOOM_MIN = 0.5;
    const MAP_ZOOM_MAX = 2;
    const MAP_ZOOM_STEP = 0.25;

    let currentGrid = null;
    let mapZoomLevel = 1;
    let mapFitScale = 1;
    let mapResizeTimer = null;
    let products = [];
    let selectedProduct = null;
    let productLocations = [];

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function formatCategory(categoria) {
        if (typeof SectionOptions !== 'undefined') {
            return SectionOptions.formatSectionLabel(categoria);
        }
        if (!categoria) return '-';
        return String(categoria);
    }

    function getMapOptions(extra) {
        const searchInput = document.getElementById('mapLocationSearch');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        return {
            productLocations: productLocations.map((row) => row.locationCode),
            scrollToTop: !searchTerm,
            autoScrollToMatch: Boolean(searchTerm),
            ...(extra || {})
        };
    }

    function setMapPanelVisible(visible, options) {
        const panel = document.getElementById('warehouseMapPanel');
        const opts = options || {};
        if (panel) panel.style.display = visible ? '' : 'none';
        if (visible && panel && opts.scrollToMap !== false) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            scheduleMapScaleRefresh();
        }
    }

    function focusMapAtTop() {
        const panel = document.getElementById('warehouseMapPanel');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const applyTop = () => {
            if (typeof WarehouseMapUtils !== 'undefined') {
                WarehouseMapUtils.scrollMapToTop();
            }
        };

        requestAnimationFrame(() => {
            requestAnimationFrame(applyTop);
        });
        setTimeout(applyTop, 200);
    }

    function setLocationPanelVisible(visible) {
        const panel = document.getElementById('productLocationPanel');
        if (panel) panel.style.display = visible ? '' : 'none';
    }

    function resetSelectionState() {
        selectedProduct = null;
        productLocations = [];
        setLocationPanelVisible(false);
        setMapPanelVisible(false);

        const summary = document.getElementById('selectedProductSummary');
        const content = document.getElementById('productLocationContent');
        const mapSearchInput = document.getElementById('mapLocationSearch');
        if (summary) summary.innerHTML = '';
        if (content) content.innerHTML = '';
        if (mapSearchInput) mapSearchInput.value = '';
    }

    function getMapWrapElements() {
        const container = document.getElementById('warehouseMapContainer');
        if (!container) return {};
        return {
            container,
            wrap: container.querySelector('.warehouse-map-wrap'),
            table: container.querySelector('.warehouse-map-table')
        };
    }

    function clearMapWrapScale(wrap) {
        if (!wrap) return;
        wrap.style.zoom = '';
        wrap.style.transform = '';
        wrap.style.transformOrigin = '';
        wrap.style.width = '';
        wrap.style.height = '';
    }

    function updateMapFitScale() {
        const { wrap, table } = getMapWrapElements();
        if (!wrap || !table) {
            mapFitScale = 1;
            return;
        }

        clearMapWrapScale(wrap);

        const available = Math.max(wrap.clientWidth - 8, 1);
        const needed = table.scrollWidth;
        mapFitScale = needed > available ? Math.max(0.25, available / needed) : 1;
    }

    function applyMapZoom() {
        const { wrap, table } = getMapWrapElements();
        if (!wrap) return;

        const effectiveScale = mapFitScale * mapZoomLevel;

        if (typeof CSS !== 'undefined' && CSS.supports('zoom', '1')) {
            wrap.style.zoom = effectiveScale === 1 ? '' : String(effectiveScale);
            wrap.style.transform = '';
            wrap.style.transformOrigin = '';
            wrap.style.width = '';
            wrap.style.height = '';
            wrap.style.overflowX = effectiveScale > 1 ? 'auto' : 'hidden';
        } else {
            wrap.style.zoom = '';
            wrap.style.transform = effectiveScale === 1 ? '' : `scale(${effectiveScale})`;
            wrap.style.transformOrigin = 'top left';
            if (effectiveScale !== 1 && table) {
                wrap.style.width = `${Math.ceil(table.scrollWidth * effectiveScale)}px`;
                wrap.style.height = `${Math.ceil(table.scrollHeight * effectiveScale)}px`;
            } else {
                wrap.style.width = '';
                wrap.style.height = '';
            }
            wrap.style.overflowX = 'auto';
        }

        const zoomLabel = document.getElementById('mapZoomLevelLabel');
        if (zoomLabel) zoomLabel.textContent = `${Math.round(effectiveScale * 100)}%`;

        const zoomOutBtn = document.getElementById('mapZoomOutBtn');
        const zoomInBtn = document.getElementById('mapZoomInBtn');
        if (zoomOutBtn) zoomOutBtn.disabled = mapZoomLevel <= MAP_ZOOM_MIN;
        if (zoomInBtn) zoomInBtn.disabled = mapZoomLevel >= MAP_ZOOM_MAX;
    }

    function refreshMapScale() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateMapFitScale();
                applyMapZoom();
                const searchInput = document.getElementById('mapLocationSearch');
                const hasSearchTerm = searchInput ? searchInput.value.trim() : '';
                if (!hasSearchTerm && typeof WarehouseMapUtils !== 'undefined') {
                    WarehouseMapUtils.scrollMapToTop();
                }
            });
        });
    }

    function scheduleMapScaleRefresh() {
        if (mapResizeTimer) clearTimeout(mapResizeTimer);
        mapResizeTimer = setTimeout(refreshMapScale, 120);
    }

    function changeMapZoom(delta) {
        const next = Math.round((mapZoomLevel + delta) * 100) / 100;
        mapZoomLevel = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, next));
        applyMapZoom();
    }

    function resetMapZoom() {
        mapZoomLevel = 1;
        refreshMapScale();
    }

    function renderMapWithHighlights(blinkMatches) {
        const searchInput = document.getElementById('mapLocationSearch');
        const searchTerm = searchInput ? searchInput.value : '';
        if (!currentGrid) return;
        const mapOptions = getMapOptions();
        if (blinkMatches) {
            mapOptions.blinkProductMatches = true;
        }
        WarehouseMapUtils.renderWarehouseMap('warehouseMapContainer', currentGrid, searchTerm, mapOptions);
        refreshMapScale();
    }

    async function ensureMapLoaded() {
        if (currentGrid) return currentGrid;
        currentGrid = await WarehouseMapUtils.loadServerMap();
        return currentGrid;
    }

    async function loadProducts() {
        const response = await fetch(WAREHOUSE_API);
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || 'Unable to load products.');
        }
        products = data.data;
    }

    function filterProducts() {
        const searchInput = document.getElementById('productSearchInput');
        const searchBy = document.getElementById('productSearchBy');
        const categorySelect = document.getElementById('productSearchCategory');
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const field = searchBy ? searchBy.value : 'codigo';
        const category = categorySelect ? categorySelect.value.trim().toUpperCase() : '';

        let filtered = products;

        if (category) {
            filtered = filtered.filter((item) => String(item.categoria || '').trim().toUpperCase() === category);
        }

        if (!term) return filtered;

        return filtered.filter((item) => {
            const code = String(item.codigo || '').toLowerCase();
            const name = String(item.nome || '').toLowerCase();
            const barcode = String(item.barcode || '').replace(/\D/g, '');
            const barcodeTerm = term.replace(/\D/g, '');

            if (field === 'nome') return name.includes(term);
            if (field === 'barcode') return barcode && barcodeTerm && barcode.includes(barcodeTerm);
            return code === term;
        });
    }

    function runProductSearch() {
        const searchInput = document.getElementById('productSearchInput');
        const categorySelect = document.getElementById('productSearchCategory');
        const term = searchInput ? searchInput.value.trim() : '';
        const category = categorySelect ? categorySelect.value.trim() : '';

        resetSelectionState();

        if (!category && !term) {
            const container = document.getElementById('productSearchResults');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:20px;text-align:center;color:#888;">
                        <i class="fas fa-search"></i>
                        <p>Select a <strong>Category</strong> and/or enter a product code, name or barcode, then click <strong>Search Product</strong>.</p>
                    </div>`;
            }
            return;
        }

        const results = filterProducts();
        if (!results.length) {
            const container = document.getElementById('productSearchResults');
            if (container) {
                const scopeLabel = category ? formatCategory(category) : 'all categories';
                container.innerHTML = `
                    <div class="empty-state" style="padding:20px;text-align:center;color:#888;">
                        <i class="fas fa-box-open"></i>
                        <p>No products found${category ? ` in category <strong>${escapeHtml(scopeLabel)}</strong>` : ''}.</p>
                    </div>`;
            }
            return;
        }

        renderProductSearchResults(results);
    }

    function renderProductSearchResults(list) {
        const container = document.getElementById('productSearchResults');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding:20px;text-align:center;color:#888;">
                    <i class="fas fa-box-open"></i>
                    <p>No products found.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="warehouse-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Barcode</th>
                            <th class="th-actions">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map((item) => `
                            <tr>
                                <td>${escapeHtml(item.codigo || '-')}</td>
                                <td>${escapeHtml(item.nome || '-')}</td>
                                <td>${escapeHtml(formatCategory(item.categoria))}</td>
                                <td>${escapeHtml(item.barcode || '-')}</td>
                                <td class="td-actions">
                                    <button type="button" class="btn btn-primary btn-select-product" data-code="${escapeHtml(item.codigo || '')}">
                                        <i class="fas fa-check"></i> Select
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        container.querySelectorAll('.btn-select-product').forEach((btn) => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-code');
                const product = products.find((item) => String(item.codigo) === String(code));
                if (product) selectProduct(product);
            });
        });
    }

    async function loadProductLocations(productCode) {
        const response = await fetch(
            `${LOCATION_PRODUCT_API}/by-product-full/${encodeURIComponent(productCode)}`
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to load product locations.');
        }

        return (data.data || []).map((row) => ({
            locationCode: row.locationCode != null ? row.locationCode : row.location_code,
            quantityCurrent: row.quantityCurrent != null ? row.quantityCurrent : (row.quantity_current ?? 0),
            accessType: row.accessType != null ? row.accessType : (row.access_type ?? '')
        }));
    }

    function renderProductLocations(list) {
        const summary = document.getElementById('selectedProductSummary');
        const content = document.getElementById('productLocationContent');
        if (!summary || !content || !selectedProduct) return;
        summary.innerHTML = `
            <span><strong>Code:</strong> ${escapeHtml(selectedProduct.codigo || '-')}</span>
            <span><strong>Name:</strong> ${escapeHtml(selectedProduct.nome || '-')}</span>
            <span><strong>Locations:</strong> ${list.length}</span>
        `;

        if (!list.length) {
            content.innerHTML = '<p class="empty-state">No locations (situation Full, stat_cd_id A) for this product.</p>';
            return;
        }

        content.innerHTML = `
            <table class="product-location-table">
                <thead>
                    <tr>
                        <th>Location Code</th>
                        <th>Access Type</th>
                        <th>Quantity Current</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map((row) => `
                        <tr data-location-code="${escapeHtml(row.locationCode || '')}">
                            <td>${escapeHtml(row.locationCode || '-')}</td>
                            <td>${escapeHtml(row.accessType || '-')}</td>
                            <td>${escapeHtml(row.quantityCurrent)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        content.querySelectorAll('tbody tr').forEach((row) => {
            row.addEventListener('click', () => {
                const locationCode = row.getAttribute('data-location-code');
                content.querySelectorAll('tbody tr').forEach((tr) => tr.classList.remove('is-active'));
                row.classList.add('is-active');
                WarehouseMapUtils.scrollToProductLocation(locationCode, productLocations.map((item) => item.locationCode));
            });
        });
    }

    function clearProductSearchResults() {
        const container = document.getElementById('productSearchResults');
        if (container) container.innerHTML = '';
    }

    async function selectProduct(product) {
        selectedProduct = product;
        productLocations = [];

        clearProductSearchResults();

        const mapSearchInput = document.getElementById('mapLocationSearch');
        if (mapSearchInput) mapSearchInput.value = '';

        setLocationPanelVisible(true);
        setMapPanelVisible(true, { scrollToMap: false });

        const content = document.getElementById('productLocationContent');
        if (content) content.innerHTML = '<span class="loading-text">Loading locations...</span>';

        const mapContainer = document.getElementById('warehouseMapContainer');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="warehouse-map-placeholder">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading map...</p>
                </div>`;
        }

        focusMapAtTop();

        try {
            productLocations = await loadProductLocations(product.codigo);
            renderProductLocations(productLocations);

            if (productLocations.length > 0) {
                await ensureMapLoaded();
                renderMapWithHighlights(true);
                focusMapAtTop();
            } else {
                setMapPanelVisible(false);
            }
        } catch (error) {
            console.error('Product location load error:', error);
            if (content) {
                content.innerHTML = `<p class="error-state">${escapeHtml(error.message || 'Error loading locations.')}</p>`;
            }
            setMapPanelVisible(false);
        }
    }

    function clearProductSelection() {
        resetSelectionState();
        clearProductSearchResults();

        const searchInput = document.getElementById('productSearchInput');
        const categorySelect = document.getElementById('productSearchCategory');

        if (searchInput) searchInput.value = '';
        if (categorySelect) categorySelect.value = '';
    }

    function setupHeaderDropdowns() {
        const dropdowns = [
            ['usersMenuBtn', 'usersDropdownMenu'],
            ['productMenuBtn', 'productDropdownMenu'],
            ['applicationsMenuBtn', 'applicationsDropdownMenu'],
            ['locationMenuBtn', 'locationDropdownMenu'],
            ['movementMenuBtn', 'movementDropdownMenu'],
            ['customerMenuBtn', 'customerDropdownMenu'],
            ['pickingMenuBtn', 'pickingDropdownMenu'],
            ['helpMenuBtn', 'helpDropdownMenu']
        ];

        const buttons = {};
        const menus = {};

        dropdowns.forEach(([btnId, menuId]) => {
            buttons[btnId] = document.getElementById(btnId);
            menus[menuId] = document.getElementById(menuId);
        });

        function closeAll() {
            Object.values(menus).forEach((el) => { if (el) el.setAttribute('aria-hidden', 'true'); });
            Object.values(buttons).forEach((el) => { if (el) el.setAttribute('aria-expanded', 'false'); });
        }

        Object.keys(buttons).forEach((btnId) => {
            const btn = buttons[btnId];
            const menuId = btnId.replace('MenuBtn', 'DropdownMenu');
            const menu = menus[menuId];
            if (btn && menu) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = menu.getAttribute('aria-hidden') !== 'true';
                    closeAll();
                    menu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
                    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
                });
            }
        });

        document.addEventListener('click', closeAll);

        const newProductBtn = document.getElementById('newProductBtn');
        const searchProductBtn = document.getElementById('searchProductBtn');
        if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
        if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
    }

    async function loadAndRenderMap() {
        try {
            await ensureMapLoaded();
            renderMapWithHighlights();
        } catch (error) {
            console.error('Load map error:', error);
            currentGrid = null;
            WarehouseMapUtils.renderWarehouseMap('warehouseMapContainer', null, '');
        }
    }

    function initPage() {

        const searchProductBtnAction = document.getElementById('searchProductBtnAction');
        const clearProductSearchBtn = document.getElementById('clearProductSearchBtn');
        const productSearchInput = document.getElementById('productSearchInput');
        const refreshBtn = document.getElementById('refreshMapBtn');
        const searchInput = document.getElementById('mapLocationSearch');
        const clearSearchBtn = document.getElementById('clearMapSearchBtn');
        const zoomOutBtn = document.getElementById('mapZoomOutBtn');
        const zoomInBtn = document.getElementById('mapZoomInBtn');
        const zoomResetBtn = document.getElementById('mapZoomResetBtn');

        if (searchProductBtnAction) {
            searchProductBtnAction.addEventListener('click', runProductSearch);
        }

        if (productSearchInput) {
            productSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runProductSearch();
                }
            });
        }

        if (clearProductSearchBtn) {
            clearProductSearchBtn.addEventListener('click', clearProductSelection);
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => loadAndRenderMap());
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => renderMapWithHighlights());
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    renderMapWithHighlights();
                }
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                renderMapWithHighlights();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => changeMapZoom(-MAP_ZOOM_STEP));
        }

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => changeMapZoom(MAP_ZOOM_STEP));
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', resetMapZoom);
        }

        window.addEventListener('resize', scheduleMapScaleRefresh);

        refreshMapScale();

        loadProducts().catch((error) => {
            console.error('Load products error:', error);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
})();
