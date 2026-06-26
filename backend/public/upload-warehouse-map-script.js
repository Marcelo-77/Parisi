(function () {
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

        return data;
    }

    async function uploadMapFile(file) {
        if (!file) return;

        const buffer = await file.arrayBuffer();

        try {
            WarehouseMapUtils.parseWorkbookBuffer(buffer);
        } catch (error) {
            throw new Error(error.message || 'Invalid WareHouseMap.xlsx file.');
        }

        const response = await fetch('/api/warehouse-map/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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
            fileInput.addEventListener('change', () => {
                const file = fileInput.files && fileInput.files[0];
                updateSelectedFile(file || null);
                setStatus('', '');
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', async () => {
                if (!selectedFile) return;
                try {
                    uploadBtn.disabled = true;
                    setStatus('Uploading WareHouseMap.xlsx...', 'loading');
                    await uploadMapFile(selectedFile);
                    await refreshMapInfo();
                    setStatus('WareHouseMap.xlsx uploaded successfully. Special Search Product will use this file.', 'success');
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
                    const buffer = await selectedFile.arrayBuffer();
                    const gridData = WarehouseMapUtils.parseWorkbookBuffer(buffer);
                    WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', gridData, '');
                    setStatus('Preview loaded from selected file.', 'success');
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

        refreshMapInfo().catch((error) => {
            console.error('Map info error:', error);
            setStatus(error.message || 'Unable to load current map info.', 'error');
        });

        WarehouseMapUtils.loadServerMap()
            .then((gridData) => WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', gridData, ''))
            .catch(() => {
                WarehouseMapUtils.renderWarehouseMap('warehouseMapPreviewContainer', null, '');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
})();
