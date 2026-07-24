(function () {
  const STANDARD_HEADER_MENU_HTML = `
                    <div class="users-dropdown">
                        <button type="button" class="btn btn-primary" id="usersMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-users"></i> Users <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="users-dropdown-menu" id="usersDropdownMenu" aria-hidden="true">
                            <a href="users.html" class="dropdown-item" data-app="users.html"><i class="fas fa-user-plus"></i> New User</a>
                            <a href="pesquisa.html" class="dropdown-item" data-app="pesquisa.html"><i class="fas fa-search"></i> Search User</a>
                            <a href="change-password.html" class="dropdown-item" data-app="change-password.html" data-always-accessible="true"><i class="fas fa-key"></i> Change Password</a>
                        </div>
                    </div>
                    <div class="master-data-dropdown">
                        <button type="button" class="btn btn-primary" id="masterDataMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-database"></i> Master Data <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="master-data-dropdown-menu" id="masterDataDropdownMenu" aria-hidden="true">
                            <div class="dropdown-submenu-group" data-submenu="customer">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-user"></i> Customer</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <a href="customer.html" class="dropdown-item" data-app="customer.html"><i class="fas fa-plus"></i> New Customer</a>
                                    <a href="customer.html?mode=search" class="dropdown-item" data-app="customer.html"><i class="fas fa-search"></i> Search Customer</a>
                                </div>
                            </div>
                            <div class="dropdown-submenu-group" data-submenu="product">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-box"></i> Product</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <button type="button" id="newProductBtn" class="dropdown-item" data-app="warehouse.html"><i class="fas fa-plus"></i> New Product</button>
                                    <button type="button" id="searchProductBtn" class="dropdown-item" data-app="warehouse.html"><i class="fas fa-search"></i> Search Product</button>
                                    <a href="special-search-product.html" class="dropdown-item" data-app="special-search-product.html"><i class="fas fa-map"></i> Special Search Product</a>
                                </div>
                            </div>
                            <div class="dropdown-submenu-group" data-submenu="location">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-map-marker-alt"></i> Location</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <a href="location.html" class="dropdown-item" data-app="location.html"><i class="fas fa-plus"></i> New Location</a>
                                    <a href="location-search.html" class="dropdown-item" data-app="location-search.html"><i class="fas fa-search"></i> Search Location</a>
                                    <a href="location-smart.html" class="dropdown-item" data-app="location-smart.html"><i class="fas fa-wand-magic-sparkles"></i> Location Smart</a>
                                    <a href="location-product.html" class="dropdown-item" data-app="location-product.html"><i class="fas fa-boxes-stacked"></i> Location Product</a>
                                    <a href="log-location-product.html" class="dropdown-item" data-app="log-location-product.html"><i class="fas fa-history"></i> Log Location Product</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="applications-dropdown">
                        <button type="button" class="btn btn-primary" id="applicationsMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-window-restore"></i> Applications <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="applications-dropdown-menu" id="applicationsDropdownMenu" aria-hidden="true">
                            <div class="dropdown-submenu-group" data-submenu="applications-registry">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-window-restore"></i> Applications</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <a href="applications.html" class="dropdown-item" data-app="applications.html"><i class="fas fa-plus"></i> New Applications</a>
                                    <a href="applications.html?mode=search" class="dropdown-item" data-app="applications.html"><i class="fas fa-search"></i> Search Applications</a>
                                    <a href="application_users.html" class="dropdown-item" data-app="application_users.html"><i class="fas fa-user-cog"></i> Application Users</a>
                                    <a href="logged-in-users.html" class="dropdown-item" data-app="logged-in-users.html"><i class="fas fa-user-clock"></i> Logged-in Users</a>
                                </div>
                            </div>
                            <a href="upload-warehouse-map.html" class="dropdown-item" data-app="upload-warehouse-map.html"><i class="fas fa-upload"></i> Upload Warehouse Map</a>
                            <div class="dropdown-submenu-group" data-submenu="system-documentation">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-book"></i> System Documentation</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <a href="System-Documentation.html" class="dropdown-item" data-app="System-Documentation.html"><i class="fas fa-plus"></i> New System Documentation</a>
                                    <a href="System-Documentation-Search.html" class="dropdown-item" data-app="System-Documentation-Search.html"><i class="fas fa-search"></i> Search System Documentation</a>
                                </div>
                            </div>
                            <a href="System-settings.html" class="dropdown-item" data-app="System-settings.html"><i class="fas fa-sliders-h"></i> System Settings</a>
                            <div class="dropdown-submenu-group" data-submenu="news">
                                <button type="button" class="dropdown-submenu-trigger" aria-haspopup="true" aria-expanded="false">
                                    <span><i class="fas fa-newspaper"></i> News</span>
                                    <i class="fas fa-chevron-right submenu-chevron" aria-hidden="true"></i>
                                </button>
                                <div class="dropdown-submenu" aria-hidden="true">
                                    <a href="News.html" class="dropdown-item" data-app="News.html"><i class="fas fa-plus"></i> News</a>
                                    <a href="News-Search.html" class="dropdown-item" data-app="News-Search.html"><i class="fas fa-search"></i> Search News</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="movement-dropdown">
                        <button type="button" class="btn btn-primary" id="movementMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-exchange-alt"></i> Movement <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="movement-dropdown-menu" id="movementDropdownMenu" aria-hidden="true">
                            <a href="movement.html" class="dropdown-item" data-app="movement.html"><i class="fas fa-plus"></i> New Movement</a>
                            <a href="movement.html?mode=search" class="dropdown-item" data-app="movement.html"><i class="fas fa-search"></i> Search Movement</a>
                            <a href="movement-situation.html" class="dropdown-item" data-app="movement-situation.html"><i class="fas fa-stream"></i> Situation of the Movement</a>
                        </div>
                    </div>
                    <div class="picking-dropdown">
                        <button type="button" class="btn btn-primary" id="pickingMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-dolly"></i> Picking <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="picking-dropdown-menu" id="pickingDropdownMenu" aria-hidden="true">
                            <a href="picking.html" class="dropdown-item" data-app="picking.html"><i class="fas fa-list"></i> Picking List</a>
                            <a href="picking.html?mode=search" class="dropdown-item" data-app="picking.html"><i class="fas fa-search"></i> Order Sent for Picking</a>
                            <a href="separation-picking.html" class="dropdown-item" data-app="separation-picking.html"><i class="fas fa-box-open"></i> Separation and Picking</a>
                            <a href="double-checking.html" class="dropdown-item" data-app="double-checking.html"><i class="fas fa-clipboard-check"></i> Sent for Double Checking</a>
                        </div>
                    </div>
                    <div class="church-dropdown">
                        <button type="button" class="btn btn-primary" id="churchMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-church"></i> Church <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="church-dropdown-menu" id="churchDropdownMenu" aria-hidden="true">
                            <a href="Order_of_Service.html" class="dropdown-item" data-app="Order_of_Service.html"><i class="fas fa-file-lines"></i> Order of Service</a>
                            <a href="Order_of_Service_Search.html" class="dropdown-item" data-app="Order_of_Service_Search.html"><i class="fas fa-search"></i> Search Order of Service</a>
                        </div>
                    </div>
                    <div class="help-dropdown">
                        <button type="button" class="btn btn-primary" id="helpMenuBtn" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-circle-question"></i> Help <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="help-dropdown-menu" id="helpDropdownMenu" aria-hidden="true">
                            <a href="help.html" class="dropdown-item" data-app="help.html"><i class="fas fa-book"></i> Help Center</a>
                            <a href="help.html#modules" class="dropdown-item" data-app="help.html"><i class="fas fa-th-large"></i> System Modules</a>
                            <a href="help.html#picking" class="dropdown-item" data-app="help.html"><i class="fas fa-dolly"></i> Picking Workflow</a>
                            <a href="help.html#qrcode" class="dropdown-item" data-app="help.html"><i class="fas fa-qrcode"></i> Generate QR Code</a>
                        </div>
                    </div>
                    <button type="button" class="btn btn-primary system-exit-btn" id="exitSystemBtn" data-always-accessible="true" title="Exit system">
                        <i class="fas fa-right-from-bracket"></i> Exit
                    </button>`;

  const MENU_BUTTON_IDS = [
    'usersMenuBtn',
    'masterDataMenuBtn',
    'applicationsMenuBtn',
    'movementMenuBtn',
    'pickingMenuBtn',
    'churchMenuBtn',
    'helpMenuBtn'
  ];

  function closeAllSubmenus() {
    document.querySelectorAll('.dropdown-submenu-group.is-open').forEach((group) => {
      group.classList.remove('is-open');
      const trigger = group.querySelector('.dropdown-submenu-trigger');
      const submenu = group.querySelector('.dropdown-submenu');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (submenu) submenu.setAttribute('aria-hidden', 'true');
    });
  }

  function closeAllHeaderMenus() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    closeAllSubmenus();

    MENU_BUTTON_IDS.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      const menuId = btnId.replace('MenuBtn', 'DropdownMenu');
      const menu = document.getElementById(menuId);
      if (menu) menu.setAttribute('aria-hidden', 'true');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function ensureStandardHeaderMenu() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return null;
    headerActions.innerHTML = STANDARD_HEADER_MENU_HTML;
    headerActions.setAttribute('data-standard-menu', 'true');
    headerActions.removeAttribute('data-dropdowns-ready');
    return headerActions;
  }

  function setupHeaderDropdowns() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    if (headerActions.getAttribute('data-dropdowns-ready') === 'true') return;

    if (headerActions._doubleyMenuClickHandler) {
      headerActions.removeEventListener('click', headerActions._doubleyMenuClickHandler);
    }

    const clickHandler = (event) => {
      const submenuTrigger = event.target.closest('.dropdown-submenu-trigger');
      if (submenuTrigger) {
        event.stopPropagation();
        const group = submenuTrigger.closest('.dropdown-submenu-group');
        if (!group) return;

        const submenu = group.querySelector('.dropdown-submenu');
        const isOpen = group.classList.contains('is-open');

        document.querySelectorAll('.dropdown-submenu-group.is-open').forEach((openGroup) => {
          if (openGroup !== group) {
            openGroup.classList.remove('is-open');
            const openTrigger = openGroup.querySelector('.dropdown-submenu-trigger');
            const openSubmenu = openGroup.querySelector('.dropdown-submenu');
            if (openTrigger) openTrigger.setAttribute('aria-expanded', 'false');
            if (openSubmenu) openSubmenu.setAttribute('aria-hidden', 'true');
          }
        });

        group.classList.toggle('is-open', !isOpen);
        submenuTrigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (submenu) submenu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        return;
      }

      const menuBtn = event.target.closest('.header-actions [id$="MenuBtn"]');
      if (menuBtn) {
        event.stopPropagation();
        const menuId = menuBtn.id.replace('MenuBtn', 'DropdownMenu');
        const menu = document.getElementById(menuId);
        if (!menu) return;

        const isOpen = menu.getAttribute('aria-hidden') !== 'true';
        closeAllHeaderMenus();
        menu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        menuBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        return;
      }

      const newProductBtn = event.target.closest('#newProductBtn');
      if (newProductBtn) {
        event.stopPropagation();
        window.location.href = 'warehouse.html?action=new';
        return;
      }

      const searchProductBtn = event.target.closest('#searchProductBtn');
      if (searchProductBtn) {
        event.stopPropagation();
        window.location.href = 'warehouse.html?action=search';
      }
    };

    headerActions.addEventListener('click', clickHandler);
    headerActions._doubleyMenuClickHandler = clickHandler;

    if (!window.__doubleyHeaderMenuDocClick) {
      document.addEventListener('click', closeAllHeaderMenus);
      window.__doubleyHeaderMenuDocClick = true;
    }

    headerActions.setAttribute('data-dropdowns-ready', 'true');
  }

  window.DoubleYHeaderMenu = {
    ensure: ensureStandardHeaderMenu,
    setupDropdowns: setupHeaderDropdowns,
    closeAll: closeAllHeaderMenus
  };

  window.setupHeaderDropdowns = setupHeaderDropdowns;
})();
