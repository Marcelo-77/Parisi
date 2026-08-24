(function (global) {
  const DEFAULT_LEVEL_ZERO_ACCESS_TYPE = 'Shelf by Hand';
  const DEFAULT_A21X_SECTION = 'OTHER';
  const A21_SPECIAL_STREET = 'A';
  const A21_SPECIAL_BUILDING = '21';

  function normalizeNumberValue(raw) {
    if (raw === '' || raw == null) return '';
    const value = Number(raw);
    return Number.isNaN(value) ? '' : String(value);
  }

  function resolveLevelZeroMode(parts) {
    if (parts.levelZeroMode === 'side' || parts.levelZeroMode === 'sublevel') {
      return parts.levelZeroMode;
    }
    if (parts.side) return 'side';
    if (parts.sublevel !== '') return 'sublevel';
    return '';
  }

  function canUseBehind(street) {
    return street === 'A' || street === 'H';
  }

  function normalizeBehind(raw, street) {
    const value = String(raw || '').trim().toUpperCase();
    if (value !== 'B') return '';
    if (street && !canUseBehind(street)) return '';
    return 'B';
  }

  function isA21Special(street, building) {
    return String(street || '').trim().toUpperCase() === A21_SPECIAL_STREET
      && normalizeNumberValue(building) === A21_SPECIAL_BUILDING;
  }

  function normalizeBuildingX(raw) {
    if (raw === '' || raw == null) return '';
    const value = Number(raw);
    if (Number.isNaN(value) || value < 1 || !Number.isInteger(value)) return '';
    return String(value);
  }

  function usesA21BuildingX(parts) {
    return isA21Special(parts.street, parts.building)
      && normalizeBuildingX(parts.buildingX) !== '';
  }

  function emptyParts(overrides = {}) {
    return {
      street: '',
      building: '',
      buildingX: '',
      level: '',
      side: '',
      sublevel: '',
      behind: '',
      levelZeroMode: '',
      ...overrides
    };
  }

  // Format: {street}{building}-{level}{side|sublevel}[B]
  // A21 special: A21X1-00, A21X1-01, A21X2-00, ...
  // Examples: B1-00, B15-1L, A7-0R, A7-00B, A21X1-00
  function composeLocationCode({ street, building, buildingX, level, side, sublevel, levelZeroMode, behind }) {
    if (!street || building === '') {
      return '';
    }

    const xNumber = normalizeBuildingX(buildingX);
    if (xNumber) {
      if (!isA21Special(street, building)) {
        return '';
      }
      if (sublevel === '') {
        return '';
      }
      const sublevelNumber = Number(sublevel);
      if (Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
        return '';
      }
      // A21X# always Level 0 + chosen Sublevel → A21X1-00, A21X1-01, ...
      // Behind is not allowed for A21X locations.
      return `${A21_SPECIAL_STREET}${A21_SPECIAL_BUILDING}X${xNumber}-0${normalizeNumberValue(sublevel)}`;
    }

    const levelNumber = level === '' ? NaN : Number(level);
    if (Number.isNaN(levelNumber) || levelNumber < 0) {
      return '';
    }

    if (levelNumber === 0) {
      const mode = resolveLevelZeroMode({ side, sublevel, levelZeroMode });
      if (mode === 'side') {
        if (!side) {
          return '';
        }
        return `${street}${building}-0${side}`;
      }

      if (mode !== 'sublevel') {
        return '';
      }

      if (sublevel === '') {
        return '';
      }
      const sublevelNumber = Number(sublevel);
      if (Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
        return '';
      }
      return `${street}${building}-0${normalizeNumberValue(sublevel)}${normalizeBehind(behind, street)}`;
    }

    if (level === '' || !side) {
      return '';
    }

    return `${street}${building}-${levelNumber}${side}`;
  }

  function parseLocationCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || !/^[A-Z]/.test(normalized)) {
      return emptyParts();
    }

    const street = normalized[0];
    const rest = normalized.slice(1);

    if (!rest) {
      return emptyParts({ street });
    }

    // A21 special: 21X1-00 / 21X2-00
    const a21XMatch = rest.match(/^(\d+)X(\d+)-0(\d+)(B)?$/);
    if (a21XMatch) {
      return emptyParts({
        street,
        building: normalizeNumberValue(a21XMatch[1]),
        buildingX: normalizeBuildingX(a21XMatch[2]),
        level: '0',
        sublevel: normalizeNumberValue(a21XMatch[3]),
        behind: a21XMatch[4] === 'B' ? 'B' : '',
        levelZeroMode: 'sublevel'
      });
    }

    // Current format: 15-1L / 1-00 / 7-0R / 7-00B
    const dashedLevelSideMatch = rest.match(/^(\d+)-(\d+)([RLM])$/);
    if (dashedLevelSideMatch) {
      const level = dashedLevelSideMatch[2];
      return emptyParts({
        street,
        building: dashedLevelSideMatch[1],
        level,
        side: dashedLevelSideMatch[3],
        levelZeroMode: level === '0' ? 'side' : ''
      });
    }

    const dashedSublevelMatch = rest.match(/^(\d+)-0(\d+)(B)?$/);
    if (dashedSublevelMatch) {
      return emptyParts({
        street,
        building: dashedSublevelMatch[1] === '' ? '0' : dashedSublevelMatch[1],
        level: '0',
        sublevel: normalizeNumberValue(dashedSublevelMatch[2]),
        behind: dashedSublevelMatch[3] === 'B' ? 'B' : '',
        levelZeroMode: 'sublevel'
      });
    }

    // Legacy double-dash: 15-1-L / 1-0-0 / 1-0-0B
    const legacyDoubleDashSide = rest.match(/^(\d+)-(\d+)-([RLM])$/);
    if (legacyDoubleDashSide) {
      const level = legacyDoubleDashSide[2];
      return emptyParts({
        street,
        building: legacyDoubleDashSide[1],
        level,
        side: legacyDoubleDashSide[3],
        levelZeroMode: level === '0' ? 'side' : ''
      });
    }

    const legacyDoubleDashSublevel = rest.match(/^(\d+)-0-(\d+)(B)?$/);
    if (legacyDoubleDashSublevel) {
      return emptyParts({
        street,
        building: legacyDoubleDashSublevel[1] === '' ? '0' : legacyDoubleDashSublevel[1],
        level: '0',
        sublevel: normalizeNumberValue(legacyDoubleDashSublevel[2]),
        behind: legacyDoubleDashSublevel[3] === 'B' ? 'B' : '',
        levelZeroMode: 'sublevel'
      });
    }

    // Legacy no-dash: 151L / 100 / 70R / 100B
    const legacySideMatch = rest.match(/^(.+)([RLM])$/);
    if (legacySideMatch) {
      const body = legacySideMatch[1];
      const side = legacySideMatch[2];
      const level = body.slice(-1);
      const building = body.slice(0, -1);
      const levelNumber = Number(level);

      if (!Number.isNaN(levelNumber) && levelNumber >= 0) {
        return emptyParts({
          street,
          building: building === '' ? '0' : building,
          level,
          side,
          levelZeroMode: levelNumber === 0 ? 'side' : ''
        });
      }
    }

    const legacySublevelMatch = rest.match(/^(.+)0(\d+)(B)?$/);
    if (legacySublevelMatch) {
      return emptyParts({
        street,
        building: legacySublevelMatch[1] === '' ? '0' : legacySublevelMatch[1],
        level: '0',
        sublevel: normalizeNumberValue(legacySublevelMatch[2]),
        behind: legacySublevelMatch[3] === 'B' ? 'B' : '',
        levelZeroMode: 'sublevel'
      });
    }

    return emptyParts({ street });
  }

  function buildPartialSearchTerm({ street, building, buildingX, level, side, sublevel, levelZeroMode, behind }) {
    let term = street || '';
    if (building !== '') {
      term += building;
      const xNumber = normalizeBuildingX(buildingX);
      if (xNumber && isA21Special(street, building)) {
        term += `X${xNumber}`;
      }
      term += '-';
    }

    if (usesA21BuildingX({ street, building, buildingX })) {
      const xNumber = normalizeBuildingX(buildingX);
      let term = `${A21_SPECIAL_STREET}${A21_SPECIAL_BUILDING}X${xNumber}-`;
      if (sublevel !== '') {
        term += `0${normalizeNumberValue(sublevel)}`;
      }
      return term.endsWith('-') ? term.slice(0, -1) : term;
    }

    if (level === '') {
      return term.endsWith('-') ? term.slice(0, -1) : term;
    }

    const levelNumber = Number(level);
    if (Number.isNaN(levelNumber)) {
      return term.endsWith('-') ? term.slice(0, -1) : term;
    }

    if (levelNumber === 0) {
      const mode = resolveLevelZeroMode({ side, sublevel, levelZeroMode });
      term += '0';
      if (mode === 'side' && side) {
        term += side;
      } else if (mode === 'sublevel' && sublevel !== '') {
        term += normalizeNumberValue(sublevel);
        term += normalizeBehind(behind, street);
      }
      return term;
    }

    term += String(levelNumber);
    if (side) {
      term += side;
    }
    return term;
  }

  function getLocationParts(ids) {
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const buildingXEl = ids.buildingXId ? document.getElementById(ids.buildingXId) : null;
    const levelEl = document.getElementById(ids.levelId);
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const behindEl = ids.behindId ? document.getElementById(ids.behindId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;

    const street = streetEl ? streetEl.value.trim().toUpperCase() : '';
    const building = buildingEl ? normalizeNumberValue(buildingEl.value.trim()) : '';
    const buildingX = buildingXEl ? normalizeBuildingX(buildingXEl.value.trim()) : '';
    const level = levelEl ? normalizeNumberValue(levelEl.value.trim()) : '';
    const side = sideEl ? sideEl.value.trim().toUpperCase() : '';
    const sublevel = sublevelEl ? normalizeNumberValue(sublevelEl.value.trim()) : '';
    const behind = behindEl ? normalizeBehind(behindEl.value, street) : '';
    const levelZeroMode = modeEl ? String(modeEl.value || '').trim().toLowerCase() : '';

    return { street, building, buildingX, level, side, sublevel, behind, levelZeroMode };
  }

  function setLocationParts(ids, parts) {
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const buildingXEl = ids.buildingXId ? document.getElementById(ids.buildingXId) : null;
    const levelEl = document.getElementById(ids.levelId);
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const behindEl = ids.behindId ? document.getElementById(ids.behindId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;

    if (streetEl) streetEl.value = parts.street || '';
    if (buildingEl) buildingEl.value = parts.building !== '' ? parts.building : '';
    if (buildingXEl) buildingXEl.value = parts.buildingX !== '' ? parts.buildingX : '';
    if (levelEl) levelEl.value = parts.level !== '' ? parts.level : '';
    if (sideEl) sideEl.value = parts.side || '';
    if (sublevelEl) sublevelEl.value = parts.sublevel !== '' ? parts.sublevel : '';
    if (behindEl) behindEl.value = parts.behind === 'B' ? 'B' : '';
    if (modeEl) {
      const inferredMode = parts.levelZeroMode
        || (parts.level === '0' || Number(parts.level) === 0
          ? (parts.side ? 'side' : (parts.sublevel !== '' ? 'sublevel' : ''))
          : '');
      modeEl.value = inferredMode;
    }
  }

  function syncBuildingXInputs(ids) {
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const buildingXEl = ids.buildingXId ? document.getElementById(ids.buildingXId) : null;
    if (!buildingEl) return;

    const street = streetEl ? streetEl.value.trim().toUpperCase() : '';
    let raw = String(buildingEl.value || '').toUpperCase().replace(/\s/g, '');
    const typedWithX = street === 'A' ? raw.match(/^(\d*)X(\d*)$/) : null;

    if (typedWithX) {
      buildingEl.value = typedWithX[1];
      if (buildingXEl) {
        buildingXEl.value = typedWithX[2].replace(/[^\d]/g, '');
        if (typedWithX[1] === A21_SPECIAL_BUILDING && document.activeElement === buildingEl && typedWithX[2] === '') {
          buildingXEl.focus();
        }
      }
    } else {
      buildingEl.value = raw.replace(/[^\d]/g, '');
    }

    if (buildingXEl) {
      buildingXEl.value = String(buildingXEl.value || '').replace(/[^\d]/g, '');
    }
  }

  function updateLevelDependentFields(ids) {
    const levelEl = document.getElementById(ids.levelId);
    const sideGroupEl = ids.sideGroupId ? document.getElementById(ids.sideGroupId) : null;
    const sublevelGroupEl = ids.sublevelGroupId ? document.getElementById(ids.sublevelGroupId) : null;
    const modeGroupEl = ids.levelZeroModeGroupId ? document.getElementById(ids.levelZeroModeGroupId) : null;
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const behindGroupEl = ids.behindGroupId ? document.getElementById(ids.behindGroupId) : null;
    const behindEl = ids.behindId ? document.getElementById(ids.behindId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const buildingXEl = ids.buildingXId ? document.getElementById(ids.buildingXId) : null;
    const buildingComboEl = buildingEl ? buildingEl.closest('.building-x-combo') : null;
    const accessEl = ids.accessTypeId ? document.getElementById(ids.accessTypeId) : null;
    const sectionEl = ids.sectionId ? document.getElementById(ids.sectionId) : null;

    const street = streetEl ? streetEl.value.trim().toUpperCase() : '';
    const building = buildingEl ? normalizeNumberValue(buildingEl.value.trim()) : '';
    const a21Special = isA21Special(street, building);
    const buildingX = buildingXEl ? normalizeBuildingX(buildingXEl.value.trim()) : '';
    const a21WithX = a21Special && buildingX !== '';
    const addressRowEl = streetEl ? streetEl.closest('.location-row-address') : null;

    if (addressRowEl) {
      // Compact A21X layout only when X is filled; A21 without X keeps the normal form.
      addressRowEl.classList.toggle('is-a21-layout', a21WithX);
    }
    if (buildingComboEl) {
      buildingComboEl.classList.toggle('is-a21', a21Special);
    }
    if (buildingXEl) {
      buildingXEl.required = false;
      buildingXEl.setAttribute('aria-required', 'false');
      buildingXEl.placeholder = a21Special ? 'opt.' : '1';
      buildingXEl.title = a21Special
        ? 'Optional. Leave empty for normal A21. Fill to create A21X1-00, A21X2-00, ...'
        : 'X number for A21 only';
    }
    if (!a21Special && buildingXEl) {
      buildingXEl.value = '';
    }

    if (a21WithX) {
      if (levelEl) {
        levelEl.value = '0';
        levelEl.readOnly = true;
        levelEl.classList.add('input-readonly');
      }
      if (modeEl) modeEl.value = 'sublevel';
      if (sideEl) {
        sideEl.value = '';
        sideEl.required = false;
      }
      if (accessEl) {
        accessEl.value = DEFAULT_LEVEL_ZERO_ACCESS_TYPE;
        accessEl.disabled = true;
      }
      if (sectionEl) {
        sectionEl.value = DEFAULT_A21X_SECTION;
        sectionEl.disabled = true;
      }
      if (modeGroupEl) modeGroupEl.style.display = 'none';
      if (sideGroupEl) sideGroupEl.style.display = 'none';
      if (sublevelGroupEl) sublevelGroupEl.style.display = '';
      if (sublevelEl) {
        sublevelEl.required = true;
        sublevelEl.readOnly = false;
        sublevelEl.classList.remove('input-readonly');
      }
      if (behindGroupEl) behindGroupEl.style.display = 'none';
      if (behindEl) {
        behindEl.required = false;
        behindEl.value = '';
      }
      return;
    }

    if (levelEl) {
      levelEl.readOnly = false;
      levelEl.classList.remove('input-readonly');
    }
    if (accessEl) {
      accessEl.disabled = false;
    }
    if (sectionEl) {
      sectionEl.disabled = false;
    }

    const levelRaw = levelEl ? levelEl.value.trim() : '';
    const levelNumber = levelRaw === '' ? null : Number(levelRaw);
    const isGroundLevel = levelNumber === 0;
    const hasUpperLevel = levelNumber != null && levelNumber > 0;
    const mode = modeEl ? String(modeEl.value || '').trim().toLowerCase() : '';
    const useSide = hasUpperLevel || (isGroundLevel && mode === 'side');
    const useSublevel = isGroundLevel && mode === 'sublevel';
    const sublevelFilled = useSublevel && sublevelEl && String(sublevelEl.value || '').trim() !== '';
    const useBehind = canUseBehind(street) && sublevelFilled;

    if (modeGroupEl) {
      modeGroupEl.style.display = isGroundLevel ? '' : 'none';
    }
    if (!isGroundLevel && modeEl) {
      modeEl.value = '';
    }

    if (sideGroupEl) {
      sideGroupEl.style.display = useSide ? '' : 'none';
    }
    if (sublevelGroupEl) {
      sublevelGroupEl.style.display = useSublevel ? '' : 'none';
    }

    if (sideEl) {
      sideEl.required = useSide;
      if (!useSide) {
        sideEl.value = '';
      }
    }

    if (sublevelEl) {
      sublevelEl.required = useSublevel;
      if (!useSublevel) {
        sublevelEl.value = '';
      }
    }

    if (behindGroupEl) {
      behindGroupEl.style.display = useBehind ? '' : 'none';
    }
    if (behindEl) {
      behindEl.required = false;
      if (!useBehind) {
        behindEl.value = '';
      }
    }

    if (isGroundLevel && accessEl) {
      accessEl.value = DEFAULT_LEVEL_ZERO_ACCESS_TYPE;
    }
  }

  function updateComposedLocation(ids, options = {}) {
    const codeEl = document.getElementById(ids.codeId);
    if (!codeEl) return '';

    syncBuildingXInputs(ids);
    updateLevelDependentFields(ids);
    const parts = getLocationParts(ids);
    const hasComponentInput = Boolean(
      parts.street ||
      parts.building !== '' ||
      parts.buildingX !== '' ||
      parts.level !== '' ||
      parts.side ||
      parts.sublevel !== '' ||
      parts.behind ||
      parts.levelZeroMode
    );

    if (options.allowDirectCodeEntry && !hasComponentInput) {
      return codeEl.value.trim();
    }

    const composed = options.allowPartial
      ? (composeLocationCode(parts) || buildPartialSearchTerm(parts))
      : composeLocationCode(parts);

    codeEl.value = composed;
    return composed;
  }

  function setupLocationComposition(ids, options = {}) {
    const fieldIds = [
      ids.streetId,
      ids.buildingId,
      ids.buildingXId,
      ids.levelId,
      ids.sideId,
      ids.sublevelId,
      ids.behindId,
      ids.levelZeroModeId
    ].filter(Boolean);

    fieldIds.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (!field) return;

      field.addEventListener('input', () => updateComposedLocation(ids, options));
      field.addEventListener('change', () => updateComposedLocation(ids, options));
    });

    const streetEl = document.getElementById(ids.streetId);
    if (streetEl) {
      streetEl.addEventListener('input', () => {
        streetEl.value = streetEl.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1);
        updateComposedLocation(ids, options);
      });
    }

    updateComposedLocation(ids, options);
  }

  function validateLocationParts(parts, options = {}) {
    const errors = {};
    const levelNumber = parts.level === '' ? NaN : Number(parts.level);
    const buildingNumber = parts.building === '' ? NaN : Number(parts.building);
    const sublevelNumber = parts.sublevel === '' ? NaN : Number(parts.sublevel);
    const buildingXRaw = parts.buildingX === '' || parts.buildingX == null
      ? ''
      : String(parts.buildingX).trim();
    const buildingXNumber = buildingXRaw === '' ? NaN : Number(buildingXRaw);
    const a21WithX = usesA21BuildingX(parts);

    if (!/^[A-Z]$/.test(parts.street)) {
      errors.street = 'Enter one alphabet letter (A-Z)';
    }

    if (parts.building === '' || Number.isNaN(buildingNumber) || buildingNumber < 0) {
      errors.building = 'Enter a valid building number';
    }

    if (buildingXRaw !== '') {
      if (!isA21Special(parts.street, parts.building)) {
        errors.buildingX = 'X number is only available for Street A and Building 21';
      } else if (Number.isNaN(buildingXNumber) || buildingXNumber < 1 || !Number.isInteger(buildingXNumber)) {
        errors.buildingX = 'Enter a valid X number (1, 2, 3, ...)';
      }
    }

    if (a21WithX) {
      if (parts.sublevel === '' || Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
        errors.sublevel = 'Enter a valid sublevel number';
      } else if (parts.behind === 'B') {
        errors.behind = 'Behind is not available for A21X locations';
      }
      const composed = composeLocationCode({ ...parts, behind: '' }, options);
      if (!errors.sublevel && composed.length < 2) {
        errors.code = 'Complete Street A, Building 21, X number and Sublevel to compose the location';
      }
      return {
        valid: Object.keys(errors).length === 0,
        errors,
        composed
      };
    }

    if (parts.level === '' || Number.isNaN(levelNumber) || levelNumber < 0) {
      errors.level = 'Enter a valid level number';
    }

    if (levelNumber === 0) {
      const mode = resolveLevelZeroMode(parts);
      if (mode !== 'side' && mode !== 'sublevel') {
        errors.levelZeroMode = 'Select Side or Sublevel when level is 0';
      } else if (mode === 'side') {
        if (!/^[RLM]$/.test(parts.side)) {
          errors.side = 'Select R, L or M for level 0 Side';
        }
      } else if (parts.sublevel === '' || Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
        errors.sublevel = 'Enter a valid sublevel number when level is 0';
      } else if (parts.behind && parts.behind !== 'B') {
        errors.behind = 'Select B (Behind) or leave empty';
      } else if (parts.behind === 'B' && !canUseBehind(parts.street)) {
        errors.behind = 'Behind is only available for Street A or H';
      }
    } else if (levelNumber > 0 && !/^[RLM]$/.test(parts.side)) {
      errors.side = 'Select R, L or M when level is greater than 0';
    }

    const composed = composeLocationCode(parts, options);
    if (composed.length < 2) {
      errors.code = 'Complete Street, Building, Level and Sublevel/Side to compose the location';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      composed
    };
  }

  global.LocationCodeUtils = {
    composeLocationCode,
    parseLocationCode,
    buildPartialSearchTerm,
    getLocationParts,
    setLocationParts,
    updateLevelDependentFields,
    updateSideFieldState: updateLevelDependentFields,
    updateComposedLocation,
    setupLocationComposition,
    validateLocationParts,
    canUseBehind,
    isA21Special,
    usesA21BuildingX
  };
})(window);
