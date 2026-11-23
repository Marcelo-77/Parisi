/**
 * Desktop corporate dashboard for warehouse-home.html (Sidebar mode).
 * Does not alter Model celular mobile UI.
 */
(function () {
  const ROOT_ID = 'warehouseHomeDashboard';
  let lastVisible = null;
  let renderTimer = null;

  const VERSE_EN = 'I can do all things through Christ who strengthens me. — Philippians 4:13';
  const VERSE_PT = 'Posso todas as coisas naquele que me fortalece. — Filipenses 4.13';

  const I18N = {
    'Welcome back,': 'Bem-vindo de volta,',
    [VERSE_EN]: VERSE_PT,
    'Total Items': 'Total de itens',
    'Low Stock': 'Estoque baixo',
    'Entries Today': 'Entradas hoje',
    'Exits Today': 'Saídas hoje',
    'Warehouse Overview': 'Visão do warehouse',
    'Quick Access': 'Acesso rápido',
    'Recent Activity': 'Atividade recente',
    'No recent activity to display.': 'Nenhuma atividade recente para exibir.',
    Products: 'Produtos',
    Locations: 'Localizações',
    'Location Product': 'Location Product',
    'Log Location Product': 'Log Location Product',
    'Catalog size across the warehouse.': 'Tamanho do catálogo no warehouse.',
    'Items at or below minimum stock.': 'Itens no ou abaixo do estoque mínimo.',
    'Inbound movements recorded today.': 'Movimentos de entrada registrados hoje.',
    'Outbound movements recorded today.': 'Movimentos de saída registrados hoje.'
  };

  function currentLang() {
    return window.DoubleYScreenDisplay?.getLang?.()
      || window.DoubleYScreenDisplay?.getLanguage?.()
      || 'en';
  }

  function tr(text) {
    const lang = currentLang();
    if (lang === 'pt' && I18N[text]) return I18N[text];
    return text;
  }

  function welcomeVerse() {
    return currentLang() === 'pt' ? VERSE_PT : VERSE_EN;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isDesktopSidebarHome() {
    const body = document.body;
    if (!body?.classList.contains('warehouse-home-page')) return false;
    if (!body.classList.contains('screen-display-sidebar')) return false;
    if (body.classList.contains('ssd-narrow')) return false;
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) return false;
    return true;
  }

  function readUser() {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem('doubley_menu_access') || 'null');
      return cached?.user || null;
    } catch {
      return null;
    }
  }

  function firstName(user) {
    const full = String(user?.nome || user?.email || '').trim();
    if (!full) return '—';
    return full.split(/\s+/)[0];
  }

  function sectionHref(label) {
    const actions = document.querySelector('.header-actions');
    if (!actions) return null;
    const buttons = actions.querySelectorAll('[id$="MenuBtn"]');
    for (const btn of buttons) {
      const text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text.includes(String(label).toLowerCase())) continue;
      const dropdown = btn.closest('[class*="-dropdown"]') || btn.parentElement;
      const first = dropdown?.querySelector('a.dropdown-item[href]');
      if (first?.getAttribute('href')) return first.getAttribute('href');
    }
    return null;
  }

  function ensureRoot() {
    const main = document.querySelector('.main-content');
    if (!main) return null;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('section');
      root.id = ROOT_ID;
      root.setAttribute('aria-label', 'Warehouse dashboard');
      main.appendChild(root);
    }
    return root;
  }

  function clearRoot() {
    document.getElementById(ROOT_ID)?.remove();
  }

  function metricCard(opts) {
    if (opts.chartTipo) {
      const idAttr = opts.id ? ` id="${escapeHtml(opts.id)}"` : '';
      return `
      <button type="button" class="whd-metric whd-metric--chart"${idAttr} data-open-movements-chart="${escapeHtml(opts.chartTipo)}" title="${escapeHtml(tr(opts.label))}">
        <span class="whd-metric-icon"><i class="fas ${opts.icon}" aria-hidden="true"></i></span>
        <span>
          <strong>${escapeHtml(tr(opts.label))}</strong>
          <span data-metric="${escapeHtml(opts.key)}">${escapeHtml(opts.value)}</span>
        </span>
      </button>
    `;
    }
    const tag = opts.href ? 'a' : 'div';
    const href = opts.href ? ` href="${escapeHtml(opts.href)}"` : '';
    return `
      <${tag} class="whd-metric"${href}>
        <span class="whd-metric-icon"><i class="fas ${opts.icon}" aria-hidden="true"></i></span>
        <span>
          <strong>${escapeHtml(tr(opts.label))}</strong>
          <span data-metric="${escapeHtml(opts.key)}">${escapeHtml(opts.value)}</span>
        </span>
      </${tag}>
    `;
  }

  function setMetric(key, value) {
    const el = document.querySelector(`[data-metric="${key}"]`);
    if (el) el.textContent = value;
  }

  function readCachedStats() {
    if (window.DoubleYHeaderStats?.readCache) {
      return window.DoubleYHeaderStats.readCache();
    }
    try {
      const raw = localStorage.getItem('doubley_header_stats') || sessionStorage.getItem('doubley_header_stats');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function applyStats(stats) {
    const total = Number(stats?.total ?? 0);
    const low = Number(stats?.estoqueBaixo ?? 0) + Number(stats?.esgotado ?? 0);
    const entries = Number(stats?.entradas ?? 0);
    const exits = Number(stats?.saidas ?? 0);
    setMetric('totalItems', String(total));
    setMetric('lowStock', String(low));
    setMetric('entriesToday', String(entries));
    setMetric('exitsToday', String(exits));
    setMetric('overviewTotal', String(total));
    setMetric('overviewLow', String(low));
    setMetric('overviewEntries', String(entries));
    setMetric('overviewExits', String(exits));
  }

  async function loadStats() {
    // Use login cache only. Fresh server fetch happens on first create (login)
    // or when the user clicks Entries/Exits to open the charts.
    const cached = readCachedStats();
    if (cached) {
      applyStats(cached);
      return;
    }

    try {
      if (window.DoubleYHeaderStats?.refreshFromServer) {
        const stats = await window.DoubleYHeaderStats.refreshFromServer();
        if (stats) applyStats(stats);
        return;
      }
      const res = await fetch('/api/warehouse/estatisticas', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data) {
        applyStats(data.data);
        try {
          const payload = JSON.stringify(data.data);
          localStorage.setItem('doubley_header_stats', payload);
          sessionStorage.setItem('doubley_header_stats', payload);
        } catch {
          // ignore
        }
      }
    } catch {
      // keep empty placeholders
    }
  }

  function renderShell(root) {
    const user = readUser();
    const name = firstName(user);
    const productsHref = 'warehouse.html?action=search';
    const locationsHref = 'location-search.html';
    const locationProductHref = 'location-product.html';
    const logLocationProductHref = 'log-location-product.html';

    root.innerHTML = `
      <div class="whd-welcome">
        <h2>${escapeHtml(tr('Welcome back,'))} ${escapeHtml(name)}</h2>
        <p class="whd-welcome-verse">${escapeHtml(welcomeVerse())}</p>
      </div>

      <div class="whd-metrics">
        ${metricCard({ key: 'totalItems', label: 'Total Items', icon: 'fa-boxes-stacked', value: '—', href: productsHref })}
        ${metricCard({ key: 'lowStock', label: 'Low Stock', icon: 'fa-triangle-exclamation', value: '—', href: productsHref })}
        ${metricCard({ key: 'entriesToday', label: 'Entries Today', icon: 'fa-arrow-down', value: '—', id: 'whdEntriesToday', chartTipo: 'entradas' })}
        ${metricCard({ key: 'exitsToday', label: 'Exits Today', icon: 'fa-arrow-up', value: '—', id: 'whdExitsToday', chartTipo: 'saidas' })}
      </div>

      <div class="whd-body">
        <section class="whd-panel whd-overview">
          <div class="whd-panel-head">
            <h3><i class="fas fa-chart-pie" aria-hidden="true"></i>${escapeHtml(tr('Warehouse Overview'))}</h3>
          </div>
          <div class="whd-overview-grid">
            <div class="whd-overview-card">
              <strong>${escapeHtml(tr('Total Items'))}</strong>
              <span>${escapeHtml(tr('Catalog size across the warehouse.'))}</span>
              <em data-metric="overviewTotal">—</em>
            </div>
            <div class="whd-overview-card">
              <strong>${escapeHtml(tr('Low Stock'))}</strong>
              <span>${escapeHtml(tr('Items at or below minimum stock.'))}</span>
              <em data-metric="overviewLow">—</em>
            </div>
            <div class="whd-overview-card">
              <strong>${escapeHtml(tr('Entries Today'))}</strong>
              <span>${escapeHtml(tr('Inbound movements recorded today.'))}</span>
              <em data-metric="overviewEntries">—</em>
            </div>
            <div class="whd-overview-card">
              <strong>${escapeHtml(tr('Exits Today'))}</strong>
              <span>${escapeHtml(tr('Outbound movements recorded today.'))}</span>
              <em data-metric="overviewExits">—</em>
            </div>
          </div>
        </section>

        <aside class="whd-side">
          <section class="whd-panel">
            <div class="whd-panel-head">
              <h3><i class="fas fa-bolt" aria-hidden="true"></i>${escapeHtml(tr('Quick Access'))}</h3>
            </div>
            <div class="whd-quick-grid">
              <a class="whd-quick" href="${escapeHtml(productsHref)}"><i class="fas fa-box"></i><span>${escapeHtml(tr('Products'))}</span></a>
              <a class="whd-quick" href="${escapeHtml(locationsHref)}"><i class="fas fa-map-marker-alt"></i><span>${escapeHtml(tr('Locations'))}</span></a>
              <a class="whd-quick" href="${escapeHtml(locationProductHref)}"><i class="fas fa-boxes-stacked"></i><span>${escapeHtml(tr('Location Product'))}</span></a>
              <a class="whd-quick" href="${escapeHtml(logLocationProductHref)}"><i class="fas fa-history"></i><span>${escapeHtml(tr('Log Location Product'))}</span></a>
            </div>
          </section>

          <section class="whd-panel">
            <div class="whd-panel-head">
              <h3><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(tr('Recent Activity'))}</h3>
            </div>
            <div class="whd-activity-empty">
              <i class="fas fa-file-lines" aria-hidden="true"></i>
              <p>${escapeHtml(tr('No recent activity to display.'))}</p>
            </div>
          </section>
        </aside>
      </div>
    `;
  }

  function render(force) {
    const visible = isDesktopSidebarHome();
    if (!visible) {
      if (lastVisible !== false) clearRoot();
      lastVisible = false;
      return;
    }
    const root = ensureRoot();
    if (!root) return;
    if (!force && lastVisible === true && root.childElementCount) return;
    lastVisible = true;
    renderShell(root);
    loadStats();
    if (window.DoubleYHeaderStats?.bindClickTargets) {
      window.DoubleYHeaderStats.bindClickTargets();
    }
  }

  function scheduleRender(force) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => render(Boolean(force)), 40);
  }

  window.DoubleYWarehouseHomeDashboard = {
    render,
    refresh: render
  };

  document.addEventListener('DOMContentLoaded', () => scheduleRender(true));
  window.addEventListener('doubley:languagechange', () => scheduleRender(true));
  window.addEventListener('resize', () => scheduleRender(true));
  document.addEventListener('doubley:menu-access-applied', () => scheduleRender(true));

  const mo = new MutationObserver(() => scheduleRender(true));
  if (document.body) {
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  }
})();
