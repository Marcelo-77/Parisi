(function () {
  const API = '/api/message-email';

  const searchTerm = document.getElementById('searchTerm');
  const searchMessageCode = document.getElementById('searchMessageCode');
  const searchSubject = document.getElementById('searchSubject');
  const searchCategory = document.getElementById('searchCategory');
  const searchStatus = document.getElementById('searchStatus');
  const searchCreatedByName = document.getElementById('searchCreatedByName');
  const searchDateFrom = document.getElementById('searchDateFrom');
  const searchDateTo = document.getElementById('searchDateTo');
  const applyBtn = document.getElementById('applySearchBtn');
  const clearBtn = document.getElementById('clearSearchBtn');
  const tableBody = document.getElementById('messageSearchTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTime = document.getElementById('resultsTime');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const noResults = document.getElementById('noResults');

  const editModal = document.getElementById('editMessageModal');
  const editForm = document.getElementById('editMessageForm');
  const editMessageId = document.getElementById('editMessageId');
  const editMessageCode = document.getElementById('editMessageCode');
  const editMessageCategory = document.getElementById('editMessageCategory');
  const editMessageStatus = document.getElementById('editMessageStatus');
  const editMessageSubject = document.getElementById('editMessageSubject');
  const editMessageBody = document.getElementById('editMessageBody');
  const editMessageNotes = document.getElementById('editMessageNotes');
  const editMessageStatusMsg = document.getElementById('editMessageStatusMsg');
  const editMessageModalTitle = document.getElementById('editMessageModalTitle');
  const editMessageModalSubtitle = document.getElementById('editMessageModalSubtitle');
  const closeEditBtn = document.getElementById('closeEditMessageModal');
  const cancelEditBtn = document.getElementById('cancelEditMessageBtn');
  const saveEditBtn = document.getElementById('saveEditMessageBtn');

  let modalViewMode = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCategory(value) {
    const map = {
      GENERAL: 'General',
      WAREHOUSE: 'Warehouse',
      NOTIFICATION: 'Notification',
      WELCOME: 'Welcome',
      OTHER: 'Other'
    };
    return map[String(value || '').toUpperCase()] || value || '-';
  }

  function formatStatus(value) {
    return String(value || '').toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
  }

  function statusClass(value) {
    return String(value || '').toUpperCase() === 'INACTIVE' ? 'status-inactive' : 'status-active';
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function truncate(text, max) {
    const value = String(text || '');
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  function showEditMessage(text, type) {
    if (!editMessageStatusMsg) return;
    editMessageStatusMsg.textContent = text || '';
    editMessageStatusMsg.className = 'message-email-message' + (text ? (' show ' + (type || 'info')) : '');
  }

  function buildSearchParams() {
    const params = new URLSearchParams();
    if (searchTerm?.value.trim()) params.set('search', searchTerm.value.trim());
    if (searchMessageCode?.value.trim()) params.set('messageCode', searchMessageCode.value.trim());
    if (searchSubject?.value.trim()) params.set('subject', searchSubject.value.trim());
    if (searchCategory?.value) params.set('category', searchCategory.value);
    if (searchStatus?.value) params.set('status', searchStatus.value);
    if (searchCreatedByName?.value.trim()) params.set('createdByName', searchCreatedByName.value.trim());
    if (searchDateFrom?.value) params.set('dateFrom', searchDateFrom.value);
    if (searchDateTo?.value) params.set('dateTo', searchDateTo.value);
    return params;
  }

  async function runSearch() {
    try {
      if (loadingIndicator) loadingIndicator.style.display = 'block';
      if (noResults) noResults.style.display = 'none';
      if (resultsCount) resultsCount.textContent = 'Loading...';
      if (resultsTime) resultsTime.textContent = '';

      const startedAt = Date.now();
      const params = buildSearchParams();
      const url = params.toString() ? (API + '?' + params.toString()) : API;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to load messages');
      }

      const list = data.data || [];
      const elapsedMs = Date.now() - startedAt;
      if (resultsCount) {
        resultsCount.textContent = list.length + ' message' + (list.length !== 1 ? 's' : '');
      }
      if (resultsTime) resultsTime.textContent = '(' + (elapsedMs / 1000).toFixed(2) + 's)';

      if (!tableBody) return;
      if (!list.length) {
        tableBody.innerHTML = '';
        if (noResults) noResults.style.display = 'block';
        return;
      }

      if (noResults) noResults.style.display = 'none';
      tableBody.innerHTML = list.map((row) => {
        const id = row.id || '';
        const bodyPreview = truncate(row.body, 120);
        return '<tr class="item-data-row" data-id="' + escapeHtml(id) + '">'
          + '<td data-label="Code"><strong>' + escapeHtml(row.messageCode || '-') + '</strong></td>'
          + '<td data-label="Subject">' + escapeHtml(row.subject || '-') + '</td>'
          + '<td data-label="Category">' + escapeHtml(formatCategory(row.category)) + '</td>'
          + '<td data-label="Status" class="' + statusClass(row.status) + '">' + escapeHtml(formatStatus(row.status)) + '</td>'
          + '<td data-label="Body" title="' + escapeHtml(row.body || '') + '">' + escapeHtml(bodyPreview) + '</td>'
          + '<td data-label="Created by">' + escapeHtml(row.createdByName || '-') + '</td>'
          + '<td data-label="Created">' + escapeHtml(formatDate(row.criadoEm)) + '</td>'
          + '</tr>'
          + '<tr class="item-actions-row" data-id="' + escapeHtml(id) + '">'
          + '<td colspan="7" class="action-buttons-cell">'
          + '<div class="action-buttons">'
          + '<button type="button" class="btn-action view view-message-btn" data-id="' + escapeHtml(id) + '" title="View">'
          + '<i class="fas fa-eye"></i> <span>View</span></button>'
          + '<button type="button" class="btn-action edit edit-message-btn" data-id="' + escapeHtml(id) + '" title="Edit" data-write-action="true">'
          + '<i class="fas fa-edit"></i> <span>Edit</span></button>'
          + '<button type="button" class="btn-action delete delete-message-btn" data-id="' + escapeHtml(id) + '" title="Delete" data-write-action="true">'
          + '<i class="fas fa-trash"></i> <span>Del.</span></button>'
          + '</div></td></tr>';
      }).join('');

      if (typeof window.DoubleYApplicationWriteAccess !== 'undefined') {
        window.DoubleYApplicationWriteAccess.apply();
      }
    } catch (error) {
      if (resultsCount) resultsCount.textContent = '0 messages';
      if (resultsTime) resultsTime.textContent = '';
      if (tableBody) {
        tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="7" class="empty-state"><p class="error-state">'
          + escapeHtml(error.message || 'Error loading messages.') + '</p></td></tr>';
      }
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function clearFilters() {
    [searchTerm, searchMessageCode, searchSubject, searchCreatedByName, searchDateFrom, searchDateTo]
      .forEach((el) => { if (el) el.value = ''; });
    if (searchCategory) searchCategory.value = '';
    if (searchStatus) searchStatus.value = '';
    if (noResults) noResults.style.display = 'none';
    if (resultsTime) resultsTime.textContent = '';
    if (resultsCount) resultsCount.textContent = '0 messages';
    if (tableBody) {
      tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="7" class="empty-state" id="emptyStateRow">'
        + '<i class="fas fa-search"></i>'
        + '<p>Use search or filters and click <strong>Search</strong> to load email messages.</p>'
        + '</td></tr>';
    }
  }

  function setModalMode(viewMode) {
    modalViewMode = viewMode;
    if (editModal) editModal.classList.toggle('is-view-mode', viewMode);
    [editMessageCode, editMessageCategory, editMessageStatus, editMessageSubject, editMessageBody, editMessageNotes]
      .forEach((field) => { if (field) field.disabled = viewMode; });
    if (saveEditBtn) saveEditBtn.hidden = viewMode;
    if (cancelEditBtn) {
      cancelEditBtn.innerHTML = viewMode
        ? '<i class="fas fa-door-open"></i> Close'
        : '<i class="fas fa-times"></i> Cancel';
    }
    if (editMessageModalTitle) {
      editMessageModalTitle.innerHTML = viewMode
        ? '<i class="fas fa-eye"></i> View Email Message'
        : '<i class="fas fa-edit"></i> Edit Email Message';
    }
  }

  function populateModal(item) {
    if (editMessageId) editMessageId.value = item.id || '';
    if (editMessageCode) editMessageCode.value = item.messageCode || '';
    if (editMessageCategory) editMessageCategory.value = item.category || 'GENERAL';
    if (editMessageStatus) editMessageStatus.value = item.status || 'ACTIVE';
    if (editMessageSubject) editMessageSubject.value = item.subject || '';
    if (editMessageBody) editMessageBody.value = item.body || '';
    if (editMessageNotes) editMessageNotes.value = item.notes || '';
    if (editMessageModalSubtitle) {
      editMessageModalSubtitle.textContent = (modalViewMode ? 'Viewing ' : 'Editing ')
        + (item.messageCode || 'message');
    }
  }

  async function openMessageModal(id, viewMode) {
    showEditMessage('');
    try {
      const res = await fetch(API + '/' + encodeURIComponent(id), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        throw new Error((data && data.error) || 'Unable to load message');
      }
      populateModal(data.data);
      setModalMode(viewMode);
      if (editModal) {
        editModal.classList.add('show');
        editModal.setAttribute('aria-hidden', 'false');
      }
    } catch (error) {
      alert(error.message || 'Unable to open message');
    }
  }

  function closeEditModal() {
    if (editModal) {
      editModal.classList.remove('show');
      editModal.setAttribute('aria-hidden', 'true');
    }
    setModalMode(false);
    showEditMessage('');
  }

  async function saveEditMessage(event) {
    event.preventDefault();
    if (modalViewMode) return;
    showEditMessage('');

    const id = editMessageId?.value;
    if (!id) {
      showEditMessage('Missing message id.', 'error');
      return;
    }

    const payload = {
      messageCode: editMessageCode?.value || '',
      category: editMessageCategory?.value || 'GENERAL',
      status: editMessageStatus?.value || 'ACTIVE',
      subject: editMessageSubject?.value || '',
      body: editMessageBody?.value || '',
      notes: editMessageNotes?.value || ''
    };

    if (saveEditBtn) saveEditBtn.disabled = true;
    try {
      const res = await fetch(API + '/' + encodeURIComponent(id), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to update message');
      }
      showEditMessage(data.message || 'Email message updated successfully.', 'success');
      await runSearch();
    } catch (error) {
      showEditMessage(error.message || 'Unable to update message', 'error');
    } finally {
      if (saveEditBtn) saveEditBtn.disabled = false;
    }
  }

  async function deleteMessage(id) {
    if (!id) return;
    if (!window.confirm('Delete this email message? This action cannot be undone.')) return;
    try {
      const res = await fetch(API + '/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to delete message');
      }
      await runSearch();
    } catch (error) {
      alert(error.message || 'Unable to delete message');
    }
  }

  function focusPanel() {
    const panel = document.querySelector('.filters-section');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => searchTerm?.focus({ preventScroll: true }));
  }

  applyBtn?.addEventListener('click', runSearch);
  clearBtn?.addEventListener('click', clearFilters);
  searchTerm?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });
  searchMessageCode?.addEventListener('input', () => {
    if (searchMessageCode) searchMessageCode.value = searchMessageCode.value.toUpperCase();
  });
  editMessageCode?.addEventListener('input', () => {
    if (editMessageCode) editMessageCode.value = editMessageCode.value.toUpperCase();
  });
  editForm?.addEventListener('submit', saveEditMessage);
  closeEditBtn?.addEventListener('click', closeEditModal);
  cancelEditBtn?.addEventListener('click', closeEditModal);
  editModal?.addEventListener('click', (event) => {
    if (event.target === editModal) closeEditModal();
  });

  tableBody?.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.view-message-btn');
    if (viewBtn) {
      openMessageModal(viewBtn.getAttribute('data-id'), true);
      return;
    }
    const editBtn = event.target.closest('.edit-message-btn');
    if (editBtn) {
      openMessageModal(editBtn.getAttribute('data-id'), false);
      return;
    }
    const deleteBtn = event.target.closest('.delete-message-btn');
    if (deleteBtn) {
      deleteMessage(deleteBtn.getAttribute('data-id'));
    }
  });

  focusPanel();
})();
