(function () {
    async function publishLocationIndexFromGrid(gridData) {
        const index = WarehouseMapUtils.buildLocationIndexFromGrid(gridData);
        try {
            if (typeof MapCalibration !== 'undefined') {
                const existing = await MapCalibration.fetchLocationIndex();
                if (existing && existing.imageCorners) {
                    index.imageCorners = existing.imageCorners;
                }
            }
        } catch (_) {
            // keep default corners
        }
        const response = await fetch('/api/warehouse-map/locations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(index)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to save location coordinates.');
        }
        return data;
    }

    async function tryRegenerateLocationIndexFromServerExcel() {
        try {
            const gridData = await WarehouseMapUtils.loadServerMap();
            return await publishLocationIndexFromGrid(gridData);
        } catch (error) {
            console.warn('Location index not regenerated:', error);
            return null;
        }
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

    function setStatus(text, type) {
        const el = document.getElementById('uploadMapStatus');
        if (!el) return;
        el.textContent = text;
        el.className = 'upload-map-status';
        if (type) el.classList.add(`is-${type}`);
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString();
    }

    function isImageFile(file) {
        if (!file) return false;
        if (file.type && file.type.startsWith('image/')) return true;
        return /\.(png|jpe?g|gif|webp)$/i.test(file.name || '');
    }

    function readImageDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Unable to read image file.'));
            reader.readAsDataURL(file);
        });
    }

    function renderImagePreviewFromUrl(imageUrl) {
        const container = document.getElementById('warehouseMapPreviewContainer');
        if (!container) return;

        container.innerHTML = '';
        const toolbar = document.createElement('div');
        toolbar.className = 'map-calibration-toolbar';
        toolbar.innerHTML = `
            <p class="map-calibration-help">
                Drag the <strong>4 corners</strong> to match <strong>I8</strong>, <strong>H33</strong> (top),
                <strong>A49</strong> and <strong>A72</strong> (bottom), then save.
            </p>
            <div class="map-calibration-actions">
                <button type="button" class="btn btn-secondary btn-sm" id="previewAnchorsBtn">
                    <i class="fas fa-crosshairs"></i> Preview anchors
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="previewDRowBtn">
                    <i class="fas fa-eye"></i> Preview D row
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="previewAllRowBtn">
                    <i class="fas fa-th"></i> Preview all bins
                </button>
                <button type="button" class="btn btn-primary btn-sm" id="saveCalibrationBtn">
                    <i class="fas fa-save"></i> Save calibration
                </button>
            </div>`;

        const wrap = document.createElement('div');
        wrap.className = 'warehouse-map-image-preview';
        wrap.id = 'mapCalibrationContainer';

        container.appendChild(toolbar);
        container.appendChild(wrap);

        const initialCorners = WarehouseMapUtils.DEFAULT_IMAGE_CORNERS;
        MapCalibration.fetchLocationIndex().then((index) => {
            const corners = index && index.imageCorners
                ? index.imageCorners
                : initialCorners;

            const calibration = MapCalibration.createCalibrationStack(wrap, imageUrl, corners, {
                onChange: () => {
                    calibration.clearPreviewMarkers();
                }
            });

            const previewDRowBtn = document.getElementById('previewDRowBtn');
            const previewAllRowBtn = document.getElementById('previewAllRowBtn');
            const previewAnchorsBtn = document.getElementById('previewAnchorsBtn');
            const saveCalibrationBtn = document.getElementById('saveCalibrationBtn');

            if (previewAnchorsBtn) {
                previewAnchorsBtn.addEventListener('click', async () => {
                    const locationIndex = await MapCalibration.fetchLocationIndex();
                    if (!locationIndex) {
                        setStatus('Upload Excel first to generate location coordinates.', 'error');
                        return;
                    }
                    locationIndex.imageCorners = calibration.getCorners();
                    const anchors = locationIndex.calibrationAnchors || WarehouseMapUtils.DEFAULT_CALIBRATION_ANCHORS;
                    const anchorCodes = new Set(Object.values(anchors));
                    calibration.previewMarkers(locationIndex, (code) => anchorCodes.has(code));
                    setStatus('Preview: I8, H33, A49, A72 anchor markers shown.', 'success');
                });
            }

            if (previewDRowBtn) {
                previewDRowBtn.addEventListener('click', async () => {
                    const locationIndex = await MapCalibration.fetchLocationIndex();
                    if (!locationIndex) {
                        setStatus('Upload Excel first to generate location coordinates.', 'error');
                        return;
                    }
                    locationIndex.imageCorners = calibration.getCorners();
                    calibration.previewMarkers(locationIndex, (code) => /^D\d+$/i.test(code));
                    setStatus('Preview: D row markers shown. Adjust corners if needed, then Save calibration.', 'success');
                });
            }

            if (previewAllRowBtn) {
                previewAllRowBtn.addEventListener('click', async () => {
                    const locationIndex = await MapCalibration.fetchLocationIndex();
                    if (!locationIndex) {
                        setStatus('Upload Excel first to generate location coordinates.', 'error');
                        return;
                    }
                    locationIndex.imageCorners = calibration.getCorners();
                    calibration.previewMarkers(locationIndex, (code) => /^[B-H]\d+$/i.test(code));
                    setStatus('Preview: all main rack markers shown.', 'success');
                });
            }

            if (saveCalibrationBtn) {
                saveCalibrationBtn.addEventListener('click', async () => {
                    try {
                        saveCalibrationBtn.disabled = true;
                        await MapCalibration.saveImageCorners(calibration.getCorners());
                        setStatus('Calibration saved. Special Search Product will use these positions.', 'success');
                    } catch (error) {
                        setStatus(error.message || 'Unable to save calibration.', 'error');
                    } finally {
                        saveCalibrationBtn.disabled = false;
                    }
                });
            }
        });
    }

    async function renderImagePreview(file) {
        const dataUrl = await readImageDataUrl(file);
        renderImagePreviewFromUrl(dataUrl);
    }

    function renderServerImagePreview(info) {
        const baseUrl = (info && (info.imageUrl || (info.kind === 'image' ? '/WareHouseMap-image.png' : null))) || null;
        if (!baseUrl) return;

        const version = info.updatedAt ? new Date(info.updatedAt).getTime() : Date.now();
        const separator = baseUrl.includes('?') ? '&' : '?';
        renderImagePreviewFromUrl(`${baseUrl}${separator}v=${version}`);
    }

    async function refreshMapInfo() {
        const response = await fetch('/api/warehouse-map/info');
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to load map info.');
        }

        const fileNameEl = document.getElementById('currentMapFileName');
        const updatedEl = document.getElementById('currentMapUpdatedAt');
        const sizeEl = document.getElementById('currentMapSize');

        if (fileNameEl) fileNameEl.textContent = data.exists ? data.fileName : 'No file on server';
        if (updatedEl) updatedEl.textContent = data.exists ? formatDateTime(data.updatedAt) : '-';
        if (sizeEl) sizeEl.textContent = data.exists ? formatFileSize(data.size) : '-';

        const locationsEl = document.getElementById('currentMapLocationCount');
        if (locationsEl) {
            locationsEl.textContent = data.locationsExists
                ? `${data.locationCount || 0} coordinates`
                : 'No coordinates file';
        }

        return data;
    }

    async function loadInitialPreview() {
        try {
            let info = await refreshMapInfo();
            if (info.exists && !info.locationsExists) {
                const locationResult = await tryRegenerateLocationIndexFromServerExcel();
                if (locationResult) {
                    info = await refreshMapInfo();
                }
            }

            if (info.exists && info.kind === 'image') {
                renderServerImagePreview(info);
                return;
            }

            if (info.exists && info.kind === 'excel') {
                const gridData = await WarehouseMapUtils.loadServerMap();
                WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', gridData, '');
                return;
            }

            WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', null, '');
        } catch (error) {
            console.error('Initial map preview error:', error);
            WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', null, '');
        }
    }

    async function previewSelectedFile(file) {
        if (!file) return;

        if (isImageFile(file)) {
            await renderImagePreview(file);
            setStatus('Image preview loaded from selected file.', 'success');
            return;
        }

        const buffer = await file.arrayBuffer();
        const gridData = WarehouseMapUtils.parseWorkbookBuffer(buffer);
        WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', gridData, '');
        setStatus('Excel preview loaded from selected file.', 'success');
    }

    async function uploadMapFile(file) {
        if (!file) return;

        const buffer = await file.arrayBuffer();
        const imageFile = isImageFile(file);
        const isExcelMime = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            || file.type === 'application/vnd.ms-excel';
        const isExcelExt = /\.xlsx?$/i.test(file.name || '');

        if (!imageFile) {
            try {
                WarehouseMapUtils.parseWorkbookBuffer(buffer);
            } catch (error) {
                throw new Error(error.message || 'Invalid WareHouseMap.xlsx file.');
            }
        }

        if (!imageFile && !isExcelMime && !isExcelExt) {
            throw new Error('Please select an Excel (.xlsx/.xls) or image file.');
        }

        const response = await fetch('/api/warehouse-map/upload', {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name || '')
            },
            body: buffer
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Upload failed.');
        }

        return data;
    }

    function initPage() {
        const fileInput = document.getElementById('warehouseMapUploadFile');
        const uploadBtn = document.getElementById('uploadMapBtn');
        const previewBtn = document.getElementById('previewMapBtn');
        const openSearchBtn = document.getElementById('openSpecialSearchBtn');
        let selectedFile = null;

        function updateSelectedFile(file) {
            selectedFile = file || null;
            const label = document.getElementById('selectedMapFileName');
            if (label) {
                label.textContent = selectedFile
                    ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                    : 'No file selected';
                label.classList.toggle('is-loaded', Boolean(selectedFile));
            }
            if (uploadBtn) uploadBtn.disabled = !selectedFile;
            if (previewBtn) previewBtn.disabled = !selectedFile;
        }

        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                updateSelectedFile(file || null);
                setStatus('', '');

                if (!file) {
                    return;
                }

                try {
                    await previewSelectedFile(file);
                } catch (error) {
                    console.error('Auto preview error:', error);
                    setStatus(error.message || 'Unable to preview file.', 'error');
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', async () => {
                if (!selectedFile) return;
                try {
                    uploadBtn.disabled = true;
                    setStatus(`Uploading ${selectedFile.name}...`, 'loading');
                    const result = await uploadMapFile(selectedFile);
                    const info = await refreshMapInfo();

                    if (result.kind === 'image') {
                        renderServerImagePreview(info);
                        const locationResult = await tryRegenerateLocationIndexFromServerExcel();
                        if (locationResult) {
                            await refreshMapInfo();
                            setStatus(
                                `Image uploaded. ${locationResult.locationCount} location coordinates refreshed from Excel.`,
                                'success'
                            );
                        } else {
                            setStatus(
                                info.locationsExists
                                    ? 'Image uploaded. Existing location coordinates kept.'
                                    : 'Image uploaded. Upload Excel once to generate location coordinates.',
                                'success'
                            );
                        }
                    } else {
                        const gridData = WarehouseMapUtils.parseWorkbookBuffer(await selectedFile.arrayBuffer());
                        const locationResult = await publishLocationIndexFromGrid(gridData);
                        WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', gridData, '');
                        await refreshMapInfo();
                        setStatus(
                            `Excel uploaded. ${locationResult.locationCount} location coordinates saved for image map.`,
                            'success'
                        );
                    }
                } catch (error) {
                    console.error('Upload map error:', error);
                    setStatus(error.message || 'Upload failed.', 'error');
                } finally {
                    uploadBtn.disabled = !selectedFile;
                }
            });
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                if (!selectedFile) return;
                try {
                    previewBtn.disabled = true;
                    await previewSelectedFile(selectedFile);
                } catch (error) {
                    console.error('Preview map error:', error);
                    setStatus(error.message || 'Unable to preview file.', 'error');
                } finally {
                    previewBtn.disabled = !selectedFile;
                }
            });
        }

        if (openSearchBtn) {
            openSearchBtn.addEventListener('click', () => {
                window.location.href = 'special-search-product.html';
            });
        }

        loadInitialPreview();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
})();
