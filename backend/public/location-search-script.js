const LOCATIONS_API_URL = '/api/locations';
let locations = [];
let filteredLocations = [];

function escapeXml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatExportFileDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

let loggedUserExportPrefix = null;

function sanitizeFileNamePart(value) {
    return String(value == null ? '' : value)
        .trim()
        .toLowerCase()
        .replace(/@/g, '_at_')
        .replace(/[^a-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'user';
}

async function getLoggedUserExportPrefix() {
    if (loggedUserExportPrefix) return loggedUserExportPrefix;

    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (data.authenticated && data.user) {
            if (data.user.isRoot) {
                loggedUserExportPrefix = 'root';
            } else if (data.user.email) {
                loggedUserExportPrefix = sanitizeFileNamePart(data.user.email);
            } else {
                loggedUserExportPrefix = 'user';
            }
        } else {
            loggedUserExportPrefix = 'user';
        }
    } catch {
        loggedUserExportPrefix = 'user';
    }

    return loggedUserExportPrefix;
}

function getLocationSection(loc) {
    if (!loc) return 'OTHER';
    const value = loc.section != null ? loc.section : loc.Section;
    const normalized = value != null ? String(value).trim() : '';
    return normalized || 'OTHER';
}

function formatSection(section) {
    const normalized = section != null ? String(section).trim() : '';
    if (!normalized) return '-';
    const map = {
        TAPWARE: 'Tapware',
        BATHWARE: 'BathWare',
        WAREHOUSE2: 'Warehouse2',
        FURNITUREWARE: 'Furniture',
        DOORWARE: 'Doorware',
        OTHER: 'Other'
    };
    return map[normalized.toUpperCase()] || normalized;
}

function getLocationPartsForExport(loc) {
    const parsed = LocationCodeUtils.parseLocationCode(loc.location || '');
    return {
        street: parsed.street || '',
        building: parsed.building || '',
        level: parsed.level || '',
        sublevel: parsed.sublevel || '',
        side: parsed.side || ''
    };
}

function getUsuarioInseriuNome(loc) {
    if (!loc) return '';
    if (loc.usuarioInseriuNome) return loc.usuarioInseriuNome;
    if (loc.usuario_inseriu_nome) return loc.usuario_inseriu_nome;
    const key = loc.usuarioInseriu != null ? String(loc.usuarioInseriu).trim().toLowerCase()
        : (loc.usuario_inseriu != null ? String(loc.usuario_inseriu).trim().toLowerCase() : '');
    if (key === 'root') return 'Root';
    return '';
}

function getInsertedAt(loc) {
    const raw = loc.criadoEm != null ? loc.criadoEm : loc.criado_em;
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildLocationsExcelXml(list) {
    const headers = ['Street', 'Building', 'Level', 'Sublevel', 'Side', 'Location', 'Status', 'Access Type', 'Section', 'Inserted By', 'Inserted At'];
    const headerRow = headers.map((header) =>
        `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
    ).join('');

    const dataRows = list.map((loc) => {
        const parts = getLocationPartsForExport(loc);
        const statusLabel = loc.status === 'active' ? 'Active' : 'Inactive';
        const sectionLabel = formatSection(getLocationSection(loc));
        const cells = [
            parts.street,
            parts.building,
            parts.level,
            parts.sublevel,
            parts.side,
            loc.location || '',
            statusLabel,
            loc.accessType || loc.access_type || '',
            sectionLabel,
            getUsuarioInseriuNome(loc),
            getInsertedAt(loc)
        ].map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join('');
        return `<Row>${cells}</Row>`;
    }).join('');

    const rowCount = list.length + 1;
    const columnCount = headers.length;

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Locations">
<Table ss:ExpandedColumnCount="${columnCount}" ss:ExpandedRowCount="${rowCount}">
<Column ss:Width="60"/>
<Column ss:Width="70"/>
<Column ss:Width="50"/>
<Column ss:Width="70"/>
<Column ss:Width="50"/>
<Column ss:Width="120"/>
<Column ss:Width="80"/>
<Column ss:Width="140"/>
<Column ss:Width="120"/>
<Column ss:Width="140"/>
<Column ss:Width="150"/>
<Row>${headerRow}</Row>
${dataRows}
</Table>
</Worksheet>
</Workbook>`;
}

async function downloadLocationsExcel(list) {
    if (!list.length) {
        alert('No locations to export. Adjust filters or run Search first.');
        return;
    }

    const userPrefix = await getLoggedUserExportPrefix();
    const xml = buildLocationsExcelXml(list);
    const blob = new Blob(['\ufeff', xml], {
        type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userPrefix}-locations-search-${formatExportFileDate(new Date())}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const SEARCH_FIELD_IDS = {
    streetId: 'searchLocationStreet',
    buildingId: 'searchLocationBuilding',
    levelId: 'searchLocationLevel',
    sideId: 'searchLocationSide',
    sublevelId: 'searchLocationSublevel',
    codeId: 'searchLocation',
    sideGroupId: 'searchLocationSideGroup',
    sublevelGroupId: 'searchLocationSublevelGroup',
    levelZeroModeId: 'searchLocationLevelZeroMode',
    levelZeroModeGroupId: 'searchLocationLevelZeroModeGroup'
};

const EDIT_FIELD_IDS = {
    streetId: 'editLocationStreet',
    buildingId: 'editLocationBuilding',
    levelId: 'editLocationLevel',
    sideId: 'editLocationSide',
    sublevelId: 'editLocationSublevel',
    codeId: 'editLocationCode',
    sideGroupId: 'editLocationSideGroup',
    sublevelGroupId: 'editLocationSublevelGroup',
    levelZeroModeId: 'editLocationLevelZeroMode',
    levelZeroModeGroupId: 'editLocationLevelZeroModeGroup',
    accessTypeId: 'editAccessType'
};

function setupHeaderDropdowns() {
    const usersMenuBtn = document.getElementById('usersMenuBtn');
    const usersDropdownMenu = document.getElementById('usersDropdownMenu');
    const productMenuBtn = document.getElementById('productMenuBtn');
    const productDropdownMenu = document.getElementById('productDropdownMenu');
    const applicationsMenuBtn = document.getElementById('applicationsMenuBtn');
    const applicationsDropdownMenu = document.getElementById('applicationsDropdownMenu');
    const locationMenuBtn = document.getElementById('locationMenuBtn');
    const locationDropdownMenu = document.getElementById('locationDropdownMenu');
    const locationProductMenuBtn = document.getElementById('locationProductMenuBtn');
    const locationProductDropdownMenu = document.getElementById('locationProductDropdownMenu');
    const movementMenuBtn = document.getElementById('movementMenuBtn');
    const movementDropdownMenu = document.getElementById('movementDropdownMenu');
    const pickingMenuBtn = document.getElementById('pickingMenuBtn');
    const pickingDropdownMenu = document.getElementById('pickingDropdownMenu');
    const customerMenuBtn = document.getElementById('customerMenuBtn');
    const customerDropdownMenu = document.getElementById('customerDropdownMenu');
    const helpMenuBtn = document.getElementById('helpMenuBtn');
    const helpDropdownMenu = document.getElementById('helpDropdownMenu');

    function closeAll() {
        [usersDropdownMenu, productDropdownMenu, applicationsDropdownMenu, locationDropdownMenu, locationProductDropdownMenu, movementDropdownMenu, pickingDropdownMenu, customerDropdownMenu, helpDropdownMenu].forEach(el => {
            if (el) el.setAttribute('aria-hidden', 'true');
        });
        [usersMenuBtn, productMenuBtn, applicationsMenuBtn, locationMenuBtn, locationProductMenuBtn, movementMenuBtn, pickingMenuBtn, customerMenuBtn, helpMenuBtn].forEach(el => {
            if (el) el.setAttribute('aria-expanded', 'false');
        });
    }
    if (usersMenuBtn && usersDropdownMenu) {
        usersMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = usersDropdownMenu.getAttribute('aria-hidden') !== 'true';
            usersDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            usersMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (productMenuBtn && productDropdownMenu) {
        productMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = productDropdownMenu.getAttribute('aria-hidden') !== 'true';
            productDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            productMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (applicationsMenuBtn && applicationsDropdownMenu) {
        applicationsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = applicationsDropdownMenu.getAttribute('aria-hidden') !== 'true';
            applicationsDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            applicationsMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (locationMenuBtn && locationDropdownMenu) {
        locationMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = locationDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (locationProductMenuBtn && locationProductDropdownMenu) {
        locationProductMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = locationProductDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationProductDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationProductMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (movementMenuBtn && movementDropdownMenu) {
        movementMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = movementDropdownMenu.getAttribute('aria-hidden') !== 'true';
            movementDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            movementMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (pickingMenuBtn && pickingDropdownMenu) {
        pickingMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = pickingDropdownMenu.getAttribute('aria-hidden') !== 'true';
            pickingDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            pickingMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (customerMenuBtn && customerDropdownMenu) {
        customerMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = customerDropdownMenu.getAttribute('aria-hidden') !== 'true';
            customerDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            customerMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (helpMenuBtn && helpDropdownMenu) {
        helpMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAll();
            const open = helpDropdownMenu.getAttribute('aria-hidden') !== 'true';
            helpDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            helpMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    const newProductBtn = document.getElementById('newProductBtn');
    const searchProductBtn = document.getElementById('searchProductBtn');
    if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
    if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
    document.addEventListener('click', closeAll);
}

document.addEventListener('DOMContentLoaded', () => {
    LocationCodeUtils.setupLocationComposition(SEARCH_FIELD_IDS, {
      allowPartial: true,
      allowDirectCodeEntry: true
    });
    LocationCodeUtils.setupLocationComposition(EDIT_FIELD_IDS);

    let hasSearched = false;

    function revealSearchPanel() {
        const target = document.getElementById('locationSearchPanel');
        if (!target) return;
        const offset = 8;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }

    requestAnimationFrame(() => {
        revealSearchPanel();
        setTimeout(revealSearchPanel, 50);
    });
    window.addEventListener('load', revealSearchPanel);

    const searchLocationInput = document.getElementById('searchLocation');
    const filterStatusSelect = document.getElementById('filterLocationStatus');
    const filterAccessSelect = document.getElementById('filterAccessType');
    const clearSearchBtn = document.getElementById('clearLocationSearch');
    const applySearchBtn = document.getElementById('applyLocationSearch');
    const resultsCountEl = document.getElementById('locationsResultsCount');
    const editModal = document.getElementById('editLocationModal');
    const editForm = document.getElementById('editLocationForm');
    const closeEditBtn = document.getElementById('closeEditLocationModal');
    const cancelEditBtn = document.getElementById('cancelEditLocation');

    function showEmptyStateInitial() {
        hasSearched = false;
        locations = [];
        filteredLocations = [];
        const tbody = document.getElementById('locationsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Use filters and click <strong>Search</strong> to load locations.</p>
                    </td>
                </tr>
            `;
        }
        if (resultsCountEl) resultsCountEl.textContent = '';
    }

    function renderLocations(list) {
        const tbody = document.getElementById('locationsTableBody');
        if (!tbody) return;

        if (!hasSearched) {
            showEmptyStateInitial();
            return;
        }

        if (!list.length) {
            tbody.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-search-location"></i>
                        <p>No locations found.</p>
                    </td>
                </tr>
            `;
            resultsCountEl.textContent = '0 locations';
            return;
        }

        tbody.innerHTML = list.map(loc => `
            <tr class="mobile-result-row">
                <td data-label="Location">${escapeHtml(loc.location)}</td>
                <td data-label="Status">${loc.status === 'active' ? 'Active' : 'Inactive'}</td>
                <td data-label="Access Type">${escapeHtml(loc.accessType || '-')}</td>
                <td data-label="Section">${escapeHtml(formatSection(getLocationSection(loc)))}</td>
                <td data-label="Actions" class="td-actions">
                    <div class="action-buttons loc-result-actions">
                        <button type="button" class="loc-action-btn btn-edit" data-id="${escapeHtml(loc.id || '')}" title="Edit">
                            <i class="fas fa-edit"></i><span>Edit</span>
                        </button>
                        <button type="button" class="loc-action-btn btn-print" data-location="${escapeHtml(loc.location || '')}" title="Print bin label">
                            <i class="fas fa-print"></i><span>Print</span>
                        </button>
                        <button type="button" class="loc-action-btn btn-delete" data-id="${escapeHtml(loc.id || '')}" data-location="${escapeHtml(loc.location || '')}" title="Delete">
                            <i class="fas fa-trash-alt"></i><span>Delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        resultsCountEl.textContent = `${list.length} location${list.length > 1 ? 's' : ''}`;
    }

    const printBinLabelModal = document.getElementById('printBinLabelModal');
    const printBinLabelCodeEl = document.getElementById('printBinLabelCode');
    const printBinLabelPreset = document.getElementById('printBinLabelPreset');
    const printBinLabelWidth = document.getElementById('printBinLabelWidth');
    const printBinLabelHeight = document.getElementById('printBinLabelHeight');
    const printBinLabelSizeError = document.getElementById('printBinLabelSizeError');
    let pendingPrintLocationCode = '';

    function openPrintBinLabelModal(locationCode) {
        const code = String(locationCode || '').trim().toUpperCase();
        if (!code) {
            alert('Location code is missing.');
            return;
        }
        pendingPrintLocationCode = code;
        if (printBinLabelCodeEl) printBinLabelCodeEl.textContent = code;
        if (printBinLabelSizeError) {
            printBinLabelSizeError.style.display = 'none';
            printBinLabelSizeError.textContent = '';
        }
        if (printBinLabelPreset) printBinLabelPreset.value = '100x40';
        if (printBinLabelWidth) {
            printBinLabelWidth.value = '100';
            printBinLabelWidth.readOnly = true;
        }
        if (printBinLabelHeight) {
            printBinLabelHeight.value = '40';
            printBinLabelHeight.readOnly = true;
        }
        if (printBinLabelModal) {
            printBinLabelModal.classList.add('show');
            printBinLabelModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closePrintBinLabelModal() {
        if (printBinLabelModal) {
            printBinLabelModal.classList.remove('show');
            printBinLabelModal.setAttribute('aria-hidden', 'true');
        }
        pendingPrintLocationCode = '';
    }

    function applyPrintPreset() {
        if (!printBinLabelPreset || !printBinLabelWidth || !printBinLabelHeight) return;
        const value = printBinLabelPreset.value;
        if (value === 'custom') {
            printBinLabelWidth.readOnly = false;
            printBinLabelHeight.readOnly = false;
            printBinLabelWidth.focus();
            return;
        }
        const parts = value.split('x');
        printBinLabelWidth.value = parts[0] || '100';
        printBinLabelHeight.value = parts[1] || '40';
        printBinLabelWidth.readOnly = true;
        printBinLabelHeight.readOnly = true;
    }

    function getSelectedPrintSize() {
        const widthMm = Number(printBinLabelWidth && printBinLabelWidth.value);
        const heightMm = Number(printBinLabelHeight && printBinLabelHeight.value);
        if (!Number.isFinite(widthMm) || widthMm < 20 || widthMm > 300) {
            return { error: 'Length (L) must be between 20 and 300 mm.' };
        }
        if (!Number.isFinite(heightMm) || heightMm < 15 || heightMm > 200) {
            return { error: 'Height must be between 15 and 200 mm.' };
        }
        return { widthMm, heightMm };
    }

    function loadImageFromSrc(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }

    function buildLabelLayout(widthMm, heightMm) {
        const scale = Math.min(widthMm / 100, heightMm / 40);
        const brandCol = Math.max(18, Math.round(widthMm * 0.26 * 10) / 10);
        const qrCol = Math.max(12, Math.round(widthMm * 0.20 * 10) / 10);
        const padX = Math.max(1.5, Math.round(widthMm * 0.035 * 10) / 10);
        const padY = Math.max(1.2, Math.round(heightMm * 0.10 * 10) / 10);
        return {
            widthMm,
            heightMm,
            scale,
            brandCol,
            qrCol,
            padX,
            padY,
            brandFont: Math.max(10, Math.round(18 * scale)),
            brandSubFont: Math.max(5, Math.round(6 * scale * 10) / 10),
            titleFont: Math.max(7, Math.round(9 * scale)),
            codeFont: Math.max(14, Math.round(30 * scale)),
            barcodeTextFont: Math.max(7, Math.round(9 * scale)),
            qrSize: Math.max(40, Math.round(Math.min(heightMm * 0.70, qrCol * 0.90) * (96 / 25.4))),
            barcodeHeightPx: Math.max(18, Math.round(26 * scale)),
            pageLandscape: widthMm >= heightMm
        };
    }

    function prepareBinLabelAssets(code, layout) {
        return new Promise((resolve) => {
            const safeCode = escapeHtml(code);
            const temp = document.createElement('div');
            temp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
            document.body.appendChild(temp);

            let barcodeHtml = '';
            try {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.id = 'binLabelBarcode_' + Date.now();
                temp.appendChild(svg);
                JsBarcode(svg, code, {
                    format: 'CODE128',
                    displayValue: false,
                    margin: 0,
                    height: layout.barcodeHeightPx,
                    width: Math.max(1, Math.min(2.4, 1.4 * layout.scale))
                });
                barcodeHtml = svg.outerHTML;
            } catch (err) {
                console.error('Barcode generation error:', err);
                barcodeHtml = '';
            }

            const qrDiv = document.createElement('div');
            temp.appendChild(qrDiv);

            const cleanup = () => {
                try {
                    document.body.removeChild(temp);
                } catch {
                    // ignore
                }
            };

            const finish = (qrDataUrl) => {
                cleanup();
                resolve({ safeCode, barcodeHtml, qrDataUrl: qrDataUrl || '' });
            };

            try {
                new QRCode(qrDiv, {
                    text: code,
                    width: layout.qrSize,
                    height: layout.qrSize,
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (err) {
                console.error('QR generation error:', err);
                finish('');
                return;
            }

            setTimeout(() => {
                let qrDataUrl = '';
                try {
                    const canvas = qrDiv.querySelector('canvas');
                    if (canvas) qrDataUrl = canvas.toDataURL('image/png');
                    if (!qrDataUrl) {
                        const img = qrDiv.querySelector('img');
                        if (img && img.src) qrDataUrl = img.src;
                    }
                } catch (err) {
                    console.error('QR extract error:', err);
                }
                finish(qrDataUrl);
            }, 120);
        });
    }

    function buildBinLabelMarkup(layout, assets) {
        const {
            widthMm, heightMm, scale, brandCol, qrCol, padX, padY,
            brandFont, brandSubFont, titleFont, codeFont, barcodeTextFont,
            barcodeHeightPx
        } = layout;
        const { safeCode, barcodeHtml, qrDataUrl } = assets;
        const qrHtml = qrDataUrl
            ? `<img src="${qrDataUrl.replace(/"/g, '&quot;')}" alt="QR Code" />`
            : `<div style="font-size:10px;text-align:center;">QR<br>${safeCode}</div>`;
        const barcodeBlock = barcodeHtml || `<div style="font-size:${barcodeTextFont}px;">${safeCode}</div>`;
        const gap = Math.max(1, padX * 0.4);

        return {
            css: `
    * { box-sizing: border-box; }
    .label {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      margin: 0;
      border: 1.5px solid #111;
      border-radius: 4px;
      display: grid;
      grid-template-columns: ${brandCol}mm minmax(0, 1fr) ${qrCol}mm;
      align-items: center;
      column-gap: ${gap}mm;
      padding: ${padY}mm ${padX}mm;
      background: #fff;
      overflow: hidden;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }
    .brand {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding-right: ${Math.max(1, padX * 0.5)}mm;
      border-right: 1.5px solid #111;
      height: 100%;
      min-width: 0;
      overflow: hidden;
    }
    .brand-name {
      font-size: ${brandFont}px;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1.05;
      white-space: nowrap;
    }
    .brand-sub {
      margin-top: 2px;
      font-size: ${brandSubFont}px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      line-height: 1.1;
      white-space: nowrap;
    }
    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 0;
      height: 100%;
      overflow: hidden;
      padding: 0 1mm;
    }
    .bin-title {
      font-size: ${titleFont}px;
      font-weight: 700;
      letter-spacing: 0.12em;
      margin: 0 0 2px;
      line-height: 1.1;
    }
    .bin-code {
      font-size: ${codeFont}px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.02em;
      margin: 0 0 ${Math.max(2, Math.round(3 * scale))}px;
      white-space: nowrap;
    }
    .barcode-wrap {
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
    }
    .barcode-wrap svg {
      display: block;
      width: 100%;
      max-width: 100%;
      height: ${barcodeHeightPx}px;
    }
    .barcode-text {
      margin-top: 2px;
      font-size: ${barcodeTextFont}px;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    .qr-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-width: 0;
      overflow: hidden;
    }
    .qr-wrap img {
      width: ${Math.max(18, Math.round(qrCol * 0.82))}mm;
      height: ${Math.max(18, Math.round(qrCol * 0.82))}mm;
      max-width: 100%;
      max-height: ${Math.max(18, Math.round(heightMm * 0.70))}mm;
      display: block;
      object-fit: contain;
    }`,
            body: `
  <div class="label">
    <div class="brand">
      <div class="brand-name">PARISI</div>
      <div class="brand-sub">Bathware Australia</div>
    </div>
    <div class="center">
      <div class="bin-title">BIN LOCATION</div>
      <div class="bin-code">${safeCode}</div>
      <div class="barcode-wrap">
        ${barcodeBlock}
        <div class="barcode-text">${safeCode}</div>
      </div>
    </div>
    <div class="qr-wrap">${qrHtml}</div>
  </div>`
        };
    }

    function openBinLabelPrintWindow(code, layout, assets, existingWindow = null) {
        const markup = buildBinLabelMarkup(layout, assets);
        const { widthMm, heightMm, pageLandscape } = layout;
        const { safeCode } = assets;

        const w = existingWindow || window.open('', '_blank', 'width=900,height=560');
        if (!w) {
            alert('Allow popups to print the bin location label.');
            return;
        }

        try {
            w.document.open();
        } catch {
            // ignore
        }

        w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bin Location - ${safeCode}</title>
  <style>
    @page { margin: 4mm; size: ${pageLandscape ? 'landscape' : 'portrait'}; }
    body {
      margin: 0;
      padding: 10px;
      background: #fff;
      color: #000;
    }
    ${markup.css}
    .no-print { text-align: center; margin-top: 14px; color: #555; font-size: 13px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .label { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${markup.body}
  <div class="no-print">
    <div>Size: ${widthMm} × ${heightMm} mm</div>
  </div>
  <script>
    (function () {
      function tryPrint() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }
      if (document.readyState === 'complete') {
        setTimeout(tryPrint, 150);
      } else {
        window.addEventListener('load', function () { setTimeout(tryPrint, 150); });
      }
    })();
  <\/script>
</body>
</html>`);
        w.document.close();

        setTimeout(() => {
            try {
                if (!w.closed) {
                    w.focus();
                    w.print();
                }
            } catch (err) {
                console.error('Print trigger error:', err);
            }
        }, 400);
    }

    async function downloadBinLabelPng(code, layout, assets) {
        const pxPerMm = 12;
        const W = Math.round(layout.widthMm * pxPerMm);
        const H = Math.round(layout.heightMm * pxPerMm);
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        const cssPxPerMm = 96 / 25.4;
        const fontScale = pxPerMm / cssPxPerMm;
        const padX = Math.max(6, Math.round(layout.padX * pxPerMm));
        const padY = Math.max(5, Math.round(layout.padY * pxPerMm));

        let brandFont = Math.max(11, Math.round(layout.brandFont * fontScale));
        let brandSubFont = Math.max(7, Math.round(layout.brandSubFont * fontScale));
        let titleFont = Math.max(9, Math.round(layout.titleFont * fontScale));
        let codeFont = Math.max(16, Math.round(layout.codeFont * fontScale));
        let captionFont = Math.max(8, Math.round(layout.barcodeTextFont * fontScale));

        const fitBrandFonts = () => {
            ctx.font = `800 ${brandFont}px Arial, Helvetica, sans-serif`;
            let w1 = ctx.measureText('PARISI').width;
            ctx.font = `500 ${brandSubFont}px Arial, Helvetica, sans-serif`;
            let w2 = ctx.measureText('BATHWARE AUSTRALIA').width;
            return Math.ceil(Math.max(w1, w2));
        };

        let brandTextW = fitBrandFonts();
        let brandColPx = brandTextW + padX + 8;
        // Keep brand column within ~30% of label width by shrinking fonts if needed
        while (brandColPx > W * 0.30 && brandFont > 10) {
            brandFont -= 1;
            brandSubFont = Math.max(6, Math.round(brandFont * 0.32));
            brandTextW = fitBrandFonts();
            brandColPx = brandTextW + padX + 8;
        }
        brandColPx = Math.max(brandColPx, Math.round(layout.brandCol * pxPerMm));

        const qrColPx = Math.min(Math.round(H * 0.78), Math.round(W * 0.22));
        const gap = Math.max(6, Math.round(W * 0.012));
        const dividerX = brandColPx;
        const centerLeft = dividerX + gap;
        const centerRight = W - qrColPx;
        const centerW = Math.max(20, centerRight - centerLeft - gap);
        const cx = centerLeft + centerW / 2;

        // Shrink code font until it fits in center column
        ctx.font = `800 ${codeFont}px Arial, Helvetica, sans-serif`;
        while (ctx.measureText(code).width > centerW * 0.96 && codeFont > 14) {
            codeFont -= 1;
            ctx.font = `800 ${codeFont}px Arial, Helvetica, sans-serif`;
        }
        ctx.font = `700 ${titleFont}px Arial, Helvetica, sans-serif`;
        while (ctx.measureText('BIN LOCATION').width > centerW * 0.98 && titleFont > 8) {
            titleFont -= 1;
            ctx.font = `700 ${titleFont}px Arial, Helvetica, sans-serif`;
        }

        const barcodeH = Math.max(14, Math.min(Math.round(H * 0.22), Math.round(layout.barcodeHeightPx * fontScale)));
        const stackGap = Math.max(3, Math.round(H * 0.035));
        const stackH = titleFont + stackGap + codeFont + stackGap + barcodeH + stackGap + captionFont;
        let y = Math.max(padY, Math.round((H - stackH) / 2));

        // Background + border
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = Math.max(2, Math.round(H * 0.012));
        ctx.strokeRect(1, 1, W - 2, H - 2);

        // Brand
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const brandBlockH = brandFont + brandSubFont + 6;
        const brandBase = (H - brandBlockH) / 2 + brandFont;
        ctx.font = `800 ${brandFont}px Arial, Helvetica, sans-serif`;
        ctx.fillText('PARISI', padX, brandBase);
        ctx.font = `500 ${brandSubFont}px Arial, Helvetica, sans-serif`;
        ctx.fillText('BATHWARE AUSTRALIA', padX, brandBase + brandSubFont + 4);

        // Divider (after brand column only)
        ctx.beginPath();
        ctx.moveTo(dividerX, padY);
        ctx.lineTo(dividerX, H - padY);
        ctx.stroke();

        // Center column
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `700 ${titleFont}px Arial, Helvetica, sans-serif`;
        ctx.fillText('BIN LOCATION', cx, y);
        y += titleFont + stackGap;

        ctx.font = `800 ${codeFont}px Arial, Helvetica, sans-serif`;
        ctx.fillText(code, cx, y);
        y += codeFont + stackGap;

        // Clip barcode to center column so it never crosses the divider
        if (assets.barcodeHtml) {
            try {
                const barcodeUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(assets.barcodeHtml);
                const barcodeImg = await loadImageFromSrc(barcodeUrl);
                const bw = centerW * 0.92;
                const bx = cx - bw / 2;
                ctx.save();
                ctx.beginPath();
                ctx.rect(centerLeft, 0, centerW, H);
                ctx.clip();
                ctx.drawImage(barcodeImg, bx, y, bw, barcodeH);
                ctx.restore();
            } catch (err) {
                console.error('Barcode draw error:', err);
            }
        }
        y += barcodeH + stackGap;

        ctx.font = `500 ${captionFont}px Arial, Helvetica, sans-serif`;
        ctx.fillText(code, cx, y);

        // QR in right column only
        if (assets.qrDataUrl) {
            try {
                const qrImg = await loadImageFromSrc(assets.qrDataUrl);
                const qSize = Math.min(qrColPx - 4, H - padY * 2);
                const qx = W - qrColPx + (qrColPx - qSize) / 2;
                const qy = (H - qSize) / 2;
                ctx.drawImage(qrImg, qx, qy, qSize, qSize);
            } catch (err) {
                console.error('QR draw error:', err);
            }
        }

        await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Could not create PNG file'));
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bin-location-${code.replace(/[^\w.-]+/g, '_')}-${layout.widthMm}x${layout.heightMm}mm.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                resolve();
            }, 'image/png');
        });
    }

    async function exportBinLocationLabel(locationCode, sizeOptions = {}, mode = 'print', printWindow = null) {
        const code = String(locationCode || '').trim().toUpperCase();
        if (!code) {
            alert('Location code is missing.');
            return;
        }

        if (typeof JsBarcode === 'undefined' || typeof QRCode === 'undefined') {
            alert('Barcode/QR libraries not loaded. Refresh the page and try again.');
            return;
        }

        const layout = buildLabelLayout(
            Number(sizeOptions.widthMm) || 100,
            Number(sizeOptions.heightMm) || 40
        );

        try {
            const assets = await prepareBinLabelAssets(code, layout);
            if (mode === 'download') {
                await downloadBinLabelPng(code, layout, assets);
            } else {
                openBinLabelPrintWindow(code, layout, assets, printWindow);
            }
        } catch (err) {
            console.error('Bin label export error:', err);
            if (printWindow && !printWindow.closed) {
                try { printWindow.close(); } catch { /* ignore */ }
            }
            alert((mode === 'download' ? 'Download' : 'Print') + ' failed: ' + (err.message || 'Unknown error'));
        }
    }

    function runBinLabelAction(mode) {
        const size = getSelectedPrintSize();
        if (size.error) {
            if (printBinLabelSizeError) {
                printBinLabelSizeError.textContent = size.error;
                printBinLabelSizeError.style.display = 'block';
            } else {
                alert(size.error);
            }
            return;
        }
        if (printBinLabelSizeError) printBinLabelSizeError.style.display = 'none';
        const code = pendingPrintLocationCode;

        // Open print window immediately on user click (required for Windows print dialog).
        let printWindow = null;
        if (mode === 'print') {
            printWindow = window.open('', '_blank', 'width=900,height=560');
            if (!printWindow) {
                alert('Allow popups for this site so the printer dialog can open.');
                return;
            }
            try {
                printWindow.document.write('<!DOCTYPE html><html><head><title>Preparing label...</title></head><body style="font-family:Arial,sans-serif;padding:24px;"><p>Preparing bin location label...</p></body></html>');
                printWindow.document.close();
            } catch {
                // ignore
            }
        }

        closePrintBinLabelModal();
        exportBinLocationLabel(code, size, mode, printWindow);
    }

    if (printBinLabelPreset) {
        printBinLabelPreset.addEventListener('change', applyPrintPreset);
    }
    const confirmPrintBinLabelBtn = document.getElementById('confirmPrintBinLabel');
    const confirmDownloadBinLabelBtn = document.getElementById('confirmDownloadBinLabel');
    const cancelPrintBinLabelBtn = document.getElementById('cancelPrintBinLabel');
    const closePrintBinLabelModalBtn = document.getElementById('closePrintBinLabelModal');
    if (confirmPrintBinLabelBtn) {
        confirmPrintBinLabelBtn.addEventListener('click', () => runBinLabelAction('print'));
    }
    if (confirmDownloadBinLabelBtn) {
        confirmDownloadBinLabelBtn.addEventListener('click', () => runBinLabelAction('download'));
    }
    if (cancelPrintBinLabelBtn) cancelPrintBinLabelBtn.addEventListener('click', closePrintBinLabelModal);
    if (closePrintBinLabelModalBtn) closePrintBinLabelModalBtn.addEventListener('click', closePrintBinLabelModal);
    if (printBinLabelModal) {
        printBinLabelModal.addEventListener('click', (e) => {
            if (e.target === printBinLabelModal) closePrintBinLabelModal();
        });
    }

    // Event delegation: handle Edit/Delete/Print clicks on tbody (works when clicking icon or text inside button)
    const tbody = document.getElementById('locationsTableBody');
    if (tbody) {
        tbody.addEventListener('click', function (e) {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');
            const printBtn = e.target.closest('.btn-print');
            if (editBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = editBtn.getAttribute('data-id');
                if (id) openEditModal(id);
                else alert('Error: location id not found. Please refresh the page.');
            } else if (printBtn) {
                e.preventDefault();
                e.stopPropagation();
                const locationCode = printBtn.getAttribute('data-location') || '';
                openPrintBinLabelModal(locationCode);
            } else if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = deleteBtn.getAttribute('data-id');
                const locationCode = deleteBtn.getAttribute('data-location') || '';
                if (id) confirmDelete(id, locationCode);
                else alert('Error: location id not found. Please refresh the page.');
            }
        });
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function openEditModal(id) {
        if (!id) return;
        const idStr = String(id).trim();
        if (!idStr) return;

        // Buscar a location na API para garantir que o id e os dados estão corretos
        fetch(`${LOCATIONS_API_URL}/${encodeURIComponent(idStr)}`)
            .then(res => res.json())
            .then(result => {
                if (!result.success || !result.data) {
                    alert('Error loading location. Please try again.');
                    return;
                }
                const loc = result.data;
                document.getElementById('editLocationId').value = loc.id;
                document.getElementById('editLocationStatus').value = loc.status || 'active';
                document.getElementById('editAccessType').value = loc.accessType || '';
                document.getElementById('editLocationSection').value = getLocationSection(loc);
                LocationCodeUtils.setLocationParts(
                    EDIT_FIELD_IDS,
                    LocationCodeUtils.parseLocationCode(loc.location || '')
                );
                LocationCodeUtils.updateComposedLocation(EDIT_FIELD_IDS);

                if (editModal) {
                    editModal.classList.add('show');
                    editModal.setAttribute('aria-hidden', 'false');
                    editModal.scrollTop = 0;
                }
            })
            .catch(err => {
                console.error('Error loading location:', err);
                alert('Error loading location: ' + err.message);
            });
    }

    function closeEditModal() {
        if (editModal) {
            editModal.classList.remove('show');
            editModal.setAttribute('aria-hidden', 'true');
        }
    }

    function loadLocations() {
        return fetch(LOCATIONS_API_URL)
            .then(res => res.json())
            .then(result => {
                if (result.success && Array.isArray(result.data)) {
                    locations = result.data;
                } else {
                    locations = [];
                }
                return locations;
            })
            .catch(err => {
                console.error('Error loading locations:', err);
                locations = [];
                return locations;
            });
    }

    function getLocationSearchPrefix() {
        const direct = String(searchLocationInput?.value || '')
            .trim()
            .toUpperCase()
            .replace(/-+$/g, '');
        if (direct) return direct;

        const parts = LocationCodeUtils.getLocationParts(SEARCH_FIELD_IDS);
        let term = '';
        if (parts.street) term += parts.street;
        if (parts.building !== '') term += String(parts.building);
        if (parts.level !== '') {
            term += `-${parts.level}`;
            if (Number(parts.level) === 0) {
                const mode = parts.levelZeroMode
                    || (parts.side ? 'side' : (parts.sublevel !== '' ? 'sublevel' : ''));
                if (mode === 'side' && parts.side) term += parts.side;
                else if (mode === 'sublevel' && parts.sublevel !== '') term += String(parts.sublevel);
            } else if (parts.side) {
                term += parts.side;
            }
        }
        return term.toUpperCase();
    }

    function locationMatchesSearchTerm(locationCode, term) {
        const code = String(locationCode || '').trim().toUpperCase();
        const needle = String(term || '').trim().toUpperCase().replace(/-+$/g, '');
        if (!needle) return true;
        if (!code) return false;

        // Prefix match: C9 → C9-00, C91L, C9-1R
        if (code.startsWith(needle)) return true;

        // Also accept codes that start with "C9-" when user typed "C9"
        if (code.startsWith(`${needle}-`)) return true;

        // Conjunto match (Street + Building), covers legacy codes like C21L for term C2
        const conjunto = needle.match(/^([A-Z])(\d+)$/);
        if (conjunto) {
            const parts = LocationCodeUtils.parseLocationCode(code);
            if (
                parts.street === conjunto[1] &&
                parts.building !== '' &&
                String(Number(parts.building)) === String(Number(conjunto[2]))
            ) {
                return true;
            }
        }

        return false;
    }

    function filterLocations() {
        if (!hasSearched) {
            showEmptyStateInitial();
            return;
        }

        const term = getLocationSearchPrefix();
        const status = filterStatusSelect.value;
        const access = filterAccessSelect.value;

        const filtered = locations.filter(loc => {
            const matchesTerm = locationMatchesSearchTerm(loc.location, term);
            const matchesStatus = !status || loc.status === status;
            const matchesAccess = !access || loc.accessType === access;
            return matchesTerm && matchesStatus && matchesAccess;
        });

        filteredLocations = filtered;
        renderLocations(filtered);
    }

    async function runSearch() {
        hasSearched = true;
        await loadLocations();
        filterLocations();
    }

    // Edit form submit
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = (document.getElementById('editLocationId').value || '').trim();
            if (!id) {
                alert('Error: location id is missing. Please close and try Edit again.');
                return;
            }

            LocationCodeUtils.updateComposedLocation(EDIT_FIELD_IDS);
            const validation = LocationCodeUtils.validateLocationParts(
                LocationCodeUtils.getLocationParts(EDIT_FIELD_IDS)
            );
            if (!validation.valid) {
                const firstError = Object.values(validation.errors)[0];
                alert(firstError || 'Please complete all location fields.');
                return;
            }

            const data = {
                location: validation.composed,
                status: document.getElementById('editLocationStatus').value,
                accessType: document.getElementById('editAccessType').value,
                section: document.getElementById('editLocationSection').value
            };

            const saveBtn = document.getElementById('saveEditLocationBtn');
            if (saveBtn) saveBtn.disabled = true;

            fetch(`${LOCATIONS_API_URL}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        alert('Location updated successfully.');
                        closeEditModal();
                        if (hasSearched) runSearch();
                    } else {
                        alert('Error: ' + (result.message || result.error || 'Failed to update'));
                    }
                })
                .catch(err => {
                    console.error('Error updating location:', err);
                    alert('Error updating location: ' + err.message);
                })
                .finally(() => {
                    if (saveBtn) saveBtn.disabled = false;
                });
        });
    }

    function confirmDelete(id, locationCode) {
        if (!confirm(`Delete location "${locationCode}"? This cannot be undone.`)) return;

        fetch(`${LOCATIONS_API_URL}/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    alert('Location deleted successfully.');
                    if (hasSearched) runSearch();
                } else {
                    alert('Error: ' + (result.message || result.error || 'Failed to delete'));
                }
            })
            .catch(err => {
                console.error('Error deleting location:', err);
                alert('Error deleting location: ' + err.message);
            });
    }

    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
    }

    // Do not load result set on open — wait for Search
    showEmptyStateInitial();

    ['searchLocationStreet', 'searchLocationBuilding', 'searchLocationLevel', 'searchLocationSide', 'searchLocationSublevel'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                if (hasSearched) filterLocations();
            });
            field.addEventListener('change', () => {
                if (hasSearched) filterLocations();
            });
        }
    });

    if (searchLocationInput) {
        searchLocationInput.addEventListener('input', () => {
            searchLocationInput.value = searchLocationInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
            // Direct Location typing wins: clear address parts so composition does not overwrite it
            const streetEl = document.getElementById('searchLocationStreet');
            const buildingEl = document.getElementById('searchLocationBuilding');
            const levelEl = document.getElementById('searchLocationLevel');
            const sideEl = document.getElementById('searchLocationSide');
            const sublevelEl = document.getElementById('searchLocationSublevel');
            const modeEl = document.getElementById('searchLocationLevelZeroMode');
            if (streetEl) streetEl.value = '';
            if (buildingEl) buildingEl.value = '';
            if (levelEl) levelEl.value = '';
            if (sideEl) sideEl.value = '';
            if (sublevelEl) sublevelEl.value = '';
            if (modeEl) modeEl.value = '';
            LocationCodeUtils.updateLevelDependentFields(SEARCH_FIELD_IDS);
            if (hasSearched) filterLocations();
        });
        searchLocationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
            }
        });
    }

    filterStatusSelect.addEventListener('change', () => {
        if (hasSearched) filterLocations();
    });
    filterAccessSelect.addEventListener('change', () => {
        if (hasSearched) filterLocations();
    });
    clearSearchBtn.addEventListener('click', () => {
        document.getElementById('searchLocationStreet').value = '';
        document.getElementById('searchLocationBuilding').value = '';
        document.getElementById('searchLocationLevel').value = '';
        document.getElementById('searchLocationSide').value = '';
        document.getElementById('searchLocationSublevel').value = '';
        searchLocationInput.value = '';
        LocationCodeUtils.updateComposedLocation(SEARCH_FIELD_IDS, {
            allowPartial: true,
            allowDirectCodeEntry: true
        });
        filterStatusSelect.value = '';
        filterAccessSelect.value = '';
        showEmptyStateInitial();
    });

    if (applySearchBtn) {
        applySearchBtn.addEventListener('click', runSearch);
    }

    const cancelSearchBtn = document.getElementById('cancelLocationSearch');
    if (cancelSearchBtn) {
        cancelSearchBtn.addEventListener('click', () => {
            window.location.href = 'warehouse.html';
        });
    }

    const downloadExcelBtn = document.getElementById('downloadLocationsExcel');
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', async () => {
            await loadLocations();
            hasSearched = true;
            filterLocations();
            await downloadLocationsExcel(filteredLocations);
        });
    }

    const locationHelpBtn = document.getElementById('locationHelpBtn');
    const locationHelpModal = document.getElementById('locationHelpModal');
    const closeLocationHelpModal = document.getElementById('closeLocationHelpModal');
    const closeLocationHelpBtn = document.getElementById('closeLocationHelpBtn');

    function openLocationHelp() {
        if (!locationHelpModal) return;
        locationHelpModal.classList.add('is-open');
        locationHelpModal.style.display = 'flex';
        closeLocationHelpBtn?.focus();
    }

    function closeLocationHelp() {
        if (!locationHelpModal) return;
        locationHelpModal.classList.remove('is-open');
        locationHelpModal.style.display = 'none';
    }

    if (locationHelpBtn) locationHelpBtn.addEventListener('click', openLocationHelp);
    if (closeLocationHelpModal) closeLocationHelpModal.addEventListener('click', closeLocationHelp);
    if (closeLocationHelpBtn) closeLocationHelpBtn.addEventListener('click', closeLocationHelp);
    if (locationHelpModal) {
        locationHelpModal.addEventListener('click', (e) => {
            if (e.target === locationHelpModal) closeLocationHelp();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            openLocationHelp();
            return;
        }
        if (e.key === 'Escape' && locationHelpModal?.classList.contains('is-open')) {
            closeLocationHelp();
        }
    });

    getLoggedUserExportPrefix();
});
