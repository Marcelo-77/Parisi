(function () {
  const ENVIRONMENT_CONFIG = {
    development: {
      text: 'Development Environment',
      shortLabel: 'Development',
      className: 'dev-environment-badge',
      bodyClass: 'env-development',
      cardStripClass: 'login-environment-strip login-environment-strip--development',
      subtitle: 'Sign in to your local development environment.',
      showWarning: false,
      noindex: true
    },
    approval: {
      text: 'Environment Approval',
      shortLabel: 'Approval',
      className: 'dev-environment-badge approval-environment-badge',
      bodyClass: 'env-approval',
      cardStripClass: 'login-environment-strip login-environment-strip--approval',
      subtitle: 'Sign in to the approval environment. Changes here do not affect production.',
      showWarning: true,
      warningText: 'This environment may contain a copy of production data. Do not share credentials or use real customer data for tests.',
      noindex: true
    },
    homolog: {
      text: 'Environment Homolog',
      shortLabel: 'Homolog',
      className: 'dev-environment-badge homolog-environment-badge',
      bodyClass: 'env-homolog',
      cardStripClass: 'login-environment-strip login-environment-strip--homolog',
      subtitle: 'Sign in to the homologation environment.',
      showWarning: true,
      warningText: 'This is a test environment. Changes here do not affect production.',
      noindex: true
    }
  };

  let resolvedEnvironmentKey = '';
  let environmentReadyFired = false;

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
    return ENVIRONMENT_CONFIG[key] ? key : '';
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

  function getEnvironmentConfig(key) {
    return key ? ENVIRONMENT_CONFIG[key] || null : null;
  }

  function createBadge(id, config) {
    const badge = document.createElement('div');
    badge.id = id;
    badge.className = config.className;
    badge.setAttribute('role', 'status');
    badge.textContent = config.text;
    return badge;
  }

  function applyNoIndex(shouldApply) {
    if (!shouldApply || document.querySelector('meta[name="robots"][data-env-noindex]')) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    meta.setAttribute('data-env-noindex', '1');
    document.head.appendChild(meta);
  }

  function setupLoginPage(config) {
    const strip = document.getElementById('loginEnvironmentStrip');
    if (strip) {
      strip.className = config.cardStripClass;
      strip.textContent = config.text;
      strip.hidden = false;
    }

    const subtitle = document.getElementById('loginSubtitle');
    if (subtitle && config.subtitle) {
      subtitle.textContent = config.subtitle;
    }

    const warning = document.getElementById('loginEnvironmentWarning');
    const warningText = document.getElementById('loginEnvironmentWarningText');
    if (warning && warningText) {
      if (config.showWarning && config.warningText) {
        warningText.textContent = config.warningText;
        warning.hidden = false;
      } else {
        warning.hidden = true;
      }
    }

    const hostMeta = document.getElementById('loginHostMeta');
    if (hostMeta) {
      hostMeta.textContent = 'Connected to: ' + window.location.host;
      hostMeta.hidden = false;
    }

    const versionMeta = document.getElementById('loginVersionMeta');
    if (versionMeta) {
      versionMeta.textContent = '2026 • ' + config.shortLabel;
      versionMeta.hidden = false;
    }

    applyNoIndex(config.noindex);
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

  function dispatchEnvironmentReady(key, config) {
    environmentReadyFired = true;
    window.DoubleYEnvironment = {
      key: key,
      config: config,
      isNonProduction: Boolean(key)
    };

    document.dispatchEvent(new CustomEvent('doubley:environment-ready', {
      detail: { key, config }
    }));
  }

  async function showEnvironmentBadges() {
    const environmentKey = await resolveEnvironment();
    resolvedEnvironmentKey = environmentKey;
    if (!environmentKey) {
      dispatchEnvironmentReady('', null);
      return;
    }

    const config = ENVIRONMENT_CONFIG[environmentKey];
    if (!config) {
      dispatchEnvironmentReady('', null);
      return;
    }

    document.body.classList.add(config.bodyClass);

    if (document.querySelector('.login-page')) {
      setupLoginPage(config);
    } else if (!showHeaderBadges(config)) {
      showFixedBanner(config);
    }

    applyNoIndex(config.noindex);
    dispatchEnvironmentReady(environmentKey, config);
  }

  window.DoubleYEnvironment = {
    get key() {
      return resolvedEnvironmentKey;
    },
    getConfig: function () {
      return getEnvironmentConfig(resolvedEnvironmentKey);
    },
    whenReady: function (callback) {
      if (typeof callback !== 'function') return;
      if (environmentReadyFired) {
        callback({
          key: resolvedEnvironmentKey,
          config: getEnvironmentConfig(resolvedEnvironmentKey)
        });
        return;
      }
      document.addEventListener('doubley:environment-ready', function handler(event) {
        document.removeEventListener('doubley:environment-ready', handler);
        callback(event.detail || { key: '', config: null });
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showEnvironmentBadges);
  } else {
    showEnvironmentBadges();
  }
})();
