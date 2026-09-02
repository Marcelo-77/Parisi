(function () {
  const API_A21X = '/api/location-product/a21x-products';
  const FINGERPRINT_SIZE = 16;

  const cameraImageInput = document.getElementById('cameraImageInput');
  const uploadImageInput = document.getElementById('uploadImageInput');
  const queryPreview = document.getElementById('queryPreview');
  const queryPlaceholder = document.getElementById('queryPlaceholder');
  const dropZone = document.getElementById('dropZone');
  const processingOverlay = document.getElementById('processingOverlay');
  const imageReadyBadge = document.getElementById('imageReadyBadge');
  const clearQueryBtn = document.getElementById('clearQueryBtn');
  const runPhotoSearchBtn = document.getElementById('runPhotoSearchBtn');
  const a21xLocationFilter = document.getElementById('a21xLocationFilter');
  const matchThresholdInput = document.getElementById('matchThreshold');
  const thresholdValueLabel = document.getElementById('thresholdValueLabel');
  const a21xStatus = document.getElementById('a21xStatus');
  const resultsGrid = document.getElementById('resultsGrid');
  const topMatchBanner = document.getElementById('topMatchBanner');
  const resultsCount = document.getElementById('resultsCount');
  const a21xLocationList = document.getElementById('a21xLocationList');
  const stepEls = Array.from(document.querySelectorAll('.a21x-step'));

  let catalog = [];
  let queryFingerprint = null;
  let queryObjectUrl = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(message, type) {
    if (!a21xStatus) return;
    const textEl = a21xStatus.querySelector('.a21x-status-text');
    const iconEl = a21xStatus.querySelector('.a21x-status-icon');
    if (textEl) {
      textEl.textContent = message;
    } else {
      a21xStatus.textContent = message;
    }
    a21xStatus.classList.remove('is-error', 'is-ok', 'is-idle');
    if (type === 'error') {
      a21xStatus.classList.add('is-error');
      if (iconEl) iconEl.className = 'fas fa-exclamation-triangle a21x-status-icon';
    } else if (type === 'ok') {
      a21xStatus.classList.add('is-ok');
      if (iconEl) iconEl.className = 'fas fa-check-circle a21x-status-icon';
    } else if (type === 'idle') {
      a21xStatus.classList.add('is-idle');
      if (iconEl) iconEl.className = 'fas fa-info-circle a21x-status-icon';
    } else {
      if (iconEl) iconEl.className = 'fas fa-circle-notch fa-spin a21x-status-icon';
    }
  }

  function setStep(activeStep) {
    stepEls.forEach((el) => {
      const step = Number(el.getAttribute('data-step'));
      el.classList.toggle('is-active', step === activeStep);
      el.classList.toggle('is-done', step < activeStep);
    });
  }

  function setProcessing(isProcessing) {
    if (processingOverlay) processingOverlay.hidden = !isProcessing;
  }

  function updateThresholdLabel() {
    const value = parseInt(matchThresholdInput?.value, 10) || 45;
    if (thresholdValueLabel) thresholdValueLabel.textContent = value + '%';
  }

  function revokeQueryUrl() {
    if (queryObjectUrl) {
      URL.revokeObjectURL(queryObjectUrl);
      queryObjectUrl = null;
    }
  }

  function clearQueryImage() {
    revokeQueryUrl();
    queryFingerprint = null;
    if (cameraImageInput) cameraImageInput.value = '';
    if (uploadImageInput) uploadImageInput.value = '';
    if (queryPreview) {
      queryPreview.hidden = true;
      queryPreview.removeAttribute('src');
    }
    if (queryPlaceholder) queryPlaceholder.hidden = false;
    if (imageReadyBadge) imageReadyBadge.hidden = true;
    dropZone?.classList.remove('has-image', 'is-dragover');
    if (runPhotoSearchBtn) runPhotoSearchBtn.disabled = true;
    setStep(1);
    setStatus('Image cleared. Take a photo or upload a file to continue.', 'idle');
  }

  function loadImageFromSrc(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load image'));
      img.src = src;
    });
  }

  async function buildFingerprint(src) {
    const img = await loadImageFromSrc(src);
    const canvas = document.createElement('canvas');
    canvas.width = FINGERPRINT_SIZE;
    canvas.height = FINGERPRINT_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(img, 0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const { data } = ctx.getImageData(0, 0, FINGERPRINT_SIZE, FINGERPRINT_SIZE);
    const values = new Float32Array(FINGERPRINT_SIZE * FINGERPRINT_SIZE);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      values[p] = gray;
      sum += gray;
    }
    const mean = sum / values.length;
    const bits = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i += 1) {
      bits[i] = values[i] >= mean ? 1 : 0;
    }
    return { bits, mean, values };
  }

  function similarityScore(a, b) {
    if (!a || !b || a.bits.length !== b.bits.length) return 0;
    let same = 0;
    let colorDiff = 0;
    for (let i = 0; i < a.bits.length; i += 1) {
      if (a.bits[i] === b.bits[i]) same += 1;
      colorDiff += Math.abs(a.values[i] - b.values[i]);
    }
    const hashScore = (same / a.bits.length) * 100;
    const avgDiff = colorDiff / a.bits.length;
    const toneScore = Math.max(0, 100 - (avgDiff / 255) * 100);
    return Math.round(hashScore * 0.7 + toneScore * 0.3);
  }

  async function onQueryFileSelected(file) {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    revokeQueryUrl();
    queryObjectUrl = URL.createObjectURL(file);
    if (queryPreview) {
      queryPreview.src = queryObjectUrl;
      queryPreview.hidden = false;
    }
    if (queryPlaceholder) queryPlaceholder.hidden = true;
    dropZone?.classList.add('has-image');
    if (imageReadyBadge) imageReadyBadge.hidden = true;
    if (runPhotoSearchBtn) runPhotoSearchBtn.disabled = true;

    setProcessing(true);
    setStatus('Processing image fingerprint…');
    setStep(1);
    try {
      queryFingerprint = await buildFingerprint(queryObjectUrl);
      if (runPhotoSearchBtn) runPhotoSearchBtn.disabled = false;
      if (imageReadyBadge) imageReadyBadge.hidden = false;
      setStatus('Image ready. Click Search by Photo.', 'ok');
      setStep(2);
    } catch (err) {
      queryFingerprint = null;
      setStatus('Failed to process image: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  function normalizeLocationFilter(raw) {
    const value = String(raw || '').trim().toUpperCase();
    if (!value) return 'A21X';
    if (!value.startsWith('A21X')) {
      throw new Error('Location filter must start with A21X');
    }
    return value;
  }

  async function loadCatalog() {
    let locationCode;
    try {
      locationCode = normalizeLocationFilter(a21xLocationFilter && a21xLocationFilter.value);
    } catch (err) {
      alert(err.message);
      return;
    }

    setStatus('Loading A21X catalog…');
    try {
      const params = new URLSearchParams({
        withPhotoOnly: 'true',
        locationCode
      });
      const res = await fetch(`${API_A21X}?${params}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load A21X catalog');
      }
      catalog = Array.isArray(data.data) ? data.data : [];
      await prepareCatalogFingerprints(catalog);
      updateLocationOptions(catalog);
      setStatus(
        `Catalog ready: ${catalog.length} A21X row(s) with photo` +
          (locationCode !== 'A21X' ? ` (filter ${locationCode})` : '') +
          '.',
        'ok'
      );
    } catch (err) {
      catalog = [];
      updateLocationOptions([]);
      setStatus('Catalog error: ' + (err.message || 'unknown'), 'error');
    }
  }

  async function prepareCatalogFingerprints(rows) {
    for (const row of rows) {
      if (!row.photo || row._fingerprint) continue;
      try {
        row._fingerprint = await buildFingerprint(row.photo);
      } catch {
        row._fingerprint = null;
      }
    }
  }

  function updateLocationOptions(rows) {
    const locations = new Set(rows.map((r) => r.locationCode).filter(Boolean));

    if (a21xLocationList) {
      a21xLocationList.innerHTML = Array.from(locations)
        .sort()
        .map((code) => `<option value="${escapeHtml(code)}"></option>`)
        .join('');
    }
  }

  async function runPhotoSearch() {
    if (!queryFingerprint) {
      alert('Choose a photo first.');
      return;
    }
    if (!catalog.length) {
      await loadCatalog();
    }
    if (!catalog.length) {
      alert('No A21X products with photos available to compare.');
      return;
    }

    const threshold = Math.max(20, Math.min(90, parseInt(matchThresholdInput?.value, 10) || 45));
    setStatus('Comparing photo against A21X catalog…');
    setStep(2);
    if (runPhotoSearchBtn) runPhotoSearchBtn.disabled = true;

    try {
      const scored = catalog
        .map((row) => {
          const score = row._fingerprint
            ? similarityScore(queryFingerprint, row._fingerprint)
            : 0;
          return { ...row, matchScore: score };
        })
        .filter((row) => row.matchScore >= threshold)
        .sort((a, b) => b.matchScore - a.matchScore || String(a.locationCode).localeCompare(String(b.locationCode)));

      renderResults(scored);
      setStep(3);
      setStatus(
        scored.length
          ? `Found ${scored.length} match(es) at or above ${threshold}%.`
          : `No matches at or above ${threshold}%. Try a lower threshold or another photo.`,
        scored.length ? 'ok' : 'error'
      );
    } catch (err) {
      setStatus('Search failed: ' + (err.message || 'unknown'), 'error');
    } finally {
      if (runPhotoSearchBtn) runPhotoSearchBtn.disabled = !queryFingerprint;
    }
  }

  function renderResults(rows) {
    if (resultsCount) {
      resultsCount.textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
    }

    if (topMatchBanner) {
      if (!rows.length) {
        topMatchBanner.hidden = true;
        topMatchBanner.innerHTML = '';
      } else {
        const top = rows[0];
        topMatchBanner.hidden = false;
        topMatchBanner.innerHTML = `
          ${top.photo ? `<img src="${escapeHtml(top.photo)}" alt="">` : ''}
          <div class="a21x-top-match-copy">
            <span class="label">Best match</span>
            <strong>${escapeHtml(top.productCode || '')} · ${top.matchScore}%</strong>
            <div class="a21x-meta">
              ${escapeHtml(top.productName || 'Unnamed product')}<br>
              Location ${escapeHtml(top.locationCode || '')} · Qty ${top.quantityCurrent ?? 0}
            </div>
          </div>`;
      }
    }

    if (!resultsGrid) return;
    if (!rows.length) {
      resultsGrid.innerHTML = `
        <div class="a21x-empty-block">
          <i class="fas fa-search"></i>
          <p>No matches for this photo in A21X locations.</p>
        </div>`;
      return;
    }

    resultsGrid.innerHTML = rows.map((row) => {
      const low = row.matchScore < 60;
      return `
        <article class="a21x-result-card">
          ${row.photo
            ? `<img src="${escapeHtml(row.photo)}" alt="">`
            : `<div class="a21x-empty-block" style="padding:40px 8px;"><i class="fas fa-image"></i></div>`}
          <div class="a21x-result-body">
            <div class="a21x-match-row">
              <strong>${escapeHtml(row.productCode || '')}</strong>
              <span class="a21x-match-score${low ? ' is-low' : ''}">${row.matchScore}%</span>
            </div>
            <div class="a21x-meta">${escapeHtml(row.productName || '')}</div>
            <div class="a21x-match-bar${low ? ' is-low' : ''}"><span style="width:${row.matchScore}%"></span></div>
            <div class="a21x-result-tags">
              <span class="a21x-tag"><i class="fas fa-map-marker-alt"></i>&nbsp;${escapeHtml(row.locationCode || '')}</span>
              <span class="a21x-tag">Qty ${row.quantityCurrent ?? 0}</span>
              <span class="a21x-tag">${escapeHtml(row.situationDescription || '—')}</span>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function bindFileInput(input) {
    input?.addEventListener('change', () => {
      const file = input.files && input.files[0];
      onQueryFileSelected(file);
    });
  }

  bindFileInput(cameraImageInput);
  bindFileInput(uploadImageInput);
  clearQueryBtn?.addEventListener('click', clearQueryImage);
  runPhotoSearchBtn?.addEventListener('click', runPhotoSearch);
  matchThresholdInput?.addEventListener('input', updateThresholdLabel);
  a21xLocationFilter?.addEventListener('change', () => {
    loadCatalog();
  });
  a21xLocationFilter?.addEventListener('input', () => {
    a21xLocationFilter.value = a21xLocationFilter.value.toUpperCase();
  });

  dropZone?.addEventListener('click', () => {
    uploadImageInput?.click();
  });
  dropZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      uploadImageInput?.click();
    }
  });
  ['dragenter', 'dragover'].forEach((type) => {
    dropZone?.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    dropZone?.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragover');
    });
  });
  dropZone?.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    onQueryFileSelected(file);
  });

  function focusPanelOnOpen() {
    const panel = document.getElementById('a21xSearchPanel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    requestAnimationFrame(() => {
      try {
        panel?.focus({ preventScroll: true });
      } catch {
        panel?.focus();
      }
      dropZone?.focus({ preventScroll: true });
    });
  }

  updateThresholdLabel();
  setStep(1);
  loadCatalog();
  focusPanelOnOpen();
})();
