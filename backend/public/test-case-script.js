(function () {
  const API_BASE = '/api/test-cases';
  const AUTH_API = '/api/auth/check';
  const MAX_FILE_SIZE = 7 * 1024 * 1024;

  const isSearchPage = Boolean(document.getElementById('testCaseSearchSection'));
  const modal = document.getElementById('testCaseModal');
  const form = document.getElementById('testCaseForm');
  const recordIdInput = document.getElementById('testCaseRecordId');
  const testCaseIdInput = document.getElementById('testCaseId');
  const moduleSelect = document.getElementById('testModule');
  const statusSelect = document.getElementById('testStatus');
  const severitySelect = document.getElementById('testSeverity');
  const testerInput = document.getElementById('testTester');
  const executionDateInput = document.getElementById('testExecutionDate');
  const evidenceInput = document.getElementById('testEvidence');
  const currentEvidenceEl = document.getElementById('currentEvidence');
  const scenarioInput = document.getElementById('testScenario');
  const preConditionInput = document.getElementById('testPreCondition');
  const stepsInput = document.getElementById('testSteps');
  const expectedInput = document.getElementById('testExpectedResult');
  const commentsInput = document.getElementById('testComments');
  const formTitle = document.getElementById('formTitle');
  const saveBtn = document.getElementById('saveTestCaseBtn');
  const formMessageEl = document.getElementById('testCaseMessage');
  const pageMessageEl = document.getElementById('pageMessage');
  const tableBody = document.getElementById('testCaseTableBody');
  const searchResultsMeta = document.getElementById('searchResultsMeta');
  const resultsCount = document.getElementById('testCaseSearchResultsCount');
  const searchByField = document.getElementById('searchByField');
  const searchInput = document.getElementById('searchInput');
  const filterModule = document.getElementById('filterModule');
  const filterStatus = document.getElementById('filterStatus');
  const filterSeverity = document.getElementById('filterSeverity');
  const sortBy = document.getElementById('sortBy');

  let options = { modules: [], statuses: [], severities: [] };
  let records = [];
  let currentUserName = '';
  let hasSearched = false;
  let loggedUserExportPrefix = null;

  const SEARCH_PLACEHOLDERS = {
    testCaseId: 'TC-0001',
    testScenario: 'Scenario text',
    tester: 'Tester name'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = el.id === 'pageMessage'
      ? `tc-page-message show ${type || 'info'}`
      : `tc-form-message show ${type || 'info'}`;
  }

  function clearMessage(el, className) {
    if (!el) return;
    el.textContent = '';
    el.className = className;
  }

  function fillSelect(selectEl, values, emptyLabel) {
    if (!selectEl) return;
    const current = selectEl.value;
    const optionsHtml = (values || []).map((value) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    ).join('');
    selectEl.innerHTML = emptyLabel
      ? `<option value="">${escapeHtml(emptyLabel)}</option>${optionsHtml}`
      : optionsHtml;
    if (current && values.includes(current)) selectEl.value = current;
  }

  function formatDate(value) {
    if (!value) return '';
    const text = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return String(value);
    const [y, m, d] = text.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatExportFileDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function sanitizeFileNamePart(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'user';
  }

  function statusPill(status) {
    const key = String(status || '').toLowerCase();
    if (key === 'pass') return 'tc-pill-pass';
    if (key === 'fail') return 'tc-pill-fail';
    if (key === 'blocked') return 'tc-pill-blocked';
    if (key === 'in progress') return 'tc-pill-progress';
    return 'tc-pill-idle';
  }

  function severityPill(severity) {
    const key = String(severity || '').toLowerCase();
    if (key === 'critical') return 'tc-pill-critical';
    if (key === 'high') return 'tc-pill-high';
    if (key === 'low') return 'tc-pill-low';
    return 'tc-pill-medium';
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  function openModal() {
    if (!modal) return;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    clearMessage(formMessageEl, 'tc-form-message');
  }

  function resetForm() {
    if (form) form.reset();
    if (recordIdInput) recordIdInput.value = '';
    if (currentEvidenceEl) currentEvidenceEl.textContent = '';
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    clearMessage(formMessageEl, 'tc-form-message');
  }

  function closeTestCaseScreen() {
    resetForm();
    closeModal();
    window.location.href = 'warehouse.html';
  }

  function updateSearchPlaceholder() {
    if (!searchInput || !searchByField) return;
    searchInput.placeholder = SEARCH_PLACEHOLDERS[searchByField.value] || 'Search';
  }

  async function getLoggedUserExportPrefix() {
    if (loggedUserExportPrefix) return loggedUserExportPrefix;
    try {
      const res = await fetch(AUTH_API, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        if (data.user.isRoot) loggedUserExportPrefix = 'root';
        else if (data.user.email) loggedUserExportPrefix = sanitizeFileNamePart(data.user.email);
        else loggedUserExportPrefix = 'user';
      } else {
        loggedUserExportPrefix = 'user';
      }
    } catch {
      loggedUserExportPrefix = 'user';
    }
    return loggedUserExportPrefix;
  }

  async function loadLoggedUser() {
    try {
      const res = await fetch(AUTH_API, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        currentUserName = data.user.isRoot ? 'Root' : (data.user.nome || data.user.email || '');
      }
    } catch {
      currentUserName = '';
    }
  }

  async function loadOptions() {
    const res = await fetch(`${API_BASE}/options`, { credentials: 'same-origin' });
    const data = await res.json();
    options = data.success && data.data ? data.data : options;
    fillSelect(moduleSelect, options.modules, 'Select module');
    fillSelect(statusSelect, options.statuses);
    fillSelect(severitySelect, options.severities);
    fillSelect(filterModule, options.modules, 'All Modules');
    fillSelect(filterStatus, options.statuses, 'All Status');
    fillSelect(filterSeverity, options.severities, 'All Severity');
  }

  async function loadNextId() {
    const res = await fetch(`${API_BASE}/next-id`, { credentials: 'same-origin' });
    const data = await res.json();
    if (data.success && data.data && testCaseIdInput) {
      testCaseIdInput.value = data.data.testCaseId;
    }
  }

  function fillForm(record) {
    clearMessage(formMessageEl, 'tc-form-message');
    if (record) {
      formTitle.innerHTML = `<i class="fas fa-clipboard-check"></i> Edit ${escapeHtml(record.testCaseId)}`;
      recordIdInput.value = record.id;
      testCaseIdInput.value = record.testCaseId;
      moduleSelect.value = record.module || '';
      statusSelect.value = record.status || 'Not Executed';
      severitySelect.value = record.severity || 'Medium';
      testerInput.value = record.tester || '';
      executionDateInput.value = record.executionDate ? String(record.executionDate).slice(0, 10) : '';
      scenarioInput.value = record.testScenario || '';
      preConditionInput.value = record.preCondition || '';
      stepsInput.value = record.testSteps || '';
      expectedInput.value = record.expectedResult || '';
      commentsInput.value = record.comments || '';
      evidenceInput.value = '';
      currentEvidenceEl.innerHTML = record.hasEvidence && record.evidenceFileName
        ? `Current file: <a href="${API_BASE}/${encodeURIComponent(record.id)}/evidence" target="_blank" rel="noopener">${escapeHtml(record.evidenceFileName)}</a>`
        : '';
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
      openModal();
      return;
    }

    formTitle.innerHTML = '<i class="fas fa-clipboard-check"></i> New Test Case';
    recordIdInput.value = '';
    moduleSelect.value = '';
    statusSelect.value = 'Not Executed';
    severitySelect.value = 'Medium';
    testerInput.value = currentUserName;
    executionDateInput.value = '';
    scenarioInput.value = '';
    preConditionInput.value = '';
    stepsInput.value = '';
    expectedInput.value = '';
    commentsInput.value = '';
    evidenceInput.value = '';
    currentEvidenceEl.textContent = '';
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    loadNextId();
    openModal();
  }

  function sortedRecords() {
    const key = sortBy && sortBy.value ? sortBy.value : 'testCaseId';
    const list = records.slice();
    list.sort((a, b) => {
      if (key === 'testCaseId') {
        return (a.testCaseNumber || 0) - (b.testCaseNumber || 0);
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' });
    });
    return list;
  }

  function renderTable() {
    if (!tableBody) return;
    const list = sortedRecords();

    if (searchResultsMeta) {
      searchResultsMeta.style.display = hasSearched ? 'flex' : 'none';
    }
    if (resultsCount) {
      resultsCount.textContent = `${list.length} record${list.length === 1 ? '' : 's'}`;
    }

    if (!list.length) {
      const message = hasSearched
        ? 'No test cases found.'
        : 'Use search or filters and click <strong>Search</strong> to load test cases.';
      const icon = hasSearched ? 'fa-inbox' : 'fa-search';
      tableBody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="7" class="empty-state">
            <i class="fas ${icon}"></i>
            <p>${message}</p>
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = list.map((item) => {
      const evidenceBtn = item.hasEvidence
        ? `<button type="button" class="btn-action view" data-action="evidence" data-id="${escapeHtml(item.id)}" title="Open evidence">
             <i class="fas fa-paperclip"></i> <span>File</span>
           </button>`
        : '';
      return `
        <tr class="item-data-row">
          <td data-label="Test Case ID"><strong>${escapeHtml(item.testCaseId)}</strong></td>
          <td data-label="Module">${escapeHtml(item.module || '-')}</td>
          <td data-label="Test Scenario" class="tc-scenario-cell">${escapeHtml(item.testScenario || '-')}</td>
          <td data-label="Status"><span class="tc-pill ${statusPill(item.status)}">${escapeHtml(item.status || '-')}</span></td>
          <td data-label="Severity"><span class="tc-pill ${severityPill(item.severity)}">${escapeHtml(item.severity || '-')}</span></td>
          <td data-label="Tester">${escapeHtml(item.tester || '-')}</td>
          <td data-label="Execution Date">${escapeHtml(formatDate(item.executionDate) || '-')}</td>
        </tr>
        <tr class="item-actions-row">
          <td colspan="7" class="action-buttons-cell">
            <div class="action-buttons">
              <button type="button" class="btn-action edit" data-action="edit" data-id="${escapeHtml(item.id)}" title="Edit">
                <i class="fas fa-edit"></i> <span>Edit</span>
              </button>
              ${evidenceBtn}
              <button type="button" class="btn-action delete" data-action="delete" data-id="${escapeHtml(item.id)}" data-code="${escapeHtml(item.testCaseId)}" title="Delete">
                <i class="fas fa-trash"></i> <span>Del.</span>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  async function searchRecords() {
    if (!isSearchPage) return;
    const params = new URLSearchParams();
    const field = searchByField ? searchByField.value : 'testCaseId';
    const term = searchInput ? searchInput.value.trim() : '';
    if (term) {
      if (field === 'tester') params.set('tester', term);
      else if (field === 'testScenario') params.set('testScenario', term);
      else params.set('testCaseId', term);
    }
    if (filterModule && filterModule.value) params.set('module', filterModule.value);
    if (filterStatus && filterStatus.value) params.set('status', filterStatus.value);
    if (filterSeverity && filterSeverity.value) params.set('severity', filterSeverity.value);

    hasSearched = true;
    try {
      const res = await fetch(`${API_BASE}?${params}`, { credentials: 'same-origin' });
      const data = await res.json();
      records = data.success && Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error(error);
      records = [];
      showMessage(pageMessageEl, 'Error loading test cases.', 'error');
    }
    renderTable();
  }

  function buildTestCasesExcelXml(list) {
    const headers = [
      'Test Case ID',
      'Module',
      'Test Scenario',
      'Status',
      'Severity',
      'Tester',
      'Execution Date'
    ];
    const headerRow = headers.map((header) =>
      `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
    ).join('');
    const dataRows = list.map((item) => `<Row>${[
      `<Cell><Data ss:Type="String">${escapeXml(item.testCaseId || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(item.module || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(item.testScenario || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(item.status || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(item.severity || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(item.tester || '')}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(formatDate(item.executionDate) || '')}</Data></Cell>`
    ].join('')}</Row>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Test Cases">
<Table ss:ExpandedColumnCount="${headers.length}" ss:ExpandedRowCount="${list.length + 1}">
<Column ss:Width="110"/>
<Column ss:Width="140"/>
<Column ss:Width="280"/>
<Column ss:Width="110"/>
<Column ss:Width="90"/>
<Column ss:Width="120"/>
<Column ss:Width="120"/>
<Row>${headerRow}</Row>
${dataRows}
</Table>
</Worksheet>
</Workbook>`;
  }

  async function downloadExcel() {
    const list = sortedRecords();
    if (!list.length) {
      alert('No test cases to export. Adjust filters or run Search first.');
      return;
    }
    const userPrefix = await getLoggedUserExportPrefix();
    const xml = buildTestCasesExcelXml(list);
    const blob = new Blob(['\ufeff', xml], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userPrefix}-test-cases-search-${formatExportFileDate(new Date())}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteRecord(id, code) {
    if (!confirm(`Delete test case ${code}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to delete.');
      showMessage(pageMessageEl, `${code} deleted.`, 'success');
      if (recordIdInput.value === id) closeModal();
      await searchRecords();
    } catch (error) {
      showMessage(pageMessageEl, error.message || 'Error deleting test case.', 'error');
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    clearMessage(formMessageEl, 'tc-form-message');

    if (!moduleSelect.value) {
      showMessage(formMessageEl, 'Please select a Module.', 'error');
      moduleSelect.focus();
      return;
    }
    if (!scenarioInput.value.trim()) {
      showMessage(formMessageEl, 'Test Scenario is required.', 'error');
      scenarioInput.focus();
      return;
    }

    const file = evidenceInput.files && evidenceInput.files[0];
    if (file && file.size > MAX_FILE_SIZE) {
      showMessage(formMessageEl, 'Evidence file size must be less than 7 MB.', 'error');
      return;
    }

    const payload = {
      module: moduleSelect.value,
      status: statusSelect.value || 'Not Executed',
      severity: severitySelect.value || 'Medium',
      tester: testerInput.value.trim(),
      executionDate: executionDateInput.value || null,
      testScenario: scenarioInput.value.trim(),
      preCondition: preConditionInput.value.trim(),
      testSteps: stepsInput.value.trim(),
      expectedResult: expectedInput.value.trim(),
      comments: commentsInput.value.trim()
    };

    if (file) {
      payload.fileName = file.name;
      payload.mimeType = file.type || 'application/octet-stream';
      payload.fileBase64 = await readFileAsBase64(file);
    }

    const editingId = recordIdInput.value.trim();
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const res = await fetch(editingId ? `${API_BASE}/${encodeURIComponent(editingId)}` : API_BASE, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to save test case.');

      closeModal();
      showMessage(pageMessageEl, editingId ? 'Test case updated.' : `Test case ${data.data.testCaseId} saved.`, 'success');
      if (isSearchPage && hasSearched) await searchRecords();
    } catch (error) {
      showMessage(formMessageEl, error.message || 'Error saving test case.', 'error');
      saveBtn.innerHTML = editingId ? '<i class="fas fa-save"></i> Update' : '<i class="fas fa-save"></i> Save';
    } finally {
      saveBtn.disabled = false;
      if (!recordIdInput.value) saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
  }

  function bindSearchPage() {
    const searchBtn = document.getElementById('searchBtn');
    const clearSearch = document.getElementById('clearSearch');
    const downloadBtn = document.getElementById('downloadTestCasesExcel');
    const cancelSearchPageBtn = document.getElementById('cancelSearchPageBtn');

    if (searchBtn) searchBtn.addEventListener('click', searchRecords);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadExcel);
    if (cancelSearchPageBtn) cancelSearchPageBtn.addEventListener('click', closeTestCaseScreen);
    if (searchByField) {
      searchByField.addEventListener('change', updateSearchPlaceholder);
      updateSearchPlaceholder();
    }
    if (searchInput) {
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          searchRecords();
        }
      });
    }
    if (sortBy) sortBy.addEventListener('change', () => {
      if (hasSearched) renderTable();
    });
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (searchByField) searchByField.value = 'testCaseId';
        if (filterModule) filterModule.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterSeverity) filterSeverity.value = '';
        if (sortBy) sortBy.value = 'testCaseId';
        records = [];
        hasSearched = false;
        clearMessage(pageMessageEl, 'tc-page-message');
        updateSearchPlaceholder();
        renderTable();
      });
    }
    if (tableBody) {
      tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-action');
        if (!button) return;
        const action = button.getAttribute('data-action');
        const id = button.getAttribute('data-id');
        if (action === 'edit') {
          const record = records.find((item) => item.id === id);
          if (record) fillForm(record);
        } else if (action === 'delete') {
          deleteRecord(id, button.getAttribute('data-code'));
        } else if (action === 'evidence') {
          window.open(`${API_BASE}/${encodeURIComponent(id)}/evidence`, '_blank', 'noopener');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadOptions(), loadLoggedUser()]);

    const newBtn = document.getElementById('newTestCaseBtn');
    const closeBtn = document.getElementById('closeTestCaseModal');
    const cancelBtn = document.getElementById('clearTestCaseBtn');

    if (newBtn) newBtn.addEventListener('click', () => fillForm(null));
    if (closeBtn) closeBtn.addEventListener('click', isSearchPage ? closeModal : closeTestCaseScreen);
    if (cancelBtn) cancelBtn.addEventListener('click', isSearchPage ? closeModal : closeTestCaseScreen);
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          if (isSearchPage) closeModal();
          else closeTestCaseScreen();
        }
      });
    }
    if (form) form.addEventListener('submit', handleSave);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') {
        if (isSearchPage) closeModal();
        else closeTestCaseScreen();
      }
    });

    if (isSearchPage) {
      bindSearchPage();
      renderTable();
    } else {
      fillForm(null);
    }
  });
})();
