const API_COMPANIES = '/api/companies';

let companies = [];
let companiesFiltradas = [];
let hasSearched = false;

const TABLE_COLSPAN = 6;

const elements = {
  filterCompanyName: document.getElementById('filterCompanyName'),
  filterResponsibleName: document.getElementById('filterResponsibleName'),
  filterCompanyEmail: document.getElementById('filterCompanyEmail'),
  filterHasLogo: document.getElementById('filterHasLogo'),
  ordenarPor: document.getElementById('ordenarPor'),
  direcao: document.getElementById('direcao'),
  applyCompanyFiltersBtn: document.getElementById('applyCompanyFiltersBtn'),
  clearCompanyFiltersBtn: document.getElementById('clearCompanyFiltersBtn'),
  searchCompanyTableBody: document.getElementById('searchCompanyTableBody'),
  companyResultsCount: document.getElementById('companyResultsCount'),
  companyResultsTime: document.getElementById('companyResultsTime'),
  companyResultsSummary: document.getElementById('companyResultsSummary'),
  companyLoadingIndicator: document.getElementById('companyLoadingIndicator')
};

function escapeHtml(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCompanyLogo(company) {
  if (window.BrandImage) {
    const src = window.BrandImage.companyLogoSrc
      ? window.BrandImage.companyLogoSrc(company.id, company.logo)
      : (company.logo || (company.hasLogo ? `/api/companies/${encodeURIComponent(company.id)}/logo` : null));
    return window.BrandImage.renderBrandImageMarkup(src, company.name, 'brand-image--table');
  }
  return escapeHtml(company.name || '—');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.DoubleYHeaderMenu) {
    window.DoubleYHeaderMenu.ensure();
    window.DoubleYHeaderMenu.setupDropdowns();
  }

  setupEventListeners();
  loadCompanies();
});

function setupEventListeners() {
  if (elements.applyCompanyFiltersBtn) {
    elements.applyCompanyFiltersBtn.addEventListener('click', aplicarFiltros);
  }
  if (elements.clearCompanyFiltersBtn) {
    elements.clearCompanyFiltersBtn.addEventListener('click', limparFiltros);
  }

  const filterInputs = [
    elements.filterCompanyName,
    elements.filterResponsibleName,
    elements.filterCompanyEmail,
    elements.filterHasLogo,
    elements.ordenarPor,
    elements.direcao
  ];

  filterInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        aplicarFiltros();
      }
    });
  });
}

async function loadCompanies() {
  try {
    showLoading(true);
    const response = await fetch(API_COMPANIES);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error loading companies');
    }

    companies = Array.isArray(result.data) ? result.data : [];
    companiesFiltradas = [];
    hasSearched = false;
    renderInitialState();
  } catch (error) {
    console.error(error);
    showError('Error loading companies: ' + error.message);
    renderErrorState();
  } finally {
    showLoading(false);
  }
}

function limparFiltros() {
  if (elements.filterCompanyName) elements.filterCompanyName.value = '';
  if (elements.filterResponsibleName) elements.filterResponsibleName.value = '';
  if (elements.filterCompanyEmail) elements.filterCompanyEmail.value = '';
  if (elements.filterHasLogo) elements.filterHasLogo.value = '';
  if (elements.ordenarPor) elements.ordenarPor.value = 'name';
  if (elements.direcao) elements.direcao.value = 'asc';
  if (elements.companyResultsTime) elements.companyResultsTime.textContent = '';

  hasSearched = false;
  companiesFiltradas = [];
  renderInitialState();
}

function renderEmptyState(message) {
  if (!elements.searchCompanyTableBody) return;
  elements.searchCompanyTableBody.innerHTML = `
    <tr>
      <td colspan="${TABLE_COLSPAN}" class="empty-state">
        <i class="fas fa-search"></i>
        <p>${message}</p>
      </td>
    </tr>
  `;
}

function renderInitialState() {
  renderEmptyState('Use the filters above and click <strong>Search</strong> to load companies.');
  updateResultsInfo();
  updateResultsSummary();
}

function renderErrorState() {
  renderEmptyState('Unable to load companies. Please refresh the page and try again.');
  updateResultsInfo();
  updateResultsSummary();
}

function aplicarFiltros() {
  hasSearched = true;
  const startTime = performance.now();

  const filtros = {
    name: elements.filterCompanyName ? elements.filterCompanyName.value.toLowerCase().trim() : '',
    responsible: elements.filterResponsibleName ? elements.filterResponsibleName.value.toLowerCase().trim() : '',
    email: elements.filterCompanyEmail ? elements.filterCompanyEmail.value.toLowerCase().trim() : '',
    hasLogo: elements.filterHasLogo ? elements.filterHasLogo.value : ''
  };

  companiesFiltradas = companies.filter((company) => {
    if (filtros.name && (!company.name || !company.name.toLowerCase().includes(filtros.name))) {
      return false;
    }

    if (filtros.responsible) {
      const responsible = company.responsibleName ? company.responsibleName.toLowerCase() : '';
      if (!responsible.includes(filtros.responsible)) {
        return false;
      }
    }

    if (filtros.email) {
      const email = company.email ? company.email.toLowerCase() : '';
      if (!email.includes(filtros.email)) {
        return false;
      }
    }

    if (filtros.hasLogo === 'true' && !company.hasLogo) {
      return false;
    }

    if (filtros.hasLogo === 'false' && company.hasLogo) {
      return false;
    }

    return true;
  });

  aplicarOrdenacao();

  const searchTime = Math.round(performance.now() - startTime);
  if (elements.companyResultsTime) {
    elements.companyResultsTime.textContent = `Search completed in ${searchTime}ms`;
  }
}

function aplicarOrdenacao() {
  const campo = elements.ordenarPor && elements.ordenarPor.value ? elements.ordenarPor.value : 'name';
  const direcao = elements.direcao && elements.direcao.value ? elements.direcao.value : 'asc';

  companiesFiltradas.sort((a, b) => {
    let valorA = a[campo];
    let valorB = b[campo];

    if (valorA == null) valorA = '';
    if (valorB == null) valorB = '';

    if (typeof valorA === 'string') valorA = valorA.toLowerCase();
    if (typeof valorB === 'string') valorB = valorB.toLowerCase();

    if (campo === 'criadoEm') {
      valorA = new Date(valorA);
      valorB = new Date(valorB);
    }

    if (direcao === 'asc') {
      return valorA > valorB ? 1 : -1;
    }
    return valorA < valorB ? 1 : -1;
  });

  renderResults();
}

function renderResults() {
  if (!elements.searchCompanyTableBody) return;

  if (!hasSearched) {
    renderInitialState();
    return;
  }

  if (!companiesFiltradas.length) {
    renderEmptyState('No companies found. Adjust the filters or <a href="New-Company.html">register a new company</a>.');
  } else {
    elements.searchCompanyTableBody.innerHTML = companiesFiltradas
      .map((company) => createCompanyRowHTML(company))
      .join('');
  }

  updateResultsInfo();
  updateResultsSummary();
}

function createCompanyRowHTML(company) {
  const id = escapeHtml(company.id || '');

  return `
    <tr data-id="${id}">
      <td>
        <div class="search-users-name-cell">
          ${renderCompanyLogo(company)}
          <strong>${escapeHtml(company.name || '—')}</strong>
        </div>
      </td>
      <td>${escapeHtml(company.responsibleName || '—')}</td>
      <td>${escapeHtml(company.email || '—')}</td>
      <td>${escapeHtml(company.phone || '—')}</td>
      <td>${escapeHtml(company.address || '—')}</td>
      <td class="td-actions">
        <div class="search-users-actions">
          <a href="New-Company.html?edit=${encodeURIComponent(company.id)}" class="btn btn-action btn-edit btn btn-sm btn-outline" title="Edit">
            <i class="fas fa-edit"></i> Edit
          </a>
        </div>
      </td>
    </tr>
  `;
}

function updateResultsInfo() {
  const total = hasSearched ? companiesFiltradas.length : 0;
  if (elements.companyResultsCount) {
    elements.companyResultsCount.textContent = `${total} compan${total === 1 ? 'y' : 'ies'}`;
  }
}

function updateResultsSummary() {
  if (!elements.companyResultsSummary) return;

  if (!hasSearched) {
    elements.companyResultsSummary.hidden = true;
    elements.companyResultsSummary.innerHTML = '';
    return;
  }

  const withLogo = companiesFiltradas.filter((company) => company.hasLogo).length;
  const withoutLogo = companiesFiltradas.length - withLogo;

  elements.companyResultsSummary.innerHTML = `
    <span class="search-users-chip"><i class="fas fa-industry"></i> ${companiesFiltradas.length} matched</span>
    <span class="search-users-chip is-active"><i class="fas fa-image"></i> ${withLogo} with logo</span>
    <span class="search-users-chip is-inactive"><i class="fas fa-image"></i> ${withoutLogo} without logo</span>
  `;
  elements.companyResultsSummary.hidden = false;
}

function showLoading(show) {
  if (elements.companyLoadingIndicator) {
    elements.companyLoadingIndicator.style.display = show ? 'block' : 'none';
  }
}

function showError(message) {
  console.error('❌', message);
  alert('Error: ' + message);
}
