(function (global) {
  const LOGO_SRC = 'AlphaeOmega.jpg';

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(value) {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function normalizeOrderData(data) {
    const source = data || {};
    const worshipSongs = Array.isArray(source.worshipSongs)
      ? source.worshipSongs.map((song) => String(song || '').trim()).filter(Boolean)
      : [];

    return {
      title: source.title || 'Ordem de Culto',
      serviceDate: source.serviceDate || '',
      churchName: source.churchName || '',
      dirigente: source.dirigente || '',
      openingAct: source.openingAct || 'Abrir o Culto e fazer a oração Inicial',
      worshipSongs,
      scriptureReader: source.scriptureReader || '',
      praiseLeader: source.praiseLeader || '',
      praiseStatus: source.praiseStatus || '',
      offeringsInstruction: source.offeringsInstruction || '',
      messageSpeaker: source.messageSpeaker || '',
      closingPrayerLeader: source.closingPrayerLeader || '',
      priestlyBlessingLeader: source.priestlyBlessingLeader || ''
    };
  }

  function renderPersonLine(label, person) {
    if (!person) {
      return `<li><span class="order-print-label">${escapeHtml(label)}</span></li>`;
    }
    return `<li><span class="order-print-label">${escapeHtml(label)}</span> <span class="order-print-person">${escapeHtml(person)}</span></li>`;
  }

  function renderPrintHtml(data) {
    const order = normalizeOrderData(data);
    const songsHtml = order.worshipSongs.length
      ? `<ol>${order.worshipSongs.map((song) => `<li>${escapeHtml(song)}</li>`).join('')}</ol>`
      : '<div class="order-print-note">—</div>';

    const praiseLine = order.praiseLeader
      ? `${escapeHtml(order.praiseLeader)}${order.praiseStatus ? ` ---- ${escapeHtml(order.praiseStatus)}` : ''}`
      : '—';

    const churchLine = order.churchName
      ? `<div class="order-print-date">${escapeHtml(order.churchName)}</div>`
      : '';

    const dateLine = order.serviceDate
      ? `<div class="order-print-date">${escapeHtml(formatDate(order.serviceDate))}</div>`
      : '';

    return `
      <div class="order-print-logo-wrap">
        <img src="${LOGO_SRC}" alt="Alpha e Omega" class="order-print-logo">
      </div>
      <div class="order-print-title">${escapeHtml(order.title)}</div>
      ${churchLine}
      ${dateLine}
      <ol class="order-print-list">
        ${renderPersonLine('Dirigente:', order.dirigente)}
        <li>${escapeHtml(order.openingAct)}</li>
        <li>
          <strong>Louvores no Laptop</strong>
          ${songsHtml}
        </li>
        ${renderPersonLine('Leitura da palavra:', order.scriptureReader)}
        <li><span class="order-print-label">Louvor</span> <span class="order-print-person">${praiseLine}</span></li>
        ${order.offeringsInstruction ? `<li>${escapeHtml(order.offeringsInstruction)}</li>` : ''}
        ${renderPersonLine('Mensagem:', order.messageSpeaker)}
        <li>
          <span class="order-print-label">Terminar o Culto Oração &amp; Anúncios finais</span>
          ${order.closingPrayerLeader ? `<span class="order-print-person">${escapeHtml(order.closingPrayerLeader)}</span>` : ''}
          ${order.closingPrayerLeader ? '<span class="order-print-note"> seguidamente</span>' : ''}
        </li>
        ${renderPersonLine('Benção Sacerdotal', order.priestlyBlessingLeader)}
      </ol>
    `;
  }

  function renderIntoElement(element, data) {
    if (!element) return;
    element.innerHTML = renderPrintHtml(data);
  }

  function printData(data) {
    const host = document.getElementById('orderPrintDocument');
    if (!host) return;
    renderIntoElement(host, data);
    window.print();
  }

  global.OrderOfServiceUtils = {
    LOGO_SRC,
    escapeHtml,
    formatDate,
    normalizeOrderData,
    renderPrintHtml,
    renderIntoElement,
    printData
  };
})(window);
