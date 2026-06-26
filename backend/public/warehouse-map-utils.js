(function (global) {
    const WAREHOUSE_SECTOR_SHEET = 'Warehouse SECTOR';
    const LOCATION_CODE_RE = /^[A-Z]\d+$/i;
    const AISLE_CODE_RE = /^[IJ]\d+$/i;

    const SECTOR_NAMES = ['TAPWARE', 'BATHWARE', 'FURNITURE', 'GENERAL', 'DOORWARE'];

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function normalizeCellText(value) {
        return String(value == null ? '' : value)
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, ' ')
            .trim();
    }

    function formatSectorDisplay(value) {
        const normalized = normalizeCellText(value);
        if (global.SectionOptions && typeof global.SectionOptions.formatSectionLabel === 'function') {
            return global.SectionOptions.formatSectionLabel(normalized);
        }
        const upper = normalized.toUpperCase();
        if (upper === 'DOORWARE') return 'Doorware';
        if (upper === 'FURNITURE') return 'Furniture';
        return upper;
    }

    function classifyCell(value) {
        const text = normalizeCellText(value);
        if (!text) return 'empty';
        const upper = text.toUpperCase();
        if (SECTOR_NAMES.includes(upper)) return 'sector';
        if (LOCATION_CODE_RE.test(upper)) return 'location';
        if (AISLE_CODE_RE.test(upper)) return 'aisle';
        return 'label';
    }

    function buildMergeMap(merges, rowCount, colCount) {
        const cellMeta = Array.from({ length: rowCount }, () =>
            Array.from({ length: colCount }, () => ({ skip: false, rowspan: 1, colspan: 1 }))
        );

        (merges || []).forEach((merge) => {
            const rowSpan = merge.e.r - merge.s.r + 1;
            const colSpan = merge.e.c - merge.s.c + 1;
            cellMeta[merge.s.r][merge.s.c].rowspan = rowSpan;
            cellMeta[merge.s.r][merge.s.c].colspan = colSpan;

            for (let r = merge.s.r; r <= merge.e.r; r++) {
                for (let c = merge.s.c; c <= merge.e.c; c++) {
                    if (r === merge.s.r && c === merge.s.c) continue;
                    cellMeta[r][c].skip = true;
                }
            }
        });

        return cellMeta;
    }

    function sheetToGrid(sheet) {
        const ref = sheet['!ref'];
        if (!ref) {
            return { rows: [], merges: [], rowCount: 0, colCount: 0 };
        }

        const range = XLSX.utils.decode_range(ref);
        const rowCount = range.e.r - range.s.r + 1;
        const colCount = range.e.c - range.s.c + 1;
        const rows = [];

        for (let r = range.s.r; r <= range.e.r; r++) {
            const row = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[addr];
                let value = '';
                if (cell) {
                    value = cell.w != null ? cell.w : (cell.v != null ? String(cell.v) : '');
                }
                row.push(normalizeCellText(value));
            }
            rows.push(row);
        }

        return {
            rows,
            merges: sheet['!merges'] || [],
            rowCount,
            colCount
        };
    }

    function parseWorkbookBuffer(buffer) {
        if (typeof XLSX === 'undefined') {
            throw new Error('Excel reader library is not loaded. Please refresh the page.');
        }

        const workbook = XLSX.read(buffer, { type: 'array' });
        if (!workbook.SheetNames.includes(WAREHOUSE_SECTOR_SHEET)) {
            throw new Error(`Sheet "${WAREHOUSE_SECTOR_SHEET}" was not found in this workbook.`);
        }

        return sheetToGrid(workbook.Sheets[WAREHOUSE_SECTOR_SHEET]);
    }

    function renderWarehouseMap(containerId, gridData, searchTerm, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!gridData || !gridData.rows.length) {
            container.innerHTML = `
                <div class="warehouse-map-placeholder">
                    <i class="fas fa-file-excel"></i>
                    <p>No warehouse map loaded. Upload <strong>WareHouseMap.xlsx</strong> in <strong>Upload Warehouse Map</strong>.</p>
                </div>`;
            return;
        }

        const mergeMeta = buildMergeMap(gridData.merges, gridData.rowCount, gridData.colCount);
        const rowsHtml = gridData.rows.map((row, rowIndex) => {
            const cellsHtml = row.map((value, colIndex) => {
                const meta = mergeMeta[rowIndex][colIndex];
                if (meta.skip) return '';

                const cellClass = classifyCell(value);
                const displayValue = cellClass === 'sector'
                    ? formatSectorDisplay(value)
                    : value;
                const attrs = [];
                if (meta.rowspan > 1) attrs.push(`rowspan="${meta.rowspan}"`);
                if (meta.colspan > 1) attrs.push(`colspan="${meta.colspan}"`);

                const dataLoc = cellClass === 'location' ? ` data-location="${escapeHtml(value.toUpperCase())}"` : '';
                return `<td class="map-${cellClass}"${dataLoc} ${attrs.join(' ')}>${escapeHtml(displayValue)}</td>`;
            }).join('');

            return `<tr>${cellsHtml}</tr>`;
        }).join('');

        container.innerHTML = `
            <div class="warehouse-map-meta">
                <span><strong>Sheet:</strong> ${escapeHtml(WAREHOUSE_SECTOR_SHEET)}</span>
                <span><strong>Rows:</strong> ${gridData.rowCount}</span>
                <span><strong>Columns:</strong> ${gridData.colCount}</span>
            </div>
            <div class="warehouse-map-wrap">
                <table class="warehouse-map-table" id="warehouseMapTable">
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>`;

        const productLocations = options && Array.isArray(options.productLocations) ? options.productLocations : [];
        applyLocationSearch(searchTerm || '', productLocations, options);
    }

    function getLocationCodeFromProductItem(item) {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        return item.locationCode != null ? item.locationCode : (item.location_code || '');
    }

    function normalizeProductLocationList(list) {
        if (!Array.isArray(list)) return [];
        return list.map((item) => {
            if (typeof item === 'string') {
                return {
                    locationCode: item,
                    accessType: '',
                    quantityCurrent: ''
                };
            }
            return {
                locationCode: getLocationCodeFromProductItem(item),
                accessType: item.accessType != null ? item.accessType : (item.access_type ?? ''),
                quantityCurrent: item.quantityCurrent != null
                    ? item.quantityCurrent
                    : (item.quantity_current ?? '')
            };
        }).filter((row) => row.locationCode);
    }

    function getProductLocationsForMapCell(mapLoc, productList) {
        return productList.filter((row) => locationMatchesMapCell(row.locationCode, mapLoc));
    }

    let mapTooltipEl = null;

    function ensureMapTooltip() {
        if (!mapTooltipEl) {
            mapTooltipEl = document.createElement('div');
            mapTooltipEl.className = 'warehouse-map-location-tooltip';
            mapTooltipEl.setAttribute('role', 'tooltip');
            mapTooltipEl.hidden = true;
            document.body.appendChild(mapTooltipEl);
        }
        return mapTooltipEl;
    }

    function hideMapTooltip() {
        if (!mapTooltipEl) return;
        mapTooltipEl.hidden = true;
    }

    function positionMapTooltip(event) {
        const tooltip = ensureMapTooltip();
        const pad = 14;
        let x = event.clientX + pad;
        let y = event.clientY + pad;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.hidden = false;

        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8) {
            x = event.clientX - rect.width - pad;
            tooltip.style.left = `${Math.max(8, x)}px`;
        }
        if (rect.bottom > window.innerHeight - 8) {
            y = event.clientY - rect.height - pad;
            tooltip.style.top = `${Math.max(8, y)}px`;
        }
    }

    function buildMapTooltipHtml(matches) {
        return matches.map((row) => `
            <div class="warehouse-map-tooltip-block">
                <div><span class="warehouse-map-tooltip-label">Location Code</span> ${escapeHtml(row.locationCode || '-')}</div>
                <div><span class="warehouse-map-tooltip-label">Access Type</span> ${escapeHtml(row.accessType || '-')}</div>
                <div><span class="warehouse-map-tooltip-label">Quantity Current</span> ${escapeHtml(row.quantityCurrent)}</div>
            </div>
        `).join('');
    }

    function setupProductLocationTooltips(table, productList) {
        const normalized = normalizeProductLocationList(productList);
        hideMapTooltip();
        if (!table) return;

        table._productLocationDetails = normalized;

        if (table._mapTooltipHandlersAttached) return;
        table._mapTooltipHandlersAttached = true;

        const tooltip = ensureMapTooltip();

        table.addEventListener('pointerover', (event) => {
            const cell = event.target.closest('td.map-location.is-product-match');
            if (!cell || !table.contains(cell)) return;

            const details = table._productLocationDetails || [];
            const mapLoc = cell.getAttribute('data-location') || '';
            const matches = getProductLocationsForMapCell(mapLoc, details);
            if (!matches.length) return;

            tooltip.innerHTML = buildMapTooltipHtml(matches);
            positionMapTooltip(event);
        });

        table.addEventListener('pointermove', (event) => {
            const cell = event.target.closest('td.map-location.is-product-match');
            if (!cell || !table.contains(cell) || tooltip.hidden) return;
            positionMapTooltip(event);
        });

        table.addEventListener('pointerout', (event) => {
            const cell = event.target.closest('td.map-location.is-product-match');
            if (!cell || !table.contains(cell)) return;
            const related = event.relatedTarget;
            if (related && cell.contains(related)) return;
            hideMapTooltip();
        });

        table.addEventListener('pointerleave', () => hideMapTooltip());
    }

    function getMapMatchKeys(productLocation) {
        const keys = new Set();
        const prod = String(productLocation || '').trim().toUpperCase();
        if (!prod) return keys;

        const parseFn = global.LocationCodeUtils && global.LocationCodeUtils.parseLocationCode;
        const parsed = parseFn ? parseFn(prod) : null;
        if (parsed && parsed.street && parsed.building !== '') {
            const street = parsed.street;
            const building = String(parsed.building);
            keys.add(street + building);
            if (building.length > 1) {
                keys.add(street + building.charAt(0));
            }
            return keys;
        }

        keys.add(prod);
        keys.add(prod.replace(/[RLM]$/, ''));
        return keys;
    }

    function locationMatchesMapCell(productLocation, mapCell) {
        const map = String(mapCell || '').trim().toUpperCase();
        if (!map) return false;
        return getMapMatchKeys(productLocation).has(map);
    }

    const MAP_BLINK_DURATION_MS = 7000;
    let mapBlinkClearTimer = null;

    function clearMapLocationBlink() {
        if (mapBlinkClearTimer) {
            clearTimeout(mapBlinkClearTimer);
            mapBlinkClearTimer = null;
        }
        document.querySelectorAll('td.map-location.is-blinking').forEach((cell) => {
            cell.classList.remove('is-blinking');
        });
    }

    function blinkMapLocationCells(cells) {
        const list = Array.from(cells || []).filter(Boolean);
        if (!list.length) return;

        clearMapLocationBlink();
        list.forEach((cell) => cell.classList.add('is-blinking'));
        mapBlinkClearTimer = setTimeout(() => {
            list.forEach((cell) => cell.classList.remove('is-blinking'));
            mapBlinkClearTimer = null;
        }, MAP_BLINK_DURATION_MS);
    }

    function applyMapHighlights(options) {
        const singleTerm = options && options.singleTerm != null ? options.singleTerm : '';
        const productLocations = options && Array.isArray(options.productLocations) ? options.productLocations : [];
        const table = document.getElementById('warehouseMapTable');
        if (!table) return;

        const normalizedSingle = String(singleTerm).trim().toUpperCase();
        const cells = table.querySelectorAll('td.map-location');
        let firstScrollTarget = null;
        const productMatchCells = [];

        cells.forEach((cell) => {
            const mapLoc = (cell.getAttribute('data-location') || '').toUpperCase();
            const isProductMatch = productLocations.some((loc) =>
                locationMatchesMapCell(getLocationCodeFromProductItem(loc), mapLoc)
            );
            const isSingleMatch = Boolean(normalizedSingle) && mapLoc === normalizedSingle;

            cell.classList.toggle('is-product-match', isProductMatch);
            cell.classList.toggle('is-match', isSingleMatch);

            if (isProductMatch) {
                productMatchCells.push(cell);
            }

            if (!firstScrollTarget && (isSingleMatch || isProductMatch)) {
                firstScrollTarget = cell;
            }
        });

        if (options && options.blinkProductMatches && productLocations.length > 0 && productMatchCells.length > 0) {
            blinkMapLocationCells(productMatchCells);
        }

        setupProductLocationTooltips(table, productLocations);

        if (options && options.scrollToTop) {
            scrollMapToTop();
        } else if (firstScrollTarget && (!options || options.autoScrollToMatch !== false)) {
            firstScrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    function scrollMapToTop() {
        const wrap = getMapWrapElement();
        if (wrap) {
            wrap.scrollTop = 0;
            wrap.scrollLeft = 0;
        }
    }

    function getMapWrapElement() {
        const table = document.getElementById('warehouseMapTable');
        return table ? table.closest('.warehouse-map-wrap') : null;
    }

    function applyLocationSearch(term, productLocations, mapOptions) {
        applyMapHighlights({
            singleTerm: term,
            productLocations: productLocations || [],
            blinkProductMatches: Boolean(mapOptions && mapOptions.blinkProductMatches),
            scrollToTop: Boolean(mapOptions && mapOptions.scrollToTop),
            autoScrollToMatch: mapOptions && mapOptions.autoScrollToMatch != null
                ? Boolean(mapOptions.autoScrollToMatch)
                : true
        });
    }

    function highlightProductLocations(productLocations, singleTerm) {
        applyMapHighlights({
            singleTerm: singleTerm || '',
            productLocations: productLocations || []
        });
    }

    function scrollToProductLocation(locationCode, productLocations) {
        const table = document.getElementById('warehouseMapTable');
        if (!table) return;

        const cells = table.querySelectorAll('td.map-location');
        let target = null;

        cells.forEach((cell) => {
            const mapLoc = cell.getAttribute('data-location') || '';
            if (!target && locationMatchesMapCell(locationCode, mapLoc)) {
                target = cell;
            }
        });

        if (target) {
            highlightProductLocations(productLocations, '');
            target.classList.add('is-match');
            blinkMapLocationCells([target]);
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    async function loadServerMap() {
        const response = await fetch('WareHouseMap.xlsx');
        if (!response.ok) {
            throw new Error('WareHouseMap.xlsx is not available on the server.');
        }
        const buffer = await response.arrayBuffer();
        return parseWorkbookBuffer(buffer);
    }

    global.WarehouseMapUtils = {
        WAREHOUSE_SECTOR_SHEET,
        parseWorkbookBuffer,
        renderWarehouseMap,
        applyLocationSearch,
        highlightProductLocations,
        scrollToProductLocation,
        scrollMapToTop,
        locationMatchesMapCell,
        getMapMatchKeys,
        loadServerMap
    };
})(window);
