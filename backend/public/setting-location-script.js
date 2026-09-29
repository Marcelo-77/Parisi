(function () {
  const API = '/api/location-code-settings';
  let saved = null;
  let dirty = false;
  let lastMigrateLog = null;
  let migrateHeartbeatTimer = null;

  async function reportMigrateFinish(payload) {
    try {
      await fetch(`${API}/migrate-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {})
      });
    } catch (_) {
      // Status page may still show last apply progress.
    }
  }

  function startMigrateHeartbeat() {
    stopMigrateHeartbeat();
    migrateHeartbeatTimer = setInterval(() => {
      fetch(`${API}/migrate-heartbeat`, {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {});
    }, 15000);
  }

  function stopMigrateHeartbeat() {
    if (migrateHeartbeatTimer) {
      clearInterval(migrateHeartbeatTimer);
      migrateHeartbeatTimer = null;
    }
  }

  const els = {
    status: document.getElementById('locationSettingsStatus'),
    dirtyBadge: document.getElementById('locationDirtyBadge'),
    activeScheme: document.getElementById('activeScheme'),
    levelOnlyUsesLPrefix: document.getElementById('levelOnlyUsesLPrefix'),
    withPositionOmitsL: document.getElementById('withPositionOmitsL'),
    separator: document.getElementById('separator'),
    allowLevelOnly: document.getElementById('allowLevelOnly'),
    allowPosition: document.getElementById('allowPosition'),
    bayPatternHint: document.getElementById('bayPatternHint'),
    levelZeroLocationLetter: document.getElementById('levelZeroLocationLetter'),
    minSublevel: document.getElementById('minSublevel'),
    maxSublevel: document.getElementById('maxSublevel'),
    minLevel: document.getElementById('minLevel'),
    maxLevel: document.getElementById('maxLevel'),
    minPosition: document.getElementById('minPosition'),
    maxPosition: document.getElementById('maxPosition'),
    previewA1L2: document.getElementById('previewA1L2'),
    previewA221: document.getElementById('previewA221'),
    previewA1L0: document.getElementById('previewA1L0'),
    previewA21X1: document.getElementById('previewA21X1'),
    previewA101: document.getElementById('previewA101'),
    tryStreet: document.getElementById('tryStreet'),
    tryBuilding: document.getElementById('tryBuilding'),
    tryBuildingX: document.getElementById('tryBuildingX'),
    tryBuildingXGroup: document.getElementById('tryBuildingXGroup'),
    tryLevel: document.getElementById('tryLevel'),
    tryZeroType: document.getElementById('tryZeroType'),
    tryZeroTypeGroup: document.getElementById('tryZeroTypeGroup'),
    trySublevel: document.getElementById('trySublevel'),
    trySublevelGroup: document.getElementById('trySublevelGroup'),
    tryBehind: document.getElementById('tryBehind'),
    tryBehindGroup: document.getElementById('tryBehindGroup'),
    tryPosition: document.getElementById('tryPosition'),
    tryPositionLabel: document.getElementById('tryPositionLabel'),
    tryResult: document.getElementById('tryResult')
  };

  function showStatus(message, type) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.remove('is-success', 'is-error');
    if (type === 'success') els.status.classList.add('is-success');
    if (type === 'error') els.status.classList.add('is-error');
  }

  function showSavedModal(message) {
    const modal = document.getElementById('locationSettingsSavedModal');
    const messageEl = document.getElementById('locationSettingsSavedMessage');
    if (messageEl && message) messageEl.textContent = message;
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('locationSettingsSavedOkBtn')?.focus();
  }

  function hideSavedModal() {
    const modal = document.getElementById('locationSettingsSavedModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function setupSavedModal() {
    document.getElementById('locationSettingsSavedOkBtn')?.addEventListener('click', hideSavedModal);
    document.getElementById('locationSettingsSavedModal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'locationSettingsSavedModal') hideSavedModal();
    });
  }

  function boolSelect(el, value) {
    if (el) el.value = value ? 'true' : 'false';
  }

  function readBool(el, fallback) {
    if (!el) return fallback;
    return String(el.value) === 'true';
  }

  function readInt(el, fallback) {
    const n = Number(el?.value);
    return Number.isInteger(n) ? n : fallback;
  }

  function readLetter(el, fallback) {
    const letter = String(el?.value || fallback || 'L').trim().toUpperCase();
    return /^[A-Z]$/.test(letter) ? letter : fallback || 'L';
  }

  function getFormSettings() {
    return {
      activeScheme: String(els.activeScheme?.value || 'classic'),
      levelOnlyUsesLPrefix: false,
      withPositionOmitsL: true,
      separator: String(els.separator?.value || '-').trim() || '-',
      allowLevelOnly: false,
      allowPosition: readBool(els.allowPosition, true),
      bayPatternHint: String(els.bayPatternHint?.value || '').trim() || 'A1, A2, B1...',
      levelZeroLocationLetter: readLetter(els.levelZeroLocationLetter, 'L'),
      minSublevel: readInt(els.minSublevel, 0),
      maxSublevel: readInt(els.maxSublevel, 99),
      minLevel: readInt(els.minLevel, 0),
      maxLevel: readInt(els.maxLevel, 99),
      minPosition: readInt(els.minPosition, 1),
      maxPosition: readInt(els.maxPosition, 99)
    };
  }

  function composeBayLevelPositionCode(parts, settings) {
    const street = String(parts.street || '').trim().toUpperCase();
    const building = String(parts.building ?? '').trim();
    const bayFromParts = String(parts.bay || '').trim().toUpperCase();
    const bay = bayFromParts || `${street}${building}`;
    const sep = String(settings.separator || '-');
    const letter = String(settings.levelZeroLocationLetter || 'L').toUpperCase();
    if (!bay || !/^[A-Z0-9]{1,10}$/.test(bay)) return '';
    const level = Number(parts.level);
    if (!Number.isInteger(level) || level < settings.minLevel || level > settings.maxLevel) return '';

    const hasPosition = parts.position !== '' && parts.position != null;
    const position = hasPosition ? Number(parts.position) : NaN;
    if (hasPosition) {
      if (!Number.isInteger(position) || position < settings.minPosition || position > settings.maxPosition) return '';
    }

    if (level === 0) {
      const zeroType = String(parts.zeroType || '').toLowerCase();
      const streetHint = street || bay.charAt(0);
      const behindRaw = String(parts.behind || '').trim().toUpperCase();
      const behind = behindRaw === 'B' && (streetHint === 'A' || streetHint === 'H') ? 'B' : '';
      if (zeroType === 'pallet') {
        if (!hasPosition) return '';
        return `${bay}${sep}0${sep}${position}`;
      }
      if (zeroType !== 'location') return '';
      const sublevel = Number(parts.sublevel);
      if (!Number.isInteger(sublevel) || sublevel < settings.minSublevel || sublevel > settings.maxSublevel) return '';
      const base = `${bay}${sep}${letter}${sublevel}`;
      const withPos = hasPosition ? `${base}${sep}${position}` : base;
      return `${withPos}${behind}`;
    }

    if (!hasPosition) {
      // Level > 0: Position is always required
      return '';
    }
    if (!settings.allowPosition) return '';
    return `${bay}${sep}${level}${sep}${position}`;
  }

  function syncSchemeRadios(scheme) {
    const value = scheme === 'bay_level_position' ? 'bay_level_position' : 'classic';
    if (els.activeScheme) els.activeScheme.value = value;
    const classicRadio = document.getElementById('schemeClassicRadio');
    const bayRadio = document.getElementById('schemeBayRadio');
    if (classicRadio) classicRadio.checked = value === 'classic';
    if (bayRadio) bayRadio.checked = value === 'bay_level_position';
    const panels = document.querySelector('.setting-location-two-col');
    if (panels) {
      panels.classList.toggle('is-scheme-classic', value === 'classic');
      panels.classList.toggle('is-scheme-bay', value === 'bay_level_position');
    }
  }

  function syncTryZeroUi() {
    const street = String(els.tryStreet?.value || '').trim().toUpperCase();
    const building = String(els.tryBuilding?.value ?? '').trim();
    const a21Special = street === 'A' && building === '21';
    const xRaw = String(els.tryBuildingX?.value || '').replace(/[^\d]/g, '');
    const buildingX = (() => {
      if (!xRaw) return '';
      const n = Number(xRaw);
      return Number.isInteger(n) && n >= 1 ? String(n) : '';
    })();
    const a21WithX = a21Special && buildingX !== '';

    if (els.tryBuildingXGroup) els.tryBuildingXGroup.hidden = !a21Special;
    if (!a21Special && els.tryBuildingX) els.tryBuildingX.value = '';
    else if (els.tryBuildingX && buildingX && els.tryBuildingX.value !== buildingX) {
      els.tryBuildingX.value = buildingX;
    }

    if (a21WithX && els.tryLevel) {
      els.tryLevel.value = '0';
      els.tryLevel.readOnly = true;
    } else if (els.tryLevel) {
      els.tryLevel.readOnly = false;
    }
    if (a21WithX && els.tryZeroType) els.tryZeroType.value = 'location';

    const level = a21WithX ? 0 : Number(els.tryLevel?.value);
    const isZero = Number.isInteger(level) && level === 0;
    const zeroType = a21WithX ? 'location' : String(els.tryZeroType?.value || 'location');
    // Behind not used on A21X (photo-search bins)
    const showBehind = isZero && !a21WithX && (street === 'A' || street === 'H') && zeroType === 'location';
    if (els.tryZeroTypeGroup) els.tryZeroTypeGroup.hidden = !isZero || a21WithX;
    if (els.trySublevelGroup) els.trySublevelGroup.hidden = !(isZero && zeroType === 'location');
    if (els.tryBehindGroup) {
      els.tryBehindGroup.hidden = !showBehind;
      if (!showBehind && els.tryBehind) els.tryBehind.value = '';
    }
    if (els.tryPositionLabel) {
      if (!isZero || zeroType === 'pallet') {
        els.tryPositionLabel.textContent = 'Position *';
      } else {
        els.tryPositionLabel.textContent = 'Position';
      }
    }
    if (els.tryPosition) {
      els.tryPosition.placeholder = (!isZero || zeroType === 'pallet') ? 'required' : 'optional';
      if (!isZero && String(els.tryPosition.value || '').trim() === '') {
        els.tryPosition.value = '1';
      }
    }
  }

  function applyData(data) {
    saved = { ...data };
    syncSchemeRadios(data.activeScheme || 'classic');
    if (els.separator) els.separator.value = data.separator || '-';
    boolSelect(els.allowLevelOnly, data.allowLevelOnly !== false);
    boolSelect(els.allowPosition, data.allowPosition !== false);
    if (els.bayPatternHint) els.bayPatternHint.value = data.bayPatternHint || 'A1, A2, B1...';
    if (els.levelZeroLocationLetter) els.levelZeroLocationLetter.value = data.levelZeroLocationLetter || 'L';
    if (els.minSublevel) els.minSublevel.value = data.minSublevel ?? 0;
    if (els.maxSublevel) els.maxSublevel.value = data.maxSublevel ?? 99;
    if (els.minLevel) els.minLevel.value = data.minLevel ?? 0;
    if (els.maxLevel) els.maxLevel.value = data.maxLevel ?? 99;
    if (els.minPosition) els.minPosition.value = data.minPosition ?? 1;
    if (els.maxPosition) els.maxPosition.value = data.maxPosition ?? 99;
    dirty = false;
    updateDirty();
    refreshPreviews();
  }

  function updateDirty() {
    dirty = !!saved && JSON.stringify(getFormSettings()) !== JSON.stringify(saved);
    if (els.dirtyBadge) els.dirtyBadge.hidden = !dirty;
  }

  function refreshPreviews() {
    const settings = getFormSettings();
    syncTryZeroUi();
    if (els.previewA1L2) els.previewA1L2.textContent = composeBayLevelPositionCode({ street: 'A', building: '1', level: 2, position: 1 }, settings) || '—';
    if (els.previewA221) els.previewA221.textContent = composeBayLevelPositionCode({ street: 'A', building: '2', level: 2, position: 1 }, settings) || '—';
    if (els.previewA1L0) {
      els.previewA1L0.textContent = composeBayLevelPositionCode({
        street: 'A', building: '1', level: 0, zeroType: 'location', sublevel: 0
      }, settings) || '—';
    }
    if (els.previewA21X1) {
      els.previewA21X1.textContent = composeBayLevelPositionCode({
        bay: 'A21X1', street: 'A', building: '21', level: 0, zeroType: 'location', sublevel: 0
      }, settings) || '—';
    }
    if (els.previewA101) {
      els.previewA101.textContent = composeBayLevelPositionCode({
        street: 'A', building: '1', level: 0, zeroType: 'pallet', position: 1
      }, settings) || '—';
    }
    if (els.tryResult) {
      const street = String(els.tryStreet?.value || '').trim().toUpperCase();
      const building = String(els.tryBuilding?.value ?? '').trim();
      const xRaw = String(els.tryBuildingX?.value || '').replace(/[^\d]/g, '');
      const buildingX = (() => {
        if (street !== 'A' || building !== '21' || !xRaw) return '';
        const n = Number(xRaw);
        return Number.isInteger(n) && n >= 1 ? String(n) : '';
      })();
      const a21WithX = buildingX !== '';
      const level = a21WithX ? 0 : Number(els.tryLevel?.value);
      const positionRaw = String(els.tryPosition?.value ?? '').trim();
      const parts = {
        street,
        building,
        bay: a21WithX ? `A21X${buildingX}` : '',
        level,
        position: positionRaw === '' ? '' : positionRaw
      };
      if (level === 0) {
        parts.zeroType = a21WithX ? 'location' : (els.tryZeroType?.value || 'location');
        parts.sublevel = els.trySublevel?.value ?? 0;
        parts.behind = a21WithX ? '' : (els.tryBehind?.value || '');
      }
      els.tryResult.textContent = composeBayLevelPositionCode(parts, settings) || '—';
    }
  }

  async function loadSettings() {
    showStatus('Loading…');
    try {
      const res = await fetch(API, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load location settings');
      applyData(data.data);
      showStatus('');
    } catch (error) {
      showStatus(error.message || 'Error loading settings.', 'error');
    }
  }

  async function persistSettings() {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(getFormSettings())
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Unable to save location settings');
    applyData(data.data);
    return data;
  }

  function showMigrateConfirmModal(message) {
    hideMigrateOverlay();
    const modal = document.getElementById('locationMigrateConfirmModal');
    const msg = document.getElementById('locationMigrateConfirmMessage');
    if (msg && message) msg.textContent = message;
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function hideMigrateConfirmModal() {
    const modal = document.getElementById('locationMigrateConfirmModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function askMigrateConfirm(message) {
    return new Promise((resolve) => {
      const yesBtn = document.getElementById('locationMigrateYesBtn');
      const noBtn = document.getElementById('locationMigrateNoBtn');
      if (!yesBtn || !noBtn) {
        resolve(false);
        return;
      }
      showMigrateConfirmModal(message);
      const onNo = () => {
        cleanup();
        hideMigrateConfirmModal();
        resolve(false);
      };
      const onYes = () => {
        cleanup();
        hideMigrateConfirmModal();
        // Show overlay immediately so the click never feels like a no-op.
        showMigrateOverlay('Updating history…', 'Starting migration…');
        resolve(true);
      };
      function cleanup() {
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
      }
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }

  function oppositeScheme(scheme) {
    return String(scheme || '') === 'bay_level_position' ? 'classic' : 'bay_level_position';
  }

  async function runMigrateWithConfirm(fromScheme, toScheme, settings, confirmMessage) {
    const confirmed = await askMigrateConfirm(
      confirmMessage
      || `Update existing history from ${fromScheme} to ${toScheme}? This renames locations, product locations and logs.`
    );
    if (!confirmed) {
      hideMigrateOverlay();
      return { ran: false };
    }
    try {
      await runHistoryMigration(fromScheme, toScheme, settings);
      return { ran: true };
    } catch (error) {
      const message = error.message || 'Unable to update history.';
      showMigrateOverlay('Migration failed', message);
      stopMigrateHeartbeat();
      await reportMigrateFinish({
        status: 'failed',
        summary: message,
        lastError: message,
        failed: 1
      });
      const logMeta = await persistAndDownloadErrorLog({
        fromScheme,
        toScheme,
        settings,
        summary: message,
        plannedCount: 0,
        updatedCount: 0,
        failedCount: 1,
        skippedCount: 0,
        problemCount: 1,
        problems: [{
          stage: 'fatal',
          id: null,
          from: '',
          to: '',
          reason: message
        }]
      });
      finishMigrateOverlay(false, 'Migration failed', message, [message], logMeta);
      return { ran: true, error: message };
    }
  }

  function clearMigrateErrors() {
    const box = document.getElementById('locationMigrateErrors');
    const list = document.getElementById('locationMigrateErrorsList');
    const logInfo = document.getElementById('locationMigrateLogInfo');
    const downloadBtn = document.getElementById('locationMigrateDownloadLogBtn');
    if (list) list.innerHTML = '';
    if (box) box.hidden = true;
    if (logInfo) {
      logInfo.hidden = true;
      logInfo.textContent = '';
    }
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
      downloadBtn.onclick = null;
    }
    lastMigrateLog = null;
  }

  function showMigrateErrors(errors, logMeta) {
    const box = document.getElementById('locationMigrateErrors');
    const list = document.getElementById('locationMigrateErrorsList');
    const logInfo = document.getElementById('locationMigrateLogInfo');
    const downloadBtn = document.getElementById('locationMigrateDownloadLogBtn');
    if (!box || !list) return;
    list.innerHTML = '';
    const items = Array.isArray(errors) ? errors.filter(Boolean) : [];
    if (!items.length && !logMeta) {
      box.hidden = true;
      if (logInfo) logInfo.hidden = true;
      if (downloadBtn) downloadBtn.style.display = 'none';
      return;
    }
    items.slice(0, 100).forEach((msg) => {
      const li = document.createElement('li');
      li.textContent = msg;
      list.appendChild(li);
    });
    if (items.length > 100) {
      const li = document.createElement('li');
      li.textContent = `…and ${items.length - 100} more (see error log file)`;
      list.appendChild(li);
    }
    if (logInfo) {
      if (logMeta?.fileName) {
        logInfo.hidden = false;
        logInfo.textContent = logMeta.serverSaved
          ? `Detailed error log saved on server: ${logMeta.relativePath || logMeta.fileName}`
          : `Detailed error log ready: ${logMeta.fileName}`;
      } else {
        logInfo.hidden = true;
        logInfo.textContent = '';
      }
    }
    if (downloadBtn) {
      if (logMeta?.content && logMeta?.fileName) {
        downloadBtn.style.display = 'inline-flex';
        downloadBtn.onclick = () => downloadTextFile(logMeta.fileName, logMeta.content);
      } else {
        downloadBtn.style.display = 'none';
        downloadBtn.onclick = null;
      }
    }
    box.hidden = false;
  }

  function downloadTextFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'location-history-migrate.log';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildProblemMessages(problems) {
    return (Array.isArray(problems) ? problems : []).map((p) => {
      const from = p.from || '?';
      const to = p.to ? ` → ${p.to}` : '';
      const reason = p.reason || p.message || 'Unknown error';
      return `${from}${to}: ${reason}`;
    });
  }

  async function persistAndDownloadErrorLog(report) {
    let logMeta = null;
    try {
      const res = await fetch(`${API}/migrate-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(report)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data) {
        logMeta = {
          fileName: data.data.fileName,
          relativePath: data.data.relativePath,
          content: data.data.content,
          serverSaved: true
        };
      }
    } catch (_) {
      // Fall back to client-only download below.
    }

    if (!logMeta) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `location-history-migrate-${stamp}.log`;
      const lines = [
        'Setting Location — History migration error log',
        `Generated at : ${new Date().toISOString()}`,
        `From scheme  : ${report.fromScheme || '-'}`,
        `To scheme    : ${report.toScheme || '-'}`,
        `Summary      : ${report.summary || '-'}`,
        `Planned      : ${report.plannedCount ?? '-'}`,
        `Updated      : ${report.updatedCount ?? '-'}`,
        `Failed apply : ${report.failedCount ?? '-'}`,
        `Skipped      : ${report.skippedCount ?? '-'}`,
        `Problem rows : ${report.problemCount ?? '-'}`,
        '--------------------------------------------------------------------------------'
      ];
      (report.problems || []).forEach((p, index) => {
        lines.push(
          `[${String(index + 1).padStart(4, '0')}] stage=${p.stage || 'unknown'} id=${p.id ?? '-'} from=${p.from || '-'} to=${p.to || '-'} reason=${p.reason || p.message || 'Unknown error'}`
        );
      });
      logMeta = {
        fileName,
        relativePath: fileName,
        content: lines.join('\n') + '\n',
        serverSaved: false
      };
    }

    lastMigrateLog = logMeta;
    downloadTextFile(logMeta.fileName, logMeta.content);
    return logMeta;
  }

  function showMigrateOverlay(title, detail) {
    const overlay = document.getElementById('locationMigrateOverlay');
    const card = document.getElementById('locationMigrateCard');
    const icon = document.getElementById('locationMigrateIcon');
    const okBtn = document.getElementById('locationMigrateOkBtn');
    const downloadBtn = document.getElementById('locationMigrateDownloadLogBtn');
    clearMigrateErrors();
    if (document.getElementById('locationMigrateTitle')) {
      document.getElementById('locationMigrateTitle').textContent = title || 'Updating history…';
    }
    if (document.getElementById('locationMigrateDetail')) {
      document.getElementById('locationMigrateDetail').textContent = detail || '';
    }
    if (card) {
      card.classList.remove('is-success', 'is-error');
      card.classList.add('is-processing');
    }
    if (icon) icon.className = 'fas fa-sync-alt fa-spin';
    if (okBtn) {
      okBtn.style.display = 'none';
    }
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }
    setMigrateProgress(0, 0);
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('setting-location-migrating');
  }

  function setMigrateProgress(current, total) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const fill = document.getElementById('locationMigrateBarFill');
    const progress = document.getElementById('locationMigrateProgress');
    if (fill) fill.style.width = `${pct}%`;
    if (progress) progress.textContent = total > 0 ? `${pct}% (${current} of ${total})` : `${pct}%`;
  }

  function finishMigrateOverlay(ok, title, detail, errors, logMeta) {
    const card = document.getElementById('locationMigrateCard');
    const icon = document.getElementById('locationMigrateIcon');
    const okBtn = document.getElementById('locationMigrateOkBtn');
    if (document.getElementById('locationMigrateTitle')) {
      document.getElementById('locationMigrateTitle').textContent = title;
    }
    if (document.getElementById('locationMigrateDetail')) {
      document.getElementById('locationMigrateDetail').textContent = detail;
    }
    if (card) {
      card.classList.remove('is-processing');
      card.classList.toggle('is-success', !!ok);
      card.classList.toggle('is-error', !ok);
    }
    if (icon) icon.className = ok ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';
    showMigrateErrors(errors, logMeta || lastMigrateLog);
    if (okBtn) {
      okBtn.style.display = 'inline-flex';
    }
  }

  function hideMigrateOverlay() {
    const overlay = document.getElementById('locationMigrateOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    clearMigrateErrors();
    document.body.classList.remove('setting-location-migrating');
  }

  async function runHistoryMigration(fromScheme, toScheme, settings) {
    showMigrateOverlay('Updating history…', 'Building migration plan…');
    startMigrateHeartbeat();
    try {
      const planRes = await fetch(`${API}/migrate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fromScheme, toScheme, settings })
      });
      const planData = await planRes.json();
      if (!planRes.ok || !planData.success) {
        throw new Error(planData.error || 'Unable to build migration plan');
      }

      const items = planData.data?.items || [];
      const skipped = Array.isArray(planData.data?.skipped)
        ? planData.data.skipped
        : (Array.isArray(planData.data?.skippedPreview) ? planData.data.skippedPreview : []);
      const skippedCount = Number(planData.data?.skippedCount || skipped.length || 0);
      const total = items.length;

      const problems = skipped
        .filter((s) => s && s.reason && !/already matches/i.test(String(s.reason)))
        .map((s) => ({
          stage: 'plan',
          id: s.id != null ? s.id : null,
          from: s.from || '',
          to: s.to || '',
          reason: s.reason
        }));

      if (total === 0) {
        setMigrateProgress(1, 1);
        const hasProblemSkips = problems.length > 0;
        const summary = hasProblemSkips
          ? `Settings saved. ${skippedCount} location(s) could not be migrated.`
          : (skippedCount
            ? `Settings saved. ${skippedCount} location(s) skipped (already matching).`
            : 'Settings saved. No location codes required renaming.');
        let logMeta = null;
        if (hasProblemSkips) {
          logMeta = await persistAndDownloadErrorLog({
            fromScheme,
            toScheme,
            settings,
            summary,
            plannedCount: 0,
            updatedCount: 0,
            failedCount: 0,
            skippedCount,
            problemCount: problems.length,
            problems
          });
        }
        await reportMigrateFinish({
          status: hasProblemSkips ? 'completed_with_errors' : 'completed',
          plannedTotal: 0,
          done: 0,
          failed: 0,
          skippedCount,
          summary
        });
        finishMigrateOverlay(
          !hasProblemSkips,
          hasProblemSkips ? 'Migration finished with issues' : 'No renames needed',
          summary,
          buildProblemMessages(problems),
          logMeta
        );
        return;
      }

      let done = 0;
      let failed = 0;
      const BATCH_SIZE = 50;
      setMigrateProgress(0, total);
      if (document.getElementById('locationMigrateDetail')) {
        document.getElementById('locationMigrateDetail').textContent =
          `Updating locations in batches of ${BATCH_SIZE}…`;
      }

      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const batch = items.slice(offset, offset + BATCH_SIZE);
        try {
          const applyRes = await fetch(`${API}/migrate-apply-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: batch })
          });
          const applyData = await applyRes.json().catch(() => ({}));
          if (!applyRes.ok || !applyData.success) {
            failed += batch.length;
            batch.forEach((item) => {
              problems.push({
                stage: 'apply',
                id: item.id != null ? item.id : null,
                from: item.from || '',
                to: item.to || '',
                reason: applyData.error || applyData.message || 'Batch update failed'
              });
            });
          } else {
            const batchDone = Number(applyData.data?.done || 0);
            const batchFailed = Number(applyData.data?.failed || 0);
            done += batchDone;
            failed += batchFailed;
            const failures = Array.isArray(applyData.data?.failures) ? applyData.data.failures : [];
            failures.forEach((f) => {
              problems.push({
                stage: 'apply',
                id: f.id != null ? f.id : null,
                from: f.from || '',
                to: f.to || '',
                reason: f.reason || 'Update failed'
              });
            });
          }
        } catch (err) {
          failed += batch.length;
          batch.forEach((item) => {
            problems.push({
              stage: 'apply',
              id: item.id != null ? item.id : null,
              from: item.from || '',
              to: item.to || '',
              reason: err.message || 'Network error'
            });
          });
        }
        setMigrateProgress(Math.min(total, done + failed), total);
        if (document.getElementById('locationMigrateDetail')) {
          document.getElementById('locationMigrateDetail').textContent =
            `Updated ${done} of ${total} (failed: ${failed})…`;
        }
      }

      const errorMessages = buildProblemMessages(problems);
      if (failed > 0 || problems.length > 0) {
        const summary = `Updated ${total - failed} of ${total}. Failed: ${failed}. Skipped: ${skippedCount}.`;
        const logMeta = await persistAndDownloadErrorLog({
          fromScheme,
          toScheme,
          settings,
          summary,
          plannedCount: total,
          updatedCount: total - failed,
          failedCount: failed,
          skippedCount,
          problemCount: problems.length,
          problems
        });
        await reportMigrateFinish({
          status: failed > 0 ? 'completed_with_errors' : 'completed',
          plannedTotal: total,
          done: total - failed,
          failed,
          skippedCount,
          summary
        });
        finishMigrateOverlay(
          failed === 0 && problems.every((p) => /already matching/i.test(String(p.reason || ''))),
          failed > 0 ? 'Migration finished with errors' : 'Migration finished with warnings',
          summary,
          errorMessages,
          logMeta
        );
      } else {
        const summary = `Updated ${total} location(s) (product locations + logs). Skipped: ${skippedCount}.`;
        await reportMigrateFinish({
          status: 'completed',
          plannedTotal: total,
          done: total,
          failed: 0,
          skippedCount,
          summary
        });
        finishMigrateOverlay(
          true,
          'History updated',
          summary,
          [],
          null
        );
      }
    } finally {
      stopMigrateHeartbeat();
    }
  }

  async function saveSettings() {
    const btn = document.getElementById('saveLocationSettingsBtn');
    if (btn) btn.disabled = true;
    showStatus('Saving…');
    const previousScheme = String(saved?.activeScheme || 'classic');
    const nextSettings = getFormSettings();
    const schemeChanged = previousScheme !== String(nextSettings.activeScheme || 'classic');

    try {
      if (!schemeChanged) {
        const data = await persistSettings();
        showStatus(data.message || 'Location settings saved.', 'success');
        showSavedModal(data.message || 'Location settings saved successfully.');
        return;
      }

      // Save settings first, then ask about history migration
      const data = await persistSettings();
      showStatus(data.message || 'Location settings saved.', 'success');
      const result = await runMigrateWithConfirm(
        previousScheme,
        nextSettings.activeScheme,
        nextSettings,
        'You changed the New Location scheme. Do you want to update existing history (locations, product locations and logs) to the new parameterization?'
      );
      if (!result.ran) {
        showSavedModal('Settings saved. Location history was not changed.');
      }
    } catch (error) {
      showStatus(error.message || 'Error saving settings.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function migrateHistoryNow() {
    const btn = document.getElementById('migrateHistoryBtn');
    if (btn) btn.disabled = true;
    try {
      // Persist current form settings first so compose uses what is on screen.
      const nextSettings = getFormSettings();
      await persistSettings();
      const toScheme = String(nextSettings.activeScheme || saved?.activeScheme || 'classic');
      const fromScheme = oppositeScheme(toScheme);
      showStatus('Starting history update…');
      await runMigrateWithConfirm(
        fromScheme,
        toScheme,
        nextSettings,
        `Update existing location history to the active scheme (${toScheme})? Codes still in ${fromScheme} format will be converted.`
      );
      showStatus('');
    } catch (error) {
      showStatus(error.message || 'Unable to start history update.', 'error');
      hideMigrateOverlay();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function remapSidePositionsNow() {
    const btn = document.getElementById('remapSidePosBtn');
    if (btn) btn.disabled = true;
    try {
      showStatus('Checking Side/Position remap…');
      const planRes = await fetch(`${API}/migrate-remap-side-plan`, {
        method: 'POST',
        credentials: 'include'
      });
      const planData = await planRes.json().catch(() => ({}));
      if (!planRes.ok || !planData.success) {
        throw new Error(planData.error || 'Unable to build Side/Position remap plan');
      }
      const plan = planData.data || {};
      const total = Number(plan.total || 0);
      const already = Number(plan.alreadyRemappedCount || 0);
      if (total <= 0) {
        const blockedMsg = plan.message || '';
        const msg = plan.scope === 'blocked_already_completed'
          ? blockedMsg
          : (already > 0
            ? `Already corrected. No pending L/M/R remap (${already} already marked as remapped). Safe to check again anytime.`
            : 'Nothing pending for L/M/R remap. If you already ran Fix once successfully, you are done — do not force another full remap.');
        showSavedModal(msg);
        showStatus(msg, 'success');
        return;
      }
      const preview = Array.isArray(plan.preview) ? plan.preview.slice(0, 8).join(', ') : '';
      const confirmed = await askMigrateConfirm(
        `Fix L/M/R positions on ${total} pending location(s)? Already remapped (skipped): ${already}. Mapping: 1→3, 2→1, 3→2. Safe to re-run — only pending rows are changed.${preview ? ` Examples: ${preview}` : ''}`
      );
      if (!confirmed) {
        hideMigrateOverlay();
        showStatus('');
        return;
      }
      showMigrateOverlay('Fixing L/M/R positions…', `Remapping ${total} pending location(s)…`);
      startMigrateHeartbeat();
      const applyRes = await fetch(`${API}/migrate-remap-side-apply`, {
        method: 'POST',
        credentials: 'include'
      });
      const applyData = await applyRes.json().catch(() => ({}));
      stopMigrateHeartbeat();
      if (!applyRes.ok || !applyData.success) {
        throw new Error(applyData.error || 'Unable to remap Side/Position codes');
      }
      const result = applyData.data || {};
      const summary = `Remapped ${result.done || 0} of ${result.total || total}. Failed: ${result.failed || 0}. Already remapped before: ${result.alreadyRemappedCount || already}.`;
      const failures = Array.isArray(result.failures) ? result.failures : [];
      const errorMessages = failures.map((f) => `${f.from || '?'} → ${f.to || '?'}: ${f.reason || 'failed'}`);
      finishMigrateOverlay(
        Number(result.failed || 0) === 0,
        Number(result.failed || 0) > 0 ? 'L/M/R remap finished with errors' : 'L/M/R positions fixed',
        summary,
        errorMessages,
        null
      );
      showStatus(summary, Number(result.failed || 0) > 0 ? 'error' : 'success');
    } catch (error) {
      stopMigrateHeartbeat();
      const message = error.message || 'Unable to remap Side/Position codes.';
      showMigrateOverlay('Remap failed', message);
      finishMigrateOverlay(false, 'Remap failed', message, [message], null);
      showStatus(message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function setupMigrateUi() {
    document.getElementById('locationMigrateOkBtn')?.addEventListener('click', hideMigrateOverlay);
    document.getElementById('locationMigrateConfirmModal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'locationMigrateConfirmModal') {
        // ignore backdrop dismiss while waiting for Yes/No — user must choose
      }
    });
  }

  function bindDirtyWatchers() {
    [
      els.activeScheme, els.separator,
      els.allowLevelOnly, els.allowPosition, els.bayPatternHint, els.levelZeroLocationLetter,
      els.minSublevel, els.maxSublevel,
      els.minLevel, els.maxLevel, els.minPosition, els.maxPosition
    ].forEach((el) => {
      el?.addEventListener('change', () => { updateDirty(); refreshPreviews(); });
      el?.addEventListener('input', () => { updateDirty(); refreshPreviews(); });
    });
    document.querySelectorAll('input[name="activeSchemeRadio"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        syncSchemeRadios(radio.value);
        updateDirty();
        refreshPreviews();
      });
    });
    [els.tryStreet, els.tryBuilding, els.tryBuildingX, els.tryLevel, els.tryZeroType, els.trySublevel, els.tryBehind, els.tryPosition].forEach((el) => {
      el?.addEventListener('input', refreshPreviews);
      el?.addEventListener('change', refreshPreviews);
    });
  }

  document.getElementById('saveLocationSettingsBtn')?.addEventListener('click', saveSettings);
  document.getElementById('migrateHistoryBtn')?.addEventListener('click', migrateHistoryNow);
  document.getElementById('remapSidePosBtn')?.addEventListener('click', remapSidePositionsNow);
  document.getElementById('cancelLocationSettingsBtn')?.addEventListener('click', () => {
    if (saved) applyData(saved);
    showStatus('Changes discarded.', 'success');
  });
  document.getElementById('closeLocationSettingsBtn')?.addEventListener('click', () => {
    window.location.href = 'warehouse.html';
  });

  bindDirtyWatchers();
  setupSavedModal();
  setupMigrateUi();
  loadSettings();
})();
