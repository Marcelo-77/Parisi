(function () {
  const PREFERRED_KEY = 'doubley_screen_display_preferred';
  const ACTIVE_KEY = 'doubley_screen_display_active';
  const PREFERRED_COLOR_KEY = 'doubley_screen_display_preferred_color';
  const ACTIVE_COLOR_KEY = 'doubley_screen_display_active_color';
  const PREFERRED_TONE_KEY = 'doubley_screen_display_preferred_tone';
  const ACTIVE_TONE_KEY = 'doubley_screen_display_active_tone';
  const DEFAULT_COLOR = '#101d35';
  const DEFAULT_TONE = 50;
  const LANG_STORAGE_KEY = 'doubley-site-lang';
  const STYLE_HREF = 'screen-display.css?v=20261124verse1';
  const REVEAL_HOLD_KEY = 'doubley_ssd_reveal_hold';
  const TAB_SESSION_KEY = 'doubley_tab_auth';
  const NARROW_MQ = '(max-width: 900px)';

  const MENU_PT = {
    Home: 'Início',
    Exit: 'Sair',
    Menu: 'Menu',
    Users: 'Usuários',
    'New User': 'Novo Usuário',
    'Search User': 'Pesquisar Usuário',
    'Change Password': 'Alterar Senha',
    'Master Data': 'Dados Mestres',
    'Augmented Reality': 'Realidade Aumentada',
    'AR product search and visualization.': 'Busca e visualização de produtos em RA.',
    Company: 'Empresa',
    'New Company': 'Nova Empresa',
    'Search Company': 'Pesquisar Empresa',
    'User Companies': 'Empresas do Usuário',
    Customer: 'Cliente',
    'New Customer': 'Novo Cliente',
    'Search Customer': 'Pesquisar Cliente',
    'Search Invoice by Customer': 'Pesquisar Fatura por Cliente',
    'Customer Roles': 'Funções do Cliente',
    Roles: 'Funções',
    'New Roles': 'Novas Funções',
    'Search Roles': 'Pesquisar Funções',
    'Roles Applications': 'Funções nas Aplicações',
    'Business Partner': 'Parceiro de Negócio',
    'New Business Partner': 'Novo Parceiro de Negócio',
    'Search Business Partner': 'Pesquisar Parceiro de Negócio',
    'Business Partner Roles': 'Funções do Parceiro',
    Schedule: 'Agenda',
    'Search Schedule': 'Pesquisar Agenda',
    'Job and Business Partner Evaluation': 'Avaliação de Serviço e Parceiro',
    Management: 'Gestão',
    'Setting Management': 'Configurações de Gestão',
    'Settings BP Invoice': 'Config. Fatura do Parceiro',
    'Photo Capture Settings': 'Config. Captura de Foto',
    'Evidence for the Job': 'Evidências do Serviço',
    'Survey Sending Settings': 'Config. Envio de Pesquisa',
    'Reminders to Customers': 'Lembretes aos Clientes',
    'Customer details Invoice': 'Detalhes da Fatura do Cliente',
    Customers: 'Clientes',
    'Sent Reminders to Customers': 'Lembretes Enviados aos Clientes',
    'Make and Send Invoice to Customer': 'Criar e Enviar Fatura ao Cliente',
    'Search Customer Invoices': 'Pesquisar Faturas do Cliente',
    'Business Partner Management': 'Gestão de Parceiros',
    'Clock In': 'Entrada',
    'Clock Out': 'Saída',
    'Add Photo and Details for Schedule': 'Foto e Detalhes da Agenda',
    'Generate Invoice for Company': 'Gerar Fatura da Empresa',
    Applications: 'Aplicações',
    'New Applications': 'Novas Aplicações',
    'Search Applications': 'Pesquisar Aplicações',
    'Application Users': 'Usuários das Aplicações',
    'Logged-in Users': 'Usuários Logados',
    'Upload Warehouse Map': 'Enviar Mapa do Estoque',
    'System Documentation': 'Documentação do Sistema',
    'New System Documentation': 'Nova Documentação',
    'Search System Documentation': 'Pesquisar Documentação',
    Settings: 'Configurações',
    'System Settings': 'Configurações do Sistema',
    'Improvements Settings': 'Config. Melhorias',
    'Setting Screen Display': 'Config. Exibição da Tela',
    News: 'Notícias',
    'Search News': 'Pesquisar Notícias',
    'Improvements and Corrections Control': 'Controle de Melhorias e Correções',
    'New Request': 'Nova Solicitação',
    'Search Request': 'Pesquisar Solicitação',
    'Message Email': 'Mensagem por E-mail',
    'New Message Email': 'Nova Mensagem',
    'Search Message Email': 'Pesquisar Mensagem',
    'Search Email Send Log': 'Pesquisar Log de Envio',
    Movement: 'Movimentação',
    'New Movement': 'Nova Movimentação',
    'Search Movement': 'Pesquisar Movimentação',
    'Situation of the Movement': 'Situação da Movimentação',
    Picking: 'Separação',
    'Picking List': 'Lista de Separação',
    'Order Sent for Picking': 'Pedido Enviado para Separação',
    'Separation and Picking': 'Separação e Picking',
    'Sent for Double Checking': 'Enviado para Dupla Conferência',
    Church: 'Igreja',
    'Order of Service': 'Ordem de Culto',
    'Search Order of Service': 'Pesquisar Ordem de Culto',
    Help: 'Ajuda',
    'Help Center': 'Central de Ajuda',
    'System Modules': 'Módulos do Sistema',
    'Picking Workflow': 'Fluxo de Separação',
    'Generate QR Code': 'Gerar QR Code',
    'Main navigation': 'Navegação principal',
    'Mobile home navigation': 'Navegação mobile',
    Language: 'Idioma',
    'Welcome back,': 'Bem-vindo de volta,',
    'I can do all things through Christ who strengthens me. — Philippians 4:13':
      'Posso todas as coisas naquele que me fortalece. — Filipenses 4.13',
    Company: 'Empresa',
    'Double-Y Warehouse System': 'Sistema Double-Y Warehouse',
    'Manage products, locations, movements and warehouse operations.':
      'Gerencie produtos, localizações, movimentos e operações do warehouse.',
    'Manage people and access.': 'Gerencie pessoas e acessos.',
    'Products, bins and information.': 'Produtos, locais e informações.',
    'Planning and activities.': 'Planejamento e atividades.',
    'Operations and control.': 'Operações e controle.',
    'Integrated solutions.': 'Soluções integradas.',
    'System configuration.': 'Configuração do sistema.',
    'Stock movements and tracking.': 'Movimentações e rastreio de estoque.',
    'Picking and separation.': 'Separação e picking.',
    'Service orders and church tools.': 'Ordens de culto e ferramentas.',
    'Guides and system help.': 'Guias e ajuda do sistema.',
    'Open module': 'Abrir módulo',
    'Double Y IT Systems': 'Double Y IT Systems',
    'Setting Screen Display': 'Config. Exibição da Tela',
    'Choose how menus appear across the system. Classic keeps today’s top menu. Sidebar keeps the same menu structure and applications as today, shown in a left panel (and a mobile home-style bar).':
      'Escolha como os menus aparecem no sistema. Classic mantém o menu superior de hoje. Sidebar mantém a mesma estrutura e aplicações de hoje, em um painel à esquerda (e uma barra estilo home no celular).',
    'Classic menu': 'Menu clássico',
    'Current Double-Y header with dropdown menus (Users, Master Data, Schedule, Management, Applications…).':
      'Cabeçalho atual do Double-Y com menus suspensos (Usuários, Dados Mestres, Agenda, Gestão, Aplicações…).',
    'Sidebar menu': 'Menu lateral',
    'Left sidebar with the same groups as today (Users, Master Data, Schedule, Management, Applications…). On phones, a home-style bottom bar opens the full menu. Pick a color and tone below.':
      'Menu lateral com os mesmos grupos de hoje (Usuários, Dados Mestres, Agenda, Gestão, Aplicações…). No celular, uma barra inferior abre o menu completo. Escolha cor e tonalidade abaixo.',
    'Sidebar color & tone': 'Cor e tonalidade da sidebar',
    'Choose a color and adjust how dark or light the sidebar looks. Applies with Sidebar menu on your next sign-in.':
      'Escolha uma cor e ajuste o tom da sidebar. Vale com o menu Sidebar no próximo login.',
    'Custom color': 'Cor personalizada',
    Tone: 'Tom',
    Darker: 'Mais escuro',
    Lighter: 'Mais claro',
    Deep: 'Profundo',
    Softer: 'Mais suave',
    Light: 'Claro',
    Standard: 'Padrão',
    'Save display': 'Salvar exibição',
    Cancel: 'Cancelar',
    Save: 'Salvar',
    Search: 'Pesquisar',
    New: 'Novo',
    Edit: 'Editar',
    Delete: 'Excluir',
    Close: 'Fechar',
    Back: 'Voltar',
    Yes: 'Sim',
    No: 'Não',
    Confirm: 'Confirmar',
    Actions: 'Ações',
    Status: 'Status',
    Name: 'Nome',
    Email: 'E-mail',
    Password: 'Senha',
    Phone: 'Telefone',
    Address: 'Endereço',
    Date: 'Data',
    Time: 'Hora',
    Description: 'Descrição',
    Notes: 'Observações',
    Active: 'Ativo',
    Inactive: 'Inativo',
    Filter: 'Filtrar',
    Clear: 'Limpar',
    Reset: 'Redefinir',
    Submit: 'Enviar',
    Upload: 'Enviar arquivo',
    Download: 'Baixar',
    Print: 'Imprimir',
    Export: 'Exportar',
    Import: 'Importar',
    Details: 'Detalhes',
    Settings: 'Configurações',
    'Display saved. Menu style, color, and tone will be used only after you sign in again.':
      'Exibição salva. Estilo, cor e tonalidade do menu valem só depois de entrar novamente.'
  };

  const FLAG_BR_SVG = `
    <svg class="ssd-lang-flag" viewBox="0 0 22 15" aria-hidden="true">
      <rect width="22" height="15" fill="#009c3b"/>
      <polygon points="11,1.5 20,7.5 11,13.5 2,7.5" fill="#ffdf00"/>
      <circle cx="11" cy="7.5" r="3.2" fill="#002776"/>
    </svg>`;

  const FLAG_EN_SVG = `
    <svg class="ssd-lang-flag" viewBox="0 0 22 15" aria-hidden="true">
      <rect width="22" height="15" fill="#012169"/>
      <path d="M0,0 L22,15 M22,0 L0,15" stroke="#fff" stroke-width="3"/>
      <path d="M0,0 L22,15 M22,0 L0,15" stroke="#c8102e" stroke-width="1.5"/>
      <path d="M11,0 V15 M0,7.5 H22" stroke="#fff" stroke-width="5"/>
      <path d="M11,0 V15 M0,7.5 H22" stroke="#c8102e" stroke-width="2.5"/>
    </svg>`;

  const TOP_DROPDOWN_SELECTORS = [
    '.users-dropdown',
    '.master-data-dropdown',
    '.augmented-reality-dropdown',
    '.applications-dropdown',
    '.movement-dropdown',
    '.picking-dropdown',
    '.church-dropdown',
    '.help-dropdown'
  ];

  function normalizeMode(value) {
    return String(value || '').trim().toLowerCase() === 'sidebar' ? 'sidebar' : 'classic';
  }

  function normalizeHex(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) return DEFAULT_COLOR;
    return `#${match[1].toLowerCase()}`;
  }

  function normalizeTone(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_TONE;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
  }

  function mixRgb(a, b, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t
    };
  }

  function buildTheme(color, tone) {
    const base = hexToRgb(color);
    const t = normalizeTone(tone);
    let rail = base;
    if (t < DEFAULT_TONE) {
      rail = mixRgb(base, { r: 0, g: 0, b: 0 }, ((DEFAULT_TONE - t) / DEFAULT_TONE) * 0.48);
    } else if (t > DEFAULT_TONE) {
      rail = mixRgb(base, { r: 255, g: 255, b: 255 }, ((t - DEFAULT_TONE) / DEFAULT_TONE) * 0.38);
    }
    const active = mixRgb(rail, { r: 255, g: 255, b: 255 }, 0.16);
    const deep = mixRgb(rail, { r: 0, g: 0, b: 0 }, 0.2);
    const light = mixRgb(rail, { r: 255, g: 255, b: 255 }, 0.24);
    // App accent on the right must match the left active blue (#2563eb) for the
    // default navy Sidebar color; custom colors keep a vivid lift of that hue.
    const accentBlue = { r: 37, g: 99, b: 235 };
    const accent =
      normalizeHex(color) === DEFAULT_COLOR
        ? accentBlue
        : mixRgb(mixRgb(base, accentBlue, 0.35), { r: 255, g: 255, b: 255 }, 0.18);
    const accentSoft = mixRgb(accent, { r: 255, g: 255, b: 255 }, 0.88);
    const accentSoft2 = mixRgb(accent, { r: 255, g: 255, b: 255 }, 0.93);
    // Lighter blue content area (Schedule-style), not the classic purple gradient.
    const appBg = mixRgb(accent, { r: 248, g: 250, b: 253 }, 0.94);
    return {
      color: normalizeHex(color),
      tone: t,
      rail: rgbToHex(rail),
      active: rgbToHex(active),
      deep: rgbToHex(deep),
      light: rgbToHex(light),
      text: '#e8eef8',
      muted: 'rgba(215, 226, 245, 0.28)',
      accent: rgbToHex(accent),
      accentSoft: rgbToHex(accentSoft),
      accentSoft2: rgbToHex(accentSoft2),
      appBg: rgbToHex(appBg)
    };
  }

  function readPreferredMode() {
    try {
      return normalizeMode(window.localStorage.getItem(PREFERRED_KEY));
    } catch {
      return 'classic';
    }
  }

  function writePreferredMode(mode) {
    try {
      window.localStorage.setItem(PREFERRED_KEY, normalizeMode(mode));
    } catch {
      /* ignore */
    }
  }

  function readPreferredColor() {
    try {
      return normalizeHex(window.localStorage.getItem(PREFERRED_COLOR_KEY) || DEFAULT_COLOR);
    } catch {
      return DEFAULT_COLOR;
    }
  }

  function writePreferredColor(color) {
    try {
      window.localStorage.setItem(PREFERRED_COLOR_KEY, normalizeHex(color));
    } catch {
      /* ignore */
    }
  }

  function readPreferredTone() {
    try {
      return normalizeTone(window.localStorage.getItem(PREFERRED_TONE_KEY) ?? DEFAULT_TONE);
    } catch {
      return DEFAULT_TONE;
    }
  }

  function writePreferredTone(tone) {
    try {
      window.localStorage.setItem(PREFERRED_TONE_KEY, String(normalizeTone(tone)));
    } catch {
      /* ignore */
    }
  }

  function hasTabSession() {
    try {
      return window.sessionStorage.getItem(TAB_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  function readActiveMode() {
    const preferred = readPreferredMode();
    // Once Sidebar is saved, keep it across every app navigation — never flash Classic.
    if (preferred === 'sidebar') {
      try {
        if (window.sessionStorage.getItem(ACTIVE_KEY) !== 'sidebar') {
          writeActiveMode('sidebar');
          writeActiveColor(readPreferredColor());
          writeActiveTone(readPreferredTone());
        }
      } catch {
        /* ignore */
      }
      return 'sidebar';
    }
    try {
      const active = window.sessionStorage.getItem(ACTIVE_KEY);
      if (active) return normalizeMode(active);
    } catch {
      /* ignore */
    }
    // Recover after www/non-www hop where sessionStorage was reset but preferred remains.
    if (hasTabSession()) {
      writeActiveMode(preferred);
      return preferred;
    }
    return 'classic';
  }

  function hasRevealHold() {
    try {
      return window.sessionStorage.getItem(REVEAL_HOLD_KEY) === '1';
    } catch {
      return false;
    }
  }

  function clearRevealHold() {
    try {
      window.sessionStorage.removeItem(REVEAL_HOLD_KEY);
    } catch {
      /* ignore */
    }
  }

  function writeActiveMode(mode) {
    try {
      window.sessionStorage.setItem(ACTIVE_KEY, normalizeMode(mode));
    } catch {
      /* ignore */
    }
  }

  function readActiveColor() {
    try {
      const active = window.sessionStorage.getItem(ACTIVE_COLOR_KEY);
      if (active) return normalizeHex(active);
    } catch {
      /* ignore */
    }
    if (hasTabSession()) {
      const preferred = readPreferredColor();
      writeActiveColor(preferred);
      return preferred;
    }
    return DEFAULT_COLOR;
  }

  function writeActiveColor(color) {
    try {
      window.sessionStorage.setItem(ACTIVE_COLOR_KEY, normalizeHex(color));
    } catch {
      /* ignore */
    }
  }

  function readActiveTone() {
    try {
      const active = window.sessionStorage.getItem(ACTIVE_TONE_KEY);
      if (active != null && active !== '') return normalizeTone(active);
    } catch {
      /* ignore */
    }
    if (hasTabSession()) {
      const preferred = readPreferredTone();
      writeActiveTone(preferred);
      return preferred;
    }
    return DEFAULT_TONE;
  }

  function writeActiveTone(tone) {
    try {
      window.sessionStorage.setItem(ACTIVE_TONE_KEY, String(normalizeTone(tone)));
    } catch {
      /* ignore */
    }
  }

  function activatePreferredForSession() {
    writeActiveMode(readPreferredMode());
    writeActiveColor(readPreferredColor());
    writeActiveTone(readPreferredTone());
  }

  function isNarrowViewport() {
    return Boolean(window.matchMedia && window.matchMedia(NARROW_MQ).matches);
  }

  function hydrateFromServer(prefs) {
    if (!prefs || typeof prefs !== 'object') return readActiveMode();

    // No server row yet: keep local preference and upload it if Sidebar was chosen here.
    if (prefs.saved === false) {
      const localMode = readPreferredMode();
      const localColor = readPreferredColor();
      const localTone = readPreferredTone();
      if (localMode === 'sidebar' || localColor !== DEFAULT_COLOR || localTone !== DEFAULT_TONE) {
        saveToServer({ mode: localMode, color: localColor, tone: localTone }).catch(() => {});
      }
      if (localMode === 'sidebar') {
        writeActiveMode('sidebar');
        writeActiveColor(localColor);
        writeActiveTone(localTone);
      }
      return readActiveMode();
    }

    const mode = normalizeMode(prefs.mode);
    const color = normalizeHex(prefs.color);
    const tone = normalizeTone(prefs.tone);
    writePreferredMode(mode);
    writePreferredColor(color);
    writePreferredTone(tone);
    // Sync across devices: activate immediately so phone gets Sidebar/Model celular.
    writeActiveMode(mode);
    writeActiveColor(color);
    writeActiveTone(tone);
    return mode;
  }

  async function saveToServer(prefs) {
    const payload = {
      mode: normalizeMode(prefs?.mode ?? readPreferredMode()),
      color: normalizeHex(prefs?.color ?? readPreferredColor()),
      tone: normalizeTone(prefs?.tone ?? readPreferredTone())
    };
    if (prefs && Object.prototype.hasOwnProperty.call(prefs, 'layoutNoticeSeen')) {
      payload.layoutNoticeSeen = prefs.layoutNoticeSeen === true;
    }
    writePreferredMode(payload.mode);
    writePreferredColor(payload.color);
    writePreferredTone(payload.tone);
    if (isNarrowViewport() || payload.mode === 'sidebar') {
      writeActiveMode(payload.mode);
      writeActiveColor(payload.color);
      writeActiveTone(payload.tone);
    }
    const res = await fetch('/api/auth/screen-display', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Unable to save display settings');
    }
    const saved = data.screenDisplay || payload;
    writePreferredMode(saved.mode);
    writePreferredColor(saved.color);
    writePreferredTone(saved.tone);
    writeActiveMode(saved.mode);
    writeActiveColor(saved.color);
    writeActiveTone(saved.tone);
    return saved;
  }

  function applyThemeToElement(el, theme) {
    if (!el || !theme) return;
    el.style.setProperty('--ssd-rail', theme.rail);
    el.style.setProperty('--ssd-rail-active', theme.active);
    el.style.setProperty('--ssd-rail-deep', theme.deep);
    el.style.setProperty('--ssd-rail-light', theme.light);
    el.style.setProperty('--ssd-rail-text', theme.text);
    el.style.setProperty('--ssd-rail-muted', theme.muted);
    el.style.setProperty('--ssd-accent', theme.accent);
    el.style.setProperty('--ssd-accent-soft', theme.accentSoft);
    el.style.setProperty('--ssd-accent-soft-2', theme.accentSoft2);
    el.style.setProperty('--ssd-app-bg', theme.appBg);
    // Drop System Settings purple gradient so Sidebar keeps the light blue panel.
    if (el === document.body) {
      el.style.background = '';
      el.style.backgroundImage = '';
      el.style.backgroundColor = '';
    }
  }

  function clearThemeFromBody() {
    [
      '--ssd-rail',
      '--ssd-rail-active',
      '--ssd-rail-deep',
      '--ssd-rail-light',
      '--ssd-rail-text',
      '--ssd-rail-muted',
      '--ssd-accent',
      '--ssd-accent-soft',
      '--ssd-accent-soft-2',
      '--ssd-app-bg'
    ].forEach((name) => document.body.style.removeProperty(name));
  }

  function getPreferredTheme() {
    return buildTheme(readPreferredColor(), readPreferredTone());
  }

  function getActiveTheme() {
    return buildTheme(readActiveColor(), readActiveTone());
  }

  function toneLabel(tone) {
    const value = normalizeTone(tone);
    if (value <= 20) return 'Deep';
    if (value <= 40) return 'Darker';
    if (value <= 60) return 'Standard';
    if (value <= 80) return 'Softer';
    return 'Light';
  }

  function normalizeLang(value) {
    return String(value || '').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  }

  function readLang() {
    try {
      return normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY) || 'en');
    } catch {
      return 'en';
    }
  }

  function writeLang(lang) {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, normalizeLang(lang));
    } catch {
      /* ignore */
    }
  }

  function normalizeQuotes(value) {
    return String(value || '').replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  }

  function tr(label) {
    const text = normalizeQuotes(label);
    if (readLang() !== 'pt') return String(label || '');
    return MENU_PT[text] || MENU_PT[String(label || '')] || String(label || '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncLangSwitchButtons() {
    const lang = readLang();
    document.querySelectorAll('.ssd-lang-switch .ssd-lang-btn').forEach((btn) => {
      const active = (btn.getAttribute('data-lang') || '') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function refreshTranslatedNodes(root) {
    if (!root) return;
    root.querySelectorAll('[data-ssd-en]').forEach((el) => {
      const en = el.getAttribute('data-ssd-en') || '';
      if (!en) return;
      el.textContent = tr(en);
      el.setAttribute('data-ssd-en', en);
    });
  }

  function setLanguage(lang) {
    const next = normalizeLang(lang);
    writeLang(next);
    // Fast path: translate in place — do not rebuild the whole sidebar/mobile shell.
    syncLangSwitchButtons();
    applyLanguageToPage();
    refreshTranslatedNodes(document.getElementById('doubleYSidebar'));
    refreshTranslatedNodes(document.getElementById('doubleYMobileDrawer'));
    refreshTranslatedNodes(document.getElementById('doubleYMobileTop'));
    refreshTranslatedNodes(document.getElementById('ssdMobileAppChrome'));
    document.getElementById('doubleYSidebar')?.setAttribute('aria-label', tr('Main navigation'));
    document.querySelectorAll('.ssd-lang-switch').forEach((el) => {
      el.setAttribute('aria-label', tr('Language'));
    });
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-ssd-style="1"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.setAttribute('data-ssd-style', '1');
    document.head.appendChild(link);
  }

  function currentPageApp() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || '';
    return file.endsWith('.html') ? file : '';
  }

  /**
   * Only respect access-control hiding (inline display / hidden).
   * Do NOT use getComputedStyle — closed classic dropdowns/submenus are
   * display:none while closed, and sidebar mode also hides .header-actions.
   */
  function isAccessVisible(el) {
    if (!el || el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function extractIcon(el) {
    const iconEl = el && el.querySelector && el.querySelector('i');
    if (!iconEl) return 'fa-folder';
    const icon = Array.from(iconEl.classList).find((c) => (
      c.startsWith('fa-')
      && c !== 'fas'
      && c !== 'far'
      && c !== 'fab'
      && c !== 'fa-solid'
      && c !== 'fa-chevron-down'
      && c !== 'fa-chevron-right'
      && c !== 'submenu-chevron'
    ));
    return icon || 'fa-folder';
  }

  function cleanLabel(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('i').forEach((node) => node.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function englishLabel(el) {
    if (!el) return '';
    if (el.hasAttribute('data-ssd-en')) {
      return normalizeQuotes(el.getAttribute('data-ssd-en')).trim();
    }
    const label = normalizeQuotes(cleanLabel(el)).trim();
    if (label) el.setAttribute('data-ssd-en', label);
    return label;
  }

  function hasComplexChildren(el) {
    if (!el || !el.querySelector) return false;
    return Boolean(el.querySelector(
      'input, select, textarea, button, a, div, table, form, ul, ol, img, .ssd-preview, .ssd-option-body, .ssd-theme-controls, .form-actions'
    ));
  }

  function setLabelPreserveIcons(el, text) {
    if (!el) return;
    const safe = escapeHtml(text);

    if (el.matches('[id$="MenuBtn"]')) {
      const icons = Array.from(el.querySelectorAll(':scope > i'));
      const lead = icons[0] ? icons[0].outerHTML : '';
      const trail = icons.length > 1 ? icons[icons.length - 1].outerHTML : '';
      el.innerHTML = `${lead} ${safe} ${trail}`.trim();
      return;
    }

    if (el.matches('.dropdown-submenu-trigger')) {
      const span = el.querySelector('span');
      const chevron = el.querySelector(':scope > .submenu-chevron, :scope > i.submenu-chevron, :scope > i.fa-chevron-right');
      if (span) {
        const icon = span.querySelector('i');
        span.innerHTML = `${icon ? `${icon.outerHTML} ` : ''}${safe}`;
      } else {
        const icon = el.querySelector(':scope > i:not(.submenu-chevron):not(.fa-chevron-right)');
        el.innerHTML = `${icon ? `${icon.outerHTML} ` : ''}${safe}${chevron ? ` ${chevron.outerHTML}` : ''}`;
      }
      return;
    }

    // Never wipe structured cards/forms (e.g. Setting Screen Display option labels).
    if (hasComplexChildren(el)) return;

    if (el.matches('a.dropdown-item, button.dropdown-item, .btn, button, a.btn, label, th, h2, h3, h4, p, strong, span, legend')) {
      const icon = el.querySelector(':scope > i');
      const restIcons = Array.from(el.querySelectorAll(':scope > i')).slice(1);
      el.innerHTML = `${icon ? `${icon.outerHTML} ` : ''}${safe}${restIcons.map((node) => ` ${node.outerHTML}`).join('')}`;
      return;
    }

    el.textContent = text;
  }

  function translateElementLabel(el) {
    if (!el || el.closest('#doubleYSidebar, #doubleYMobileBar, #doubleYMobileDrawer, .ssd-lang-switch')) return;
    if (el.matches('.ssd-option, .ssd-option-body, .ssd-theme-panel, .ssd-theme-controls, form, .form-actions')) return;
    if (hasComplexChildren(el) && !el.matches('[id$="MenuBtn"], .dropdown-submenu-trigger, a.dropdown-item, button.dropdown-item')) return;
    const en = englishLabel(el);
    if (!en) return;
    setLabelPreserveIcons(el, tr(en));
  }

  function translateHeaderMenuLabels() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    headerActions.querySelectorAll('[id$="MenuBtn"], a.dropdown-item, .dropdown-submenu-trigger, #exitSystemBtn').forEach((el) => {
      if (el.matches('.dropdown-submenu-trigger')) {
        const span = el.querySelector('span') || el;
        englishLabel(span);
        const en = span.getAttribute('data-ssd-en') || englishLabel(el);
        if (!el.hasAttribute('data-ssd-en')) el.setAttribute('data-ssd-en', en);
        setLabelPreserveIcons(el, tr(en));
        return;
      }
      translateElementLabel(el);
    });
  }

  function translateApplicationContent() {
    const roots = [
      document.querySelector('.header-content'),
      document.querySelector('.main-content'),
      document.querySelector('.system-settings-main'),
      document.querySelector('.container > main')
    ].filter(Boolean);

    const seen = new Set();
    roots.forEach((root) => {
      if (seen.has(root)) return;
      seen.add(root);

      root.querySelectorAll([
        '.header-search-users-label',
        '.header-page-title',
        'h2',
        'h3',
        'h4',
        'label:not(.ssd-option)',
        'th',
        'legend',
        'button.btn',
        'a.btn',
        'button[type="submit"]',
        '.ssd-option-body > strong',
        '.ssd-option-body > p',
        '.ssd-theme-panel > h3',
        '.ssd-theme-help',
        '.ssd-theme-field > span',
        '.ssd-tone-ends > span',
        '.system-settings-page-intro-text > h2',
        '.system-settings-page-intro-text > p',
        '.system-settings-help',
        '.ssd-message'
      ].join(',')).forEach((el) => {
        if (el.closest('.header-actions, .ssd-lang-switch, .ssd-preview, .logged-session-info, .bp-header-session, .ssd-option input')) return;
        if (el.matches('input, select, textarea, option, #ssdToneLabel, .ssd-option')) return;
        if (el.querySelector && el.querySelector('#ssdToneLabel, input, .ssd-preview, .ssd-option-body')) return;
        translateElementLabel(el);
      });
    });
  }

  function injectHeaderLangSwitch() {
    document.getElementById('ssdHeaderLangSwitch')?.remove();
    // Sidebar already has flags on the left (desktop) / mobile top bar — do not duplicate on the right.
    if (readActiveMode() === 'sidebar' || document.body.classList.contains('screen-display-sidebar')) {
      return;
    }
    const header = document.querySelector('.header');
    if (!header) return;
    if (window.getComputedStyle(header).position === 'static') {
      header.style.position = 'relative';
    }
    const wrap = buildLangSwitch();
    wrap.id = 'ssdHeaderLangSwitch';
    wrap.classList.add('ssd-lang-switch--header');
    header.appendChild(wrap);
  }

  function applyLanguageToPage() {
    document.documentElement.lang = readLang() === 'pt' ? 'pt-BR' : 'en';
    translateHeaderMenuLabels();
    translateApplicationContent();
    injectHeaderLangSwitch();
    window.dispatchEvent(new CustomEvent('doubley:languagechange', { detail: { lang: readLang() } }));
  }

  function resolveMenuItemHref(el) {
    if (!el) return '';
    const id = String(el.id || '').trim();
    if (id === 'newProductBtn') return 'warehouse.html?action=new';
    if (id === 'searchProductBtn') return 'warehouse.html?action=search';
    const href = el.getAttribute('href');
    if (href) return href;
    const app = el.getAttribute('data-app') || '';
    return app;
  }

  function linkFromAnchor(a) {
    if (!isAccessVisible(a)) return null;
    const app = a.getAttribute('data-app') || '';
    const href = resolveMenuItemHref(a);
    if (!href) return null;
    return {
      app: app || String(href).split('?')[0],
      href,
      label: englishLabel(a) || app || href,
      icon: extractIcon(a)
    };
  }

  /** Build sidebar tree from the classic header menu (same apps/groups as today). */
  function collectMenuTree() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return { sections: [], exitPresent: false };

    const sections = [];

    TOP_DROPDOWN_SELECTORS.forEach((selector) => {
      const dropdown = headerActions.querySelector(selector);
      if (!dropdown || !isAccessVisible(dropdown)) return;

      const menuBtn = dropdown.querySelector('[id$="MenuBtn"]');
      const menuPanel = dropdown.querySelector('[id$="DropdownMenu"]');
      if (!menuBtn || !menuPanel) return;

      const section = {
        id: menuBtn.id || selector,
        label: englishLabel(menuBtn) || 'Menu',
        icon: extractIcon(menuBtn),
        items: [],
        groups: []
      };

      Array.from(menuPanel.children).forEach((child) => {
        if (!isAccessVisible(child)) return;

        if (child.classList.contains('dropdown-item')) {
          const item = linkFromAnchor(child);
          if (item) section.items.push(item);
          return;
        }

        if (child.classList.contains('dropdown-submenu-group')) {
          const trigger = child.querySelector('.dropdown-submenu-trigger');
          const submenu = child.querySelector('.dropdown-submenu');
          if (!trigger || !submenu) return;
          const triggerLabelEl = trigger.querySelector('span') || trigger;
          const group = {
            label: englishLabel(triggerLabelEl) || englishLabel(trigger) || 'Group',
            icon: extractIcon(trigger),
            items: []
          };
          submenu.querySelectorAll('a.dropdown-item, button.dropdown-item').forEach((el) => {
            const item = linkFromAnchor(el);
            if (item) group.items.push(item);
          });
          if (group.items.length) section.groups.push(group);
        }
      });

      if (section.items.length || section.groups.length) {
        sections.push(section);
      }
    });

    const exitPresent = Boolean(headerActions.querySelector('#exitSystemBtn'));
    return { sections, exitPresent };
  }

  function sectionContainsPage(section, page) {
    if (!page) return false;
    if (section.items.some((item) => item.app === page || item.href === page)) return true;
    return section.groups.some((group) => group.items.some((item) => item.app === page || item.href === page));
  }

  function appendNavLink(container, item, page) {
    const a = document.createElement('a');
    a.href = item.href;
    a.className = (item.app === page || item.href === page) ? 'is-active' : '';
    a.innerHTML = `<i class="fas ${item.icon}" aria-hidden="true"></i><span data-ssd-en="${escapeHtml(item.label)}">${escapeHtml(tr(item.label))}</span>`;
    container.appendChild(a);
  }

  function buildLangSwitch() {
    const lang = readLang();
    const wrap = document.createElement('div');
    wrap.className = 'ssd-lang-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', tr('Language'));
    wrap.innerHTML = `
      <button type="button" class="ssd-lang-btn${lang === 'pt' ? ' is-active' : ''}" data-lang="pt" aria-label="Português" title="Português" aria-pressed="${lang === 'pt'}">
        ${FLAG_BR_SVG}
      </button>
      <button type="button" class="ssd-lang-btn${lang === 'en' ? ' is-active' : ''}" data-lang="en" aria-label="English" title="English" aria-pressed="${lang === 'en'}">
        ${FLAG_EN_SVG}
      </button>
    `;
    wrap.querySelectorAll('.ssd-lang-btn').forEach((btn) => {
      let touchHandled = false;
      const pick = () => setLanguage(btn.getAttribute('data-lang') || 'en');
      btn.addEventListener('pointerup', (event) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        event.preventDefault();
        event.stopPropagation();
        touchHandled = true;
        pick();
      });
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (touchHandled) {
          touchHandled = false;
          return;
        }
        pick();
      });
    });
    return wrap;
  }

  function buildSidebar(tree, page) {
    document.getElementById('doubleYSidebar')?.remove();

    const aside = document.createElement('aside');
    aside.id = 'doubleYSidebar';
    aside.setAttribute('aria-label', tr('Main navigation'));

    const brandRow = document.createElement('div');
    brandRow.className = 'ssd-brand-row';

    const brand = document.createElement('a');
    brand.className = 'ssd-brand';
    brand.href = 'warehouse-home.html';
    brand.setAttribute('aria-label', 'Double Y');
    brand.innerHTML = `<img src="DoubleYnew.png" alt="">`;

    const brandCopy = document.createElement('div');
    brandCopy.className = 'ssd-brand-copy';

    const brandText = document.createElement('a');
    brandText.className = 'ssd-brand-text';
    brandText.href = 'warehouse-home.html';
    brandText.innerHTML = `
      <span class="ssd-brand-line">Double-Y</span>
      <span class="ssd-brand-system">IT System</span>
    `;

    brandCopy.appendChild(brandText);
    brandCopy.appendChild(buildLangSwitch());
    brandRow.appendChild(brand);
    brandRow.appendChild(brandCopy);
    aside.appendChild(brandRow);

    const home = document.createElement('a');
    home.className = 'ssd-nav-link' + (page === 'warehouse-home.html' ? ' is-active' : '');
    home.href = 'warehouse-home.html';
    home.innerHTML = `<i class="fas fa-house" aria-hidden="true"></i><span data-ssd-en="Home">${escapeHtml(tr('Home'))}</span>`;

    const nav = document.createElement('nav');
    nav.className = 'ssd-nav';
    nav.appendChild(home);

    tree.sections.forEach((section) => {
      const wrap = document.createElement('div');
      wrap.className = 'ssd-nav-section' + (sectionContainsPage(section, page) ? ' is-open' : '');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ssd-nav-link ssd-nav-toggle';
      toggle.innerHTML = `<i class="fas ${section.icon}" aria-hidden="true"></i><span data-ssd-en="${escapeHtml(section.label)}">${escapeHtml(tr(section.label))}</span>`;
      toggle.addEventListener('click', () => {
        wrap.classList.toggle('is-open');
      });

      const sub = document.createElement('div');
      sub.className = 'ssd-nav-sub';

      section.items.forEach((item) => appendNavLink(sub, item, page));

      section.groups.forEach((group) => {
        const title = document.createElement('span');
        title.className = 'ssd-nav-section-title';
        title.setAttribute('data-ssd-en', group.label);
        title.textContent = tr(group.label);
        sub.appendChild(title);
        group.items.forEach((item) => appendNavLink(sub, item, page));
      });

      wrap.appendChild(toggle);
      wrap.appendChild(sub);
      nav.appendChild(wrap);
    });

    aside.appendChild(nav);

    if (tree.exitPresent) {
      const footer = document.createElement('div');
      footer.className = 'ssd-sidebar-footer';
      const exitBtn = document.createElement('button');
      exitBtn.type = 'button';
      exitBtn.className = 'ssd-nav-link ssd-nav-toggle';
      exitBtn.id = 'ssdSidebarExitBtn';
      exitBtn.innerHTML = `<i class="fas fa-right-from-bracket" aria-hidden="true"></i><span data-ssd-en="Exit">${escapeHtml(tr('Exit'))}</span>`;
      exitBtn.addEventListener('click', () => {
        document.getElementById('exitSystemBtn')?.click();
      });
      footer.appendChild(exitBtn);
      aside.appendChild(footer);
    }

    document.body.appendChild(aside);
  }

  function flattenTree(tree) {
    const tiles = [];
    const seen = new Set();
    function push(item) {
      const key = item.app || item.href;
      if (!key || seen.has(key)) return;
      seen.add(key);
      tiles.push(item);
    }
    tree.sections.forEach((section) => {
      section.items.forEach(push);
      section.groups.forEach((group) => group.items.forEach(push));
    });
    return tiles;
  }

  const SECTION_BLURBS = {
    Users: 'Manage people and access.',
    'Master Data': 'Products, bins and information.',
    'Augmented Reality': 'AR product search and visualization.',
    Applications: 'Integrated solutions.',
    Settings: 'System configuration.',
    Movement: 'Stock movements and tracking.',
    Picking: 'Picking and separation.',
    Church: 'Service orders and church tools.',
    Help: 'Guides and system help.'
  };

  function readSessionUser() {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem('doubley_menu_access') || 'null');
      return cached && cached.user ? cached.user : null;
    } catch {
      return null;
    }
  }

  function resolveUserRole(user) {
    const role = user?.cargo
      || user?.businessPartner?.role
      || user?.businessPartnerRole
      || user?.role
      || null;
    if (role && String(role).trim()) return String(role).trim();
    if (user?.isRoot) return 'System Administrator';
    return '';
  }

  function sectionItems(section) {
    const items = [...(section.items || [])];
    (section.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => items.push(item));
    });
    return items;
  }

  function syncNarrowViewportClass() {
    const narrow = window.matchMedia && window.matchMedia(NARROW_MQ).matches;
    document.body.classList.toggle('ssd-narrow', Boolean(narrow));
    return narrow;
  }

  function buildMobile(tree, page) {
    document.getElementById('doubleYMobileBar')?.remove();
    document.getElementById('doubleYMobileDrawer')?.remove();
    document.getElementById('doubleYMobileTop')?.remove();
    syncNarrowViewportClass();

    const user = readSessionUser();
    const userName = user?.nome || user?.email || 'User';
    const userRole = resolveUserRole(user);
    const companyName = user?.companyName || user?.businessPartner?.companyName || '';
    const photo = user?.photo && String(user.photo).trim() && user.photo !== 'null'
      ? user.photo
      : '';
    let companyLogo = user?.companyLogo || user?.businessPartner?.companyLogo || '';
    if (window.BrandImage?.companyLogoSrc) {
      companyLogo = window.BrandImage.companyLogoSrc(
        user?.companyId || user?.businessPartner?.companyId || null,
        companyLogo
      ) || companyLogo;
    }

    const top = document.createElement('header');
    top.id = 'doubleYMobileTop';
    top.className = 'ssd-mobile-top';
    top.innerHTML = `
      <button type="button" class="ssd-mobile-icon-btn" id="ssdMobileMenuBtn" aria-label="${escapeHtml(tr('Menu'))}">
        <i class="fas fa-bars" aria-hidden="true"></i>
      </button>
      <a class="ssd-mobile-logo" href="warehouse-home.html" aria-label="Double Y">
        <img src="DoubleYnew.png" alt="">
        <span class="ssd-brand-text">
          <span class="ssd-brand-line">Double-Y</span>
          <span class="ssd-brand-system">IT&nbsp;System</span>
        </span>
      </a>
      <div class="ssd-mobile-top-actions" id="ssdMobileTopActions">
        ${userRole ? `<span class="ssd-mobile-top-role" title="${escapeHtml(userRole)}">${escapeHtml(userRole)}</span>` : ''}
      </div>
    `;
    top.querySelector('#ssdMobileTopActions')?.appendChild(buildLangSwitch());
    document.body.appendChild(top);

    const drawer = document.createElement('div');
    drawer.id = 'doubleYMobileDrawer';
    drawer.hidden = page !== 'warehouse-home.html';
    drawer.innerHTML = `
      <div class="ssd-mobile-home" role="dialog" aria-label="${escapeHtml(tr('Menu'))}">
        <div class="ssd-mobile-home-scroll">
          <section class="ssd-welcome-card">
            <div class="ssd-welcome-photo" id="ssdWelcomePhoto"></div>
            <div class="ssd-welcome-copy">
              <span class="ssd-welcome-hello" data-ssd-en="Welcome back,">${escapeHtml(tr('Welcome back,'))}</span>
              <strong class="ssd-welcome-name">${escapeHtml(userName)}</strong>
              <span class="ssd-welcome-role" data-ssd-en="I can do all things through Christ who strengthens me. — Philippians 4:13">${escapeHtml(tr('I can do all things through Christ who strengthens me. — Philippians 4:13'))}</span>
            </div>
            <div class="ssd-welcome-company">
              <span data-ssd-en="Company">${escapeHtml(tr('Company'))}</span>
              <div class="ssd-welcome-company-brand" id="ssdWelcomeCompanyBrand"></div>
              <strong>${escapeHtml(companyName || '—')}</strong>
            </div>
          </section>

          <section class="ssd-mobile-module-head">
            <i class="fas fa-warehouse" aria-hidden="true"></i>
            <div>
              <h2 data-ssd-en="Double-Y Warehouse System">${escapeHtml(tr('Double-Y Warehouse System'))}</h2>
              <p data-ssd-en="Manage products, locations, movements and warehouse operations.">${escapeHtml(tr('Manage products, locations, movements and warehouse operations.'))}</p>
            </div>
          </section>

          <div class="ssd-module-grid" id="ssdModuleGrid"></div>

          ${tree.exitPresent ? `
            <button type="button" class="ssd-mobile-exit" id="ssdMobileExitBtn">
              <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
              <span data-ssd-en="Exit">${escapeHtml(tr('Exit'))}</span>
            </button>
          ` : ''}

          <footer class="ssd-mobile-foot">
            <span data-ssd-en="Double Y IT Systems">${escapeHtml(tr('Double Y IT Systems'))}</span>
            <span>v1.0.0</span>
          </footer>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);

    const photoEl = drawer.querySelector('#ssdWelcomePhoto');
    if (photoEl) {
      if (photo) {
        photoEl.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(userName)}">`;
        if (window.BrandImage?.bindPhotoZoom) {
          window.BrandImage.bindPhotoZoom(photoEl, {
            label: userName ? `Photo of ${userName}` : 'View photo larger'
          });
        } else {
          photoEl.style.cursor = 'zoom-in';
          photoEl.addEventListener('click', () => {
            window.BrandImage?.openPhotoZoom?.(photo, userName);
          });
        }
      } else {
        const initial = String(userName).trim().charAt(0).toUpperCase() || 'U';
        photoEl.textContent = initial;
      }
    }

    const companyBrandEl = drawer.querySelector('#ssdWelcomeCompanyBrand');
    if (companyBrandEl) {
      if (companyLogo) {
        companyBrandEl.innerHTML = `<img src="${escapeHtml(companyLogo)}" alt="">`;
      } else {
        companyBrandEl.hidden = true;
      }
    }

    const moduleGrid = drawer.querySelector('#ssdModuleGrid');

    function collapseAllModules(except) {
      moduleGrid?.querySelectorAll('.ssd-module-block.is-open').forEach((block) => {
        if (except && block === except) return;
        block.classList.remove('is-open');
        const toggle = block.querySelector('.ssd-module-card');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }

    function appendModuleAppLink(container, item) {
      const a = document.createElement('a');
      a.className = 'ssd-module-app-link';
      a.href = item.href;
      a.innerHTML = `<i class="fas ${item.icon}" aria-hidden="true"></i><span data-ssd-en="${escapeHtml(item.label)}">${escapeHtml(tr(item.label))}</span><i class="fas fa-chevron-right" aria-hidden="true"></i>`;
      container.appendChild(a);
    }

    (tree.sections || []).forEach((section, index) => {
      const items = sectionItems(section);
      if (!items.length) return;

      const blurb = SECTION_BLURBS[section.label] || 'Open module';
      const block = document.createElement('div');
      block.className = 'ssd-module-block';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ssd-module-card';
      btn.setAttribute('aria-expanded', 'false');
      if (items.length > 1) {
        btn.setAttribute('aria-controls', `ssdModuleOptions-${index}`);
      }
      btn.innerHTML = `
        <span class="ssd-module-icon"><i class="fas ${section.icon}" aria-hidden="true"></i></span>
        <span class="ssd-module-copy">
          <strong data-ssd-en="${escapeHtml(section.label)}">${escapeHtml(tr(section.label))}</strong>
          <small data-ssd-en="${escapeHtml(blurb)}">${escapeHtml(tr(blurb))}</small>
        </span>
        <i class="fas ${items.length > 1 ? 'fa-chevron-down' : 'fa-chevron-right'} ssd-module-chevron" aria-hidden="true"></i>
      `;

      btn.addEventListener('click', () => {
        if (items.length === 1) {
          window.location.href = items[0].href;
          return;
        }
        const willOpen = !block.classList.contains('is-open');
        collapseAllModules(block);
        block.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });

      block.appendChild(btn);

      if (items.length > 1) {
        const options = document.createElement('div');
        options.className = 'ssd-module-options';
        options.id = `ssdModuleOptions-${index}`;

        (section.items || []).forEach((item) => appendModuleAppLink(options, item));
        (section.groups || []).forEach((group) => {
          if (!(group.items || []).length) return;
          const title = document.createElement('span');
          title.className = 'ssd-module-group-title';
          title.setAttribute('data-ssd-en', group.label);
          title.textContent = tr(group.label);
          options.appendChild(title);
          group.items.forEach((item) => appendModuleAppLink(options, item));
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ssd-module-close';
        closeBtn.innerHTML = `<i class="fas fa-xmark" aria-hidden="true"></i><span data-ssd-en="Close">${escapeHtml(tr('Close'))}</span>`;
        closeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          block.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        });
        options.appendChild(closeBtn);

        block.appendChild(options);
      }

      moduleGrid?.appendChild(block);
    });

    function openDrawer() {
      drawer.hidden = false;
      document.body.classList.add('ssd-mobile-menu-open');
      collapseAllModules();
    }

    function closeDrawer() {
      if (page === 'warehouse-home.html') {
        collapseAllModules();
        return;
      }
      drawer.hidden = true;
      document.body.classList.remove('ssd-mobile-menu-open');
    }

    top.querySelector('#ssdMobileMenuBtn')?.addEventListener('click', () => {
      if (drawer.hidden) openDrawer();
      else closeDrawer();
    });

    drawer.querySelector('#ssdMobileExitBtn')?.addEventListener('click', () => {
      document.getElementById('exitSystemBtn')?.click();
    });

    if (page === 'warehouse-home.html') {
      document.body.classList.add('ssd-mobile-home-page');
      openDrawer();
    } else {
      document.body.classList.add('ssd-mobile-app-page');
      ensureMobileAppChrome();
    }
  }

  function ensureMobileAppChrome() {
    if (!document.body.classList.contains('ssd-narrow') && !(window.matchMedia && window.matchMedia(NARROW_MQ).matches)) {
      return;
    }
    document.getElementById('ssdMobileAppChrome')?.remove();

    const titleText = (
      document.querySelector('.header-content > h1')?.textContent
      || document.querySelector('.header-search-users-label')?.textContent
      || document.title
      || 'Application'
    ).replace(/\s+/g, ' ').trim();

    const chrome = document.createElement('section');
    chrome.id = 'ssdMobileAppChrome';
    chrome.className = 'ssd-mobile-app-chrome';
    chrome.innerHTML = `
      <div class="ssd-mobile-app-title">
        <i class="fas fa-window-maximize" aria-hidden="true"></i>
        <div>
          <strong>${escapeHtml(titleText)}</strong>
          <span data-ssd-en="Double-Y Warehouse System">${escapeHtml(tr('Double-Y Warehouse System'))}</span>
        </div>
      </div>
    `;

    const container = document.querySelector('.container');
    const main = document.querySelector('.main-content');
    if (container && main) {
      container.insertBefore(chrome, main);
    } else if (container) {
      container.appendChild(chrome);
    }
  }

  function clearSidebarUi() {
    document.getElementById('doubleYSidebar')?.remove();
    document.getElementById('doubleYMobileBar')?.remove();
    document.getElementById('doubleYMobileDrawer')?.remove();
    document.getElementById('doubleYMobileTop')?.remove();
    document.getElementById('ssdMobileAppChrome')?.remove();
    document.body.classList.remove(
      'screen-display-sidebar',
      'ssd-mobile-home-page',
      'ssd-mobile-app-page',
      'ssd-mobile-menu-open',
      'ssd-narrow'
    );
    clearThemeFromBody();
  }

  function clearBootHint() {
    document.documentElement.classList.remove('ssd-boot-sidebar', 'ssd-boot-narrow');
    document.getElementById('ssdBootStyle')?.remove();
  }

  function apply(options = {}) {
    const holdBoot = options.holdBoot === true || hasRevealHold();
    const revealNow = options.reveal === true;
    const forceRebuild = options.force === true;

    if (window.location.pathname.endsWith('/login.html') || window.location.pathname.endsWith('/index.html')) {
      clearSidebarUi();
      clearBootHint();
      document.getElementById('ssdHeaderLangSwitch')?.remove();
      return readActiveMode();
    }

    ensureStylesheet();
    const mode = readActiveMode();
    const theme = mode === 'sidebar' ? getActiveTheme() : null;
    // Include menu-access readiness so a later force rebuild can repaint allowed apps + user card.
    const menuReady = document.querySelector('.header-actions')?.getAttribute('data-menu-access-ready') === 'true';
    const themeKey = theme
      ? `${mode}|${theme.color}|${theme.tone}|${theme.accent}|menu:${menuReady ? '1' : '0'}`
      : `${mode}|classic|menu:${menuReady ? '1' : '0'}`;
    const page = currentPageApp();
    // Skip rebuild when login already painted the correct shell (avoids config flash).
    // force=true always rebuilds after menu-access filters apps / user profile.
    if (
      !forceRebuild
      && window.__doubleySsdAppliedKey === themeKey
      && (
        (mode === 'sidebar' && document.getElementById('doubleYSidebar'))
        || (mode !== 'sidebar' && !document.body.classList.contains('screen-display-sidebar'))
      )
    ) {
      if (revealNow || !holdBoot) {
        clearRevealHold();
        clearBootHint();
      }
      return mode;
    }

    // Keep the early boot cover while rebuilding so Classic never flashes.
    if (mode === 'sidebar') {
      document.documentElement.classList.add('ssd-boot-sidebar');
      if (isNarrowViewport()) document.documentElement.classList.add('ssd-boot-narrow');
    }

    clearSidebarUi();
    syncNarrowViewportClass();

    // Collect while classic header menu is still visible (before sidebar class hides it).
    // Until menu-access marks the header ready, keep an empty shell under the boot cover
    // so Church/other apps the user cannot open never paint into sidebar/mobile.
    const tree = mode === 'sidebar'
      ? (menuReady ? collectMenuTree() : { sections: [], exitPresent: true })
      : null;

    if (mode === 'sidebar') {
      document.body.classList.add('screen-display-sidebar');
      applyThemeToElement(document.body, theme);
      buildSidebar(tree, page);
      buildMobile(tree, page);
    } else if (revealNow || !holdBoot) {
      clearRevealHold();
      clearBootHint();
    }

    applyLanguageToPage();
    window.__doubleySsdAppliedKey = themeKey;
    if (mode === 'sidebar' && (revealNow || !holdBoot)) {
      // Keep boot hide until sidebar/mobile shell is painted, then reveal.
      const reveal = () => {
        const ready = document.getElementById('doubleYSidebar')
          || document.getElementById('doubleYMobileTop')
          || document.body.classList.contains('screen-display-sidebar');
        if (!ready) {
          window.requestAnimationFrame(reveal);
          return;
        }
        window.requestAnimationFrame(() => {
          clearRevealHold();
          clearBootHint();
        });
      };
      window.requestAnimationFrame(reveal);
    }
    return mode;
  }

  if (!window.__doubleySsdNarrowBound && window.matchMedia) {
    const mq = window.matchMedia(NARROW_MQ);
    const onChange = () => {
      syncNarrowViewportClass();
      if (window.DoubleYScreenDisplay?.getActiveMode?.() === 'sidebar') {
        apply();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    window.__doubleySsdNarrowBound = true;
  }

  window.DoubleYScreenDisplay = {
    STORAGE_PREFERRED_KEY: PREFERRED_KEY,
    STORAGE_ACTIVE_KEY: ACTIVE_KEY,
    DEFAULT_COLOR,
    DEFAULT_TONE,
    getMode: readPreferredMode,
    getActiveMode: readActiveMode,
    setMode: writePreferredMode,
    getColor: readPreferredColor,
    setColor: writePreferredColor,
    getTone: readPreferredTone,
    setTone: writePreferredTone,
    getActiveColor: readActiveColor,
    getActiveTone: readActiveTone,
    getPreferredTheme,
    getActiveTheme,
    buildTheme,
    applyThemeToElement,
    toneLabel,
    getLang: readLang,
    setLang: setLanguage,
    activatePreferredForSession,
    hydrateFromServer,
    saveToServer,
    isNarrowViewport,
    clearBootHint,
    apply
  };
})();
