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
        CENTRAL: 'Central',
        WAREHOUSE2: 'Warehouse2',
        FURNITUREWARE: 'Furnitureware',
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
    sublevelGroupId: 'searchLocationSublevelGroup'
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
    setupHeaderDropdowns();
    LocationCodeUtils.setupLocationComposition(SEARCH_FIELD_IDS, {
      allowPartial: true,
      allowDirectCodeEntry: true
    });
    LocationCodeUtils.setupLocationComposition(EDIT_FIELD_IDS);

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

    function renderLocations(list) {
        const tbody = document.getElementById('locationsTableBody');
        if (!tbody) return;

        if (!list.length) {
            tbody.innerHTML = `
                <tr>
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
            <tr>
                <td>${escapeHtml(loc.location)}</td>
                <td>${loc.status === 'active' ? 'Active' : 'Inactive'}</td>
                <td>${escapeHtml(loc.accessType || '-')}</td>
                <td>${escapeHtml(formatSection(getLocationSection(loc)))}</td>
                <td class="td-actions">
                    <button type="button" class="btn btn-edit" data-id="${escapeHtml(loc.id || '')}" title="Edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button type="button" class="btn btn-delete" data-id="${escapeHtml(loc.id || '')}" data-location="${escapeHtml(loc.location || '')}" title="Delete">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');

        resultsCountEl.textContent = `${list.length} location${list.length > 1 ? 's' : ''}`;
    }

    // Event delegation: handle Edit/Delete clicks on tbody (works when clicking icon or text inside button)
    const tbody = document.getElementById('locationsTableBody');
    if (tbody) {
        tbody.addEventListener('click', function (e) {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');
            if (editBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = editBtn.getAttribute('data-id');
                if (id) openEditModal(id);
                else alert('Error: location id not found. Please refresh the page.');
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
                    filterLocations();
                } else {
                    locations = [];
                    filteredLocations = [];
                    renderLocations([]);
                }
            })
            .catch(err => {
                console.error('Error loading locations:', err);
                locations = [];
                filteredLocations = [];
                renderLocations([]);
            });
    }

    function filterLocations() {
        LocationCodeUtils.updateComposedLocation(SEARCH_FIELD_IDS, {
            allowPartial: true,
            allowDirectCodeEntry: true
        });
        const term = searchLocationInput.value.trim().toLowerCase();
        const status = filterStatusSelect.value;
        const access = filterAccessSelect.value;

        const filtered = locations.filter(loc => {
            const matchesTerm = !term || (loc.location || '').toLowerCase().includes(term);
            const matchesStatus = !status || loc.status === status;
            const matchesAccess = !access || loc.accessType === access;
            return matchesTerm && matchesStatus && matchesAccess;
        });

        filteredLocations = filtered;
        renderLocations(filtered);
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
                        loadLocations();
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
                    loadLocations();
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

    // Initial load
    loadLocations();

    ['searchLocationStreet', 'searchLocationBuilding', 'searchLocationLevel', 'searchLocationSide', 'searchLocationSublevel'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', filterLocations);
            field.addEventListener('change', filterLocations);
        }
    });

    if (searchLocationInput) {
        searchLocationInput.addEventListener('input', () => {
            searchLocationInput.value = searchLocationInput.value.toUpperCase();
            filterLocations();
        });
    }

    filterStatusSelect.addEventListener('change', filterLocations);
    filterAccessSelect.addEventListener('change', filterLocations);
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
        filterLocations();
    });

    if (applySearchBtn) {
        applySearchBtn.addEventListener('click', filterLocations);
    }

    const downloadExcelBtn = document.getElementById('downloadLocationsExcel');
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', async () => {
            LocationCodeUtils.updateComposedLocation(SEARCH_FIELD_IDS, {
                allowPartial: true,
                allowDirectCodeEntry: true
            });
            await loadLocations();
            await downloadLocationsExcel(filteredLocations);
        });
    }

    getLoggedUserExportPrefix();
});
