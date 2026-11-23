(function () {
  const form = document.getElementById('screenDisplayForm');
  const messageEl = document.getElementById('screenDisplayMessage');
  const themePanel = document.getElementById('ssdThemePanel');
  const preview = document.getElementById('ssdSidebarPreview');
  const customColor = document.getElementById('ssdCustomColor');
  const toneRange = document.getElementById('ssdToneRange');
  const toneLabel = document.getElementById('ssdToneLabel');
  const swatchRow = document.getElementById('ssdSwatchRow');
  if (!form || !window.DoubleYScreenDisplay) return;

  let draftColor = window.DoubleYScreenDisplay.getColor();
  let draftTone = window.DoubleYScreenDisplay.getTone();

  function isPt() {
    return window.DoubleYScreenDisplay.getLang() === 'pt';
  }

  function msg(en, pt) {
    return isPt() ? pt : en;
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.setAttribute('data-ssd-en', text);
    messageEl.className = `ssd-message ssd-message--${type || 'info'}`;
  }

  function selectedMode() {
    const selected = form.querySelector('input[name="screenDisplayMode"]:checked');
    return selected ? selected.value : 'classic';
  }

  function syncThemePanelVisibility() {
    if (!themePanel) return;
    themePanel.hidden = selectedMode() !== 'sidebar';
  }

  function syncSwatches() {
    if (!swatchRow) return;
    const normalized = String(draftColor || '').toLowerCase();
    swatchRow.querySelectorAll('.ssd-swatch').forEach((btn) => {
      const color = String(btn.getAttribute('data-color') || '').toLowerCase();
      btn.classList.toggle('is-selected', color === normalized);
    });
  }

  function syncToneLabel() {
    if (!toneLabel) return;
    const en = window.DoubleYScreenDisplay.toneLabel(draftTone);
    toneLabel.setAttribute('data-ssd-en', en);
    const map = {
      Deep: 'Profundo',
      Darker: 'Mais escuro',
      Standard: 'Padrão',
      Softer: 'Mais suave',
      Light: 'Claro'
    };
    toneLabel.textContent = isPt() ? (map[en] || en) : en;
  }

  function syncPreview() {
    const theme = window.DoubleYScreenDisplay.buildTheme(draftColor, draftTone);
    if (preview) {
      window.DoubleYScreenDisplay.applyThemeToElement(preview, theme);
    }
    if (customColor) customColor.value = theme.color;
    if (toneRange) toneRange.value = String(theme.tone);
    syncSwatches();
    syncToneLabel();
  }

  function loadCurrent() {
    const preferred = window.DoubleYScreenDisplay.getMode();
    const active = window.DoubleYScreenDisplay.getActiveMode();
    const input = form.querySelector(`input[name="screenDisplayMode"][value="${preferred}"]`);
    if (input) input.checked = true;

    draftColor = window.DoubleYScreenDisplay.getColor();
    draftTone = window.DoubleYScreenDisplay.getTone();

    const note = document.getElementById('screenDisplaySessionNote');
    if (note) {
      const theme = window.DoubleYScreenDisplay.getActiveTheme();
      const activeLabel = active === 'sidebar'
        ? msg('Sidebar menu', 'Menu lateral')
        : msg('Classic menu', 'Menu clássico');
      const themeHint = active === 'sidebar'
        ? msg(
          ` Sidebar color this session: ${theme.rail} (${window.DoubleYScreenDisplay.toneLabel(theme.tone)}).`,
          ` Cor da sidebar nesta sessão: ${theme.rail}.`
        )
        : '';
      const text = msg(
        `Current session: ${activeLabel}.${themeHint} Settings are saved to your account and sync to phone/desktop.`,
        `Sessão atual: ${activeLabel}.${themeHint} As configurações são salvas na conta e sincronizam no celular/desktop.`
      );
      note.textContent = text;
      note.setAttribute('data-ssd-en', text);
    }

    syncThemePanelVisibility();
    syncPreview();
  }

  form.querySelectorAll('input[name="screenDisplayMode"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncThemePanelVisibility();
      syncPreview();
    });
  });

  swatchRow?.querySelectorAll('.ssd-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftColor = btn.getAttribute('data-color') || window.DoubleYScreenDisplay.DEFAULT_COLOR;
      syncPreview();
    });
  });

  customColor?.addEventListener('input', () => {
    draftColor = customColor.value;
    syncPreview();
  });

  toneRange?.addEventListener('input', () => {
    draftTone = Number(toneRange.value);
    syncPreview();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = selectedMode();
    window.DoubleYScreenDisplay.setMode(mode);
    window.DoubleYScreenDisplay.setColor(draftColor);
    window.DoubleYScreenDisplay.setTone(draftTone);

    const saveBtn = document.getElementById('saveScreenDisplayBtn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      await window.DoubleYScreenDisplay.saveToServer({
        mode,
        color: draftColor,
        tone: draftTone
      });
      window.DoubleYScreenDisplay.apply();
      showMessage(
        msg(
          'Display saved to your account. On phones, Sidebar opens the Model celular home right away.',
          'Exibição salva na sua conta. No celular, o Sidebar abre o Model celular na hora.'
        ),
        'success'
      );
      loadCurrent();
    } catch (error) {
      showMessage(
        msg(
          error.message || 'Could not save display settings.',
          error.message || 'Não foi possível salvar a exibição.'
        ),
        'info'
      );
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  window.addEventListener('doubley:languagechange', () => {
    loadCurrent();
  });

  loadCurrent();
})();
