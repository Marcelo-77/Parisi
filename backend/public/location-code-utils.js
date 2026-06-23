(function (global) {
  const DEFAULT_LEVEL_ZERO_ACCESS_TYPE = 'Shelf by Hand';

  function normalizeNumberValue(raw) {
    if (raw === '' || raw == null) return '';
    const value = Number(raw);
    return Number.isNaN(value) ? '' : String(value);
  }

  function composeLocationCode({ street, building, level, side, sublevel }, options = {}) {
    const useDashes = Boolean(options.useDashes);
    if (!street || building === '') {
      return '';
    }

    const levelNumber = level === '' ? NaN : Number(level);
    if (Number.isNaN(levelNumber) || levelNumber < 0) {
      return '';
    }

    if (levelNumber === 0) {
      if (sublevel === '') {
        return '';
      }
      const sublevelNumber = Number(sublevel);
      if (Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
        return '';
      }
      if (useDashes) {
        return `${street}${building}-0-${normalizeNumberValue(sublevel)}`;
      }
      return `${street}${building}0${normalizeNumberValue(sublevel)}`;
    }

    if (level === '' || !side) {
      return '';
    }

    if (useDashes) {
      return `${street}${building}-${levelNumber}-${side}`;
    }
    return `${street}${building}${levelNumber}${side}`;
  }

  function parseLocationCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || !/^[A-Z]/.test(normalized)) {
      return { street: '', building: '', level: '', side: '', sublevel: '' };
    }

    const street = normalized[0];
    const rest = normalized.slice(1);

    if (!rest) {
      return { street, building: '', level: '', side: '', sublevel: '' };
    }

    const dashedLevelSideMatch = rest.match(/^(\d+)-(\d+)-([RLM])$/);
    if (dashedLevelSideMatch) {
      return {
        street,
        building: dashedLevelSideMatch[1],
        level: dashedLevelSideMatch[2],
        side: dashedLevelSideMatch[3],
        sublevel: ''
      };
    }

    const dashedSublevelMatch = rest.match(/^(\d+)-0-(\d+)$/);
    if (dashedSublevelMatch) {
      return {
        street,
        building: dashedSublevelMatch[1] === '' ? '0' : dashedSublevelMatch[1],
        level: '0',
        side: '',
        sublevel: normalizeNumberValue(dashedSublevelMatch[2])
      };
    }

    const dashedSideMatch = rest.match(/^(.+)-([RLM])$/);
    if (dashedSideMatch) {
      const body = dashedSideMatch[1];
      const side = dashedSideMatch[2];
      const level = body.slice(-1);
      const building = body.slice(0, -1);

      return {
        street,
        building: building === '' ? '0' : building,
        level,
        side,
        sublevel: ''
      };
    }

    const legacySideMatch = rest.match(/^(.+)([RLM])$/);
    if (legacySideMatch) {
      const body = legacySideMatch[1];
      const side = legacySideMatch[2];
      const level = body.slice(-1);
      const building = body.slice(0, -1);
      const levelNumber = Number(level);

      if (!Number.isNaN(levelNumber) && levelNumber > 0) {
        return {
          street,
          building: building === '' ? '0' : building,
          level,
          side,
          sublevel: ''
        };
      }
    }

    const sublevelMatch = rest.match(/^(.+)0(\d+)$/);
    if (sublevelMatch) {
      return {
        street,
        building: sublevelMatch[1] === '' ? '0' : sublevelMatch[1],
        level: '0',
        side: '',
        sublevel: normalizeNumberValue(sublevelMatch[2])
      };
    }

    return { street, building: '', level: '', side: '', sublevel: '' };
  }

  function buildPartialSearchTerm({ street, building, level, side, sublevel }, options = {}) {
    const useDashes = Boolean(options.useDashes);
    let term = street || '';
    if (building !== '') {
      term += building;
      if (useDashes) term += '-';
    }

    if (level === '') {
      return term;
    }

    const levelNumber = Number(level);
    if (Number.isNaN(levelNumber)) {
      return term;
    }

    if (levelNumber === 0) {
      if (useDashes) {
        term += '0-';
        if (sublevel !== '') {
          term += normalizeNumberValue(sublevel);
        }
        return term;
      }
      term += '0';
      if (sublevel !== '') {
        term += normalizeNumberValue(sublevel);
      }
      return term;
    }

    term += String(levelNumber);
    if (useDashes) term += '-';
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

    const street = streetEl ? streetEl.value.trim().toUpperCase() : '';
    const building = buildingEl ? normalizeNumberValue(buildingEl.value.trim()) : '';
    const level = levelEl ? normalizeNumberValue(levelEl.value.trim()) : '';
    const side = sideEl ? sideEl.value.trim().toUpperCase() : '';
    const sublevel = sublevelEl ? normalizeNumberValue(sublevelEl.value.trim()) : '';

    return { street, building, level, side, sublevel };
  }

  function setLocationParts(ids, parts) {
    const streetEl = document.getElementById(ids.streetId);
    const buildingEl = document.getElementById(ids.buildingId);
    const levelEl = document.getElementById(ids.levelId);
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;

    if (streetEl) streetEl.value = parts.street || '';
    if (buildingEl) buildingEl.value = parts.building !== '' ? parts.building : '';
    if (levelEl) levelEl.value = parts.level !== '' ? parts.level : '';
    if (sideEl) sideEl.value = parts.side || '';
    if (sublevelEl) sublevelEl.value = parts.sublevel !== '' ? parts.sublevel : '';
  }

  function updateLevelDependentFields(ids) {
    const levelEl = document.getElementById(ids.levelId);
    const sideGroupEl = ids.sideGroupId ? document.getElementById(ids.sideGroupId) : null;
    const sublevelGroupEl = ids.sublevelGroupId ? document.getElementById(ids.sublevelGroupId) : null;
    const sideEl = document.getElementById(ids.sideId);
    const sublevelEl = ids.sublevelId ? document.getElementById(ids.sublevelId) : null;
    const levelRaw = levelEl ? levelEl.value.trim() : '';
    const levelNumber = levelRaw === '' ? null : Number(levelRaw);
    const isGroundLevel = levelNumber === 0;
    const hasUpperLevel = levelNumber != null && levelNumber > 0;

    if (sideGroupEl) {
      sideGroupEl.style.display = hasUpperLevel ? '' : 'none';
    }
    if (sublevelGroupEl) {
      sublevelGroupEl.style.display = isGroundLevel ? '' : 'none';
    }

    if (sideEl) {
      sideEl.required = hasUpperLevel;
      if (!hasUpperLevel) {
        sideEl.value = '';
      }
    }

    if (sublevelEl) {
      sublevelEl.required = isGroundLevel;
      if (!isGroundLevel) {
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
      parts.sublevel !== ''
    );

    if (options.allowDirectCodeEntry && !hasComponentInput) {
      return codeEl.value.trim();
    }

    const composed = options.allowPartial
      ? (composeLocationCode(parts, options) || buildPartialSearchTerm(parts, options))
      : composeLocationCode(parts, options);

    codeEl.value = composed;
    return composed;
  }

  function setupLocationComposition(ids, options = {}) {
    const fieldIds = [
      ids.streetId,
      ids.buildingId,
      ids.levelId,
      ids.sideId,
      ids.sublevelId
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
      if (parts.sublevel === '' || Number.isNaN(sublevelNumber) || sublevelNumber < 0) {
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
