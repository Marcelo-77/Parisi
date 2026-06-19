const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_MOVEMENT = API_BASE + '/api/movement';
const API_WAREHOUSE = API_BASE + '/api/warehouse';
const API_CUSTOMERS = API_BASE + '/api/customers';

let typeMovements = [];
let products = [];
let customers = [];
/** Next Item ID for New Movement items (starts at 1, resets when starting a new movement header). */
let nextNewItemId = 1;

function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'search' ? 'search' : 'new';
}

function showSection() {
  const mode = getMode();
  const newSection = document.getElementById('newMovementSection');
  const searchSection = document.getElementById('searchMovementSection');
  const titleEl = document.getElementById('movementPageTitle');
  if (mode === 'search') {
    if (newSection) newSection.style.display = 'none';
    if (searchSection) searchSection.style.display = 'block';
    if (titleEl) titleEl.textContent = 'Search Movement';
  } else {
    if (newSection) newSection.style.display = 'block';
    if (searchSection) searchSection.style.display = 'none';
    if (titleEl) titleEl.textContent = 'New Movement';
  }
}

function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
    ['locationProductMenuBtn', 'locationProductDropdownMenu'],
    ['movementMenuBtn', 'movementDropdownMenu'],
    ['pickingMenuBtn', 'pickingDropdownMenu'],
    ['helpMenuBtn', 'helpDropdownMenu'],
    ['customerMenuBtn', 'customerDropdownMenu']
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

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleString();
  } catch (_) {
    return isoStr;
  }
}

function destinationLabel(code) {
  const n = parseInt(code, 10);
  if (n === 1) return 'Local';
  if (n === 2) return 'Inter state';
  if (n === 3) return 'Pick UP';
  return '-';
}

async function loadTypeMovements() {
  try {
    const res = await fetch(API_MOVEMENT + '/types');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && Array.isArray(data.data)) {
      typeMovements = data.data;
    } else {
      typeMovements = [];
      if (!res.ok) console.error('Error loading type movements:', res.status, data);
    }
  } catch (e) {
    console.error('Error loading type movements:', e);
    typeMovements = [];
  }
}

async function loadProducts() {
  try {
    const res = await fetch(API_WAREHOUSE);
    const data = await res.json();
    products = (data.success && data.data) ? data.data : [];
  } catch (e) {
    console.error('Error loading products:', e);
    products = [];
  }
}

async function loadCustomers() {
  try {
    const res = await fetch(API_CUSTOMERS);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && Array.isArray(data.data)) {
      customers = data.data;
    } else {
      customers = [];
      if (!res.ok) console.error('Error loading customers:', res.status, data);
    }
  } catch (e) {
    console.error('Error loading customers:', e);
    customers = [];
  }
}

function fillCustomerSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Select customer</option>' +
    (customers || []).map(c => {
      const label = c.custNmCustomer || c.custCdCode || '';
      const code = c.custCdCode ? ` (${c.custCdCode})` : '';
      return `<option value="${c.custCdId}">${escapeHtml(label + code)}</option>`;
    }).join('');
}

function fillTypeMovementSelect(selectEl, includeAll) {
  if (!selectEl) return;
  selectEl.innerHTML = (includeAll ? '<option value="">All</option>' : '<option value="">Select type</option>') +
    typeMovements.map(t => `<option value="${t.tymoCdId}">${escapeHtml(t.tymoNmMovement)}</option>`).join('');
}

function fillProductOptions(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">Select product</option>' +
    (products || []).map(p => `<option value="${escapeHtml(p.codigo)}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nome || '')}</option>`).join('');
  if (current) selectEl.value = current;
}

function fillNewMovementTypeAndProducts() {
  const typeSelect = document.getElementById('newTypeMovement');
  fillTypeMovementSelect(typeSelect, false);
  document.querySelectorAll('#newMovementItemsBody .item-product').forEach(fillProductOptions);
}

function addItemRow() {
  const tbody = document.getElementById('newMovementItemsBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'item-row';
  const select = document.createElement('select');
  select.className = 'item-product';
  select.required = true;
  select.innerHTML = '<option value="">Select product</option>' +
    (products || []).map(p => `<option value="${escapeHtml(p.codigo)}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nome || '')}</option>`).join('');
  const qty = document.createElement('input');
  qty.type = 'number';
  qty.className = 'item-qty';
  qty.min = 0;
  qty.value = 0;
  qty.required = true;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-icon btn-remove-row';
  removeBtn.title = 'Remove row';
  removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
  removeBtn.addEventListener('click', () => tr.remove());
  const itemId = nextNewItemId++;
  tr.innerHTML = '<td class="item-moit-id">' + itemId + '</td><td></td><td></td><td></td>';
  tr.querySelector('td:nth-child(2)').appendChild(select);
  tr.querySelector('td:nth-child(3)').appendChild(qty);
  tr.querySelector('td:last-child').appendChild(removeBtn);
  tbody.appendChild(tr);
}

function collectNewMovementItems() {
  const items = [];
  document.querySelectorAll('#newMovementItemsBody .item-row').forEach(row => {
    const productSelect = row.querySelector('.item-product');
    const qtyInput = row.querySelector('.item-qty');
    const productCode = productSelect && productSelect.value ? productSelect.value.trim() : '';
    const qty = qtyInput ? parseInt(qtyInput.value, 10) : 0;
    if (productCode && !isNaN(qty) && qty >= 0) {
      items.push({ productCode, moveQtMovement: qty });
    }
  });
  return items;
}

async function submitNewMovement(e) {
  e.preventDefault();
  const tymoCdId = document.getElementById('newTypeMovement') && document.getElementById('newTypeMovement').value;
  const moveCdMovement = document.getElementById('newMoveCdMovement') && document.getElementById('newMoveCdMovement').value.trim();
  const moveDtMovement = document.getElementById('newMoveDtMovement') && document.getElementById('newMoveDtMovement').value;
  const moveCdDestination = document.getElementById('newMoveCdDestination') && document.getElementById('newMoveCdDestination').value;
  const custCdId = document.getElementById('newCustCdId') && document.getElementById('newCustCdId').value;
  const items = collectNewMovementItems();
  if (!tymoCdId) {
    alert('Please select a type of movement.');
    return;
  }
  if (items.length === 0) {
    alert('Please add at least one item with product and quantity.');
    return;
  }

  const saveBtn = document.getElementById('saveMovementBtn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const res = await fetch(API_MOVEMENT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tymoCdId: parseInt(tymoCdId, 10),
        custCdId: custCdId ? parseInt(custCdId, 10) : undefined,
        moveCdMovement: moveCdMovement || undefined,
        moveDtMovement: moveDtMovement || null,
        moveCdDestination: moveCdDestination || undefined,
        items
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Movement saved successfully.');
      document.getElementById('newMovementForm').reset();
      document.querySelectorAll('#newMovementItemsBody .item-row').forEach((row, i) => {
        if (i > 0) row.remove();
      });
      const firstRow = document.querySelector('#newMovementItemsBody .item-row');
      if (firstRow) {
        const moitCell = firstRow.querySelector('.item-moit-id');
        if (moitCell) moitCell.textContent = '1';
      }
      nextNewItemId = 2;
      const firstQty = document.querySelector('#newMovementItemsBody .item-qty');
      if (firstQty) firstQty.value = 0;
      fillNewMovementTypeAndProducts();
      fillCustomerSelect(document.getElementById('newCustCdId'));
    } else {
      alert(data.message || data.error || 'Error saving movement.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error. Please try again.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function searchMovements() {
  const tymoCdId = document.getElementById('filterTypeMovement') && document.getElementById('filterTypeMovement').value;
  const moveDtFrom = document.getElementById('filterMoveDtFrom') && document.getElementById('filterMoveDtFrom').value;
  const moveDtTo = document.getElementById('filterMoveDtTo') && document.getElementById('filterMoveDtTo').value;
  const moveCdMovement = document.getElementById('filterMoveCdMovement') && document.getElementById('filterMoveCdMovement').value.trim();

  const params = new URLSearchParams();
  if (tymoCdId) params.set('tymoCdId', tymoCdId);
  if (moveDtFrom) params.set('moveDtFrom', moveDtFrom);
  if (moveDtTo) params.set('moveDtTo', moveDtTo);
  if (moveCdMovement) params.set('moveCdMovement', moveCdMovement);

  const tbody = document.getElementById('searchMovementTableBody');
  const countEl = document.getElementById('movementResultsCount');
  try {
    const res = await fetch(API_MOVEMENT + '?' + params.toString());
    const data = await res.json();
    const list = (data.success && data.data) ? data.data : [];
    if (countEl) countEl.textContent = list.length + ' record(s)';

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No movements found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(m => {
      return `<tr>
        <td>${escapeHtml(m.moveCdId)}</td>
        <td>${escapeHtml(m.typeMovementName || '-')}</td>
        <td>${escapeHtml(m.custNmCustomer || '-')}</td>
        <td>${escapeHtml(formatDateTime(m.moveDtMovement))}</td>
        <td>${escapeHtml(m.moveCdMovement || '-')}</td>
        <td>${escapeHtml(destinationLabel(m.moveCdDestination))}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm view-detail-btn" data-id="${m.moveCdId}"><i class="fas fa-eye"></i> View</button>
          <button type="button" class="btn btn-primary btn-sm send-picking-btn" data-id="${m.moveCdId}"><i class="fas fa-dolly"></i> Send Picking</button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => openMovementDetail(btn.getAttribute('data-id')));
    });

    // Botão Send Picking: confirmação e chamada da API (só existe quando canSendPicking = true)
    tbody.querySelectorAll('.send-picking-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const confirmSend = window.confirm(`Send movement ${id} to Picking (phase 2)?`);
        if (!confirmSend) return;
        try {
          const res = await fetch(API_MOVEMENT + '/' + encodeURIComponent(id) + '/send-picking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.success) {
            alert(data.message || 'Movement sent to picking successfully.');
          } else {
            alert(data.message || data.error || 'Error sending movement to picking.');
          }
        } catch (err) {
          console.error('Error sending movement to picking:', err);
          alert('Network error while sending movement to picking.');
        }
      });
    });
  } catch (err) {
    console.error(err);
    if (countEl) countEl.textContent = '0 records';
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error loading movements.</td></tr>';
  }
}

async function openMovementDetail(id) {
  const modal = document.getElementById('movementDetailModal');
  const content = document.getElementById('movementDetailContent');
  if (!modal || !content) return;
  try {
    const res = await fetch(API_MOVEMENT + '/' + id);
    const data = await res.json();
    const m = data.success ? data.data : null;
    if (!m) {
      content.innerHTML = '<p>Movement not found.</p>';
      modal.style.display = 'block';
      return;
    }
    let html = '<p><strong>ID:</strong> ' + escapeHtml(m.moveCdId) + '</p>';
    html += '<p><strong>Type:</strong> ' + escapeHtml(m.typeMovementName || '-') + '</p>';
    html += '<p><strong>Date/Time:</strong> ' + escapeHtml(formatDateTime(m.moveDtMovement)) + '</p>';
    html += '<p><strong>Code:</strong> ' + escapeHtml(m.moveCdMovement || '-') + '</p>';
    html += '<p><strong>Destination:</strong> ' + escapeHtml(destinationLabel(m.moveCdDestination)) + '</p>';
    html += '<p><strong>Customer:</strong> ' + escapeHtml(m.custNmCustomer || '-') + '</p>';
    html += '<h4>Items</h4>';
    if (m.items && m.items.length) {
      html += '<table class="warehouse-table"><thead><tr><th>Item ID</th><th>Product Code</th><th>Quantity</th></tr></thead><tbody>';
      m.items.forEach(it => {
        html += '<tr><td>' + escapeHtml(it.moitCdId != null ? it.moitCdId : '-') + '</td><td>' + escapeHtml(it.productCode) + '</td><td>' + escapeHtml(it.moveQtMovement) + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p>No items.</p>';
    }
    content.innerHTML = html;
    modal.style.display = 'block';
  } catch (err) {
    console.error(err);
    content.innerHTML = '<p>Error loading detail.</p>';
    modal.style.display = 'block';
  }
}

function clearMovementFilters() {
  const filterType = document.getElementById('filterTypeMovement');
  const filterFrom = document.getElementById('filterMoveDtFrom');
  const filterTo = document.getElementById('filterMoveDtTo');
  const filterCode = document.getElementById('filterMoveCdMovement');
  if (filterType) filterType.value = '';
  if (filterFrom) filterFrom.value = '';
  if (filterTo) filterTo.value = '';
  if (filterCode) filterCode.value = '';
  document.getElementById('searchMovementTableBody').innerHTML = '<tr><td colspan="7" class="empty-state">Use filters and click Search to load movements.</td></tr>';
  document.getElementById('movementResultsCount').textContent = '0 records';
}

document.addEventListener('DOMContentLoaded', async () => {
  showSection();
  setupHeaderDropdowns();

  await Promise.all([loadTypeMovements(), loadProducts(), loadCustomers()]);

  fillTypeMovementSelect(document.getElementById('newTypeMovement'), false);
  fillTypeMovementSelect(document.getElementById('filterTypeMovement'), true);
  fillCustomerSelect(document.getElementById('newCustCdId'));
  fillProductOptions(document.querySelector('#newMovementItemsBody .item-product'));

  if (getMode() === 'new') {
    const firstMoit = document.querySelector('#newMovementItemsBody .item-row .item-moit-id');
    if (firstMoit) firstMoit.textContent = '1';
    nextNewItemId = 2;
  }

  document.getElementById('addMovementItemBtn').addEventListener('click', addItemRow);
  document.getElementById('newMovementForm').addEventListener('submit', submitNewMovement);

  document.querySelectorAll('#newMovementItemsBody .btn-remove-row').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr').remove());
  });

  document.getElementById('applyMovementFiltersBtn').addEventListener('click', searchMovements);
  document.getElementById('clearMovementFiltersBtn').addEventListener('click', clearMovementFilters);

  document.getElementById('closeMovementDetailModal').addEventListener('click', () => {
    document.getElementById('movementDetailModal').style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('movementDetailModal')) {
      document.getElementById('movementDetailModal').style.display = 'none';
    }
  });

  if (getMode() === 'search') {
    fillTypeMovementSelect(document.getElementById('filterTypeMovement'), true);
  }
});
