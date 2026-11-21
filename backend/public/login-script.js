(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';
  const REMEMBER_EMAIL_KEY = 'doubley_login_remember_email';
  const SIGN_IN_LABEL = 'Sign In';
  const SIGNING_IN_LABEL = 'Signing in...';

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  const loginInfo = document.getElementById('loginInfo');
  const loginInfoText = document.getElementById('loginInfoText');
  const captchaPanel = document.getElementById('captchaPanel');
  const captchaQuestion = document.getElementById('captchaQuestion');
  const captchaAnswerInput = document.getElementById('captchaAnswer');
  const captchaIdInput = document.getElementById('captchaId');
  const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const rememberMe = document.getElementById('rememberMe');
  const loginYear = document.getElementById('loginYear');

  let captchaRequired = false;
  let forgotBusy = false;

  if (loginYear) {
    loginYear.textContent = String(new Date().getFullYear());
  }

  function hideError() {
    if (!loginError) return;
    loginError.hidden = true;
    loginError.style.display = 'none';
  }

  function hideInfo() {
    if (!loginInfo) return;
    loginInfo.hidden = true;
    loginInfo.style.display = 'none';
  }

  function showInfo(message) {
    hideError();
    if (!loginInfo || !loginInfoText) return;
    loginInfoText.textContent = message;
    loginInfo.hidden = false;
    loginInfo.style.display = 'flex';
  }

  function showError(message, focusTarget) {
    hideInfo();
    loginErrorText.textContent = message;
    loginError.hidden = false;
    loginError.style.display = 'flex';
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
      if (typeof focusTarget.select === 'function') {
        focusTarget.select();
      }
    }
  }

  function setSigningIn(isSigningIn) {
    loginBtn.disabled = isSigningIn;
    loginBtn.textContent = isSigningIn ? SIGNING_IN_LABEL : SIGN_IN_LABEL;
  }

  function hideCaptcha() {
    captchaRequired = false;
    if (captchaPanel) captchaPanel.hidden = true;
    if (captchaAnswerInput) {
      captchaAnswerInput.value = '';
      captchaAnswerInput.required = false;
    }
    if (captchaIdInput) captchaIdInput.value = '';
  }

  function showCaptcha(challenge) {
    captchaRequired = true;
    if (captchaPanel) captchaPanel.hidden = false;
    if (captchaAnswerInput) {
      captchaAnswerInput.required = true;
      captchaAnswerInput.value = '';
    }
    if (challenge) {
      if (captchaQuestion) captchaQuestion.textContent = challenge.question || 'Solve the challenge below.';
      if (captchaIdInput) captchaIdInput.value = challenge.captchaId || '';
    }
  }

  async function loadCaptcha() {
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showCaptcha(data);
        return true;
      }
    } catch {
      // ignore
    }
    showError('Unable to load verification challenge. Please try again.', captchaAnswerInput);
    return false;
  }

  function resolveErrorFocusTarget() {
    if (!emailInput.value.trim()) return emailInput;
    if (captchaRequired && captchaAnswerInput) return captchaAnswerInput;
    return passwordInput;
  }

  function restoreRememberedEmail() {
    try {
      const saved = String(localStorage.getItem(REMEMBER_EMAIL_KEY) || '').trim();
      if (!saved || !emailInput) return;
      emailInput.value = saved;
      if (rememberMe) rememberMe.checked = true;
    } catch {
      // ignore
    }
  }

  function persistRememberedEmail(email) {
    try {
      if (rememberMe && rememberMe.checked && email) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // ignore
    }
  }

  function getSafeNextUrl(apps, isRoot) {
    const raw = new URLSearchParams(window.location.search).get('next');
    if (!raw) return null;
    const next = String(raw).trim();
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return null;
    const pathPart = next.split('?')[0].split('#')[0];
    const fileName = pathPart.replace(/^\//, '');
    if (!/^[A-Za-z0-9._-]+\.html$/.test(fileName)) return null;
    if (!isRoot && Array.isArray(apps) && apps.length && !apps.includes(fileName)) {
      return null;
    }
    return next;
  }

  async function resolveLandingPage() {
    try {
      const res = await fetch('/api/auth/menu-access');
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          sessionStorage.setItem('doubley_menu_access', JSON.stringify(data));
        } catch {
          // ignore storage errors
        }

        const apps = Array.isArray(data.applications)
          ? data.applications.map((app) => String(app || '').trim()).filter(Boolean)
          : [];

        const nextUrl = getSafeNextUrl(apps, !!data.isRoot);
        if (nextUrl) return nextUrl;

        if (data.isRoot || apps.includes('warehouse.html')) {
          return '/warehouse.html';
        }

        const preferred = [
          'location-product.html',
          'pesquisa.html',
          'picking.html',
          'Search-Product-Tablet.html'
        ];
        const preferredHit = preferred.find((app) => apps.includes(app));
        if (preferredHit) return `/${preferredHit}`;

        if (apps.length > 0) return `/${apps[0]}`;
      }
    } catch {
      // ignore menu-access errors
    }
    return getSafeNextUrl([], true) || '/warehouse.html';
  }

  async function prefetchHeaderStats(forceRefresh) {
    try {
      if (!forceRefresh && (localStorage.getItem('doubley_header_stats') || sessionStorage.getItem('doubley_header_stats'))) {
        return;
      }
      const statsRes = await fetch('/api/warehouse/estatisticas', { credentials: 'include' });
      const statsData = await statsRes.json().catch(() => ({}));
      if (statsRes.ok && statsData.success && statsData.data) {
        const payload = JSON.stringify({
          total: statsData.data.total ?? 0,
          estoqueBaixo: statsData.data.estoqueBaixo ?? 0,
          esgotado: statsData.data.esgotado ?? 0,
          entradas: statsData.data.entradas ?? 0,
          saidas: statsData.data.saidas ?? 0
        });
        localStorage.setItem('doubley_header_stats', payload);
        sessionStorage.setItem('doubley_header_stats', payload);
      }
    } catch {
      // Keep login flow even if stats prefetch fails.
    }
  }

  async function checkExistingSession() {
    if (!sessionStorage.getItem(TAB_SESSION_KEY)) return;

    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.authenticated) {
        await prefetchHeaderStats();
        window.location.href = await resolveLandingPage();
        return;
      }
      sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch {
      sessionStorage.removeItem(TAB_SESSION_KEY);
    }
  }

  function setupPasswordToggle() {
    if (!togglePasswordBtn || !passwordInput) return;

    togglePasswordBtn.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      togglePasswordBtn.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
      togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      togglePasswordBtn.title = isHidden ? 'Hide password' : 'Show password';
      togglePasswordBtn.textContent = isHidden ? 'Hide' : 'Show';
      passwordInput.focus();
    });
  }

  async function requestPasswordReminder() {
    if (forgotBusy) return;
    hideError();
    hideInfo();

    const email = emailInput.value.trim();
    if (!email) {
      showError('Enter your email first to recover your password.', emailInput);
      return;
    }
    if (email.toLowerCase() === 'root') {
      showError('Root password is managed by system configuration.', emailInput);
      return;
    }

    forgotBusy = true;
    if (forgotPasswordLink) forgotPasswordLink.classList.add('is-busy');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showError(data.message || 'Unable to send password reminder. Please try again.', emailInput);
        return;
      }
      showInfo(data.message || 'If this email is registered, your password has been sent.');
    } catch {
      showError('Unable to connect to the server. Please try again.', emailInput);
    } finally {
      forgotBusy = false;
      if (forgotPasswordLink) forgotPasswordLink.classList.remove('is-busy');
    }
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      requestPasswordReminder();
    });
  }

  if (refreshCaptchaBtn) {
    refreshCaptchaBtn.addEventListener('click', () => {
      loadCaptcha();
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      hideError();
      hideInfo();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();
    hideInfo();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const payload = { email, password };

    if (captchaRequired) {
      payload.captchaId = captchaIdInput ? captchaIdInput.value : '';
      payload.captchaAnswer = captchaAnswerInput ? captchaAnswerInput.value.trim() : '';
      if (!payload.captchaId || !payload.captchaAnswer) {
        showError('Please complete the verification to confirm you are not a robot.', captchaAnswerInput);
        return;
      }
    }

    setSigningIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        hideCaptcha();
        persistRememberedEmail(email);
        sessionStorage.setItem(TAB_SESSION_KEY, '1');
        try {
          localStorage.removeItem('doubley_header_stats');
          sessionStorage.removeItem('doubley_header_stats');
        } catch {
          // ignore
        }
        await prefetchHeaderStats(true);
        window.location.href = await resolveLandingPage();
        return;
      }

      showError(data.message || 'Invalid email or password. Please try again.');

      if (data.captchaRequired) {
        if (data.captcha) {
          showCaptcha(data.captcha);
        } else {
          await loadCaptcha();
        }
      }

      const focusTarget = resolveErrorFocusTarget();
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
        if (typeof focusTarget.select === 'function') {
          focusTarget.select();
        }
      }
    } catch {
      showError('Unable to connect to the server. Please try again.', emailInput.value.trim() ? passwordInput : emailInput);
    } finally {
      setSigningIn(false);
    }
  });

  setupPasswordToggle();
  restoreRememberedEmail();
  checkExistingSession();
  hideError();
  hideInfo();
  hideCaptcha();
})();
