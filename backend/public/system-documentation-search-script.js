(function () {
  const API_BASE = '/api/system-documentation';
  let isRootUser = false;

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showMessage(text, type) {
    const el = document.getElementById('systemDocMessage');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.className = 'system-doc-message';
      return;
    }
    el.textContent = text;
    el.className = `system-doc-message show ${type || 'info'}`;
  }

  function updateResultsMeta(count) {
    const el = document.getElementById('systemDocResultsMeta');
    if (!el) return;
    if (count == null) {
      el.textContent = '';
      return;
    }
    el.textContent = `${count} document${count === 1 ? '' : 's'} found`;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatFileSize(bytes) {
    if (bytes == null || Number.isNaN(Number(bytes))) return '-';
    const size = Number(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getFileTypeInfo(fileName) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    const map = {
      pdf: { icon: 'fa-file-pdf', className: 'file-pdf' },
      doc: { icon: 'fa-file-word', className: 'file-word' },
      docx: { icon: 'fa-file-word', className: 'file-word' },
      xls: { icon: 'fa-file-excel', className: 'file-excel' },
      xlsx: { icon: 'fa-file-excel', className: 'file-excel' },
      csv: { icon: 'fa-file-csv', className: 'file-excel' },
      txt: { icon: 'fa-file-lines', className: 'file-text' },
      png: { icon: 'fa-file-image', className: 'file-image' },
      jpg: { icon: 'fa-file-image', className: 'file-image' },
      jpeg: { icon: 'fa-file-image', className: 'file-image' },
      gif: { icon: 'fa-file-image', className: 'file-image' },
      zip: { icon: 'fa-file-zipper', className: 'file-zip' }
    };
    return map[ext] || { icon: 'fa-file', className: 'file-default' };
  }

  function formatSector(sector) {
    if (window.SectionOptions && typeof SectionOptions.formatSectorDisplay === 'function') {
      return SectionOptions.formatSectorDisplay(sector);
    }
    const normalized = sector != null ? String(sector).trim() : '';
    return normalized || 'For everyone';
  }

  function populateSectorFilter() {
    const select = document.getElementById('searchSector');
    if (!select || !window.SectionOptions) return;

    const currentValue = select.value;
    select.innerHTML = [
      '<option value="">All sectors</option>',
      '<option value="__everyone__">For everyone</option>'
    ].join('');
    SectionOptions.SECTION_OPTIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
    select.value = currentValue || '';
  }

  function collectFilters() {
    let dateFrom = document.getElementById('searchDateFrom')?.value || '';
    let dateTo = document.getElementById('searchDateTo')?.value || '';

    if (dateFrom && dateTo && dateFrom > dateTo) {
      [dateFrom, dateTo] = [dateTo, dateFrom];
      document.getElementById('searchDateFrom').value = dateFrom;
      document.getElementById('searchDateTo').value = dateTo;
    }

    return {
      title: document.getElementById('searchTitle')?.value.trim() || '',
      uploadedByName: document.getElementById('searchUploadedBy')?.value.trim() || '',
      sector: document.getElementById('searchSector')?.value || '',
      dateFrom,
      dateTo
    };
  }

  function buildQuery(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function renderLoading() {
    const tbody = document.getElementById('systemDocResults');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Searching documents...</p>
        </td>
      </tr>`;
    updateResultsMeta(null);
  }

  function renderEmptyState() {
    const tbody = document.getElementById('systemDocResults');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-file-circle-xmark"></i>
          <p>No documents found. Try different filters or upload a new document.</p>
        </td>
      </tr>`;
    updateResultsMeta(0);
  }

  function renderError(message) {
    const tbody = document.getElementById('systemDocResults');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state system-doc-error-cell">
          <i class="fas fa-circle-exclamation"></i>
          <p>${escapeHtml(message)}</p>
        </td>
      </tr>`;
    updateResultsMeta(null);
  }

  function parseFileNameFromDisposition(header, fallback) {
    if (!header) return fallback;
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      try {
        return decodeURIComponent(utf8Match[1].trim());
      } catch {
        return fallback;
      }
    }
    const plainMatch = header.match(/filename="?([^";]+)"?/i);
    return plainMatch ? plainMatch[1].trim() : fallback;
  }

  async function downloadDocument(doc) {
    if (!doc || !doc.id) return;

    showMessage('Preparing download...', 'info');

    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(doc.id)}/download`, {
        credentials: 'same-origin'
      });

      const contentType = response.headers.get('Content-Type') || '';
      if (!response.ok || contentType.includes('application/json')) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'File not found. Upload the document again in System Documentation.');
      }

      const blob = await response.blob();
      const fileName = parseFileNameFromDisposition(
        response.headers.get('Content-Disposition'),
        doc.fileName || 'document'
      );

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      showMessage(`Downloaded: ${fileName}`, 'success');
    } catch (error) {
      console.error('Download documentation error:', error);
      showMessage(error.message || 'Error downloading file.', 'error');
    }
  }

  async function loadRootAccess() {
    try {
      const cached = sessionStorage.getItem('doubley_menu_access');
      if (cached) {
        const data = JSON.parse(cached);
        if (data && typeof data.isRoot === 'boolean') {
          isRootUser = data.isRoot;
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    try {
      const response = await fetch('/api/auth/menu-access', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        isRootUser = Boolean(data.isRoot);
      }
    } catch (error) {
      console.warn('Root access check skipped:', error.message);
    }
  }

  async function deleteDocument(doc) {
    if (!doc || !doc.id || !isRootUser) return;

    const label = doc.title || doc.fileName || 'this document';
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) {
      return;
    }

    showMessage('Deleting document...', 'info');

    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to delete document.');
      }

      showMessage('Document deleted successfully.', 'success');
      await runSearch();
    } catch (error) {
      console.error('Delete documentation error:', error);
      showMessage(error.message || 'Error deleting document.', 'error');
    }
  }

  function renderResults(list) {
    const tbody = document.getElementById('systemDocResults');
    if (!tbody) return;

    showMessage('');

    if (!list.length) {
      renderEmptyState();
      return;
    }

    updateResultsMeta(list.length);

    tbody.innerHTML = list.map((doc) => {
      const fileType = getFileTypeInfo(doc.fileName);
      const sectorLabel = formatSector(doc.sector);
      const sectorClass = doc.sector ? 'specific-sector' : 'for-everyone';
      return `
        <tr>
          <td class="system-doc-title-cell">
            <span class="system-doc-title-main">${escapeHtml(doc.title)}</span>
            ${doc.description ? `<div class="system-doc-description">${escapeHtml(doc.description)}</div>` : ''}
          </td>
          <td>
            <span class="system-doc-sector-badge ${sectorClass}">
              <i class="fas fa-layer-group"></i>
              ${escapeHtml(sectorLabel)}
            </span>
          </td>
          <td class="system-doc-file-cell">
            <span class="system-doc-file-badge" title="${escapeHtml(doc.fileName)}">
              <i class="fas ${fileType.icon} ${fileType.className}"></i>
              <span>${escapeHtml(doc.fileName)}</span>
            </span>
          </td>
          <td class="td-hide-mobile">
            <span class="system-doc-user-badge">
              <i class="fas fa-user"></i>
              ${escapeHtml(doc.uploadedByName || 'Unknown')}
            </span>
          </td>
          <td>
            <span class="system-doc-meta">
              <i class="fas fa-clock"></i>
              ${escapeHtml(formatDateTime(doc.criadoEm))}
            </span>
          </td>
          <td class="td-hide-mobile">
            <span class="system-doc-size-badge">${escapeHtml(formatFileSize(doc.fileSize))}</span>
          </td>
          <td class="td-actions">
            <button type="button" class="btn btn-primary btn-download" data-doc-id="${escapeHtml(doc.id)}" title="Download ${escapeHtml(doc.fileName)}">
              <i class="fas fa-download"></i> Download
            </button>
            ${isRootUser ? `
            <button type="button" class="btn btn-delete btn-doc-delete" data-doc-id="${escapeHtml(doc.id)}" title="Delete ${escapeHtml(doc.title)}">
              <i class="fas fa-trash-alt"></i> Delete
            </button>` : ''}
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-download').forEach((button) => {
      button.addEventListener('click', () => {
        const docId = button.getAttribute('data-doc-id');
        const doc = list.find((item) => String(item.id) === String(docId));
        if (doc) downloadDocument(doc);
      });
    });

    tbody.querySelectorAll('.btn-doc-delete').forEach((button) => {
      button.addEventListener('click', () => {
        const docId = button.getAttribute('data-doc-id');
        const doc = list.find((item) => String(item.id) === String(docId));
        if (doc) deleteDocument(doc);
      });
    });
  }

  async function runSearch() {
    renderLoading();

    try {
      const response = await fetch(`${API_BASE}${buildQuery(collectFilters())}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to search documents.');
      }

      renderResults(data.data || []);
    } catch (error) {
      console.error('Search documentation error:', error);
      renderError(error.message || 'Error searching documents.');
      showMessage(error.message || 'Error searching documents.', 'error');
    }
  }

  function clearSearch() {
    document.getElementById('searchTitle').value = '';
    document.getElementById('searchUploadedBy').value = '';
    document.getElementById('searchSector').value = '';
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value = '';
    showMessage('');
    runSearch();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    populateSectorFilter();
    await loadRootAccess();
    document.getElementById('searchDocsBtn')?.addEventListener('click', runSearch);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearSearch);
    runSearch();
  });
})();
