const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_APPLICATIONS = API_BASE + '/api/system-applications';

function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'search' ? 'search' : 'new';
}

function showSection() {
  const mode = getMode();
  const newSection = document.getElementById('newApplicationsSection');
  const searchSection = document.getElementById('searchApplicationsSection');
  const titleEl = document.getElementById('applicationsPageTitle');
  if (mode === 'search') {
    if (newSection) newSection.style.display = 'none';
    if (searchSection) searchSection.style.display = 'block';
    if (titleEl) titleEl.textContent = 'Search Applications';
  } else {
    if (newSection) newSection.style.display = 'block';
    if (searchSection) searchSection.style.display = 'none';
    if (titleEl) titleEl.textContent = 'New Applications';
  }
}

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

async function submitNewApplication(e) {
  e.preventDefault();
  const syapNmApplication = document.getElementById('newSyapNmApplication') && document.getElementById('newSyapNmApplication').value.trim();
  const syapDsDetailed = document.getElementById('newSyapDsDetailed') && document.getElementById('newSyapDsDetailed').value.trim();
  if (!syapNmApplication) {
    alert('Please enter Application Name.');
    return;
  }

  const saveBtn = document.getElementById('saveApplicationBtn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const res = await fetch(API_APPLICATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syapNmApplication,
        syapDsDetailed: syapDsDetailed || undefined
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Application saved successfully.');
      document.getElementById('newApplicationsForm').reset();
    } else {
      alert(data.message || data.error || 'Error saving application.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error. Please try again.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function searchApplications() {
  const syapNmApplication = document.getElementById('filterSyapNmApplication') && document.getElementById('filterSyapNmApplication').value.trim();
  const syapDsDetailed = document.getElementById('filterSyapDsDetailed') && document.getElementById('filterSyapDsDetailed').value.trim();

  const params = new URLSearchParams();
  if (syapNmApplication) params.set('syapNmApplication', syapNmApplication);
  if (syapDsDetailed) params.set('syapDsDetailed', syapDsDetailed);

  const tbody = document.getElementById('searchApplicationsTableBody');
  const countEl = document.getElementById('applicationsResultsCount');
  try {
    const res = await fetch(API_APPLICATIONS + '?' + params.toString());
    const data = await res.json();
    const list = (data.success && data.data) ? data.data : [];
    if (countEl) countEl.textContent = list.length + ' record(s)';

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No applications found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(app => `
      <tr>
        <td>${escapeHtml(app.syapCdSeq)}</td>
        <td>${escapeHtml(app.syapNmApplication || '-')}</td>
        <td>${escapeHtml(app.syapDsDetailed || '-')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    if (countEl) countEl.textContent = '0 records';
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Error loading applications.</td></tr>';
  }
}

function clearApplicationsFilters() {
  const nameEl = document.getElementById('filterSyapNmApplication');
  const descEl = document.getElementById('filterSyapDsDetailed');
  if (nameEl) nameEl.value = '';
  if (descEl) descEl.value = '';
  document.getElementById('searchApplicationsTableBody').innerHTML = '<tr><td colspan="3" class="empty-state">Use filters and click Search to load applications.</td></tr>';
  document.getElementById('applicationsResultsCount').textContent = '0 records';
}

document.addEventListener('DOMContentLoaded', () => {
  showSection();
  setupHeaderDropdowns();

  document.getElementById('newApplicationsForm').addEventListener('submit', submitNewApplication);
  document.getElementById('applyApplicationsFiltersBtn').addEventListener('click', searchApplications);
  document.getElementById('clearApplicationsFiltersBtn').addEventListener('click', clearApplicationsFilters);

  if (getMode() === 'search') {
    searchApplications();
  }
});
