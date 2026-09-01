const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_FUNCIONARIOS = API_BASE + '/api/funcionarios';
const API_USER_APPLICATIONS = API_BASE + '/api/user-applications';
const ACCESS_MODE_ALL = 'all';
const ACCESS_MODE_SEARCH = 'search';

let availableApps = [];
let selectedApps = [];
let currentUserId = null;
let loadedUsers = [];
let savedSelectedSnapshot = [];

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatApplicationLabel(app) {
  return app.syapDsDetailed || app.syapNmApplication || '-';
}

function normalizeAccessMode(value) {
  return String(value || '').trim().toLowerCase() === ACCESS_MODE_SEARCH
    ? ACCESS_MODE_SEARCH
    : ACCESS_MODE_ALL;
}

function createAppEntry(app, accessMode = ACCESS_MODE_ALL) {
  return {
    syapCdSeq: app.syapCdSeq,
    syapNmApplication: app.syapNmApplication,
    syapDsDetailed: app.syapDsDetailed,
    accessMode: normalizeAccessMode(accessMode)
  };
}

function sortApps(list) {
  return [...list].sort((a, b) => {
    const labelA = formatApplicationLabel(a).toLowerCase();
    const labelB = formatApplicationLabel(b).toLowerCase();
    if (labelA !== labelB) return labelA.localeCompare(labelB);
    return (a.syapCdSeq || 0) - (b.syapCdSeq || 0);
  });
}

function buildSelectedSnapshot(list) {
  return sortApps(list).map((app) => ({
    syapCdSeq: app.syapCdSeq,
    accessMode: normalizeAccessMode(app.accessMode)
  }));
}

function hasUnsavedChanges() {
  if (!currentUserId) return false;
  const current = buildSelectedSnapshot(selectedApps);
  if (current.length !== savedSelectedSnapshot.length) return true;
  return current.some((item, index) => {
    const saved = savedSelectedSnapshot[index];
    return item.syapCdSeq !== saved.syapCdSeq || item.accessMode !== saved.accessMode;
  });
}

function setAssignmentCardEnabled(enabled) {
  const card = document.getElementById('assignmentCard');
  const saveBtn = document.getElementById('saveUserApplicationsBtn');
  if (card) card.classList.toggle('is-disabled', !enabled);
  if (saveBtn) saveBtn.disabled = !enabled;
}

function showStatus(message, type) {
  const statusEl = document.getElementById('assignmentStatus');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.className = 'app-users-message';
  if (type) statusEl.classList.add(type);
}

function updateSummary() {
  const summaryUserName = document.getElementById('summaryUserName');
  const summaryAvailable = document.getElementById('summaryAvailable');
  const summaryAssigned = document.getElementById('summaryAssigned');
  const summaryStatus = document.getElementById('summaryStatus');
  const dirtyBadge = document.getElementById('appUsersDirtyBadge');
  const saveBtn = document.getElementById('saveUserApplicationsBtn');
  const cancelBtn = document.getElementById('cancelUserApplicationsBtn');

  const selectedUser = loadedUsers.find((user) => user.id === currentUserId);
  const userLabel = selectedUser
    ? `${selectedUser.nome} (${selectedUser.email})`
    : 'No user selected';

  if (summaryUserName) summaryUserName.textContent = userLabel;
  if (summaryAvailable) summaryAvailable.textContent = String(availableApps.length);
  if (summaryAssigned) summaryAssigned.textContent = String(selectedApps.length);

  const dirty = hasUnsavedChanges();
  if (dirtyBadge) dirtyBadge.hidden = !dirty;
  if (saveBtn && currentUserId) saveBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = false;

  if (summaryStatus) {
    summaryStatus.className = 'app-users-status-badge';
    if (!currentUserId) {
      summaryStatus.textContent = 'Select a user';
      summaryStatus.classList.add('idle');
    } else if (dirty) {
      summaryStatus.textContent = 'Unsaved changes';
      summaryStatus.classList.add('unsaved');
    } else {
      summaryStatus.textContent = 'Saved';
      summaryStatus.classList.add('saved');
    }
  }
}

function renderAvailableList() {
  const availableList = document.getElementById('availableList');
  const availableCount = document.getElementById('availableCount');
  if (!availableList) return;

  availableList.innerHTML = sortApps(availableApps).map((app) => `
    <option value="${app.syapCdSeq}">${escapeHtml(formatApplicationLabel(app))}</option>
  `).join('');

  if (availableCount) availableCount.textContent = String(availableApps.length);
}

function renderSelectedList() {
  const selectedList = document.getElementById('selectedList');
  const selectedCount = document.getElementById('selectedCount');
  if (!selectedList) return;

  const sorted = sortApps(selectedApps);
  if (!sorted.length) {
    selectedList.innerHTML = '<div class="app-assigned-empty">No applications assigned yet.</div>';
  } else {
    const rows = sorted.map((app) => {
      const id = app.syapCdSeq;
      const allChecked = normalizeAccessMode(app.accessMode) === ACCESS_MODE_ALL ? 'checked' : '';
      const searchChecked = normalizeAccessMode(app.accessMode) === ACCESS_MODE_SEARCH ? 'checked' : '';
      return `
        <div class="app-assigned-row" data-app-id="${id}">
          <label class="app-assigned-select">
            <input type="checkbox" class="app-assigned-check" value="${id}">
            <span class="app-assigned-name">${escapeHtml(formatApplicationLabel(app))}</span>
          </label>
          <div class="app-access-mode-wrap">
            <span class="app-access-mode-label">All or Search</span>
            <div class="app-access-mode" role="radiogroup" aria-label="All or Search for ${escapeHtml(formatApplicationLabel(app))}">
              <label class="app-access-pill">
                <input type="radio" name="accessMode-${id}" value="${ACCESS_MODE_ALL}" data-app-id="${id}" ${allChecked}>
                <span>All</span>
              </label>
              <label class="app-access-pill">
                <input type="radio" name="accessMode-${id}" value="${ACCESS_MODE_SEARCH}" data-app-id="${id}" ${searchChecked}>
                <span>Search</span>
              </label>
            </div>
          </div>
        </div>`;
    }).join('');

    selectedList.innerHTML = `
      <div class="app-assigned-list-head">
        <span class="app-assigned-col-app">Application</span>
        <span class="app-assigned-col-access">All or Search</span>
      </div>
      <div class="app-assigned-rows">${rows}</div>`;
  }

  if (selectedCount) selectedCount.textContent = String(selectedApps.length);
  bindSelectedListEvents();
  updateSummary();
}

function bindSelectedListEvents() {
  const selectedList = document.getElementById('selectedList');
  if (!selectedList) return;

  selectedList.querySelectorAll('.app-assigned-check').forEach((input) => {
    input.addEventListener('change', () => {
      const row = input.closest('.app-assigned-row');
      if (row) row.classList.toggle('is-selected', input.checked);
    });
  });

  selectedList.querySelectorAll('input[type="radio"][data-app-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const appId = parseInt(input.getAttribute('data-app-id'), 10);
      const app = selectedApps.find((item) => item.syapCdSeq === appId);
      if (app) {
        app.accessMode = normalizeAccessMode(input.value);
        updateSummary();
      }
    });
  });
}

function renderLists() {
  renderAvailableList();
  renderSelectedList();
}

function getSelectedOptionValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((opt) => parseInt(opt.value, 10));
}

function getSelectedAssignedIds() {
  const selectedList = document.getElementById('selectedList');
  if (!selectedList) return [];
  return Array.from(selectedList.querySelectorAll('.app-assigned-check:checked'))
    .map((input) => parseInt(input.value, 10))
    .filter((id) => Number.isInteger(id));
}

function moveApps(fromList, toList, ids) {
  if (!ids.length) return;
  const idSet = new Set(ids);
  const moving = fromList.filter((app) => idSet.has(app.syapCdSeq));
  const remaining = fromList.filter((app) => !idSet.has(app.syapCdSeq));
  fromList.length = 0;
  fromList.push(...remaining);
  toList.push(...moving.map((app) => createAppEntry(app, app.accessMode || ACCESS_MODE_ALL)));
}

function moveSelected(fromList, toList, selectEl) {
  const ids = getSelectedOptionValues(selectEl);
  moveApps(fromList, toList, ids);
  renderLists();
}

function moveSelectedAssignedToAvailable() {
  const ids = getSelectedAssignedIds();
  moveApps(selectedApps, availableApps, ids);
  renderLists();
}

function moveAll(fromList, toList) {
  toList.push(...fromList.map((app) => createAppEntry(app, app.accessMode || ACCESS_MODE_ALL)));
  fromList.length = 0;
  renderLists();
}

async function loadUsers() {
  const userSelect = document.getElementById('userSelect');
  if (!userSelect) return;

  try {
    const res = await fetch(`${API_FUNCIONARIOS}?ativo=true&ordenarPor=nome&direcao=asc`);
    const data = await res.json();
    loadedUsers = (data.success && data.data) ? data.data : [];

    userSelect.innerHTML = '<option value="">Select a user...</option>' + loadedUsers.map((user) => `
      <option value="${user.id}">${escapeHtml(user.nome)} (${escapeHtml(user.email)})</option>
    `).join('');

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    if (userId && loadedUsers.some((user) => user.id === userId)) {
      userSelect.value = userId;
      await loadUserApplications(userId);
    } else {
      updateSummary();
    }

    handleApplicationUsersLandingAction();
  } catch (error) {
    console.error(error);
    userSelect.innerHTML = '<option value="">Error loading users</option>';
    showStatus('Could not load users. Please refresh the page.', 'error');
    handleApplicationUsersLandingAction();
  }
}

function clearLists() {
  availableApps = [];
  selectedApps = [];
  currentUserId = null;
  savedSelectedSnapshot = [];
  setAssignmentCardEnabled(false);
  renderLists();
  showStatus('');
}

async function loadUserApplications(funcionarioId) {
  if (!funcionarioId) {
    clearLists();
    return;
  }

  setAssignmentCardEnabled(true);
  showStatus('Loading applications...', 'info');

  try {
    const res = await fetch(`${API_USER_APPLICATIONS}/${encodeURIComponent(funcionarioId)}`);
    const data = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.error || 'Error loading user applications');
    }

    currentUserId = funcionarioId;
    availableApps = (data.data.available || []).map((app) => createAppEntry(app, ACCESS_MODE_ALL));
    selectedApps = (data.data.selected || []).map((app) => createAppEntry(app, app.accessMode || ACCESS_MODE_ALL));
    savedSelectedSnapshot = buildSelectedSnapshot(selectedApps);
    renderLists();
    showStatus('');
  } catch (error) {
    console.error(error);
    clearLists();
    showStatus(error.message || 'Error loading user applications.', 'error');
  }
}

function focusApplicationUsersPage() {
  const panel = document.getElementById('applicationUsersPanel');
  const userSelect = document.getElementById('userSelect');

  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  requestAnimationFrame(() => {
    userSelect?.focus({ preventScroll: true });
  });
}

function handleApplicationUsersLandingAction() {
  focusApplicationUsersPage();

  const params = new URLSearchParams(window.location.search);
  if (!params.has('user') && window.history && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function closeApplicationUsersPage() {
  window.location.replace('warehouse.html');
}

function cancelUserApplications() {
  closeApplicationUsersPage();
}

async function saveUserApplications() {
  if (!currentUserId) {
    showStatus('Please select a user first.', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveUserApplicationsBtn');
  const cancelBtn = document.getElementById('cancelUserApplicationsBtn');
  if (saveBtn) saveBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;

  try {
    showStatus('Saving assignments...', 'info');
    const assignments = buildSelectedSnapshot(selectedApps);
    const res = await fetch(`${API_USER_APPLICATIONS}/${encodeURIComponent(currentUserId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error saving user applications');
    }

    availableApps = (data.data.available || []).map((app) => createAppEntry(app, ACCESS_MODE_ALL));
    selectedApps = (data.data.selected || []).map((app) => createAppEntry(app, app.accessMode || ACCESS_MODE_ALL));
    savedSelectedSnapshot = buildSelectedSnapshot(selectedApps);
    renderLists();
    showStatus('User applications saved successfully.', 'success');
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Error saving user applications.', 'error');
  } finally {
    if (saveBtn && currentUserId) saveBtn.disabled = false;
    updateSummary();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setAssignmentCardEnabled(false);
  const cancelBtn = document.getElementById('cancelUserApplicationsBtn');
  if (cancelBtn) cancelBtn.disabled = false;
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
    moveSelectedAssignedToAvailable();
  });
  document.getElementById('removeAllBtn')?.addEventListener('click', () => {
    moveAll(selectedApps, availableApps);
  });

  document.getElementById('availableList')?.addEventListener('dblclick', () => {
    moveSelected(availableApps, selectedApps, document.getElementById('availableList'));
  });
  document.getElementById('selectedList')?.addEventListener('dblclick', (event) => {
    if (event.target.closest('.app-access-mode') || event.target.closest('.app-assigned-check')) {
      return;
    }
    moveSelectedAssignedToAvailable();
  });

  document.getElementById('saveUserApplicationsBtn')?.addEventListener('click', saveUserApplications);
  document.getElementById('cancelUserApplicationsBtn')?.addEventListener('click', cancelUserApplications);
});
