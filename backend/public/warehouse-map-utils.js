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
                    ? normalizeCellText(value).toUpperCase()
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
            const isProductMatch = productLocations.some((loc) => locationMatchesMapCell(loc, mapLoc));
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

        if (firstScrollTarget) {
            firstScrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    function applyLocationSearch(term, productLocations, mapOptions) {
        applyMapHighlights({
            singleTerm: term,
            productLocations: productLocations || [],
            blinkProductMatches: Boolean(mapOptions && mapOptions.blinkProductMatches)
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
        locationMatchesMapCell,
        getMapMatchKeys,
        loadServerMap
    };
})(window);
