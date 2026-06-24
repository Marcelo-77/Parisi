const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_MOVEMENT = API_BASE + '/api/movement';

let typeMovements = [];

function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
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
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
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

function reasonLabel(code) {
  const n = parseInt(code, 10);
  if (n === 1) return 'OK';
  if (n === 2) return 'No STOCK';
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

function fillTypeMovementSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value=\"\">All</option>' +
    typeMovements.map(t => `<option value=\"${t.tymoCdId}\">${escapeHtml(t.tymoNmMovement)}</option>`).join('');
}

async function searchMovementSituation() {
  const tymoCdId = document.getElementById('filterTypeMovement') && document.getElementById('filterTypeMovement').value;
  const moveDtFrom = document.getElementById('filterMoveDtFrom') && document.getElementById('filterMoveDtFrom').value;
  const moveDtTo = document.getElementById('filterMoveDtTo') && document.getElementById('filterMoveDtTo').value;
  const moveCdMovement = document.getElementById('filterMoveCdMovement') && document.getElementById('filterMoveCdMovement').value.trim();

  const params = new URLSearchParams();
  if (tymoCdId) params.set('tymoCdId', tymoCdId);
  if (moveDtFrom) params.set('moveDtFrom', moveDtFrom);
  if (moveDtTo) params.set('moveDtTo', moveDtTo);
  if (moveCdMovement) params.set('moveCdMovement', moveCdMovement);

  const tbody = document.getElementById('movementSituationTableBody');
  const countEl = document.getElementById('situationResultsCount');

  tbody.innerHTML = '<tr><td colspan=\"13\" class=\"empty-state\">Loading...</td></tr>';

  try {
    const res = await fetch(API_MOVEMENT + '/situation?' + params.toString());
    const data = await res.json();
    const list = (data.success && data.data) ? data.data : [];
    if (countEl) countEl.textContent = list.length + ' record(s)';

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan=\"13\" class=\"empty-state\">No movement history found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(row => {
      return `<tr>
        <td>${escapeHtml(row.moveCdId)}</td>
        <td>${escapeHtml(row.moveCdMovement || '-')}</td>
        <td>${escapeHtml(formatDateTime(row.moveDtMovement))}</td>
        <td>${escapeHtml(row.typeMovementName || '-')}</td>
        <td>${escapeHtml(row.custNmCustomer || '-')}</td>
        <td>${escapeHtml(row.moitCdId != null ? row.moitCdId : '-')}</td>
        <td>${escapeHtml(row.productCode || '-')}</td>
        <td>${escapeHtml(row.productName || '-')}</td>
        <td>${escapeHtml(row.phaseDescription || ('Phase ' + (row.phmoSqId != null ? row.phmoSqId : '-')))}</td>
        <td>${escapeHtml(row.phmiQtMovement != null ? row.phmiQtMovement : '-')}</td>
        <td>${escapeHtml(row.phmiQtPicked != null ? row.phmiQtPicked : '-')}</td>
        <td>${escapeHtml(row.phmiQtDoubleChecked != null ? row.phmiQtDoubleChecked : '-')}</td>
        <td>${escapeHtml(reasonLabel(row.phmiCdMotivo))}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error loading movement situation:', err);
    if (countEl) countEl.textContent = '0 records';
    tbody.innerHTML = '<tr><td colspan=\"13\" class=\"empty-state\">Error loading movement history.</td></tr>';
  }
}

function clearSituationFilters() {
  const filterType = document.getElementById('filterTypeMovement');
  const filterFrom = document.getElementById('filterMoveDtFrom');
  const filterTo = document.getElementById('filterMoveDtTo');
  const filterCode = document.getElementById('filterMoveCdMovement');
  if (filterType) filterType.value = '';
  if (filterFrom) filterFrom.value = '';
  if (filterTo) filterTo.value = '';
  if (filterCode) filterCode.value = '';
  document.getElementById('movementSituationTableBody').innerHTML =
    '<tr><td colspan=\"13\" class=\"empty-state\">Use filters and click Search to load movement history.</td></tr>';
  document.getElementById('situationResultsCount').textContent = '0 records';
}

document.addEventListener('DOMContentLoaded', async () => {
  setupHeaderDropdowns();
  await loadTypeMovements();
  fillTypeMovementSelect(document.getElementById('filterTypeMovement'));

  document.getElementById('applySituationFiltersBtn').addEventListener('click', searchMovementSituation);
  document.getElementById('clearSituationFiltersBtn').addEventListener('click', clearSituationFilters);
});

