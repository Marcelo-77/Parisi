const LOCATIONS_API_URL = '/api/locations';
const LOCATION_CODE_SETTINGS_API = '/api/location-code-settings';

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

let locationCodeSettings = {
    activeScheme: 'classic',
    levelOnlyUsesLPrefix: false,
    withPositionOmitsL: true,
    separator: '-',
    allowLevelOnly: false,
    allowPosition: true,
    bayPatternHint: 'A1, A2, B1...',
    levelZeroLocationLetter: 'L',
    minSublevel: 0,
    maxSublevel: 99,
    minLevel: 0,
    maxLevel: 99,
    minPosition: 1,
    maxPosition: 99
};

function isBayScheme() {
    return String(locationCodeSettings.activeScheme || '') === 'bay_level_position';
}

function canUseBayBehind(street) {
    const s = String(street || '').trim().toUpperCase();
    return s === 'A' || s === 'H';
}

function normalizeBayBuildingX(raw) {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    const n = Number(digits);
    if (!Number.isInteger(n) || n < 1) return '';
    return String(n);
}

function isBayA21Special(street, building) {
    return String(street || '').trim().toUpperCase() === 'A'
        && String(building ?? '').trim() === '21';
}

function getBayA21XParts() {
    const street = String(document.getElementById('locationNewStreet')?.value || '').trim().toUpperCase();
    const building = String(document.getElementById('locationNewBuilding')?.value ?? '').trim();
    const buildingXEl = document.getElementById('locationNewBuildingX');
    const buildingX = normalizeBayBuildingX(buildingXEl?.value);
    const a21Special = isBayA21Special(street, building);
    const a21WithX = a21Special && buildingX !== '';
    return { street, building, buildingX, a21Special, a21WithX };
}

function composeBayLocationCode() {
    const { street, building, buildingX, a21WithX } = getBayA21XParts();
    const bay = a21WithX ? `A21X${buildingX}` : `${street}${building}`;
    const levelEl = document.getElementById('locationBayLevel');
    const level = a21WithX ? 0 : Number(levelEl?.value);
    const positionRaw = String(document.getElementById('locationBayPosition')?.value ?? '').trim();
    const sublevelRaw = String(document.getElementById('locationBaySublevel')?.value ?? '').trim();
    const zeroType = a21WithX
        ? 'location'
        : String(document.getElementById('locationBayZeroType')?.value || '').trim().toLowerCase();
    const behindRaw = String(document.getElementById('locationBayBehind')?.value || '').trim().toUpperCase();
    // A21X keeps the same photo-search prefix (A21X*) — Behind is not used on X bins
    const behind = (!a21WithX && behindRaw === 'B' && canUseBayBehind(street)) ? 'B' : '';
    const sep = locationCodeSettings.separator || '-';
    const letter = String(locationCodeSettings.levelZeroLocationLetter || 'L').toUpperCase();
    if (!street || !/^[A-Z]$/.test(street)) return '';
    if (building === '' || !/^\d+$/.test(building)) return '';
    if (a21WithX && !buildingX) return '';
    if (!Number.isInteger(level) || level < locationCodeSettings.minLevel || level > locationCodeSettings.maxLevel) return '';

    const hasPosition = positionRaw !== '';
    const position = hasPosition ? Number(positionRaw) : NaN;
    if (hasPosition) {
        if (!Number.isInteger(position) || position < locationCodeSettings.minPosition || position > locationCodeSettings.maxPosition) {
            return '';
        }
    }

    if (level === 0) {
        if (zeroType === 'pallet') {
            if (!hasPosition) return '';
            return `${bay}${sep}0${sep}${position}`;
        }
        if (zeroType !== 'location') return '';
        const sublevel = Number(sublevelRaw);
        if (!Number.isInteger(sublevel) || sublevel < locationCodeSettings.minSublevel || sublevel > locationCodeSettings.maxSublevel) {
            return '';
        }
        const behindOk = behind && canUseBayBehind(street);
        const base = `${bay}${sep}${letter}${sublevel}`;
        const withPos = hasPosition ? `${base}${sep}${position}` : base;
        return `${withPos}${behindOk ? behind : ''}`;
    }

    if (!hasPosition) {
        // Level > 0: Position is always required
        return '';
    }
    if (!locationCodeSettings.allowPosition) return '';
    return `${bay}${sep}${level}${sep}${position}`;
}

function updateBayComposedLocation() {
    const codeEl = document.getElementById('locationCode');
    if (codeEl) codeEl.value = composeBayLocationCode();
}

function clearClassicLocationFields() {
    [
        'locationStreet', 'locationBuilding', 'locationBuildingX', 'locationLevel',
        'locationSide', 'locationSublevel', 'locationBehind', 'locationLevelZeroMode'
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = '';
    });
}

function syncBayLevelZeroUi() {
    const { street, building, buildingX, a21Special, a21WithX } = getBayA21XParts();
    const levelEl = document.getElementById('locationBayLevel');
    const zeroTypeEl = document.getElementById('locationBayZeroType');
    const sectionEl = document.getElementById('locationSection');
    const bayAddressRow = document.getElementById('locationBaySchemeFields');
    const buildingCombo = document.getElementById('locationNewBuildingCombo');
    const buildingXEl = document.getElementById('locationNewBuildingX');

    if (buildingCombo) buildingCombo.classList.toggle('is-a21', a21Special);
    if (bayAddressRow) bayAddressRow.classList.toggle('is-a21-layout', a21WithX);
    if (buildingXEl) {
        buildingXEl.placeholder = a21Special ? 'opt.' : '1';
        buildingXEl.title = a21Special
            ? 'Optional. Leave empty for normal A21. Fill to create A21X1-L0 (photo search A21X*).'
            : 'X number for A21 only';
        if (!a21Special) buildingXEl.value = '';
        else if (buildingX && String(buildingXEl.value || '').trim() !== buildingX) {
            buildingXEl.value = buildingX;
        }
    }

    if (a21WithX) {
        if (levelEl) {
            levelEl.value = '0';
            levelEl.readOnly = true;
            levelEl.classList.add('input-readonly');
        }
        if (zeroTypeEl) zeroTypeEl.value = 'location';
        if (sectionEl) {
            sectionEl.value = 'OTHER';
            sectionEl.disabled = true;
        }
    } else if (levelEl) {
        levelEl.readOnly = false;
        levelEl.classList.remove('input-readonly');
        if (sectionEl) sectionEl.disabled = false;
    }

    const level = a21WithX ? 0 : Number(levelEl?.value);
    const isZero = Number.isInteger(level) && level === 0;
    const zeroType = a21WithX ? 'location' : String(zeroTypeEl?.value || '');
    const zeroTypeGroup = document.getElementById('locationBayZeroTypeGroup');
    const sublevelGroup = document.getElementById('locationBaySublevelGroup');
    const behindGroup = document.getElementById('locationBayBehindGroup');
    const behindEl = document.getElementById('locationBayBehind');
    const positionLabel = document.getElementById('locationBayPositionLabel');
    const positionHint = document.getElementById('locationBayPositionHint');
    const positionInput = document.getElementById('locationBayPosition');
    const sublevelHint = document.getElementById('locationBaySublevelHint');
    const subEl = document.getElementById('locationBaySublevel');
    const letter = String(locationCodeSettings.levelZeroLocationLetter || 'L').toUpperCase();
    const minSub = Number.isInteger(Number(locationCodeSettings.minSublevel))
        ? Number(locationCodeSettings.minSublevel)
        : 0;
    // Behind only for Location + Street A/H — not for A21X (photo-search bins)
    const showBehind = isZero && !a21WithX && canUseBayBehind(street) && zeroType === 'location';

    if (zeroTypeGroup) zeroTypeGroup.style.display = isZero && !a21WithX ? '' : 'none';
    if (sublevelGroup) sublevelGroup.style.display = isZero && zeroType === 'location' ? '' : 'none';
    if (behindGroup) behindGroup.style.display = showBehind ? '' : 'none';
    if (behindEl && !showBehind) behindEl.value = '';

    if (!isZero) {
        if (positionLabel) positionLabel.innerHTML = '<i class="fas fa-th"></i> Position *';
        if (positionInput) {
            positionInput.placeholder = 'Required';
            positionInput.required = true;
        }
        if (positionHint) {
            positionHint.textContent = 'Position is required when Level > 0.';
        }
        if (subEl) {
            subEl.value = '';
            subEl.required = false;
        }
        return;
    }

    if (zeroType === 'location') {
        if (positionLabel) positionLabel.innerHTML = '<i class="fas fa-th"></i> Position';
        if (positionInput) {
            positionInput.placeholder = 'Optional';
            positionInput.required = false;
        }
        if (positionHint) {
            positionHint.textContent = a21WithX
                ? 'Optional. Code stays under A21X* for photo search.'
                : 'Optional for Location type.';
        }
        if (sublevelHint) {
            const sampleBay = a21WithX ? `A21X${buildingX}` : 'A1';
            sublevelHint.textContent = `Starts at ${minSub} (no leading zero). Code uses “${letter}” + Sublevel, e.g. ${sampleBay}-${letter}${minSub}${showBehind ? ' or …B' : ''}.`;
        }
        if (subEl) {
            const current = Number(String(subEl.value || '').trim());
            subEl.value = Number.isInteger(current) && current >= minSub
                ? String(current)
                : String(minSub);
            subEl.required = true;
        }
    } else if (zeroType === 'pallet') {
        if (positionLabel) positionLabel.innerHTML = '<i class="fas fa-th"></i> Position *';
        if (positionInput) {
            positionInput.placeholder = 'Required';
            positionInput.required = true;
        }
        if (positionHint) positionHint.textContent = 'Required for Pallet at Level 0 (no letter).';
        if (subEl) {
            subEl.value = '';
            subEl.required = false;
        }
    } else {
        if (positionLabel) positionLabel.innerHTML = '<i class="fas fa-th"></i> Position';
        if (positionInput) {
            positionInput.placeholder = '—';
            positionInput.required = false;
        }
        if (positionHint) positionHint.textContent = 'Select Location or Pallet first.';
        if (subEl) {
            subEl.value = '';
            subEl.required = false;
        }
    }
}

function setClassicFieldsRequired(required) {
    ['locationStreet', 'locationBuilding', 'locationLevel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.required = required;
    });
    ['locationNewStreet', 'locationNewBuilding', 'locationBayLevel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.required = !required && isBayScheme();
    });
}

function applyLocationSchemeUi() {
    const classic = document.getElementById('locationClassicSchemeFields');
    const bay = document.getElementById('locationBaySchemeFields');
    const hint = document.getElementById('locationSchemeHint');
    const codeEl = document.getElementById('locationCode');
    const useBay = isBayScheme();
    if (classic) classic.style.display = useBay ? 'none' : '';
    if (bay) bay.style.display = useBay ? '' : 'none';
    setClassicFieldsRequired(!useBay);
    if (useBay) clearClassicLocationFields();
    if (hint) {
        hint.textContent = useBay
            ? `Active scheme: Street / Building / Level. Level 0 asks Location (letter ${locationCodeSettings.levelZeroLocationLetter || 'L'} + Sublevel) or Pallet (Position required). A21 + X → A21Xn-${locationCodeSettings.levelZeroLocationLetter || 'L'}0 (same A21X* prefix for photo search). Behind (B) only for Location when Street is A or H (not A21X).`
            : 'Active scheme: Classic Street / Building / Level / Side (from Setting Location). Behind (B) only for Level 0 Sublevel when Street is A or H.';
    }
    if (codeEl) codeEl.placeholder = useBay ? 'Ex: A1-2-1, A1-L0, A1-0-1' : 'Ex: B1-00, B15-1L';
    if (useBay) {
        syncBayLevelZeroUi();
        updateBayComposedLocation();
    } else if (typeof LocationCodeUtils !== 'undefined') {
        LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
    }
}

async function loadLocationCodeSettings() {
    try {
        const res = await fetch(LOCATION_CODE_SETTINGS_API, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success && data.data) {
            locationCodeSettings = { ...locationCodeSettings, ...data.data };
        }
    } catch (err) {
        console.warn('Location code settings unavailable; using classic scheme.', err);
    }
    applyLocationSchemeUi();
}

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
    const rawUpdateComposed = LocationCodeUtils.updateComposedLocation.bind(LocationCodeUtils);
    LocationCodeUtils.updateComposedLocation = function updateComposedLocationGuarded(ids, options) {
        // New Street/Building/Level scheme owns the Location code — do not apply Classic "-01" sublevel format.
        if (isBayScheme()) {
            updateBayComposedLocation();
            return document.getElementById('locationCode')?.value || '';
        }
        return rawUpdateComposed(ids, options);
    };

    LocationCodeUtils.setupLocationComposition(LOCATION_FIELD_IDS);
    loadLocationCodeSettings();
    ['locationNewStreet', 'locationNewBuilding', 'locationNewBuildingX', 'locationBayLevel', 'locationBayPosition', 'locationBayZeroType', 'locationBaySublevel', 'locationBayBehind'].forEach((id) => {
        const el = document.getElementById(id);
        el?.addEventListener('input', () => {
            if (id === 'locationBaySublevel') {
                // Strip leading zeros while typing (keep plain 0, 1, 2…)
                const raw = String(el.value || '').trim();
                if (raw !== '' && raw !== '-') {
                    const n = Number(raw);
                    if (Number.isInteger(n) && String(n) !== raw) el.value = String(n);
                }
            }
            if (id === 'locationNewBuildingX') {
                el.value = String(el.value || '').replace(/[^\d]/g, '');
            }
            syncBayLevelZeroUi();
            updateBayComposedLocation();
        });
        el?.addEventListener('change', () => {
            if (id === 'locationBayZeroType' && String(el.value) === 'location') {
                const subEl = document.getElementById('locationBaySublevel');
                if (subEl) subEl.value = String(locationCodeSettings.minSublevel ?? 0);
            }
            syncBayLevelZeroUi();
            updateBayComposedLocation();
        });
    });

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
        let valid = true;
        const status = document.getElementById('locationStatus').value;
        const accessType = document.getElementById('accessType').value;
        const section = document.getElementById('locationSection').value;

        if (isBayScheme()) {
            syncBayLevelZeroUi();
            updateBayComposedLocation();
            const { street, building, buildingX, a21WithX } = getBayA21XParts();
            const level = a21WithX ? 0 : Number(document.getElementById('locationBayLevel')?.value);
            const positionRaw = String(document.getElementById('locationBayPosition')?.value ?? '').trim();
            const zeroType = a21WithX
                ? 'location'
                : String(document.getElementById('locationBayZeroType')?.value || '').trim().toLowerCase();
            const sublevelRaw = String(document.getElementById('locationBaySublevel')?.value ?? '').trim();

            if (!street || !/^[A-Z]$/.test(street)) {
                showError('locationNewStreet', 'Enter Street letter (A–Z)');
                valid = false;
            }
            if (building === '' || !/^\d+$/.test(building)) {
                showError('locationNewBuilding', 'Enter Building number');
                valid = false;
            }
            if (a21WithX) {
                if (!buildingX) {
                    showError('locationNewBuildingX', 'Enter a valid X number (1, 2, 3, ...)');
                    valid = false;
                }
            } else if (String(document.getElementById('locationNewBuildingX')?.value || '').trim() !== '') {
                showError('locationNewBuildingX', 'X number is only available for Street A and Building 21');
                valid = false;
            }
            if (!Number.isInteger(level) || level < locationCodeSettings.minLevel || level > locationCodeSettings.maxLevel) {
                showError('locationBayLevel', `Level must be between ${locationCodeSettings.minLevel} and ${locationCodeSettings.maxLevel}`);
                valid = false;
            }

            if (level === 0) {
                if (zeroType !== 'location' && zeroType !== 'pallet') {
                    showError('locationBayZeroType', 'Select Location or Pallet');
                    valid = false;
                } else if (zeroType === 'location') {
                    const sublevel = Number(sublevelRaw);
                    if (!Number.isInteger(sublevel) || sublevel < locationCodeSettings.minSublevel || sublevel > locationCodeSettings.maxSublevel) {
                        showError('locationBaySublevel', `Sublevel must be between ${locationCodeSettings.minSublevel} and ${locationCodeSettings.maxSublevel}`);
                        valid = false;
                    }
                    if (positionRaw) {
                        const position = Number(positionRaw);
                        if (!Number.isInteger(position) || position < locationCodeSettings.minPosition || position > locationCodeSettings.maxPosition) {
                            showError('locationBayPosition', `Position must be between ${locationCodeSettings.minPosition} and ${locationCodeSettings.maxPosition}`);
                            valid = false;
                        }
                    }
                } else if (zeroType === 'pallet') {
                    if (!positionRaw) {
                        showError('locationBayPosition', 'Position is required for Pallet at Level 0');
                        valid = false;
                    } else {
                        const position = Number(positionRaw);
                        if (!Number.isInteger(position) || position < locationCodeSettings.minPosition || position > locationCodeSettings.maxPosition) {
                            showError('locationBayPosition', `Position must be between ${locationCodeSettings.minPosition} and ${locationCodeSettings.maxPosition}`);
                            valid = false;
                        }
                    }
                }
            } else {
                if (!positionRaw) {
                    showError('locationBayPosition', 'Position is required when Level > 0');
                    valid = false;
                } else {
                    const position = Number(positionRaw);
                    if (!Number.isInteger(position) || position < locationCodeSettings.minPosition || position > locationCodeSettings.maxPosition) {
                        showError('locationBayPosition', `Position must be between ${locationCodeSettings.minPosition} and ${locationCodeSettings.maxPosition}`);
                        valid = false;
                    }
                }
            }

            if (!composeBayLocationCode() || composeBayLocationCode().length < 2) {
                showError('locationCode', 'Complete Street / Building / Level / Position to compose the location');
                valid = false;
            }
        } else {
            LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
            const validation = LocationCodeUtils.validateLocationParts(
                LocationCodeUtils.getLocationParts(LOCATION_FIELD_IDS)
            );
            if (validation.errors.street) { showError('locationStreet', validation.errors.street); valid = false; }
            if (validation.errors.building) { showError('locationBuilding', validation.errors.building); valid = false; }
            if (validation.errors.buildingX) { showError('locationBuildingX', validation.errors.buildingX); valid = false; }
            if (validation.errors.level) { showError('locationLevel', validation.errors.level); valid = false; }
            if (validation.errors.levelZeroMode) { showError('locationLevelZeroMode', validation.errors.levelZeroMode); valid = false; }
            if (validation.errors.side) { showError('locationSide', validation.errors.side); valid = false; }
            if (validation.errors.sublevel) { showError('locationSublevel', validation.errors.sublevel); valid = false; }
            if (validation.errors.behind) { showError('locationBehind', validation.errors.behind); valid = false; }
            if (validation.errors.code) { showError('locationCode', validation.errors.code); valid = false; }
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
        const sectionEl = document.getElementById('locationSection');
        if (sectionEl) sectionEl.disabled = false;
        const bayX = document.getElementById('locationNewBuildingX');
        if (bayX) bayX.value = '';
        const levelEl = document.getElementById('locationBayLevel');
        if (levelEl) {
            levelEl.readOnly = false;
            levelEl.classList.remove('input-readonly');
        }
        const subEl = document.getElementById('locationBaySublevel');
        if (subEl) subEl.value = String(locationCodeSettings.minSublevel ?? 0);
        applyLocationSchemeUi();
        if (isBayScheme()) {
            syncBayLevelZeroUi();
            updateBayComposedLocation();
            document.getElementById('locationNewStreet')?.focus();
        } else {
            LocationCodeUtils.updateComposedLocation(LOCATION_FIELD_IDS);
            document.getElementById('locationStreet')?.focus();
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate()) return;

        const sectionEl = document.getElementById('locationSection');
        if (sectionEl) sectionEl.disabled = false;

        const data = {
            location: document.getElementById('locationCode').value.trim(),
            status: document.getElementById('locationStatus').value,
            accessType: document.getElementById('accessType').value,
            section: sectionEl ? sectionEl.value : document.getElementById('locationSection').value
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
