(function () {
  const SESSION_FLAG = 'doubley_news_announcement_shown';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString();
  }

  function buildAttachmentsHtml(documentation) {
    if (!Array.isArray(documentation) || !documentation.length) {
      return '';
    }

    const items = documentation.map((doc) => {
      const title = escapeHtml(doc.title || doc.fileName || 'Attachment');
      const fileName = doc.fileName ? ` <span class="news-attachment-file">(${escapeHtml(doc.fileName)})</span>` : '';
      return `<li><a href="/api/system-documentation/${encodeURIComponent(doc.id)}/download" target="_blank" rel="noopener noreferrer"><i class="fas fa-download" aria-hidden="true"></i> ${title}${fileName}</a></li>`;
    }).join('');

    return `
      <div class="news-announcement-attachments">
        <h3><i class="fas fa-paperclip" aria-hidden="true"></i> Attachments</h3>
        <ul>${items}</ul>
      </div>
    `;
  }

  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function showNewsModal(newsItem, index, total, onConfirm) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'news-announcement-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'newsAnnouncementTitle');

      const counterHtml = total > 1
        ? `<span class="news-announcement-counter">${index + 1} / ${total}</span>`
        : '';

      overlay.innerHTML = `
        <div class="news-announcement-modal">
          <div class="news-announcement-header">
            <div>
              <h2 id="newsAnnouncementTitle"><i class="fas fa-bullhorn" aria-hidden="true"></i> News</h2>
              <p class="news-announcement-dates">${formatDate(newsItem.startDate)} — ${formatDate(newsItem.endDate)}</p>
            </div>
            ${counterHtml}
          </div>
          <div class="news-announcement-body">
            <p class="news-announcement-description">${escapeHtml(newsItem.description || '')}</p>
            ${buildAttachmentsHtml(newsItem.documentation)}
          </div>
          <div class="news-announcement-footer">
            <label class="news-announcement-read-label">
              <input type="checkbox" id="newsAnnouncementReadCheck">
              <span>I have read this news and do not want to see it again.</span>
            </label>
            <div class="news-announcement-actions">
              <button type="button" class="btn-confirm" id="newsAnnouncementConfirmBtn" disabled>Continue</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      const checkbox = overlay.querySelector('#newsAnnouncementReadCheck');
      const confirmBtn = overlay.querySelector('#newsAnnouncementConfirmBtn');

      checkbox.addEventListener('change', () => {
        confirmBtn.disabled = !checkbox.checked;
      });

      confirmBtn.addEventListener('click', async () => {
        if (!checkbox.checked) return;
        confirmBtn.disabled = true;
        try {
          await onConfirm(newsItem);
        } catch (error) {
          console.error('Mark news as read error:', error);
          confirmBtn.disabled = false;
          return;
        }
        document.body.style.overflow = '';
        removeOverlay(overlay);
        resolve();
      });
    });
  }

  async function fetchUnreadNews() {
    const res = await fetch('/api/news/unread');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Unable to load news');
    }
    return Array.isArray(data.data) ? data.data : [];
  }

  async function markNewsAsRead(newsId) {
    const res = await fetch(`/api/news/${encodeURIComponent(newsId)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Unable to mark news as read');
    }
  }

  async function showUnreadNewsAnnouncements() {
    if (window.location.pathname.endsWith('/login.html')) return;
    if (sessionStorage.getItem(SESSION_FLAG) === '1') return;

    const items = await fetchUnreadNews();
    if (!items.length) {
      sessionStorage.setItem(SESSION_FLAG, '1');
      return;
    }

    for (let i = 0; i < items.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await showNewsModal(items[i], i, items.length, async (newsItem) => {
        await markNewsAsRead(newsItem.id);
      });
    }

    sessionStorage.setItem(SESSION_FLAG, '1');
  }

  window.DoubleYNewsAnnouncement = {
    show: showUnreadNewsAnnouncements
  };
})();
