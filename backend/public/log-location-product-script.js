(function () {
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const API_LOG = API_BASE + '/api/location-product/log';

  const logTableBody = document.getElementById('logTableBody');
  const resultsCount = document.getElementById('resultsCount');
  const filterLocationCode = document.getElementById('filterLocationCode');
  const filterProductCode = document.getElementById('filterProductCode');
  const filterEntryFrom = document.getElementById('filterEntryFrom');
  const filterEntryTo = document.getElementById('filterEntryTo');
  const searchLogBtn = document.getElementById('searchLogBtn');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');

  function escapeHtml(text) {
    if (text == null || text === '') return '';
    const s = String(text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  }

  function loadLog() {
    const params = new URLSearchParams();
    if (filterLocationCode && filterLocationCode.value.trim()) params.set('locationCodeLog', filterLocationCode.value.trim());
    if (filterProductCode && filterProductCode.value.trim()) params.set('productCodeLog', filterProductCode.value.trim());
    if (filterEntryFrom && filterEntryFrom.value) params.set('entryFrom', new Date(filterEntryFrom.value).toISOString());
    if (filterEntryTo && filterEntryTo.value) params.set('entryTo', new Date(filterEntryTo.value).toISOString());

    const url = params.toString() ? API_LOG + '?' + params.toString() : API_LOG;
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        const list = (data.success && data.data) ? data.data : [];
        if (resultsCount) resultsCount.textContent = list.length + ' record(s)';
        if (!logTableBody) return;
        if (list.length === 0) {
          logTableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-inbox"></i><p>No log records found.</p></td></tr>';
          return;
        }
        logTableBody.innerHTML = list.map(function (r) {
          return '<tr>' +
            '<td>' + escapeHtml(r.locationCodeLog || '') + '</td>' +
            '<td>' + escapeHtml(r.productCodeLog || '') + '</td>' +
            '<td>' + formatDateTime(r.entryDatetimeLog) + '</td>' +
            '<td>' + escapeHtml(r.situationDescription || ('#' + (r.siprSqNumber != null ? r.siprSqNumber : ''))) + '</td>' +
            '<td>' + escapeHtml(r.operationLabel || r.operationLog || '-') + '</td>' +
            '<td>' + (r.quantityCurrentPrevLog != null ? r.quantityCurrentPrevLog : '-') + '</td>' +
            '<td>' + (r.quantityCurrentLog != null ? r.quantityCurrentLog : '-') + '</td>' +
            '<td>' + escapeHtml(r.usuarioAlterouNome || r.usuarioAlterouLog || '-') + '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function (err) {
        console.error('Error loading log:', err);
        if (resultsCount) resultsCount.textContent = '0 records';
        if (logTableBody) logTableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><p class="error-state">Error loading log.</p></td></tr>';
      });
  }

  if (searchLogBtn) searchLogBtn.addEventListener('click', loadLog);
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function () {
      if (filterLocationCode) filterLocationCode.value = '';
      if (filterProductCode) filterProductCode.value = '';
      if (filterEntryFrom) filterEntryFrom.value = '';
      if (filterEntryTo) filterEntryTo.value = '';
      if (resultsCount) resultsCount.textContent = '0 records';
      if (logTableBody) logTableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-search"></i><p>Use filters and click <strong>Search</strong> to load log records.</p></td></tr>';
    });
  }

  function setupHeaderDropdowns() {
    var usersMenuBtn = document.getElementById('usersMenuBtn');
    var usersDropdownMenu = document.getElementById('usersDropdownMenu');
    var productMenuBtn = document.getElementById('productMenuBtn');
    var productDropdownMenu = document.getElementById('productDropdownMenu');
    var applicationsMenuBtn = document.getElementById('applicationsMenuBtn');
    var applicationsDropdownMenu = document.getElementById('applicationsDropdownMenu');
    var locationMenuBtn = document.getElementById('locationMenuBtn');
    var locationDropdownMenu = document.getElementById('locationDropdownMenu');
    var locationProductMenuBtn = document.getElementById('locationProductMenuBtn');
    var locationProductDropdownMenu = document.getElementById('locationProductDropdownMenu');
    var movementMenuBtn = document.getElementById('movementMenuBtn');
    var movementDropdownMenu = document.getElementById('movementDropdownMenu');
    var pickingMenuBtn = document.getElementById('pickingMenuBtn');
    var pickingDropdownMenu = document.getElementById('pickingDropdownMenu');
    var customerMenuBtn = document.getElementById('customerMenuBtn');
    var customerDropdownMenu = document.getElementById('customerDropdownMenu');
    var helpMenuBtn = document.getElementById('helpMenuBtn');
    var helpDropdownMenu = document.getElementById('helpDropdownMenu');

    function closeAll() {
      [usersDropdownMenu, productDropdownMenu, applicationsDropdownMenu, locationDropdownMenu, locationProductDropdownMenu, movementDropdownMenu, pickingDropdownMenu, customerDropdownMenu, helpDropdownMenu].forEach(function (el) {
        if (el) el.setAttribute('aria-hidden', 'true');
      });
      [usersMenuBtn, productMenuBtn, applicationsMenuBtn, locationMenuBtn, locationProductMenuBtn, movementMenuBtn, pickingMenuBtn, customerMenuBtn, helpMenuBtn].forEach(function (el) {
        if (el) el.setAttribute('aria-expanded', 'false');
      });
    }
    if (usersMenuBtn && usersDropdownMenu) {
      usersMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = usersDropdownMenu.getAttribute('aria-hidden') !== 'true';
        usersDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        usersMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (productMenuBtn && productDropdownMenu) {
      productMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = productDropdownMenu.getAttribute('aria-hidden') !== 'true';
        productDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        productMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (applicationsMenuBtn && applicationsDropdownMenu) {
      applicationsMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = applicationsDropdownMenu.getAttribute('aria-hidden') !== 'true';
        applicationsDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        applicationsMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (locationMenuBtn && locationDropdownMenu) {
      locationMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = locationDropdownMenu.getAttribute('aria-hidden') !== 'true';
        locationDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        locationMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (locationProductMenuBtn && locationProductDropdownMenu) {
      locationProductMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = locationProductDropdownMenu.getAttribute('aria-hidden') !== 'true';
        locationProductDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        locationProductMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (movementMenuBtn && movementDropdownMenu) {
      movementMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = movementDropdownMenu.getAttribute('aria-hidden') !== 'true';
        movementDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        movementMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (pickingMenuBtn && pickingDropdownMenu) {
      pickingMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = pickingDropdownMenu.getAttribute('aria-hidden') !== 'true';
        pickingDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        pickingMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (customerMenuBtn && customerDropdownMenu) {
      customerMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = customerDropdownMenu.getAttribute('aria-hidden') !== 'true';
        customerDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        customerMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    if (helpMenuBtn && helpDropdownMenu) {
      helpMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        var open = helpDropdownMenu.getAttribute('aria-hidden') !== 'true';
        helpDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
        helpMenuBtn.setAttribute('aria-expanded', !open);
      });
    }
    var newProductBtn = document.getElementById('newProductBtn');
    var searchProductBtn = document.getElementById('searchProductBtn');
    if (newProductBtn) newProductBtn.addEventListener('click', function () { window.location.href = 'warehouse.html?action=new'; });
    if (searchProductBtn) searchProductBtn.addEventListener('click', function () { window.location.href = 'warehouse.html?action=search'; });
    document.addEventListener('click', closeAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHeaderDropdowns);
  } else {
  }
})();
