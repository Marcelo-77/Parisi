const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_PICKING = API_BASE + '/api/picking';

function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
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
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
}

function motivoLabel(code) {
  if (code === 1) return 'OK';
  if (code === 2) return 'No STOCK';
  if (code === 3) return 'Double Check Error';
  if (code === 4) return 'Last check Error';
  return '-';
}

let lastCheckCache = [];

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
  const tbody = document.getElementById('lastCheckTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No items found for phase 6.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => {
    const reasonVal = item.phmiCdMotivo != null ? String(item.phmiCdMotivo) : '';
    const isLastCheckError = reasonVal === '4';
    const descVal = item.phmiDsText ? String(item.phmiDsText).trim() : '';
    return `
    <tr data-phmi-id="${item.phmiCdId != null ? item.phmiCdId : ''}">
      <td>${item.moveCdId ?? '-'}</td>
      <td>${item.moveCdMovement ? String(item.moveCdMovement).trim() : '-'}</td>
      <td>${item.moitCdId ?? '-'}</td>
      <td>${item.productCode ? String(item.productCode).trim() : '-'}</td>
      <td>${item.productName ? String(item.productName).trim() : '-'}</td>
      <td>${item.phmiQtMovement ?? '-'}</td>
      <td>${item.phmiQtPicked ?? '-'}</td>
      <td>${item.phmiQtDoubleChecked ?? '-'}</td>
      <td>
        <select class="lastcheck-reason-select" style="min-width: 100px;">
          <option value="">-</option>
          <option value="1" ${reasonVal === '1' ? 'selected' : ''}>OK</option>
          <option value="2" ${reasonVal === '2' ? 'selected' : ''}>No STOCK</option>
          <option value="3" ${reasonVal === '3' ? 'selected' : ''}>Double Check Error</option>
          <option value="4" ${reasonVal === '4' ? 'selected' : ''}>Last check Error</option>
        </select>
      </td>
      <td>
        <input type="text" class="lastcheck-error-desc form-control" style="min-width: 140px;"
          value="${descVal.replace(/"/g, '&quot;')}"
          placeholder="Description"
          ${isLastCheckError ? '' : 'disabled'}>
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('.lastcheck-reason-select').forEach(select => {
    select.addEventListener('change', function () {
      const row = this.closest('tr');
      const descInput = row && row.querySelector('.lastcheck-error-desc');
      if (descInput) descInput.disabled = this.value !== '4';
    });
  });
}

async function loadLastCheckAndLabel() {
  const tbody = document.getElementById('lastCheckTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Loading...</td></tr>';
  try {
    const res = await fetch(API_PICKING + '/last-check-label');
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Error: ' + res.status + ' ' + res.statusText + '</td></tr>';
      return;
    }
    const data = await res.json();
    const list = (data && data.success && Array.isArray(data.data)) ? data.data : (Array.isArray(data) ? data : []);
    lastCheckCache = list;
    renderTable(applyFilters(lastCheckCache));
  } catch (err) {
    console.error('Error loading last check and label items:', err);
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Error loading items. Check console and that the server is running.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  loadLastCheckAndLabel();

  const searchBtn = document.getElementById('searchLastCheckBtn');
  const clearBtn = document.getElementById('clearLastCheckFiltersBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderTable(applyFilters(lastCheckCache));
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ['filterMoveId', 'filterMoveCode', 'filterItemId', 'filterProductCode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderTable(lastCheckCache);
    });
  }

  const saveAndSendBtn = document.getElementById('saveAndSendLastCheckBtn');
  if (saveAndSendBtn) {
    saveAndSendBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('lastCheckTableBody');
      if (!tbody) return;
      const rows = tbody.querySelectorAll('tr[data-phmi-id]');
      if (!rows.length) {
        alert('No items to save.');
        return;
      }
      const items = [];
      rows.forEach(row => {
        const phmiId = row.getAttribute('data-phmi-id');
        if (!phmiId) return;
        const reasonSelect = row.querySelector('.lastcheck-reason-select');
        const descInput = row.querySelector('.lastcheck-error-desc');
        const phmiCdMotivo = reasonSelect ? reasonSelect.value : '';
        const phmiDsText = descInput ? descInput.value.trim() : '';
        items.push({
          phmiCdId: parseInt(phmiId, 10),
          phmiCdMotivo: phmiCdMotivo === '' ? null : phmiCdMotivo,
          phmiDsText: phmiDsText || null
        });
      });
      if (!items.length) {
        alert('No valid items to save.');
        return;
      }
      const confirmMsg = 'I will send the correct lines to "Loading onto the Truck" and the ones with errors to "Error in Picking LC".';
      if (!confirm(confirmMsg)) return;
      saveAndSendBtn.disabled = true;
      try {
        const res = await fetch(API_PICKING + '/last-check-label/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          alert(data.message || 'Items saved successfully.');
          loadLastCheckAndLabel();
        } else {
          alert(data.message || data.error || 'Error saving items. ' + (res.statusText || ''));
        }
      } catch (err) {
        console.error(err);
        alert('Error saving items. Check console.');
      } finally {
        saveAndSendBtn.disabled = false;
      }
    });
  }
});

