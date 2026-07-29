(function (global) {
  let barcodeScannerActive = false;
  let barcodeScannerStream = null;
  let barcodeScannerLoopId = null;
  let html5QrCodeInstance = null;
  let barcodeCameraPromptShown = false;
  let html5QrcodeLoader = null;
  let customDetectHandler = null;

  function isIosDevice() {
    const ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iOS 13+ desktop mode spoofs Macintosh
    return (/Macintosh/i.test(ua) || navigator.platform === 'MacIntel')
      && (Number(navigator.maxTouchPoints) || 0) > 1;
  }

  function isMobileDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      if (navigator.userAgentData.mobile) return true;
    }

    const ua = String(navigator.userAgent || navigator.vendor || '');
    const touchPoints = Number(navigator.maxTouchPoints) || 0;

    if (/iPhone|iPod/i.test(ua)) return true;
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
    if (/Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return true;

    const isTouchMac = (/Macintosh/i.test(ua) || navigator.platform === 'MacIntel') && touchPoints > 1;
    if (isTouchMac) {
      const shortest = Math.min(Number(screen.width) || 0, Number(screen.height) || 0);
      if (shortest > 0 && shortest <= 520) return true;
    }

    if (/Mobile/i.test(ua) && !/iPad|Tablet|Kindle|Silk/i.test(ua)) return true;

    const narrow = typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 768px)').matches;
    const coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;
    return !!(narrow && coarse && touchPoints > 0);
  }

  function canUseBarcodeScan() {
    const searchByField = document.getElementById('searchByField');
    return isMobileDevice() && !!searchByField && searchByField.value === 'barcode';
  }

  function updateBarcodeScanButtonVisibility() {
    const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
    if (!scanBarcodeBtn) return;
    const show = canUseBarcodeScan();
    scanBarcodeBtn.style.display = show ? 'inline-flex' : 'none';
    if (show) preloadHtml5QrcodeLibrary();
  }

  function maybeAskToUseBarcodeCamera() {
    if (!canUseBarcodeScan() || barcodeCameraPromptShown) return;
    barcodeCameraPromptShown = true;
    // Do NOT open the camera from confirm() — iOS loses the user-gesture
    // and then getUserMedia fails even when Settings permission is on.
    window.alert('Tap the Scan button to open the camera and read the barcode.');
  }

  function setBarcodeScannerStatus(message) {
    const el = document.getElementById('barcodeScannerStatus');
    if (el) el.textContent = message || '';
  }

  function cameraErrorMessage(error) {
    const name = error && error.name ? String(error.name) : '';
    const msg = error && error.message ? String(error.message) : '';
    if (!window.isSecureContext) {
      return 'Camera requires HTTPS. Open the site with https:// and try again.';
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission was blocked. In iPhone Settings → Safari (or Chrome) → Camera, allow access for this site, then tap Scan again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera is in use by another app. Close it and try again.';
    }
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return 'Could not start the rear camera. Trying again with default camera may help.';
    }
    return msg || name || 'Unable to open the camera.';
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-barcode-lib="${src}"]`);
      if (existing) {
        if (window.Html5Qrcode) {
          resolve(window.Html5Qrcode);
          return;
        }
        existing.addEventListener('load', () => {
          if (window.Html5Qrcode) resolve(window.Html5Qrcode);
          else reject(new Error('Barcode scanner library failed to load'));
        }, { once: true });
        existing.addEventListener('error', () => reject(new Error('Unable to load barcode scanner library')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.barcodeLib = src;
      script.onload = () => {
        if (window.Html5Qrcode) resolve(window.Html5Qrcode);
        else reject(new Error('Barcode scanner library failed to load'));
      };
      script.onerror = () => reject(new Error(`Unable to load barcode scanner library from ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadHtml5QrcodeLibrary() {
    if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode);
    if (html5QrcodeLoader) return html5QrcodeLoader;

    // Prefer local file (works with Helmet CSP). CDN was blocked on iPhone.
    const sources = [
      'html5-qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
    ];

    html5QrcodeLoader = (async () => {
      let lastError = null;
      for (let i = 0; i < sources.length; i += 1) {
        try {
          return await loadScriptOnce(sources[i]);
        } catch (error) {
          lastError = error;
          console.warn('html5-qrcode load failed:', sources[i], error);
        }
      }
      html5QrcodeLoader = null;
      throw lastError || new Error('Unable to load barcode scanner library');
    })();

    return html5QrcodeLoader;
  }

  function preloadHtml5QrcodeLibrary() {
    if (!isMobileDevice()) return;
    loadHtml5QrcodeLibrary().catch((error) => {
      console.warn('Barcode library preload failed:', error);
    });
  }

  async function getCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This device does not support camera scanning.');
    }

    const attempts = [
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      { audio: false, video: { facingMode: 'environment' } },
      { audio: false, video: true }
    ];

    let lastError = null;
    for (let i = 0; i < attempts.length; i += 1) {
      try {
        return await navigator.mediaDevices.getUserMedia(attempts[i]);
      } catch (error) {
        lastError = error;
        console.warn('getUserMedia attempt failed:', attempts[i], error);
      }
    }
    throw lastError || new Error('Unable to open camera');
  }

  async function isBarcodeDetectorUsable() {
    if (!('BarcodeDetector' in window) || typeof window.BarcodeDetector !== 'function') {
      return false;
    }
    try {
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        return Array.isArray(formats) && formats.length > 0;
      }
      // Older implementations may not expose getSupportedFormats
      return !isIosDevice();
    } catch (_) {
      return false;
    }
  }

  function prepareVideoElement(video) {
    if (!video) return;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
  }

  async function openBarcodeScanner(options = {}) {
    const modal = document.getElementById('barcodeScannerModal');
    if (!modal) {
      alert('Camera scanner is not available on this page.');
      return;
    }
    if (!options.force && document.getElementById('scanBarcodeBtn') && !canUseBarcodeScan()) {
      updateBarcodeScanButtonVisibility();
      return;
    }
    if (!window.isSecureContext) {
      alert('Camera requires HTTPS. Please open the site using https:// and try again.');
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
      // Request camera FIRST (still tied to the tap). Loading CDN before this
      // breaks iOS Safari/Chrome and causes NotAllowedError.
      barcodeScannerStream = await getCameraStream();

      const useNative = await isBarcodeDetectorUsable();
      if (useNative) {
        await startNativeBarcodeScanner(barcodeScannerStream);
      } else {
        await startHtml5BarcodeScanner(barcodeScannerStream);
      }
    } catch (error) {
      console.error('Barcode scanner error:', error);
      customDetectHandler = null;
      const friendly = cameraErrorMessage(error);
      setBarcodeScannerStatus(friendly);
      alert(friendly);
      closeBarcodeScanner();
    }
  }

  async function startNativeBarcodeScanner(stream) {
    const video = document.getElementById('barcodeScannerVideo');
    const html5Reader = document.getElementById('html5QrcodeReader');
    if (!video) throw new Error('Video element missing');

    if (html5Reader) html5Reader.style.display = 'none';
    prepareVideoElement(video);
    video.style.display = 'block';
    video.srcObject = stream;
    barcodeScannerStream = stream;

    try {
      await video.play();
    } catch (playError) {
      console.warn('video.play() warning:', playError);
    }

    const preferredFormats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'codabar', 'qr_code'];
    let detector;
    try {
      let formats = preferredFormats;
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        formats = preferredFormats.filter((f) => supported.indexOf(f) !== -1);
        if (!formats.length) formats = supported;
      }
      detector = new window.BarcodeDetector({ formats });
    } catch (detectorError) {
      console.warn('BarcodeDetector init failed, falling back:', detectorError);
      await startHtml5BarcodeScanner(stream);
      return;
    }

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

  async function startHtml5BarcodeScanner(existingStream) {
    const video = document.getElementById('barcodeScannerVideo');
    const html5Reader = document.getElementById('html5QrcodeReader');
    if (!html5Reader) throw new Error('Scanner container missing');

    // Load local library while camera permission is still warm.
    setBarcodeScannerStatus('Loading scanner...');
    const Html5Qrcode = await loadHtml5QrcodeLibrary();

    // Keep permission warm: stop our preview stream only right before html5-qrcode starts
    if (existingStream) {
      existingStream.getTracks().forEach((track) => track.stop());
      if (barcodeScannerStream === existingStream) barcodeScannerStream = null;
    }

    if (video) {
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
      video.style.display = 'none';
    }
    html5Reader.style.display = 'block';
    html5Reader.innerHTML = '';

    html5QrCodeInstance = new Html5Qrcode('html5QrcodeReader');
    setBarcodeScannerStatus('Point the camera at the barcode...');

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const width = Math.max(120, Math.floor(viewfinderWidth * 0.8));
        const height = Math.max(80, Math.floor(viewfinderHeight * 0.35));
        return { width, height };
      }
    };
    // aspectRatio often breaks html5-qrcode camera start on iOS
    if (!isIosDevice()) {
      config.aspectRatio = 1.777;
    }

    const cameraConfigs = [
      { facingMode: 'environment' },
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'user' }
    ];

    let started = false;
    let lastError = null;
    for (let i = 0; i < cameraConfigs.length; i += 1) {
      try {
        await html5QrCodeInstance.start(
          cameraConfigs[i],
          config,
          (decodedText) => {
            const raw = String(decodedText || '').trim();
            if (raw) onBarcodeDetected(raw);
          },
          () => {}
        );
        started = true;
        break;
      } catch (error) {
        lastError = error;
        console.warn('html5-qrcode start failed:', cameraConfigs[i], error);
        try {
          const state = html5QrCodeInstance.getState && html5QrCodeInstance.getState();
          if (state === 2 || state === 3) await html5QrCodeInstance.stop();
        } catch (_) {}
      }
    }

    if (!started) {
      throw lastError || new Error('Unable to start barcode scanner');
    }
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
      const onSearchByChange = () => {
        updateBarcodeScanButtonVisibility();
        if (canUseBarcodeScan()) {
          maybeAskToUseBarcodeCamera();
        }
      };
      searchByField.addEventListener('change', onSearchByChange);
      searchByField.addEventListener('input', onSearchByChange);
    }

    if (scanBarcodeBtn) {
      scanBarcodeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        if (!canUseBarcodeScan()) {
          updateBarcodeScanButtonVisibility();
          return;
        }
        openBarcodeScanner();
      });
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
    window.addEventListener('orientationchange', () => {
      setTimeout(updateBarcodeScanButtonVisibility, 100);
    });
  }

  global.WarehouseBarcodeScanner = {
    setup: setupWarehouseBarcodeScanner,
    open: openBarcodeScanner,
    close: closeBarcodeScanner,
    isMobileDevice,
    canUseBarcodeScan,
    updateButtonVisibility: updateBarcodeScanButtonVisibility
  };

  document.addEventListener('DOMContentLoaded', setupWarehouseBarcodeScanner);
})(window);
