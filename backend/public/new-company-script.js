const API_COMPANIES = '/api/companies';
let existingLogo = null;
let isEditMode = false;

function getEditCompanyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('edit');
  return id && String(id).trim() ? String(id).trim() : null;
}

function getCompanyDisplayName() {
  const nameInput = document.getElementById('companyName');
  return nameInput ? nameInput.value.trim() : '';
}

function getDisplayedLogo() {
  if (existingLogo) return existingLogo;

  const previewImg = document.getElementById('companyLogoPreviewImg');
  const preview = document.getElementById('companyLogoPreview');
  if (previewImg && preview && preview.style.display !== 'none' && previewImg.src) {
    return previewImg.src;
  }

  return null;
}

function updateCompanyHeaderLogo(logo, name) {
  if (!window.BrandImage) return;
  window.BrandImage.setBrandImage(
    document.getElementById('companyHeaderLogoWrap'),
    document.getElementById('companyHeaderLogoImg'),
    document.getElementById('companyHeaderLogoInitials'),
    logo,
    name
  );
}

function hideCompanyHeaderLogo() {
  if (!window.BrandImage) return;
  window.BrandImage.hideBrandImage(
    document.getElementById('companyHeaderLogoWrap'),
    document.getElementById('companyHeaderLogoImg'),
    document.getElementById('companyHeaderLogoInitials')
  );
}

function refreshCompanyBrandDisplay() {
  const name = getCompanyDisplayName();
  const logo = getDisplayedLogo();

  if (logo || name) {
    updateCompanyHeaderLogo(logo, name);
    return;
  }

  hideCompanyHeaderLogo();
}

function setEditMode(isEdit) {
  isEditMode = isEdit;
  const pageTitle = document.getElementById('companyPageTitle');
  const formTitle = document.getElementById('companyFormTitle');
  const formSubtitle = document.getElementById('companyFormSubtitle');
  const saveBtn = document.getElementById('saveCompanyBtn');

  if (pageTitle) pageTitle.textContent = isEdit ? 'Edit Company' : 'New Company';
  if (formTitle) {
    formTitle.innerHTML = isEdit
      ? '<i class="fas fa-edit"></i> Edit Company'
      : '<i class="fas fa-plus"></i> New Company';
  }
  if (formSubtitle) {
    formSubtitle.textContent = isEdit
      ? 'Update company details and logo.'
      : 'Register company details and upload a logo.';
  }
  if (saveBtn) {
    saveBtn.innerHTML = isEdit
      ? '<i class="fas fa-save"></i> Update Company'
      : '<i class="fas fa-save"></i> Save Company';
  }

  refreshCompanyBrandDisplay();
}

function showLogoFilePreview(src) {
  const preview = document.getElementById('companyLogoPreview');
  const previewImg = document.getElementById('companyLogoPreviewImg');
  if (!preview || !previewImg) return;

  if (src && !isEditMode) {
    previewImg.src = src;
    preview.style.display = 'block';
  } else {
    previewImg.removeAttribute('src');
    preview.style.display = 'none';
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read logo file.'));
    reader.readAsDataURL(file);
  });
}

function previewCompanyLogo(event) {
  const file = event.target.files[0];
  const errorEl = document.getElementById('companyLogo-error');
  if (errorEl) errorEl.textContent = '';

  if (!file) {
    showLogoFilePreview(null);
    refreshCompanyBrandDisplay();
    return;
  }

  if (!file.type.startsWith('image/')) {
    if (errorEl) errorEl.textContent = 'Please select an image file.';
    event.target.value = '';
    showLogoFilePreview(null);
    refreshCompanyBrandDisplay();
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    if (errorEl) errorEl.textContent = 'Image size must be less than 5MB.';
    event.target.value = '';
    showLogoFilePreview(null);
    refreshCompanyBrandDisplay();
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewSrc = e.target.result;
    showLogoFilePreview(previewSrc);
    updateCompanyHeaderLogo(previewSrc, getCompanyDisplayName());
  };
  reader.readAsDataURL(file);
}

function collectCompanyPayload(logoValue) {
  return {
    name: document.getElementById('companyName').value.trim(),
    responsibleName: document.getElementById('responsibleName').value.trim() || null,
    email: document.getElementById('companyEmail').value.trim() || null,
    phone: document.getElementById('companyPhone').value.trim() || null,
    address: document.getElementById('companyAddress').value.trim() || null,
    logo: logoValue
  };
}

async function loadCompanyForEdit(id) {
  const response = await fetch(`${API_COMPANIES}/${encodeURIComponent(id)}`);
  const result = await response.json();
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || 'Company not found');
  }

  const company = result.data;
  document.getElementById('companyName').value = company.name || '';
  document.getElementById('responsibleName').value = company.responsibleName || '';
  document.getElementById('companyEmail').value = company.email || '';
  document.getElementById('companyPhone').value = company.phone || '';
  document.getElementById('companyAddress').value = company.address || '';
  existingLogo = company.logo || null;
  showLogoFilePreview(null);
  refreshCompanyBrandDisplay();
}

async function handleCompanySubmit(event) {
  event.preventDefault();
  const saveBtn = document.getElementById('saveCompanyBtn');
  const editId = getEditCompanyIdFromUrl();
  const name = document.getElementById('companyName').value.trim();

  if (!name) {
    alert('Please enter a company name.');
    return;
  }

  const logoFile = document.getElementById('companyLogo').files[0];
  let logoValue = existingLogo;

  if (logoFile) {
    logoValue = await convertFileToBase64(logoFile);
  }

  const payload = collectCompanyPayload(logoValue);

  if (saveBtn) saveBtn.disabled = true;
  try {
    const response = await fetch(editId ? `${API_COMPANIES}/${encodeURIComponent(editId)}` : API_COMPANIES, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.error || result.message || 'Error saving company.');
      return;
    }

    alert(editId ? 'Company updated successfully.' : 'Company created successfully.');
    if (editId) {
      window.location.href = 'search-company.html';
    } else {
      document.getElementById('companyForm').reset();
      existingLogo = null;
      showLogoFilePreview(null);
      hideCompanyHeaderLogo();
    }
  } catch (error) {
    console.error(error);
    alert('Network error. Please try again.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.DoubleYHeaderMenu) {
    window.DoubleYHeaderMenu.ensure();
    window.DoubleYHeaderMenu.setupDropdowns();
  }

  const editId = getEditCompanyIdFromUrl();
  setEditMode(Boolean(editId));

  if (editId) {
    try {
      await loadCompanyForEdit(editId);
    } catch (error) {
      alert(error.message || 'Unable to load company.');
      window.location.href = 'search-company.html';
      return;
    }
  }

  document.getElementById('companyName').addEventListener('input', refreshCompanyBrandDisplay);
  document.getElementById('companyLogo').addEventListener('change', previewCompanyLogo);
  document.getElementById('companyForm').addEventListener('submit', handleCompanySubmit);
});
