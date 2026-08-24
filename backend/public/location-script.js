const LOCATIONS_API_URL = '/api/locations';

const LOCATION_FIELD_IDS = {
    streetId: 'locationStreet',
    buildingId: 'locationBuilding',
    buildingXId: 'locationBuildingX',
    levelId: 'locationLevel',
    sideId: 'locationSide',
    sublevelId: 'locationSublevel',
    behindId: 'locationBehind',
    codeId: 'locationCode',
    sideGroupId: 'locationSideGroup',
    sublevelGroupId: 'locationSublevelGroup',
    behindGroupId: 'locationBehindGroup',
    levelZeroModeId: 'locationLevelZeroMode',
    levelZeroModeGroupId: 'locationLevelZeroModeGroup',
    accessTypeId: 'accessType',
    sectionId: 'locationSection'
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
    LocationCodeUtils.setupLocationComposition(LOCATION_FIELD_IDS);

    function revealLocationForm() {
        const target = document.getElementById('locationFormPanel');
        if (!target) return;
        const offset = 8;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }

    // Scroll so Create New Location fills the screen (past the large header)
    requestAnimationFrame(() => {
        revealLocationForm();
        setTimeout(revealLocationForm, 50);
    });
    window.addEventListener('load', revealLocationForm);

    const form = document.getElementById('locationForm');
    const clearBtn = document.getElementById('clearLocationBtn');
    const cancelBtn = document.getElementById('cancelLocationBtn');
    const saveBtn = document.getElementById('saveLocationBtn');

    const locationErrorModal = document.getElementById('locationErrorModal');
    const locationErrorMessage = document.getElementById('locationErrorMessage');
    const closeLocationErrorModal = document.getElementById('closeLocationErrorModal');
    const closeLocationErrorBtn = document.getElementById('closeLocationErrorBtn');
    const locationSuccessModal = document.getElementById('locationSuccessModal');
    const locationSuccessMessage = document.getElementById('locationSuccessMessage');
    const closeLocationSuccessModal = document.getElementById('closeLocationSuccessModal');
    const closeLocationSuccessBtn = document.getElementById('closeLocationSuccessBtn');

    function openFeedbackDialog(modal, closeBtn, messageEl, message, fallback) {
        if (!modal) return;
        if (messageEl) {
            messageEl.textContent = message || fallback;
        }
        modal.classList.add('is-open');
        modal.style.display = 'flex';
        closeBtn?.focus();
    }

    function closeFeedbackDialog(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.style.display = 'none';
    }

    function openLocationErrorDialog(message) {
        openFeedbackDialog(
            locationErrorModal,
            closeLocationErrorBtn,
            locationErrorMessage,
            message,
            'Error saving location.'
        );
    }

    function closeLocationErrorDialog() {
        closeFeedbackDialog(locationErrorModal);
    }

    function openLocationSuccessDialog(message) {
        openFeedbackDialog(
            locationSuccessModal,
            closeLocationSuccessBtn,
            locationSuccessMessage,
            message,
            'Location saved successfully.'
        );
    }

    function closeLocationSuccessDialog() {
        closeFeedbackDialog(locationSuccessModal);
    }

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
        if (validation.errors.buildingX) {
            showError('locationBuildingX', validation.errors.buildingX);
            valid = false;
        }
        if (validation.errors.level) {
            showError('locationLevel', validation.errors.level);
            valid = false;
        }
        if (validation.errors.levelZeroMode) {
            showError('locationLevelZeroMode', validation.errors.levelZeroMode);
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
        if (validation.errors.behind) {
            showError('locationBehind', validation.errors.behind);
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

    function resetLocationForm() {
        form.reset();
        clearErrors();
        document.getElementById('locationStatus').value = 'active';
        LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
        document.getElementById('locationStreet').focus();
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
            openLocationSuccessDialog('Location saved successfully.');
            resetLocationForm();
        })
        .catch((err) => {
            console.error('Error saving location:', err);
            let msg = err.message;
            if (msg === 'Failed to fetch' || err.name === 'TypeError') {
                msg = 'Cannot reach server. Open this page from http://localhost:3000/location.html and ensure the backend is running.';
            }
            if (/already exists|duplicate key|unique constraint/i.test(String(msg || ''))) {
                msg = msg || 'This location already exists.';
            }
            openLocationErrorDialog(msg || 'Error saving location.');
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
        });
    });

    clearBtn.addEventListener('click', () => {
        resetLocationForm();
    });

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.location.href = 'warehouse.html';
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

    if (closeLocationErrorModal) closeLocationErrorModal.addEventListener('click', closeLocationErrorDialog);
    if (closeLocationErrorBtn) closeLocationErrorBtn.addEventListener('click', closeLocationErrorDialog);
    if (locationErrorModal) {
        locationErrorModal.addEventListener('click', (e) => {
            if (e.target === locationErrorModal) closeLocationErrorDialog();
        });
    }

    if (closeLocationSuccessModal) closeLocationSuccessModal.addEventListener('click', closeLocationSuccessDialog);
    if (closeLocationSuccessBtn) closeLocationSuccessBtn.addEventListener('click', closeLocationSuccessDialog);
    if (locationSuccessModal) {
        locationSuccessModal.addEventListener('click', (e) => {
            if (e.target === locationSuccessModal) closeLocationSuccessDialog();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            openLocationHelp();
            return;
        }
        if (e.key === 'Escape') {
            if (locationErrorModal?.classList.contains('is-open')) {
                closeLocationErrorDialog();
                return;
            }
            if (locationSuccessModal?.classList.contains('is-open')) {
                closeLocationSuccessDialog();
                return;
            }
            if (locationHelpModal?.classList.contains('is-open')) {
                closeLocationHelp();
            }
        }
    });

});
