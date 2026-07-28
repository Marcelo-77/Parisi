const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'http://localhost:3000';
const SELECTED_MOVE_API = API_BASE + '/api/location-product/move-selected-products';

let selectedMovePreview = null;
let sourceBalancesCache = [];

function esc(value) {
  if (value == null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function normalizeLocation(value) {
  return String(value || '').trim().toUpperCase();
}

function balanceKey(productCode, siprSqNumber) {
  return `${String(productCode || '').trim().toUpperCase()}|${Number.parseInt(siprSqNumber, 10)}`;
}

function clearPreviewTables(message) {
  const previewBody = document.getElementById('movePreviewBody');
  const beforeSourceBody = document.getElementById('beforeSourceBody');
  const beforeDestBody = document.getElementById('beforeDestBody');
  const afterDestBody = document.getElementById('afterDestBody');
  const summary = document.getElementById('moveSummary');
  const confirmBtn = document.getElementById('confirmMoveBtn');

  if (previewBody) {
    previewBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fas fa-exchange-alt"></i>
          <p>${message || 'Load source products, select one or more rows and click Preview.'}</p>
        </td>
      </tr>
    `;
  }
  [beforeSourceBody, beforeDestBody, afterDestBody].forEach((tbody) => {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No preview yet.</p></td></tr>';
  });
  if (summary) {
    summary.hidden = true;
    summary.textContent = '';
  }
  if (confirmBtn) confirmBtn.disabled = true;
  selectedMovePreview = null;
}

function renderSourceBalances(rows) {
  const tbody = document.getElementById('sourceProductsBody');
  const countEl = document.getElementById('sourceProductsCount');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <p>No active balances found in source location.</p>
        </td>
      </tr>
    `;
    if (countEl) countEl.textContent = '0 selected / 0 available';
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const key = balanceKey(row.productCode, row.siprSqNumber);
    return `
      <tr>
        <td><input type="checkbox" class="source-product-check" value="${esc(key)}"></td>
        <td>${esc(row.productCode)}</td>
        <td>${esc(row.situationDescription || row.siprSqNumber)}</td>
        <td>${esc(row.quantityCurrent ?? 0)}</td>
        <td>${esc(row.quantityInformed ?? 0)}</td>
        <td>${esc(row.locationCode || '')}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.source-product-check').forEach((checkbox) => {
    checkbox.addEventListener('change', updateSelectedCount);
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const countEl = document.getElementById('sourceProductsCount');
  const checks = Array.from(document.querySelectorAll('.source-product-check'));
  const selected = checks.filter((item) => item.checked).length;
  if (countEl) countEl.textContent = `${selected} selected / ${checks.length} available`;
}

function getSelectedBalances() {
  const selectedKeys = new Set(
    Array.from(document.querySelectorAll('.source-product-check:checked')).map((item) => item.value)
  );
  return sourceBalancesCache
    .filter((row) => selectedKeys.has(balanceKey(row.productCode, row.siprSqNumber)))
    .map((row) => ({ productCode: row.productCode, siprSqNumber: row.siprSqNumber }));
}

function renderBalanceRows(tbodyId, rows, emptyMessage) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rows || !rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><p>${emptyMessage}</p></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${esc(row.locationCode || '')}</td>
      <td>${esc(row.productCode || '')}</td>
      <td>${esc(row.situationDescription || row.siprSqNumber || '')}</td>
      <td>${esc(row.quantityCurrent ?? 0)}</td>
      <td>${esc(row.quantityInformed ?? 0)}</td>
    </tr>
  `).join('');
}

function renderSelectedPreview(preview) {
  selectedMovePreview = preview;
  const tbody = document.getElementById('movePreviewBody');
  const summary = document.getElementById('moveSummary');
  const confirmBtn = document.getElementById('confirmMoveBtn');

  if (!preview.moves || !preview.moves.length) {
    clearPreviewTables('No selected balances to move.');
    return;
  }

  if (tbody) {
    tbody.innerHTML = preview.moves.map((move) => {
      const actionClass = move.action === 'merge' ? 'action-merge' : 'action-insert';
      const actionText = move.action === 'merge' ? 'MERGE + DELETE' : 'INSERT + DELETE';
      return `
        <tr>
          <td>${esc(move.productCode)}</td>
          <td>${esc(move.situationDescription || move.siprSqNumber)}</td>
          <td>${esc(move.quantityCurrent)}</td>
          <td>${esc(move.sourceQuantityBefore)}</td>
          <td>${esc(move.sourceQuantityAfter)}</td>
          <td>${esc(move.destinationQuantityBefore)}</td>
          <td>${esc(move.destinationQuantityAfter)}</td>
          <td class="${actionClass}">${esc(actionText)}</td>
        </tr>
      `;
    }).join('');
  }

  renderBalanceRows('beforeSourceBody', preview.before?.source || [], 'No selected source balances.');
  renderBalanceRows('beforeDestBody', preview.before?.destination || [], 'Destination location is empty.');
  renderBalanceRows('afterDestBody', preview.after?.destination || [], 'No destination balances after move.');

  if (summary) {
    summary.hidden = false;
    summary.textContent =
      `Source ${preview.sourceLocationCode} → Destination ${preview.destinationLocationCode}: `
      + `${preview.moveCount} selected balance(s) will be moved.`;
  }
  if (confirmBtn) confirmBtn.disabled = false;
}

async function loadSourceProducts() {
  const sourceInput = document.getElementById('sourceLocationCode');
  const sourceLocationCode = normalizeLocation(sourceInput?.value);
  if (sourceInput) sourceInput.value = sourceLocationCode;
  if (!sourceLocationCode) {
    alert('Source location code is required.');
    return;
  }

  try {
    const res = await fetch(SELECTED_MOVE_API + '/source-balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sourceLocationCode })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.message || data.error)) || 'Failed to load source products');
    }
    sourceBalancesCache = data.data.balances || [];
    if (sourceInput) sourceInput.value = data.data.sourceLocationCode || sourceLocationCode;
    renderSourceBalances(sourceBalancesCache);
    clearPreviewTables();
  } catch (error) {
    sourceBalancesCache = [];
    renderSourceBalances([]);
    clearPreviewTables('Unable to load source balances.');
    alert(error.message || 'Failed to load source products');
  }
}

async function runSelectedPreview() {
  const sourceInput = document.getElementById('sourceLocationCode');
  const destInput = document.getElementById('destinationLocationCode');
  const sourceLocationCode = normalizeLocation(sourceInput?.value);
  const destinationLocationCode = normalizeLocation(destInput?.value);
  if (sourceInput) sourceInput.value = sourceLocationCode;
  if (destInput) destInput.value = destinationLocationCode;

  if (!sourceLocationCode || !destinationLocationCode) {
    alert('Source and destination location codes are required.');
    return;
  }
  if (sourceLocationCode === destinationLocationCode) {
    alert('Source and destination locations must be different.');
    return;
  }

  const selectedBalances = getSelectedBalances();
  if (!selectedBalances.length) {
    alert('Select at least one product from source.');
    return;
  }

  try {
    const res = await fetch(SELECTED_MOVE_API + '/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sourceLocationCode, destinationLocationCode, selectedBalances })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.message || data.error)) || 'Preview failed');
    }
    renderSelectedPreview(data.data);
  } catch (error) {
    clearPreviewTables('Preview failed. Check the selected products and locations.');
    alert(error.message || 'Preview failed');
  }
}

async function confirmSelectedMove() {
  if (!selectedMovePreview || !selectedMovePreview.moveCount) {
    alert('Run Preview first.');
    return;
  }
  const selectedBalances = getSelectedBalances();
  if (!selectedBalances.length) {
    alert('Select at least one product from source.');
    return;
  }

  const ok = window.confirm(
    `Move ${selectedMovePreview.moveCount} selected balance(s) from `
    + `${selectedMovePreview.sourceLocationCode} to ${selectedMovePreview.destinationLocationCode}?`
  );
  if (!ok) return;

  const confirmBtn = document.getElementById('confirmMoveBtn');
  if (confirmBtn) confirmBtn.disabled = true;
  try {
    const res = await fetch(SELECTED_MOVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sourceLocationCode: selectedMovePreview.sourceLocationCode,
        destinationLocationCode: selectedMovePreview.destinationLocationCode,
        selectedBalances
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.message || data.error)) || 'Move failed');
    }
    alert(data.message || 'Selected move completed.');
    await loadSourceProducts();
    clearPreviewTables('Move completed. Select products and click Preview for a new move.');
  } catch (error) {
    if (confirmBtn) confirmBtn.disabled = false;
    alert(error.message || 'Move failed');
  }
}

function selectAllSourceProducts(checked) {
  document.querySelectorAll('.source-product-check').forEach((checkbox) => {
    checkbox.checked = checked;
  });
  updateSelectedCount();
}

function initSelectedMovePage() {
  const sourceInput = document.getElementById('sourceLocationCode');
  const destInput = document.getElementById('destinationLocationCode');
  const loadBtn = document.getElementById('loadSourceProductsBtn');
  const previewBtn = document.getElementById('previewMoveBtn');
  const clearBtn = document.getElementById('clearMoveBtn');
  const cancelBtn = document.getElementById('cancelMoveBtn');
  const confirmBtn = document.getElementById('confirmMoveBtn');
  const selectAllBtn = document.getElementById('selectAllProductsBtn');
  const unselectAllBtn = document.getElementById('unselectAllProductsBtn');

  if (loadBtn) loadBtn.addEventListener('click', loadSourceProducts);
  if (previewBtn) previewBtn.addEventListener('click', runSelectedPreview);
  if (confirmBtn) confirmBtn.addEventListener('click', confirmSelectedMove);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (selectAllBtn) selectAllBtn.addEventListener('click', () => selectAllSourceProducts(true));
  if (unselectAllBtn) unselectAllBtn.addEventListener('click', () => selectAllSourceProducts(false));
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (sourceInput) sourceInput.value = '';
      if (destInput) destInput.value = '';
      sourceBalancesCache = [];
      renderSourceBalances([]);
      clearPreviewTables();
      sourceInput?.focus();
    });
  }

  [sourceInput, destInput].forEach((input) => {
    input?.addEventListener('input', () => {
      selectedMovePreview = null;
      const btn = document.getElementById('confirmMoveBtn');
      if (btn) btn.disabled = true;
    });
  });

  renderSourceBalances([]);
  clearPreviewTables();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSelectedMovePage);
} else {
  initSelectedMovePage();
}
