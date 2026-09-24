(function () {
  const API = '/api/location-code-settings';
  let saved = null;
  let dirty = false;

  const els = {
    status: document.getElementById('locationSettingsStatus'),
    dirtyBadge: document.getElementById('locationDirtyBadge'),
    activeScheme: document.getElementById('activeScheme'),
    levelOnlyUsesLPrefix: document.getElementById('levelOnlyUsesLPrefix'),
    withPositionOmitsL: document.getElementById('withPositionOmitsL'),
    separator: document.getElementById('separator'),
    allowLevelOnly: document.getElementById('allowLevelOnly'),
    allowPosition: document.getElementById('allowPosition'),
    bayPatternHint: document.getElementById('bayPatternHint'),
    minLevel: document.getElementById('minLevel'),
    maxLevel: document.getElementById('maxLevel'),
    minPosition: document.getElementById('minPosition'),
    maxPosition: document.getElementById('maxPosition'),
    previewA1L2: document.getElementById('previewA1L2'),
    previewA221: document.getElementById('previewA221'),
    previewA202: document.getElementById('previewA202'),
    tryBay: document.getElementById('tryBay'),
    tryLevel: document.getElementById('tryLevel'),
    tryPosition: document.getElementById('tryPosition'),
    tryResult: document.getElementById('tryResult')
  };

  function showStatus(message, type) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.remove('is-success', 'is-error');
    if (type === 'success') els.status.classList.add('is-success');
    if (type === 'error') els.status.classList.add('is-error');
  }

  function boolSelect(el, value) {
    if (el) el.value = value ? 'true' : 'false';
  }

  function readBool(el, fallback) {
    if (!el) return fallback;
    return String(el.value) === 'true';
  }

  function readInt(el, fallback) {
    const n = Number(el?.value);
    return Number.isInteger(n) ? n : fallback;
  }

  function getFormSettings() {
    return {
      activeScheme: String(els.activeScheme?.value || 'classic'),
      levelOnlyUsesLPrefix: readBool(els.levelOnlyUsesLPrefix, true),
      withPositionOmitsL: readBool(els.withPositionOmitsL, true),
      separator: String(els.separator?.value || '-').trim() || '-',
      allowLevelOnly: readBool(els.allowLevelOnly, true),
      allowPosition: readBool(els.allowPosition, true),
      bayPatternHint: String(els.bayPatternHint?.value || '').trim() || 'A1, A2, B1...',
      minLevel: readInt(els.minLevel, 0),
      maxLevel: readInt(els.maxLevel, 99),
      minPosition: readInt(els.minPosition, 1),
      maxPosition: readInt(els.maxPosition, 99)
    };
  }

  function composeBayLevelPositionCode(parts, settings) {
    const bay = String(parts.bay || '').trim().toUpperCase();
    const sep = String(settings.separator || '-');
    if (!bay || !/^[A-Z0-9]{1,10}$/.test(bay)) return '';
    const level = Number(parts.level);
    if (!Number.isInteger(level) || level < settings.minLevel || level > settings.maxLevel) return '';
    const hasPosition = parts.position !== '' && parts.position != null;
    if (!hasPosition) {
      if (!settings.allowLevelOnly) return '';
      const levelToken = settings.levelOnlyUsesLPrefix ? `L${level}` : String(level);
      return `${bay}${sep}${levelToken}`;
    }
    if (!settings.allowPosition) return '';
    const position = Number(parts.position);
    if (!Number.isInteger(position) || position < settings.minPosition || position > settings.maxPosition) return '';
    const levelToken = settings.withPositionOmitsL ? String(level) : `L${level}`;
    return `${bay}${sep}${levelToken}${sep}${position}`;
  }

  function applyData(data) {
    saved = { ...data };
    if (els.activeScheme) els.activeScheme.value = data.activeScheme || 'classic';
    boolSelect(els.levelOnlyUsesLPrefix, data.levelOnlyUsesLPrefix !== false);
    boolSelect(els.withPositionOmitsL, data.withPositionOmitsL !== false);
    if (els.separator) els.separator.value = data.separator || '-';
    boolSelect(els.allowLevelOnly, data.allowLevelOnly !== false);
    boolSelect(els.allowPosition, data.allowPosition !== false);
    if (els.bayPatternHint) els.bayPatternHint.value = data.bayPatternHint || 'A1, A2, B1...';
    if (els.minLevel) els.minLevel.value = data.minLevel ?? 0;
    if (els.maxLevel) els.maxLevel.value = data.maxLevel ?? 99;
    if (els.minPosition) els.minPosition.value = data.minPosition ?? 1;
    if (els.maxPosition) els.maxPosition.value = data.maxPosition ?? 99;
    dirty = false;
    updateDirty();
    refreshPreviews();
  }

  function updateDirty() {
    dirty = !!saved && JSON.stringify(getFormSettings()) !== JSON.stringify(saved);
    if (els.dirtyBadge) els.dirtyBadge.hidden = !dirty;
  }

  function refreshPreviews() {
    const settings = getFormSettings();
    if (els.previewA1L2) els.previewA1L2.textContent = composeBayLevelPositionCode({ bay: 'A1', level: 2 }, settings) || '—';
    if (els.previewA221) els.previewA221.textContent = composeBayLevelPositionCode({ bay: 'A2', level: 2, position: 1 }, settings) || '—';
    if (els.previewA202) els.previewA202.textContent = composeBayLevelPositionCode({ bay: 'A2', level: 0, position: 2 }, settings) || '—';
    if (els.tryResult) {
      const positionRaw = String(els.tryPosition?.value ?? '').trim();
      els.tryResult.textContent = composeBayLevelPositionCode({
        bay: els.tryBay?.value,
        level: els.tryLevel?.value,
        position: positionRaw === '' ? '' : positionRaw
      }, settings) || '—';
    }
  }

  async function loadSettings() {
    showStatus('Loading…');
    try {
      const res = await fetch(API, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load location settings');
      applyData(data.data);
      showStatus('');
    } catch (error) {
      showStatus(error.message || 'Error loading settings.', 'error');
    }
  }

  async function saveSettings() {
    const btn = document.getElementById('saveLocationSettingsBtn');
    if (btn) btn.disabled = true;
    showStatus('Saving…');
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(getFormSettings())
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to save location settings');
      applyData(data.data);
      showStatus(data.message || 'Location settings saved.', 'success');
    } catch (error) {
      showStatus(error.message || 'Error saving settings.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindDirtyWatchers() {
    [
      els.activeScheme, els.levelOnlyUsesLPrefix, els.withPositionOmitsL, els.separator,
      els.allowLevelOnly, els.allowPosition, els.bayPatternHint,
      els.minLevel, els.maxLevel, els.minPosition, els.maxPosition
    ].forEach((el) => {
      el?.addEventListener('change', () => { updateDirty(); refreshPreviews(); });
      el?.addEventListener('input', () => { updateDirty(); refreshPreviews(); });
    });
    [els.tryBay, els.tryLevel, els.tryPosition].forEach((el) => {
      el?.addEventListener('input', refreshPreviews);
      el?.addEventListener('change', refreshPreviews);
    });
  }

  document.getElementById('saveLocationSettingsBtn')?.addEventListener('click', saveSettings);
  document.getElementById('cancelLocationSettingsBtn')?.addEventListener('click', () => {
    if (saved) applyData(saved);
    showStatus('Changes discarded.', 'success');
  });
  document.getElementById('closeLocationSettingsBtn')?.addEventListener('click', () => {
    window.location.href = 'warehouse.html';
  });

  bindDirtyWatchers();
  loadSettings();
})();
