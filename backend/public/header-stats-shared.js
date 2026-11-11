(function (global) {
  const STORAGE_KEY = 'doubley_header_stats';
  const API_STATS = '/api/warehouse/estatisticas';
  const API_MOVEMENTS = '/api/warehouse/estatisticas/movimentos-hoje';
  const API_MOVEMENT_LINES = '/api/warehouse/estatisticas/movimentos-hoje-linhas';
  const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js';
  const CHART_COLORS = [
    '#4facfe', '#43e97b', '#f5576c', '#f093fb', '#667eea',
    '#fbbf24', '#38bdf8', '#34d399', '#fb7185', '#a78bfa',
    '#f97316', '#14b8a6', '#eab308', '#6366f1', '#ec4899'
  ];

  let chartInstance = null;
  let chartState = {
    tipo: null,
    categoria: null,
    items: [],
    selectedSubcategoria: null
  };
  let chartJsPromise = null;
  let bound = false;

  function enabled() {
    if (global.DoubleYSystemSettings && typeof global.DoubleYSystemSettings.areHeaderStatsEnabled === 'function') {
      return global.DoubleYSystemSettings.areHeaderStatsEnabled();
    }
    return !document.documentElement.classList.contains('header-stats-hidden')
      && !document.body?.classList?.contains('header-stats-hidden');
  }

  function readCache() {
    try {
      // Prefer localStorage so Total/Low/Entries/Exits survive screen changes and new tabs after login.
      const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        total: parsed.total ?? 0,
        estoqueBaixo: parsed.estoqueBaixo ?? 0,
        esgotado: parsed.esgotado ?? 0,
        entradas: parsed.entradas ?? 0,
        saidas: parsed.saidas ?? 0
      };
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    const payload = JSON.stringify({
      total: data.total ?? 0,
      estoqueBaixo: data.estoqueBaixo ?? 0,
      esgotado: data.esgotado ?? 0,
      entradas: data.entradas ?? 0,
      saidas: data.saidas ?? 0
    });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // ignore
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // ignore
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function applyToDom(data) {
    const stats = data || readCache() || {
      total: 0,
      estoqueBaixo: 0,
      esgotado: 0,
      entradas: 0,
      saidas: 0
    };
    const totalEl = document.getElementById('totalItems');
    const lowEl = document.getElementById('lowStockItems');
    const entriesEl = document.getElementById('totalEntradas');
    const exitsEl = document.getElementById('totalSaidas');
    if (totalEl) totalEl.textContent = String(stats.total ?? 0);
    if (lowEl) lowEl.textContent = String((stats.estoqueBaixo ?? 0) + (stats.esgotado ?? 0));
    if (entriesEl) entriesEl.textContent = String(stats.entradas ?? 0);
    if (exitsEl) exitsEl.textContent = String(stats.saidas ?? 0);
    return stats;
  }

  async function refreshFromServer() {
    if (!enabled()) return readCache();
    const response = await fetch(API_STATS, { credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message || 'Unable to load header statistics');
    }
    writeCache(result.data);
    applyToDom(result.data);
    return result.data;
  }

  // Entries/Exits click: refresh only movements. Keep Total Items / Low Stock from login cache.
  async function refreshMovementsFromServer() {
    if (!enabled()) return readCache();
    const cached = readCache() || {
      total: 0,
      estoqueBaixo: 0,
      esgotado: 0,
      entradas: 0,
      saidas: 0
    };
    const response = await fetch(API_STATS, { credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message || 'Unable to load header statistics');
    }
    const next = {
      total: cached.total ?? 0,
      estoqueBaixo: cached.estoqueBaixo ?? 0,
      esgotado: cached.esgotado ?? 0,
      entradas: result.data.entradas ?? 0,
      saidas: result.data.saidas ?? 0
    };
    writeCache(next);
    applyToDom(next);
    return next;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true' || (src.includes('chart') && typeof global.Chart !== 'undefined')) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureChartJs() {
    if (typeof global.Chart !== 'undefined') return;
    if (!chartJsPromise) chartJsPromise = loadScriptOnce(CHART_CDN);
    await chartJsPromise;
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatExportFileDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function formatExportDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function sanitizeFileNamePart(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'part';
  }

  function formatCategoryLabel(categoria) {
    const normalized = String(categoria || '').trim().toUpperCase();
    if (normalized === 'BATH') return 'Bath';
    if (typeof global.SectionOptions !== 'undefined') {
      return global.SectionOptions.formatSectionLabel(categoria);
    }
    return categoria || '-';
  }

  function formatSubcategoryLabel(subcategoria) {
    if (typeof global.BathwareSubcategoryOptions !== 'undefined') {
      return global.BathwareSubcategoryOptions.formatBathwareSubcategoryLabel(subcategoria);
    }
    return subcategoria || '';
  }

  function ensureModal() {
    let modal = document.getElementById('todayMovementsChartModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'todayMovementsChartModal';
    modal.className = 'modal today-movements-chart-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-content today-movements-chart-content">
        <div class="modal-header">
          <h3 id="todayMovementsChartTitle"><i class="fas fa-chart-pie"></i> Today</h3>
          <button type="button" class="modal-close" id="closeTodayMovementsChartModal" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body today-movements-chart-body">
          <div class="today-movements-chart-toolbar">
            <button type="button" class="btn btn-secondary btn-sm" id="todayMovementsChartBackBtn" hidden>
              <i class="fas fa-arrow-left"></i> Categories
            </button>
            <p class="today-movements-chart-hint" id="todayMovementsChartHint">Click a category to see subcategories</p>
          </div>
          <div class="today-movements-chart-wrap">
            <canvas id="todayMovementsChartCanvas" aria-label="Today movements pie chart"></canvas>
          </div>
          <p class="today-movements-chart-empty" id="todayMovementsChartEmpty" hidden>No movements today for this view.</p>
          <p class="today-movements-chart-total" id="todayMovementsChartTotal"></p>
          <div class="today-movements-export-panel" id="todayMovementsExportPanel" hidden>
            <p class="today-movements-export-text" id="todayMovementsExportText"></p>
            <div class="today-movements-export-actions">
              <button type="button" class="btn btn-primary btn-sm" id="todayMovementsExportExcelBtn">
                <i class="fas fa-file-excel"></i> Generate Excel
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="todayMovementsExportCancelBtn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function getEls() {
    ensureModal();
    return {
      modal: document.getElementById('todayMovementsChartModal'),
      title: document.getElementById('todayMovementsChartTitle'),
      hint: document.getElementById('todayMovementsChartHint'),
      backBtn: document.getElementById('todayMovementsChartBackBtn'),
      canvas: document.getElementById('todayMovementsChartCanvas'),
      empty: document.getElementById('todayMovementsChartEmpty'),
      total: document.getElementById('todayMovementsChartTotal'),
      wrap: document.querySelector('#todayMovementsChartModal .today-movements-chart-wrap'),
      exportPanel: document.getElementById('todayMovementsExportPanel'),
      exportText: document.getElementById('todayMovementsExportText'),
      exportBtn: document.getElementById('todayMovementsExportExcelBtn'),
      exportCancelBtn: document.getElementById('todayMovementsExportCancelBtn'),
      closeBtn: document.getElementById('closeTodayMovementsChartModal')
    };
  }

  function hideExportPanel() {
    const els = getEls();
    chartState.selectedSubcategoria = null;
    if (els.exportPanel) els.exportPanel.hidden = true;
    if (els.exportText) els.exportText.textContent = '';
  }

  function showExportOption(subcategoria) {
    const els = getEls();
    const categoria = chartState.categoria || '';
    chartState.selectedSubcategoria = subcategoria;
    if (els.exportText) {
      const kindLabel = chartState.tipo === 'saidas' ? 'Exits Today' : 'Entries Today';
      const sliceQty = Number(
        (chartState.items || []).find((item) => item.label === subcategoria)?.quantity
      ) || 0;
      els.exportText.textContent =
        `Generate Excel for ${kindLabel} — ${formatCategoryLabel(categoria)} / ${formatSubcategoryLabel(subcategoria) || subcategoria}` +
        (sliceQty ? ` (qty ${sliceQty})` : '') +
        '?';
    }
    if (els.exportPanel) els.exportPanel.hidden = false;
  }

  function destroyChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  function closeChartModal() {
    const els = getEls();
    if (els.modal) {
      els.modal.style.display = 'none';
      els.modal.setAttribute('aria-hidden', 'true');
    }
    destroyChart();
    hideExportPanel();
    chartState = { tipo: null, categoria: null, items: [], selectedSubcategoria: null };
  }

  function buildTodayMovementsExcelXml(list, meta = {}) {
    const headers = [
      'Location Code',
      'Product Code',
      'Qty',
      'Changed By',
      'Date Time'
    ];
    const headerRow = headers.map((header) =>
      `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
    ).join('');
    const dataRows = list.map((record) => {
      const qty = Number(record.quantityCurrent);
      const qtyCell = Number.isFinite(qty)
        ? `<Cell><Data ss:Type="Number">${qty}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${escapeXml(record.quantityCurrent ?? 0)}</Data></Cell>`;
      const when = record.lastUpdateDatetime || record.entryDatetime || '';
      const changedBy = record.usuarioInseriuNome || record.usuarioInseriu || '';
      return `<Row>${[
        `<Cell><Data ss:Type="String">${escapeXml(record.locationCode || '')}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${escapeXml(record.productCode || '')}</Data></Cell>`,
        qtyCell,
        `<Cell><Data ss:Type="String">${escapeXml(changedBy)}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${escapeXml(formatExportDateTime(when))}</Data></Cell>`
      ].join('')}</Row>`;
    }).join('');
    const total = Number(meta.total);
    const totalRow = Number.isFinite(total)
      ? `<Row>
<Cell><Data ss:Type="String">TOTAL</Data></Cell>
<Cell><Data ss:Type="String"></Data></Cell>
<Cell><Data ss:Type="Number">${total}</Data></Cell>
<Cell><Data ss:Type="String"></Data></Cell>
<Cell><Data ss:Type="String"></Data></Cell>
</Row>`
      : '';
    const rowCount = list.length + 1 + (totalRow ? 1 : 0);
    const sheetName = meta.tipo === 'saidas' ? 'Exits Today' : 'Entries Today';
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${escapeXml(sheetName)}">
<Table ss:ExpandedColumnCount="${headers.length}" ss:ExpandedRowCount="${rowCount}">
<Column ss:Width="120"/><Column ss:Width="140"/><Column ss:Width="90"/><Column ss:Width="140"/><Column ss:Width="160"/>
<Row>${headerRow}</Row>
${dataRows}
${totalRow}
</Table>
</Worksheet>
</Workbook>`;
  }

  async function downloadSubcategoryExcel() {
    const categoria = chartState.categoria;
    const subcategoria = chartState.selectedSubcategoria;
    const tipo = chartState.tipo;
    if (!categoria || !subcategoria || !tipo) return;
    const chartSliceQty = Number(
      (chartState.items || []).find((item) => item.label === subcategoria)?.quantity
    ) || 0;
    const els = getEls();
    if (els.exportBtn) {
      els.exportBtn.disabled = true;
      els.exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }
    try {
      const query = new URLSearchParams({ tipo, categoria, subcategoria });
      const response = await fetch(`${API_MOVEMENT_LINES}?${query.toString()}`, { credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load today movement lines');
      }
      const list = Array.isArray(result.data.items) ? result.data.items : [];
      const total = Number(result.data.total) || list.reduce((sum, row) => sum + (Number(row.quantityCurrent) || 0), 0);
      if (!list.length) {
        alert('No today movements found for this subcategory.');
        return;
      }
      if (chartSliceQty > 0 && total !== chartSliceQty) {
        console.warn('Excel total differs from chart slice', { chartSliceQty, total, categoria, subcategoria, tipo });
      }
      let userPrefix = 'user';
      try {
        const authRes = await fetch('/api/auth/check', { credentials: 'include' });
        const authData = await authRes.json().catch(() => ({}));
        if (authData.authenticated && authData.user) {
          if (authData.user.isRoot) userPrefix = 'root';
          else if (authData.user.email) userPrefix = sanitizeFileNamePart(authData.user.email);
        }
      } catch {
        // keep default
      }
      const xml = buildTodayMovementsExcelXml(list, { tipo, total });
      const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const kindPart = tipo === 'saidas' ? 'exits-today' : 'entries-today';
      link.href = url;
      link.download = `${userPrefix}-${kindPart}-${sanitizeFileNamePart(categoria)}-${sanitizeFileNamePart(subcategoria)}-${formatExportFileDate(new Date())}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Header stats Excel export failed:', error);
      alert('Could not generate Excel for this subcategory.');
    } finally {
      if (els.exportBtn) {
        els.exportBtn.disabled = false;
        els.exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Generate Excel';
      }
    }
  }

  async function loadChart() {
    const els = getEls();
    await ensureChartJs();
    if (!els.canvas || typeof global.Chart === 'undefined') {
      if (els.empty) {
        els.empty.hidden = false;
        els.empty.textContent = 'Chart library unavailable.';
      }
      return;
    }

    const tipo = chartState.tipo;
    const categoria = chartState.categoria;
    const kindLabel = tipo === 'saidas' ? 'Exits Today' : 'Entries Today';
    const query = new URLSearchParams({ tipo });
    if (categoria) query.set('categoria', categoria);

    if (els.title) {
      els.title.innerHTML = categoria
        ? `<i class="fas fa-chart-pie"></i> ${kindLabel} — ${categoria}`
        : `<i class="fas fa-chart-pie"></i> ${kindLabel} by Category`;
    }
    if (els.backBtn) els.backBtn.hidden = !categoria;
    if (els.hint) {
      els.hint.textContent = categoria
        ? 'Click a subcategory to export Location Product Excel'
        : 'Click a category to see subcategories';
    }
    if (!categoria) hideExportPanel();
    if (els.empty) {
      els.empty.hidden = true;
      els.empty.textContent = 'No movements today for this view.';
    }
    if (els.total) els.total.textContent = '';
    if (els.wrap) els.wrap.hidden = false;

    try {
      const response = await fetch(`${API_MOVEMENTS}?${query.toString()}`, { credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (!result.success || !result.data) throw new Error(result.message || 'Failed to load chart data');

      const items = Array.isArray(result.data.items) ? result.data.items : [];
      chartState.items = items;
      const total = Number(result.data.total) || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      destroyChart();

      if (!items.length) {
        if (els.wrap) els.wrap.hidden = true;
        if (els.empty) els.empty.hidden = false;
        return;
      }

      if (els.total) els.total.innerHTML = `Total: <strong>${total}</strong>`;
      const labels = items.map((item) => item.label);
      const values = items.map((item) => Number(item.quantity) || 0);
      const colors = labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]);
      const canDrillDown = !categoria;
      const canExportSubcategory = Boolean(categoria);

      chartInstance = new global.Chart(els.canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 8,
                generateLabels(chart) {
                  const data = chart.data;
                  if (!data.labels?.length || !data.datasets?.length) return [];
                  const dataset = data.datasets[0];
                  return data.labels.map((label, index) => ({
                    text: `${label}: ${dataset.data[index] ?? 0}`,
                    fillStyle: Array.isArray(dataset.backgroundColor)
                      ? dataset.backgroundColor[index]
                      : dataset.backgroundColor,
                    strokeStyle: '#fff',
                    lineWidth: 1,
                    hidden: false,
                    index
                  }));
                }
              }
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = Number(context.raw) || 0;
                  const sum = (context.dataset.data || []).reduce((acc, n) => acc + (Number(n) || 0), 0);
                  const pct = sum ? Math.round((value / sum) * 1000) / 10 : 0;
                  return `${context.label}: ${value} (${pct}%)`;
                }
              }
            }
          },
          onClick: async (_event, elements) => {
            if (!elements?.length) return;
            const index = elements[0].index;
            const label = chartState.items[index]?.label;
            if (!label) return;
            if (canDrillDown) {
              chartState.categoria = label;
              await loadChart();
              return;
            }
            if (canExportSubcategory) showExportOption(label);
          }
        }
      });
    } catch (error) {
      console.error('Header stats chart failed:', error);
      destroyChart();
      if (els.wrap) els.wrap.hidden = true;
      if (els.empty) {
        els.empty.hidden = false;
        els.empty.textContent = 'Could not load chart data.';
      }
    }
  }

  async function openChart(tipo) {
    if (!enabled()) return;
    const els = getEls();
    chartState.tipo = tipo;
    chartState.categoria = null;
    hideExportPanel();
    els.modal.style.display = 'flex';
    els.modal.setAttribute('aria-hidden', 'false');
    await loadChart();
  }

  async function onEntriesOrExitsClick(tipo) {
    if (!enabled()) return;
    try {
      await refreshMovementsFromServer();
    } catch (error) {
      console.error('Header stats refresh failed:', error);
    }
    await openChart(tipo);
  }

  function makeClickable(el, tipo) {
    if (!el || el.dataset.headerStatsBound === 'true') return;
    el.dataset.headerStatsBound = 'true';
    el.classList.add('header-stat-clickable');
    if (el.tagName !== 'BUTTON') {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    }
    el.addEventListener('click', (event) => {
      event.preventDefault();
      void onEntriesOrExitsClick(tipo);
    });
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      void onEntriesOrExitsClick(tipo);
    });
  }

  function bindClickTargets() {
    const entriesBtn = document.getElementById('entriesTodayStatBtn');
    const exitsBtn = document.getElementById('exitsTodayStatBtn');
    const entriesStat = entriesBtn || document.querySelector('.header-stat-entries');
    const exitsStat = exitsBtn || document.querySelector('.header-stat-exits');
    makeClickable(entriesStat, 'entradas');
    makeClickable(exitsStat, 'saidas');
  }

  function bindModalControls() {
    const els = getEls();
    if (els.closeBtn && els.closeBtn.dataset.bound !== 'true') {
      els.closeBtn.dataset.bound = 'true';
      els.closeBtn.addEventListener('click', () => closeChartModal());
    }
    if (els.backBtn && els.backBtn.dataset.bound !== 'true') {
      els.backBtn.dataset.bound = 'true';
      els.backBtn.addEventListener('click', () => {
        chartState.categoria = null;
        hideExportPanel();
        void loadChart();
      });
    }
    if (els.exportBtn && els.exportBtn.dataset.bound !== 'true') {
      els.exportBtn.dataset.bound = 'true';
      els.exportBtn.addEventListener('click', () => {
        void downloadSubcategoryExcel();
      });
    }
    if (els.exportCancelBtn && els.exportCancelBtn.dataset.bound !== 'true') {
      els.exportCancelBtn.dataset.bound = 'true';
      els.exportCancelBtn.addEventListener('click', () => hideExportPanel());
    }
    if (els.modal && els.modal.dataset.bound !== 'true') {
      els.modal.dataset.bound = 'true';
      els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) closeChartModal();
      });
    }
    if (!document.documentElement.dataset.headerStatsEscBound) {
      document.documentElement.dataset.headerStatsEscBound = 'true';
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const modal = document.getElementById('todayMovementsChartModal');
        if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
          closeChartModal();
        }
      });
    }
  }

  function init() {
    if (window.location.pathname.endsWith('/login.html')) return;
    applyToDom();
    if (!enabled()) return;
    bindClickTargets();
    bindModalControls();
    bound = true;
  }

  function boot() {
    init();
    window.addEventListener('doubley:system-settings-applied', () => {
      applyToDom();
      if (enabled()) {
        bindClickTargets();
        bindModalControls();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.DoubleYHeaderStats = {
    STORAGE_KEY,
    enabled,
    readCache,
    writeCache,
    clearCache,
    applyToDom,
    refreshFromServer,
    refreshMovementsFromServer,
    openChart,
    onEntriesOrExitsClick,
    init
  };
})(window);
