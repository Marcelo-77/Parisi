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
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
}

function motivoLabel(code) {
  if (code === 1) return 'OK';
  if (code === 2) return 'No STOCK';
  return '-';
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

let separationCache = [];

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
  const tbody = document.getElementById('separationTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No items found for phase 3.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => {
    const qtyMov = item.phmiQtMovement != null ? Number(item.phmiQtMovement) : null;
    const qtyPicked = item.phmiQtPicked != null ? Number(item.phmiQtPicked) : null;
    const diff = qtyMov !== qtyPicked;
    const reasonVal = item.phmiCdMotivo != null ? String(item.phmiCdMotivo) : '';
    const code = item.productCode ? String(item.productCode).trim() : '';
    const codeDisplay = code || '-';
    const codeCell = code
      ? `<a href="#" class="separation-product-code-link" data-product-code="${escapeHtml(code)}" title="View item details">${escapeHtml(codeDisplay)}</a>`
      : codeDisplay;
    return `
    <tr data-qty-movement="${qtyMov !== null && qtyMov !== undefined ? qtyMov : ''}" data-phmi-id="${item.phmiCdId != null ? item.phmiCdId : ''}">
      <td>${item.moveCdId ?? '-'}</td>
      <td>${item.moveCdMovement ? String(item.moveCdMovement).trim() : '-'}</td>
      <td>${item.moitCdId ?? '-'}</td>
      <td>${codeCell}</td>
      <td>${item.productName ? String(item.productName).trim() : '-'}</td>
      <td>${item.phmiQtMovement ?? '-'}</td>
      <td>
        <input
          type="number"
          class="separation-qty-picked-input"
          value="${item.phmiQtPicked ?? ''}"
          min="0"
          step="1"
          style="width: 80px; text-align: right;"
        />
      </td>
      <td>
        <select class="separation-reason-select" ${diff ? '' : 'disabled'} style="min-width: 100px;">
          <option value="">-</option>
          <option value="1" ${reasonVal === '1' ? 'selected' : ''}>OK</option>
          <option value="2" ${reasonVal === '2' ? 'selected' : ''}>No STOCK</option>
        </select>
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('.separation-qty-picked-input').forEach(input => {
    input.addEventListener('input', toggleReasonInRow);
    input.addEventListener('change', toggleReasonInRow);
  });
}

async function openSeparationItemDetail(productCode) {
  const modal = document.getElementById('separationItemDetailModal');
  const detailsEl = document.getElementById('separationItemDetails');
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
    const res = await fetch(API_WAREHOUSE + '/by-code/' + encodeURIComponent(code));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.data) {
      item = data.data;
    }
    if (!item && (res.status === 404 || !res.ok)) {
      const listRes = await fetch(API_WAREHOUSE + '?codigo=' + encodeURIComponent(code));
      const listData = await listRes.json().catch(() => ({}));
      const list = (listData.success && listData.data && listData.data.length) ? listData.data : [];
      const exact = list.find(function (x) { return (x.codigo || '').toString().trim() === code; });
      if (exact) item = exact;
    }
  } catch (err) {
    console.error('Error loading item detail:', err);
    detailsEl.innerHTML = '<p class="error-state">Could not load item. Check that the server is running and the page is opened from the same host (e.g. http://localhost:3000/separation-picking.html).</p>';
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
      <div class="detail-section product-location" id="separationProductLocationSection">
        <h4><i class="fas fa-map-marker-alt"></i> Product Location</h4>
        <p class="product-location-desc">Locations with situation Full and stat_cd_id = A</p>
        <div id="separationProductLocationContent"><span class="loading-text">Loading...</span></div>
      </div>
      ${item.descricao ? `
      <div class="detail-section">
        <h4><i class="fas fa-align-left"></i> Description</h4>
        <p>${escapeHtml(item.descricao)}</p>
      </div>
      ` : ''}
    `;

    const contentEl = document.getElementById('separationProductLocationContent');
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

function closeSeparationItemDetailModal() {
  const modal = document.getElementById('separationItemDetailModal');
  if (modal) modal.style.display = 'none';
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
  const select = row.querySelector('.separation-reason-select');
  if (select) {
    select.disabled = !diff;
    if (!diff) select.value = '';
  }
}

async function loadSeparationPicking() {
  const tbody = document.getElementById('separationTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Loading...</td></tr>';
  try {
    const res = await fetch(API_PICKING + '/separation');
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error: ' + res.status + ' ' + res.statusText + '</td></tr>';
      return;
    }
    const data = await res.json();
    const list = (data && data.success && Array.isArray(data.data)) ? data.data : (Array.isArray(data) ? data : []);
    separationCache = list;
    renderTable(applyFilters(separationCache));
  } catch (err) {
    console.error('Error loading separation picking items:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error loading items. Check console and that the server is running.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  loadSeparationPicking();

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.separation-product-code-link');
    if (link) {
      e.preventDefault();
      const code = link.getAttribute('data-product-code');
      if (code) openSeparationItemDetail(code);
    }
  });

  const closeDetailBtn = document.getElementById('closeSeparationItemDetailModal');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeSeparationItemDetailModal);
  const separationDetailModal = document.getElementById('separationItemDetailModal');
  if (separationDetailModal) {
    separationDetailModal.addEventListener('click', (e) => {
      if (e.target === separationDetailModal) closeSeparationItemDetailModal();
    });
  }

  const searchBtn = document.getElementById('searchSeparationBtn');
  const clearBtn = document.getElementById('clearSeparationFiltersBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderTable(applyFilters(separationCache));
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ['filterMoveId', 'filterMoveCode', 'filterItemId', 'filterProductCode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderTable(separationCache);
    });
  }

  const sentDoubleCheckBtn = document.getElementById('sentDoubleCheckBtn');
  if (sentDoubleCheckBtn) {
    sentDoubleCheckBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('separationTableBody');
      if (!tbody) return;
      const rows = tbody.querySelectorAll('tr[data-phmi-id]');
      const items = [];
      rows.forEach(tr => {
        const phmiId = tr.getAttribute('data-phmi-id');
        if (phmiId == null || String(phmiId).trim() === '') return;
        const phmiCdId = parseInt(phmiId, 10);
        if (isNaN(phmiCdId)) return;
        const input = tr.querySelector('.separation-qty-picked-input');
        const select = tr.querySelector('.separation-reason-select');
        const phmiQtPicked = input && input.value.trim() !== '' ? parseInt(input.value.trim(), 10) : null;
        const phmiCdMotivo = select && select.value !== '' ? parseInt(select.value, 10) : null;
        items.push({ phmiCdId, phmiQtPicked: isNaN(phmiQtPicked) ? null : phmiQtPicked, phmiCdMotivo });
      });
      if (!items.length) {
        alert('Nenhum item na lista para enviar. Carregue itens em Separation and Picking (fase 3) primeiro.');
        return;
      }
      const ok = window.confirm('Send ' + items.length + ' item(s) for Double Checking?');
      if (!ok) return;
      try {
        const res = await fetch(API_PICKING + '/send-double-checking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          alert('Rota não encontrada (404). Reinicie o servidor backend e tente novamente.');
          return;
        }
        if (data && data.success) {
          alert(data.message || 'Enviado para Double Checking com sucesso.');
          loadSeparationPicking();
        } else {
          alert(data.message || data.error || 'Erro ao enviar para double checking.');
        }
      } catch (err) {
        console.error('Error sending for double checking:', err);
        alert('Erro de rede. Verifique se o servidor está rodando.');
      }
    });
  }
});
