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
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No applications found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(app => `
      <tr>
        <td>${escapeHtml(app.syapCdSeq)}</td>
        <td>${escapeHtml(app.syapNmApplication || '-')}</td>
        <td>${escapeHtml(app.syapDsDetailed || '-')}</td>
        <td class="td-actions">
          <button
            type="button"
            class="btn btn-edit btn-edit-application"
            data-id="${escapeHtml(app.syapCdSeq)}"
            data-name="${escapeHtml(app.syapNmApplication || '')}"
            data-detailed="${escapeHtml(app.syapDsDetailed || '')}"
            title="Edit Detailed Description"
          >
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-application').forEach((btn) => {
      btn.addEventListener('click', () => openEditApplicationModal(btn.dataset));
    });
  } catch (err) {
    console.error(err);
    if (countEl) countEl.textContent = '0 records';
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading applications.</td></tr>';
  }
}

function clearApplicationsFilters() {
  const nameEl = document.getElementById('filterSyapNmApplication');
  const descEl = document.getElementById('filterSyapDsDetailed');
  if (nameEl) nameEl.value = '';
  if (descEl) descEl.value = '';
  document.getElementById('searchApplicationsTableBody').innerHTML = '<tr><td colspan="4" class="empty-state">Use filters and click Search to load applications.</td></tr>';
  document.getElementById('applicationsResultsCount').textContent = '0 records';
}

function openEditApplicationModal(dataset) {
  const modal = document.getElementById('editApplicationModal');
  if (!modal) return;
  document.getElementById('editSyapCdSeq').value = dataset.id || '';
  document.getElementById('editSyapNmApplication').value = dataset.name || '';
  document.getElementById('editSyapDsDetailed').value = dataset.detailed || '';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  document.getElementById('editSyapDsDetailed')?.focus();
}

function closeEditApplicationModal() {
  const modal = document.getElementById('editApplicationModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}

async function submitEditApplication(e) {
  e.preventDefault();
  const id = document.getElementById('editSyapCdSeq')?.value;
  const syapDsDetailed = document.getElementById('editSyapDsDetailed')?.value.trim() || '';
  if (!id) {
    alert('Application ID is missing.');
    return;
  }

  const saveBtn = document.getElementById('saveEditApplicationBtn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const res = await fetch(`${API_APPLICATIONS}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ syapDsDetailed })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to update description');
    }
    alert('Detailed Description updated.');
    closeEditApplicationModal();
    await searchApplications();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Error updating Detailed Description.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  showSection();

  document.getElementById('newApplicationsForm').addEventListener('submit', submitNewApplication);
  document.getElementById('applyApplicationsFiltersBtn').addEventListener('click', searchApplications);
  document.getElementById('clearApplicationsFiltersBtn').addEventListener('click', clearApplicationsFilters);
  document.getElementById('editApplicationForm')?.addEventListener('submit', submitEditApplication);
  document.getElementById('closeEditApplicationModal')?.addEventListener('click', closeEditApplicationModal);
  document.getElementById('cancelEditApplicationBtn')?.addEventListener('click', closeEditApplicationModal);

  const editModal = document.getElementById('editApplicationModal');
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditApplicationModal();
    });
  }

  if (getMode() === 'search') {
    searchApplications();
  }
});
