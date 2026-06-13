(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');

  function hideError() {
    loginError.hidden = true;
    loginError.style.display = 'none';
  }

  function showError(message) {
    loginErrorText.textContent = message;
    loginError.hidden = false;
    loginError.style.display = 'flex';
  }

  async function checkExistingSession() {
    if (!sessionStorage.getItem(TAB_SESSION_KEY)) return;

    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = '/warehouse.html';
        return;
      }
      sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch {
      sessionStorage.removeItem(TAB_SESSION_KEY);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const password = passwordInput.value;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        sessionStorage.setItem(TAB_SESSION_KEY, '1');
        window.location.href = '/warehouse.html';
        return;
      }

      showError(data.message || 'Incorrect password. Please try again.');
      passwordInput.focus();
      passwordInput.select();
    } catch {
      showError('Unable to connect to the server. Please try again.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Enter System';
    }
  });

  checkExistingSession();
  hideError();
})();
