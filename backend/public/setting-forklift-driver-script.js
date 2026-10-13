(function () {
  const API = '/api/forklift-drivers';

  let availableUsers = [];
  let assignedUsers = [];
  let savedAssignedIds = [];
  let preferredMessageType = 'SMS';
  let savedPreferredMessageType = 'SMS';
  let allowReassignToOtherDriver = false;
  let savedAllowReassignToOtherDriver = false;
  let waitingTimeoutEnabled = false;
  let savedWaitingTimeoutEnabled = false;
  let waitingTimeoutMinutes = 15;
  let savedWaitingTimeoutMinutes = 15;
  let waitingTimeoutNotifyUserIds = [];
  let savedWaitingTimeoutNotifyUserIds = [];
  let dailyInactiveEnabled = false;
  let savedDailyInactiveEnabled = false;
  let dailyInactiveTime = '15:52';
  let savedDailyInactiveTime = '15:52';
  let notifyRequesterOnComplete = false;
  let savedNotifyRequesterOnComplete = false;

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function normalizeMessageType(value) {
    return String(value || '').trim().toUpperCase() === 'EMAIL' ? 'EMAIL' : 'SMS';
  }

  function normalizeBoolean(value) {
    return value === true || String(value).toLowerCase() === 'true';
  }

  function normalizeMinutes(value, fallback = 15) {
    const n = parseInt(String(value == null ? '' : value).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 1440) return fallback;
    return n;
  }

  function normalizeTimeOfDay(value, fallback = '15:52') {
    const raw = String(value == null ? '' : value).trim();
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
    if (!match) return fallback;
    return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
  }

  function normalizeIdList(list) {
    if (!Array.isArray(list)) return [];
    return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean))).sort();
  }

  function formatUserLabel(user) {
    const name = user?.nome || user?.email || user?.id || '-';
    const email = user?.email ? ` (${user.email})` : '';
    const phone = user?.telefone ? ` · ${user.telefone}` : '';
    return `${name}${email}${phone}`;
  }

  function sortUsers(list) {
    return [...list].sort((a, b) => {
      const nameA = String(a.nome || a.email || '').toLowerCase();
      const nameB = String(b.nome || b.email || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return String(a.email || '').localeCompare(String(b.email || ''));
    });
  }

  function allActiveUsers() {
    const byId = new Map();
    [...availableUsers, ...assignedUsers].forEach((user) => {
      if (user && user.id != null) byId.set(String(user.id), user);
    });
    return sortUsers(Array.from(byId.values()));
  }

  function getSelectedMessageType() {
    const select = document.getElementById('forkliftPreferredMessageType');
    return normalizeMessageType(select?.value || preferredMessageType);
  }

  function getSelectedAllowReassign() {
    const select = document.getElementById('forkliftAllowReassign');
    return normalizeBoolean(select?.value ?? allowReassignToOtherDriver);
  }

  function getSelectedWaitingTimeoutEnabled() {
    const select = document.getElementById('forkliftWaitingTimeoutEnabled');
    return normalizeBoolean(select?.value ?? waitingTimeoutEnabled);
  }

  function getSelectedWaitingTimeoutMinutes() {
    const input = document.getElementById('forkliftWaitingTimeoutMinutes');
    return normalizeMinutes(input?.value, waitingTimeoutMinutes || 15);
  }

  function getSelectedWaitingTimeoutNotifyUserIds() {
    const select = document.getElementById('forkliftWaitingTimeoutNotifyUsers');
    if (!select) return normalizeIdList(waitingTimeoutNotifyUserIds);
    return normalizeIdList(Array.from(select.selectedOptions).map((opt) => opt.value));
  }

  function getSelectedDailyInactiveEnabled() {
    const select = document.getElementById('forkliftDailyInactiveEnabled');
    return normalizeBoolean(select?.value ?? dailyInactiveEnabled);
  }

  function getSelectedDailyInactiveTime() {
    const input = document.getElementById('forkliftDailyInactiveTime');
    return normalizeTimeOfDay(input?.value, dailyInactiveTime || '15:52');
  }

  function getSelectedNotifyRequesterOnComplete() {
    const select = document.getElementById('forkliftNotifyRequesterOnComplete');
    return normalizeBoolean(select?.value ?? notifyRequesterOnComplete);
  }

  function sameIdLists(a, b) {
    const left = normalizeIdList(a);
    const right = normalizeIdList(b);
    if (left.length !== right.length) return false;
    return left.every((id, index) => id === right[index]);
  }

  function hasUnsavedChanges() {
    const current = sortUsers(assignedUsers).map((u) => String(u.id));
    if (getSelectedMessageType() !== savedPreferredMessageType) return true;
    if (getSelectedAllowReassign() !== savedAllowReassignToOtherDriver) return true;
    if (getSelectedWaitingTimeoutEnabled() !== savedWaitingTimeoutEnabled) return true;
    if (getSelectedWaitingTimeoutMinutes() !== savedWaitingTimeoutMinutes) return true;
    if (!sameIdLists(getSelectedWaitingTimeoutNotifyUserIds(), savedWaitingTimeoutNotifyUserIds)) return true;
    if (getSelectedDailyInactiveEnabled() !== savedDailyInactiveEnabled) return true;
    if (getSelectedDailyInactiveTime() !== savedDailyInactiveTime) return true;
    if (getSelectedNotifyRequesterOnComplete() !== savedNotifyRequesterOnComplete) return true;
    if (current.length !== savedAssignedIds.length) return true;
    return current.some((id, index) => id !== savedAssignedIds[index]);
  }

  function showStatus(message, type) {
    const statusEl = document.getElementById('assignmentStatus');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = 'app-users-message';
    if (type) statusEl.classList.add(type);
  }

  function syncWaitingTimeoutOptionsVisibility() {
    const options = document.getElementById('waitingTimeoutOptions');
    const enabled = getSelectedWaitingTimeoutEnabled();
    if (options) options.style.display = enabled ? 'flex' : 'none';
  }

  function syncDailyInactiveOptionsVisibility() {
    const options = document.getElementById('dailyInactiveOptions');
    const enabled = getSelectedDailyInactiveEnabled();
    if (options) options.style.display = enabled ? 'flex' : 'none';
  }

  function renderNotifyUsersSelect(selectedIds) {
    const select = document.getElementById('forkliftWaitingTimeoutNotifyUsers');
    if (!select) return;
    const selected = new Set(normalizeIdList(selectedIds));
    select.innerHTML = allActiveUsers().map((user) =>
      `<option value="${escapeHtml(user.id)}"${selected.has(String(user.id)) ? ' selected' : ''}>${escapeHtml(formatUserLabel(user))}</option>`
    ).join('');
  }

  function updateSummary() {
    const summaryAvailable = document.getElementById('summaryAvailable');
    const summaryAssigned = document.getElementById('summaryAssigned');
    const summarySendBy = document.getElementById('summarySendBy');
    const summaryCanReassign = document.getElementById('summaryCanReassign');
    const summaryWaitingTimeout = document.getElementById('summaryWaitingTimeout');
    const summaryDailyInactive = document.getElementById('summaryDailyInactive');
    const summaryNotifyOnComplete = document.getElementById('summaryNotifyOnComplete');
    const summaryStatus = document.getElementById('summaryStatus');
    const dirtyBadge = document.getElementById('forkliftDirtyBadge');

    if (summaryAvailable) summaryAvailable.textContent = String(availableUsers.length);
    if (summaryAssigned) summaryAssigned.textContent = String(assignedUsers.length);
    if (summarySendBy) summarySendBy.textContent = getSelectedMessageType();
    if (summaryCanReassign) summaryCanReassign.textContent = getSelectedAllowReassign() ? 'Yes' : 'No';
    if (summaryWaitingTimeout) {
      if (getSelectedWaitingTimeoutEnabled()) {
        const count = getSelectedWaitingTimeoutNotifyUserIds().length;
        summaryWaitingTimeout.textContent = `${getSelectedWaitingTimeoutMinutes()} min · ${count} user(s)`;
      } else {
        summaryWaitingTimeout.textContent = 'Off';
      }
    }
    if (summaryDailyInactive) {
      summaryDailyInactive.textContent = getSelectedDailyInactiveEnabled()
        ? `After ${getSelectedDailyInactiveTime()}`
        : 'Off';
    }
    if (summaryNotifyOnComplete) {
      summaryNotifyOnComplete.textContent = getSelectedNotifyRequesterOnComplete() ? 'Yes' : 'No';
    }

    const dirty = hasUnsavedChanges();
    if (dirtyBadge) dirtyBadge.hidden = !dirty;

    if (summaryStatus) {
      summaryStatus.className = 'app-users-status-badge';
      if (dirty) {
        summaryStatus.textContent = 'Unsaved changes';
        summaryStatus.classList.add('unsaved');
      } else {
        summaryStatus.textContent = 'Saved';
        summaryStatus.classList.add('saved');
      }
    }
  }

  function renderList(selectId, users, countId) {
    const selectEl = document.getElementById(selectId);
    const countEl = document.getElementById(countId);
    if (!selectEl) return;
    selectEl.innerHTML = sortUsers(users).map((user) =>
      `<option value="${escapeHtml(user.id)}">${escapeHtml(formatUserLabel(user))}</option>`
    ).join('');
    if (countEl) countEl.textContent = String(users.length);
  }

  function renderLists() {
    const notifySelected = getSelectedWaitingTimeoutNotifyUserIds().length
      ? getSelectedWaitingTimeoutNotifyUserIds()
      : waitingTimeoutNotifyUserIds;
    renderList('availableList', availableUsers, 'availableCount');
    renderList('selectedList', assignedUsers, 'selectedCount');
    renderNotifyUsersSelect(notifySelected);
    syncWaitingTimeoutOptionsVisibility();
    syncDailyInactiveOptionsVisibility();
    updateSummary();
  }

  function getSelectedIds(selectEl) {
    if (!selectEl) return [];
    return Array.from(selectEl.selectedOptions).map((opt) => opt.value);
  }

  function moveUsers(fromList, toList, ids) {
    if (!ids.length) return;
    const idSet = new Set(ids.map(String));
    const moving = fromList.filter((user) => idSet.has(String(user.id)));
    const remaining = fromList.filter((user) => !idSet.has(String(user.id)));
    fromList.length = 0;
    fromList.push(...remaining);
    toList.push(...moving);
  }

  function moveSelected(fromList, toList, selectId) {
    const ids = getSelectedIds(document.getElementById(selectId));
    moveUsers(fromList, toList, ids);
    renderLists();
  }

  function moveAll(fromList, toList) {
    toList.push(...fromList);
    fromList.length = 0;
    renderLists();
  }

  function applyData(data) {
    availableUsers = Array.isArray(data?.available) ? data.available.slice() : [];
    assignedUsers = Array.isArray(data?.assigned) ? data.assigned.slice() : [];
    preferredMessageType = normalizeMessageType(data?.preferredMessageType || 'SMS');
    savedPreferredMessageType = preferredMessageType;
    allowReassignToOtherDriver = normalizeBoolean(data?.allowReassignToOtherDriver);
    savedAllowReassignToOtherDriver = allowReassignToOtherDriver;
    waitingTimeoutEnabled = normalizeBoolean(data?.waitingTimeoutEnabled);
    savedWaitingTimeoutEnabled = waitingTimeoutEnabled;
    waitingTimeoutMinutes = normalizeMinutes(data?.waitingTimeoutMinutes, 15);
    savedWaitingTimeoutMinutes = waitingTimeoutMinutes;
    waitingTimeoutNotifyUserIds = normalizeIdList(data?.waitingTimeoutNotifyUserIds);
    savedWaitingTimeoutNotifyUserIds = waitingTimeoutNotifyUserIds.slice();
    dailyInactiveEnabled = normalizeBoolean(data?.dailyInactiveEnabled);
    savedDailyInactiveEnabled = dailyInactiveEnabled;
    dailyInactiveTime = normalizeTimeOfDay(data?.dailyInactiveTime, '15:52');
    savedDailyInactiveTime = dailyInactiveTime;
    notifyRequesterOnComplete = normalizeBoolean(data?.notifyRequesterOnComplete);
    savedNotifyRequesterOnComplete = notifyRequesterOnComplete;
    savedAssignedIds = sortUsers(assignedUsers).map((u) => String(u.id));

    const typeSelect = document.getElementById('forkliftPreferredMessageType');
    if (typeSelect) typeSelect.value = preferredMessageType;
    const reassignSelect = document.getElementById('forkliftAllowReassign');
    if (reassignSelect) reassignSelect.value = allowReassignToOtherDriver ? 'true' : 'false';
    const timeoutEnabledSelect = document.getElementById('forkliftWaitingTimeoutEnabled');
    if (timeoutEnabledSelect) timeoutEnabledSelect.value = waitingTimeoutEnabled ? 'true' : 'false';
    const minutesInput = document.getElementById('forkliftWaitingTimeoutMinutes');
    if (minutesInput) minutesInput.value = String(waitingTimeoutMinutes);
    const dailyEnabledSelect = document.getElementById('forkliftDailyInactiveEnabled');
    if (dailyEnabledSelect) dailyEnabledSelect.value = dailyInactiveEnabled ? 'true' : 'false';
    const dailyTimeInput = document.getElementById('forkliftDailyInactiveTime');
    if (dailyTimeInput) dailyTimeInput.value = dailyInactiveTime;
    const notifyOnCompleteSelect = document.getElementById('forkliftNotifyRequesterOnComplete');
    if (notifyOnCompleteSelect) notifyOnCompleteSelect.value = notifyRequesterOnComplete ? 'true' : 'false';

    renderLists();
    renderNotifyUsersSelect(waitingTimeoutNotifyUserIds);
    syncWaitingTimeoutOptionsVisibility();
    syncDailyInactiveOptionsVisibility();
    updateSummary();
  }

  async function loadAssignments() {
    showStatus('Loading users...', 'info');
    try {
      const res = await fetch(API, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to load forklift drivers');
      }
      applyData(data.data);
      showStatus('');
    } catch (error) {
      console.error(error);
      availableUsers = [];
      assignedUsers = [];
      savedAssignedIds = [];
      preferredMessageType = 'SMS';
      savedPreferredMessageType = 'SMS';
      allowReassignToOtherDriver = false;
      savedAllowReassignToOtherDriver = false;
      waitingTimeoutEnabled = false;
      savedWaitingTimeoutEnabled = false;
      waitingTimeoutMinutes = 15;
      savedWaitingTimeoutMinutes = 15;
      waitingTimeoutNotifyUserIds = [];
      savedWaitingTimeoutNotifyUserIds = [];
      dailyInactiveEnabled = false;
      savedDailyInactiveEnabled = false;
      dailyInactiveTime = '15:52';
      savedDailyInactiveTime = '15:52';
      notifyRequesterOnComplete = false;
      savedNotifyRequesterOnComplete = false;
      renderLists();
      showStatus(error.message || 'Error loading forklift drivers.', 'error');
    }
  }

  async function saveAssignments() {
    const saveBtn = document.getElementById('saveForkliftDriversBtn');
    if (saveBtn) saveBtn.disabled = true;
    try {
      const preferredMessageTypeValue = getSelectedMessageType();
      const allowReassignValue = getSelectedAllowReassign();
      const waitingTimeoutEnabledValue = getSelectedWaitingTimeoutEnabled();
      const waitingTimeoutMinutesValue = getSelectedWaitingTimeoutMinutes();
      const waitingTimeoutNotifyUserIdsValue = getSelectedWaitingTimeoutNotifyUserIds();
      const dailyInactiveEnabledValue = getSelectedDailyInactiveEnabled();
      const dailyInactiveTimeValue = getSelectedDailyInactiveTime();
      const notifyRequesterOnCompleteValue = getSelectedNotifyRequesterOnComplete();

      if (waitingTimeoutEnabledValue) {
        if (!waitingTimeoutMinutesValue) {
          throw new Error('Enter waiting time in minutes');
        }
        if (!waitingTimeoutNotifyUserIdsValue.length) {
          throw new Error('Select at least one user to receive the Waiting for driver timeout message');
        }
      }

      if (dailyInactiveEnabledValue && !dailyInactiveTimeValue) {
        throw new Error('Enter the daily inactive cutoff time');
      }

      showStatus('Saving assignments...', 'info');
      const assignedIds = assignedUsers.map((user) => user.id);
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignedIds,
          preferredMessageType: preferredMessageTypeValue,
          allowReassignToOtherDriver: allowReassignValue,
          waitingTimeoutEnabled: waitingTimeoutEnabledValue,
          waitingTimeoutMinutes: waitingTimeoutMinutesValue,
          waitingTimeoutNotifyUserIds: waitingTimeoutNotifyUserIdsValue,
          dailyInactiveEnabled: dailyInactiveEnabledValue,
          dailyInactiveTime: dailyInactiveTimeValue,
          notifyRequesterOnComplete: notifyRequesterOnCompleteValue
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error saving assignments');
      }
      applyData(data.data);
      showStatus('Forklift driver settings saved successfully.', 'success');
      alert('The assignment information has been saved successfully.');
    } catch (error) {
      console.error(error);
      showStatus(error.message || 'Error saving assignments.', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      updateSummary();
    }
  }

  function closePage() {
    window.location.replace('warehouse.html');
  }

  function revealForkliftDriverScreen() {
    const panel = document.getElementById('forkliftDriversPanel');
    const actions = document.getElementById('forkliftDriversActions');
    if (!panel && !actions) return;

    if (panel) {
      const offset = 8;
      const top = panel.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }

    if (actions) {
      const rect = actions.getBoundingClientRect();
      const bottomGap = 16;
      if (rect.bottom > window.innerHeight - bottomGap) {
        window.scrollBy({
          top: rect.bottom - window.innerHeight + bottomGap,
          behavior: 'auto'
        });
      } else if (rect.top < 8) {
        window.scrollBy({ top: rect.top - 8, behavior: 'auto' });
      }
    }

    document.getElementById('availableList')?.focus({ preventScroll: true });
  }

  function scheduleRevealForkliftDriverScreen() {
    requestAnimationFrame(() => {
      revealForkliftDriverScreen();
      setTimeout(revealForkliftDriverScreen, 50);
      setTimeout(revealForkliftDriverScreen, 200);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    scheduleRevealForkliftDriverScreen();
    window.addEventListener('load', revealForkliftDriverScreen, { once: true });
    loadAssignments().finally(() => {
      scheduleRevealForkliftDriverScreen();
    });

    document.getElementById('forkliftPreferredMessageType')?.addEventListener('change', updateSummary);
    document.getElementById('forkliftAllowReassign')?.addEventListener('change', updateSummary);
    document.getElementById('forkliftWaitingTimeoutEnabled')?.addEventListener('change', () => {
      syncWaitingTimeoutOptionsVisibility();
      updateSummary();
    });
    document.getElementById('forkliftWaitingTimeoutMinutes')?.addEventListener('input', updateSummary);
    document.getElementById('forkliftWaitingTimeoutNotifyUsers')?.addEventListener('change', updateSummary);
    document.getElementById('forkliftDailyInactiveEnabled')?.addEventListener('change', () => {
      syncDailyInactiveOptionsVisibility();
      updateSummary();
    });
    document.getElementById('forkliftDailyInactiveTime')?.addEventListener('change', updateSummary);
    document.getElementById('forkliftDailyInactiveTime')?.addEventListener('input', updateSummary);
    document.getElementById('forkliftNotifyRequesterOnComplete')?.addEventListener('change', updateSummary);

    document.getElementById('addSelectedBtn')?.addEventListener('click', () => {
      moveSelected(availableUsers, assignedUsers, 'availableList');
    });
    document.getElementById('addAllBtn')?.addEventListener('click', () => {
      moveAll(availableUsers, assignedUsers);
    });
    document.getElementById('removeSelectedBtn')?.addEventListener('click', () => {
      moveSelected(assignedUsers, availableUsers, 'selectedList');
    });
    document.getElementById('removeAllBtn')?.addEventListener('click', () => {
      moveAll(assignedUsers, availableUsers);
    });

    document.getElementById('availableList')?.addEventListener('dblclick', () => {
      moveSelected(availableUsers, assignedUsers, 'availableList');
    });
    document.getElementById('selectedList')?.addEventListener('dblclick', () => {
      moveSelected(assignedUsers, availableUsers, 'selectedList');
    });

    document.getElementById('saveForkliftDriversBtn')?.addEventListener('click', saveAssignments);
    document.getElementById('cancelForkliftDriversBtn')?.addEventListener('click', () => {
      if (hasUnsavedChanges() && !confirm('Discard unsaved changes?')) return;
      loadAssignments();
    });
    document.getElementById('closeForkliftDriversBtn')?.addEventListener('click', () => {
      if (hasUnsavedChanges() && !confirm('Discard unsaved changes and close?')) return;
      closePage();
    });
  });
})();
