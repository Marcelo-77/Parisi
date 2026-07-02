(function (global) {
  const STORAGE_KEY = 'doubley_system_settings';
  const DEFAULT_SETTINGS = {
    showHeaderStats: true,
    backgroundColor: '#667eea',
    backgroundColorEnd: '#764ba2'
  };

  function normalizeSettings(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }
    return {
      showHeaderStats: raw.showHeaderStats !== false,
      backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(raw.backgroundColor || '')
        ? raw.backgroundColor
        : DEFAULT_SETTINGS.backgroundColor,
      backgroundColorEnd: /^#[0-9A-Fa-f]{6}$/.test(raw.backgroundColorEnd || '')
        ? raw.backgroundColorEnd
        : DEFAULT_SETTINGS.backgroundColorEnd
    };
  }

  function cacheSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }

  function readCachedSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeSettings(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function buildBackgroundStyle(settings) {
    const normalized = normalizeSettings(settings);
    return `linear-gradient(135deg, ${normalized.backgroundColor} 0%, ${normalized.backgroundColorEnd} 100%)`;
  }

  function applySystemSettings(settings) {
    const normalized = normalizeSettings(settings);
    cacheSettings(normalized);

    const root = document.documentElement;
    root.style.setProperty('--system-bg-start', normalized.backgroundColor);
    root.style.setProperty('--system-bg-end', normalized.backgroundColorEnd);
    document.body.style.background = buildBackgroundStyle(normalized);

    document.body.classList.toggle('header-stats-hidden', !normalized.showHeaderStats);
  }

  async function fetchSystemSettings() {
    const response = await fetch('/api/system-settings');
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error || 'Unable to load system settings');
    }
    return normalizeSettings(data.data);
  }

  async function loadAndApplySystemSettings() {
    const cached = readCachedSettings();
    if (cached) {
      applySystemSettings(cached);
    } else {
      applySystemSettings(DEFAULT_SETTINGS);
    }

    try {
      const remote = await fetchSystemSettings();
      applySystemSettings(remote);
    } catch (error) {
      console.warn('System settings fetch skipped:', error.message);
    }
  }

  global.DoubleYSystemSettings = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    normalizeSettings,
    applySystemSettings,
    loadAndApplySystemSettings,
    fetchSystemSettings,
    cacheSettings,
    readCachedSettings,
    buildBackgroundStyle
  };
})(window);
