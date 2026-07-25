const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'http://localhost:3000';
const MOVE_API = API_BASE + '/api/location-product/move-between-locations';

let currentPreview = null;

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function normalizeLocationInput(value) {
  return String(value || '').trim().toUpperCase();
}

function setEmptyBalanceRows(tbodyId, message) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-state">
        <p>${message}</p>
      </td>
    </tr>
  `;
}

function setEmptyPreviewRows(message) {
  const tbody = document.getElementById('movePreviewBody');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="empty-state">
        <i class="fas fa-exchange-alt"></i>
        <p>${message}</p>
      </td>
    </tr>
  `;
}

function renderBalanceRows(tbodyId, rows, emptyMessage) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rows || !rows.length) {
    setEmptyBalanceRows(tbodyId, emptyMessage);
    return;
  }
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.locationCode || '')}</td>
      <td>${escapeHtml(row.productCode || '')}</td>
      <td>${escapeHtml(row.situationDescription || row.siprSqNumber || '')}</td>
      <td>${escapeHtml(row.quantityCurrent ?? 0)}</td>
      <td>${escapeHtml(row.quantityInformed ?? 0)}</td>
    </tr>
  `).join('');
}

function renderMovePreview(preview) {
  currentPreview = preview;
  const confirmBtn = document.getElementById('confirmMoveBtn');
  const summary = document.getElementById('moveSummary');

  if (!preview || !preview.moves || !preview.moves.length) {
    setEmptyPreviewRows('No product balances to move from the source location.');
    renderBalanceRows('beforeSourceBody', preview?.before?.source || [], 'Source location is empty.');
    renderBalanceRows('beforeDestBody', preview?.before?.destination || [], 'Destination location is empty.');
    renderBalanceRows('afterDestBody', preview?.after?.destination || [], 'No destination balances after move.');
    if (confirmBtn) confirmBtn.disabled = true;
    if (summary) {
      summary.hidden = false;
      summary.textContent = preview
        ? `Source ${preview.sourceLocationCode} → Destination ${preview.destinationLocationCode}: 0 balances to move.`
        : '';
    }
    return;
  }

  const tbody = document.getElementById('movePreviewBody');
  if (tbody) {
    tbody.innerHTML = preview.moves.map((move) => {
      const actionClass = move.action === 'merge' ? 'action-merge' : 'action-insert';
      const actionText = move.action === 'merge' ? 'MERGE + DELETE' : 'INSERT + DELETE';
      return `
        <tr>
          <td>${escapeHtml(move.productCode)}</td>
          <td>${escapeHtml(move.situationDescription || move.siprSqNumber)}</td>
          <td>${escapeHtml(move.quantityCurrent)}</td>
          <td>${escapeHtml(move.sourceQuantityBefore)}</td>
          <td>${escapeHtml(move.sourceQuantityAfter)}</td>
          <td>${escapeHtml(move.destinationQuantityBefore)}</td>
          <td>${escapeHtml(move.destinationQuantityAfter)}</td>
          <td class="${actionClass}">${escapeHtml(actionText)}</td>
        </tr>
      `;
    }).join('');
  }

  renderBalanceRows('beforeSourceBody', preview.before.source, 'Source location is empty.');
  renderBalanceRows('beforeDestBody', preview.before.destination, 'Destination location is empty.');
  renderBalanceRows('afterDestBody', preview.after.destination, 'No destination balances after move.');

  if (confirmBtn) confirmBtn.disabled = false;
  if (summary) {
    summary.hidden = false;
    summary.textContent =
      `Source ${preview.sourceLocationCode} → Destination ${preview.destinationLocationCode}: `
      + `${preview.moveCount} balance(s) will be moved. Source will be empty after confirm.`;
  }
}

function clearPreviewState(message) {
  currentPreview = null;
  const confirmBtn = document.getElementById('confirmMoveBtn');
  const summary = document.getElementById('moveSummary');
  if (confirmBtn) confirmBtn.disabled = true;
  if (summary) {
    summary.hidden = true;
    summary.textContent = '';
  }
  setEmptyPreviewRows(message || 'Enter source and destination locations, then click <strong>Preview</strong>.');
  setEmptyBalanceRows('beforeSourceBody', 'No preview yet.');
  setEmptyBalanceRows('beforeDestBody', 'No preview yet.');
  setEmptyBalanceRows('afterDestBody', 'No preview yet.');
}

async function runPreview() {
  const sourceInput = document.getElementById('sourceLocationCode');
  const destInput = document.getElementById('destinationLocationCode');
  const sourceLocationCode = normalizeLocationInput(sourceInput && sourceInput.value);
  const destinationLocationCode = normalizeLocationInput(destInput && destInput.value);

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

  try {
    const res = await fetch(MOVE_API + '/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sourceLocationCode, destinationLocationCode })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.message || data.error)) || 'Preview failed');
    }
    if (sourceInput) sourceInput.value = data.data.sourceLocationCode || sourceLocationCode;
    if (destInput) destInput.value = data.data.destinationLocationCode || destinationLocationCode;
    renderMovePreview(data.data);
  } catch (error) {
    clearPreviewState('Preview failed. Fix the location codes and try again.');
    alert(error.message || 'Preview failed');
  }
}

async function confirmMove() {
  if (!currentPreview || !currentPreview.moveCount) {
    alert('Run Preview first.');
    return;
  }

  const ok = window.confirm(
    `Move ${currentPreview.moveCount} product balance(s) from `
    + `${currentPreview.sourceLocationCode} to ${currentPreview.destinationLocationCode}?`
  );
  if (!ok) return;

  const confirmBtn = document.getElementById('confirmMoveBtn');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await fetch(MOVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sourceLocationCode: currentPreview.sourceLocationCode,
        destinationLocationCode: currentPreview.destinationLocationCode
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.message || data.error)) || 'Move failed');
    }

    alert(data.message || 'Move completed.');
    clearPreviewState('Move completed. Enter locations and click Preview for another move.');
  } catch (error) {
    if (confirmBtn) confirmBtn.disabled = false;
    alert(error.message || 'Move failed');
  }
}

function clearForm() {
  const sourceInput = document.getElementById('sourceLocationCode');
  const destInput = document.getElementById('destinationLocationCode');
  if (sourceInput) sourceInput.value = '';
  if (destInput) destInput.value = '';
  clearPreviewState();
  if (sourceInput) sourceInput.focus();
}

function openHelp() {
  const modal = document.getElementById('moveHelpModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
}

function closeHelp() {
  const modal = document.getElementById('moveHelpModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.style.display = 'none';
}

function updateScanButtonsVisibility() {
  const show = window.WarehouseBarcodeScanner
    && typeof window.WarehouseBarcodeScanner.isMobileDevice === 'function'
    && window.WarehouseBarcodeScanner.isMobileDevice();
  document.querySelectorAll('.move-scan-btn').forEach((btn) => {
    btn.style.display = show ? '' : 'none';
  });
}

function scanInto(inputId) {
  if (!window.WarehouseBarcodeScanner || typeof window.WarehouseBarcodeScanner.open !== 'function') {
    alert('Camera scanner is not available.');
    return;
  }
  window.WarehouseBarcodeScanner.open({
    statusText: 'Point the camera at the location barcode...',
    onDetect: (value) => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = normalizeLocationInput(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const previewBtn = document.getElementById('previewMoveBtn');
  const clearBtn = document.getElementById('clearMoveBtn');
  const cancelBtn = document.getElementById('cancelMoveBtn');
  const confirmBtn = document.getElementById('confirmMoveBtn');
  const helpBtn = document.getElementById('moveHelpBtn');
  const closeHelpModal = document.getElementById('closeMoveHelpModal');
  const closeHelpBtn = document.getElementById('closeMoveHelpBtn');
  const scanSourceBtn = document.getElementById('scanSourceLocationBtn');
  const scanDestBtn = document.getElementById('scanDestinationLocationBtn');
  const sourceInput = document.getElementById('sourceLocationCode');
  const destInput = document.getElementById('destinationLocationCode');

  if (previewBtn) previewBtn.addEventListener('click', runPreview);
  if (clearBtn) clearBtn.addEventListener('click', clearForm);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (confirmBtn) confirmBtn.addEventListener('click', confirmMove);
  if (helpBtn) helpBtn.addEventListener('click', openHelp);
  if (closeHelpModal) closeHelpModal.addEventListener('click', closeHelp);
  if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
  if (scanSourceBtn) scanSourceBtn.addEventListener('click', () => scanInto('sourceLocationCode'));
  if (scanDestBtn) scanDestBtn.addEventListener('click', () => scanInto('destinationLocationCode'));

  [sourceInput, destInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      currentPreview = null;
      const confirm = document.getElementById('confirmMoveBtn');
      if (confirm) confirm.disabled = true;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runPreview();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openHelp();
    }
  });

  updateScanButtonsVisibility();
  window.addEventListener('resize', updateScanButtonsVisibility);
  clearPreviewState();
});
