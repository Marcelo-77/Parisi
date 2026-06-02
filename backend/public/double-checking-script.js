const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_PICKING = API_BASE + '/api/picking';

function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
    ['movementMenuBtn', 'movementDropdownMenu'],
    ['customerMenuBtn', 'customerDropdownMenu'],
    ['pickingMenuBtn', 'pickingDropdownMenu'],
    ['helpMenuBtn', 'helpDropdownMenu']
  ];
  const buttons = {};
  const menus = {};
  dropdowns.forEach(([btnId, menuId]) => {
    buttons[btnId] = document.getElementById(btnId);
    menus[menuId] = document.getElementById(menuId);
  });

  function closeAll() {
    Object.values(menus).forEach(el => { if (el) el.setAttribute('aria-hidden', 'true'); });
    Object.values(buttons).forEach(el => { if (el) el.setAttribute('aria-expanded', 'false'); });
  }

  Object.keys(buttons).forEach(btnId => {
    const btn = buttons[btnId];
    const menuId = btnId.replace('MenuBtn', 'DropdownMenu');
    const menu = menus[menuId];
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        const open = menu.getAttribute('aria-hidden') !== 'true';
        menu.setAttribute('aria-hidden', open ? 'true' : 'false');
        btn.setAttribute('aria-expanded', !open);
      });
    }
  });

  document.addEventListener('click', closeAll);

  const newProductBtn = document.getElementById('newProductBtn');
  const searchProductBtn = document.getElementById('searchProductBtn');
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
}

function motivoLabel(code) {
  if (code === 1) return 'OK';
  if (code === 2) return 'No STOCK';
  if (code === 3) return 'Double Check Error';
  return '-';
}

let doubleCheckCache = [];

function applyFilters(list) {
  const moveIdInput = document.getElementById('filterMoveId');
  const moveCodeInput = document.getElementById('filterMoveCode');
  const itemIdInput = document.getElementById('filterItemId');
  const productCodeInput = document.getElementById('filterProductCode');

  const moveId = moveIdInput && moveIdInput.value ? Number(moveIdInput.value) : null;
  const moveCode = moveCodeInput && moveCodeInput.value ? moveCodeInput.value.trim().toLowerCase() : null;
  const itemId = itemIdInput && itemIdInput.value ? Number(itemIdInput.value) : null;
  const productCode = productCodeInput && productCodeInput.value ? productCodeInput.value.trim().toLowerCase() : null;

  return list.filter(item => {
    if (moveId !== null && item.moveCdId !== moveId) return false;
    if (moveCode && !(item.moveCdMovement && String(item.moveCdMovement).toLowerCase().includes(moveCode))) return false;
    if (itemId !== null && item.moitCdId !== itemId) return false;
    if (productCode && !(item.productCode && String(item.productCode).toLowerCase().includes(productCode))) return false;
    return true;
  });
}

function renderTable(list) {
  const tbody = document.getElementById('doubleCheckTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No items found for phase 4.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => {
    const qtyMov = item.phmiQtMovement != null ? Number(item.phmiQtMovement) : null;
    const qtyPicked = item.phmiQtPicked != null ? Number(item.phmiQtPicked) : null;
    const reasonVal = item.phmiCdMotivo != null ? String(item.phmiCdMotivo) : '';
    const shouldEnableReason = !!reasonVal;
    return `
    <tr data-qty-movement="${qtyMov !== null && qtyMov !== undefined ? qtyMov : ''}" data-phmi-id="${item.phmiCdId != null ? item.phmiCdId : ''}">
      <td>${item.moveCdId ?? '-'}</td>
      <td>${item.moveCdMovement ? String(item.moveCdMovement).trim() : '-'}</td>
      <td>${item.moitCdId ?? '-'}</td>
      <td>${item.productCode ? String(item.productCode).trim() : '-'}</td>
      <td>${item.productName ? String(item.productName).trim() : '-'}</td>
      <td>${item.phmiQtMovement ?? '-'}</td>
      <td>
        <input
          type="number"
          class="doublecheck-qty-picked-input"
          value="${item.phmiQtPicked ?? ''}"
          min="0"
          step="1"
          style="width: 80px; text-align: right;"
          disabled
          readonly
        />
      </td>
      <td>
        <input
          type="number"
          class="doublecheck-qty-double-input"
          value="${item.phmiQtPicked ?? ''}"
          min="0"
          step="1"
          style="width: 80px; text-align: right;"
        />
      </td>
      <td>
        <select class="doublecheck-reason-select" ${shouldEnableReason ? '' : 'disabled'} style="min-width: 100px;">
          <option value="">-</option>
          <option value="1" ${reasonVal === '1' ? 'selected' : ''}>OK</option>
          <option value="2" ${reasonVal === '2' ? 'selected' : ''}>No STOCK</option>
          <option value="3" ${reasonVal === '3' ? 'selected' : ''}>Double Check Error</option>
        </select>
      </td>
      <td>
        <input
          type="text"
          class="doublecheck-error-description-input"
          value="${item.phmiDsText ? String(item.phmiDsText).trim() : ''}"
          style="width: 180px;"
        />
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('.doublecheck-qty-double-input').forEach(input => {
    input.addEventListener('input', toggleReasonInRow);
    input.addEventListener('change', toggleReasonInRow);
  });

  tbody.querySelectorAll('.doublecheck-reason-select').forEach(select => {
    // estado inicial baseado no valor atual
    toggleErrorDescriptionForRow(select);
    // atualizar quando o motivo mudar
    select.addEventListener('change', (ev) => {
      toggleErrorDescriptionForRow(ev.target);
    });
  });
}

function toggleReasonInRow(ev) {
  const input = ev.target;
  const row = input.closest('tr');
  if (!row) return;
  const qtyMovement = row.getAttribute('data-qty-movement');
  const qtyMovNum = qtyMovement === '' || qtyMovement === null ? null : Number(qtyMovement);
  const qtyPickedVal = input.value.trim();
  const qtyPickedNum = qtyPickedVal === '' ? null : Number(qtyPickedVal);
  const diff = qtyMovNum !== qtyPickedNum;
  const select = row.querySelector('.doublecheck-reason-select');
  if (select) {
    select.disabled = !diff;
    if (!diff) select.value = '';
  }
}

function toggleErrorDescriptionForRow(selectEl) {
  const row = selectEl.closest('tr');
  if (!row) return;
  const errInput = row.querySelector('.doublecheck-error-description-input');
  if (!errInput) return;
  const enable = selectEl.value === '3';
  errInput.disabled = !enable;
  errInput.readOnly = !enable;
  if (!enable) {
    errInput.value = '';
  }
}

async function loadDoubleChecking() {
  const tbody = document.getElementById('doubleCheckTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Loading...</td></tr>';
  try {
    const res = await fetch(API_PICKING + '/double-checking');
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Error: ' + res.status + ' ' + res.statusText + '</td></tr>';
      return;
    }
    const data = await res.json();
    const list = (data && data.success && Array.isArray(data.data)) ? data.data : (Array.isArray(data) ? data : []);
    doubleCheckCache = list;
    renderTable(applyFilters(doubleCheckCache));
  } catch (err) {
    console.error('Error loading double checking items:', err);
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Error loading items. Check console and that the server is running.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  loadDoubleChecking();

  const searchBtn = document.getElementById('searchDoubleCheckBtn');
  const clearBtn = document.getElementById('clearDoubleCheckFiltersBtn');
  const getAllOkBtn = document.getElementById('getAllOkBtn');
  const saveAndSendBtn = document.getElementById('saveAndSendBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderTable(applyFilters(doubleCheckCache));
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ['filterMoveId', 'filterMoveCode', 'filterItemId', 'filterProductCode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderTable(doubleCheckCache);
    });
  }
  if (getAllOkBtn) {
    getAllOkBtn.addEventListener('click', () => {
      const baseList = applyFilters(doubleCheckCache);
      baseList.forEach(item => {
        item.phmiCdMotivo = 1;
      });
      renderTable(baseList);
    });
  }
  if (saveAndSendBtn) {
    saveAndSendBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('doubleCheckTableBody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr[data-phmi-id]');
      const items = [];

      rows.forEach(tr => {
        const idAttr = tr.getAttribute('data-phmi-id');
        if (!idAttr) return;
        const phmiCdId = parseInt(idAttr, 10);
        if (Number.isNaN(phmiCdId)) return;

        const qtyInput = tr.querySelector('.doublecheck-qty-double-input');
        const reasonSelect = tr.querySelector('.doublecheck-reason-select');
        const descInput = tr.querySelector('.doublecheck-error-description-input');

        const qtyVal = qtyInput && qtyInput.value.trim() !== '' ? parseInt(qtyInput.value.trim(), 10) : null;
        const motivoVal = reasonSelect && reasonSelect.value !== '' ? parseInt(reasonSelect.value, 10) : null;
        const descVal = descInput && descInput.value ? descInput.value.trim() : null;

        items.push({
          phmiCdId,
          phmiQtDoubleChecked: Number.isNaN(qtyVal) ? null : qtyVal,
          phmiCdMotivo: Number.isNaN(motivoVal) ? null : motivoVal,
          phmiDsText: descVal && descVal.length ? descVal : null
        });
      });

      const filteredItems = items.filter(it => it.phmiCdMotivo === 1 || it.phmiCdMotivo === 3);
      if (!filteredItems.length) {
        alert('No items with Reason = OK or Double Check Error to save.');
        return;
      }

      const confirmMsg = 'I will send the items marked as OK for "Last check and Label" and those marked as "Error in Picking".\n\nDo you want to continue?';
      const ok = window.confirm(confirmMsg);
      if (!ok) return;

      try {
        const res = await fetch(API_PICKING + '/double-checking/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: filteredItems })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 404) {
          alert('Route /api/picking/double-checking/confirm not found (404). Please restart the backend server or update the routes.');
          return;
        }

        if (data && data.success) {
          alert('I will send the items marked as OK for "Last check and Label" and those marked as "Error in Picking".');
          loadDoubleChecking();
        } else {
          alert(data.message || data.error || 'Error saving Double Checking results.');
        }
      } catch (err) {
        console.error('Error saving Double Checking results:', err);
        alert('Network error while saving Double Checking results.');
      }
    });
  }
});
