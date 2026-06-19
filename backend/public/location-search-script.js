const LOCATIONS_API_URL = '/api/locations';
let locations = [];

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
    if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
    if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
    document.addEventListener('click', closeAll);
}

document.addEventListener('DOMContentLoaded', () => {
    setupHeaderDropdowns();
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
                    <td colspan="4" class="empty-state">
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
                document.getElementById('editLocationCode').value = loc.location || '';
                document.getElementById('editLocationStatus').value = loc.status || 'active';
                document.getElementById('editAccessType').value = loc.accessType || '';

                if (editModal) {
                    editModal.classList.add('show');
                    editModal.setAttribute('aria-hidden', 'false');
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
        fetch(LOCATIONS_API_URL)
            .then(res => res.json())
            .then(result => {
                if (result.success && Array.isArray(result.data)) {
                    locations = result.data;
                    filterLocations();
                } else {
                    locations = [];
                    renderLocations([]);
                }
            })
            .catch(err => {
                console.error('Error loading locations:', err);
                locations = [];
                renderLocations([]);
            });
    }

    function filterLocations() {
        const term = searchLocationInput.value.trim().toLowerCase();
        const status = filterStatusSelect.value;
        const access = filterAccessSelect.value;

        const filtered = locations.filter(loc => {
            const matchesTerm = !term || (loc.location || '').toLowerCase().includes(term);
            const matchesStatus = !status || loc.status === status;
            const matchesAccess = !access || loc.accessType === access;
            return matchesTerm && matchesStatus && matchesAccess;
        });

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
            const data = {
                location: document.getElementById('editLocationCode').value.trim(),
                status: document.getElementById('editLocationStatus').value,
                accessType: document.getElementById('editAccessType').value
            };

            const saveBtn = document.getElementById('saveEditLocationBtn');
            if (saveBtn) saveBtn.disabled = true;

            fetch(`${LOCATIONS_API_URL}/${encodeURIComponent(id)}`, {
                method: 'PUT',
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

    searchLocationInput.addEventListener('input', filterLocations);
    filterStatusSelect.addEventListener('change', filterLocations);
    filterAccessSelect.addEventListener('change', filterLocations);
    clearSearchBtn.addEventListener('click', () => {
        searchLocationInput.value = '';
        filterStatusSelect.value = '';
        filterAccessSelect.value = '';
        filterLocations();
    });

    if (applySearchBtn) {
        applySearchBtn.addEventListener('click', filterLocations);
    }
});
