const LOCATIONS_API_URL = '/api/locations';

const LOCATION_FIELD_IDS = {
    streetId: 'locationStreet',
    buildingId: 'locationBuilding',
    levelId: 'locationLevel',
    sideId: 'locationSide',
    sublevelId: 'locationSublevel',
    codeId: 'locationCode',
    sideGroupId: 'locationSideGroup',
    sublevelGroupId: 'locationSublevelGroup',
    accessTypeId: 'accessType'
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

    function closeAll() {
        [usersDropdownMenu, productDropdownMenu, applicationsDropdownMenu, locationDropdownMenu, locationProductDropdownMenu].forEach(el => {
            if (el) el.setAttribute('aria-hidden', 'true');
        });
        [usersMenuBtn, productMenuBtn, applicationsMenuBtn, locationMenuBtn, locationProductMenuBtn].forEach(el => {
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
    const newProductBtn = document.getElementById('newProductBtn');
    const searchProductBtn = document.getElementById('searchProductBtn');
    if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
    if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
    document.addEventListener('click', closeAll);
}

document.addEventListener('DOMContentLoaded', () => {
    setupHeaderDropdowns();
    LocationCodeUtils.setupLocationComposition(LOCATION_FIELD_IDS);

    const form = document.getElementById('locationForm');
    const clearBtn = document.getElementById('clearLocationBtn');
    const saveBtn = document.getElementById('saveLocationBtn');

    function showError(fieldId, message) {
        const errorEl = document.getElementById(`${fieldId}-error`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    }

    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.classList.remove('show');
            el.textContent = '';
        });
    }

    function validate() {
        clearErrors();
        LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);

        let valid = true;
        const validation = LocationCodeUtils.validateLocationParts(
            LocationCodeUtils.getLocationParts(LOCATION_FIELD_IDS)
        );
        const status = document.getElementById('locationStatus').value;
        const accessType = document.getElementById('accessType').value;
        const section = document.getElementById('locationSection').value;

        if (validation.errors.street) {
            showError('locationStreet', validation.errors.street);
            valid = false;
        }
        if (validation.errors.building) {
            showError('locationBuilding', validation.errors.building);
            valid = false;
        }
        if (validation.errors.level) {
            showError('locationLevel', validation.errors.level);
            valid = false;
        }
        if (validation.errors.side) {
            showError('locationSide', validation.errors.side);
            valid = false;
        }
        if (validation.errors.sublevel) {
            showError('locationSublevel', validation.errors.sublevel);
            valid = false;
        }
        if (validation.errors.code) {
            showError('locationCode', validation.errors.code);
            valid = false;
        }

        if (!status) {
            showError('locationStatus', 'Select a status');
            valid = false;
        }

        if (!accessType) {
            showError('accessType', 'Select an access type');
            valid = false;
        }

        if (!section) {
            showError('locationSection', 'Select a section');
            valid = false;
        }

        return valid;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate()) return;

        const data = {
            location: document.getElementById('locationCode').value.trim(),
            status: document.getElementById('locationStatus').value,
            accessType: document.getElementById('accessType').value,
            section: document.getElementById('locationSection').value
        };

        saveBtn.disabled = true;
        saveBtn.classList.add('loading');

        fetch(LOCATIONS_API_URL, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(async (res) => {
            const result = await res.json().catch(() => ({}));
            if (!res.ok || !result.success) {
                const msg = result.message || result.error || 'Error saving location';
                throw new Error(msg);
            }
            alert('Location saved successfully.');
            form.reset();
            clearErrors();
            LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
            document.getElementById('locationStreet').focus();
        })
        .catch((err) => {
            console.error('Error saving location:', err);
            let msg = err.message;
            if (msg === 'Failed to fetch' || err.name === 'TypeError') {
                msg = 'Cannot reach server. Open this page from http://localhost:3000/location.html and ensure the backend is running.';
            }
            alert('Error saving location: ' + msg);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
        });
    });

    clearBtn.addEventListener('click', () => {
        form.reset();
        clearErrors();
        LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
        document.getElementById('locationStreet').focus();
    });

});
