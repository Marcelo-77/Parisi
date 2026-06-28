(function () {
  const API_BASE = '/api/church-service-orders';
  let searchResults = [];
  let lastPreviewOrder = null;

  function escapeHtml(value) {
    return OrderOfServiceUtils.escapeHtml(value);
  }

  function showMessage(text, type) {
    const el = document.getElementById('orderSearchMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `order-service-message show ${type || 'info'}`;
  }

  function collectFilters() {
    let serviceDateFrom = document.getElementById('searchDateFrom')?.value || '';
    let serviceDateTo = document.getElementById('searchDateTo')?.value || '';

    if (serviceDateFrom && serviceDateTo && serviceDateFrom > serviceDateTo) {
      [serviceDateFrom, serviceDateTo] = [serviceDateTo, serviceDateFrom];
      document.getElementById('searchDateFrom').value = serviceDateFrom;
      document.getElementById('searchDateTo').value = serviceDateTo;
    }

    return {
      serviceDateFrom,
      serviceDateTo,
      title: document.getElementById('searchTitle')?.value.trim() || '',
      churchName: document.getElementById('searchChurchName')?.value.trim() || '',
      dirigente: document.getElementById('searchDirigente')?.value.trim() || ''
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

  async function runSearch() {
    const filters = collectFilters();
    const container = document.getElementById('orderSearchResults');
    if (container) {
      container.innerHTML = '<p class="loading-text">Searching...</p>';
    }

    try {
      const response = await fetch(`${API_BASE}${buildQuery(filters)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Unable to search orders.');
      }
      searchResults = data.data || [];
      renderResults(searchResults);
      showMessage(`${searchResults.length} ordem(ns) encontrada(s).`, 'info');
    } catch (error) {
      console.error('Search orders error:', error);
      if (container) {
        container.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
      }
      showMessage(error.message || 'Error searching orders.', 'error');
    }
  }

  function renderResults(list) {
    const container = document.getElementById('orderSearchResults');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:20px;text-align:center;color:#888;">
          <i class="fas fa-file-circle-xmark"></i>
          <p>Nenhuma ordem de culto gravada encontrada.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="warehouse-table order-search-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Título</th>
              <th>Igreja</th>
              <th>Dirigente</th>
              <th>Mensagem</th>
              <th class="th-actions">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((item) => `
              <tr>
                <td>${escapeHtml(OrderOfServiceUtils.formatDateOnly(item.serviceDate) || '—')}</td>
                <td>${escapeHtml(item.title || '—')}</td>
                <td>${escapeHtml(item.churchName || '—')}</td>
                <td>${escapeHtml(item.dirigente || '—')}</td>
                <td>${escapeHtml(item.messageSpeaker || '—')}</td>
                <td class="td-actions">
                  <button type="button" class="btn btn-secondary btn-sm btn-preview-order" data-id="${escapeHtml(item.id)}">
                    <i class="fas fa-eye"></i> Ver
                  </button>
                  <button type="button" class="btn btn-primary btn-sm btn-print-order" data-id="${escapeHtml(item.id)}">
                    <i class="fas fa-print"></i> Imprimir
                  </button>
                  <a class="btn btn-secondary btn-sm" href="Order_of_Service.html?id=${encodeURIComponent(item.id)}">
                    <i class="fas fa-pen"></i> Editar
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('.btn-preview-order').forEach((btn) => {
      btn.addEventListener('click', () => previewOrder(btn.getAttribute('data-id')));
    });

    container.querySelectorAll('.btn-print-order').forEach((btn) => {
      btn.addEventListener('click', () => printOrderById(btn.getAttribute('data-id')));
    });
  }

  function findOrderById(id) {
    return searchResults.find((item) => String(item.id) === String(id));
  }

  async function fetchOrderById(id, options = {}) {
    const useCache = options.fresh !== true;
    if (useCache) {
      const cached = findOrderById(id);
      if (cached) return cached;
    }

    const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Unable to load order.');
    }

    const index = searchResults.findIndex((item) => String(item.id) === String(id));
    if (index >= 0) {
      searchResults[index] = data.data;
    }

    return data.data;
  }

  async function previewOrder(id) {
    try {
      const order = await fetchOrderById(id, { fresh: true });
      lastPreviewOrder = order;
      const host = document.getElementById('orderPrintDocument');
      OrderOfServiceUtils.renderIntoElement(
        host,
        order,
        OrderOfServiceUtils.getPrintLanguage()
      );
      if (host) host.setAttribute('data-order-id', String(id));
      const panel = document.getElementById('orderSearchPreviewPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showMessage(error.message || 'Error loading preview.', 'error');
    }
  }

  async function printOrderById(id) {
    try {
      const order = await fetchOrderById(id, { fresh: true });
      OrderOfServiceUtils.printData(order, OrderOfServiceUtils.getPrintLanguage());
    } catch (error) {
      showMessage(error.message || 'Error printing order.', 'error');
    }
  }

  function clearSearch() {
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value = '';
    document.getElementById('searchTitle').value = '';
    document.getElementById('searchChurchName').value = '';
    document.getElementById('searchDirigente').value = '';
    searchResults = [];
    lastPreviewOrder = null;
    const container = document.getElementById('orderSearchResults');
    if (container) container.innerHTML = '';
    const preview = document.getElementById('orderPrintDocument');
    if (preview) {
      preview.innerHTML = '';
      preview.removeAttribute('data-order-id');
    }
    showMessage('', 'info');
    const message = document.getElementById('orderSearchMessage');
    if (message) {
      message.textContent = '';
      message.className = 'order-service-message';
    }
  }

  function initPage() {
    const searchBtn = document.getElementById('searchOrdersBtn');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchBtn) searchBtn.addEventListener('click', runSearch);
    if (clearBtn) clearBtn.addEventListener('click', clearSearch);

    OrderOfServiceUtils.initPrintLanguageSelector(() => {
      const preview = document.getElementById('orderPrintDocument');
      if (preview && preview.innerHTML.trim()) {
        const currentId = preview.getAttribute('data-order-id');
        if (currentId) {
          previewOrder(currentId);
          return;
        }
      }
    });

    OrderOfServiceUtils.initDownloadPreviewButton(
      'downloadOrderPreviewBtn',
      async () => {
        if (lastPreviewOrder) return lastPreviewOrder;
        const currentId = document.getElementById('orderPrintDocument')?.getAttribute('data-order-id');
        if (!currentId) {
          throw new Error('Selecione uma ordem e clique em Ver antes do download.');
        }
        lastPreviewOrder = await fetchOrderById(currentId, { fresh: true });
        return lastPreviewOrder;
      },
      (filename) => showMessage(`Download iniciado: ${filename}`, 'info'),
      (error) => showMessage(error.message || 'Erro ao gerar download HTML.', 'error')
    );

    runSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
})();
