(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  const captchaPanel = document.getElementById('captchaPanel');
  const captchaQuestion = document.getElementById('captchaQuestion');
  const captchaAnswerInput = document.getElementById('captchaAnswer');
  const captchaIdInput = document.getElementById('captchaId');
  const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');

  let captchaRequired = false;

  function hideError() {
    loginError.hidden = true;
    loginError.style.display = 'none';
  }

  function showError(message) {
    loginErrorText.textContent = message;
    loginError.hidden = false;
    loginError.style.display = 'flex';
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
      captchaAnswerInput.focus();
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
    showError('Unable to load verification challenge. Please try again.');
    return false;
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
      }
    } catch {
      // ignore menu-access errors; still land on warehouse
    }
    return '/warehouse.html';
  }

  async function checkExistingSession() {
    if (!sessionStorage.getItem(TAB_SESSION_KEY)) return;

    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = await resolveLandingPage();
        return;
      }
      sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch {
      sessionStorage.removeItem(TAB_SESSION_KEY);
    }
  }

  if (refreshCaptchaBtn) {
    refreshCaptchaBtn.addEventListener('click', () => {
      loadCaptcha();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const payload = { email, password };

    if (captchaRequired) {
      payload.captchaId = captchaIdInput ? captchaIdInput.value : '';
      payload.captchaAnswer = captchaAnswerInput ? captchaAnswerInput.value.trim() : '';
      if (!payload.captchaId || !payload.captchaAnswer) {
        showError('Please complete the verification to confirm you are not a robot.');
        return;
      }
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        hideCaptcha();
        sessionStorage.setItem(TAB_SESSION_KEY, '1');
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

      if (!email) {
        emailInput.focus();
      } else if (captchaRequired && captchaAnswerInput) {
        captchaAnswerInput.focus();
        captchaAnswerInput.select();
      } else {
        passwordInput.focus();
        passwordInput.select();
      }
    } catch {
      showError('Unable to connect to the server. Please try again.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  });

  checkExistingSession();
  hideError();
  hideCaptcha();
})();
