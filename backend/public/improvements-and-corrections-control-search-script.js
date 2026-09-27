(function () {
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const REQUESTS_API = API_BASE + '/api/improvements-corrections';
  const APPS_API = API_BASE + '/api/system-applications';
  const MENU_ACCESS_API = API_BASE + '/api/auth/menu-access';
  const USERS_API = API_BASE + '/api/funcionarios';
  const ROOT_REQUESTER_VALUE = 'root';

  const requestNumberInput = document.getElementById('searchRequestNumber');
  const requestTypeSelect = document.getElementById('searchRequestType');
  const applicationSelect = document.getElementById('searchApplication');
  const situationSelect = document.getElementById('searchSituation');
  const createdByInput = document.getElementById('searchCreatedByName');
  const requestDateFromInput = document.getElementById('searchRequestDateFrom');
  const requestDateToInput = document.getElementById('searchRequestDateTo');
  const descriptionInput = document.getElementById('searchDescription');

  const applyBtn = document.getElementById('applySearchBtn');
  const clearBtn = document.getElementById('clearSearchBtn');
  const tableBody = document.getElementById('requestsSearchTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTime = document.getElementById('resultsTime');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const noResults = document.getElementById('noResults');

  const editModal = document.getElementById('editRequestModal');
  const editForm = document.getElementById('editRequestForm');
  const editRequestId = document.getElementById('editRequestId');
  const editRequestNumber = document.getElementById('editRequestNumber');
  const editRequestType = document.getElementById('editRequestType');
  const editApplicationGroup = document.getElementById('editApplicationGroup');
  const editRequestApplication = document.getElementById('editRequestApplication');
  const editRequestSituation = document.getElementById('editRequestSituation');
  const editRequestDate = document.getElementById('editRequestDate');
  const editFinishDate = document.getElementById('editFinishDate');
  const editRequestedByDisplay = document.getElementById('editRequestedByDisplay');
  const editRequestedBySelect = document.getElementById('editRequestedBySelect');
  const editRequestDescription = document.getElementById('editRequestDescription');
  const editRequestAttachment = document.getElementById('editRequestAttachment');
  const editAttachmentsList = document.getElementById('editAttachmentsList');
  const editAttachmentUploadGroup = document.getElementById('editAttachmentUploadGroup');
  const editRequestHistory = document.getElementById('editRequestHistory');
  const editHistoryNote = document.getElementById('editHistoryNote');
  const editRequestMessage = document.getElementById('editRequestMessage');
  const closeEditBtn = document.getElementById('closeEditRequestModal');
  const closeEditFooterBtn = document.getElementById('closeEditRequestFooterBtn');
  const cancelEditBtn = document.getElementById('cancelEditRequestBtn');
  const saveEditBtn = document.getElementById('saveEditRequestBtn');

  const approvalEmailDialog = document.getElementById('approvalEmailDialog');
  const approvalEmailFrom = document.getElementById('approvalEmailFrom');
  const approvalEmailRecipient = document.getElementById('approvalEmailRecipient');
  const approvalEmailSubject = document.getElementById('approvalEmailSubject');
  const approvalEmailAppUrl = document.getElementById('approvalEmailAppUrl');
  const approvalEmailDescription = document.getElementById('approvalEmailDescription');
  const approvalEmailReadyStatus = document.getElementById('approvalEmailReadyStatus');
  const approvalEmailDialogNote = document.getElementById('approvalEmailDialogNote');
  const closeApprovalEmailDialogBtn = document.getElementById('closeApprovalEmailDialog');
  const cancelApprovalEmailDialogBtn = document.getElementById('cancelApprovalEmailDialog');
  const confirmApprovalEmailDialogBtn = document.getElementById('confirmApprovalEmailDialog');
  const icRequestSavedModal = document.getElementById('icRequestSavedModal');
  const icRequestSavedMessage = document.getElementById('icRequestSavedMessage');
  const icRequestSavedOkBtn = document.getElementById('icRequestSavedOkBtn');

  let originalSituationWhenOpened = '';
  let approvalDialogResolver = null;

  const editSummaryRequestNumber = document.getElementById('editSummaryRequestNumber');
  const editSummarySituation = document.getElementById('editSummarySituation');
  const editSummaryType = document.getElementById('editSummaryType');
  const editSummaryMeta = document.getElementById('editSummaryMeta');
  const editSummaryRequestedBy = document.getElementById('editSummaryRequestedBy');
  const editSummaryRequestDate = document.getElementById('editSummaryRequestDate');
  const editRequestModalTitle = document.getElementById('editRequestModalTitle');
  const editRequestModalSubtitle = document.getElementById('editRequestModalSubtitle');

  let accessibleApplications = [];
  let isRootUser = false;
  let loadedUsers = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatRequestType(type) {
    const value = String(type || '').toUpperCase();
    if (value === 'IMPROVEMENT') return 'Improvements';
    if (value === 'CORRECTION') return 'Corrections';
    if (value === 'NEW_FUNCTIONALITY') return 'New Functionality';
    return value || '-';
  }

  function normalizeSituation(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  }

  function formatSituation(situation) {
    const value = normalizeSituation(situation);
    if (value === 'NOT_STARTED') return 'Not started';
    if (value === 'IN_DEVELOPMENT') return 'In development';
    if (value === 'IN_TESTING') return 'In testing';
    if (value === 'IN_CLIENT_VALIDATION') return 'In approval validation';
    if (value === 'APPROVED') return 'Approved';
    if (value === 'NOT_APPROVED') return 'Not Approved';
    if (value === 'LIVE') return 'Live';
    if (value === 'CANCELLED') return 'Cancelled';
    return situation || '-';
  }

  function situationCssClass(situation) {
    const value = normalizeSituation(situation);
    if (value === 'NOT_STARTED') return 'situation-not-started';
    if (value === 'IN_DEVELOPMENT') return 'situation-in-development';
    if (value === 'IN_TESTING') return 'situation-in-testing';
    if (value === 'IN_CLIENT_VALIDATION') return 'situation-in-client-validation';
    if (value === 'APPROVED') return 'situation-approved';
    if (value === 'NOT_APPROVED') return 'situation-not-approved';
    if (value === 'LIVE') return 'situation-live';
    if (value === 'CANCELLED') return 'situation-cancelled';
    return '';
  }

  function formatDate(value) {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const d = new Date(value.slice(0, 10) + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function toDateInputValue(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function requiresApplication(type) {
    return type === 'IMPROVEMENT' || type === 'CORRECTION';
  }

  function isRequestLocked(situation) {
    const value = normalizeSituation(situation);
    return value === 'LIVE' || value === 'CANCELLED';
  }

  function showEditMessage(text, type) {
    if (!editRequestMessage) return;
    editRequestMessage.textContent = text || '';
    editRequestMessage.className = 'ic-edit-message show ' + (type || 'info');
  }

  function clearEditMessage() {
    if (!editRequestMessage) return;
    editRequestMessage.textContent = '';
    editRequestMessage.className = 'ic-edit-message';
  }

  function buildApplicationOptions(list, includeAllOption) {
    const apps = Array.isArray(list) ? list.slice() : [];
    const options = [includeAllOption
      ? '<option value="">All applications</option>'
      : '<option value="">Select application…</option>']
      .concat(apps.map((app) => {
        const name = app.syapNmApplication || app.syap_nm_application || '';
        const menu = app.syapDsDetailed || app.syap_ds_detailed || name;
        const label = menu && menu !== name
          ? (menu.replace(/_/g, ' ') + ' (' + name + ')')
          : name;
        return '<option value="' + escapeHtml(name) + '" data-menu="' + escapeHtml(menu) + '">'
          + escapeHtml(label) + '</option>';
      }));
    return options.join('');
  }

  function populateApplications(list) {
    accessibleApplications = Array.isArray(list) ? list.slice() : [];
    if (applicationSelect) {
      applicationSelect.innerHTML = buildApplicationOptions(accessibleApplications, true);
    }
    if (editRequestApplication) {
      editRequestApplication.innerHTML = buildApplicationOptions(accessibleApplications, false);
    }
  }

  function populateUsers(list) {
    loadedUsers = Array.isArray(list) ? list.slice() : [];
    if (!editRequestedBySelect) return;
    const options = ['<option value="">Select user…</option>',
      '<option value="' + ROOT_REQUESTER_VALUE + '">Root</option>'
    ].concat(loadedUsers.map((user) => {
      const name = user.nome || user.name || user.email || 'User';
      const email = user.email || '';
      const label = email ? (name + ' (' + email + ')') : name;
      return '<option value="' + escapeHtml(user.id) + '">' + escapeHtml(label) + '</option>';
    }));
    editRequestedBySelect.innerHTML = options.join('');
  }

  function toggleEditApplicationField() {
    const type = editRequestType ? editRequestType.value : '';
    const show = requiresApplication(type);
    if (editApplicationGroup) {
      if (show) editApplicationGroup.classList.remove('is-hidden');
      else editApplicationGroup.classList.add('is-hidden');
    }
    if (editRequestApplication) {
      editRequestApplication.required = show;
      if (!show) editRequestApplication.value = '';
    }
  }

  function toggleEditRequestedByField() {
    if (editRequestedByDisplay) {
      editRequestedByDisplay.style.display = isRootUser ? 'none' : '';
      editRequestedByDisplay.classList.toggle('is-hidden', isRootUser);
    }
    if (editRequestedBySelect) {
      editRequestedBySelect.classList.toggle('is-hidden', !isRootUser);
      editRequestedBySelect.style.display = isRootUser ? 'block' : 'none';
      editRequestedBySelect.required = isRootUser;
    }
  }

  async function loadUsersForRoot() {
    try {
      const res = await fetch(USERS_API + '?ativo=true&ordenarPor=nome&direcao=asc', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load users');
      }
      populateUsers(data.data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadApplications() {
    try {
      const [appsRes, accessRes] = await Promise.all([
        fetch(APPS_API, { credentials: 'include' }),
        fetch(MENU_ACCESS_API, { credentials: 'include' })
      ]);

      const appsData = await appsRes.json();
      if (!appsRes.ok || !appsData.success) {
        throw new Error((appsData && appsData.error) || 'Unable to load applications');
      }

      let list = appsData.data || [];
      if (accessRes.ok) {
        const accessData = await accessRes.json().catch(() => null);
        if (accessData && accessData.success) {
          isRootUser = Boolean(accessData.isRoot || (accessData.user && accessData.user.isRoot));
          if (!isRootUser) {
            const allowed = new Set(
              (accessData.applications || [])
                .map((name) => String(name || '').trim().toLowerCase())
                .filter(Boolean)
            );
            list = list.filter((app) => {
              const name = String(app.syapNmApplication || app.syap_nm_application || '')
                .trim()
                .toLowerCase();
              return name && allowed.has(name);
            });
          }
        }
      }

      populateApplications(list);
      toggleEditRequestedByField();
      if (isRootUser) {
        await loadUsersForRoot();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function buildSearchParams() {
    const params = new URLSearchParams();

    if (requestNumberInput && requestNumberInput.value) {
      params.set('requestNumber', requestNumberInput.value);
    }
    if (requestTypeSelect && requestTypeSelect.value) params.set('requestType', requestTypeSelect.value);
    if (applicationSelect && applicationSelect.value) params.set('applicationName', applicationSelect.value);
    if (situationSelect && situationSelect.value) params.set('situation', situationSelect.value);
    if (createdByInput && createdByInput.value.trim()) params.set('createdByName', createdByInput.value.trim());
    if (requestDateFromInput && requestDateFromInput.value) params.set('requestDateFrom', requestDateFromInput.value);
    if (requestDateToInput && requestDateToInput.value) params.set('requestDateTo', requestDateToInput.value);
    if (descriptionInput && descriptionInput.value.trim()) params.set('description', descriptionInput.value.trim());

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
      const url = params.toString()
        ? (REQUESTS_API + '?' + params.toString())
        : REQUESTS_API;

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to load requests');
      }

      const list = data.data || [];
      const elapsedMs = Date.now() - startedAt;
      if (resultsCount) {
        resultsCount.textContent = list.length + ' request' + (list.length !== 1 ? 's' : '');
      }
      if (resultsTime) {
        resultsTime.textContent = '(' + (elapsedMs / 1000).toFixed(2) + 's)';
      }
      if (!tableBody) return;

      if (!list.length) {
        tableBody.innerHTML = '';
        if (noResults) noResults.style.display = 'block';
        return;
      }

      if (noResults) noResults.style.display = 'none';
      tableBody.innerHTML = list.map((row) => {
        const appLabel = row.applicationMenu
          ? String(row.applicationMenu).replace(/_/g, ' ')
          : (row.applicationName || (row.requestType === 'NEW_FUNCTIONALITY' ? '—' : '-'));
        const desc = String(row.description || '');
        const shortDesc = desc.length > 120 ? desc.slice(0, 117) + '…' : desc;
        const sitClass = situationCssClass(row.situation);
        const id = row.id || '';
        const locked = isRequestLocked(row.situation);
        const editButton = locked
          ? ''
          : ('<button type="button" class="btn-action edit edit-request-btn" data-id="' + escapeHtml(id) + '" title="Edit">'
            + '<i class="fas fa-edit"></i> <span>Edit</span></button>');

        return '<tr class="item-data-row" data-id="' + escapeHtml(id) + '">'
          + '<td data-label="Request #"><strong>#' + escapeHtml(row.requestNumber || '-') + '</strong></td>'
          + '<td data-label="Request Date">' + escapeHtml(formatDate(row.requestDate || row.criadoEm)) + '</td>'
          + '<td data-label="Finish Date">' + escapeHtml(formatDate(row.finishDate || row.finish_date || null)) + '</td>'
          + '<td data-label="Type">' + escapeHtml(formatRequestType(row.requestType)) + '</td>'
          + '<td data-label="Application">' + escapeHtml(appLabel) + '</td>'
          + '<td data-label="Description" title="' + escapeHtml(desc) + '">' + escapeHtml(shortDesc) + '</td>'
          + '<td data-label="Requested by">' + escapeHtml(row.createdByName || '-') + '</td>'
          + '<td data-label="Situation" class="' + sitClass + '">' + escapeHtml(formatSituation(row.situation)) + '</td>'
          + '</tr>'
          + '<tr class="item-actions-row" data-id="' + escapeHtml(id) + '">'
          + '<td colspan="8" class="action-buttons-cell">'
          + '<div class="action-buttons">'
          + '<button type="button" class="btn-action view view-request-btn" data-id="' + escapeHtml(id) + '" title="View">'
          + '<i class="fas fa-eye"></i> <span>View</span></button>'
          + editButton
          + '<button type="button" class="btn-action delete delete-request-btn" data-id="' + escapeHtml(id) + '" title="Delete">'
          + '<i class="fas fa-trash"></i> <span>Del.</span></button>'
          + '</div>'
          + '</td>'
          + '</tr>';
      }).join('');
    } catch (error) {
      console.error(error);
      if (resultsCount) resultsCount.textContent = '0 requests';
      if (resultsTime) resultsTime.textContent = '';
      if (tableBody) {
        tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="8" class="empty-state"><p class="error-state">'
          + escapeHtml(error.message || 'Error loading requests.')
          + '</p></td></tr>';
      }
      if (noResults) noResults.style.display = 'none';
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function clearFilters() {
    if (requestNumberInput) requestNumberInput.value = '';
    if (requestTypeSelect) requestTypeSelect.value = '';
    if (applicationSelect) applicationSelect.value = '';
    if (situationSelect) situationSelect.value = '';
    if (createdByInput) createdByInput.value = '';
    if (requestDateFromInput) requestDateFromInput.value = '';
    if (requestDateToInput) requestDateToInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (noResults) noResults.style.display = 'none';
    if (resultsTime) resultsTime.textContent = '';
    if (resultsCount) resultsCount.textContent = '0 requests';
    if (tableBody) {
      tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="8" class="empty-state" id="emptyStateRow">'
        + '<i class="fas fa-search"></i>'
        + '<p>Use search or filters and click <strong>Search</strong> to load requests.</p>'
        + '</td></tr>';
    }
  }

  function openEditModal() {
    if (!editModal) return;
    editModal.classList.add('show');
    editModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    if (!editModal) return;
    editModal.classList.remove('show');
    editModal.setAttribute('aria-hidden', 'true');
    setEditModalMode(false);
    clearEditMessage();
  }

  function setEditModalMode(viewMode) {
    if (editModal) {
      editModal.classList.toggle('is-view-mode', viewMode);
    }

    [
      editRequestType,
      editRequestSituation,
      editRequestApplication,
      editRequestDate,
      editFinishDate,
      editRequestDescription,
      editHistoryNote,
      editRequestedBySelect
    ].forEach((field) => {
      if (!field) return;
      field.disabled = viewMode;
    });

    if (editRequestDescription) {
      editRequestDescription.classList.toggle('input-readonly', viewMode);
    }

    if (saveEditBtn) saveEditBtn.hidden = viewMode;
    if (cancelEditBtn) cancelEditBtn.hidden = viewMode;
    if (editRequestModalTitle) {
      editRequestModalTitle.innerHTML = viewMode
        ? '<i class="fas fa-eye"></i> View Request'
        : '<i class="fas fa-edit"></i> Edit Request';
    }
  }

  function populateRequestModal(item) {
    if (editRequestId) editRequestId.value = item.id || '';
    if (editRequestNumber) editRequestNumber.value = item.requestNumber != null ? item.requestNumber : '';
    if (editRequestType) editRequestType.value = item.requestType || '';
    if (editRequestSituation) editRequestSituation.value = item.situation || 'NOT_STARTED';
    if (editRequestDate) editRequestDate.value = toDateInputValue(item.requestDate);
    if (editFinishDate) editFinishDate.value = toDateInputValue(item.finishDate);
    if (editRequestDescription) editRequestDescription.value = item.description || '';
    if (editRequestHistory) {
      editRequestHistory.value = item.requestHistory
        || 'No history recorded yet. New steps will be logged automatically when you save changes.';
    }
    if (editHistoryNote) editHistoryNote.value = '';

    toggleEditApplicationField();
    if (editRequestApplication) {
      editRequestApplication.value = item.applicationName || '';
      if (item.applicationName && !editRequestApplication.value) {
        const option = document.createElement('option');
        option.value = item.applicationName;
        option.setAttribute('data-menu', item.applicationMenu || item.applicationName);
        option.textContent = (item.applicationMenu || item.applicationName).replace(/_/g, ' ');
        editRequestApplication.appendChild(option);
        editRequestApplication.value = item.applicationName;
      }
    }

    toggleEditRequestedByField();
    if (isRootUser && editRequestedBySelect) {
      if (item.createdBy) {
        editRequestedBySelect.value = item.createdBy;
      } else if (String(item.createdByName || '').toLowerCase() === 'root') {
        editRequestedBySelect.value = ROOT_REQUESTER_VALUE;
      } else {
        editRequestedBySelect.value = '';
      }
    } else if (editRequestedByDisplay) {
      editRequestedByDisplay.value = item.createdByName || '-';
    }

    updateEditSummary(item);
    originalSituationWhenOpened = item.situation || 'NOT_STARTED';
  }

  function formatFileSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size < 0) return '';
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderAttachments(rows, viewMode) {
    if (!editAttachmentsList) return;
    if (!rows || !rows.length) {
      editAttachmentsList.innerHTML = '<p class="field-hint" style="margin:0;">No documents attached.</p>';
      return;
    }
    editAttachmentsList.innerHTML = rows.map((row) => {
      const id = encodeURIComponent(row.id);
      const requestId = encodeURIComponent(editRequestId?.value || '');
      const sizeLabel = formatFileSize(row.fileSize);
      const by = row.uploadedByName ? (' · ' + escapeHtml(row.uploadedByName)) : '';
      const removeBtn = viewMode
        ? ''
        : `<button type="button" class="btn btn-secondary ic-attachment-remove" data-id="${escapeHtml(row.id)}"><i class="fas fa-trash"></i></button>`;
      return `
        <div class="ic-attachment-row">
          <div class="ic-attachment-meta">
            <strong title="${escapeHtml(row.fileName || '')}"><i class="fas fa-file"></i> ${escapeHtml(row.fileName || 'document')}</strong>
            <span>${escapeHtml(sizeLabel)}${by}</span>
          </div>
          <div class="ic-attachment-actions">
            <a class="btn btn-secondary" href="${REQUESTS_API}/${requestId}/attachments/${id}/download" target="_blank" rel="noopener">
              <i class="fas fa-download"></i>
            </a>
            ${removeBtn}
          </div>
        </div>`;
    }).join('');

    editAttachmentsList.querySelectorAll('.ic-attachment-remove').forEach((btn) => {
      btn.addEventListener('click', () => removeAttachment(btn.getAttribute('data-id')));
    });
  }

  async function loadAttachments(requestId, viewMode) {
    if (!requestId || !editAttachmentsList) return;
    editAttachmentsList.innerHTML = '<p class="field-hint" style="margin:0;">Loading documents…</p>';
    try {
      const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(requestId) + '/attachments', {
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load documents');
      }
      const locked = viewMode === true
        || (editModal && editModal.classList.contains('is-view-mode'));
      renderAttachments(data.data || [], locked);
    } catch (error) {
      editAttachmentsList.innerHTML = '<p class="field-hint" style="margin:0;color:#b91c1c;">' +
        escapeHtml(error.message || 'Unable to load documents') + '</p>';
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelectedAttachment() {
    const requestId = editRequestId?.value;
    const file = editRequestAttachment?.files && editRequestAttachment.files[0];
    if (!requestId || !file) return;

    if (file.size > 7 * 1024 * 1024) {
      showEditMessage('File size must be less than 7MB.', 'error');
      editRequestAttachment.value = '';
      return;
    }

    showEditMessage('Uploading document…', 'info');
    try {
      const dataUrl = await readFileAsBase64(file);
      const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(requestId) + '/attachments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64: dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to attach document');
      }
      if (editRequestHistory && data.requestHistory) {
        editRequestHistory.value = data.requestHistory;
      }
      editRequestAttachment.value = '';
      await loadAttachments(requestId);
      showEditMessage('Document attached successfully.', 'success');
      await runSearch();
    } catch (error) {
      showEditMessage(error.message || 'Unable to attach document', 'error');
      editRequestAttachment.value = '';
    }
  }

  async function removeAttachment(attachmentId) {
    const requestId = editRequestId?.value;
    if (!requestId || !attachmentId) return;
    if (!confirm('Remove this document from the request?')) return;
    try {
      const res = await fetch(
        REQUESTS_API + '/' + encodeURIComponent(requestId) + '/attachments/' + encodeURIComponent(attachmentId),
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to remove document');
      }
      if (editRequestHistory && data.requestHistory) {
        editRequestHistory.value = data.requestHistory;
      }
      await loadAttachments(requestId);
      showEditMessage('Document removed successfully.', 'success');
      await runSearch();
    } catch (error) {
      showEditMessage(error.message || 'Unable to remove document', 'error');
    }
  }

  function closeApprovalEmailDialog(confirmed) {
    if (approvalEmailDialog) {
      approvalEmailDialog.classList.remove('show');
      approvalEmailDialog.setAttribute('aria-hidden', 'true');
    }
    if (approvalDialogResolver) {
      approvalDialogResolver(Boolean(confirmed));
      approvalDialogResolver = null;
    }
  }

  async function fetchApprovalEmailPreview(id, payload) {
    const previewPayload = {
      requestType: payload.requestType,
      applicationName: payload.applicationName,
      applicationMenu: payload.applicationMenu,
      description: payload.description
    };
    if (Object.prototype.hasOwnProperty.call(payload, 'createdBy')) {
      previewPayload.createdBy = payload.createdBy;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'createdByName')) {
      previewPayload.createdByName = payload.createdByName;
    }

    const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(id) + '/approval-email-preview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewPayload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && (data.error || data.message)) || 'Unable to load approval email preview');
    }
    return data.data || {};
  }

  function showApprovalEmailDialog(preview) {
    const fromEmail = preview.fromEmail || 'noreply@double-y.online';
    if (approvalEmailFrom) {
      approvalEmailFrom.textContent = fromEmail;
    }
    if (approvalEmailRecipient) {
      approvalEmailRecipient.textContent = preview.hasValidRecipientEmail
        ? ((preview.recipientName || 'Requester') + ' <' + preview.recipientEmail + '>')
        : ((preview.recipientName || 'Requester') + ' (no valid email on file)');
      approvalEmailRecipient.style.color = preview.hasValidRecipientEmail ? '#15803d' : '#b91c1c';
    }
    if (approvalEmailSubject) {
      approvalEmailSubject.textContent = preview.subjectPreview || '-';
    }
    if (approvalEmailAppUrl) {
      approvalEmailAppUrl.textContent = preview.applicationUrl || '-';
    }
    if (approvalEmailDescription) {
      approvalEmailDescription.textContent = preview.description || '-';
    }
    if (approvalEmailReadyStatus) {
      if (preview.readyToSend) {
        approvalEmailReadyStatus.textContent = 'OK — email ready to send to ' + (preview.recipientEmail || '');
        approvalEmailReadyStatus.style.color = '#15803d';
      } else {
        approvalEmailReadyStatus.textContent = 'Not ready — ' + (preview.readinessMessage || 'email cannot be sent yet');
        approvalEmailReadyStatus.style.color = '#b91c1c';
      }
    }
    if (approvalEmailDialogNote) {
      if (preview.readyToSend) {
        approvalEmailDialogNote.textContent = preview.readinessMessage
          || ('An approval email will be sent from ' + fromEmail + ' using the APPROVAL template.');
        approvalEmailDialogNote.style.color = '#15803d';
      } else {
        approvalEmailDialogNote.textContent = preview.readinessMessage
          || 'The request can still be saved, but the approval email will not be sent until the issue above is fixed.';
        approvalEmailDialogNote.style.color = '#b91c1c';
      }
    }
    if (confirmApprovalEmailDialogBtn) {
      confirmApprovalEmailDialogBtn.disabled = false;
      confirmApprovalEmailDialogBtn.innerHTML = preview.readyToSend
        ? '<i class="fas fa-paper-plane"></i> Save and send email'
        : '<i class="fas fa-save"></i> Save without sending email';
    }

    if (approvalEmailDialog) {
      approvalEmailDialog.classList.add('show');
      approvalEmailDialog.setAttribute('aria-hidden', 'false');
    }

    return new Promise((resolve) => {
      approvalDialogResolver = resolve;
    });
  }

  function shouldPromptApprovalEmail(situation) {
    const next = normalizeSituation(situation);
    const previous = normalizeSituation(originalSituationWhenOpened);
    return next === 'IN_CLIENT_VALIDATION' && previous !== 'IN_CLIENT_VALIDATION';
  }

  function hideRequestSavedModal() {
    if (!icRequestSavedModal) return;
    icRequestSavedModal.classList.remove('show');
    icRequestSavedModal.setAttribute('aria-hidden', 'true');
  }

  function showRequestSavedModal(message) {
    // Close edit first so Cancel / Save changes are not left behind the success dialog.
    closeEditModal();
    if (icRequestSavedMessage) {
      icRequestSavedMessage.textContent = message || 'Request updated successfully.';
    }
    if (icRequestSavedModal) {
      icRequestSavedModal.classList.add('show');
      icRequestSavedModal.setAttribute('aria-hidden', 'false');
    }
    requestAnimationFrame(() => {
      try {
        icRequestSavedOkBtn?.focus({ preventScroll: true });
      } catch (_) {
        icRequestSavedOkBtn?.focus();
      }
    });
  }

  function closeRequestSavedAndEdit() {
    hideRequestSavedModal();
  }

  async function performSaveRequest(id, payload, sendApprovalEmail) {
    if (sendApprovalEmail) {
      payload.sendApprovalEmail = true;
    }

    if (saveEditBtn) saveEditBtn.disabled = true;
    try {
      const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(id), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to update request');
      }
      if (data.data && editRequestHistory) {
        editRequestHistory.value = data.data.requestHistory || editRequestHistory.value;
      }
      if (editHistoryNote) editHistoryNote.value = '';

      let message = data.message || 'Request updated successfully.';
      if (data.emailResult) {
        if (data.emailResult.sent) {
          message = 'Request updated and approval email sent successfully to ' + (data.emailResult.recipientEmail || 'requester') + '.';
        } else if (data.emailResult.skipped) {
          message = 'Request updated. Approval email was skipped: ' + (data.emailResult.error || 'no valid recipient email') + '.';
        } else if (data.emailResult.error) {
          message = 'Request updated, but approval email failed: ' + data.emailResult.error + '. Check Search Email Send Log.';
        }
      }

      clearEditMessage();
      originalSituationWhenOpened = data.data && data.data.situation ? data.data.situation : payload.situation;
      await runSearch();
      showRequestSavedModal(message);
    } finally {
      if (saveEditBtn) saveEditBtn.disabled = false;
    }
  }

  async function openRequestModal(id, viewMode) {
    clearEditMessage();
    try {
      const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(id), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        throw new Error((data && data.error) || 'Unable to load request');
      }
      const item = data.data;

      if (!viewMode && isRequestLocked(item.situation)) {
        alert('Requests with situation Live or Cancelled cannot be updated.');
        return;
      }

      populateRequestModal(item);

      if (editRequestModalSubtitle) {
        const requestNumber = item.requestNumber != null ? item.requestNumber : '-';
        editRequestModalSubtitle.textContent = viewMode
          ? ('Viewing request #' + requestNumber)
          : ('Editing request #' + requestNumber);
      }

      setEditModalMode(viewMode);
      if (editRequestAttachment) editRequestAttachment.value = '';
      await loadAttachments(item.id, viewMode);
      openEditModal();
    } catch (error) {
      console.error(error);
      alert(error.message || (viewMode ? 'Unable to open request for view' : 'Unable to open request for edit'));
    }
  }

  function openEditRequest(id) {
    return openRequestModal(id, false);
  }

  function openViewRequest(id) {
    return openRequestModal(id, true);
  }

  function getSelectedApplicationLabel() {
    if (!editRequestApplication || !editRequestApplication.value) {
      return editRequestType && editRequestType.value === 'NEW_FUNCTIONALITY'
        ? 'New Functionality'
        : '-';
    }
    const selected = editRequestApplication.options[editRequestApplication.selectedIndex];
    const menu = selected ? selected.getAttribute('data-menu') : '';
    return (menu || selected.textContent || editRequestApplication.value || '-').replace(/_/g, ' ');
  }

  function getEditRequestedByLabel() {
    if (isRootUser && editRequestedBySelect && !editRequestedBySelect.classList.contains('is-hidden')) {
      const selected = editRequestedBySelect.options[editRequestedBySelect.selectedIndex];
      return (selected && selected.textContent) ? selected.textContent.trim() : '-';
    }
    return editRequestedByDisplay ? (editRequestedByDisplay.value || '-') : '-';
  }

  function updateEditSummary(item) {
    const fromItem = !!(item && typeof item === 'object');
    const requestNumber = fromItem
      ? item.requestNumber
      : (editRequestNumber ? editRequestNumber.value : '');
    const situation = fromItem
      ? (item.situation || 'NOT_STARTED')
      : (editRequestSituation ? editRequestSituation.value : 'NOT_STARTED');
    const requestType = fromItem
      ? (item.requestType || '')
      : (editRequestType ? editRequestType.value : '');
    const finishDate = fromItem
      ? item.finishDate
      : (editFinishDate ? editFinishDate.value : '');
    const requestDate = fromItem
      ? (item.requestDate || item.criadoEm)
      : (editRequestDate ? editRequestDate.value : '');
    const appLabel = fromItem
      ? (item.applicationMenu
        ? String(item.applicationMenu).replace(/_/g, ' ')
        : (item.applicationName || (item.requestType === 'NEW_FUNCTIONALITY' ? 'New Functionality' : '-')))
      : getSelectedApplicationLabel();
    const requestedBy = fromItem
      ? (item.createdByName || '-')
      : getEditRequestedByLabel();

    if (editSummaryRequestNumber) {
      editSummaryRequestNumber.textContent = requestNumber !== '' && requestNumber != null
        ? ('#' + requestNumber)
        : '#-';
    }
    if (editSummarySituation) {
      editSummarySituation.textContent = formatSituation(situation);
      editSummarySituation.className = 'status-badge ' + situationCssClass(situation);
    }
    if (editSummaryType) {
      editSummaryType.textContent = formatRequestType(requestType);
    }
    if (editSummaryMeta) {
      editSummaryMeta.textContent = 'Application: ' + appLabel
        + ' · Finish: ' + formatDate(finishDate || null);
    }
    if (editSummaryRequestedBy) {
      editSummaryRequestedBy.textContent = requestedBy || '-';
    }
    if (editSummaryRequestDate) {
      editSummaryRequestDate.textContent = formatDate(requestDate);
    }
    if (editRequestModalSubtitle) {
      editRequestModalSubtitle.textContent = requestNumber !== '' && requestNumber != null
        ? ('Editing request #' + requestNumber)
        : 'Update request details and situation';
    }
  }

  function refreshEditSummaryFromForm() {
    updateEditSummary(null);
  }

  async function saveEditRequest(event) {
    event.preventDefault();
    clearEditMessage();

    const id = editRequestId ? editRequestId.value : '';
    if (!id) {
      showEditMessage('Missing request id.', 'error');
      return;
    }

    const requestType = editRequestType ? editRequestType.value : '';
    const applicationOption = editRequestApplication && editRequestApplication.selectedOptions
      ? editRequestApplication.selectedOptions[0]
      : null;
    const applicationName = editRequestApplication ? editRequestApplication.value.trim() : '';
    const applicationMenu = applicationOption
      ? (applicationOption.getAttribute('data-menu') || '').trim()
      : '';
    const description = editRequestDescription ? editRequestDescription.value.trim() : '';
    const situation = editRequestSituation ? editRequestSituation.value : 'NOT_STARTED';
    const requestDate = editRequestDate ? editRequestDate.value : '';
    const finishDate = editFinishDate ? editFinishDate.value : '';
    const historyNote = editHistoryNote ? editHistoryNote.value.trim() : '';

    if (!description) {
      showEditMessage('Please enter the description.', 'error');
      return;
    }
    if (!requestType) {
      showEditMessage('Please select the request type.', 'error');
      return;
    }
    if (requiresApplication(requestType) && !applicationName) {
      showEditMessage('Please select the application.', 'error');
      return;
    }
    if (isRootUser && editRequestedBySelect && !editRequestedBySelect.value) {
      showEditMessage('Please select the user who requested this.', 'error');
      return;
    }

    const payload = {
      description,
      requestType,
      applicationName: requiresApplication(requestType) ? applicationName : null,
      applicationMenu: requiresApplication(requestType) ? applicationMenu : null,
      situation,
      requestDate: requestDate || null,
      finishDate: finishDate || null
    };
    if (historyNote) {
      payload.historyNote = historyNote;
    }
    if (isRootUser && editRequestedBySelect && editRequestedBySelect.value) {
      payload.createdBy = editRequestedBySelect.value;
      const selected = editRequestedBySelect.options[editRequestedBySelect.selectedIndex];
      if (selected && selected.textContent) {
        // Prefer "Name (email)" → Name for greeting; email still resolved server-side by id.
        payload.createdByName = selected.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim() || selected.textContent.trim();
      }
    }

    try {
      if (shouldPromptApprovalEmail(situation)) {
        const preview = await fetchApprovalEmailPreview(id, payload);
        const confirmed = await showApprovalEmailDialog(preview);
        if (!confirmed) {
          showEditMessage('Save cancelled. Approval email was not sent.', 'info');
          return;
        }
        await performSaveRequest(id, payload, preview.readyToSend === true);
        return;
      }

      await performSaveRequest(id, payload, false);
    } catch (error) {
      closeApprovalEmailDialog(false);
      showEditMessage(error.message || 'Unable to update request', 'error');
    }
  }

  async function deleteRequest(id) {
    if (!id) return;
    const confirmed = window.confirm('Delete this request? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const res = await fetch(REQUESTS_API + '/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to delete request');
      }
      await runSearch();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Unable to delete request');
    }
  }

  function init() {
    if (applyBtn) applyBtn.addEventListener('click', runSearch);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      clearFilters();
    });
    if (descriptionInput) {
      descriptionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSearch();
        }
      });
    }

    if (editRequestType) {
      editRequestType.addEventListener('change', () => {
        toggleEditApplicationField();
        refreshEditSummaryFromForm();
      });
    }
    if (editRequestSituation) {
      editRequestSituation.addEventListener('change', refreshEditSummaryFromForm);
    }
    if (editRequestApplication) {
      editRequestApplication.addEventListener('change', refreshEditSummaryFromForm);
    }
    if (editRequestDate) {
      editRequestDate.addEventListener('change', refreshEditSummaryFromForm);
    }
    if (editFinishDate) {
      editFinishDate.addEventListener('change', refreshEditSummaryFromForm);
    }
    if (editRequestedBySelect) {
      editRequestedBySelect.addEventListener('change', refreshEditSummaryFromForm);
    }
    if (editRequestAttachment) {
      editRequestAttachment.addEventListener('change', () => {
        uploadSelectedAttachment();
      });
    }
    if (editForm) editForm.addEventListener('submit', saveEditRequest);
    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
    if (closeEditFooterBtn) closeEditFooterBtn.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    if (editModal) {
      editModal.addEventListener('click', (event) => {
        if (event.target === editModal) closeEditModal();
      });
    }

    if (closeApprovalEmailDialogBtn) {
      closeApprovalEmailDialogBtn.addEventListener('click', () => closeApprovalEmailDialog(false));
    }
    if (cancelApprovalEmailDialogBtn) {
      cancelApprovalEmailDialogBtn.addEventListener('click', () => closeApprovalEmailDialog(false));
    }
    if (confirmApprovalEmailDialogBtn) {
      confirmApprovalEmailDialogBtn.addEventListener('click', () => closeApprovalEmailDialog(true));
    }
    if (approvalEmailDialog) {
      approvalEmailDialog.addEventListener('click', (event) => {
        if (event.target === approvalEmailDialog) closeApprovalEmailDialog(false);
      });
    }

    if (icRequestSavedOkBtn) {
      icRequestSavedOkBtn.addEventListener('click', closeRequestSavedAndEdit);
    }
    if (icRequestSavedModal) {
      icRequestSavedModal.addEventListener('click', (event) => {
        if (event.target === icRequestSavedModal) closeRequestSavedAndEdit();
      });
    }

    if (tableBody) {
      tableBody.addEventListener('click', (event) => {
        const viewBtn = event.target.closest('.view-request-btn');
        if (viewBtn) {
          openViewRequest(viewBtn.getAttribute('data-id'));
          return;
        }
        const editBtn = event.target.closest('.edit-request-btn');
        if (editBtn) {
          openEditRequest(editBtn.getAttribute('data-id'));
          return;
        }
        const deleteBtn = event.target.closest('.delete-request-btn');
        if (deleteBtn) {
          deleteRequest(deleteBtn.getAttribute('data-id'));
        }
      });
    }

    loadApplications().finally(() => {
      if (resultsCount) resultsCount.textContent = '0 requests';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
