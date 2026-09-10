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
    sendPanel: document.getElementById('sendPanel')
  };

  let operators = [];
  let current = null;

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
      ON_HOLD: 'On Hold'
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
    return 'status-pending';
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
        return '<tr class="item-data-row" data-id="' + escapeHtml(id) + '">'
          + '<td><strong>#' + escapeHtml(row.requestNumber || '-') + '</strong></td>'
          + '<td>' + escapeHtml(row.messageType || '-') + '</td>'
          + '<td>' + escapeHtml(row.subject || '-') + '</td>'
          + '<td>' + escapeHtml(row.priority || '-') + '</td>'
          + '<td class="' + statusClass(row.status) + '">' + escapeHtml(statusLabel(row.status)) + '</td>'
          + '<td>' + escapeHtml(row.createdByName || '-') + '</td>'
          + '<td>' + escapeHtml(row.assignedToName || '-') + '</td>'
          + '<td>' + escapeHtml(formatDate(row.criadoEm)) + '</td>'
          + '</tr>'
          + '<tr class="item-actions-row" data-id="' + escapeHtml(id) + '">'
          + '<td colspan="8" class="action-buttons-cell">'
          + '<div class="action-buttons">'
          + '<button type="button" class="btn-action view open-request-btn" data-id="' + escapeHtml(id) + '" title="Open">'
          + '<i class="fas fa-eye"></i> <span>Open</span></button>'
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

    const status = String(item.status || '').toUpperCase();
    // No manager approval step: create already assigns. Keep approve/reject only for legacy Pending/Under Review rows.
    setPanel(els.approvePanel, status === 'UNDER_REVIEW' || status === 'PENDING');
    setPanel(els.rejectPanel, status === 'UNDER_REVIEW' || status === 'PENDING');
    setPanel(els.holdPanel, status === 'IN_PROGRESS' || status === 'ON_HOLD');
    setPanel(els.sendPanel, status === 'IN_PROGRESS' || status === 'ON_HOLD');
    document.getElementById('holdBtn').style.display = status === 'ON_HOLD' ? 'none' : '';
    document.getElementById('resumeBtn').style.display = status === 'ON_HOLD' ? '' : 'none';
    showMsg('');
  }

  function openModal() {
    if (!els.modal) return;
    els.modal.classList.add('show');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.remove('show');
    els.modal.setAttribute('aria-hidden', 'true');
    current = null;
  }

  async function openRequest(id) {
    try {
      const res = await fetch(API + '/' + encodeURIComponent(id), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load request');
      fillModal(data.data);
      openModal();
    } catch (err) {
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
    const btn = e.target.closest('.open-request-btn');
    if (btn?.dataset.id) openRequest(btn.dataset.id);
  });

  document.getElementById('closeRequestModal')?.addEventListener('click', closeModal);
  document.getElementById('closeRequestModalFooter')?.addEventListener('click', closeModal);
  els.modal?.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });

  document.addEventListener('DOMContentLoaded', () => {
    loadOperators();
  });
})();
