(function () {
  const EFFECT_MS = 7000;

  function settleLogoEffects() {
    document.querySelectorAll('.double-y-wordmark').forEach(function (el) {
      el.classList.add('double-y-wordmark--settled');
    });
  }

  function startLogoTimer() {
    window.setTimeout(settleLogoEffects, EFFECT_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLogoTimer);
  } else {
    startLogoTimer();
  }
})();
