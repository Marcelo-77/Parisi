// API configuration
const API_BASE_URL = '/api/funcionarios';

// Application state
let funcionarios = [];
let funcionariosFiltrados = [];
let currentView = 'list';
let currentSort = { campo: 'nome', direcao: 'asc' };
let funcionarioSelecionado = null;

// DOM elements
const elements = {
    // Filters
    searchNome: document.getElementById('searchNome'),
    searchEmail: document.getElementById('searchEmail'),
    searchCargo: document.getElementById('searchCargo'),
    searchDepartamento: document.getElementById('searchDepartamento'),
    searchStatus: document.getElementById('searchStatus'),
    searchDataInicio: document.getElementById('searchDataInicio'),
    searchDataFim: document.getElementById('searchDataFim'),
    limparFiltros: document.getElementById('limparFiltros'),
    pesquisar: document.getElementById('pesquisar'),
    ordenarPor: document.getElementById('ordenarPor'),
    direcao: document.getElementById('direcao'),
    // Results (tabela igual warehouse)
    resultsCount: document.getElementById('resultsCount'),
    resultsTime: document.getElementById('resultsTime'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    employeesTableBody: document.getElementById('employeesTableBody'),
    noResults: document.getElementById('noResults'),
    // Modals
    funcionarioModal: document.getElementById('funcionarioModal'),
    funcionarioDetails: document.getElementById('funcionarioDetails'),
    deleteModal: document.getElementById('deleteModal'),
    deleteFuncionarioInfo: document.getElementById('deleteFuncionarioInfo'),
    editFuncionario: document.getElementById('editFuncionario'),
    confirmDelete: document.getElementById('confirmDelete')
};

function escapeHtml(text) {
    if (text == null || text === '') return '';
    const s = String(text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupHeaderDropdowns();
    loadFuncionarios();
});

// Set up event listeners
function setupEventListeners() {
    if (elements.limparFiltros) elements.limparFiltros.addEventListener('click', limparFiltros);
    if (elements.pesquisar) elements.pesquisar.addEventListener('click', aplicarFiltros);
    if (elements.ordenarPor) elements.ordenarPor.addEventListener('change', () => { aplicarFiltros(); });
    if (elements.direcao) elements.direcao.addEventListener('change', () => { aplicarFiltros(); });
    if (elements.editFuncionario) elements.editFuncionario.addEventListener('click', editarFuncionario);
    if (elements.confirmDelete) elements.confirmDelete.addEventListener('click', confirmarExclusao);
    // Row action buttons (View / Edit / Delete) via event delegation na tabela
    if (elements.employeesTableBody) elements.employeesTableBody.addEventListener('click', handleResultsClick);
    
    // Close modals (overlay click)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    // Close modal buttons
    const closeFuncionarioModalEl = document.getElementById('closeFuncionarioModal');
    const closeFuncionarioModalBtnEl = document.getElementById('closeFuncionarioModalBtn');
    if (closeFuncionarioModalEl) closeFuncionarioModalEl.addEventListener('click', () => closeModal('funcionarioModal'));
    if (closeFuncionarioModalBtnEl) closeFuncionarioModalBtnEl.addEventListener('click', () => closeModal('funcionarioModal'));
    const closeDeleteModalEl = document.getElementById('closeDeleteModal');
    const cancelDeleteModalEl = document.getElementById('cancelDeleteModal');
    if (closeDeleteModalEl) closeDeleteModalEl.addEventListener('click', () => closeModal('deleteModal'));
    if (cancelDeleteModalEl) cancelDeleteModalEl.addEventListener('click', () => closeModal('deleteModal'));
    
    // Live search
    [elements.searchNome, elements.searchEmail, elements.searchCargo].forEach(input => {
        input.addEventListener('input', debounce(aplicarFiltros, 300));
    });
    
    // Select filters
    [elements.searchDepartamento, elements.searchStatus].forEach(select => {
        select.addEventListener('change', aplicarFiltros);
    });
}

// Header dropdowns (same layout as warehouse.html)
function setupHeaderDropdowns() {
    const usersMenuBtn = document.getElementById('usersMenuBtn');
    const usersDropdownMenu = document.getElementById('usersDropdownMenu');
    const productMenuBtn = document.getElementById('productMenuBtn');
    const productDropdownMenu = document.getElementById('productDropdownMenu');
    const applicationsMenuBtn = document.getElementById('applicationsMenuBtn');
    const applicationsDropdownMenu = document.getElementById('applicationsDropdownMenu');
    const locationMenuBtn = document.getElementById('locationMenuBtn');
    const locationDropdownMenu = document.getElementById('locationDropdownMenu');
    const locationProductMenuBtn = document.getElementById('locationProductMenuBtn');
    const locationProductDropdownMenu = document.getElementById('locationProductDropdownMenu');
    const movementMenuBtn = document.getElementById('movementMenuBtn');
    const movementDropdownMenu = document.getElementById('movementDropdownMenu');
    const pickingMenuBtn = document.getElementById('pickingMenuBtn');
    const pickingDropdownMenu = document.getElementById('pickingDropdownMenu');
    const helpMenuBtn = document.getElementById('helpMenuBtn');
    const helpDropdownMenu = document.getElementById('helpDropdownMenu');

    function closeAllDropdowns() {
        [usersDropdownMenu, productDropdownMenu, applicationsDropdownMenu, locationDropdownMenu, locationProductDropdownMenu, movementDropdownMenu, pickingDropdownMenu, helpDropdownMenu].forEach(el => {
            if (el) el.setAttribute('aria-hidden', 'true');
        });
        [usersMenuBtn, productMenuBtn, applicationsMenuBtn, locationMenuBtn, locationProductMenuBtn, movementMenuBtn, pickingMenuBtn, helpMenuBtn].forEach(el => {
            if (el) el.setAttribute('aria-expanded', 'false');
        });
    }

    if (usersMenuBtn && usersDropdownMenu) {
        usersMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = usersDropdownMenu.getAttribute('aria-hidden') !== 'true';
            usersDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            usersMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (productMenuBtn && productDropdownMenu) {
        productMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = productDropdownMenu.getAttribute('aria-hidden') !== 'true';
            productDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            productMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (applicationsMenuBtn && applicationsDropdownMenu) {
        applicationsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = applicationsDropdownMenu.getAttribute('aria-hidden') !== 'true';
            applicationsDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            applicationsMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (locationMenuBtn && locationDropdownMenu) {
        locationMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = locationDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (locationProductMenuBtn && locationProductDropdownMenu) {
        locationProductMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = locationProductDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationProductDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationProductMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (movementMenuBtn && movementDropdownMenu) {
        movementMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = movementDropdownMenu.getAttribute('aria-hidden') !== 'true';
            movementDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            movementMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (pickingMenuBtn && pickingDropdownMenu) {
        pickingMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = pickingDropdownMenu.getAttribute('aria-hidden') !== 'true';
            pickingDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            pickingMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (helpMenuBtn && helpDropdownMenu) {
        helpMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            const open = helpDropdownMenu.getAttribute('aria-hidden') !== 'true';
            helpDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            helpMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    // Product dropdown: on pesquisa page, New/Search Product go to warehouse
    const newProductBtn = document.getElementById('newProductBtn');
    const searchProductBtn = document.getElementById('searchProductBtn');
    if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=new'; });
    if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html?action=search'; });

    document.addEventListener('click', closeAllDropdowns);
}

// Handle clicks on View / Edit / Delete buttons via delegation on table
function handleResultsClick(event) {
    const actionButton = event.target.closest('.btn-action');
    if (!actionButton) return;
    const row = event.target.closest('tr');
    if (!row || !row.dataset.id) return;
    const id = row.dataset.id;
    if (actionButton.classList.contains('btn-view')) {
        verDetalhes(id);
    } else if (actionButton.classList.contains('btn-edit')) {
        editarFuncionario(id);
    } else if (actionButton.classList.contains('btn-delete')) {
        excluirFuncionario(id);
    }
}

// Load employees
async function loadFuncionarios() {
    try {
        showLoading(true);
        const response = await fetch(API_BASE_URL);
        const data = await response.json();
        
        if (data.success) {
            funcionarios = data.data;
            funcionariosFiltrados = [...funcionarios];
            renderResults();
            updateResultsInfo();
        } else {
            throw new Error(data.error || 'Error loading employees');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        showError('Error loading employees: ' + error.message);
    } finally {
        showLoading(false);
    }
}


// Clear filters
function limparFiltros() {
    elements.searchNome.value = '';
    elements.searchEmail.value = '';
    elements.searchCargo.value = '';
    elements.searchDepartamento.value = '';
    elements.searchStatus.value = '';
    elements.searchDataInicio.value = '';
    elements.searchDataFim.value = '';
    
    aplicarFiltros();
}

// Apply filters
function aplicarFiltros() {
    const startTime = performance.now();
    
    const filtros = {
        nome: elements.searchNome.value.toLowerCase().trim(),
        email: elements.searchEmail.value.toLowerCase().trim(),
        cargo: elements.searchCargo.value.toLowerCase().trim(),
        departamento: elements.searchDepartamento.value,
        status: elements.searchStatus.value,
        dataInicio: elements.searchDataInicio.value,
        dataFim: elements.searchDataFim.value
    };
    
    funcionariosFiltrados = funcionarios.filter(funcionario => {
        // Name filter
        if (filtros.nome && !funcionario.nome.toLowerCase().includes(filtros.nome)) {
            return false;
        }
        
        // Email filter
        if (filtros.email && !funcionario.email.toLowerCase().includes(filtros.email)) {
            return false;
        }
        
        // Position filter
        if (filtros.cargo && !funcionario.cargo.toLowerCase().includes(filtros.cargo)) {
            return false;
        }
        
        // Department filter
        if (filtros.departamento && funcionario.departamento !== filtros.departamento) {
            return false;
        }
        
        // Status filter
        if (filtros.status && funcionario.ativo.toString() !== filtros.status) {
            return false;
        }
        
        // Hire date filter
        if (filtros.dataInicio && funcionario.dataAdmissao < filtros.dataInicio) {
            return false;
        }
        if (filtros.dataFim && funcionario.dataAdmissao > filtros.dataFim) {
            return false;
        }
        
        return true;
    });
    
    aplicarOrdenacao();
    
    const endTime = performance.now();
    const searchTime = Math.round(endTime - startTime);
    elements.resultsTime.textContent = `Search completed in ${searchTime}ms`;
}

// Apply sorting
function aplicarOrdenacao() {
    const campo = (elements.ordenarPor && elements.ordenarPor.value) ? elements.ordenarPor.value : 'nome';
    const direcao = (elements.direcao && elements.direcao.value) ? elements.direcao.value : 'asc';
    
    currentSort = { campo, direcao };
    
    funcionariosFiltrados.sort((a, b) => {
        let valorA = a[campo];
        let valorB = b[campo];
        
        // Handle null/undefined values
        if (valorA == null) valorA = '';
        if (valorB == null) valorB = '';
        
        // Convert to string if needed
        if (typeof valorA === 'string') valorA = valorA.toLowerCase();
        if (typeof valorB === 'string') valorB = valorB.toLowerCase();
        
        // Convert dates
        if (campo === 'dataAdmissao' || campo === 'criadoEm') {
            valorA = new Date(valorA);
            valorB = new Date(valorB);
        }
        
        if (direcao === 'asc') {
            return valorA > valorB ? 1 : -1;
        } else {
            return valorA < valorB ? 1 : -1;
        }
    });
    
    renderResults();
}

// Render results (tabela logo abaixo do filtro, igual warehouse)
function renderResults() {
    if (!elements.employeesTableBody) return;
    if (funcionariosFiltrados.length === 0) {
        elements.employeesTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state" id="emptyStateRow">
                    <i class="fas fa-search"></i>
                    <p>No employees found. Use filters and click <strong>Search</strong>, or <a href="users.html">register a new user</a>.</p>
                </td>
            </tr>
        `;
        if (elements.noResults) elements.noResults.style.display = 'none';
    } else {
        if (elements.noResults) elements.noResults.style.display = 'none';
        const html = funcionariosFiltrados.map(f => createFuncionarioRowHTML(f)).join('');
        elements.employeesTableBody.innerHTML = html;
    }
    updateResultsInfo();
}

// Create table row HTML (igual warehouse: uma linha por funcionário)
function createFuncionarioRowHTML(funcionario) {
    const statusClass = funcionario.ativo ? 'ativo' : 'inativo';
    const statusText = funcionario.ativo ? 'Active' : 'Inactive';
    const hireDate = funcionario.dataAdmissao ? formatDate(funcionario.dataAdmissao) : '-';
    const id = String(funcionario.id || '').replace(/"/g, '&quot;');
    return `
        <tr data-id="${id}">
            <td>${escapeHtml(funcionario.nome || '')}</td>
            <td>${escapeHtml(funcionario.email || '')}</td>
            <td>${escapeHtml(funcionario.cargo || '')}</td>
            <td>${escapeHtml(funcionario.departamento || '')}</td>
            <td>${hireDate}</td>
            <td><span class="status-badge ${statusClass}"><i class="fas fa-circle"></i> ${statusText}</span></td>
            <td>
                <button type="button" class="btn-action btn-view btn btn-sm btn-outline" title="View"><i class="fas fa-eye"></i></button>
                <button type="button" class="btn-action btn-edit btn btn-sm btn-outline" title="Edit"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn-action btn-delete btn btn-sm btn-outline" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `;
}

// Update results info
function updateResultsInfo() {
    const total = funcionariosFiltrados.length;
    if (elements.resultsCount) {
        elements.resultsCount.textContent = `${total} employee${total !== 1 ? 's' : ''}`;
    }
}

// View employee details
function verDetalhes(id) {
    const funcionario = funcionarios.find(f => f.id === id);
    if (!funcionario) return;
    
    funcionarioSelecionado = funcionario;
    
    const iniciais = funcionario.nome.split(' ').map(n => n[0]).join('').toUpperCase();
    const statusClass = funcionario.ativo ? 'ativo' : 'inativo';
    const statusText = funcionario.ativo ? 'Active' : 'Inactive';
    
    elements.funcionarioDetails.innerHTML = `
        <div class="funcionario-details-modal">
            <div>
                <div class="funcionario-avatar-large">${iniciais}</div>
            </div>
            <div class="funcionario-info-large">
                <div class="info-group">
                    <div class="info-label">Full Name</div>
                    <div class="info-value">${funcionario.nome}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Email</div>
                    <div class="info-value">${funcionario.email}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${funcionario.telefone}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Position</div>
                    <div class="info-value">${funcionario.cargo}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Department</div>
                    <div class="info-value">${funcionario.departamento}</div>
                </div>
                ${funcionario.dataAdmissao ? `
                <div class="info-group">
                    <div class="info-label">Hire Date</div>
                    <div class="info-value">${new Date(funcionario.dataAdmissao).toLocaleDateString('pt-BR')}</div>
                </div>
                ` : ''}
                <div class="info-group">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <span class="status-badge ${statusClass}">
                            <i class="fas fa-circle"></i> ${statusText}
                        </span>
                    </div>
                </div>
                <div class="info-group">
                    <div class="info-label">ID</div>
                    <div class="info-value" style="font-family: monospace; font-size: 0.9rem;">${funcionario.id}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Created at</div>
                    <div class="info-value">${new Date(funcionario.criadoEm).toLocaleString('pt-BR')}</div>
                </div>
                <div class="info-group">
                    <div class="info-label">Last update</div>
                    <div class="info-value">${new Date(funcionario.atualizadoEm).toLocaleString('pt-BR')}</div>
                </div>
            </div>
        </div>
    `;
    
    openModal('funcionarioModal');
}

// Edit employee
function editarFuncionario(id) {
    const userId = id || (funcionarioSelecionado && funcionarioSelecionado.id);
    if (!userId) return;
    window.location.href = `users.html?edit=${encodeURIComponent(userId)}`;
}

// Delete employee
function excluirFuncionario(id) {
    const funcionario = funcionarios.find(f => f.id === id);
    if (!funcionario) return;
    
    funcionarioSelecionado = funcionario;
    
    elements.deleteFuncionarioInfo.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>${funcionario.nome}</strong><br>
            <small>${funcionario.cargo} - ${funcionario.departamento}</small>
        </div>
    `;
    
    openModal('deleteModal');
}

// Confirm deletion
async function confirmarExclusao() {
    if (!funcionarioSelecionado) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/${funcionarioSelecionado.id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Remover da lista local
            funcionarios = funcionarios.filter(f => f.id !== funcionarioSelecionado.id);
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.id !== funcionarioSelecionado.id);
            
            renderResults();
            closeModal('deleteModal');
            showSuccess('Employee deleted successfully!');
        } else {
            throw new Error(data.error || 'Erro ao excluir funcionário');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        showError('Error deleting employee: ' + error.message);
    }
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    funcionarioSelecionado = null;
}

// Show loading
function showLoading(show) {
    if (elements.loadingIndicator) elements.loadingIndicator.style.display = show ? 'block' : 'none';
}

// Show success
function showSuccess(message) {
    // Implement success notification (console for now)
    console.log('✅', message);
}

// Show error
function showError(message) {
    // Implement error notification (alert for now)
    console.error('❌', message);
    alert('Error: ' + message);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utilities
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('pt-BR');
}


