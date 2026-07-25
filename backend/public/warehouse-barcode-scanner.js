(function (global) {
  let barcodeScannerActive = false;
  let barcodeScannerStream = null;
  let barcodeScannerLoopId = null;
  let html5QrCodeInstance = null;
  let barcodeCameraPromptShown = false;
  let html5QrcodeLoader = null;
  let customDetectHandler = null;

  function isMobileDevice() {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches) {
      return true;
    }
    const touchPoints = Number(navigator.maxTouchPoints) || 0;
    if (touchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 1024) {
      return true;
    }
    return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  }

  function updateBarcodeScanButtonVisibility() {
    const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
    const searchByField = document.getElementById('searchByField');
    if (!scanBarcodeBtn) return;
    const show = isMobileDevice() && searchByField && searchByField.value === 'barcode';
    scanBarcodeBtn.style.display = show ? '' : 'none';
  }

  function maybeAskToUseBarcodeCamera() {
    if (!isMobileDevice() || barcodeCameraPromptShown) return;
    barcodeCameraPromptShown = true;
    const useCamera = window.confirm('Use the phone camera to scan the barcode?');
    if (useCamera) {
      openBarcodeScanner();
    }
  }

  function setBarcodeScannerStatus(message) {
    const el = document.getElementById('barcodeScannerStatus');
    if (el) el.textContent = message || '';
  }

  function loadHtml5QrcodeLibrary() {
    if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode);
    if (html5QrcodeLoader) return html5QrcodeLoader;

    html5QrcodeLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Html5Qrcode) resolve(window.Html5Qrcode);
        else reject(new Error('Barcode scanner library failed to load'));
      };
      script.onerror = () => reject(new Error('Unable to load barcode scanner library'));
      document.head.appendChild(script);
    });

    return html5QrcodeLoader;
  }

  async function openBarcodeScanner(options = {}) {
    const modal = document.getElementById('barcodeScannerModal');
    if (!modal) {
      alert('Camera scanner is not available on this page.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('This device does not support camera scanning.');
      return;
    }

    customDetectHandler = typeof options.onDetect === 'function' ? options.onDetect : null;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    barcodeScannerActive = true;
    setBarcodeScannerStatus(options.statusText || 'Starting camera...');

    try {
      if ('BarcodeDetector' in window) {
        await startNativeBarcodeScanner();
      } else {
        await startHtml5BarcodeScanner();
      }
    } catch (error) {
      console.error('Barcode scanner error:', error);
      customDetectHandler = null;
      setBarcodeScannerStatus('Unable to open camera. Check camera permission.');
      alert('Unable to open the camera. Please allow camera access and try again.');
      closeBarcodeScanner();
    }
  }

  async function startNativeBarcodeScanner() {
    const video = document.getElementById('barcodeScannerVideo');
    const html5Reader = document.getElementById('html5QrcodeReader');
    if (!video) throw new Error('Video element missing');

    if (html5Reader) html5Reader.style.display = 'none';
    video.style.display = 'block';

    barcodeScannerStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = barcodeScannerStream;
    await video.play();

    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'codabar', 'qr_code']
    });
    setBarcodeScannerStatus('Point the camera at the barcode...');

    const tick = async () => {
      if (!barcodeScannerActive) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const raw = String(codes[0].rawValue || '').trim();
            if (raw) {
              onBarcodeDetected(raw);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Barcode detect tick error:', err);
      }
      barcodeScannerLoopId = window.setTimeout(tick, 250);
    };
    tick();
  }

  async function startHtml5BarcodeScanner() {
    const video = document.getElementById('barcodeScannerVideo');
    const html5Reader = document.getElementById('html5QrcodeReader');
    if (!html5Reader) throw new Error('Scanner container missing');

    if (video) {
      video.style.display = 'none';
      video.srcObject = null;
    }
    html5Reader.style.display = 'block';
    html5Reader.innerHTML = '';

    const Html5Qrcode = await loadHtml5QrcodeLibrary();
    html5QrCodeInstance = new Html5Qrcode('html5QrcodeReader');
    setBarcodeScannerStatus('Point the camera at the barcode...');

    await html5QrCodeInstance.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 140 },
        aspectRatio: 1.777
      },
      (decodedText) => {
        const raw = String(decodedText || '').trim();
        if (raw) onBarcodeDetected(raw);
      },
      () => {}
    );
  }

  function onBarcodeDetected(rawValue) {
    if (!barcodeScannerActive) return;
    const value = String(rawValue || '').trim();
    if (!value) return;

    barcodeScannerActive = false;
    setBarcodeScannerStatus(`Code read: ${value}`);

    const handler = customDetectHandler;
    customDetectHandler = null;

    closeBarcodeScanner().finally(() => {
      if (typeof handler === 'function') {
        handler(value);
        return;
      }

      const searchByField = document.getElementById('searchByField');
      const searchInput = document.getElementById('searchInput');
      if (searchByField) searchByField.value = 'barcode';
      if (searchInput) {
        searchInput.value = value;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      updateBarcodeScanButtonVisibility();

      if (typeof global.handleSearchClick === 'function') {
        global.handleSearchClick();
      } else {
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) searchBtn.click();
      }
    });
  }

  async function closeBarcodeScanner() {
    barcodeScannerActive = false;
    customDetectHandler = null;

    if (barcodeScannerLoopId) {
      clearTimeout(barcodeScannerLoopId);
      barcodeScannerLoopId = null;
    }

    const video = document.getElementById('barcodeScannerVideo');
    if (video) {
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
      video.style.display = 'none';
    }

    if (barcodeScannerStream) {
      barcodeScannerStream.getTracks().forEach((track) => track.stop());
      barcodeScannerStream = null;
    }

    if (html5QrCodeInstance) {
      try {
        const state = html5QrCodeInstance.getState && html5QrCodeInstance.getState();
        if (state === 2 || state === 3) {
          await html5QrCodeInstance.stop();
        }
      } catch (_) {}
      try {
        await html5QrCodeInstance.clear();
      } catch (_) {}
      html5QrCodeInstance = null;
    }

    const html5Reader = document.getElementById('html5QrcodeReader');
    if (html5Reader) {
      html5Reader.innerHTML = '';
      html5Reader.style.display = 'none';
    }

    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    }
    setBarcodeScannerStatus('');
  }

  function setupWarehouseBarcodeScanner() {
    const searchByField = document.getElementById('searchByField');
    const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
    const closeBarcodeScannerModalBtn = document.getElementById('closeBarcodeScannerModal');
    const cancelBarcodeScannerBtn = document.getElementById('cancelBarcodeScannerBtn');
    const clearSearch = document.getElementById('clearSearch');

    if (searchByField) {
      searchByField.addEventListener('change', () => {
        updateBarcodeScanButtonVisibility();
        if (searchByField.value === 'barcode' && isMobileDevice()) {
          maybeAskToUseBarcodeCamera();
        }
      });
    }

    if (scanBarcodeBtn) {
      scanBarcodeBtn.addEventListener('click', () => openBarcodeScanner());
    }
    if (closeBarcodeScannerModalBtn) {
      closeBarcodeScannerModalBtn.addEventListener('click', closeBarcodeScanner);
    }
    if (cancelBarcodeScannerBtn) {
      cancelBarcodeScannerBtn.addEventListener('click', closeBarcodeScanner);
    }
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        setTimeout(updateBarcodeScanButtonVisibility, 0);
      });
    }

    window.addEventListener('click', (e) => {
      const barcodeScannerModal = document.getElementById('barcodeScannerModal');
      if (e.target === barcodeScannerModal) closeBarcodeScanner();
    });

    updateBarcodeScanButtonVisibility();
    window.addEventListener('resize', updateBarcodeScanButtonVisibility);
  }

  global.WarehouseBarcodeScanner = {
    setup: setupWarehouseBarcodeScanner,
    open: openBarcodeScanner,
    close: closeBarcodeScanner,
    isMobileDevice,
    updateButtonVisibility: updateBarcodeScanButtonVisibility
  };

  document.addEventListener('DOMContentLoaded', setupWarehouseBarcodeScanner);
})(window);
