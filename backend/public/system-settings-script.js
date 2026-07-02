(function () {
  const API_BASE = '/api/system-settings';
  let persistedSettings = null;

  function showMessage(text, type) {
    const el = document.getElementById('systemSettingsMessage');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.className = 'system-settings-message';
      return;
    }
    el.textContent = text;
    el.className = `system-settings-message show ${type || 'info'}`;
  }

  function updatePreview(settings) {
    const preview = document.getElementById('backgroundPreview');
    if (!preview || !window.DoubleYSystemSettings) return;
    preview.style.background = window.DoubleYSystemSettings.buildBackgroundStyle(settings);
  }

  function readFormSettings() {
    const showHeaderStats = Boolean(document.getElementById('showHeaderStats')?.checked);
    const backgroundColor = document.getElementById('backgroundColor')?.value || '#667eea';
    const backgroundColorEnd = document.getElementById('backgroundColorEnd')?.value || '#764ba2';
    return window.DoubleYSystemSettings.normalizeSettings({
      showHeaderStats,
      backgroundColor,
      backgroundColorEnd
    });
  }

  function fillForm(settings) {
    const showHeaderStats = document.getElementById('showHeaderStats');
    const backgroundColor = document.getElementById('backgroundColor');
    const backgroundColorEnd = document.getElementById('backgroundColorEnd');

    if (showHeaderStats) showHeaderStats.checked = settings.showHeaderStats !== false;
    if (backgroundColor) backgroundColor.value = settings.backgroundColor;
    if (backgroundColorEnd) backgroundColorEnd.value = settings.backgroundColorEnd;
    updatePreview(settings);
  }

  function settingsEqual(a, b) {
    if (!a || !b) return false;
    return a.showHeaderStats === b.showHeaderStats
      && a.backgroundColor === b.backgroundColor
      && a.backgroundColorEnd === b.backgroundColorEnd;
  }

  function refreshDirtyState() {
    const saveBtn = document.getElementById('saveSystemSettingsBtn');
    const cancelBtn = document.getElementById('cancelSystemSettingsBtn');
    if (!persistedSettings) {
      if (saveBtn) saveBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      return;
    }

    const current = readFormSettings();
    const hasChanges = !settingsEqual(current, persistedSettings);
    if (saveBtn) saveBtn.disabled = !hasChanges;
    if (cancelBtn) cancelBtn.disabled = !hasChanges;
  }

  async function loadSettings() {
    try {
      const settings = await window.DoubleYSystemSettings.fetchSystemSettings();
      persistedSettings = settings;
      fillForm(settings);
      refreshDirtyState();
    } catch (error) {
      console.error('Load system settings error:', error);
      persistedSettings = window.DoubleYSystemSettings.readCachedSettings() || window.DoubleYSystemSettings.DEFAULT_SETTINGS;
      fillForm(persistedSettings);
      refreshDirtyState();
      showMessage(error.message || 'Unable to load settings.', 'error');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('saveSystemSettingsBtn');
    const payload = readFormSettings();

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
      const response = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to save settings.');
      }

      const saved = window.DoubleYSystemSettings.normalizeSettings(data.data || payload);
      persistedSettings = saved;
      fillForm(saved);
      window.DoubleYSystemSettings.applySystemSettings(saved);
      refreshDirtyState();
      showMessage('Settings saved successfully.', 'success');
    } catch (error) {
      console.error('Save system settings error:', error);
      showMessage(error.message || 'Error saving settings.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save settings';
      }
      refreshDirtyState();
    }
  }

  function cancelChanges() {
    if (!persistedSettings) return;
    fillForm(persistedSettings);
    window.DoubleYSystemSettings.applySystemSettings(persistedSettings);
    refreshDirtyState();
    showMessage('Changes canceled.', 'info');
  }

  function bindLivePreview() {
    ['showHeaderStats', 'backgroundColor', 'backgroundColorEnd'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const settings = readFormSettings();
        updatePreview(settings);
        window.DoubleYSystemSettings.applySystemSettings(settings);
        refreshDirtyState();
      });
      el.addEventListener('change', () => {
        const settings = readFormSettings();
        updatePreview(settings);
        window.DoubleYSystemSettings.applySystemSettings(settings);
        refreshDirtyState();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('systemSettingsForm')?.addEventListener('submit', saveSettings);
    document.getElementById('cancelSystemSettingsBtn')?.addEventListener('click', cancelChanges);
    bindLivePreview();
    loadSettings();
  });
})();
