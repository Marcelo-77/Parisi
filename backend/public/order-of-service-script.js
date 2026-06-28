(function () {
  const API_BASE = '/api/church-service-orders';
  let currentOrderId = null;

  function getWorshipSongs() {
    return Array.from(document.querySelectorAll('.worship-song-input'))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function getRawFormData() {
    return {
      title: document.getElementById('serviceTitle')?.value.trim(),
      serviceDate: document.getElementById('serviceDate')?.value || '',
      churchName: document.getElementById('churchName')?.value.trim(),
      openingAct: document.getElementById('openingAct')?.value.trim(),
      worshipSongs: getWorshipSongs(),
      scriptureReader: document.getElementById('scriptureReader')?.value.trim(),
      scripturePosition: document.getElementById('scripturePosition')?.value || '4',
      praiseLeader: document.getElementById('praiseLeader')?.value.trim(),
      praiseStatus: document.getElementById('praiseStatus')?.value.trim(),
      offeringsInstruction: document.getElementById('offeringsInstruction')?.value.trim(),
      messageSpeaker: document.getElementById('messageSpeaker')?.value.trim(),
      closingPrayerLeader: document.getElementById('closingPrayerLeader')?.value.trim(),
      priestlyBlessingLeader: document.getElementById('priestlyBlessingLeader')?.value.trim(),
      announcementsPosition: document.getElementById('announcementsPosition')?.value || '8'
    };
  }

  function collectFormData() {
    return OrderOfServiceUtils.normalizeOrderData(getRawFormData());
  }

  function showMessage(text, type) {
    const el = document.getElementById('orderServiceMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `order-service-message show ${type || 'info'}`;
  }

  function clearMessage() {
    const el = document.getElementById('orderServiceMessage');
    if (!el) return;
    el.textContent = '';
    el.className = 'order-service-message';
  }

  function updatePreview() {
    OrderOfServiceUtils.renderIntoElement(
      document.getElementById('orderPrintDocument'),
      getRawFormData(),
      OrderOfServiceUtils.getPrintLanguage()
    );
  }

  function addWorshipSongRow(value) {
    const list = document.getElementById('worshipSongsList');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'worship-song-row';
    row.innerHTML = `
      <input type="text" class="worship-song-input" placeholder="Nome do louvor">
      <button type="button" class="btn btn-secondary btn-remove-song no-print" title="Remover louvor">
        <i class="fas fa-minus"></i>
      </button>
    `;
    const input = row.querySelector('.worship-song-input');
    if (input && value) input.value = value;
    list.appendChild(row);
    row.querySelector('.worship-song-input')?.addEventListener('input', updatePreview);
    row.querySelector('.btn-remove-song')?.addEventListener('click', () => {
      row.remove();
      updatePreview();
    });
    updatePreview();
  }

  function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    return id ? String(id).trim() : null;
  }

  function setSelectValue(selectEl, value, normalizeFn, fallback) {
    if (!selectEl) return;
    const normalized = normalizeFn(value != null && value !== '' ? value : fallback);
    selectEl.value = String(normalized);
    if (selectEl.value !== String(normalized)) {
      selectEl.value = String(fallback);
    }
  }

  function setFormData(data) {
    const order = OrderOfServiceUtils.normalizeOrderData(data);
    document.getElementById('serviceTitle').value = order.title;
    document.getElementById('serviceDate').value = OrderOfServiceUtils.formatDateOnly(order.serviceDate);
    document.getElementById('churchName').value = order.churchName;
    document.getElementById('openingAct').value = order.openingAct;
    document.getElementById('scriptureReader').value = order.scriptureReader;
    setSelectValue(
      document.getElementById('scripturePosition'),
      order.scripturePosition,
      OrderOfServiceUtils.normalizeScripturePosition,
      4
    );
    document.getElementById('praiseLeader').value = order.praiseLeader;
    document.getElementById('praiseStatus').value = order.praiseStatus;
    document.getElementById('offeringsInstruction').value = order.offeringsInstruction;
    document.getElementById('messageSpeaker').value = order.messageSpeaker;
    document.getElementById('closingPrayerLeader').value = order.closingPrayerLeader;
    document.getElementById('priestlyBlessingLeader').value = order.priestlyBlessingLeader;
    setSelectValue(
      document.getElementById('announcementsPosition'),
      order.announcementsPosition,
      OrderOfServiceUtils.normalizeAnnouncementsPosition,
      8
    );

    const list = document.getElementById('worshipSongsList');
    if (list) list.innerHTML = '';
    if (order.worshipSongs.length) {
      order.worshipSongs.forEach((song) => addWorshipSongRow(song));
    } else {
      addWorshipSongRow('');
    }
    updatePreview();
  }

  function resetForm() {
    currentOrderId = null;
    const form = document.getElementById('orderServiceForm');
    if (form) form.reset();

    const list = document.getElementById('worshipSongsList');
    if (list) list.innerHTML = '';

    [
      'Deus de Promessa',
      'Viver para mim é Cristo',
      'Rompendo em Fé'
    ].forEach((song) => addWorshipSongRow(song));

    const dateInput = document.getElementById('serviceDate');
    if (dateInput) dateInput.value = OrderOfServiceUtils.getLocalDateInputValue();

    clearMessage();
    updatePreview();
  }

  function formatSaveError(data) {
    if (Array.isArray(data.details) && data.details.length) {
      return data.details.map((item) => item.msg || item.message).filter(Boolean).join(' ');
    }
    return data.message || data.error || 'Unable to save order of service.';
  }

  async function saveOrder() {
    const urlOrderId = getOrderIdFromUrl();
    if (!currentOrderId && urlOrderId) {
      currentOrderId = urlOrderId;
    }

    const payload = collectFormData();
    const isUpdate = Boolean(currentOrderId);
    const url = isUpdate ? `${API_BASE}/${encodeURIComponent(currentOrderId)}` : API_BASE;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(formatSaveError(data));
      }

      currentOrderId = data.data?.id || currentOrderId;
      if (data.data) {
        setFormData(data.data);
      }
      updatePreview();
      showMessage(data.message || 'Order of service saved successfully.', 'success');
    } catch (error) {
      console.error('Save order error:', error);
      showMessage(error.message || 'Error saving order of service.', 'error');
    }
  }

  async function loadOrderFromQuery() {
    const id = getOrderIdFromUrl();
    if (!id) return false;

    currentOrderId = id;

    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.message || 'Unable to load saved order.');
      }
      currentOrderId = data.data.id;
      setFormData(data.data);
      showMessage('Ordem de culto carregada para edição.', 'info');
      return true;
    } catch (error) {
      console.error('Load order error:', error);
      showMessage(error.message || 'Error loading order.', 'error');
      return false;
    }
  }

  function printOrder() {
    updatePreview();
    const host = document.getElementById('orderPrintDocument');
    if (host) {
      host.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  async function initPage() {
    const form = document.getElementById('orderServiceForm');
    const addSongBtn = document.getElementById('addWorshipSongBtn');
    const saveBtn = document.getElementById('saveOrderBtn');
    const resetBtn = document.getElementById('resetOrderBtn');

    const urlOrderId = getOrderIdFromUrl();
    if (urlOrderId) {
      currentOrderId = urlOrderId;
      await loadOrderFromQuery();
    } else {
      resetForm();
    }

    if (form) {
      form.addEventListener('input', updatePreview);
      form.addEventListener('change', updatePreview);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        printOrder();
      });
    }

    if (addSongBtn) addSongBtn.addEventListener('click', () => addWorshipSongRow(''));
    if (saveBtn) saveBtn.addEventListener('click', saveOrder);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);

    OrderOfServiceUtils.initPrintLanguageSelector(updatePreview);

    OrderOfServiceUtils.initDownloadPreviewButton(
      'downloadOrderPreviewBtn',
      () => getRawFormData(),
      (filename) => showMessage(`Download iniciado: ${filename}`, 'success'),
      (error) => showMessage(error.message || 'Erro ao gerar download HTML.', 'error')
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
})();
