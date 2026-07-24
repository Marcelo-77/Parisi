const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'http://localhost:3000';
const LOCATIONS_API_URL = API_BASE + '/api/locations';

let allLocations = [];
let previewRows = [];

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
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
    return parts.sublevel !== '' ? `Sublevel ${parts.sublevel}` : '-';
  }
  if (parts.side) {
    const labels = { R: 'R - Right', L: 'L - Left', M: 'M - Middle' };
    return labels[parts.side] || parts.side;
  }
  return '-';
}

function composeForTarget(sourceParts, targetConjunto) {
  return window.LocationCodeUtils.composeLocationCode({
    street: targetConjunto.street,
    building: targetConjunto.building,
    level: sourceParts.level,
    side: sourceParts.side,
    sublevel: sourceParts.sublevel,
    levelZeroMode: sourceParts.levelZeroMode
  });
}

/** Canonical identity for Street+Building+Level+Side/Sublevel (ignores code format). */
function partsIdentityKey(parts) {
  if (!parts || !parts.street || parts.building === '') return '';
  const building = String(Number(parts.building));
  if (Number.isNaN(Number(building))) return '';
  const level = parts.level === '' ? '' : String(Number(parts.level));
  if (level === '' || Number.isNaN(Number(level))) return '';

  const mode = parts.levelZeroMode
    || (parts.side ? 'side' : (parts.sublevel !== '' ? 'sublevel' : ''));
  const side = parts.side ? String(parts.side).toUpperCase() : '';
  const sublevel = parts.sublevel !== '' && parts.sublevel != null
    ? String(Number(parts.sublevel))
    : '';

  return [String(parts.street).toUpperCase(), building, level, mode, side, sublevel].join('|');
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

function fillSourceConjuntoOptions() {
  const select = document.getElementById('sourceConjunto');
  if (!select) return;
  const conjuntos = collectConjuntos(allLocations);
  const previous = select.value;
  select.innerHTML = '<option value="">Select set…</option>' + conjuntos.map((c) => (
    `<option value="${escapeHtml(c.key)}">${escapeHtml(c.key)} (${c.count} location${c.count === 1 ? '' : 's'})</option>`
  )).join('');
  if (previous && conjuntos.some((c) => c.key === previous)) {
    select.value = previous;
  }
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
  const sourceKey = String(document.getElementById('sourceConjunto')?.value || '').trim().toUpperCase();
  const targetRaw = String(document.getElementById('targetConjunto')?.value || '').trim().toUpperCase();
  const target = parseConjunto(targetRaw);

  if (!sourceKey) {
    alert('Select a source set.');
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
  const source = document.getElementById('sourceConjunto');
  const target = document.getElementById('targetConjunto');
  if (source) source.value = '';
  if (target) target.value = '';
  setEmptyTableMessage('Select a source set, type the new set, then click <strong>Generate lines</strong>.');
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
  let created = 0;
  let failed = 0;

  for (const row of readyRows) {
    const parsedNew = window.LocationCodeUtils.parseLocationCode(row.newLocation);
    const existingNow = findExistingEquivalent(row.newLocation, {
      street: row.street,
      building: row.building,
      level: parsedNew.level,
      side: parsedNew.side,
      sublevel: parsedNew.sublevel,
      levelZeroMode: parsedNew.levelZeroMode
    });
    if (existingNow) {
      row.exists = true;
      row.existsAs = existingNow.location;
      row.existsKind = existingNow.kind;
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
  }

  fillSourceConjuntoOptions();
  renderPreviewTable();

  if (failed === 0) {
    alert(`Saved ${created} location${created === 1 ? '' : 's'} successfully.`);
  } else {
    alert(`Saved ${created}. Failed: ${failed}. Check line status in the table.`);
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
