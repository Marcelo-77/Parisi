/**
 * Early Sidebar boot — load in <head> before paint.
 * Prevents classic/purple/blue flash when navigating or right after login.
 */
(function () {
  try {
    var path = window.location.pathname || '';
    if (path.endsWith('/login.html') || path.endsWith('/index.html')) return;

    // Use the session active mode when present so a "next login" preferred
    // change cannot flash the wrong shell before apply().
    var preferred = String(localStorage.getItem('doubley_screen_display_preferred') || 'classic')
      .trim()
      .toLowerCase();
    var active = String(sessionStorage.getItem('doubley_screen_display_active') || '')
      .trim()
      .toLowerCase();
    var mode = active === 'sidebar' || active === 'classic' ? active : preferred;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    var holdReveal = false;
    try {
      holdReveal = sessionStorage.getItem('doubley_ssd_reveal_hold') === '1';
    } catch (e) {
      holdReveal = false;
    }

    // After login (esp. phone/tablet), keep a neutral cover until server prefs apply.
    if (mode !== 'sidebar' && !holdReveal) return;

    document.documentElement.classList.add('ssd-boot-sidebar');
    if (narrow || holdReveal) document.documentElement.classList.add('ssd-boot-narrow');

    if (!document.getElementById('ssdBootStyle')) {
      document.write(
        '<style id="ssdBootStyle">' +
          'html.ssd-boot-sidebar,html.ssd-boot-sidebar body{' +
            'background:#eef1f6!important;background-image:none!important;' +
          '}' +
          'html.ssd-boot-sidebar .header-actions,' +
          'html.ssd-boot-sidebar .header-stats-row,' +
          'html.ssd-boot-sidebar .header .double-y-wordmark,' +
          'html.ssd-boot-sidebar .double-y-wordmark--corner,' +
          'html.ssd-boot-sidebar #doubleYCornerBrand,' +
          'html.ssd-boot-sidebar .ssd-lang-switch--header{' +
            'opacity:0!important;visibility:hidden!important;pointer-events:none!important;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow)::before{' +
            'content:"";position:fixed;left:0;top:0;bottom:0;width:248px;' +
            'background:#10243f;z-index:1199;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .container{' +
            'margin-left:248px!important;max-width:none!important;width:auto!important;' +
            'background:transparent!important;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header-content > h1,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header-search-users-label{' +
            'color:#10233f!important;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header-content--bp .bp-header-session{' +
            'background:linear-gradient(90deg,#eaf2ff 0%,#f7faff 52%,#eef4ff 100%)!important;' +
            'border:1px solid #d5e4f8!important;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session .bp-hero-user-text strong,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session .bp-hero-company-text strong,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header-content--bp .bp-header-session .bp-hero-user-text strong,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .header-content--bp .bp-header-session .bp-hero-company-text strong{' +
            'color:#0f1f3d!important;' +
          '}' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session .bp-hero-user-text span,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session .bp-hero-user-text .session-user-role,' +
          'html.ssd-boot-sidebar:not(.ssd-boot-narrow) .bp-header-session .bp-hero-label{' +
            'color:#475569!important;' +
          '}' +
          /* Phone/tablet: hide page until final config is applied (no blue flash). */
          'html.ssd-boot-sidebar.ssd-boot-narrow .header,' +
          'html.ssd-boot-sidebar.ssd-boot-narrow .container,' +
          'html.ssd-boot-sidebar.ssd-boot-narrow #doubleYSidebar,' +
          'html.ssd-boot-sidebar.ssd-boot-narrow #doubleYMobileTop,' +
          'html.ssd-boot-sidebar.ssd-boot-narrow #doubleYMobileBar,' +
          'html.ssd-boot-sidebar.ssd-boot-narrow #doubleYMobileDrawer{' +
            'visibility:hidden!important;' +
          '}' +
          'html.ssd-boot-sidebar.ssd-boot-narrow,html.ssd-boot-sidebar.ssd-boot-narrow body{' +
            'background:#eef1f6!important;background-image:none!important;' +
          '}' +
        '</style>'
      );
    }

    // Preload sidebar CSS so white layout rules arrive ASAP.
    if (!document.querySelector('link[data-ssd-boot-css="1"]')) {
      document.write(
        '<link rel="stylesheet" href="screen-display.css?v=20261122ssd33" data-ssd-boot-css="1">'
      );
    }

    // As soon as <body> exists, mark it so full CSS can match before apply().
    function markBody() {
      if (!document.body) return false;
      if (mode === 'sidebar') {
        document.body.classList.add('screen-display-sidebar');
      }
      if (narrow) {
        document.body.classList.add('ssd-narrow');
        if (mode === 'sidebar' && !/schedule-home\.html$/i.test(path)) {
          document.body.classList.add('ssd-mobile-app-page');
        }
      }
      return true;
    }
    if (!markBody()) {
      document.addEventListener('DOMContentLoaded', markBody, { once: true });
    }
  } catch (e) {
    /* ignore */
  }
})();
