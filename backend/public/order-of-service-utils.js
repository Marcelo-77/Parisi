(function (global) {
  const LOGO_SRC = 'AlphaeOmega.jpg';
  const PRINT_LANG_STORAGE_KEY = 'orderServicePrintLanguage';
  const SUPPORTED_LANGUAGES = ['pt', 'en', 'es'];

  const TRANSLATIONS = {
    pt: {
      defaultTitle: 'Ordem de Culto',
      defaultOpeningAct: 'Abrir o Culto e fazer a oração Inicial',
      dirigente: 'Dirigente:',
      worshipSongs: 'Louvores no Laptop',
      scriptureReading: 'Leitura da palavra:',
      praise: 'Louvor',
      message: 'Mensagem:',
      closing: 'Anúncios',
      closingFollowedBy: 'seguidamente',
      priestlyBlessing: 'Benção Sacerdotal',
      empty: '—',
      logoAlt: 'Alpha e Omega'
    },
    en: {
      defaultTitle: 'Order of Service',
      defaultOpeningAct: 'Open the service and offer the opening prayer',
      dirigente: 'Leader:',
      worshipSongs: 'Worship Songs on Laptop',
      scriptureReading: 'Scripture Reading:',
      praise: 'Praise',
      message: 'Message:',
      closing: 'Announcements',
      closingFollowedBy: 'followed by',
      priestlyBlessing: 'Priestly Blessing',
      empty: '—',
      logoAlt: 'Alpha and Omega'
    },
    es: {
      defaultTitle: 'Orden de Culto',
      defaultOpeningAct: 'Abrir el culto y hacer la oración inicial',
      dirigente: 'Dirigente:',
      worshipSongs: 'Louvores en Laptop',
      scriptureReading: 'Lectura de la Palabra:',
      praise: 'Alabanza',
      message: 'Mensaje:',
      closing: 'Anuncios',
      closingFollowedBy: 'seguidamente',
      priestlyBlessing: 'Bendición Sacerdotal',
      empty: '—',
      logoAlt: 'Alfa y Omega'
    }
  };

  const DEFAULT_SCRIPTURE_POSITION = 4;
  const DEFAULT_ANNOUNCEMENTS_POSITION = 8;
  const BASE_ORDER_ITEM_KEYS = ['dirigente', 'opening', 'worship', 'praise', 'offerings', 'message', 'priestly'];
  const MAX_ORDER_POSITION = BASE_ORDER_ITEM_KEYS.length + 2;

  const ORDER_POSITION_LABELS = {
    1: '1 — Primeiro item',
    2: '2 — Após Dirigente',
    3: '3 — Após Abertura',
    4: '4 — Após Louvores',
    5: '5 — Após Louvor',
    6: '6 — Após Ofertas e oração',
    7: '7 — Após Mensagem',
    8: '8 — Após Mensagem',
    9: '9 — Último item'
  };

  const SCRIPTURE_POSITION_LABELS = {
    ...ORDER_POSITION_LABELS,
    4: '4 — Após Louvores (padrão)'
  };

  const ANNOUNCEMENTS_POSITION_LABELS = {
    ...ORDER_POSITION_LABELS,
    8: '8 — Após Mensagem (padrão)'
  };

  // Tradução apenas dos campos 2 (abertura) e 6 (ofertas/oração)
  const FIELD_PHRASES = [
    { pt: 'Abrir o Culto e fazer a oração Inicial', en: 'Open the service and offer the opening prayer', es: 'Abrir el culto y hacer la oración inicial' },
    { pt: 'Abrir o Culto e fazer a oração inicial', en: 'Open the service and offer the opening prayer', es: 'Abrir el culto y hacer la oración inicial' },
    {
      pt: 'Ao término de Apolo. Convidar Antônio para reconhecer as ofertas e fazer a oração.',
      en: 'At the end of Apolo\'s praise, invite Antônio to receive the offerings and offer prayer.',
      es: 'Al término de Apolo, invitar a Antônio para recibir las ofrendas y hacer la oración.'
    },
    {
      pt: 'Ao término de Apolo, convidar Antônio para reconhecer as ofertas e fazer a oração.',
      en: 'At the end of Apolo\'s praise, invite Antônio to receive the offerings and offer prayer.',
      es: 'Al término de Apolo, invitar a Antônio para recibir las ofrendas y hacer la oración.'
    },
    { pt: 'Ao término de', en: 'At the end of', es: 'Al término de' },
    { pt: 'Convidar', en: 'Invite', es: 'Invitar' },
    { pt: 'para reconhecer as ofertas e fazer a oração', en: 'to receive the offerings and offer prayer', es: 'para recibir las ofrendas y hacer la oración' },
    { pt: 'para reconhecer as ofertas e fazer a oração.', en: 'to receive the offerings and offer prayer.', es: 'para recibir las ofrendas y hacer la oración.' }
  ];

  function normalizeOrderPosition(value, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(MAX_ORDER_POSITION, Math.max(1, parsed));
  }

  function normalizeScripturePosition(value) {
    return normalizeOrderPosition(value, DEFAULT_SCRIPTURE_POSITION);
  }

  function normalizeAnnouncementsPosition(value) {
    return normalizeOrderPosition(value, DEFAULT_ANNOUNCEMENTS_POSITION);
  }

  function positionToAnchor(position, defaultPosition) {
    const normalized = normalizeOrderPosition(position, defaultPosition);
    const anchorByPosition = {
      1: 'start',
      2: 'dirigente',
      3: 'opening',
      4: 'worship',
      5: 'praise',
      6: 'offerings',
      7: 'message',
      8: 'message',
      9: 'priestly'
    };
    return anchorByPosition[normalized] || anchorByPosition[defaultPosition] || 'worship';
  }

  function anchorIndex(anchor) {
    if (anchor === 'start') return -1;
    return BASE_ORDER_ITEM_KEYS.indexOf(anchor);
  }

  function insertAfterAnchor(keys, anchor, itemKey) {
    if (anchor === 'start') {
      keys.splice(0, 0, itemKey);
      return keys;
    }

    const index = keys.lastIndexOf(anchor);
    if (index === -1) {
      keys.push(itemKey);
      return keys;
    }

    keys.splice(index + 1, 0, itemKey);
    return keys;
  }

  function buildOrderedItemKeys(scripturePosition, announcementsPosition) {
    const scriptureAnchor = positionToAnchor(scripturePosition, DEFAULT_SCRIPTURE_POSITION);
    const announcementsAnchor = positionToAnchor(announcementsPosition, DEFAULT_ANNOUNCEMENTS_POSITION);

    let keys = [...BASE_ORDER_ITEM_KEYS];
    const toInsert = [
      { key: 'scripture', anchor: scriptureAnchor },
      { key: 'announcements', anchor: announcementsAnchor }
    ].sort((a, b) => {
      const diff = anchorIndex(a.anchor) - anchorIndex(b.anchor);
      if (diff !== 0) return diff;
      return a.key === 'scripture' ? -1 : 1;
    });

    toInsert.forEach((item) => {
      keys = insertAfterAnchor(keys, item.anchor, item.key);
    });

    return keys;
  }

  function normalizeLanguage(lang) {
    const value = String(lang || 'pt').toLowerCase();
    return SUPPORTED_LANGUAGES.includes(value) ? value : 'pt';
  }

  function getTranslations(lang) {
    return TRANSLATIONS[normalizeLanguage(lang)];
  }

  function normalizeTextKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  const phraseIndex = new Map();
  FIELD_PHRASES.forEach((entry) => {
    phraseIndex.set(normalizeTextKey(entry.pt), entry);
  });

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function translateFieldText(text, lang) {
    if (!text) return text;
    const target = normalizeLanguage(lang);
    if (target === 'pt') return text;

    const exact = phraseIndex.get(normalizeTextKey(text));
    if (exact && exact[target]) return exact[target];

    let output = text;
    const sortedPhrases = [...FIELD_PHRASES].sort((a, b) => b.pt.length - a.pt.length);
    sortedPhrases.forEach((entry) => {
      if (!entry[target] || entry.pt.length < 4) return;
      const regex = new RegExp(escapeRegExp(entry.pt).replace(/\s+/g, '\\s+'), 'gi');
      output = output.replace(regex, entry[target]);
    });

    return output;
  }

  function getPrintLanguage() {
    const selected = document.querySelector('input[name="printLanguage"]:checked');
    if (selected) return normalizeLanguage(selected.value);
    try {
      return normalizeLanguage(sessionStorage.getItem(PRINT_LANG_STORAGE_KEY));
    } catch (_error) {
      return 'pt';
    }
  }

  function setPrintLanguage(lang) {
    const value = normalizeLanguage(lang);
    try {
      sessionStorage.setItem(PRINT_LANG_STORAGE_KEY, value);
    } catch (_error) {
      // ignore storage errors
    }
    const input = document.querySelector(`input[name="printLanguage"][value="${value}"]`);
    if (input) input.checked = true;
    return value;
  }

  function initPrintLanguageSelector(onChange) {
    const saved = getPrintLanguage();
    setPrintLanguage(saved);
    document.querySelectorAll('input[name="printLanguage"]').forEach((input) => {
      input.addEventListener('change', () => {
        setPrintLanguage(input.value);
        if (typeof onChange === 'function') onChange(getPrintLanguage());
      });
    });
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(value, lang) {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    const locale = normalizeLanguage(lang) === 'en'
      ? 'en-US'
      : normalizeLanguage(lang) === 'es'
        ? 'es-ES'
        : 'pt-BR';

    return date.toLocaleDateString(locale, {
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
      title: source.title || TRANSLATIONS.pt.defaultTitle,
      serviceDate: source.serviceDate || '',
      churchName: source.churchName || '',
      dirigente: source.dirigente || '',
      openingAct: source.openingAct || TRANSLATIONS.pt.defaultOpeningAct,
      worshipSongs,
      scriptureReader: source.scriptureReader || '',
      praiseLeader: source.praiseLeader || '',
      praiseStatus: source.praiseStatus || '',
      offeringsInstruction: source.offeringsInstruction || '',
      messageSpeaker: source.messageSpeaker || '',
      closingPrayerLeader: source.closingPrayerLeader || '',
      priestlyBlessingLeader: source.priestlyBlessingLeader || '',
      scripturePosition: normalizeScripturePosition(source.scripturePosition),
      announcementsPosition: normalizeAnnouncementsPosition(source.announcementsPosition)
    };
  }

  function prepareOrderForPrint(data, lang) {
    const language = normalizeLanguage(lang);
    const order = normalizeOrderData(data);

    if (language === 'pt') return order;

    return {
      ...order,
      openingAct: translateFieldText(order.openingAct, language),
      offeringsInstruction: order.offeringsInstruction
        ? translateFieldText(order.offeringsInstruction, language)
        : ''
    };
  }

  function renderPersonLine(label, person) {
    if (!person) {
      return `<li><span class="order-print-label">${escapeHtml(label)}</span></li>`;
    }
    return `<li><span class="order-print-label">${escapeHtml(label)}</span> <span class="order-print-person">${escapeHtml(person)}</span></li>`;
  }

  function buildOrderListHtml(order, t, language) {
    const empty = t.empty;
    const songsHtml = order.worshipSongs.length
      ? `<ol>${order.worshipSongs.map((song) => `<li>${escapeHtml(song)}</li>`).join('')}</ol>`
      : `<div class="order-print-note">${escapeHtml(empty)}</div>`;

    const praiseLine = order.praiseLeader
      ? `${escapeHtml(order.praiseLeader)}${order.praiseStatus ? ` ---- ${escapeHtml(order.praiseStatus)}` : ''}`
      : escapeHtml(empty);

    const itemBuilders = {
      dirigente: () => renderPersonLine(t.dirigente, order.dirigente),
      opening: () => `<li>${escapeHtml(order.openingAct)}</li>`,
      worship: () => `<li><strong>${escapeHtml(t.worshipSongs)}</strong>${songsHtml}</li>`,
      scripture: () => renderPersonLine(t.scriptureReading, order.scriptureReader),
      praise: () => `<li><span class="order-print-label">${escapeHtml(t.praise)}</span> <span class="order-print-person">${praiseLine}</span></li>`,
      offerings: () => (order.offeringsInstruction ? `<li>${escapeHtml(order.offeringsInstruction)}</li>` : ''),
      message: () => renderPersonLine(t.message, order.messageSpeaker),
      announcements: () => `<li><span class="order-print-label">${escapeHtml(t.closing)}</span>${order.closingPrayerLeader ? ` <span class="order-print-person">${escapeHtml(order.closingPrayerLeader)}</span>` : ''}${order.closingPrayerLeader ? `<span class="order-print-note"> ${escapeHtml(t.closingFollowedBy)}</span>` : ''}</li>`,
      priestly: () => renderPersonLine(t.priestlyBlessing, order.priestlyBlessingLeader)
    };

    return buildOrderedItemKeys(order.scripturePosition, order.announcementsPosition)
      .map((key) => itemBuilders[key]?.() || '')
      .filter(Boolean)
      .join('');
  }

  function renderPrintHtml(data, lang) {
    const language = normalizeLanguage(lang);
    const t = getTranslations(language);
    const order = prepareOrderForPrint(data, language);

    const churchLine = order.churchName
      ? `<div class="order-print-date">${escapeHtml(order.churchName)}</div>`
      : '';

    const dateLine = order.serviceDate
      ? `<div class="order-print-date">${escapeHtml(formatDate(order.serviceDate, language))}</div>`
      : '';

    return `
      <div class="order-print-logo-wrap">
        <img src="${LOGO_SRC}" alt="${escapeHtml(t.logoAlt)}" class="order-print-logo">
      </div>
      <div class="order-print-title">${escapeHtml(order.title)}</div>
      ${churchLine}
      ${dateLine}
      <ol class="order-print-list">
        ${buildOrderListHtml(order, t, language)}
      </ol>
    `;
  }

  function renderIntoElement(element, data, lang) {
    if (!element) return;
    const language = lang || getPrintLanguage();
    element.innerHTML = renderPrintHtml(data, language);
    element.setAttribute('data-print-language', language);
  }

  function printData(data, lang) {
    const host = document.getElementById('orderPrintDocument');
    if (!host) return;
    const language = lang || getPrintLanguage();
    renderIntoElement(host, data, language);
    host.scrollIntoView({ behavior: 'instant', block: 'start' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  const STANDALONE_HTML_STYLES = `
    body { margin: 0; padding: 24px; background: #f5f5f5; font-family: Arial, Helvetica, sans-serif; }
    .order-print-document {
      background: #fff; border: 1px solid #e1e5e9; border-radius: 12px; padding: 32px 36px;
      color: #111; font-size: 18px; line-height: 1.6; max-width: 720px; margin: 0 auto;
    }
    .order-print-logo-wrap { text-align: center; margin-bottom: 18px; }
    .order-print-logo { max-width: 180px; max-height: 120px; width: auto; height: auto; object-fit: contain; }
    .order-print-title { text-align: center; font-size: 1.65rem; font-weight: 700; margin-bottom: 8px; }
    .order-print-date { text-align: center; font-size: 1.1rem; color: #555; margin-bottom: 24px; }
    .order-print-list { list-style: none; margin: 0; padding: 0; counter-reset: order-step; }
    .order-print-list > li { counter-increment: order-step; margin-bottom: 16px; padding-left: 2.2rem; position: relative; }
    .order-print-list > li::before { content: counter(order-step) "."; position: absolute; left: 0; font-weight: 700; }
    .order-print-list ol { margin: 8px 0 0; padding-left: 1.4rem; }
    .order-print-list ol li { margin-bottom: 8px; }
    .order-print-person { font-weight: 700; }
    .order-print-note { margin-top: 6px; font-size: 1.05rem; color: #333; }
    @media print {
      body { background: #fff; padding: 0; }
      .order-print-document { border: none; border-radius: 0; max-width: none; padding: 12mm 10mm; font-size: 20px; line-height: 1.65; }
      .order-print-title { font-size: 1.85rem; }
      .order-print-date { font-size: 1.2rem; }
    }
  `;

  let cachedLoggedUserName = null;

  function sanitizeFileNamePart(value) {
    return String(value == null ? '' : value)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'user';
  }

  function formatFileDateTime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function formatServiceDateForFile(serviceDate) {
    const raw = String(serviceDate || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : 'sem-data';
  }

  async function getLoggedUserDisplayName() {
    if (cachedLoggedUserName) return cachedLoggedUserName;

    try {
      const raw = sessionStorage.getItem('doubley_menu_access');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.user?.nome) {
          cachedLoggedUserName = data.user.nome;
          return cachedLoggedUserName;
        }
        if (data.user?.email) {
          cachedLoggedUserName = data.user.email;
          return cachedLoggedUserName;
        }
      }
    } catch (_error) {
      // ignore cache read errors
    }

    try {
      const response = await fetch('/api/auth/check');
      const data = await response.json().catch(() => ({}));
      if (data.authenticated && data.user) {
        cachedLoggedUserName = data.user.nome || data.user.email || 'user';
      } else {
        cachedLoggedUserName = 'user';
      }
    } catch (_error) {
      cachedLoggedUserName = 'user';
    }

    return cachedLoggedUserName;
  }

  async function buildDownloadFileName(serviceDate) {
    const userName = sanitizeFileNamePart(await getLoggedUserDisplayName());
    const cultoDate = formatServiceDateForFile(serviceDate);
    const printStamp = formatFileDateTime(new Date());
    return `${userName}_${cultoDate}_${printStamp}.html`;
  }

  async function resolveLogoDataUrl() {
    try {
      const response = await fetch(LOGO_SRC);
      if (!response.ok) return LOGO_SRC;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read logo image.'));
        reader.readAsDataURL(blob);
      });
    } catch (_error) {
      return LOGO_SRC;
    }
  }

  function buildStandaloneHtmlDocument(bodyContent, title) {
    const safeTitle = escapeHtml(title || 'Ordem de Culto');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>${STANDALONE_HTML_STYLES}</style>
</head>
<body>
  <div class="order-print-document">${bodyContent}</div>
</body>
</html>`;
  }

  function triggerHtmlDownload(html, filename) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPreviewHtml(data, lang) {
    const language = lang || getPrintLanguage();
    const order = prepareOrderForPrint(data, language);
    const logoDataUrl = await resolveLogoDataUrl();
    const previewHtml = renderPrintHtml(data, language).replace(
      `src="${LOGO_SRC}"`,
      `src="${logoDataUrl}"`
    );
    const documentHtml = buildStandaloneHtmlDocument(previewHtml, order.title);
    const filename = await buildDownloadFileName(order.serviceDate);
    triggerHtmlDownload(documentHtml, filename);
    return filename;
  }

  function initDownloadPreviewButton(buttonId, getData, onSuccess, onError) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const data = typeof getData === 'function' ? await getData() : getData;
        if (!data) {
          throw new Error('Nenhuma ordem disponível para download.');
        }

        const host = document.getElementById('orderPrintDocument');
        if (host) {
          renderIntoElement(host, data, getPrintLanguage());
        }

        const filename = await downloadPreviewHtml(data);
        if (typeof onSuccess === 'function') {
          onSuccess(filename);
        }
      } catch (error) {
        if (typeof onError === 'function') {
          onError(error);
        } else {
          console.error('Download preview error:', error);
          alert(error.message || 'Erro ao gerar download HTML.');
        }
      } finally {
        button.disabled = false;
      }
    });
  }

  global.OrderOfServiceUtils = {
    LOGO_SRC,
    PRINT_LANG_STORAGE_KEY,
    SUPPORTED_LANGUAGES,
    TRANSLATIONS,
    FIELD_PHRASES,
    ANNOUNCEMENTS_POSITION_LABELS,
    SCRIPTURE_POSITION_LABELS,
    ORDER_POSITION_LABELS,
    DEFAULT_SCRIPTURE_POSITION,
    DEFAULT_ANNOUNCEMENTS_POSITION,
    escapeHtml,
    formatDate,
    normalizeLanguage,
    normalizeScripturePosition,
    normalizeAnnouncementsPosition,
    buildOrderedItemKeys,
    getTranslations,
    getPrintLanguage,
    setPrintLanguage,
    initPrintLanguageSelector,
    normalizeOrderData,
    translateFieldText,
    prepareOrderForPrint,
    renderPrintHtml,
    renderIntoElement,
    printData,
    sanitizeFileNamePart,
    buildDownloadFileName,
    downloadPreviewHtml,
    initDownloadPreviewButton
  };
})(window);
