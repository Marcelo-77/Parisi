(function () {
  const NEWS_API = '/api/news';
  const DOCS_API = '/api/system-documentation';

  const attachedDocs = new Map();

  const form = document.getElementById('newsForm');
  const descriptionInput = document.getElementById('newsDescription');
  const startDateInput = document.getElementById('newsStartDate');
  const endDateInput = document.getElementById('newsEndDate');
  const sectorAllRadio = document.getElementById('newsSectorAll');
  const sectorSelectedRadio = document.getElementById('newsSectorSelected');
  const sectorGrid = document.getElementById('newsSectorGrid');
  const docSearchTitle = document.getElementById('docSearchTitle');
  const searchDocumentationBtn = document.getElementById('searchDocumentationBtn');
  const docSearchResults = document.getElementById('docSearchResults');
  const docSearchResultsBody = document.getElementById('docSearchResultsBody');
  const attachedDocsList = document.getElementById('attachedDocsList');
  const clearNewsBtn = document.getElementById('clearNewsBtn');
  const saveNewsBtn = document.getElementById('saveNewsBtn');
  const messageEl = document.getElementById('newsMessage');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `news-message show ${type || 'info'}`;
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.className = 'news-message';
  }

  function populateSectorGrid() {
    if (!sectorGrid || !window.SectionOptions) return;
    sectorGrid.innerHTML = window.SectionOptions.SECTION_OPTIONS.map((item) => `
      <label>
        <input type="checkbox" class="news-sector-checkbox" value="${escapeHtml(item.value)}">
        ${escapeHtml(item.label)}
      </label>
    `).join('');
  }

  function updateSectorMode() {
    const allSectors = sectorAllRadio && sectorAllRadio.checked;
    if (!sectorGrid) return;
    sectorGrid.classList.toggle('is-disabled', Boolean(allSectors));
    sectorGrid.setAttribute('aria-disabled', allSectors ? 'true' : 'false');
    if (allSectors) {
      sectorGrid.querySelectorAll('.news-sector-checkbox').forEach((input) => {
        input.checked = false;
      });
    }
    updateFormSummary();
  }

  function getSelectedSectors() {
    if (!sectorSelectedRadio || !sectorSelectedRadio.checked) return [];
    return Array.from(document.querySelectorAll('.news-sector-checkbox:checked'))
      .map((input) => input.value);
  }

  function renderAttachedDocs() {
    if (!attachedDocsList) return;
    const countEl = document.getElementById('attachedDocsCount');
    if (countEl) countEl.textContent = String(attachedDocs.size);

    if (!attachedDocs.size) {
      attachedDocsList.innerHTML = '<p class="news-empty-attached"><i class="fas fa-inbox"></i> No files attached yet.</p>';
      updateFormSummary();
      return;
    }

    attachedDocsList.innerHTML = Array.from(attachedDocs.values()).map((doc) => `
      <div class="news-attached-item" data-id="${escapeHtml(doc.id)}">
        <div>
          <strong>${escapeHtml(doc.title || doc.fileName)}</strong><br>
          <small>${escapeHtml(doc.fileName || '')}${doc.sector ? ' · ' + escapeHtml(window.SectionOptions.formatSectorDisplay(doc.sector)) : ''}</small>
        </div>
        <button type="button" class="btn btn-sm btn-outline remove-attached-doc" data-id="${escapeHtml(doc.id)}">
          <i class="fas fa-times"></i> Remove
        </button>
      </div>
    `).join('');
    updateFormSummary();
  }

  function addAttachedDoc(doc) {
    if (!doc || !doc.id || attachedDocs.has(doc.id)) return;
    attachedDocs.set(doc.id, {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      sector: doc.sector || null
    });
    renderAttachedDocs();
  }

  async function searchDocumentation() {
    const title = docSearchTitle ? docSearchTitle.value.trim() : '';
    const params = new URLSearchParams();
    if (title) params.set('title', title);

    try {
      const response = await fetch(`${DOCS_API}?${params.toString()}`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error searching documentation');
      }

      const list = Array.isArray(data.data) ? data.data : [];
      if (!docSearchResults || !docSearchResultsBody) return;

      if (!list.length) {
        docSearchResults.hidden = false;
        docSearchResultsBody.innerHTML = '<tr><td colspan="4">No documents found.</td></tr>';
        return;
      }

      docSearchResults.hidden = false;
      docSearchResultsBody.innerHTML = list.map((doc) => {
        const already = attachedDocs.has(doc.id);
        return `<tr>
          <td>${escapeHtml(doc.title)}</td>
          <td>${escapeHtml(doc.fileName)}</td>
          <td>${escapeHtml(window.SectionOptions.formatSectorDisplay(doc.sector))}</td>
          <td>
            <button type="button" class="btn btn-sm btn-primary attach-doc-btn" data-id="${escapeHtml(doc.id)}"
              data-title="${escapeHtml(doc.title)}" data-file="${escapeHtml(doc.fileName)}"
              data-sector="${escapeHtml(doc.sector || '')}" ${already ? 'disabled' : ''}>
              <i class="fas fa-paperclip"></i> ${already ? 'Attached' : 'Attach'}
            </button>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('Documentation search error:', error);
      showMessage(error.message || 'Error searching documentation.', 'error');
    }
  }

  function getNewsStatusFromDates(startDate, endDate) {
    const start = startDate ? String(startDate).slice(0, 10) : '';
    const end = endDate ? String(endDate).slice(0, 10) : '';
    if (!start || !end) return { key: 'draft', label: 'Draft' };
    const today = new Date().toISOString().slice(0, 10);
    if (today < start) return { key: 'upcoming', label: 'Upcoming' };
    if (today > end) return { key: 'expired', label: 'Expired' };
    return { key: 'active', label: 'Active' };
  }

  function updateFormSummary() {
    const statusEl = document.getElementById('newsSummaryStatus');
    const periodEl = document.getElementById('newsSummaryPeriod');
    const audienceEl = document.getElementById('newsSummaryAudience');
    const attachmentsEl = document.getElementById('newsSummaryAttachments');
    const previewBody = document.getElementById('newsPopupPreviewBody');
    const countEl = document.getElementById('newsDescriptionCount');

    const description = descriptionInput ? descriptionInput.value : '';
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';
    const allSectors = Boolean(sectorAllRadio && sectorAllRadio.checked);
    const sectors = getSelectedSectors();

    if (countEl) {
      countEl.textContent = `${description.length} / 4000`;
    }

    if (statusEl) {
      const status = getNewsStatusFromDates(startDate, endDate);
      statusEl.textContent = status.label;
      statusEl.className = `news-status-badge news-status-${status.key}`;
    }

    if (periodEl) {
      periodEl.textContent = startDate && endDate ? `${startDate} → ${endDate}` : '—';
    }

    if (audienceEl) {
      if (allSectors) {
        audienceEl.textContent = 'All sectors';
      } else if (sectors.length) {
        audienceEl.textContent = sectors
          .map((s) => (window.SectionOptions ? window.SectionOptions.formatSectionLabel(s) : s))
          .join(', ');
      } else {
        audienceEl.textContent = 'Select sector(s)';
      }
    }

    if (attachmentsEl) {
      attachmentsEl.textContent = `${attachedDocs.size} file(s)`;
    }

    if (previewBody) {
      const previewText = description.trim();
      previewBody.textContent = previewText || 'Your message will appear here...';
    }
  }

  function bindFormSummary() {
    const fields = [descriptionInput, startDateInput, endDateInput, sectorAllRadio, sectorSelectedRadio];
    fields.forEach((el) => {
      if (!el) return;
      el.addEventListener('input', updateFormSummary);
      el.addEventListener('change', updateFormSummary);
    });
    if (sectorGrid) {
      sectorGrid.addEventListener('change', updateFormSummary);
    }
    updateFormSummary();
  }

  function resetForm() {
    if (form) form.reset();
    attachedDocs.clear();
    renderAttachedDocs();
    if (docSearchResults) docSearchResults.hidden = true;
    if (docSearchResultsBody) docSearchResultsBody.innerHTML = '';
    if (sectorAllRadio) sectorAllRadio.checked = true;
    updateSectorMode();
    clearMessage();
    updateFormSummary();
  }

  async function saveNews(event) {
    event.preventDefault();
    clearMessage();

    const description = descriptionInput ? descriptionInput.value.trim() : '';
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';
    const allSectors = Boolean(sectorAllRadio && sectorAllRadio.checked);
    const sectors = getSelectedSectors();

    if (!description) {
      showMessage('Description is required.', 'error');
      return;
    }
    if (!startDate || !endDate) {
      showMessage('Start date and end date are required.', 'error');
      return;
    }
    if (endDate < startDate) {
      showMessage('End date cannot be earlier than start date.', 'error');
      return;
    }
    if (!allSectors && !sectors.length) {
      showMessage('Select at least one sector or choose All sectors.', 'error');
      return;
    }

    const payload = {
      description,
      startDate,
      endDate,
      allSectors,
      sectors,
      documentationIds: Array.from(attachedDocs.keys())
    };

    if (saveNewsBtn) {
      saveNewsBtn.disabled = true;
      saveNewsBtn.classList.add('loading');
    }

    try {
      const response = await fetch(NEWS_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        if (response.status === 404 && data.error === 'Route not found') {
          throw new Error('News API is not available. Restart the backend server (npm start in the backend folder) and try again.');
        }
        throw new Error(data.error || data.message || 'Error saving news');
      }

      showMessage('News saved successfully.', 'success');
      resetForm();
    } catch (error) {
      console.error('Save news error:', error);
      showMessage(error.message || 'Error saving news.', 'error');
    } finally {
      if (saveNewsBtn) {
        saveNewsBtn.disabled = false;
        saveNewsBtn.classList.remove('loading');
      }
    }
  }

  populateSectorGrid();
  updateSectorMode();
  bindFormSummary();

  if (sectorAllRadio) sectorAllRadio.addEventListener('change', updateSectorMode);
  if (sectorSelectedRadio) sectorSelectedRadio.addEventListener('change', updateSectorMode);
  if (searchDocumentationBtn) searchDocumentationBtn.addEventListener('click', searchDocumentation);
  if (docSearchTitle) {
    docSearchTitle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchDocumentation();
      }
    });
  }
  if (docSearchResultsBody) {
    docSearchResultsBody.addEventListener('click', (event) => {
      const button = event.target.closest('.attach-doc-btn');
      if (!button || button.disabled) return;
      addAttachedDoc({
        id: button.getAttribute('data-id'),
        title: button.getAttribute('data-title'),
        fileName: button.getAttribute('data-file'),
        sector: button.getAttribute('data-sector') || null
      });
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-paperclip"></i> Attached';
    });
  }
  if (attachedDocsList) {
    attachedDocsList.addEventListener('click', (event) => {
      const button = event.target.closest('.remove-attached-doc');
      if (!button) return;
      attachedDocs.delete(button.getAttribute('data-id'));
      renderAttachedDocs();
    });
  }
  if (clearNewsBtn) clearNewsBtn.addEventListener('click', resetForm);
  if (form) form.addEventListener('submit', saveNews);

  const newsHelpBtn = document.getElementById('newsHelpBtn');
  const newsHelpModal = document.getElementById('newsHelpModal');
  const closeNewsHelpBtn = document.getElementById('closeNewsHelpBtn');

  function openNewsHelpModal() {
    if (!newsHelpModal) return;
    newsHelpModal.removeAttribute('hidden');
    newsHelpModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (closeNewsHelpBtn) closeNewsHelpBtn.focus();
  }

  function closeNewsHelpModal() {
    if (!newsHelpModal) return;
    newsHelpModal.classList.remove('show');
    newsHelpModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (newsHelpBtn) newsHelpBtn.focus();
  }

  if (newsHelpBtn) newsHelpBtn.addEventListener('click', openNewsHelpModal);
  if (closeNewsHelpBtn) closeNewsHelpBtn.addEventListener('click', closeNewsHelpModal);
  if (newsHelpModal) {
    newsHelpModal.addEventListener('click', (event) => {
      if (event.target === newsHelpModal) closeNewsHelpModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && newsHelpModal.classList.contains('show')) {
        closeNewsHelpModal();
      }
    });
  }
})();
