(function () {
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const REQUESTS_API = API_BASE + '/api/improvements-corrections';
  const APPS_API = API_BASE + '/api/system-applications';

  const requestNumberInput = document.getElementById('searchRequestNumber');
  const requestTypeSelect = document.getElementById('searchRequestType');
  const applicationSelect = document.getElementById('searchApplication');
  const situationSelect = document.getElementById('searchSituation');
  const createdByInput = document.getElementById('searchCreatedByName');
  const requestDateFromInput = document.getElementById('searchRequestDateFrom');
  const requestDateToInput = document.getElementById('searchRequestDateTo');
  const finishDateFromInput = document.getElementById('searchFinishDateFrom');
  const finishDateToInput = document.getElementById('searchFinishDateTo');
  const descriptionInput = document.getElementById('searchDescription');

  const applyBtn = document.getElementById('applySearchBtn');
  const clearBtn = document.getElementById('clearSearchBtn');

  const messageEl = document.getElementById('requestMessage');
  const tableBody = document.getElementById('requestsSearchTableBody');
  const resultsCount = document.getElementById('resultsCount');

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
    if (value === 'IN_CLIENT_VALIDATION') return 'In client validation';
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

  function populateApplications(list) {
    if (!applicationSelect) return;
    const apps = Array.isArray(list) ? list.slice() : [];
    const options = ['<option value="">All applications</option>']
      .concat(apps.map((app) => {
        const name = app.syapNmApplication || app.syap_nm_application || '';
        const menu = app.syapDsDetailed || app.syap_ds_detailed || name;
        const label = menu && menu !== name
          ? (menu.replace(/_/g, ' ') + ' (' + name + ')')
          : name;
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
    if (finishDateFromInput && finishDateFromInput.value) params.set('finishDateFrom', finishDateFromInput.value);
    if (finishDateToInput && finishDateToInput.value) params.set('finishDateTo', finishDateToInput.value);
    if (descriptionInput && descriptionInput.value.trim()) params.set('description', descriptionInput.value.trim());

    return params;
  }

  async function runSearch() {
    try {
      if (resultsCount) resultsCount.textContent = 'Loading...';
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
      if (resultsCount) resultsCount.textContent = list.length + ' record(s)';
      if (!tableBody) return;

      if (!list.length) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No requests found.</p></td></tr>';
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

  function clearFilters() {
    if (requestNumberInput) requestNumberInput.value = '';
    if (requestTypeSelect) requestTypeSelect.value = '';
    if (applicationSelect) applicationSelect.value = '';
    if (situationSelect) situationSelect.value = '';
    if (createdByInput) createdByInput.value = '';
    if (requestDateFromInput) requestDateFromInput.value = '';
    if (requestDateToInput) requestDateToInput.value = '';
    if (finishDateFromInput) finishDateFromInput.value = '';
    if (finishDateToInput) finishDateToInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  }

  function init() {
    if (applyBtn) applyBtn.addEventListener('click', runSearch);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      clearFilters();
      runSearch();
    });

    loadApplications().finally(() => {
      // Load initial results without filters.
      runSearch();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

