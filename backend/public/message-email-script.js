(function () {
  const API = '/api/message-email';

  const form = document.getElementById('messageEmailForm');
  const messageCode = document.getElementById('messageCode');
  const messageCategory = document.getElementById('messageCategory');
  const messageStatus = document.getElementById('messageStatus');
  const messageSubject = document.getElementById('messageSubject');
  const messageBody = document.getElementById('messageBody');
  const messageNotes = document.getElementById('messageNotes');
  const clearBtn = document.getElementById('clearMessageBtn');
  const statusEl = document.getElementById('messageEmailStatus');
  const panel = document.getElementById('messageEmailPanel');

  function showStatus(text, type) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className = 'message-email-message' + (text ? (' show ' + (type || 'info')) : '');
  }

  function clearForm() {
    if (form) form.reset();
    if (messageCategory) messageCategory.value = 'GENERAL';
    if (messageStatus) messageStatus.value = 'ACTIVE';
    showStatus('');
    messageCode?.focus();
  }

  async function saveMessage(event) {
    event.preventDefault();
    showStatus('');

    const payload = {
      messageCode: messageCode?.value || '',
      category: messageCategory?.value || 'GENERAL',
      status: messageStatus?.value || 'ACTIVE',
      subject: messageSubject?.value || '',
      body: messageBody?.value || '',
      notes: messageNotes?.value || ''
    };

    try {
      const res = await fetch(API, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error((data && (data.error || data.message)) || 'Unable to save message');
      }
      showStatus(data.message || 'Email message saved successfully.', 'success');
      clearForm();
    } catch (error) {
      showStatus(error.message || 'Unable to save message', 'error');
    }
  }

  function focusPanel() {
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => {
      panel?.focus({ preventScroll: true });
      messageCode?.focus({ preventScroll: true });
    });
  }

  if (messageCode) {
    messageCode.addEventListener('input', () => {
      messageCode.value = messageCode.value.toUpperCase();
    });
  }

  form?.addEventListener('submit', saveMessage);
  clearBtn?.addEventListener('click', clearForm);
  focusPanel();
})();
