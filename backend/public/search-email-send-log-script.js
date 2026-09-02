(function () {
  const API = '/api/email-send-log';

  const searchTerm = document.getElementById('searchTerm');
  const searchMessageCode = document.getElementById('searchMessageCode');
  const searchToEmail = document.getElementById('searchToEmail');
  const searchSubject = document.getElementById('searchSubject');
  const searchSendStatus = document.getElementById('searchSendStatus');
  const searchReferenceNumber = document.getElementById('searchReferenceNumber');
  const searchSentByName = document.getElementById('searchSentByName');
  const searchDateFrom = document.getElementById('searchDateFrom');
  const searchDateTo = document.getElementById('searchDateTo');
  const applyBtn = document.getElementById('applySearchBtn');
  const clearBtn = document.getElementById('clearSearchBtn');
  const tableBody = document.getElementById('emailLogTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTime = document.getElementById('resultsTime');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const noResults = document.getElementById('noResults');

  const viewModal = document.getElementById('viewEmailLogModal');
  const closeViewModalBtn = document.getElementById('closeViewEmailLogModal');
  const cancelViewModalBtn = document.getElementById('cancelViewEmailLogModal');
  const viewLogSubject = document.getElementById('viewLogSubject');
  const viewLogStatus = document.getElementById('viewLogStatus');
  const viewLogFrom = document.getElementById('viewLogFrom');
  const viewLogTo = document.getElementById('viewLogTo');
  const viewLogTemplate = document.getElementById('viewLogTemplate');
  const viewLogReference = document.getElementById('viewLogReference');
  const viewLogSentBy = document.getElementById('viewLogSentBy');
  const viewLogSentAt = document.getElementById('viewLogSentAt');
  const viewLogError = document.getElementById('viewLogError');
  const viewLogBody = document.getElementById('viewLogBody');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatStatus(value) {
    const status = String(value || '').toUpperCase();
    if (status === 'SENT') return 'Sent';
    if (status === 'FAILED') return 'Failed';
    if (status === 'SKIPPED') return 'Skipped';
    return value || '-';
  }

  function statusClass(value) {
    const status = String(value || '').toUpperCase();
    if (status === 'SENT') return 'email-log-status-sent';
    if (status === 'FAILED') return 'email-log-status-failed';
    if (status === 'SKIPPED') return 'email-log-status-skipped';
    return '';
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  }

  function truncate(text, max) {
    const value = String(text || '');
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  function buildSearchParams() {
    const params = new URLSearchParams();
    if (searchTerm?.value.trim()) params.set('search', searchTerm.value.trim());
    if (searchMessageCode?.value.trim()) params.set('messageCode', searchMessageCode.value.trim());
    if (searchToEmail?.value.trim()) params.set('toEmail', searchToEmail.value.trim());
    if (searchSubject?.value.trim()) params.set('subject', searchSubject.value.trim());
    if (searchSendStatus?.value) params.set('sendStatus', searchSendStatus.value);
    if (searchReferenceNumber?.value.trim()) params.set('referenceNumber', searchReferenceNumber.value.trim());
    if (searchSentByName?.value.trim()) params.set('sentByName', searchSentByName.value.trim());
    if (searchDateFrom?.value) params.set('dateFrom', searchDateFrom.value);
    if (searchDateTo?.value) params.set('dateTo', searchDateTo.value);
    return params;
  }

  function openViewModal(row) {
    if (!row || !viewModal) return;
    if (viewLogSubject) viewLogSubject.textContent = row.subject || '-';
    if (viewLogStatus) {
      viewLogStatus.textContent = formatStatus(row.sendStatus);
      viewLogStatus.className = 'status-badge ' + statusClass(row.sendStatus);
    }
    if (viewLogFrom) viewLogFrom.textContent = row.fromEmail || '-';
    if (viewLogTo) {
      viewLogTo.textContent = row.toEmail
        ? ((row.toName || 'Recipient') + ' <' + row.toEmail + '>')
        : (row.toName || '-');
    }
    if (viewLogTemplate) viewLogTemplate.textContent = row.messageCode || '-';
    if (viewLogReference) {
      viewLogReference.textContent = row.referenceNumber != null
        ? ('Request #' + row.referenceNumber)
        : (row.referenceType || '-');
    }
    if (viewLogSentBy) viewLogSentBy.textContent = row.sentByName || '-';
    if (viewLogSentAt) viewLogSentAt.textContent = formatDateTime(row.criadoEm);
    if (viewLogError) {
      viewLogError.textContent = row.errorMessage || '-';
      viewLogError.parentElement.style.display = row.errorMessage ? 'block' : 'none';
    }
    if (viewLogBody) viewLogBody.textContent = row.bodyPreview || '-';
    viewModal.classList.add('show');
    viewModal.setAttribute('aria-hidden', 'false');
  }

  function closeViewModal() {
    if (!viewModal) return;
    viewModal.classList.remove('show');
    viewModal.setAttribute('aria-hidden', 'true');
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
        throw new Error((data && (data.error || data.message)) || 'Unable to load email send logs');
      }

      const list = data.data || [];
      const elapsedMs = Date.now() - startedAt;
      if (resultsCount) {
        resultsCount.textContent = list.length + ' log' + (list.length !== 1 ? 's' : '');
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
        return '<tr class="item-data-row" data-id="' + escapeHtml(id) + '">'
          + '<td data-label="Sent at">' + escapeHtml(formatDateTime(row.criadoEm)) + '</td>'
          + '<td data-label="Status" class="' + statusClass(row.sendStatus) + '">' + escapeHtml(formatStatus(row.sendStatus)) + '</td>'
          + '<td data-label="Template">' + escapeHtml(row.messageCode || '-') + '</td>'
          + '<td data-label="To">' + escapeHtml(row.toEmail || row.toName || '-') + '</td>'
          + '<td data-label="Subject">' + escapeHtml(truncate(row.subject, 80)) + '</td>'
          + '<td data-label="Request #">' + escapeHtml(row.referenceNumber != null ? row.referenceNumber : '-') + '</td>'
          + '<td data-label="Sent by">' + escapeHtml(row.sentByName || '-') + '</td>'
          + '</tr>'
          + '<tr class="item-actions-row" data-id="' + escapeHtml(id) + '">'
          + '<td colspan="7" class="action-buttons-cell">'
          + '<div class="action-buttons">'
          + '<button type="button" class="btn-action view view-email-log-btn" data-id="' + escapeHtml(id) + '" title="View">'
          + '<i class="fas fa-eye"></i> <span>View</span></button>'
          + '</div></td></tr>';
      }).join('');

      tableBody.querySelectorAll('.view-email-log-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rowId = btn.getAttribute('data-id');
          const row = list.find((item) => item.id === rowId);
          openViewModal(row);
        });
      });
    } catch (error) {
      if (tableBody) tableBody.innerHTML = '';
      if (noResults) noResults.style.display = 'block';
      if (resultsCount) resultsCount.textContent = '0 logs';
      console.error(error);
      alert(error.message || 'Unable to load email send logs');
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function clearFilters() {
    [
      searchTerm, searchMessageCode, searchToEmail, searchSubject,
      searchReferenceNumber, searchSentByName, searchDateFrom, searchDateTo
    ].forEach((field) => {
      if (field) field.value = '';
    });
    if (searchSendStatus) searchSendStatus.value = '';
    runSearch();
  }

  function init() {
    if (applyBtn) applyBtn.addEventListener('click', runSearch);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    if (searchTerm) {
      searchTerm.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSearch();
        }
      });
    }
    if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);
    if (cancelViewModalBtn) cancelViewModalBtn.addEventListener('click', closeViewModal);
    if (viewModal) {
      viewModal.addEventListener('click', (event) => {
        if (event.target === viewModal) closeViewModal();
      });
    }
    runSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
