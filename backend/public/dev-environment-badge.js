(function () {
  const ENVIRONMENT_BADGES = {
    development: {
      text: 'Development Environment',
      className: 'dev-environment-badge'
    },
    approval: {
      text: 'Environment Approval',
      className: 'dev-environment-badge approval-environment-badge'
    },
    homolog: {
      text: 'Environment Homolog',
      className: 'dev-environment-badge homolog-environment-badge'
    }
  };

  function resolveEnvironmentFromHost(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return host ? 'development' : '';
    }
    if (host.startsWith('approval.') || host === 'approval.double-y.online') {
      return 'approval';
    }
    if (host.startsWith('homolog.') || host === 'homolog.double-y.online') {
      return 'homolog';
    }
    return '';
  }

  function normalizeEnvironment(value) {
    const key = String(value || '').trim().toLowerCase();
    return ENVIRONMENT_BADGES[key] ? key : '';
  }

  async function resolveEnvironment() {
    const fromHost = resolveEnvironmentFromHost(window.location.hostname);
    if (fromHost) return fromHost;

    try {
      const res = await fetch('/api/env', { credentials: 'same-origin' });
      if (!res.ok) return '';
      const data = await res.json();
      return normalizeEnvironment(data.environment);
    } catch {
      return '';
    }
  }

  function createBadge(id, config) {
    const badge = document.createElement('div');
    badge.id = id;
    badge.className = config.className;
    badge.setAttribute('role', 'status');
    badge.textContent = config.text;
    return badge;
  }

  function showHeaderBadges(config) {
    const totalStat = document.querySelector('.header-stat-total');
    const exitsStat = document.querySelector('.header-stat-exits');
    if (!totalStat || !exitsStat) return false;

    if (!document.getElementById('devEnvironmentBadgeBefore')) {
      totalStat.insertAdjacentElement('beforebegin', createBadge('devEnvironmentBadgeBefore', config));
    }

    if (!document.getElementById('devEnvironmentBadgeAfter')) {
      exitsStat.insertAdjacentElement('afterend', createBadge('devEnvironmentBadgeAfter', config));
    }

    return true;
  }

  function showLoginBanner(config) {
    const page = document.querySelector('.login-page');
    if (!page || document.getElementById('environmentBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'environmentBanner';
    banner.className = config.className + ' environment-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = config.text;
    page.insertBefore(banner, page.firstChild);
  }

  function showFixedBanner(config) {
    if (document.getElementById('environmentBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'environmentBanner';
    banner.className = config.className + ' environment-banner environment-banner--fixed';
    banner.setAttribute('role', 'status');
    banner.textContent = config.text;
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.classList.add('has-environment-banner-fixed');
  }

  async function showEnvironmentBadges() {
    const environmentKey = await resolveEnvironment();
    if (!environmentKey) return;

    const config = ENVIRONMENT_BADGES[environmentKey];
    if (!config) return;

    if (!showHeaderBadges(config)) {
      if (document.querySelector('.login-page')) {
        showLoginBanner(config);
      } else {
        showFixedBanner(config);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showEnvironmentBadges);
  } else {
    showEnvironmentBadges();
  }
})();
