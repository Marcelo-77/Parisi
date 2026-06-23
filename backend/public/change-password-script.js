function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
    ['movementMenuBtn', 'movementDropdownMenu'],
    ['pickingMenuBtn', 'pickingDropdownMenu'],
    ['helpMenuBtn', 'helpDropdownMenu'],
    ['customerMenuBtn', 'customerDropdownMenu']
  ];
  const buttons = {};
  const menus = {};
  dropdowns.forEach(([btnId, menuId]) => {
    buttons[btnId] = document.getElementById(btnId);
    menus[menuId] = document.getElementById(menuId);
  });

  function closeAll() {
    Object.values(menus).forEach((el) => { if (el) el.setAttribute('aria-hidden', 'true'); });
    Object.values(buttons).forEach((el) => { if (el) el.setAttribute('aria-expanded', 'false'); });
  }

  Object.keys(buttons).forEach((btnId) => {
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

function setupPasswordToggles() {
  document.querySelectorAll('.toggle-password-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-eye', !isHidden);
        icon.classList.toggle('fa-eye-slash', isHidden);
      }
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}

function showMessage(text, type) {
  const el = document.getElementById('changePasswordMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `change-password-message show ${type}`;
}

function hideMessage() {
  const el = document.getElementById('changePasswordMessage');
  if (!el) return;
  el.textContent = '';
  el.className = 'change-password-message';
}

async function loadLoggedUser() {
  const infoEl = document.getElementById('loggedUserInfo');
  const form = document.getElementById('changePasswordForm');
  const saveBtn = document.getElementById('savePasswordBtn');

  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();

    if (!data.authenticated || !data.user) {
      window.location.replace('/login.html');
      return;
    }

    if (data.user.isRoot) {
      if (infoEl) {
        infoEl.textContent = 'Signed in as root. Root password is managed by system configuration and cannot be changed here.';
      }
      if (form) form.style.display = 'none';
      return;
    }

    if (infoEl) {
      infoEl.textContent = `Signed in as ${data.user.nome} (${data.user.email})`;
    }
  } catch (error) {
    console.error(error);
    if (infoEl) infoEl.textContent = 'Unable to load user information.';
    if (saveBtn) saveBtn.disabled = true;
  }
}

function showPasswordSavedModal() {
  const modal = document.getElementById('passwordSavedModal');
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function setupPasswordSavedModal() {
  const okBtn = document.getElementById('passwordSavedOkBtn');
  if (okBtn) {
    okBtn.addEventListener('click', leaveChangePasswordPage);
  }
}

function leaveChangePasswordPage() {
  const ref = document.referrer;
  try {
    if (ref) {
      const refUrl = new URL(ref);
      if (
        refUrl.origin === window.location.origin &&
        !refUrl.pathname.endsWith('change-password.html')
      ) {
        window.location.href = ref;
        return;
      }
    }
  } catch {
    // ignore invalid referrer
  }
  window.location.href = 'warehouse.html';
}

async function handleSubmit(event) {
  event.preventDefault();
  hideMessage();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const saveBtn = document.getElementById('savePasswordBtn');

  if (newPassword !== confirmPassword) {
    showMessage('New password and confirmation do not match.', 'error');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Unable to change password.');
    }

    document.getElementById('changePasswordForm').reset();
    showPasswordSavedModal();
    return;
  } catch (error) {
    showMessage(error.message || 'Unable to change password.', 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  setupPasswordToggles();
  setupPasswordSavedModal();
  loadLoggedUser();

  const form = document.getElementById('changePasswordForm');
  if (form) form.addEventListener('submit', handleSubmit);
});
