const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'http://localhost:3000';
const LOCATIONS_API_URL = API_BASE + '/api/locations';

let allLocations = [];
let previewRows = [];
let sourceConjuntos = [];
let sourceOptionHighlight = -1;

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function getSourceHidden() {
  return document.getElementById('sourceConjunto');
}

function getSourceSearch() {
  return document.getElementById('sourceConjuntoSearch');
}

function getSourceOptionsEl() {
  return document.getElementById('sourceConjuntoOptions');
}

function getClearSourceBtn() {
  return document.getElementById('clearSourceConjuntoBtn');
}

function setSourceSelection(key, { syncInput = true } = {}) {
  const hidden = getSourceHidden();
  const search = getSourceSearch();
  const clearBtn = getClearSourceBtn();
  const value = String(key || '').trim().toUpperCase();
  if (hidden) hidden.value = value;
  if (search && syncInput) {
    search.value = value;
    search.classList.toggle('is-selected', Boolean(value));
  } else if (search) {
    search.classList.toggle('is-selected', Boolean(value) && search.value.trim().toUpperCase() === value);
  }
  if (clearBtn) clearBtn.hidden = !value && !(search && search.value.trim());
}

function clearSourceSelection({ clearInput = true } = {}) {
  const search = getSourceSearch();
  setSourceSelection('', { syncInput: clearInput });
  if (search && clearInput) search.classList.remove('is-selected');
  if (clearInput) hideSourceOptions();
}

function filterSourceConjuntos(term) {
  const query = String(term || '').trim().toUpperCase();
  if (!query) return sourceConjuntos.slice();
  return sourceConjuntos.filter((c) =>
    c.key.includes(query) ||
    c.street.includes(query) ||
    String(c.building).includes(query)
  );
}

function hideSourceOptions() {
  const optionsEl = getSourceOptionsEl();
  const search = getSourceSearch();
  if (optionsEl) {
    optionsEl.hidden = true;
    optionsEl.innerHTML = '';
  }
  if (search) search.setAttribute('aria-expanded', 'false');
  sourceOptionHighlight = -1;
}

function highlightSourceOption(index) {
  const optionsEl = getSourceOptionsEl();
  if (!optionsEl) return;
  const buttons = Array.from(optionsEl.querySelectorAll('.source-set-option'));
  if (!buttons.length) {
    sourceOptionHighlight = -1;
    return;
  }
  sourceOptionHighlight = Math.max(0, Math.min(index, buttons.length - 1));
  buttons.forEach((btn, i) => {
    btn.classList.toggle('is-highlighted', i === sourceOptionHighlight);
  });
  const active = buttons[sourceOptionHighlight];
  if (active && typeof active.scrollIntoView === 'function') {
    active.scrollIntoView({ block: 'nearest' });
  }
}

function renderSourceOptions(term) {
  const optionsEl = getSourceOptionsEl();
  const search = getSourceSearch();
  const hidden = getSourceHidden();
  if (!optionsEl || !search) return;

  const matches = filterSourceConjuntos(term);
  const selected = String(hidden?.value || '').trim().toUpperCase();

  if (!matches.length) {
    optionsEl.innerHTML = `<div class="source-set-empty">No sets found for “${escapeHtml(term || '')}”.</div>`;
    optionsEl.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    sourceOptionHighlight = -1;
    return;
  }

  optionsEl.innerHTML = matches.map((c) => `
    <button
      type="button"
      class="source-set-option${c.key === selected ? ' is-selected' : ''}"
      role="option"
      data-key="${escapeHtml(c.key)}"
      aria-selected="${c.key === selected ? 'true' : 'false'}"
    >
      <span class="source-set-option-code"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(c.key)}</span>
      <span class="source-set-option-meta">${c.count} location${c.count === 1 ? '' : 's'}</span>
    </button>
  `).join('');

  optionsEl.querySelectorAll('.source-set-option').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectSourceConjunto(btn.getAttribute('data-key'));
    });
  });

  optionsEl.hidden = false;
  search.setAttribute('aria-expanded', 'true');
  highlightSourceOption(matches.findIndex((c) => c.key === selected) >= 0
    ? matches.findIndex((c) => c.key === selected)
    : 0);
}

function selectSourceConjunto(key) {
  setSourceSelection(key, { syncInput: true });
  hideSourceOptions();
  const clearBtn = getClearSourceBtn();
  if (clearBtn) clearBtn.hidden = !key;
  document.getElementById('targetConjunto')?.focus();
}

function tryCommitTypedSource() {
  const search = getSourceSearch();
  const typed = String(search?.value || '').trim().toUpperCase();
  if (!typed) {
    clearSourceSelection();
    return false;
  }
  const exact = sourceConjuntos.find((c) => c.key === typed);
  if (exact) {
    selectSourceConjunto(exact.key);
    return true;
  }
  const startsWith = filterSourceConjuntos(typed);
  if (startsWith.length === 1) {
    selectSourceConjunto(startsWith[0].key);
    return true;
  }
  return false;
}

function fillSourceConjuntoOptions() {
  sourceConjuntos = collectConjuntos(allLocations);
  const hidden = getSourceHidden();
  const previous = String(hidden?.value || '').trim().toUpperCase();
  if (previous && !sourceConjuntos.some((c) => c.key === previous)) {
    clearSourceSelection();
  } else if (previous) {
    setSourceSelection(previous, { syncInput: true });
  }
}

function bindSourceSetPicker() {
  const search = getSourceSearch();
  const clearBtn = getClearSourceBtn();
  const picker = document.getElementById('sourceSetPicker');
  if (!search) return;

  search.addEventListener('focus', () => {
    renderSourceOptions(search.value);
  });

  search.addEventListener('input', () => {
    const value = search.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    search.value = value;
    const hidden = getSourceHidden();
    if (hidden && hidden.value && hidden.value !== value) {
      hidden.value = '';
      search.classList.remove('is-selected');
    }
    if (clearBtn) clearBtn.hidden = !value;
    renderSourceOptions(value);
  });

  search.addEventListener('keydown', (event) => {
    const optionsEl = getSourceOptionsEl();
    const open = optionsEl && !optionsEl.hidden;
    const buttons = open ? Array.from(optionsEl.querySelectorAll('.source-set-option')) : [];

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) renderSourceOptions(search.value);
      else highlightSourceOption(sourceOptionHighlight + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) renderSourceOptions(search.value);
      else highlightSourceOption(sourceOptionHighlight - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && buttons[sourceOptionHighlight]) {
        selectSourceConjunto(buttons[sourceOptionHighlight].getAttribute('data-key'));
      } else {
        tryCommitTypedSource();
      }
      return;
    }
    if (event.key === 'Escape') {
      hideSourceOptions();
      return;
    }
  });

  search.addEventListener('blur', () => {
    setTimeout(() => {
      if (!picker?.contains(document.activeElement)) {
        tryCommitTypedSource();
        hideSourceOptions();
      }
    }, 120);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSourceSelection({ clearInput: true });
      search.focus();
      renderSourceOptions('');
    });
  }

  document.addEventListener('click', (event) => {
    if (picker && !picker.contains(event.target)) hideSourceOptions();
  });
}

function parseConjunto(raw) {
  const value = String(raw || '').trim().toUpperCase();
  const match = value.match(/^([A-Z])(\d+)$/);
  if (!match) return null;
  return {
    street: match[1],
    building: String(Number(match[2])),
    key: `${match[1]}${Number(match[2])}`
  };
}

function getConjuntoFromCode(locationCode) {
  const parts = window.LocationCodeUtils.parseLocationCode(locationCode);
  if (!parts.street || parts.building === '') return null;
  const buildingNumber = Number(parts.building);
  if (Number.isNaN(buildingNumber) || buildingNumber < 0) return null;
  return {
    street: parts.street,
    building: String(buildingNumber),
    key: `${parts.street}${buildingNumber}`
  };
}

function formatSideOrSublevel(parts) {
  if (parts.levelZeroMode === 'sublevel' || (parts.level === '0' && parts.sublevel !== '' && !parts.side)) {
    if (parts.sublevel === '') return '-';
    return parts.behind === 'B' ? `Sublevel ${parts.sublevel} B` : `Sublevel ${parts.sublevel}`;
  }
  if (parts.side) {
    const labels = { R: 'R - Right', L: 'L - Left', M: 'M - Middle' };
    return labels[parts.side] || parts.side;
  }
  return '-';
}

function composeForTarget(sourceParts, targetConjunto) {
  const buildingX = window.LocationCodeUtils.isA21Special(targetConjunto.street, targetConjunto.building)
    ? (sourceParts.buildingX || '')
    : '';
  return window.LocationCodeUtils.composeLocationCode({
    street: targetConjunto.street,
    building: targetConjunto.building,
    buildingX,
    level: sourceParts.level,
    side: sourceParts.side,
    sublevel: sourceParts.sublevel,
    behind: sourceParts.behind,
    levelZeroMode: sourceParts.levelZeroMode
  });
}

/** Canonical identity for Street+Building+Level+Side/Sublevel (ignores code format). */
function partsIdentityKey(parts) {
  if (!parts || !parts.street || parts.building === '') return '';
  const building = String(Number(parts.building));
  if (Number.isNaN(Number(building))) return '';
  const buildingX = parts.buildingX ? String(Number(parts.buildingX)) : '';
  const level = parts.level === '' ? '' : String(Number(parts.level));
  if (level === '' || Number.isNaN(Number(level))) return '';

  const mode = parts.levelZeroMode
    || (parts.side ? 'side' : (parts.sublevel !== '' ? 'sublevel' : ''));
  const side = parts.side ? String(parts.side).toUpperCase() : '';
  const sublevel = parts.sublevel !== '' && parts.sublevel != null
    ? String(Number(parts.sublevel))
    : '';
  const behind = String(parts.behind || '').toUpperCase() === 'B' ? 'B' : '';

  return [String(parts.street).toUpperCase(), building, buildingX, level, mode, side, sublevel, behind].join('|');
}

function findExistingEquivalent(newLocation, targetParts) {
  const normalizedNew = String(newLocation || '').trim().toUpperCase();
  if (!normalizedNew) return null;

  const exact = allLocations.find((loc) =>
    String(loc.location || '').trim().toUpperCase() === normalizedNew
  );
  if (exact) {
    return { location: exact.location, kind: 'exact' };
  }

  const targetKey = partsIdentityKey(targetParts);
  if (!targetKey) return null;

  for (const loc of allLocations) {
    const code = String(loc.location || '').trim();
    if (!code) continue;
    if (code.toUpperCase() === normalizedNew) continue;
    const parsed = window.LocationCodeUtils.parseLocationCode(code);
    if (partsIdentityKey(parsed) === targetKey) {
      return { location: loc.location, kind: 'legacy' };
    }
  }
  return null;
}

function collectConjuntos(locations) {
  const map = new Map();
  locations.forEach((loc) => {
    const conjunto = getConjuntoFromCode(loc.location);
    if (!conjunto) return;
    if (!map.has(conjunto.key)) {
      map.set(conjunto.key, { ...conjunto, count: 0 });
    }
    map.get(conjunto.key).count += 1;
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.street !== b.street) return a.street.localeCompare(b.street);
    return Number(a.building) - Number(b.building);
  });
}

function setEmptyTableMessage(messageHtml) {
  const tbody = document.getElementById('smartTableBody');
  const countEl = document.getElementById('smartResultsCount');
  const saveBtn = document.getElementById('saveAllSmartBtn');
  const dupPanel = document.getElementById('smartDuplicatesPanel');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">
          <i class="fas fa-wand-magic-sparkles"></i>
          <p>${messageHtml}</p>
        </td>
      </tr>
    `;
  }
  if (countEl) countEl.textContent = '0 lines';
  if (saveBtn) saveBtn.disabled = true;
  if (dupPanel) {
    dupPanel.hidden = true;
    dupPanel.innerHTML = '';
  }
  previewRows = [];
}

function lineStatusMeta(row) {
  if (row.saveState === 'saved') {
    return { label: 'Saved', className: 'is-saved' };
  }
  if (row.saveState === 'error') {
    return { label: row.errorMessage || 'Error', className: 'is-error' };
  }
  if (row.exists) {
    if (row.existsKind === 'legacy' && row.existsAs) {
      return { label: `Duplicate of ${row.existsAs}`, className: 'is-duplicate' };
    }
    return {
      label: row.existsAs && row.existsAs !== row.newLocation
        ? `Already exists (${row.existsAs})`
        : 'Already exists',
      className: 'is-exists'
    };
  }
  if (!row.newLocation) {
    return { label: 'Invalid code', className: 'is-error' };
  }
  return { label: 'Ready', className: 'is-ready' };
}

function renderDuplicatesPanel() {
  const panel = document.getElementById('smartDuplicatesPanel');
  if (!panel) return;

  const duplicates = previewRows.filter((r) => r.exists && r.existsAs);
  if (!duplicates.length) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }

  const legacyCount = duplicates.filter((r) => r.existsKind === 'legacy').length;
  const exactCount = duplicates.filter((r) => r.existsKind === 'exact').length;

  panel.hidden = false;
  panel.innerHTML = `
    <div class="smart-duplicates-card">
      <h4><i class="fas fa-clone"></i> Duplicates skipped (${duplicates.length})</h4>
      <p class="smart-duplicates-summary">
        Exact match: <strong>${exactCount}</strong>
        · Legacy equivalent: <strong>${legacyCount}</strong>
        — these lines will not be created.
      </p>
      <ul class="smart-duplicates-list">
        ${duplicates.map((r) => `
          <li>
            <code>${escapeHtml(r.newLocation || '-')}</code>
            ≡ existing
            <code>${escapeHtml(r.existsAs)}</code>
            <span class="smart-dup-kind">${r.existsKind === 'legacy' ? 'legacy format' : 'same code'}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderPreviewTable() {
  const tbody = document.getElementById('smartTableBody');
  const countEl = document.getElementById('smartResultsCount');
  const saveBtn = document.getElementById('saveAllSmartBtn');
  if (!tbody) return;

  if (!previewRows.length) {
    setEmptyTableMessage('No lines to show. Generate lines from a source set.');
    return;
  }

  tbody.innerHTML = previewRows.map((row, index) => {
    const statusMeta = lineStatusMeta(row);
    const disabledStatus = row.exists || row.saveState === 'saved' ? ' disabled' : '';
    const existingCell = row.existsAs
      ? `<code>${escapeHtml(row.existsAs)}</code>`
      : '—';
    return `
      <tr data-index="${index}" class="${row.existsKind === 'legacy' ? 'smart-row-duplicate' : ''}">
        <td>${escapeHtml(row.sourceLocation)}</td>
        <td><strong>${escapeHtml(row.newLocation || '-')}</strong></td>
        <td>${existingCell}</td>
        <td>${escapeHtml(row.street)}</td>
        <td>${escapeHtml(row.building)}</td>
        <td>${escapeHtml(row.level)}</td>
        <td>${escapeHtml(row.sideOrSublevel)}</td>
        <td>
          <select class="smart-status-select" data-index="${index}"${disabledStatus}>
            <option value="active"${row.status === 'active' ? ' selected' : ''}>Active</option>
            <option value="inactive"${row.status === 'inactive' ? ' selected' : ''}>Inactive</option>
          </select>
        </td>
        <td>${escapeHtml(row.accessType || '-')}</td>
        <td>${escapeHtml(row.section || '-')}</td>
        <td><span class="smart-row-status ${statusMeta.className}">${escapeHtml(statusMeta.label)}</span></td>
      </tr>
    `;
  }).join('');

  const readyCount = previewRows.filter((r) => !r.exists && r.newLocation && r.saveState !== 'saved').length;
  const dupCount = previewRows.filter((r) => r.exists).length;
  if (countEl) {
    countEl.textContent = `${previewRows.length} line${previewRows.length === 1 ? '' : 's'} · ${readyCount} ready · ${dupCount} duplicate${dupCount === 1 ? '' : 's'}`;
  }
  if (saveBtn) saveBtn.disabled = readyCount === 0;

  renderDuplicatesPanel();

  tbody.querySelectorAll('.smart-status-select').forEach((select) => {
    select.addEventListener('change', () => {
      const idx = Number(select.dataset.index);
      if (!Number.isNaN(idx) && previewRows[idx]) {
        previewRows[idx].status = select.value;
      }
    });
  });
}

function generatePreview() {
  tryCommitTypedSource();
  const sourceKey = String(document.getElementById('sourceConjunto')?.value || '').trim().toUpperCase();
  const targetRaw = String(document.getElementById('targetConjunto')?.value || '').trim().toUpperCase();
  const target = parseConjunto(targetRaw);

  if (!sourceKey) {
    alert('Select a valid source set from the list.');
    getSourceSearch()?.focus();
    renderSourceOptions(getSourceSearch()?.value || '');
    return;
  }
  if (!sourceConjuntos.some((c) => c.key === sourceKey)) {
    alert(`Source set ${sourceKey} was not found.`);
    getSourceSearch()?.focus();
    renderSourceOptions(sourceKey);
    return;
  }
  if (!target) {
    alert('Enter a valid new set (letter + number), e.g. A2.');
    document.getElementById('targetConjunto')?.focus();
    return;
  }
  if (sourceKey === target.key) {
    alert('Source set and new set must be different.');
    return;
  }

  const sourceLocations = allLocations
    .filter((loc) => {
      const conjunto = getConjuntoFromCode(loc.location);
      return conjunto && conjunto.key === sourceKey;
    })
    .sort((a, b) => String(a.location).localeCompare(String(b.location)));

  if (!sourceLocations.length) {
    setEmptyTableMessage(`No locations found for set <strong>${escapeHtml(sourceKey)}</strong>.`);
    return;
  }

  previewRows = sourceLocations.map((loc) => {
    const parts = window.LocationCodeUtils.parseLocationCode(loc.location);
    const newLocation = composeForTarget(parts, target);
    const targetParts = {
      street: target.street,
      building: target.building,
      level: parts.level,
      side: parts.side,
      sublevel: parts.sublevel,
      behind: parts.behind,
      levelZeroMode: parts.levelZeroMode
    };
    const existing = findExistingEquivalent(newLocation, targetParts);
    return {
      sourceLocation: loc.location,
      newLocation,
      street: target.street,
      building: target.building,
      level: parts.level,
      sideOrSublevel: formatSideOrSublevel(parts),
      status: loc.status === 'inactive' ? 'inactive' : 'active',
      accessType: loc.accessType || 'Shelf by Hand',
      section: loc.section || 'OTHER',
      exists: Boolean(existing),
      existsAs: existing ? existing.location : '',
      existsKind: existing ? existing.kind : '',
      saveState: '',
      errorMessage: ''
    };
  });

  renderPreviewTable();
}

function clearPreview() {
  clearSourceSelection({ clearInput: true });
  const target = document.getElementById('targetConjunto');
  if (target) target.value = '';
  setEmptyTableMessage('Select a source set, type the new set, then click <strong>Generate lines</strong>.');
}

function showSmartProcessing(total) {
  const overlay = document.getElementById('smartProcessOverlay');
  const card = document.getElementById('smartProcessCard');
  const icon = document.getElementById('smartProcessIcon');
  const title = document.getElementById('smartProcessTitle');
  const message = document.getElementById('smartProcessMessage');
  const progress = document.getElementById('smartProcessProgress');
  if (!overlay || !card) return;

  document.body.classList.add('smart-processing');
  card.className = 'smart-process-card is-processing';
  if (icon) icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  if (title) title.textContent = 'Processing';
  if (message) message.textContent = 'Please wait. Do not close or use other options while locations are being created.';
  if (progress) progress.textContent = `0 of ${total}`;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
}

function updateSmartProcessingProgress(current, total) {
  const progress = document.getElementById('smartProcessProgress');
  if (progress) progress.textContent = `${current} of ${total}`;
}

function showSmartProcessResult({ success, title, message }) {
  const overlay = document.getElementById('smartProcessOverlay');
  const card = document.getElementById('smartProcessCard');
  const icon = document.getElementById('smartProcessIcon');
  const titleEl = document.getElementById('smartProcessTitle');
  const messageEl = document.getElementById('smartProcessMessage');
  const progress = document.getElementById('smartProcessProgress');
  const okBtn = document.getElementById('smartProcessOkBtn');
  if (!overlay || !card) return;

  card.className = `smart-process-card ${success ? 'is-success' : 'is-error'}`;
  if (icon) {
    icon.innerHTML = success
      ? '<i class="fas fa-check-circle"></i>'
      : '<i class="fas fa-exclamation-circle"></i>';
  }
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (progress) progress.textContent = '';
  if (okBtn) okBtn.focus();
}

function hideSmartProcessOverlay() {
  const overlay = document.getElementById('smartProcessOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('smart-processing');
}

async function saveAllRows() {
  const saveBtn = document.getElementById('saveAllSmartBtn');
  const readyRows = previewRows.filter((r) => !r.exists && r.newLocation && r.saveState !== 'saved');
  if (!readyRows.length) {
    alert('There are no new locations to save.');
    return;
  }

  if (!confirm(`Create ${readyRows.length} location${readyRows.length === 1 ? '' : 's'}?`)) {
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  const generateBtn = document.getElementById('generateSmartBtn');
  const clearBtn = document.getElementById('clearSmartBtn');
  const cancelBtn = document.getElementById('cancelSmartBtn');
  const sourceSearch = getSourceSearch();
  const targetInput = document.getElementById('targetConjunto');
  const controls = [generateBtn, clearBtn, cancelBtn, sourceSearch, targetInput, saveBtn];
  controls.forEach((el) => {
    if (el) el.disabled = true;
  });

  showSmartProcessing(readyRows.length);

  let created = 0;
  let failed = 0;
  let processed = 0;

  for (const row of readyRows) {
    const parsedNew = window.LocationCodeUtils.parseLocationCode(row.newLocation);
    const existingNow = findExistingEquivalent(row.newLocation, {
      street: row.street,
      building: row.building,
      level: parsedNew.level,
      side: parsedNew.side,
      sublevel: parsedNew.sublevel,
      behind: parsedNew.behind,
      levelZeroMode: parsedNew.levelZeroMode
    });
    if (existingNow) {
      row.exists = true;
      row.existsAs = existingNow.location;
      row.existsKind = existingNow.kind;
      processed += 1;
      updateSmartProcessingProgress(processed, readyRows.length);
      continue;
    }

    try {
      const res = await fetch(LOCATIONS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          location: row.newLocation,
          status: row.status,
          accessType: row.accessType,
          section: row.section
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = data.message || data.error || `HTTP ${res.status}`;
        if (/already registered/i.test(String(message))) {
          row.exists = true;
          row.existsAs = row.newLocation;
          row.existsKind = 'exact';
          row.saveState = '';
          row.errorMessage = '';
        } else {
          row.saveState = 'error';
          row.errorMessage = message;
          failed += 1;
        }
      } else {
        row.saveState = 'saved';
        row.exists = true;
        created += 1;
        if (data.data) {
          allLocations.push(data.data);
        } else {
          allLocations.push({
            location: row.newLocation,
            status: row.status,
            accessType: row.accessType,
            section: row.section
          });
        }
      }
    } catch (err) {
      row.saveState = 'error';
      row.errorMessage = err.message || 'Network error';
      failed += 1;
    }

    processed += 1;
    updateSmartProcessingProgress(processed, readyRows.length);
  }

  fillSourceConjuntoOptions();
  renderPreviewTable();

  controls.forEach((el) => {
    if (!el || el === saveBtn) return;
    el.disabled = false;
  });

  if (failed === 0) {
    showSmartProcessResult({
      success: true,
      title: 'Processed with success',
      message: created === 1
        ? '1 location was created successfully.'
        : `${created} locations were created successfully.`
    });
  } else {
    showSmartProcessResult({
      success: false,
      title: 'Processed with errors',
      message: `Saved ${created}. Failed: ${failed}. Check line status in the table.`
    });
  }
}

async function loadLocations() {
  try {
    const res = await fetch(LOCATIONS_API_URL, { credentials: 'same-origin' });
    const data = await res.json();
    allLocations = (data.success && Array.isArray(data.data)) ? data.data : [];
  } catch (err) {
    console.error('Error loading locations:', err);
    allLocations = [];
    alert('Could not load locations. Check if the server is running.');
  }
  fillSourceConjuntoOptions();
}

document.addEventListener('DOMContentLoaded', () => {
  function revealPanel() {
    const target = document.getElementById('locationSmartPanel');
    if (!target) return;
    const offset = 8;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  requestAnimationFrame(() => {
    revealPanel();
    setTimeout(revealPanel, 50);
  });
  window.addEventListener('load', revealPanel);

  const targetInput = document.getElementById('targetConjunto');
  if (targetInput) {
    targetInput.addEventListener('input', () => {
      targetInput.value = targetInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    });
  }

  bindSourceSetPicker();

  document.getElementById('smartProcessOkBtn')?.addEventListener('click', hideSmartProcessOverlay);
  document.getElementById('smartProcessOverlay')?.addEventListener('click', (event) => {
    const card = document.getElementById('smartProcessCard');
    if (!card || card.classList.contains('is-processing')) return;
    if (event.target === event.currentTarget) hideSmartProcessOverlay();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const card = document.getElementById('smartProcessCard');
    const overlay = document.getElementById('smartProcessOverlay');
    if (!overlay || !overlay.classList.contains('is-open') || !card) return;
    if (card.classList.contains('is-processing')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    hideSmartProcessOverlay();
  }, true);

  document.getElementById('generateSmartBtn')?.addEventListener('click', generatePreview);
  document.getElementById('clearSmartBtn')?.addEventListener('click', clearPreview);
  document.getElementById('saveAllSmartBtn')?.addEventListener('click', saveAllRows);
  document.getElementById('cancelSmartBtn')?.addEventListener('click', () => {
    window.location.href = 'warehouse.html';
  });

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openLocationHelp();
      return;
    }
    if (e.key === 'Escape' && locationHelpModal?.classList.contains('is-open')) {
      closeLocationHelp();
    }
  });

  loadLocations();
});
