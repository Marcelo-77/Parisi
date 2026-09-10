const API = '/api/message-request';
const USERS_API = '/api/funcionarios';

function clearForm() {
  document.getElementById('messageType').value = 'EMAIL';
  document.getElementById('priority').value = 'NORMAL';
  document.getElementById('desiredDate').value = '';
  document.getElementById('assignedTo').value = '';
  document.getElementById('recipientName').value = '';
  document.getElementById('recipientEmail').value = '';
  document.getElementById('subject').value = '';
  document.getElementById('messageContent').value = '';
  document.getElementById('attachmentNote').value = '';
}

async function loadResponsibleUsers() {
  const select = document.getElementById('assignedTo');
  if (!select) return;
  try {
    const res = await fetch(USERS_API + '?ativo=true&ordenarPor=nome&direcao=asc', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data.success) return;
    const users = data.data || [];
    select.innerHTML = '<option value="">Select responsible user...</option>'
      + users.map((u) => {
        const id = u.id || '';
        const name = u.nome || u.email || id;
        return `<option value="${id}">${String(name).replace(/</g, '&lt;')}</option>`;
      }).join('');
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('messageRequestForm');
  const clearBtn = document.getElementById('clearMessageRequestBtn');

  loadResponsibleUsers();
  clearBtn?.addEventListener('click', clearForm);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const assignedSelect = document.getElementById('assignedTo');
    const assignedTo = assignedSelect.value;
    const assignedToName = assignedSelect.selectedOptions[0]?.textContent?.trim() || '';

    const payload = {
      messageType: document.getElementById('messageType').value,
      priority: document.getElementById('priority').value,
      desiredDate: document.getElementById('desiredDate').value || null,
      assignedTo,
      assignedToName: assignedTo ? assignedToName : null,
      recipientName: document.getElementById('recipientName').value.trim(),
      recipientEmail: document.getElementById('recipientEmail').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      messageContent: document.getElementById('messageContent').value.trim(),
      attachmentNote: document.getElementById('attachmentNote').value.trim()
    };

    if (!payload.assignedTo) {
      alert('Select the responsible user.');
      return;
    }
    if (!payload.subject || !payload.messageContent) {
      alert('Subject and message content are required.');
      return;
    }
    if (payload.messageType === 'EMAIL' && !payload.recipientEmail) {
      alert('Recipient email is required for Email type.');
      return;
    }

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create request');
      }
      alert(`Request #${data.data.requestNumber} created and assigned to ${payload.assignedToName}.`);
      clearForm();
    } catch (err) {
      alert(err.message || 'Error creating message request');
    }
  });
});
