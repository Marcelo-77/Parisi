(function () {
  const NEWS_API = '/api/news';
  const DOCS_API = '/api/system-documentation';

  let searchResults = [];
  const editAttachedDocs = new Map();

  const searchDescription = document.getElementById('searchDescription');
  const searchCreatedBy = document.getElementById('searchCreatedBy');
  const searchSector = document.getElementById('searchSector');
  const searchDateFrom = document.getElementById('searchDateFrom');
  const searchDateTo = document.getElementById('searchDateTo');
  const searchActiveOnly = document.getElementById('searchActiveOnly');
  const searchNewsBtn = document.getElementById('searchNewsBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const newsResultsBody = document.getElementById('newsResultsBody');
  const newsResultsMeta = document.getElementById('newsResultsMeta');
  const newsSearchMessage = document.getElementById('newsSearchMessage');

  const editNewsModal = document.getElementById('editNewsModal');
  const editNewsForm = document.getElementById('editNewsForm');
  const editNewsId = document.getElementById('editNewsId');
  const editNewsDescription = document.getElementById('editNewsDescription');
  const editNewsStartDate = document.getElementById('editNewsStartDate');
  const editNewsEndDate = document.getElementById('editNewsEndDate');
  const editNewsSectorAll = document.getElementById('editNewsSectorAll');
  const editNewsSectorSelected = document.getElementById('editNewsSectorSelected');
  const editNewsSectorGrid = document.getElementById('editNewsSectorGrid');
  const editDocSearchTitle = document.getElementById('editDocSearchTitle');
  const editSearchDocumentationBtn = document.getElementById('editSearchDocumentationBtn');
  const editDocSearchResults = document.getElementById('editDocSearchResults');
  const editDocSearchResultsBody = document.getElementById('editDocSearchResultsBody');
  const editAttachedDocsList = document.getElementById('editAttachedDocsList');
  const closeEditNewsModal = document.getElementById('closeEditNewsModal');
  const cancelEditNewsBtn = document.getElementById('cancelEditNewsBtn');
  const saveEditNewsBtn = document.getElementById('saveEditNewsBtn');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMessage(text, type) {
    if (!newsSearchMessage) return;
    if (!text) {
      newsSearchMessage.textContent = '';
      newsSearchMessage.className = 'news-message';
      return;
    }
    newsSearchMessage.textContent = text;
    newsSearchMessage.className = `news-message show ${type || 'info'}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    const raw = String(value).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function formatSectors(item) {
    if (item.allSectors) return 'All sectors';
    if (!item.sectors || !item.sectors.length) return '-';
    return item.sectors.map((sector) => window.SectionOptions.formatSectionLabel(sector)).join(', ');
  }

  function truncateText(text, max) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function getNewsStatus(item) {
    const start = formatDate(item.startDate);
    const end = formatDate(item.endDate);
    if (!start || start === '-' || !end || end === '-') {
      return { key: 'draft', label: 'Draft' };
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today < start) return { key: 'upcoming', label: 'Upcoming' };
    if (today > end) return { key: 'expired', label: 'Expired' };
    return { key: 'active', label: 'Active' };
  }

  function renderStatusBadge(item) {
    const status = getNewsStatus(item);
    return `<span class="news-status-badge news-status-${status.key}">${escapeHtml(status.label)}</span>`;
  }

  function updateResultsMeta(count, searched) {
    if (!newsResultsMeta) return;
    if (!searched) {
      newsResultsMeta.textContent = 'No search yet';
      return;
    }
    newsResultsMeta.textContent = count === 1 ? '1 record' : `${count} records`;
  }

  function populateSearchSectorSelect() {
    if (!searchSector || !window.SectionOptions) return;
    const current = searchSector.value;
    searchSector.innerHTML = `
      <option value="">All sectors</option>
      <option value="__all_sectors__">News for all sectors</option>
    `;
    window.SectionOptions.SECTION_OPTIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      searchSector.appendChild(option);
    });
    searchSector.value = current || '';
  }

  function populateEditSectorGrid() {
    if (!editNewsSectorGrid || !window.SectionOptions) return;
    editNewsSectorGrid.innerHTML = window.SectionOptions.SECTION_OPTIONS.map((item) => `
      <label>
        <input type="checkbox" class="edit-news-sector-checkbox" value="${escapeHtml(item.value)}">
        ${escapeHtml(item.label)}
      </label>
    `).join('');
  }

  function updateEditSectorMode() {
    const allSectors = editNewsSectorAll && editNewsSectorAll.checked;
    if (!editNewsSectorGrid) return;
    editNewsSectorGrid.classList.toggle('is-disabled', Boolean(allSectors));
    if (allSectors) {
      editNewsSectorGrid.querySelectorAll('.edit-news-sector-checkbox').forEach((input) => {
        input.checked = false;
      });
    }
  }

  function getEditSelectedSectors() {
    if (!editNewsSectorSelected || !editNewsSectorSelected.checked) return [];
    return Array.from(document.querySelectorAll('.edit-news-sector-checkbox:checked'))
      .map((input) => input.value);
  }

  function renderEditAttachedDocs() {
    if (!editAttachedDocsList) return;
    if (!editAttachedDocs.size) {
      editAttachedDocsList.innerHTML = '<p class="news-empty-attached">No files attached.</p>';
      return;
    }
    editAttachedDocsList.innerHTML = Array.from(editAttachedDocs.values()).map((doc) => `
      <div class="news-attached-item">
        <div>
          <strong>${escapeHtml(doc.title || doc.fileName)}</strong><br>
          <small>${escapeHtml(doc.fileName || '')}</small>
        </div>
        <button type="button" class="btn btn-sm btn-outline remove-edit-attached-doc" data-id="${escapeHtml(doc.id)}">
          <i class="fas fa-times"></i> Remove
        </button>
      </div>
    `).join('');
  }

  function addEditAttachedDoc(doc) {
    if (!doc || !doc.id || editAttachedDocs.has(doc.id)) return;
    editAttachedDocs.set(doc.id, doc);
    renderEditAttachedDocs();
  }

  async function searchNews() {
    const params = new URLSearchParams();
    if (searchDescription && searchDescription.value.trim()) params.set('description', searchDescription.value.trim());
    if (searchCreatedBy && searchCreatedBy.value.trim()) params.set('createdByName', searchCreatedBy.value.trim());
    if (searchSector && searchSector.value) params.set('sector', searchSector.value);
    if (searchDateFrom && searchDateFrom.value) params.set('dateFrom', searchDateFrom.value);
    if (searchDateTo && searchDateTo.value) params.set('dateTo', searchDateTo.value);
    if (searchActiveOnly && searchActiveOnly.checked) params.set('activeOnly', '1');

    try {
      const response = await fetch(`${NEWS_API}?${params.toString()}`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error searching news');
      }

      searchResults = Array.isArray(data.data) ? data.data : [];
      renderResults();
      updateResultsMeta(searchResults.length, true);
      showMessage('', '');
    } catch (error) {
      console.error('Search news error:', error);
      showMessage(error.message || 'Error searching news.', 'error');
    }
  }

  function renderResults() {
    if (!newsResultsBody) return;
    if (!searchResults.length) {
      newsResultsBody.innerHTML = `
        <tr class="news-empty-row">
          <td colspan="8">
            <div class="news-empty-state">
              <i class="fas fa-inbox"></i>
              <p>No news found for the current filters.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    newsResultsBody.innerHTML = searchResults.map((item) => `
      <tr data-id="${escapeHtml(item.id)}">
        <td>${renderStatusBadge(item)}</td>
        <td class="news-desc-cell" title="${escapeHtml(item.description)}">${escapeHtml(truncateText(item.description, 90))}</td>
        <td>${escapeHtml(formatDate(item.startDate))}</td>
        <td>${escapeHtml(formatDate(item.endDate))}</td>
        <td>${escapeHtml(formatSectors(item))}</td>
        <td><span class="news-files-count">${(item.documentation || []).length}</span></td>
        <td class="th-hide-mobile">${escapeHtml(item.createdByName || '-')}</td>
        <td class="td-actions">
          <button type="button" class="btn-action btn-edit btn btn-sm btn-outline edit-news-btn" data-id="${escapeHtml(item.id)}" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="btn-action btn-delete btn btn-sm btn-outline delete-news-btn" data-id="${escapeHtml(item.id)}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function openEditModal() {
    if (!editNewsModal) return;
    editNewsModal.classList.add('show');
    editNewsModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    if (!editNewsModal) return;
    editNewsModal.classList.remove('show');
    editNewsModal.setAttribute('aria-hidden', 'true');
    editAttachedDocs.clear();
    if (editDocSearchResults) editDocSearchResults.hidden = true;
    if (editDocSearchResultsBody) editDocSearchResultsBody.innerHTML = '';
  }

  async function loadNewsForEdit(id) {
    const response = await fetch(`${NEWS_API}/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error || 'Error loading news');
    }
    return data.data;
  }

  async function openEditNews(id) {
    try {
      const item = await loadNewsForEdit(id);
      editAttachedDocs.clear();
      (item.documentation || []).forEach((doc) => {
        editAttachedDocs.set(doc.id, {
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          sector: doc.sector || null
        });
      });

      if (editNewsId) editNewsId.value = item.id;
      if (editNewsDescription) editNewsDescription.value = item.description || '';
      if (editNewsStartDate) editNewsStartDate.value = formatDate(item.startDate);
      if (editNewsEndDate) editNewsEndDate.value = formatDate(item.endDate);

      if (item.allSectors) {
        if (editNewsSectorAll) editNewsSectorAll.checked = true;
      } else if (editNewsSectorSelected) {
        editNewsSectorSelected.checked = true;
      }
      updateEditSectorMode();

      editNewsSectorGrid.querySelectorAll('.edit-news-sector-checkbox').forEach((input) => {
        input.checked = (item.sectors || []).includes(input.value);
      });

      renderEditAttachedDocs();
      openEditModal();
    } catch (error) {
      console.error('Open edit news error:', error);
      showMessage(error.message || 'Error loading news for edit.', 'error');
    }
  }

  async function searchEditDocumentation() {
    const title = editDocSearchTitle ? editDocSearchTitle.value.trim() : '';
    const params = new URLSearchParams();
    if (title) params.set('title', title);

    const response = await fetch(`${DOCS_API}?${params.toString()}`, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error searching documentation');
    }

    const list = Array.isArray(data.data) ? data.data : [];
    if (!editDocSearchResults || !editDocSearchResultsBody) return;

    if (!list.length) {
      editDocSearchResults.hidden = false;
      editDocSearchResultsBody.innerHTML = '<tr><td colspan="3">No documents found.</td></tr>';
      return;
    }

    editDocSearchResults.hidden = false;
    editDocSearchResultsBody.innerHTML = list.map((doc) => {
      const already = editAttachedDocs.has(doc.id);
      return `<tr>
        <td>${escapeHtml(doc.title)}</td>
        <td>${escapeHtml(doc.fileName)}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary edit-attach-doc-btn" data-id="${escapeHtml(doc.id)}"
            data-title="${escapeHtml(doc.title)}" data-file="${escapeHtml(doc.fileName)}" ${already ? 'disabled' : ''}>
            ${already ? 'Attached' : 'Attach'}
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  async function saveEditNews(event) {
    event.preventDefault();
    const id = editNewsId ? editNewsId.value : '';
    if (!id) return;

    const payload = {
      description: editNewsDescription ? editNewsDescription.value.trim() : '',
      startDate: editNewsStartDate ? editNewsStartDate.value : '',
      endDate: editNewsEndDate ? editNewsEndDate.value : '',
      allSectors: Boolean(editNewsSectorAll && editNewsSectorAll.checked),
      sectors: getEditSelectedSectors(),
      documentationIds: Array.from(editAttachedDocs.keys())
    };

    if (saveEditNewsBtn) {
      saveEditNewsBtn.disabled = true;
      saveEditNewsBtn.classList.add('loading');
    }

    try {
      const response = await fetch(`${NEWS_API}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error updating news');
      }

      closeEditModal();
      showMessage('News updated successfully.', 'success');
      await searchNews();
    } catch (error) {
      console.error('Save edit news error:', error);
      showMessage(error.message || 'Error updating news.', 'error');
    } finally {
      if (saveEditNewsBtn) {
        saveEditNewsBtn.disabled = false;
        saveEditNewsBtn.classList.remove('loading');
      }
    }
  }

  async function deleteNews(id) {
    if (!window.confirm('Delete this news item?')) return;

    try {
      const response = await fetch(`${NEWS_API}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error deleting news');
      }
      showMessage('News deleted successfully.', 'success');
      await searchNews();
    } catch (error) {
      console.error('Delete news error:', error);
      showMessage(error.message || 'Error deleting news.', 'error');
    }
  }

  function clearSearch() {
    if (searchDescription) searchDescription.value = '';
    if (searchCreatedBy) searchCreatedBy.value = '';
    if (searchSector) searchSector.value = '';
    if (searchDateFrom) searchDateFrom.value = '';
    if (searchDateTo) searchDateTo.value = '';
    if (searchActiveOnly) searchActiveOnly.checked = false;
    searchResults = [];
    renderResults();
    updateResultsMeta(0, false);
    showMessage('', '');
  }

  function bindSearchEnterKey() {
    [searchDescription, searchCreatedBy].forEach((input) => {
      if (!input) return;
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          searchNews();
        }
      });
    });
  }

  populateSearchSectorSelect();
  populateEditSectorGrid();
  updateEditSectorMode();
  bindSearchEnterKey();

  if (searchNewsBtn) searchNewsBtn.addEventListener('click', searchNews);
  if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
  if (editNewsSectorAll) editNewsSectorAll.addEventListener('change', updateEditSectorMode);
  if (editNewsSectorSelected) editNewsSectorSelected.addEventListener('change', updateEditSectorMode);
  if (editSearchDocumentationBtn) {
    editSearchDocumentationBtn.addEventListener('click', () => {
      searchEditDocumentation().catch((error) => showMessage(error.message, 'error'));
    });
  }
  if (editDocSearchResultsBody) {
    editDocSearchResultsBody.addEventListener('click', (event) => {
      const button = event.target.closest('.edit-attach-doc-btn');
      if (!button || button.disabled) return;
      addEditAttachedDoc({
        id: button.getAttribute('data-id'),
        title: button.getAttribute('data-title'),
        fileName: button.getAttribute('data-file')
      });
      button.disabled = true;
      button.textContent = 'Attached';
    });
  }
  if (editAttachedDocsList) {
    editAttachedDocsList.addEventListener('click', (event) => {
      const button = event.target.closest('.remove-edit-attached-doc');
      if (!button) return;
      editAttachedDocs.delete(button.getAttribute('data-id'));
      renderEditAttachedDocs();
    });
  }
  if (newsResultsBody) {
    newsResultsBody.addEventListener('click', (event) => {
      const editBtn = event.target.closest('.edit-news-btn');
      if (editBtn) {
        openEditNews(editBtn.getAttribute('data-id'));
        return;
      }
      const deleteBtn = event.target.closest('.delete-news-btn');
      if (deleteBtn) {
        deleteNews(deleteBtn.getAttribute('data-id'));
      }
    });
  }
  if (editNewsForm) editNewsForm.addEventListener('submit', saveEditNews);
  if (closeEditNewsModal) closeEditNewsModal.addEventListener('click', closeEditModal);
  if (cancelEditNewsBtn) cancelEditNewsBtn.addEventListener('click', closeEditModal);
  if (editNewsModal) {
    editNewsModal.addEventListener('click', (event) => {
      if (event.target === editNewsModal) closeEditModal();
    });
  }
})();
