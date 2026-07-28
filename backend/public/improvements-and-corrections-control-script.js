(function () {
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const REQUESTS_API = API_BASE + '/api/improvements-corrections';
  const APPS_API = API_BASE + '/api/system-applications';
  const AUTH_API = API_BASE + '/api/auth/check';
  const MENU_ACCESS_API = API_BASE + '/api/auth/menu-access';
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
    messageEl.className = 'ic-control-message show ' + (type || 'info');
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.className = 'ic-control-message';
  }

  function updateDescriptionCount() {
    if (!descriptionInput || !descriptionCount) return;
    descriptionCount.textContent = String(descriptionInput.value.length) + ' / 4000';
  }

  function requiresApplication(type) {
    return type === 'IMPROVEMENT' || type === 'CORRECTION';
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
    const needsApp = requiresApplication(type);
    if (applicationGroup) {
      applicationGroup.classList.toggle('is-disabled', type === 'NEW_FUNCTIONALITY');
    }
    if (applicationSelect) {
      applicationSelect.disabled = type === 'NEW_FUNCTIONALITY';
      applicationSelect.required = needsApp;
      if (!needsApp) applicationSelect.value = '';
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
          const isRoot = Boolean(accessData.isRoot || (accessData.user && accessData.user.isRoot));
          if (!isRoot) {
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
      const savedRequestNumber = data && data.data && data.data.requestNumber != null
        ? String(data.data.requestNumber)
        : '';
      showMessage(
        savedRequestNumber
          ? ('Request #' + savedRequestNumber + ' saved successfully.')
          : (data.message || 'Request saved successfully.'),
        'success'
      );
      if (requestNumberDisplay && savedRequestNumber) {
        requestNumberDisplay.value = savedRequestNumber;
      }
      window.alert(
        savedRequestNumber
          ? ('Request #' + savedRequestNumber + ' was saved successfully.')
          : 'Request saved successfully.'
      );
      clearForm({ keepRequestNumber: true });
    } catch (error) {
      showMessage(error.message || 'Unable to save request', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function focusForm() {
    const panel = document.getElementById('icControlFormPanel');
    if (panel) {
      const offset = 8;
      const top = panel.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }
    const focusTarget = requestTypeSelect || descriptionInput;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (_) {
        focusTarget.focus();
      }
    }
  }

  function init() {
    if (descriptionInput) {
      descriptionInput.addEventListener('input', updateDescriptionCount);
    }
    if (requestTypeSelect) {
      requestTypeSelect.addEventListener('change', toggleApplicationField);
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        window.location.href = 'warehouse.html';
      });
    }
    if (form) form.addEventListener('submit', saveRequest);

    if (requestDateInput) requestDateInput.value = todayDateString();
    toggleApplicationField();
    updateDescriptionCount();
    loadApplications();
    loadLoggedUser();

    // Bring form into view and focus first field (same idea as location.html)
    requestAnimationFrame(() => {
      focusForm();
      setTimeout(focusForm, 50);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
