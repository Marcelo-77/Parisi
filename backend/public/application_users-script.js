const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_FUNCIONARIOS = API_BASE + '/api/funcionarios';
const API_USER_APPLICATIONS = API_BASE + '/api/user-applications';

let availableApps = [];
let selectedApps = [];
let currentUserId = null;
let loadedUsers = [];
let savedSelectedIds = [];

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

function getSelectedIds(list) {
  return sortApps(list).map((app) => app.syapCdSeq);
}

function hasUnsavedChanges() {
  if (!currentUserId) return false;
  const current = getSelectedIds(selectedApps);
  if (current.length !== savedSelectedIds.length) return true;
  return current.some((id, index) => id !== savedSelectedIds[index]);
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
  const userSelect = document.getElementById('userSelect');
  const summaryUserName = document.getElementById('summaryUserName');
  const summaryAvailable = document.getElementById('summaryAvailable');
  const summaryAssigned = document.getElementById('summaryAssigned');
  const summaryStatus = document.getElementById('summaryStatus');
  const dirtyBadge = document.getElementById('appUsersDirtyBadge');
  const saveBtn = document.getElementById('saveUserApplicationsBtn');

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

  if (availableCount) availableCount.textContent = String(availableApps.length);
  if (selectedCount) selectedCount.textContent = String(selectedApps.length);

  updateSummary();
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
  } catch (error) {
    console.error(error);
    userSelect.innerHTML = '<option value="">Error loading users</option>';
    showStatus('Could not load users. Please refresh the page.', 'error');
  }
}

function clearLists() {
  availableApps = [];
  selectedApps = [];
  currentUserId = null;
  savedSelectedIds = [];
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
    availableApps = data.data.available || [];
    selectedApps = data.data.selected || [];
    savedSelectedIds = getSelectedIds(selectedApps);
    renderLists();
    showStatus('');
  } catch (error) {
    console.error(error);
    clearLists();
    showStatus(error.message || 'Error loading user applications.', 'error');
  }
}

async function saveUserApplications() {
  if (!currentUserId) {
    showStatus('Please select a user first.', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveUserApplicationsBtn');
  if (saveBtn) saveBtn.disabled = true;

  try {
    showStatus('Saving assignments...', 'info');
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
    savedSelectedIds = getSelectedIds(selectedApps);
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
