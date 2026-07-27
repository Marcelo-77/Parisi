(function () {
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const REQUESTS_API = API_BASE + '/api/improvements-corrections';
  const APPS_API = API_BASE + '/api/system-applications';
  const AUTH_API = API_BASE + '/api/auth/check';
  const USERS_API = API_BASE + '/api/funcionarios';
  const ROOT_REQUESTER_VALUE = 'root';

  const form = document.getElementById('improvementsForm');
  const descriptionInput = document.getElementById('requestDescription');
  const descriptionCount = document.getElementById('descriptionCount');
  const requestTypeSelect = document.getElementById('requestType');
  const applicationGroup = document.getElementById('applicationGroup');
  const applicationSelect = document.getElementById('requestApplication');
  const situationSelect = document.getElementById('requestSituation');
  const requestDateInput = document.getElementById('requestDate');
  const finishDateInput = document.getElementById('finishDate');
  const requestNumberDisplay = document.getElementById('requestNumberDisplay');
  const requestedByDisplay = document.getElementById('requestedByDisplay');
  const requestedBySelect = document.getElementById('requestedBySelect');
  const clearBtn = document.getElementById('clearRequestBtn');
  const saveBtn = document.getElementById('saveRequestBtn');
  const messageEl = document.getElementById('requestMessage');
  const tableBody = document.getElementById('requestsTableBody');
  const resultsCount = document.getElementById('resultsCount');

  let applications = [];
  let isRootUser = false;
  let loadedUsers = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.className = 'improvements-message show ' + (type || 'info');
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.className = 'improvements-message';
  }

  function updateDescriptionCount() {
    if (!descriptionInput || !descriptionCount) return;
    descriptionCount.textContent = String(descriptionInput.value.length) + ' / 4000';
  }

  function requiresApplication(type) {
    return type === 'IMPROVEMENT' || type === 'CORRECTION';
  }

  function formatRequestType(type) {
    const value = String(type || '').toUpperCase();
    if (value === 'IMPROVEMENT') return 'Improvements';
    if (value === 'CORRECTION') return 'Corrections';
    if (value === 'NEW_FUNCTIONALITY') return 'New Functionality';
    return value || '-';
  }

  function formatSituation(situation) {
    const value = String(situation || '').toUpperCase().replace(/[\s-]+/g, '_');
    if (value === 'NOT_STARTED') return 'Not started';
    if (value === 'IN_DEVELOPMENT') return 'In development';
    if (value === 'IN_TESTING') return 'In testing';
    if (value === 'IN_CLIENT_VALIDATION') return 'In client validation';
    if (value === 'LIVE') return 'Live';
    if (value === 'CANCELLED') return 'Cancelled';
    return situation || '-';
  }

  function situationCssClass(situation) {
    const value = String(situation || '').toUpperCase().replace(/[\s-]+/g, '_');
    if (value === 'NOT_STARTED') return 'situation-not-started';
    if (value === 'IN_DEVELOPMENT') return 'situation-in-development';
    if (value === 'IN_TESTING') return 'situation-in-testing';
    if (value === 'IN_CLIENT_VALIDATION') return 'situation-in-client-validation';
    if (value === 'LIVE') return 'situation-live';
    if (value === 'CANCELLED') return 'situation-cancelled';
    return '';
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function todayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function toggleApplicationField() {
    const type = requestTypeSelect ? requestTypeSelect.value : '';
    const show = requiresApplication(type);
    if (applicationGroup) {
      if (show) applicationGroup.classList.remove('is-hidden');
      else applicationGroup.classList.add('is-hidden');
    }
    if (applicationSelect) {
      applicationSelect.required = show;
      if (!show) applicationSelect.value = '';
    }
  }

  function populateApplications(list) {
    applications = Array.isArray(list) ? list.slice() : [];
    if (!applicationSelect) return;
    const options = ['<option value="">Select application…</option>']
      .concat(applications.map((app) => {
        const name = app.syapNmApplication || app.syap_nm_application || '';
        const menu = app.syapDsDetailed || app.syap_ds_detailed || name;
        const label = menu && menu !== name ? (menu.replace(/_/g, ' ') + ' (' + name + ')') : name;
        return '<option value="' + escapeHtml(name) + '" data-menu="' + escapeHtml(menu) + '">'
          + escapeHtml(label) + '</option>';
      }));
    applicationSelect.innerHTML = options.join('');
  }

  async function loadApplications() {
    try {
      const res = await fetch(APPS_API, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load applications');
      }
      populateApplications(data.data || []);
    } catch (error) {
      console.error(error);
    }
  }

  function toggleRequestedByField() {
    if (requestedByDisplay) {
      requestedByDisplay.style.display = isRootUser ? 'none' : '';
    }
    if (requestedBySelect) {
      // HTML inicial já vem com `class="is-hidden"`, então precisamos mexer na classe também.
      requestedBySelect.classList.toggle('is-hidden', !isRootUser);
      requestedBySelect.style.display = isRootUser ? 'block' : 'none';
      requestedBySelect.required = isRootUser;
    }
  }

  function populateUsers(list) {
    loadedUsers = Array.isArray(list) ? list.slice() : [];
    if (!requestedBySelect) return;
    const options = ['<option value="">Select user…</option>',
      '<option value="' + ROOT_REQUESTER_VALUE + '">Root</option>'
    ].concat(loadedUsers.map((user) => {
        const name = user.nome || user.name || user.email || 'User';
        const email = user.email || '';
        const label = email ? (name + ' (' + email + ')') : name;
        return '<option value="' + escapeHtml(user.id) + '">' + escapeHtml(label) + '</option>';
      }));
    requestedBySelect.innerHTML = options.join('');
  }

  async function loadUsersForRoot() {
    try {
      const res = await fetch(USERS_API + '?ativo=true&ordenarPor=nome&direcao=asc', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load users');
      }
      populateUsers(data.data || []);
      if (requestedBySelect) requestedBySelect.value = ROOT_REQUESTER_VALUE;
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Unable to load users', 'error');
    }
  }

  async function loadLoggedUser() {
    try {
      const res = await fetch(AUTH_API, { credentials: 'include' });
      const data = await res.json();
      const user = data.user || {};
      isRootUser = Boolean(data.isRoot || user.isRoot);

      toggleRequestedByField();

      if (isRootUser) {
        await loadUsersForRoot();
        return;
      }

      if (data.authenticated && user.nome) {
        const name = user.nome || user.name || user.email || '';
        if (requestedByDisplay && name) {
          requestedByDisplay.value = name;
        }
      }
    } catch (_) {}
  }

  async function loadRequests() {
    try {
      const res = await fetch(REQUESTS_API, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && data.error) || 'Unable to load requests');
      }
      const list = data.data || [];
      if (resultsCount) resultsCount.textContent = list.length + ' record(s)';
      if (!tableBody) return;
      if (!list.length) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-inbox"></i><p>No requests yet.</p></td></tr>';
        return;
      }
      tableBody.innerHTML = list.map((row) => {
        const appLabel = row.applicationMenu
          ? String(row.applicationMenu).replace(/_/g, ' ')
          : (row.applicationName || (row.requestType === 'NEW_FUNCTIONALITY' ? '—' : '-'));
        const desc = String(row.description || '');
        const shortDesc = desc.length > 120 ? desc.slice(0, 117) + '…' : desc;
        const sitClass = situationCssClass(row.situation);
        return '<tr>'
          + '<td>' + escapeHtml(row.requestNumber || '-') + '</td>'
          + '<td>' + escapeHtml(formatDate(row.requestDate || row.criadoEm)) + '</td>'
          + '<td>' + escapeHtml(formatDate(row.finishDate || row.finish_date || null)) + '</td>'
          + '<td>' + escapeHtml(formatRequestType(row.requestType)) + '</td>'
          + '<td>' + escapeHtml(appLabel) + '</td>'
          + '<td title="' + escapeHtml(desc) + '">' + escapeHtml(shortDesc) + '</td>'
          + '<td>' + escapeHtml(row.createdByName || '-') + '</td>'
          + '<td class="' + sitClass + '">' + escapeHtml(formatSituation(row.situation)) + '</td>'
          + '</tr>';
      }).join('');
    } catch (error) {
      console.error(error);
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><p class="error-state">Error loading requests.</p></td></tr>';
      }
    }
  }

  function clearForm({ keepRequestNumber = false } = {}) {
    if (descriptionInput) descriptionInput.value = '';
    if (requestTypeSelect) requestTypeSelect.value = '';
    if (applicationSelect) applicationSelect.value = '';
    if (situationSelect) situationSelect.value = 'NOT_STARTED';
    if (requestDateInput) requestDateInput.value = todayDateString();
    if (finishDateInput) finishDateInput.value = '';
    if (requestedBySelect) requestedBySelect.value = isRootUser ? ROOT_REQUESTER_VALUE : '';
    if (!keepRequestNumber && requestNumberDisplay) requestNumberDisplay.value = '';
    toggleApplicationField();
    updateDescriptionCount();
    clearMessage();
    if (descriptionInput) descriptionInput.focus();
  }

  async function saveRequest(event) {
    event.preventDefault();
    clearMessage();

    const description = descriptionInput ? descriptionInput.value.trim() : '';
    const requestType = requestTypeSelect ? requestTypeSelect.value : '';
    const applicationOption = applicationSelect && applicationSelect.selectedOptions
      ? applicationSelect.selectedOptions[0]
      : null;
    const applicationName = applicationSelect ? applicationSelect.value.trim() : '';
    const applicationMenu = applicationOption
      ? (applicationOption.getAttribute('data-menu') || '').trim()
      : '';
    const situation = situationSelect ? situationSelect.value : 'NOT_STARTED';
    const requestDate = requestDateInput ? requestDateInput.value : '';
    const finishDate = finishDateInput ? finishDateInput.value : '';

    if (!description) {
      showMessage('Please enter the request description.', 'error');
      if (descriptionInput) descriptionInput.focus();
      return;
    }
    if (!requestType) {
      showMessage('Please select the request type.', 'error');
      if (requestTypeSelect) requestTypeSelect.focus();
      return;
    }
    if (requiresApplication(requestType) && !applicationName) {
      showMessage('Please select the application for Improvements or Corrections.', 'error');
      if (applicationSelect) applicationSelect.focus();
      return;
    }
    if (isRootUser && requestedBySelect && !requestedBySelect.value) {
      showMessage('Please select the user who requested this.', 'error');
      requestedBySelect.focus();
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

    if (isRootUser && requestedBySelect && requestedBySelect.value) {
      payload.createdBy = requestedBySelect.value;
    }

    if (saveBtn) saveBtn.disabled = true;
    try {
      const res = await fetch(REQUESTS_API, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to save request');
      }
      showMessage(data.message || 'Request saved successfully.', 'success');
      if (requestNumberDisplay && data.data && data.data.requestNumber != null) {
        requestNumberDisplay.value = data.data.requestNumber;
      }
      clearForm({ keepRequestNumber: true });
      await loadRequests();
    } catch (error) {
      showMessage(error.message || 'Unable to save request', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function init() {
    if (descriptionInput) {
      descriptionInput.addEventListener('input', updateDescriptionCount);
    }
    if (requestTypeSelect) {
      requestTypeSelect.addEventListener('change', toggleApplicationField);
    }
    if (clearBtn) clearBtn.addEventListener('click', () => clearForm());
    if (form) form.addEventListener('submit', saveRequest);

    if (requestDateInput) requestDateInput.value = todayDateString();
    toggleApplicationField();
    updateDescriptionCount();
    loadApplications();
    loadLoggedUser();
    loadRequests();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
