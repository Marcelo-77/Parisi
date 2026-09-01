(function () {
  function closeLocationPage() {
    window.location.replace('warehouse.html');
  }

  function bindCloseButtons() {
    document.querySelectorAll('.location-page-close-btn, [data-location-page-close="true"]').forEach((btn) => {
      if (btn.dataset.locationPageCloseBound === 'true') return;
      btn.dataset.locationPageCloseBound = 'true';
      btn.addEventListener('click', closeLocationPage);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCloseButtons);
  } else {
    bindCloseButtons();
  }

  window.DoubleYLocationPageClose = {
    close: closeLocationPage,
    bind: bindCloseButtons
  };
})();
