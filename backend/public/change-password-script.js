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
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
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

let originalEmail = '';

async function loadLoggedUser() {
  const infoEl = document.getElementById('loggedUserInfo');
  const form = document.getElementById('changePasswordForm');
  const saveBtn = document.getElementById('savePasswordBtn');
  const emailInput = document.getElementById('accountEmail');

  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();

    if (!data.authenticated || !data.user) {
      window.location.replace('/login.html');
      return;
    }

    if (data.user.isRoot) {
      if (infoEl) {
        infoEl.textContent = 'Signed in as root. Root account settings cannot be changed here.';
      }
      if (form) form.style.display = 'none';
      return;
    }

    originalEmail = data.user.email ? String(data.user.email).trim().toLowerCase() : '';
    if (emailInput) emailInput.value = data.user.email || '';

    if (infoEl) {
      const position = data.user.cargo ? ` · ${data.user.cargo}` : '';
      const company = data.user.companyName ? ` · ${data.user.companyName}` : '';
      infoEl.textContent = `Signed in as ${data.user.nome}${position}${company}`;
    }
  } catch (error) {
    console.error(error);
    if (infoEl) infoEl.textContent = 'Unable to load user information.';
    if (saveBtn) saveBtn.disabled = true;
  }
}

function showPasswordSavedModal(message) {
  const modal = document.getElementById('passwordSavedModal');
  const messageEl = document.getElementById('passwordSavedMessage');
  if (messageEl && message) messageEl.textContent = message;
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
  const accountEmail = document.getElementById('accountEmail').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const saveBtn = document.getElementById('savePasswordBtn');

  if (!accountEmail) {
    showMessage('Registered email is required.', 'error');
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(accountEmail)) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  const wantsPasswordChange = Boolean(newPassword || confirmPassword);
  const wantsEmailChange = accountEmail.toLowerCase() !== originalEmail;

  if (!wantsPasswordChange && !wantsEmailChange) {
    showMessage('Change your email and/or enter a new password before saving.', 'error');
    return;
  }

  if (wantsPasswordChange) {
    if (!newPassword || !confirmPassword) {
      showMessage('Enter and confirm the new password.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage('New password and confirmation do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showMessage('New password must have at least 6 characters.', 'error');
      return;
    }
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        email: accountEmail,
        newPassword: wantsPasswordChange ? newPassword : undefined,
        confirmPassword: wantsPasswordChange ? confirmPassword : undefined
      })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Unable to update account.');
    }

    if (!data.emailChanged && !data.passwordChanged) {
      throw new Error('No changes were saved. Check your current password and try again.');
    }

    if (data.emailChanged && data.user && data.user.email) {
      originalEmail = String(data.user.email).trim().toLowerCase();
      document.getElementById('accountEmail').value = data.user.email;
    } else if (data.user && data.user.email) {
      document.getElementById('accountEmail').value = data.user.email;
    }

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';

    if (window.DoubleYMenuAccess && data.user) {
      window.DoubleYMenuAccess.renderLoggedUserInfo(data.user);
    }

    showPasswordSavedModal(data.message || 'Your account has been updated successfully.');
    if (saveBtn) saveBtn.disabled = false;
    return;
  } catch (error) {
    showMessage(error.message || 'Unable to update account.', 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupPasswordToggles();
  setupPasswordSavedModal();
  loadLoggedUser();

  const form = document.getElementById('changePasswordForm');
  if (form) form.addEventListener('submit', handleSubmit);
});
