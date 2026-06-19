function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
    ['movementMenuBtn', 'movementDropdownMenu'],
    ['customerMenuBtn', 'customerDropdownMenu'],
    ['pickingMenuBtn', 'pickingDropdownMenu'],
    ['helpMenuBtn', 'helpDropdownMenu']
  ];
  const buttons = {};
  const menus = {};
  dropdowns.forEach(([btnId, menuId]) => {
    buttons[btnId] = document.getElementById(btnId);
    menus[menuId] = document.getElementById(menuId);
  });

  function closeAll() {
    Object.values(menus).forEach(el => { if (el) el.setAttribute('aria-hidden', 'true'); });
    Object.values(buttons).forEach(el => { if (el) el.setAttribute('aria-expanded', 'false'); });
  }

  Object.keys(buttons).forEach(btnId => {
    const btn = buttons[btnId];
    const menuId = btnId.replace('MenuBtn', 'DropdownMenu');
    const menu = menus[menuId];
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        const open = menu.getAttribute('aria-hidden') !== 'true';
        menu.setAttribute('aria-hidden', open ? 'true' : 'false');
        btn.setAttribute('aria-expanded', !open);
      });
    }
  });

  document.addEventListener('click', closeAll);

  const newProductBtn = document.getElementById('newProductBtn');
  const searchProductBtn = document.getElementById('searchProductBtn');
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
}

function setupQrCodeGenerator() {
  const input = document.getElementById('qrcodeTextInput');
  const btn = document.getElementById('generateQrcodeBtn');
  const saveBtn = document.getElementById('saveQrcodeBtn');
  const output = document.getElementById('qrcodeOutput');
  const errorEl = document.getElementById('qrcodeError');
  if (!input || !btn || !output) return;

  function setSaveEnabled(enabled) {
    if (saveBtn) saveBtn.disabled = !enabled;
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = msg ? 'block' : 'none';
    }
  }

  const saveModal = document.getElementById('qrcodeSaveModal');
  const saveFilenameInput = document.getElementById('qrcodeSaveFilename');
  const saveFormatSelect = document.getElementById('qrcodeSaveFormat');
  const saveDirLabel = document.getElementById('qrcodeSaveDirLabel');
  const browseDirBtn = document.getElementById('qrcodeBrowseDirBtn');
  const confirmSaveBtn = document.getElementById('confirmQrcodeSaveBtn');
  const cancelSaveBtn = document.getElementById('cancelQrcodeSaveBtn');
  const closeSaveModalBtn = document.getElementById('closeQrcodeSaveModal');
  let selectedDirHandle = null;

  function defaultBaseName() {
    const text = (input.value || '').trim();
    return text.replace(/[^\w\-]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'qrcode';
  }

  function getQrCanvas() {
    const container = document.getElementById('qrcodeContainer');
    if (!container) return null;
    const canvas = container.querySelector('canvas');
    if (canvas) return canvas;
    const img = container.querySelector('img');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 220;
    c.height = img.naturalHeight || img.height || 220;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c;
  }

  function getQrBlob(format) {
    const canvas = getQrCanvas();
    if (!canvas) return Promise.resolve(null);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mime, 0.92);
    });
  }

  function buildFileName(base, format) {
    const ext = format === 'jpg' ? '.jpg' : '.png';
    const stripped = (base || '').trim().replace(/\.(png|jpg|jpeg)$/i, '');
    const safe = stripped.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120);
    return (safe || 'qrcode') + ext;
  }

  function updateDirLabel() {
    if (!saveDirLabel) return;
    if (selectedDirHandle) {
      saveDirLabel.textContent = 'Folder: ' + selectedDirHandle.name;
      saveDirLabel.classList.add('is-set');
    } else {
      saveDirLabel.textContent = 'No folder selected';
      saveDirLabel.classList.remove('is-set');
    }
  }

  function openSaveModal() {
    showError('');
    if (!getQrCanvas()) {
      showError('Generate a QR code before saving.');
      return;
    }
    if (saveFilenameInput) saveFilenameInput.value = defaultBaseName();
    if (saveFormatSelect) saveFormatSelect.value = 'png';
    selectedDirHandle = null;
    updateDirLabel();
    if (saveModal) saveModal.style.display = 'block';
  }

  function closeSaveModal() {
    if (saveModal) saveModal.style.display = 'none';
  }

  async function browseDirectory() {
    showError('');
    if (!window.showDirectoryPicker) {
      showError('Folder selection is not supported in this browser. Use Chrome or Edge, or save via the system dialog.');
      return;
    }
    try {
      selectedDirHandle = await window.showDirectoryPicker();
      updateDirLabel();
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        console.error('Directory picker failed:', err);
        showError('Could not select folder.');
      }
    }
  }

  async function writeBlobToHandle(fileHandle, blob) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async function saveViaDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function confirmSave() {
    showError('');
    const format = saveFormatSelect ? saveFormatSelect.value : 'png';
    const fileName = buildFileName(saveFilenameInput ? saveFilenameInput.value : defaultBaseName(), format);
    const blob = await getQrBlob(format);
    if (!blob) {
      showError('Generate a QR code before saving.');
      return;
    }

    try {
      if (selectedDirHandle) {
        const fileHandle = await selectedDirHandle.getFileHandle(fileName, { create: true });
        await writeBlobToHandle(fileHandle, blob);
        closeSaveModal();
        return;
      }

      if (window.showSaveFilePicker) {
        const ext = format === 'jpg' ? '.jpg' : '.png';
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: format === 'jpg' ? 'JPEG image' : 'PNG image',
            accept: { [mime]: [ext] }
          }]
        });
        await writeBlobToHandle(fileHandle, blob);
        closeSaveModal();
        return;
      }

      await saveViaDownload(blob, fileName);
      closeSaveModal();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Save failed:', err);
      showError('Could not save file. Check folder permissions and try again.');
    }
  }

  function saveQrCode() {
    openSaveModal();
  }

  function generate() {
    const text = (input.value || '').trim();
    showError('');
    setSaveEnabled(false);
    if (!text) {
      showError('Please enter text to generate a QR code.');
      output.innerHTML = '<p class="qrcode-placeholder">Enter text and click Generate to create a QR code.</p>';
      return;
    }
    if (typeof QRCode === 'undefined') {
      showError('QR code library is not loaded. Refresh the page and try again.');
      return;
    }
    output.innerHTML = '<div id="qrcodeContainer" class="qrcode-container"></div>';
    const container = document.getElementById('qrcodeContainer');
    try {
      new QRCode(container, {
        text: text,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
      });
      setSaveEnabled(true);
    } catch (err) {
      console.error('QR code generation failed:', err);
      showError('Could not generate QR code. Try shorter text.');
      output.innerHTML = '<p class="qrcode-placeholder">Enter text and click Generate to create a QR code.</p>';
    }
  }

  btn.addEventListener('click', generate);
  if (saveBtn) saveBtn.addEventListener('click', saveQrCode);
  if (browseDirBtn) browseDirBtn.addEventListener('click', browseDirectory);
  if (confirmSaveBtn) confirmSaveBtn.addEventListener('click', confirmSave);
  if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', closeSaveModal);
  if (closeSaveModalBtn) closeSaveModalBtn.addEventListener('click', closeSaveModal);
  if (saveModal) {
    saveModal.addEventListener('click', (e) => {
      if (e.target === saveModal) closeSaveModal();
    });
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  setupQrCodeGenerator();
});
