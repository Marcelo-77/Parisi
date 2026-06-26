const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_CUSTOMERS = API_BASE + '/api/customers';

function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'search' ? 'search' : 'new';
}

function showSection() {
  const mode = getMode();
  const newSection = document.getElementById('newCustomerSection');
  const searchSection = document.getElementById('searchCustomerSection');
  const titleEl = document.getElementById('customerPageTitle');
  if (mode === 'search') {
    if (newSection) newSection.style.display = 'none';
    if (searchSection) searchSection.style.display = 'block';
    if (titleEl) titleEl.textContent = 'Search Customer';
  } else {
    if (newSection) newSection.style.display = 'block';
    if (searchSection) searchSection.style.display = 'none';
    if (titleEl) titleEl.textContent = 'New Customer';
  }
}

function setupHeaderDropdowns() {
  const dropdowns = [
    ['usersMenuBtn', 'usersDropdownMenu'],
    ['productMenuBtn', 'productDropdownMenu'],
    ['applicationsMenuBtn', 'applicationsDropdownMenu'],
    ['locationMenuBtn', 'locationDropdownMenu'],
    ['locationProductMenuBtn', 'locationProductDropdownMenu'],
    ['movementMenuBtn', 'movementDropdownMenu'],
    ['pickingMenuBtn', 'pickingDropdownMenu'],
    ['helpMenuBtn', 'helpDropdownMenu'],
    ['customerMenuBtn', 'customerDropdownMenu']
  ];
  const buttons = {};
  const menus = {};
  dropdowns.forEach(([btnId, menuId]) => {
    buttons[btnId] = document.getElementById(btnId);
    menus[menuId] = document.getElementById(menuId);
  });

  function closeAll() {
    Object.values(menus).forEach(el => { if (el) el.setAttribute('aria-hidden', 'true'); });
    Object.values(buttons).forEach(el => { if (el) el.setAttribute('aria-expanded', 'false'); });
  }

  Object.keys(buttons).forEach(btnId => {
    const btn = buttons[btnId];
    const menuId = btnId.replace('MenuBtn', 'DropdownMenu');
    const menu = menus[menuId];
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        const open = menu.getAttribute('aria-hidden') !== 'true';
        menu.setAttribute('aria-hidden', open ? 'true' : 'false');
        btn.setAttribute('aria-expanded', !open);
      });
    }
  });

  document.addEventListener('click', closeAll);

  const newProductBtn = document.getElementById('newProductBtn');
  const searchProductBtn = document.getElementById('searchProductBtn');
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function submitNewCustomer(e) {
  e.preventDefault();
  const custNmCustomer = document.getElementById('newCustNmCustomer') && document.getElementById('newCustNmCustomer').value.trim();
  const custCdCode = document.getElementById('newCustCdCode') && document.getElementById('newCustCdCode').value.trim();
  const custDsAddress = document.getElementById('newCustDsAddress') && document.getElementById('newCustDsAddress').value.trim();
  if (!custNmCustomer && !custCdCode) {
    alert('Please enter Customer Name or Code.');
    return;
  }

  const saveBtn = document.getElementById('saveCustomerBtn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const res = await fetch(API_CUSTOMERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custNmCustomer: custNmCustomer || undefined,
        custCdCode: custCdCode || undefined,
        custDsAddress: custDsAddress || undefined
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Customer saved successfully.');
      document.getElementById('newCustomerForm').reset();
    } else {
      alert(data.message || data.error || 'Error saving customer.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error. Please try again.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function searchCustomers() {
  const custNmCustomer = document.getElementById('filterCustNmCustomer') && document.getElementById('filterCustNmCustomer').value.trim();
  const custCdCode = document.getElementById('filterCustCdCode') && document.getElementById('filterCustCdCode').value.trim();

  const params = new URLSearchParams();
  if (custNmCustomer) params.set('custNmCustomer', custNmCustomer);
  if (custCdCode) params.set('custCdCode', custCdCode);

  const tbody = document.getElementById('searchCustomerTableBody');
  const countEl = document.getElementById('customerResultsCount');
  try {
    const res = await fetch(API_CUSTOMERS + '?' + params.toString());
    const data = await res.json();
    const list = (data.success && data.data) ? data.data : [];
    if (countEl) countEl.textContent = list.length + ' record(s)';

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No customers found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <td>${escapeHtml(c.custCdId)}</td>
        <td>${escapeHtml(c.custNmCustomer || '-')}</td>
        <td>${escapeHtml(c.custCdCode || '-')}</td>
        <td>${escapeHtml(c.custDsAddress || '-')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    if (countEl) countEl.textContent = '0 records';
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading customers.</td></tr>';
  }
}

function clearCustomerFilters() {
  const nameEl = document.getElementById('filterCustNmCustomer');
  const codeEl = document.getElementById('filterCustCdCode');
  if (nameEl) nameEl.value = '';
  if (codeEl) codeEl.value = '';
  document.getElementById('searchCustomerTableBody').innerHTML = '<tr><td colspan="4" class="empty-state">Use filters and click Search to load customers.</td></tr>';
  document.getElementById('customerResultsCount').textContent = '0 records';
}

document.addEventListener('DOMContentLoaded', () => {
  showSection();

  document.getElementById('newCustomerForm').addEventListener('submit', submitNewCustomer);
  document.getElementById('applyCustomerFiltersBtn').addEventListener('click', searchCustomers);
  document.getElementById('clearCustomerFiltersBtn').addEventListener('click', clearCustomerFilters);
});
