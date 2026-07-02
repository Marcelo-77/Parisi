(function (global) {
    const WAREHOUSE_SECTOR_SHEET = 'Warehouse SECTOR';
    const LOCATION_CODE_RE = /^[A-Z]\d+$/i;
    const AISLE_CODE_RE = /^[IJ]\d+$/i;

    const SECTOR_NAMES = ['TAPWARE', 'BATHWARE', 'FURNITURE', 'GENERAL', 'DOORWARE'];
    const DEFAULT_IMAGE_MAP_AREA = {
        left: 0.165,
        top: 0.075,
        width: 0.71,
        height: 0.62
    };
    const DEFAULT_CALIBRATION_ANCHORS = {
        tl: 'I8',
        tr: 'H33',
        bl: 'A49',
        br: 'A72'
    };
    const DEFAULT_IMAGE_CORNERS = {
        tl: { x: 0.127, y: 0.056 },
        tr: { x: 0.948, y: 0.048 },
        bl: { x: 0.70, y: 0.82 },
        br: { x: 0.88, y: 0.80 }
    };
    const MAIN_RACK_CODE_RE = /^[B-H]\d+$/i;

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

    function syncImageOverlaySize(container) {
        if (!container) return;
        const img = container.querySelector('.warehouse-map-overlay-image');
        const wrap = container.querySelector('.warehouse-map-overlay-wrap');
        const table = container.querySelector('.warehouse-map-table-overlay');
        if (!img || !wrap || !table) return;

        const displayWidth = img.clientWidth;
        const displayHeight = img.clientHeight;
        if (!displayWidth || !displayHeight) return;

        const tableWidth = table.offsetWidth;
        const tableHeight = table.offsetHeight;
        if (!tableWidth || !tableHeight) return;

        wrap.style.width = `${tableWidth}px`;
        wrap.style.height = `${tableHeight}px`;

        const scaleX = displayWidth / tableWidth;
        const scaleY = displayHeight / tableHeight;
        wrap.style.transform = `scale(${scaleX}, ${scaleY})`;
        wrap.style.transformOrigin = 'top left';
    }

    let mapImageBlinkCells = [];

    function clearImageBlinkMarkers(container) {
        if (container) {
            container.querySelectorAll('.warehouse-map-blink-marker').forEach((el) => el.remove());
        } else {
            document.querySelectorAll('.warehouse-map-blink-marker').forEach((el) => el.remove());
        }
        mapImageBlinkCells = [];
    }

    function positionImageBlinkMarkers(container, cells) {
        const stack = container && container.querySelector('.warehouse-map-image-overlay-stack');
        const list = Array.from(cells || []).filter(Boolean);
        if (!stack || !list.length) return;

        const stackRect = stack.getBoundingClientRect();
        const markers = stack.querySelectorAll('.warehouse-map-blink-marker');

        list.forEach((cell, index) => {
            const rect = cell.getBoundingClientRect();
            let marker = markers[index];
            if (!marker) {
                marker = document.createElement('div');
                marker.className = 'warehouse-map-blink-marker';
                marker.setAttribute('aria-hidden', 'true');
                stack.appendChild(marker);
            }
            marker.style.left = `${rect.left - stackRect.left}px`;
            marker.style.top = `${rect.top - stackRect.top}px`;
            marker.style.width = `${Math.max(rect.width, 6)}px`;
            marker.style.height = `${Math.max(rect.height, 6)}px`;
        });

        for (let i = list.length; i < markers.length; i += 1) {
            markers[i].remove();
        }
    }

    function blinkImageOverlayCells(container, cells) {
        const list = Array.from(cells || []).filter(Boolean);
        if (!list.length || !container) return;

        clearMapLocationBlink();
        clearImageBlinkMarkers(container);
        mapImageBlinkCells = list;

        positionImageBlinkMarkers(container, list);

        mapBlinkClearTimer = setTimeout(() => {
            clearImageBlinkMarkers(container);
            mapBlinkClearTimer = null;
        }, MAP_BLINK_DURATION_MS);
    }

    function repositionImageBlinkMarkers(container) {
        if (!container || !mapImageBlinkCells.length) return;
        if (!container.querySelector('.warehouse-map-blink-marker')) return;
        positionImageBlinkMarkers(container, mapImageBlinkCells);
    }

    function applyMapHighlightsAfterImageSync(container, searchTerm, productLocations, options) {
        if (!container) return;
        const runHighlights = () => {
            syncImageOverlaySize(container);
            applyLocationSearch(searchTerm || '', productLocations, options);
            requestAnimationFrame(() => {
                syncImageOverlaySize(container);
                repositionImageBlinkMarkers(container);
            });
        };
        syncImageOverlaySize(container);
        requestAnimationFrame(() => {
            requestAnimationFrame(runHighlights);
        });
    }

    function collectProductLocationPositions(gridData, productLocations) {
        const positions = [];
        if (!gridData || !gridData.rows || !gridData.rows.length) {
            return { positions, rowCount: 0, colCount: 0 };
        }

        const { rows, rowCount, colCount } = gridData;
        rows.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
                if (classifyCell(value) !== 'location') return;
                const mapLoc = normalizeCellText(value).toUpperCase();
                const matched = productLocations.some((loc) =>
                    locationMatchesMapCell(getLocationCodeFromProductItem(loc), mapLoc)
                );
                if (matched) {
                    positions.push({ rowIndex, colIndex, locationCode: mapLoc });
                }
            });
        });

        return { positions, rowCount, colCount };
    }

    function computeMapBoundsFromLocations(locations) {
        let minRow = Infinity;
        let maxRow = -1;
        let minCol = Infinity;
        let maxCol = -1;

        Object.values(locations || {}).forEach((pos) => {
            minRow = Math.min(minRow, pos.row);
            maxRow = Math.max(maxRow, pos.row);
            minCol = Math.min(minCol, pos.col);
            maxCol = Math.max(maxCol, pos.col);
        });

        if (!Number.isFinite(minRow)) {
            return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
        }

        return { minRow, maxRow, minCol, maxCol };
    }

    function getMapBounds(locationIndex) {
        if (locationIndex && locationIndex.mapBounds) {
            return locationIndex.mapBounds;
        }
        if (locationIndex && locationIndex.locations) {
            return computeMapBoundsFromLocations(locationIndex.locations);
        }
        return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }

    function getImageMapArea(locationIndex) {
        if (locationIndex && locationIndex.imageArea) {
            return locationIndex.imageArea;
        }
        return DEFAULT_IMAGE_MAP_AREA;
    }

    function getImageCorners(locationIndex) {
        if (locationIndex && locationIndex.imageCorners) {
            return locationIndex.imageCorners;
        }
        return DEFAULT_IMAGE_CORNERS;
    }

    function getCalibrationAnchors(locationIndex) {
        if (locationIndex && locationIndex.calibrationAnchors) {
            return locationIndex.calibrationAnchors;
        }
        return DEFAULT_CALIBRATION_ANCHORS;
    }

    function getGridAnchorCorners(locationIndex) {
        if (!locationIndex || !locationIndex.locations) return null;
        const anchorCodes = getCalibrationAnchors(locationIndex);
        const corners = {};
        for (const key of ['tl', 'tr', 'bl', 'br']) {
            const code = anchorCodes[key];
            const pos = locationIndex.locations[code];
            if (!pos) return null;
            corners[key] = { x: pos.col, y: pos.row };
        }
        return corners;
    }

    function bilinearForward2D(u, v, corners) {
        const { tl, tr, bl, br } = corners;
        return {
            x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + (1 - u) * v * bl.x + u * v * br.x,
            y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + (1 - u) * v * bl.y + u * v * br.y
        };
    }

    function solveInverseBilinear2D(point, corners, maxIter = 30) {
        let u = 0.5;
        let v = 0.5;
        for (let i = 0; i < maxIter; i++) {
            const p = bilinearForward2D(u, v, corners);
            const errX = point.x - p.x;
            const errY = point.y - p.y;
            if (Math.abs(errX) < 0.05 && Math.abs(errY) < 0.05) break;

            const eps = 0.001;
            const pu = bilinearForward2D(Math.min(u + eps, 1), v, corners);
            const pv = bilinearForward2D(u, Math.min(v + eps, 1), corners);
            const duX = (pu.x - p.x) / eps;
            const duY = (pu.y - p.y) / eps;
            const dvX = (pv.x - p.x) / eps;
            const dvY = (pv.y - p.y) / eps;
            const det = duX * dvY - duY * dvX;
            if (Math.abs(det) < 1e-10) break;
            u += (errX * dvY - errY * dvX) / det;
            v += (-errX * duY + errY * duX) / det;
            u = Math.min(Math.max(u, 0), 1);
            v = Math.min(Math.max(v, 0), 1);
        }
        return { u, v };
    }

    function gridPointToImage(col, row, gridAnchorCorners, imageCorners) {
        const uv = solveInverseBilinear2D({ x: col, y: row }, gridAnchorCorners);
        return bilinearImagePoint(uv.u, uv.v, imageCorners);
    }

    function getMainRackSubGrid(locationIndex) {
        if (!locationIndex || !locationIndex.locations) return null;
        const locs = locationIndex.locations;
        const h1 = locs.H1;
        const h33 = locs.H33;
        const b1 = locs.B1;
        const b33 = locs.B33;
        if (!h1 || !h33 || !b1 || !b33) return null;
        return {
            tl: { x: h1.col, y: h1.row },
            tr: { x: h33.col, y: h33.row },
            bl: { x: b1.col, y: b1.row },
            br: { x: b33.col, y: b33.row }
        };
    }

    function getASectorSubGrid(locationIndex) {
        if (!locationIndex || !locationIndex.locations) return null;
        const locs = locationIndex.locations;
        const a1 = locs.A1;
        const aTopRight = locs.A76 || locs.A75;
        const a49 = locs.A49;
        const a72 = locs.A72;
        if (!a1 || !aTopRight || !a49 || !a72) return null;
        return {
            tl: { x: a1.col, y: a1.row },
            tr: { x: aTopRight.col, y: aTopRight.row },
            bl: { x: a49.col, y: a49.row },
            br: { x: a72.col, y: a72.row }
        };
    }

    function getIJSubGrid(locationIndex) {
        if (!locationIndex || !locationIndex.locations) return null;
        const locs = locationIndex.locations;
        const i8 = locs.I8;
        const topRight = locs.J6 || locs.I9;
        const i1 = locs.I1;
        const j1 = locs.J1;
        if (!i8 || !topRight || !i1 || !j1) return null;
        return {
            tl: { x: i8.col, y: i8.row },
            tr: { x: topRight.col, y: topRight.row },
            bl: { x: i1.col, y: i1.row },
            br: { x: j1.col, y: j1.row }
        };
    }

    function getASectorImageCorners(locationIndex, gridAnchors, imageCorners) {
        const subGrid = getASectorSubGrid(locationIndex);
        const mainSub = getMainRackSubGrid(locationIndex);
        if (!subGrid || !mainSub) return null;

        const imgBL = gridPointToImage(subGrid.bl.x, subGrid.bl.y, gridAnchors, imageCorners);
        const imgBR = gridPointToImage(subGrid.br.x, subGrid.br.y, gridAnchors, imageCorners);
        const imgMainBL = mapLocationThroughSubGrid(
            mainSub.bl.x, mainSub.bl.y, mainSub, gridAnchors, imageCorners
        );
        const imgMainBR = mapLocationThroughSubGrid(
            mainSub.br.x, mainSub.br.y, mainSub, gridAnchors, imageCorners
        );

        const rowSpan = Math.max(subGrid.bl.y - subGrid.tl.y, 1);
        const vTop = (subGrid.tl.y - mainSub.bl.y) / (subGrid.bl.y - mainSub.bl.y);
        const clampedV = Math.min(Math.max(vTop, 0), 1);

        const extrapTL = {
            x: imgMainBL.x + clampedV * (imgBL.x - imgMainBL.x),
            y: imgMainBL.y + clampedV * (imgBL.y - imgMainBL.y)
        };
        const extrapTR = {
            x: imgMainBR.x + clampedV * (imgBR.x - imgMainBR.x),
            y: imgMainBR.y + clampedV * (imgBR.y - imgMainBR.y)
        };

        return {
            tl: {
                x: Math.min(extrapTL.x, imgMainBL.x - 0.14),
                y: extrapTL.y
            },
            tr: {
                x: Math.max(extrapTR.x, imgMainBR.x + 0.02),
                y: extrapTR.y
            },
            bl: imgBL,
            br: imgBR
        };
    }

    function getIJImageCorners(locationIndex, gridAnchors, imageCorners) {
        const subGrid = getIJSubGrid(locationIndex);
        const mainSub = getMainRackSubGrid(locationIndex);
        if (!subGrid || !mainSub) return null;

        const imgTL = gridPointToImage(subGrid.tl.x, subGrid.tl.y, gridAnchors, imageCorners);
        const imgMainTL = mapLocationThroughSubGrid(
            mainSub.tl.x, mainSub.tl.y, mainSub, gridAnchors, imageCorners
        );
        const imgMainBL = mapLocationThroughSubGrid(
            mainSub.bl.x, mainSub.bl.y, mainSub, gridAnchors, imageCorners
        );
        const imgBL = {
            x: Math.min(imgTL.x, imgMainBL.x - 0.10),
            y: imgTL.y + 0.82 * (imgMainBL.y - imgTL.y)
        };
        const imgTR = {
            x: imgTL.x + 0.50 * (imgMainTL.x - imgTL.x),
            y: imgTL.y + 0.50 * (imgMainTL.y - imgTL.y)
        };
        const imgBR = {
            x: imgBL.x + 0.50 * (imgMainBL.x - imgBL.x),
            y: imgBL.y + 0.50 * (imgMainBL.y - imgBL.y)
        };

        return { tl: imgTL, tr: imgTR, bl: imgBL, br: imgBR };
    }

    function mapLocationThroughSubGrid(col, row, subGrid, gridAnchors, imageCorners) {
        const uv = solveInverseBilinear2D({ x: col, y: row }, subGrid);
        const imgCorners = {
            tl: gridPointToImage(subGrid.tl.x, subGrid.tl.y, gridAnchors, imageCorners),
            tr: gridPointToImage(subGrid.tr.x, subGrid.tr.y, gridAnchors, imageCorners),
            bl: gridPointToImage(subGrid.bl.x, subGrid.bl.y, gridAnchors, imageCorners),
            br: gridPointToImage(subGrid.br.x, subGrid.br.y, gridAnchors, imageCorners)
        };
        return bilinearImagePoint(uv.u, uv.v, imgCorners);
    }

    function mapLocationThroughSubGridWithImageCorners(col, row, subGrid, imgCorners) {
        const uv = solveInverseBilinear2D({ x: col, y: row }, subGrid);
        return bilinearImagePoint(uv.u, uv.v, imgCorners);
    }

    function bilinearImagePoint(u, v, corners) {
        const clampedU = Math.min(Math.max(u, 0), 1);
        const clampedV = Math.min(Math.max(v, 0), 1);
        const topX = corners.tl.x + clampedU * (corners.tr.x - corners.tl.x);
        const topY = corners.tl.y + clampedU * (corners.tr.y - corners.tl.y);
        const botX = corners.bl.x + clampedU * (corners.br.x - corners.bl.x);
        const botY = corners.bl.y + clampedU * (corners.br.y - corners.bl.y);
        return {
            x: topX + clampedV * (botX - topX),
            y: topY + clampedV * (botY - topY)
        };
    }

    function buildVisualGrid(locationIndex) {
        const visualByCode = {};
        if (!locationIndex || !locationIndex.locations) {
            return { mainRows: [], visualByCode, binCount: 33 };
        }

        const rowBinCount = new Map();
        Object.entries(locationIndex.locations).forEach(([code, pos]) => {
            if (!MAIN_RACK_CODE_RE.test(code)) return;
            rowBinCount.set(pos.row, (rowBinCount.get(pos.row) || 0) + 1);
        });

        const mainRows = [...rowBinCount.entries()]
            .filter(([, count]) => count >= 28)
            .sort((a, b) => a[0] - b[0])
            .map(([row]) => row);

        let binCount = 33;
        mainRows.forEach((row, rowIndex) => {
            const bins = Object.entries(locationIndex.locations)
                .filter(([code, pos]) => pos.row === row && MAIN_RACK_CODE_RE.test(code))
                .sort((a, b) => a[1].col - b[1].col);

            binCount = Math.max(binCount, bins.length);
            const maxColIndex = Math.max(bins.length - 1, 1);
            const v = mainRows.length > 1 ? rowIndex / (mainRows.length - 1) : 0;

            bins.forEach(([code], colIndex) => {
                visualByCode[code] = {
                    u: colIndex / maxColIndex,
                    v
                };
            });
        });

        return { mainRows, visualByCode, binCount };
    }

    function getVisualGrid(locationIndex) {
        return buildVisualGrid(locationIndex);
    }

    function getLocationVisualPoint(locationCode, locationIndex) {
        if (!locationIndex || !locationIndex.locations) return null;

        const normalized = locationIndex.visualGrid
            ? locationIndex
            : normalizeLocationIndex(locationIndex);
        const pos = normalized.locations[locationCode];
        if (!pos) return null;

        const imageCorners = getImageCorners(normalized);
        const gridAnchors = getGridAnchorCorners(normalized);
        if (!gridAnchors) return null;

        const code = String(locationCode || '').trim().toUpperCase();

        if (MAIN_RACK_CODE_RE.test(code)) {
            const subGrid = getMainRackSubGrid(normalized);
            if (subGrid) {
                return mapLocationThroughSubGrid(pos.col, pos.row, subGrid, gridAnchors, imageCorners);
            }
        }

        if (/^A\d+$/i.test(code)) {
            const subGrid = getASectorSubGrid(normalized);
            const imgCorners = getASectorImageCorners(normalized, gridAnchors, imageCorners);
            if (subGrid && imgCorners) {
                return mapLocationThroughSubGridWithImageCorners(pos.col, pos.row, subGrid, imgCorners);
            }
        }

        if (AISLE_CODE_RE.test(code)) {
            const subGrid = getIJSubGrid(normalized);
            const imgCorners = getIJImageCorners(normalized, gridAnchors, imageCorners);
            if (subGrid && imgCorners) {
                return mapLocationThroughSubGridWithImageCorners(pos.col, pos.row, subGrid, imgCorners);
            }
        }

        return gridPointToImage(pos.col, pos.row, gridAnchors, imageCorners);
    }

    function getSectorLetterFromLocationCode(locationCode) {
        const code = String(locationCode || '').trim().toUpperCase();
        return code && /^[A-Z]/.test(code) ? code.charAt(0) : '';
    }

    function locationCircleMarkerStyles(rowIndex, colIndex, locationIndex, locationCode) {
        const code = locationCode || '';
        const point = getLocationVisualPoint(code, locationIndex);
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            return { left: '0%', top: '0%', width: '2%', height: '2%' };
        }

        const corners = getImageCorners(locationIndex);
        const visualGrid = getVisualGrid(locationIndex);
        const topSpan = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
        const binCount = Math.max(visualGrid.binCount || 33, 1);
        const diameter = Math.min(topSpan / binCount * 1.15, 0.038);

        return {
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            width: `${diameter * 100}%`,
            height: `${diameter * 100}%`
        };
    }

    function locationMarkerStyles(rowIndex, colIndex, locationIndex, locationCode) {
        return locationCircleMarkerStyles(rowIndex, colIndex, locationIndex, locationCode);
    }

    function normalizeLocationIndex(locationIndex) {
        if (!locationIndex) return null;
        const normalized = { ...locationIndex };
        if (!normalized.mapBounds && normalized.locations) {
            normalized.mapBounds = computeMapBoundsFromLocations(normalized.locations);
        }
        if (!normalized.imageArea) {
            normalized.imageArea = { ...DEFAULT_IMAGE_MAP_AREA };
        }
        if (!normalized.imageCorners) {
            normalized.imageCorners = { ...DEFAULT_IMAGE_CORNERS };
        }
        if (!normalized.calibrationAnchors) {
            normalized.calibrationAnchors = { ...DEFAULT_CALIBRATION_ANCHORS };
        }
        normalized.visualGrid = buildVisualGrid(normalized);
        return normalized;
    }

    function buildLocationIndexFromGrid(gridData) {
        const locations = {};
        if (!gridData || !gridData.rows || !gridData.rows.length) {
            return {
                version: 1,
                generatedAt: new Date().toISOString(),
                source: 'excel',
                rowCount: 0,
                colCount: 0,
                mapBounds: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 },
                imageArea: DEFAULT_IMAGE_MAP_AREA,
                imageCorners: DEFAULT_IMAGE_CORNERS,
                calibrationAnchors: { ...DEFAULT_CALIBRATION_ANCHORS },
                locations
            };
        }

        gridData.rows.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
                if (classifyCell(value) !== 'location') return;
                const code = normalizeCellText(value).toUpperCase();
                if (!code) return;
                locations[code] = { row: rowIndex, col: colIndex };
            });
        });

        return {
            version: 1,
            generatedAt: new Date().toISOString(),
            source: 'excel',
            rowCount: gridData.rowCount,
            colCount: gridData.colCount,
            mapBounds: computeMapBoundsFromLocations(locations),
            imageArea: DEFAULT_IMAGE_MAP_AREA,
            imageCorners: DEFAULT_IMAGE_CORNERS,
            calibrationAnchors: { ...DEFAULT_CALIBRATION_ANCHORS },
            locations
        };
    }

    function collectProductLocationPositionsFromIndex(locationIndex, productLocations) {
        const positions = [];
        if (!locationIndex || !locationIndex.locations) {
            return { positions, locationIndex };
        }

        const seen = new Set();

        productLocations.forEach((loc) => {
            const productCode = getLocationCodeFromProductItem(loc);
            const mapKey = findLocationKeyInIndex(locationIndex, productCode);
            if (!mapKey) return;

            const pos = locationIndex.locations[mapKey];
            const slot = `${pos.row}:${pos.col}`;
            if (seen.has(slot)) return;
            seen.add(slot);
            positions.push({
                rowIndex: pos.row,
                colIndex: pos.col,
                locationCode: mapKey
            });
        });

        return { positions, locationIndex };
    }

    function resolveImageBlinkPositions(opts, productLocations) {
        const locationIndex = opts && opts.locationIndex ? opts.locationIndex : null;
        const gridData = opts && opts.gridData ? opts.gridData : null;

        if (locationIndex && locationIndex.locations) {
            return collectProductLocationPositionsFromIndex(locationIndex, productLocations);
        }
        if (gridData && gridData.rows && gridData.rows.length) {
            const index = buildLocationIndexFromGrid(gridData);
            return collectProductLocationPositionsFromIndex(index, productLocations);
        }
        return { positions: [], locationIndex: null };
    }

    function blinkImageMapPositions(container, positions, locationIndex) {
        if (!container || !positions.length || !locationIndex) return;

        clearMapLocationBlink();
        clearImageBlinkMarkers(container);

        const stack = container.querySelector('.warehouse-map-image-only-stack')
            || container.querySelector('.warehouse-map-image-overlay-stack');
        if (!stack) return;

        let markerLayer = stack.querySelector('.warehouse-map-marker-layer');
        if (!markerLayer) {
            markerLayer = document.createElement('div');
            markerLayer.className = 'warehouse-map-marker-layer';
            markerLayer.setAttribute('aria-hidden', 'true');
            stack.appendChild(markerLayer);
        }

        positions.forEach(({ rowIndex, colIndex, locationCode }) => {
            const marker = document.createElement('div');
            marker.className = 'warehouse-map-blink-marker is-blinking';
            marker.setAttribute('aria-hidden', 'true');
            if (locationCode) {
                marker.setAttribute('data-location', locationCode);
                marker.title = locationCode;
            }

            const sector = getSectorLetterFromLocationCode(locationCode);
            if (sector) {
                marker.classList.add(`sector-${sector.toLowerCase()}`);
            }

            const style = locationCircleMarkerStyles(rowIndex, colIndex, locationIndex, locationCode);
            const point = getLocationVisualPoint(locationCode, locationIndex);
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
            marker.style.left = style.left;
            marker.style.top = style.top;
            marker.style.width = style.width;
            marker.style.height = style.height;
            markerLayer.appendChild(marker);
        });

        if (!markerLayer.children.length) return;

        mapBlinkClearTimer = setTimeout(() => {
            clearImageBlinkMarkers(container);
            mapBlinkClearTimer = null;
        }, MAP_BLINK_DURATION_MS);
    }

    function renderImageWarehouseMap(containerId, imageUrl, options) {
        const container = document.getElementById(containerId);
        if (!container || !imageUrl) return;

        const opts = options || {};
        const productLocations = Array.isArray(opts.productLocations) ? opts.productLocations : [];
        const locationIndex = opts.locationIndex
            ? normalizeLocationIndex(opts.locationIndex)
            : null;
        const locationCount = locationIndex && locationIndex.locations
            ? Object.keys(locationIndex.locations).length
            : 0;
        const searchTerm = String(opts.searchTerm || '').trim().toUpperCase();
        let statusNote = '';

        container.innerHTML = `
            <div class="warehouse-map-meta">
                <span><strong>Map:</strong> 3D Image</span>
                ${locationCount ? `<span><strong>Excel bins:</strong> ${locationCount}</span>` : '<span class="warehouse-map-warn">Upload Excel for bin coordinates</span>'}
            </div>
            <div class="warehouse-map-image-only-stack">
                <img class="warehouse-map-image-only" src="${escapeHtml(imageUrl)}" alt="Warehouse map image">
                <div class="warehouse-map-marker-layer" aria-hidden="true"></div>
            </div>`;

        const runBlink = () => {
            if (!locationIndex) return;

            if (opts.blinkProductMatches && productLocations.length) {
                const { positions } = resolveImageBlinkPositions(opts, productLocations);
                if (positions.length) {
                    blinkImageMapPositions(container, positions, locationIndex);
                } else {
                    statusNote = 'Location not found on map (check Excel coordinates).';
                }
                return;
            }

            if (searchTerm) {
                const mapKey = findLocationKeyInIndex(locationIndex, searchTerm);
                if (mapKey) {
                    const pos = locationIndex.locations[mapKey];
                    blinkImageMapPositions(container, [{
                        rowIndex: pos.row,
                        colIndex: pos.col,
                        locationCode: mapKey
                    }], locationIndex);
                } else {
                    statusNote = `Bin "${searchTerm}" not in Excel map.`;
                }
            }
        };

        const img = container.querySelector('.warehouse-map-image-only');
        const showStatus = () => {
            if (!statusNote) return;
            const meta = container.querySelector('.warehouse-map-meta');
            if (meta) {
                meta.insertAdjacentHTML('beforeend', `<span class="warehouse-map-warn">${escapeHtml(statusNote)}</span>`);
            }
        };

        if (img) {
            if (img.complete && img.naturalWidth > 0) {
                runBlink();
                showStatus();
            } else {
                img.addEventListener('load', () => {
                    runBlink();
                    showStatus();
                }, { once: true });
            }
        }
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

        const backgroundImageUrl = options && options.backgroundImageUrl ? String(options.backgroundImageUrl) : '';
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

        if (backgroundImageUrl) {
            container.innerHTML = `
                <div class="warehouse-map-meta">
                    <span><strong>Map:</strong> Image overlay</span>
                    <span><strong>Rows:</strong> ${gridData.rowCount}</span>
                    <span><strong>Columns:</strong> ${gridData.colCount}</span>
                </div>
                <div class="warehouse-map-image-overlay-stack">
                    <img class="warehouse-map-overlay-image" src="${escapeHtml(backgroundImageUrl)}" alt="Warehouse map image">
                    <div class="warehouse-map-overlay-wrap">
                        <table class="warehouse-map-table warehouse-map-table-overlay" id="warehouseMapTable">
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </div>`;

            const img = container.querySelector('.warehouse-map-overlay-image');
            const productLocations = options && Array.isArray(options.productLocations) ? options.productLocations : [];
            const onImageReady = () => {
                applyMapHighlightsAfterImageSync(container, searchTerm, productLocations, options);
            };
            if (img) {
                if (img.complete && img.naturalWidth > 0) onImageReady();
                else img.addEventListener('load', onImageReady, { once: true });
            } else {
                applyLocationSearch(searchTerm || '', productLocations, options);
            }
        } else {
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

        keys.add(prod);
        const noSide = prod.replace(/[RLM]$/, '');
        keys.add(noSide);

        const simple = noSide.match(/^([A-Z])(\d+)$/);
        if (simple) {
            keys.add(simple[1] + String(Number(simple[2])));
        }

        const parseFn = global.LocationCodeUtils && global.LocationCodeUtils.parseLocationCode;
        const parsed = parseFn ? parseFn(prod) : null;
        if (parsed && parsed.street) {
            const street = parsed.street;
            if (parsed.building !== '' && parsed.level !== '' && parsed.level !== '0') {
                keys.add(street + parsed.building + parsed.level);
                keys.add(street + String(Number(parsed.building)) + String(Number(parsed.level)));
            }
            if (parsed.building !== '') {
                keys.add(street + parsed.building);
                keys.add(street + String(Number(parsed.building)));
            }
        }

        return keys;
    }

    function findLocationKeyInIndex(locationIndex, productLocation) {
        if (!locationIndex || !locationIndex.locations) return null;
        const candidates = Array.from(getMapMatchKeys(productLocation))
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);
        for (let i = 0; i < candidates.length; i++) {
            if (locationIndex.locations[candidates[i]]) {
                return candidates[i];
            }
        }
        return null;
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
        clearImageBlinkMarkers();
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
            const isImageOverlay = table.classList.contains('warehouse-map-table-overlay');
            if (isImageOverlay) {
                const container = table.closest('#warehouseMapContainer');
                blinkImageOverlayCells(container, productMatchCells);
            } else {
                blinkMapLocationCells(productMatchCells);
            }
        }

        setupProductLocationTooltips(table, productLocations);

        if (options && options.scrollToTop) {
            scrollMapToTop();
        } else if (firstScrollTarget && (!options || options.autoScrollToMatch !== false)) {
            firstScrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    function scrollMapToTop() {
        const container = document.getElementById('warehouseMapContainer');
        const imageStack = container && container.querySelector('.warehouse-map-image-only-stack');
        if (imageStack) {
            imageStack.scrollIntoView({ behavior: 'auto', block: 'start' });
            return;
        }

        const wrap = getMapWrapElement();
        if (wrap) {
            wrap.scrollTop = 0;
            wrap.scrollLeft = 0;
        }
    }

    function getMapWrapElement() {
        const table = document.getElementById('warehouseMapTable');
        if (!table) return null;
        return table.closest('.warehouse-map-wrap')
            || table.closest('.warehouse-map-image-only-stack')
            || table.closest('.warehouse-map-image-overlay-stack');
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
        const container = document.getElementById('warehouseMapContainer');
        const imageStack = container && container.querySelector('.warehouse-map-image-only-stack');
        if (imageStack && container) {
            const keys = Array.from(getMapMatchKeys(locationCode))
                .filter(Boolean)
                .sort((a, b) => b.length - a.length);
            const matchCode = keys.find((key) => {
                const marker = imageStack.querySelector(`[data-location="${key}"]`);
                return Boolean(marker);
            });
            if (matchCode) {
                const marker = imageStack.querySelector(`[data-location="${matchCode}"]`);
                if (marker) {
                    marker.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
                return;
            }
        }

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
            const isImageOverlay = table.classList.contains('warehouse-map-table-overlay');
            if (isImageOverlay) {
                const container = table.closest('#warehouseMapContainer');
                syncImageOverlaySize(container);
                blinkImageOverlayCells(container, [target]);
            } else {
                blinkMapLocationCells([target]);
            }
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
        DEFAULT_IMAGE_CORNERS,
        DEFAULT_CALIBRATION_ANCHORS,
        parseWorkbookBuffer,
        renderWarehouseMap,
        renderImageWarehouseMap,
        buildLocationIndexFromGrid,
        normalizeLocationIndex,
        getLocationVisualPoint,
        locationCircleMarkerStyles,
        collectProductLocationPositionsFromIndex,
        resolveImageBlinkPositions,
        syncImageOverlaySize,
        repositionImageBlinkMarkers,
        applyLocationSearch,
        highlightProductLocations,
        scrollToProductLocation,
        scrollMapToTop,
        locationMatchesMapCell,
        getMapMatchKeys,
        findLocationKeyInIndex,
        loadServerMap
    };
})(window);
