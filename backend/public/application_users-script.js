const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_FUNCIONARIOS = API_BASE + '/api/funcionarios';
const API_USER_APPLICATIONS = API_BASE + '/api/user-applications';

let availableApps = [];
let selectedApps = [];
let currentUserId = null;

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatApplicationLabel(app) {
  return app.syapDsDetailed || app.syapNmApplication || '-';
}

function sortApps(list) {
  return [...list].sort((a, b) => {
    const labelA = formatApplicationLabel(a).toLowerCase();
    const labelB = formatApplicationLabel(b).toLowerCase();
    if (labelA !== labelB) return labelA.localeCompare(labelB);
    return (a.syapCdSeq || 0) - (b.syapCdSeq || 0);
  });
}

function renderLists() {
  const availableList = document.getElementById('availableList');
  const selectedList = document.getElementById('selectedList');
  const availableCount = document.getElementById('availableCount');
  const selectedCount = document.getElementById('selectedCount');

  if (!availableList || !selectedList) return;

  availableList.innerHTML = sortApps(availableApps).map((app) => `
    <option value="${app.syapCdSeq}">${escapeHtml(formatApplicationLabel(app))}</option>
  `).join('');

  selectedList.innerHTML = sortApps(selectedApps).map((app) => `
    <option value="${app.syapCdSeq}">${escapeHtml(formatApplicationLabel(app))}</option>
  `).join('');

  if (availableCount) availableCount.textContent = `${availableApps.length} application(s)`;
  if (selectedCount) selectedCount.textContent = `${selectedApps.length} application(s)`;
}

function getSelectedOptionValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((opt) => parseInt(opt.value, 10));
}

function moveApps(fromList, toList, ids) {
  if (!ids.length) return;
  const idSet = new Set(ids);
  const moving = fromList.filter((app) => idSet.has(app.syapCdSeq));
  const remaining = fromList.filter((app) => !idSet.has(app.syapCdSeq));
  fromList.length = 0;
  fromList.push(...remaining);
  toList.push(...moving);
}

function moveSelected(fromList, toList, selectEl) {
  const ids = getSelectedOptionValues(selectEl);
  moveApps(fromList, toList, ids);
  renderLists();
}

function moveAll(fromList, toList) {
  toList.push(...fromList);
  fromList.length = 0;
  renderLists();
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
    Object.values(menus).forEach((el) => { if (el) el.setAttribute('aria-hidden', 'true'); });
    Object.values(buttons).forEach((el) => { if (el) el.setAttribute('aria-expanded', 'false'); });
  }

  Object.keys(buttons).forEach((btnId) => {
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

async function loadUsers() {
  const userSelect = document.getElementById('userSelect');
  if (!userSelect) return;

  try {
    const res = await fetch(`${API_FUNCIONARIOS}?ativo=true&ordenarPor=nome&direcao=asc`);
    const data = await res.json();
    const users = (data.success && data.data) ? data.data : [];

    userSelect.innerHTML = '<option value="">Select a user...</option>' + users.map((user) => `
      <option value="${user.id}">${escapeHtml(user.nome)} (${escapeHtml(user.email)})</option>
    `).join('');

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    if (userId && users.some((user) => user.id === userId)) {
      userSelect.value = userId;
      await loadUserApplications(userId);
    }
  } catch (error) {
    console.error(error);
    userSelect.innerHTML = '<option value="">Error loading users</option>';
  }
}

function clearLists() {
  availableApps = [];
  selectedApps = [];
  currentUserId = null;
  renderLists();
}

async function loadUserApplications(funcionarioId) {
  if (!funcionarioId) {
    clearLists();
    return;
  }

  const statusEl = document.getElementById('assignmentStatus');
  if (statusEl) statusEl.textContent = 'Loading applications...';

  try {
    const res = await fetch(`${API_USER_APPLICATIONS}/${encodeURIComponent(funcionarioId)}`);
    const data = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.error || 'Error loading user applications');
    }

    currentUserId = funcionarioId;
    availableApps = data.data.available || [];
    selectedApps = data.data.selected || [];
    renderLists();

    if (statusEl) statusEl.textContent = '';
  } catch (error) {
    console.error(error);
    clearLists();
    if (statusEl) statusEl.textContent = '';
    alert(error.message || 'Error loading user applications.');
  }
}

async function saveUserApplications() {
  if (!currentUserId) {
    alert('Please select a user first.');
    return;
  }

  const saveBtn = document.getElementById('saveUserApplicationsBtn');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const syapCdSeqList = selectedApps.map((app) => app.syapCdSeq);
    const res = await fetch(`${API_USER_APPLICATIONS}/${encodeURIComponent(currentUserId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syapCdSeqList })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error saving user applications');
    }

    availableApps = data.data.available || [];
    selectedApps = data.data.selected || [];
    renderLists();
    alert('User applications saved successfully.');
  } catch (error) {
    console.error(error);
    alert(error.message || 'Error saving user applications.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  loadUsers();

  const userSelect = document.getElementById('userSelect');
  if (userSelect) {
    userSelect.addEventListener('change', (e) => {
      loadUserApplications(e.target.value);
    });
  }

  document.getElementById('addSelectedBtn')?.addEventListener('click', () => {
    moveSelected(availableApps, selectedApps, document.getElementById('availableList'));
  });
  document.getElementById('addAllBtn')?.addEventListener('click', () => {
    moveAll(availableApps, selectedApps);
  });
  document.getElementById('removeSelectedBtn')?.addEventListener('click', () => {
    moveSelected(selectedApps, availableApps, document.getElementById('selectedList'));
  });
  document.getElementById('removeAllBtn')?.addEventListener('click', () => {
    moveAll(selectedApps, availableApps);
  });

  document.getElementById('availableList')?.addEventListener('dblclick', () => {
    moveSelected(availableApps, selectedApps, document.getElementById('availableList'));
  });
  document.getElementById('selectedList')?.addEventListener('dblclick', () => {
    moveSelected(selectedApps, availableApps, document.getElementById('selectedList'));
  });

  document.getElementById('saveUserApplicationsBtn')?.addEventListener('click', saveUserApplications);
});
