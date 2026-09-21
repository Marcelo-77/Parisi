(function () {
  const API = '/api/message-request';
  const USERS_API = '/api/funcionarios';

  const els = {
    requestNumber: document.getElementById('searchRequestNumber'),
    status: document.getElementById('searchStatus'),
    messageType: document.getElementById('searchMessageType'),
    priority: document.getElementById('searchPriority'),
    subject: document.getElementById('searchSubject'),
    createdByName: document.getElementById('searchCreatedByName'),
    assignedToName: document.getElementById('searchAssignedToName'),
    recipientEmail: document.getElementById('searchRecipientEmail'),
    applyBtn: document.getElementById('applySearchBtn'),
    clearBtn: document.getElementById('clearSearchBtn'),
    tableBody: document.getElementById('requestSearchTableBody'),
    resultsCount: document.getElementById('resultsCount'),
    resultsTime: document.getElementById('resultsTime'),
    loading: document.getElementById('loadingIndicator'),
    noResults: document.getElementById('noResults'),
    modal: document.getElementById('requestModal'),
    requestId: document.getElementById('requestId'),
    statusMsg: document.getElementById('requestStatusMsg'),
    assignOperator: document.getElementById('assignOperator'),
    approvePanel: document.getElementById('approvePanel'),
    rejectPanel: document.getElementById('rejectPanel'),
    holdPanel: document.getElementById('holdPanel'),
    sendPanel: document.getElementById('sendPanel'),
    forkliftResponsePanel: document.getElementById('forkliftResponsePanel'),
    forkliftClaimPanel: document.getElementById('forkliftClaimPanel'),
    forkliftPendingRequestPanel: document.getElementById('forkliftPendingRequestPanel'),
    forkliftPendingDriver: document.getElementById('forkliftPendingDriver'),
    forkliftClaimDriver: document.getElementById('forkliftClaimDriver'),
    forkliftNewStatus: document.getElementById('forkliftNewStatus'),
    forkliftNoteGroup: document.getElementById('forkliftNoteGroup'),
    forkliftNoteToRequester: document.getElementById('forkliftNoteToRequester')
  };

  let operators = [];
  let forkliftDrivers = [];
  let isForkliftDriver = false;
  let allowReassignToOtherDriver = false;
  let current = null;
  let sessionUser = null;
  let openAsForkliftEdit = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function statusLabel(status) {
    const map = {
      PENDING: 'Pending',
      UNDER_REVIEW: 'Under Review',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      ON_HOLD: 'On Hold',
      WAITING_FOR_DRIVER: 'Waiting for driver for request',
      FORKLIFT_DRIVER_SELECTED: 'Forklift driver request selected'
    };
    return map[String(status || '').toUpperCase()] || status || '-';
  }

  function statusClass(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'UNDER_REVIEW') return 'status-under-review';
    if (value === 'IN_PROGRESS') return 'status-in-progress';
    if (value === 'COMPLETED') return 'status-completed';
    if (value === 'CANCELLED') return 'status-cancelled';
    if (value === 'ON_HOLD') return 'status-on-hold';
    if (value === 'WAITING_FOR_DRIVER') return 'status-waiting-driver';
    if (value === 'FORKLIFT_DRIVER_SELECTED') return 'status-forklift';
    return 'status-pending';
  }

  function canRespondForkliftRequest(row) {
    if (!row) return false;
    if (String(row.status || '').toUpperCase() !== 'FORKLIFT_DRIVER_SELECTED') return false;
    if (!sessionUser || !sessionUser.id) return false;
    if (sessionUser.isRoot) return true;
    return String(row.assignedTo || '') === String(sessionUser.id);
  }

  function canClaimWaitingForkliftRequest(row) {
    if (!row) return false;
    if (String(row.status || '').toUpperCase() !== 'WAITING_FOR_DRIVER') return false;
    if (!sessionUser || !sessionUser.id) return false;
    if (sessionUser.isRoot) return true;
    return !!isForkliftDriver;
  }

  function canEditPendingForkliftRequest(row) {
    if (!row) return false;
    return String(row.status || '').toUpperCase() === 'PENDING';
  }

  function canEditForkliftRequest(row) {
    return canEditPendingForkliftRequest(row)
      || canRespondForkliftRequest(row)
      || canClaimWaitingForkliftRequest(row);
  }

  async function loadSessionUser() {
    try {
      const res = await fetch('/api/auth/check', { credentials: 'include' });
      const data = await res.json();
      sessionUser = (data.authenticated && data.user) ? data.user : null;
    } catch (_) {
      sessionUser = null;
    }
  }

  function fillClaimDriverOptions() {
    if (!els.forkliftClaimDriver) return;
    const allowAll = !!allowReassignToOtherDriver || !!(sessionUser && sessionUser.isRoot);
    let options = forkliftDrivers.slice();
    if (!allowAll && sessionUser?.id) {
      options = forkliftDrivers.filter((u) => String(u.id) === String(sessionUser.id));
    }
    els.forkliftClaimDriver.innerHTML = '<option value="">Select forklift driver...</option>'
      + options.map((u) => {
        const id = u.id || '';
        const name = u.nome || u.email || id;
        return '<option value="' + escapeHtml(id) + '">' + escapeHtml(name) + '</option>';
      }).join('');
    if (sessionUser?.id && options.some((u) => String(u.id) === String(sessionUser.id))) {
      els.forkliftClaimDriver.value = sessionUser.id;
    } else if (!allowAll && options.length === 1) {
      els.forkliftClaimDriver.value = options[0].id;
    }
    els.forkliftClaimDriver.disabled = !allowAll && options.length <= 1;
  }

  function fillPendingDriverOptions() {
    if (!els.forkliftPendingDriver) return;
    const notDefinedOption = '<option value="__NOT_DEFINED__">~Driver not defined</option>';
    if (!forkliftDrivers.length) {
      els.forkliftPendingDriver.innerHTML = '<option value="">No forklift drivers available</option>' + notDefinedOption;
      els.forkliftPendingDriver.value = '__NOT_DEFINED__';
      return;
    }
    els.forkliftPendingDriver.innerHTML = '<option value="">Select forklift driver...</option>'
      + notDefinedOption
      + forkliftDrivers.map((u) => {
        const id = u.id || '';
        const name = u.nome || u.email || id;
        return '<option value="' + escapeHtml(id) + '">' + escapeHtml(name) + '</option>';
      }).join('');
    els.forkliftPendingDriver.value = '__NOT_DEFINED__';
  }

  async function loadForkliftDrivers() {
    try {
      const res = await fetch('/api/forklift-drivers/assigned', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        forkliftDrivers = [];
        isForkliftDriver = false;
        allowReassignToOtherDriver = false;
        return;
      }
      forkliftDrivers = data.data || [];
      allowReassignToOtherDriver = !!data.allowReassignToOtherDriver;
      isForkliftDriver = !!data.isForkliftDriver
        || !!(sessionUser && forkliftDrivers.some((u) => String(u.id) === String(sessionUser.id)));
      fillClaimDriverOptions();
    } catch (err) {
      console.error(err);
      forkliftDrivers = [];
      isForkliftDriver = false;
      allowReassignToOtherDriver = false;
    }
  }

  function syncForkliftNoteVisibility() {
    const status = String(els.forkliftNewStatus?.value || 'COMPLETED').toUpperCase();
    const showNote = status === 'PENDING' || status === 'CANCELLED';
    if (els.forkliftNoteGroup) {
      els.forkliftNoteGroup.classList.toggle('is-hidden', !showNote);
    }
    if (els.forkliftNoteToRequester) {
      els.forkliftNoteToRequester.required = showNote;
      if (!showNote) els.forkliftNoteToRequester.value = '';
    }
  }

  function showMsg(text, type) {
    if (!els.statusMsg) return;
    els.statusMsg.textContent = text || '';
    els.statusMsg.className = 'message-email-message' + (text ? (' show ' + (type || 'info')) : '');
  }

  function setPanel(panel, visible) {
    if (!panel) return;
    panel.classList.toggle('is-visible', !!visible);
  }

  function buildParams() {
    const params = new URLSearchParams();
    if (els.requestNumber?.value) params.set('requestNumber', els.requestNumber.value);
    if (els.status?.value) params.set('status', els.status.value);
    if (els.messageType?.value) params.set('messageType', els.messageType.value);
    if (els.priority?.value) params.set('priority', els.priority.value);
    if (els.subject?.value.trim()) params.set('subject', els.subject.value.trim());
    if (els.createdByName?.value.trim()) params.set('createdByName', els.createdByName.value.trim());
    if (els.assignedToName?.value.trim()) params.set('assignedToName', els.assignedToName.value.trim());
    if (els.recipientEmail?.value.trim()) params.set('recipientEmail', els.recipientEmail.value.trim());
    return params;
  }

  async function loadOperators() {
    try {
      const res = await fetch(USERS_API + '?ativo=true&ordenarPor=nome&direcao=asc', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) return;
      operators = data.data || [];
      if (!els.assignOperator) return;
      els.assignOperator.innerHTML = '<option value="">Select operator...</option>'
        + operators.map((u) => {
          const id = u.id || '';
          const name = u.nome || u.email || id;
          return '<option value="' + escapeHtml(id) + '">' + escapeHtml(name) + '</option>';
        }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  async function runSearch() {
    try {
      if (els.loading) els.loading.style.display = 'block';
      if (els.noResults) els.noResults.style.display = 'none';
      if (els.resultsCount) els.resultsCount.textContent = 'Loading...';

      const startedAt = Date.now();
      const params = buildParams();
      const url = params.toString() ? (API + '?' + params.toString()) : API;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load requests');
      }

      const list = data.data || [];
      if (els.resultsCount) {
        els.resultsCount.textContent = list.length + ' request' + (list.length !== 1 ? 's' : '');
      }
      if (els.resultsTime) {
        els.resultsTime.textContent = '(' + ((Date.now() - startedAt) / 1000).toFixed(2) + 's)';
      }

      if (!els.tableBody) return;
      if (!list.length) {
        els.tableBody.innerHTML = '';
        if (els.noResults) els.noResults.style.display = 'block';
        return;
      }

      if (els.noResults) els.noResults.style.display = 'none';
      els.tableBody.innerHTML = list.map((row) => {
        const id = row.id || '';
        const canEdit = canEditForkliftRequest(row);
        const statusUpper = String(row.status || '').toUpperCase();
        const waitingAlert = (statusUpper === 'WAITING_FOR_DRIVER' || statusUpper === 'PENDING')
          ? ' waiting-driver-alert'
          : '';
        return '<tr class="item-data-row' + waitingAlert + '" data-id="' + escapeHtml(id) + '">'
          + '<td><strong>#' + escapeHtml(row.requestNumber || '-') + '</strong></td>'
          + '<td>' + escapeHtml(row.messageType || '-') + '</td>'
          + '<td>' + escapeHtml(row.subject || '-') + '</td>'
          + '<td>' + escapeHtml(row.priority || '-') + '</td>'
          + '<td class="' + statusClass(row.status) + '">' + escapeHtml(statusLabel(row.status)) + '</td>'
          + '<td>' + escapeHtml(row.createdByName || '-') + '</td>'
          + '<td>' + escapeHtml(row.assignedToName || '-') + '</td>'
          + '<td>' + escapeHtml(formatDate(row.criadoEm)) + '</td>'
          + '</tr>'
          + '<tr class="item-actions-row' + waitingAlert + '" data-id="' + escapeHtml(id) + '">'
          + '<td colspan="8" class="action-buttons-cell">'
          + '<div class="action-buttons">'
          + '<button type="button" class="btn-action view open-request-btn" data-id="' + escapeHtml(id) + '" title="Open">'
          + '<i class="fas fa-eye"></i> <span>Open</span></button>'
          + '<button type="button" class="btn-action edit edit-forklift-btn" data-id="' + escapeHtml(id) + '"'
          + (canEdit ? '' : ' disabled aria-disabled="true"')
          + ' title="' + (canEdit
            ? 'Edit request'
            : 'Edit available for Pending, Waiting for driver (forklift drivers), or assigned driver') + '">'
          + '<i class="fas fa-edit"></i> <span>Edit</span></button>'
          + '</div></td></tr>';
      }).join('');
    } catch (err) {
      alert(err.message || 'Search failed');
    } finally {
      if (els.loading) els.loading.style.display = 'none';
    }
  }

  function fillModal(item) {
    current = item;
    els.requestId.value = item.id;
    document.getElementById('viewRequestNumber').value = item.requestNumber || '';
    document.getElementById('viewStatus').value = statusLabel(item.status);
    document.getElementById('viewPriority').value = item.priority || '';
    document.getElementById('viewMessageType').value = item.messageType || '';
    document.getElementById('viewCreatedByName').value = item.createdByName || '';
    document.getElementById('viewAssignedToName').value = item.assignedToName || '';
    document.getElementById('viewRecipientName').value = item.recipientName || '';
    document.getElementById('viewRecipientEmail').value = item.recipientEmail || '';
    const phoneEl = document.getElementById('viewRecipientPhone');
    if (phoneEl) phoneEl.value = item.recipientPhone || '';
    document.getElementById('viewSubject').value = item.subject || '';
    document.getElementById('viewMessageContent').value = item.messageContent || '';
    document.getElementById('requestHistory').textContent = item.requestHistory || '(no history)';
    document.getElementById('rejectionReason').value = '';
    document.getElementById('holdNote').value = '';
    document.getElementById('finalSubject').value = item.finalSubject || item.subject || '';
    document.getElementById('finalContent').value = item.finalContent || item.messageContent || '';
    if (item.assignedTo && els.assignOperator) {
      els.assignOperator.value = item.assignedTo;
    }
    if (els.forkliftNoteToRequester) els.forkliftNoteToRequester.value = '';
    if (els.forkliftNewStatus) els.forkliftNewStatus.value = 'COMPLETED';
    if (els.forkliftPendingDriver) els.forkliftPendingDriver.value = '__NOT_DEFINED__';
    syncForkliftNoteVisibility();

    const status = String(item.status || '').toUpperCase();
    const type = String(item.messageType || '').toUpperCase();
    const sendLabel = document.getElementById('sendBtnLabel');
    if (sendLabel) {
      if (type === 'SMS') sendLabel.textContent = 'Send SMS & Complete';
      else if (type === 'WHATSAPP') sendLabel.textContent = 'Mark WhatsApp Sent & Complete';
      else sendLabel.textContent = 'Send Email & Complete';
    }
    // Keep approve/reject only for legacy Under Review rows (not Pending).
    setPanel(els.approvePanel, status === 'UNDER_REVIEW');
    setPanel(els.rejectPanel, status === 'UNDER_REVIEW');
    setPanel(els.holdPanel, status === 'IN_PROGRESS' || status === 'ON_HOLD');
    setPanel(els.sendPanel, status === 'IN_PROGRESS' || status === 'ON_HOLD');
    const showForkliftRespond = openAsForkliftEdit && canRespondForkliftRequest(item);
    const showForkliftClaim = openAsForkliftEdit && canClaimWaitingForkliftRequest(item);
    const showPendingForkliftRequest = status === 'PENDING';
    setPanel(els.forkliftResponsePanel, showForkliftRespond);
    setPanel(els.forkliftClaimPanel, showForkliftClaim);
    setPanel(els.forkliftPendingRequestPanel, showPendingForkliftRequest);
    const footer = document.getElementById('requestModalFooter');
    if (footer) footer.style.display = showForkliftRespond ? 'none' : '';
    if (showForkliftClaim) {
      fillClaimDriverOptions();
    }
    if (showPendingForkliftRequest) {
      fillPendingDriverOptions();
    }
    document.getElementById('holdBtn').style.display = status === 'ON_HOLD' ? 'none' : '';
    document.getElementById('resumeBtn').style.display = status === 'ON_HOLD' ? '' : 'none';
    showMsg('');
  }

  function openModal() {
    if (!els.modal) return;
    els.modal.classList.add('show');
    els.modal.style.display = 'flex';
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.remove('show');
    els.modal.style.display = 'none';
    els.modal.setAttribute('aria-hidden', 'true');
    current = null;
    openAsForkliftEdit = false;
  }

  async function openRequest(id, asEdit) {
    openAsForkliftEdit = !!asEdit;
    try {
      const res = await fetch(API + '/' + encodeURIComponent(id), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load request');
      if (openAsForkliftEdit && !canEditForkliftRequest(data.data)) {
        openAsForkliftEdit = false;
        alert('Edit is available for Pending requests, registered forklift drivers (Waiting for driver), or the assigned driver (Forklift driver request selected).');
        return;
      }
      fillModal(data.data);
      openModal();
    } catch (err) {
      openAsForkliftEdit = false;
      alert(err.message || 'Error opening request');
    }
  }

  async function postAction(path, body) {
    const res = await fetch(API + '/' + encodeURIComponent(els.requestId.value) + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Action failed');
    return data;
  }

  document.getElementById('approveBtn')?.addEventListener('click', async () => {
    const assignedTo = els.assignOperator?.value;
    if (!assignedTo) {
      showMsg('Select an operator to assign.', 'error');
      return;
    }
    const selected = operators.find((u) => String(u.id) === String(assignedTo));
    try {
      const data = await postAction('/approve', {
        assignedTo,
        assignedToName: selected?.nome || selected?.email || null
      });
      showMsg(data.message || 'Approved', 'success');
      openAsForkliftEdit = false;
      fillModal(data.data);
      runSearch();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });

  document.getElementById('rejectBtn')?.addEventListener('click', async () => {
    const reason = document.getElementById('rejectionReason').value.trim();
    if (!reason) {
      showMsg('Rejection reason is required.', 'error');
      return;
    }
    try {
      const data = await postAction('/reject', { rejectionReason: reason });
      showMsg(data.message || 'Rejected', 'success');
      openAsForkliftEdit = false;
      fillModal(data.data);
      runSearch();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });

  document.getElementById('holdBtn')?.addEventListener('click', async () => {
    try {
      const data = await postAction('/hold', { note: document.getElementById('holdNote').value.trim() });
      showMsg(data.message || 'On Hold', 'success');
      fillModal(data.data);
      runSearch();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });

  document.getElementById('resumeBtn')?.addEventListener('click', async () => {
    try {
      const data = await postAction('/resume', {});
      showMsg(data.message || 'Resumed', 'success');
      fillModal(data.data);
      runSearch();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });

  document.getElementById('sendBtn')?.addEventListener('click', async () => {
    try {
      const data = await postAction('/send', {
        finalSubject: document.getElementById('finalSubject').value.trim(),
        finalContent: document.getElementById('finalContent').value.trim()
      });
      showMsg(data.message || 'Sent', 'success');
      fillModal(data.data);
      runSearch();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });

  els.forkliftNewStatus?.addEventListener('change', syncForkliftNoteVisibility);

  document.getElementById('forkliftPendingRequestBtn')?.addEventListener('click', async () => {
    const selectedValue = String(els.forkliftPendingDriver?.value || '');
    const driverNotDefined = selectedValue === '__NOT_DEFINED__';
    if (!selectedValue) {
      showMsg('Select a forklift driver or ~Driver not defined.', 'error');
      els.forkliftPendingDriver?.focus();
      return;
    }
    const mode = driverNotDefined ? 'WAITING_FOR_DRIVER' : 'FORKLIFT_DRIVER_SELECTED';
    const selectedDriver = driverNotDefined
      ? null
      : forkliftDrivers.find((u) => String(u.id) === String(selectedValue));
    const driverName = selectedDriver?.nome || selectedDriver?.email || 'Forklift driver';
    const btn = document.getElementById('forkliftPendingRequestBtn');
    if (btn) btn.disabled = true;
    try {
      const data = await postAction('/forklift-request', {
        mode,
        assignedTo: driverNotDefined ? null : selectedValue
      });
      const reqNo = data.data?.requestNumber != null ? data.data.requestNumber : '';
      if (driverNotDefined) {
        alert(
          `Request #${reqNo} updated successfully.\nStatus: Waiting for driver for request.`
        );
      } else {
        alert(
          `Request #${reqNo} updated successfully.\nStatus: Forklift driver request selected.\nMessage sent to ${driverName}.`
        );
      }
      openAsForkliftEdit = false;
      closeModal();
      runSearch();
    } catch (err) {
      alert(err.message || 'Error confirming forklift request');
      showMsg(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('forkliftResponseBtn')?.addEventListener('click', async () => {
    const status = String(els.forkliftNewStatus?.value || '').toUpperCase();
    const noteToRequester = String(els.forkliftNoteToRequester?.value || '').trim();
    if (status !== 'PENDING' && status !== 'COMPLETED' && status !== 'CANCELLED') {
      showMsg('Select Pending, Completed or Cancelled.', 'error');
      return;
    }
    if ((status === 'PENDING' || status === 'CANCELLED') && !noteToRequester) {
      showMsg('Message to requester is required for Pending or Cancelled.', 'error');
      els.forkliftNoteToRequester?.focus();
      return;
    }
    const btn = document.getElementById('forkliftResponseBtn');
    if (btn) btn.disabled = true;
    try {
      const data = await postAction('/forklift-response', { status, noteToRequester });
      const reqNo = data.data?.requestNumber != null ? data.data.requestNumber : '';
      const newStatus = statusLabel(data.data?.status || status);
      let dialogMsg = `Request #${reqNo} updated successfully.\nStatus: ${newStatus}.`;
      if (data.notify) {
        dialogMsg += '\nRequester was notified.';
      } else if (status === 'COMPLETED') {
        dialogMsg += '\nRequester was not notified (setting is Off).';
      }
      alert(dialogMsg);
      openAsForkliftEdit = false;
      closeModal();
      runSearch();
    } catch (err) {
      alert(err.message || 'Error saving status');
      showMsg(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('forkliftClaimBtn')?.addEventListener('click', async () => {
    const assignedTo = els.forkliftClaimDriver?.value || '';
    if (!assignedTo) {
      showMsg('Select a forklift driver.', 'error');
      els.forkliftClaimDriver?.focus();
      return;
    }
    const selectedDriver = forkliftDrivers.find((u) => String(u.id) === String(assignedTo));
    const driverName = selectedDriver?.nome || selectedDriver?.email || 'Forklift driver';
    const btn = document.getElementById('forkliftClaimBtn');
    if (btn) btn.disabled = true;
    try {
      const data = await postAction('/forklift-assign', { assignedTo });
      const reqNo = data.data?.requestNumber != null ? data.data.requestNumber : '';
      alert(
        `Request #${reqNo} updated successfully.\nStatus: Forklift driver request selected.\nMessage sent to ${driverName}.`
      );
      openAsForkliftEdit = false;
      closeModal();
      runSearch();
    } catch (err) {
      alert(err.message || 'Error assigning forklift driver');
      showMsg(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  els.applyBtn?.addEventListener('click', runSearch);
  els.clearBtn?.addEventListener('click', () => {
    ['requestNumber', 'status', 'messageType', 'priority', 'subject', 'createdByName', 'assignedToName', 'recipientEmail']
      .forEach((key) => { if (els[key]) els[key].value = ''; });
    if (els.tableBody) {
      els.tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="8" class="empty-state"><i class="fas fa-search"></i><p>Use filters and click <strong>Search</strong>.</p></td></tr>';
    }
    if (els.resultsCount) els.resultsCount.textContent = '0 requests';
    if (els.noResults) els.noResults.style.display = 'none';
  });

  els.tableBody?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-forklift-btn');
    if (editBtn?.dataset.id) {
      if (editBtn.disabled) return;
      openRequest(editBtn.dataset.id, true);
      return;
    }
    const btn = e.target.closest('.open-request-btn');
    if (btn?.dataset.id) openRequest(btn.dataset.id, false);
  });

  document.getElementById('closeRequestModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  document.getElementById('closeRequestModalFooter')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  document.getElementById('forkliftResponseCloseBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  els.modal?.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal?.classList.contains('show')) {
      closeModal();
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    await loadSessionUser();
    await loadForkliftDrivers();
    loadOperators();
  });
})();
