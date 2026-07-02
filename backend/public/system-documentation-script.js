(function () {
  const API_BASE = '/api/system-documentation';
  const MAX_FILE_SIZE = 7 * 1024 * 1024;

  function showMessage(text, type) {
    const el = document.getElementById('systemDocMessage');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.className = 'system-doc-message';
      return;
    }
    el.textContent = text;
    el.className = `system-doc-message show ${type || 'info'}`;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(event) {
    event.preventDefault();

    const titleInput = document.getElementById('docTitle');
    const fileInput = document.getElementById('docFile');
    const descriptionInput = document.getElementById('docDescription');
    const submitBtn = document.getElementById('uploadDocBtn');

    const title = titleInput?.value.trim() || '';
    const file = fileInput?.files && fileInput.files[0];

    if (!title) {
      showMessage('Title is required.', 'error');
      titleInput?.focus();
      return;
    }

    if (!file) {
      showMessage('Please select a file.', 'error');
      fileInput?.focus();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage('File size must be less than 7 MB.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
      const fileBase64 = await readFileAsBase64(file);
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title,
          description: descriptionInput?.value.trim() || '',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to save document.');
      }

      document.getElementById('uploadDocForm')?.reset();
      showMessage('Document saved successfully.', 'success');
    } catch (error) {
      console.error('Upload documentation error:', error);
      showMessage(error.message || 'Error saving document.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save document';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('uploadDocForm')?.addEventListener('submit', handleUpload);
  });
})();
