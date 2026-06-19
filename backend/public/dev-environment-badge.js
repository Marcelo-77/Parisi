(function () {
  const BADGE_TEXT = 'Development Environment';

  function isLocalEnvironment() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function createBadge(id) {
    const badge = document.createElement('div');
    badge.id = id;
    badge.className = 'dev-environment-badge';
    badge.setAttribute('role', 'status');
    badge.textContent = BADGE_TEXT;
    return badge;
  }

  function showDevEnvironmentBadges() {
    if (!isLocalEnvironment()) return;

    const totalStat = document.querySelector('.header-stat-total');
    const exitsStat = document.querySelector('.header-stat-exits');
    if (!totalStat || !exitsStat) return;

    if (!document.getElementById('devEnvironmentBadgeBefore')) {
      totalStat.insertAdjacentElement('beforebegin', createBadge('devEnvironmentBadgeBefore'));
    }

    if (!document.getElementById('devEnvironmentBadgeAfter')) {
      exitsStat.insertAdjacentElement('afterend', createBadge('devEnvironmentBadgeAfter'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDevEnvironmentBadges);
  } else {
    showDevEnvironmentBadges();
  }
})();
