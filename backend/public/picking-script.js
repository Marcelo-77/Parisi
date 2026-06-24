// Use same origin when page is served from API server (http/https); otherwise fallback so API calls reach backend
function getApiBase() {
  if (typeof window === 'undefined' || !window.location) return 'http://localhost:3000';
  const o = window.location.origin;
  if (o && (o.startsWith('http://') || o.startsWith('https://'))) return o;
  return 'http://localhost:3000';
}
const API_BASE = getApiBase();
const API_PICKING = API_BASE + '/api/picking';
const API_WAREHOUSE = API_BASE + '/api/warehouse';

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
  return '-';
}

let pickingCache = [];

function applyPickingFilters(list) {
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

function renderPickingTable(list) {
  const tbody = document.getElementById('pickingTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No picking items found for phase 2, type 1.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => {
    const code = item.productCode ? String(item.productCode).trim() : '';
    const codeDisplay = code || '-';
    const codeCell = code
      ? `<a href="#" class="picking-product-code-link" data-product-code="${escapeHtml(code)}" title="View item details">${escapeHtml(codeDisplay)}</a>`
      : codeDisplay;
    return `
      <tr>
        <td><input type="checkbox" class="get-it-cb" data-phmi-id="${item.phmiCdId != null ? item.phmiCdId : ''}" aria-label="Get it"></td>
        <td>${item.moveCdId ?? '-'}</td>
        <td>${item.moveCdMovement ? String(item.moveCdMovement).trim() : '-'}</td>
        <td>${item.moitCdId ?? '-'}</td>
        <td>${codeCell}</td>
        <td>${item.productName ? String(item.productName).trim() : '-'}</td>
        <td>${item.phmiQtMovement ?? '-'}</td>
        <td>${item.phmiQtPicked ?? '-'}</td>
        <td>${item.phmiQtDoubleChecked ?? '-'}</td>
        <td>${motivoLabel(item.phmiCdMotivo ?? null)}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatCategory(cat) {
  if (cat == null || cat === '') return '-';
  return String(cat);
}

function getItemStatus(item) {
  if (item.quantidade === 0) return 'Out of Stock';
  if (item.quantidadeMinima != null && item.quantidade <= item.quantidadeMinima) return 'Low Stock';
  return 'Available';
}

async function openPickingItemDetail(productCode) {
  const modal = document.getElementById('pickingItemDetailModal');
  const detailsEl = document.getElementById('pickingItemDetails');
  if (!modal || !detailsEl) return;
  const code = String(productCode || '').trim();
  if (!code) {
    detailsEl.innerHTML = '<p class="error-state">No product code.</p>';
    modal.style.display = 'block';
    return;
  }
  detailsEl.innerHTML = '<p class="loading-text">Loading...</p>';
  modal.style.display = 'block';

  let item = null;
  try {
    const url = API_WAREHOUSE + '/by-code/' + encodeURIComponent(code);
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.data) {
      item = data.data;
    }
    // Fallback: list with exact codigo filter (in case by-code route not registered or different server)
    if (!item && (res.status === 404 || !res.ok)) {
      const listRes = await fetch(API_WAREHOUSE + '?codigo=' + encodeURIComponent(code));
      const listData = await listRes.json().catch(() => ({}));
      const list = (listData.success && listData.data && listData.data.length) ? listData.data : [];
      const exact = list.find(function (x) { return (x.codigo || '').toString().trim() === code; });
      if (exact) item = exact;
    }
  } catch (err) {
    console.error('Error loading item detail:', err);
    detailsEl.innerHTML = '<p class="error-state">Could not load item. Check that the server is running and the page is opened from the same host (e.g. http://localhost:3000/picking.html).</p>';
    return;
  }

  if (!item) {
    detailsEl.innerHTML = '<p class="error-state">Item not found for code: ' + escapeHtml(code) + '</p>';
    return;
  }

  try {

    detailsEl.innerHTML = `
      <div class="detail-section">
        <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
        <p><span class="detail-label">Code:</span> ${escapeHtml(item.codigo || '-')}</p>
        <p><span class="detail-label">Name:</span> ${escapeHtml(item.nome || '-')}</p>
        <p><span class="detail-label">Category:</span> ${escapeHtml(formatCategory(item.categoria))}</p>
        <p><span class="detail-label">Status:</span> <span class="status-badge ${getItemStatus(item).toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(getItemStatus(item))}</span></p>
      </div>
      <div class="detail-section">
        <h4><i class="fas fa-boxes"></i> Stock</h4>
        <p><span class="detail-label">Current Quantity:</span> ${item.quantidade != null ? item.quantidade : '-'}</p>
        <p><span class="detail-label">Minimum Quantity:</span> ${item.quantidadeMinima != null ? item.quantidadeMinima : 0}</p>
        <p><span class="detail-label">Weight (kg):</span> ${item.peso != null ? item.peso : '-'}</p>
      </div>
      <div class="detail-section product-location" id="productLocationSection">
        <h4><i class="fas fa-map-marker-alt"></i> Product Location</h4>
        <p class="product-location-desc">Locations with situation Full and stat_cd_id = A</p>
        <div id="productLocationContent"><span class="loading-text">Loading...</span></div>
      </div>
      ${item.descricao ? `
      <div class="detail-section">
        <h4><i class="fas fa-align-left"></i> Description</h4>
        <p>${escapeHtml(item.descricao)}</p>
      </div>
      ` : ''}
    `;

    const contentEl = document.getElementById('productLocationContent');
    if (contentEl) {
      try {
        const locRes = await fetch(API_BASE + '/api/location-product/by-product-full/' + encodeURIComponent(code));
        const locData = await locRes.json().catch(() => ({}));
        const rawList = (locData.success && locData.data) ? locData.data : [];
        const list = rawList.map(r => ({
          locationCode: r.locationCode != null ? r.locationCode : r.location_code,
          quantityCurrent: r.quantityCurrent != null ? r.quantityCurrent : (r.quantity_current ?? 0),
          accessType: r.accessType != null ? r.accessType : (r.access_type ?? '')
        }));
        if (!list.length) {
          contentEl.innerHTML = '<p class="empty-state">No locations (situation Full, stat_cd_id A) for this product.</p>';
        } else {
          contentEl.innerHTML = `
            <table class="product-location-table">
              <thead><tr><th>Location Code</th><th>Access Type</th><th>Quantity Current</th></tr></thead>
              <tbody>
                ${list.map(r => `<tr><td>${escapeHtml(r.locationCode || '-')}</td><td>${escapeHtml(r.accessType || '-')}</td><td>${r.quantityCurrent}</td></tr>`).join('')}
              </tbody>
            </table>
          `;
        }
      } catch (e) {
        contentEl.innerHTML = '<p class="error-state">Error loading locations.</p>';
      }
    }
  } catch (err) {
    console.error('Error loading item detail:', err);
    detailsEl.innerHTML = '<p class="error-state">Error loading item details.</p>';
  }
}

function closePickingItemDetailModal() {
  const modal = document.getElementById('pickingItemDetailModal');
  if (modal) modal.style.display = 'none';
}

async function loadPicking() {
  const tbody = document.getElementById('pickingTableBody');
  if (!tbody) return;
  try {
    const res = await fetch(API_PICKING);
    const data = await res.json();
    pickingCache = (data.success && data.data) ? data.data : [];
    renderPickingTable(applyPickingFilters(pickingCache));
  } catch (err) {
    console.error('Error loading picking items:', err);
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Error loading picking items.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  loadPicking();

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.picking-product-code-link');
    if (link) {
      e.preventDefault();
      const code = link.getAttribute('data-product-code');
      if (code) openPickingItemDetail(code);
    }
  });

  const closeDetailBtn = document.getElementById('closePickingItemDetailModal');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', closePickingItemDetailModal);
  const pickingDetailModal = document.getElementById('pickingItemDetailModal');
  if (pickingDetailModal) {
    pickingDetailModal.addEventListener('click', (e) => {
      if (e.target === pickingDetailModal) closePickingItemDetailModal();
    });
  }

  const searchBtn = document.getElementById('searchPickingBtn');
  const clearBtn = document.getElementById('clearPickingFiltersBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderPickingTable(applyPickingFilters(pickingCache));
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ids = ['filterMoveId', 'filterMoveCode', 'filterItemId', 'filterProductCode'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderPickingTable(pickingCache);
    });
  }

  const getAllBtn = document.getElementById('getAllBtn');
  if (getAllBtn) {
    getAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.get-it-cb').forEach(cb => { cb.checked = true; });
    });
  }

  const separationBtn = document.getElementById('separationPickingBtn');
  if (separationBtn) {
    separationBtn.addEventListener('click', async () => {
      const checked = Array.from(document.querySelectorAll('.get-it-cb'))
        .filter(cb => cb.checked);
      if (!checked.length) {
        alert('Please select at least one item with "Get it".');
        return;
      }
      const phmiIds = checked
        .map(cb => cb.getAttribute('data-phmi-id'))
        .filter(id => id != null && id !== '');
      if (!phmiIds.length) {
        alert('No valid items selected.');
        return;
      }

      const ok = window.confirm('Create Separation and Picking (phase 3) for selected items?');
      if (!ok) return;

      try {
        const res = await fetch(API_PICKING + '/separation-and-picking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phmiIds })
        });
        const data = await res.json();
        if (data && data.success) {
          alert(data.message || 'Separation and Picking created successfully.');
          loadPicking();
        } else {
          alert(data.message || data.error || 'Error creating Separation and Picking.');
        }
      } catch (err) {
        console.error('Error calling Separation and Picking API:', err);
        alert('Network error while creating Separation and Picking.');
      }
    });
  }
});

