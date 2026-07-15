(function (global) {
  const DEFAULT_LEVEL_ZERO_ACCESS_TYPE = 'Shelf by Hand';

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

  // Format: {street}{building}-{level}{side|sublevel}
  // Examples: B1-00, B15-1L, A7-0R
  function composeLocationCode({ street, building, level, side, sublevel, levelZeroMode }) {
    if (!street || building === '') {
      return '';
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
      return `${street}${building}-0${normalizeNumberValue(sublevel)}`;
    }

    if (level === '' || !side) {
      return '';
    }

    return `${street}${building}-${levelNumber}${side}`;
  }

  function parseLocationCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || !/^[A-Z]/.test(normalized)) {
      return { street: '', building: '', level: '', side: '', sublevel: '', levelZeroMode: '' };
    }

    const street = normalized[0];
    const rest = normalized.slice(1);

    if (!rest) {
      return { street, building: '', level: '', side: '', sublevel: '', levelZeroMode: '' };
    }

    // Current format: 15-1L / 1-00 / 7-0R
    const dashedLevelSideMatch = rest.match(/^(\d+)-(\d+)([RLM])$/);
    if (dashedLevelSideMatch) {
      const level = dashedLevelSideMatch[2];
      return {
        street,
        building: dashedLevelSideMatch[1],
        level,
        side: dashedLevelSideMatch[3],
        sublevel: '',
        levelZeroMode: level === '0' ? 'side' : ''
      };
    }

    const dashedSublevelMatch = rest.match(/^(\d+)-0(\d+)$/);
    if (dashedSublevelMatch) {
      return {
        street,
        building: dashedSublevelMatch[1] === '' ? '0' : dashedSublevelMatch[1],
        level: '0',
        side: '',
        sublevel: normalizeNumberValue(dashedSublevelMatch[2]),
        levelZeroMode: 'sublevel'
      };
    }

    // Legacy double-dash: 15-1-L / 1-0-0
    const legacyDoubleDashSide = rest.match(/^(\d+)-(\d+)-([RLM])$/);
    if (legacyDoubleDashSide) {
      const level = legacyDoubleDashSide[2];
      return {
        street,
        building: legacyDoubleDashSide[1],
        level,
        side: legacyDoubleDashSide[3],
        sublevel: '',
        levelZeroMode: level === '0' ? 'side' : ''
      };
    }

    const legacyDoubleDashSublevel = rest.match(/^(\d+)-0-(\d+)$/);
    if (legacyDoubleDashSublevel) {
      return {
        street,
        building: legacyDoubleDashSublevel[1] === '' ? '0' : legacyDoubleDashSublevel[1],
        level: '0',
        side: '',
        sublevel: normalizeNumberValue(legacyDoubleDashSublevel[2]),
        levelZeroMode: 'sublevel'
      };
    }

    // Legacy no-dash: 151L / 100 / 70R
    const legacySideMatch = rest.match(/^(.+)([RLM])$/);
    if (legacySideMatch) {
      const body = legacySideMatch[1];
      const side = legacySideMatch[2];
      const level = body.slice(-1);
      const building = body.slice(0, -1);
      const levelNumber = Number(level);

      if (!Number.isNaN(levelNumber) && levelNumber >= 0) {
        return {
          street,
          building: building === '' ? '0' : building,
          level,
          side,
          sublevel: '',
          levelZeroMode: levelNumber === 0 ? 'side' : ''
        };
      }
    }

    const legacySublevelMatch = rest.match(/^(.+)0(\d+)$/);
    if (legacySublevelMatch) {
      return {
        street,
        building: legacySublevelMatch[1] === '' ? '0' : legacySublevelMatch[1],
        level: '0',
        side: '',
        sublevel: normalizeNumberValue(legacySublevelMatch[2]),
        levelZeroMode: 'sublevel'
      };
    }

    return { street, building: '', level: '', side: '', sublevel: '', levelZeroMode: '' };
  }

  function buildPartialSearchTerm({ street, building, level, side, sublevel, levelZeroMode }) {
    let term = street || '';
    if (building !== '') {
      term += building;
      term += '-';
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
    const levelEl = document.getElementById(ids.levelId);
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;

    const street = streetEl ? streetEl.value.trim().toUpperCase() : '';
    const building = buildingEl ? normalizeNumberValue(buildingEl.value.trim()) : '';
    const level = levelEl ? normalizeNumberValue(levelEl.value.trim()) : '';
    const side = sideEl ? sideEl.value.trim().toUpperCase() : '';
    const sublevel = sublevelEl ? normalizeNumberValue(sublevelEl.value.trim()) : '';
    const levelZeroMode = modeEl ? String(modeEl.value || '').trim().toLowerCase() : '';

    return { street, building, level, side, sublevel, levelZeroMode };
  }

  function setLocationParts(ids, parts) {
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const levelEl = document.getElementById(ids.levelId);
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;

    if (streetEl) streetEl.value = parts.street || '';
    if (buildingEl) buildingEl.value = parts.building !== '' ? parts.building : '';
    if (levelEl) levelEl.value = parts.level !== '' ? parts.level : '';
    if (sideEl) sideEl.value = parts.side || '';
    if (sublevelEl) sublevelEl.value = parts.sublevel !== '' ? parts.sublevel : '';
    if (modeEl) {
      const inferredMode = parts.levelZeroMode
        || (parts.level === '0' || Number(parts.level) === 0
          ? (parts.side ? 'side' : (parts.sublevel !== '' ? 'sublevel' : ''))
          : '');
      modeEl.value = inferredMode;
    }
  }

  function updateLevelDependentFields(ids) {
    const levelEl = document.getElementById(ids.levelId);
    const sideGroupEl = ids.sideGroupId ? document.getElementById(ids.sideGroupId) : null;
    const sublevelGroupEl = ids.sublevelGroupId ? document.getElementById(ids.sublevelGroupId) : null;
    const modeGroupEl = ids.levelZeroModeGroupId ? document.getElementById(ids.levelZeroModeGroupId) : null;
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const modeEl = ids.levelZeroModeId ? document.getElementById(ids.levelZeroModeId) : null;
    const levelRaw = levelEl ? levelEl.value.trim() : '';
    const levelNumber = levelRaw === '' ? null : Number(levelRaw);
    const isGroundLevel = levelNumber === 0;
    const hasUpperLevel = levelNumber != null && levelNumber > 0;
    const mode = modeEl ? String(modeEl.value || '').trim().toLowerCase() : '';
    const useSide = hasUpperLevel || (isGroundLevel && mode === 'side');
    const useSublevel = isGroundLevel && mode === 'sublevel';

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

    if (isGroundLevel && ids.accessTypeId) {
      const accessEl = document.getElementById(ids.accessTypeId);
      if (accessEl) {
        accessEl.value = DEFAULT_LEVEL_ZERO_ACCESS_TYPE;
      }
    }
  }

  function updateComposedLocation(ids, options = {}) {
    const codeEl = document.getElementById(ids.codeId);
    if (!codeEl) return '';

    updateLevelDependentFields(ids);
    const parts = getLocationParts(ids);
    const hasComponentInput = Boolean(
      parts.street ||
      parts.building !== '' ||
      parts.level !== '' ||
      parts.side ||
      parts.sublevel !== '' ||
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
      ids.levelId,
      ids.sideId,
      ids.sublevelId,
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

    if (!/^[A-Z]$/.test(parts.street)) {
      errors.street = 'Enter one alphabet letter (A-Z)';
    }

    if (parts.building === '' || Number.isNaN(buildingNumber) || buildingNumber < 0) {
      errors.building = 'Enter a valid building number';
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
    validateLocationParts
  };
})(window);
