// Configuração da API
const API_BASE_URL = '/api/warehouse';

function escapeHtml(text) {
    if (text == null || text === '') return '';
    const s = String(text);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Mapeamento categoria (valor no BD) ? texto de exibição
function formatCategory(categoria) {
    if (typeof SectionOptions !== 'undefined') {
        return SectionOptions.formatSectionLabel(categoria);
    }
    if (!categoria) return '-';
    return categoria;
}

// Estado da aplicação
let items = [];
let currentItemId = null;
let currentItem = null;
let hasSearched = false; // true após o usuário clicar em Search

// Elementos do DOM
const itemModal = document.getElementById('itemModal');
const productSearchSection = document.getElementById('productSearchSection');
const productMenuBtn = document.getElementById('productMenuBtn');
const productDropdownMenu = document.getElementById('productDropdownMenu');
const applicationsMenuBtn = document.getElementById('applicationsMenuBtn');
const applicationsDropdownMenu = document.getElementById('applicationsDropdownMenu');
const usersMenuBtn = document.getElementById('usersMenuBtn');
const usersDropdownMenu = document.getElementById('usersDropdownMenu');
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
const customerMenuBtn = document.getElementById('customerMenuBtn');
const customerDropdownMenu = document.getElementById('customerDropdownMenu');
const movementModal = document.getElementById('movementModal');
const detailsModal = document.getElementById('detailsModal');
const printModal = document.getElementById('printModal');
const itemForm = document.getElementById('itemForm');
const movementForm = document.getElementById('movementForm');
const itemsTableBody = document.getElementById('itemsTableBody');
const searchInput = document.getElementById('searchInput');
const searchByField = document.getElementById('searchByField');
const filterCategoria = document.getElementById('filterCategoria');
const filterStatus = document.getElementById('filterStatus');
const sortBy = document.getElementById('sortBy');
const clearSearch = document.getElementById('clearSearch');
const searchBtn = document.getElementById('searchBtn');

// Estatísticas
const totalItemsEl = document.getElementById('totalItems');
const lowStockItemsEl = document.getElementById('lowStockItems');
const totalEntradasEl = document.getElementById('totalEntradas');
const totalSaidasEl = document.getElementById('totalSaidas');

// Definir função printReport globalmente ANTES do DOMContentLoaded
window.printReport = function(itemId) {
    console.log('========================================');
    console.log('?? PRINT REPORT FUNCTION CALLED');
    console.log('========================================');
    console.log('Item ID:', itemId);
    console.log('Items array length:', items.length);
    console.log('Items:', items);
    
    const item = items.find(i => i.id === itemId || i.id === String(itemId));
    if (!item) {
        console.error('? Item not found for ID:', itemId);
        console.log('Available item IDs:', items.map(i => i.id));
        alert('Item not found: ' + itemId);
        return;
    }
    
    console.log('? Item found:', item);
    console.log('Item code:', item.codigo);
    console.log('Item barcode:', item.barcode);
    console.log('Item name:', item.nome);
    
    const printModal = document.getElementById('printModal');
    const printContent = document.getElementById('printContent');
    
    if (!printModal) {
        console.error('? printModal element not found in DOM');
        alert('Print modal not available');
        return;
    }
    console.log('? printModal found');
    
    if (!printContent) {
        console.error('? printContent element not found in DOM');
        alert('Print content not available');
        return;
    }
    console.log('? printContent found');
    
    const uniqueId = `barcode-${itemId}-${Date.now()}`;
    const qrId = `qrcode-${itemId}-${Date.now()}`;
    console.log('Generated IDs - Barcode SVG:', uniqueId, 'QR Container:', qrId);
    
    printContent.innerHTML = `
        <div class="print-report">
            <div class="print-header">
                <h2><i class="fas fa-warehouse"></i> Double-Y Warehouse System</h2>
                <p>Item Report</p>
            </div>
            <div class="print-item-info">
                <h3>${item.nome}</h3>
                <p><strong>Code:</strong> ${item.codigo}</p>
                <p><strong>Barcode:</strong> ${item.barcode || '-'}</p>
                <p><strong>Category:</strong> ${formatCategory(item.categoria)}</p>
                <p><strong>Quantity:</strong> ${item.quantidade}</p>
            </div>
            <div class="print-codes">
                <div class="code-section">
                    <h4>Barcode</h4>
                    <svg id="${uniqueId}" class="barcode-svg"></svg>
                </div>
                <div class="code-section">
                    <h4>QR Code</h4>
                    <div id="${qrId}" class="qrcode-container"></div>
                </div>
            </div>
            <div class="print-footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    
    // Para impressão, usar barcode do produto para Barcode e QRCode
    const barcodeValue = String(item.barcode || '').trim();
    console.log('?? Barcode to generate:', barcodeValue);
    console.log('Barcode type:', typeof barcodeValue);
    console.log('Barcode length:', barcodeValue.length);
    
    if (!barcodeValue) {
        console.error('? Item barcode is empty or undefined');
        alert('Item barcode is missing. Cannot generate barcode and QR code.');
        return;
    }
    
    // Verificar bibliotecas antes de continuar
    console.log('?? Checking libraries...');
    console.log('JsBarcode available:', typeof JsBarcode !== 'undefined');
    console.log('QRCode available:', typeof QRCode !== 'undefined');
    
    // Exibir modal primeiro
    console.log('?? Displaying print modal...');
    printModal.style.display = 'block';
    console.log('? Modal displayed');
    
    // Função para gerar códigos com retry
    function generateCodes() {
        const svgElement = document.getElementById(uniqueId);
        const qrContainer = document.getElementById(qrId);
        const barcodeReady = typeof JsBarcode !== 'undefined';
        const qrcodeReady = typeof QRCode !== 'undefined';
        
        console.log('?? Checking conditions...');
        console.log('  - SVG element:', svgElement ? '? Found' : '? Not found');
        console.log('  - QR Container element:', qrContainer ? '? Found' : '? Not found');
        console.log('  - JsBarcode:', barcodeReady ? '? Available' : '? Not available');
        console.log('  - QRCode:', qrcodeReady ? '? Available' : '? Not available');
        
        // Gerar Barcode
        if (barcodeReady && svgElement) {
            try {
                console.log('?? Generating barcode for:', barcodeValue);
                JsBarcode(`#${uniqueId}`, barcodeValue, {
                    format: "CODE128",
                    width: 2,
                    height: 80,
                    displayValue: true,
                    fontSize: 16,
                    margin: 10
                });
                console.log('? Barcode generated successfully');
            } catch (error) {
                console.error('? Error generating barcode:', error);
                console.error('Error details:', error.message, error.stack);
            }
        } else {
            if (!barcodeReady) console.error('? Cannot generate barcode: JsBarcode not available');
            if (!svgElement) console.error('? Cannot generate barcode: SVG element not found');
        }
        
        // Gerar QR Code - usando qrcodejs (API diferente)
        if (qrcodeReady && qrContainer) {
            try {
                console.log('?? Generating QR code for:', barcodeValue);
                // Limpar conteúdo anterior
                qrContainer.innerHTML = '';
                
                // Usar a API do qrcodejs
                new QRCode(qrContainer, {
                    text: barcodeValue,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.H
                });
                console.log('? QR code generated successfully');
            } catch (error) {
                console.error('? Error generating QR code:', error);
                console.error('Error details:', error.message, error.stack);
            }
        } else {
            if (!qrcodeReady) console.error('? Cannot generate QR code: QRCode not available');
            if (!qrContainer) console.error('? Cannot generate QR code: QR Container element not found');
        }
    }
    
    // Aguardar e tentar gerar códigos
    let attempts = 0;
    const maxAttempts = 10;
    
    function tryGenerateCodes() {
        attempts++;
        console.log(`Attempt ${attempts}/${maxAttempts} to generate codes...`);
        
        const svgElement = document.getElementById(uniqueId);
        const qrContainer = document.getElementById(qrId);
        const barcodeReady = typeof JsBarcode !== 'undefined';
        const qrcodeReady = typeof QRCode !== 'undefined';
        
        if (svgElement && qrContainer && barcodeReady && qrcodeReady) {
            console.log('? All conditions met! Generating codes...');
            generateCodes();
        } else if (attempts < maxAttempts) {
            console.log('? Waiting for conditions...');
            setTimeout(tryGenerateCodes, 300);
        } else {
            console.error('? Timeout: Could not generate codes after', maxAttempts, 'attempts');
            generateCodes(); // Tentar mesmo assim
        }
    }
    
    // Começar tentativas após um pequeno delay
    setTimeout(tryGenerateCodes, 300);
    
    console.log('========================================');
    console.log('? PRINT REPORT FUNCTION COMPLETED');
    console.log('========================================');
};

// Definir função closePrintModal globalmente
window.closePrintModal = function() {
    const printModal = document.getElementById('printModal');
    const printContent = document.getElementById('printContent');
    
    if (printModal) {
        printModal.style.display = 'none';
    }
    
    if (printContent) {
        printContent.innerHTML = '';
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    attachActionButtonListeners();
    loadStatistics();
    // Não carrega todos os itens na abertura; usuário deve usar Search
});

function handleWarehouseLandingAction() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'new') {
        openItemModal();
    } else if (action === 'search') {
        const section = document.getElementById('productSearchSection');
        if (section) {
            section.style.display = 'flex';
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        return;
    }

    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function setupEventListeners() {
    // Product: New Product e Search Product
    function openSearchProductSection() {
        closeProductDropdown();
        if (productSearchSection) {
            productSearchSection.style.display = 'flex';
            productSearchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    function openNewProductModal() {
        closeProductDropdown();
        openItemModal();
    }
    function bindDropdownAction(btn, handler) {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handler();
        });
    }
    const newProductBtn = document.getElementById('newProductBtn');
    const searchProductBtn = document.getElementById('searchProductBtn');
    bindDropdownAction(newProductBtn, openNewProductModal);
    bindDropdownAction(searchProductBtn, openSearchProductSection);
    if (productMenuBtn && productDropdownMenu) {
        productMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            if (movementDropdownMenu) movementDropdownMenu.setAttribute('aria-hidden', 'true');
            if (movementMenuBtn) movementMenuBtn.setAttribute('aria-expanded', 'false');
            if (customerDropdownMenu) customerDropdownMenu.setAttribute('aria-hidden', 'true');
            if (customerMenuBtn) customerMenuBtn.setAttribute('aria-expanded', 'false');
            const open = productDropdownMenu.getAttribute('aria-hidden') !== 'true';
            productDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            productMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    function closeProductDropdown() {
        if (productDropdownMenu) productDropdownMenu.setAttribute('aria-hidden', 'true');
        if (productMenuBtn) productMenuBtn.setAttribute('aria-expanded', 'false');
    }
    function closeApplicationsDropdown() {
        if (applicationsDropdownMenu) applicationsDropdownMenu.setAttribute('aria-hidden', 'true');
        if (applicationsMenuBtn) applicationsMenuBtn.setAttribute('aria-expanded', 'false');
    }
    if (applicationsMenuBtn && applicationsDropdownMenu) {
        applicationsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            closeMovementDropdown();
            closePickingDropdown();
            closeHelpDropdown();
            closeCustomerDropdown();
            const open = applicationsDropdownMenu.getAttribute('aria-hidden') !== 'true';
            applicationsDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            applicationsMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (usersMenuBtn && usersDropdownMenu) {
        usersMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            if (movementDropdownMenu) movementDropdownMenu.setAttribute('aria-hidden', 'true');
            if (movementMenuBtn) movementMenuBtn.setAttribute('aria-expanded', 'false');
            if (customerDropdownMenu) customerDropdownMenu.setAttribute('aria-hidden', 'true');
            if (customerMenuBtn) customerMenuBtn.setAttribute('aria-expanded', 'false');
            const open = usersDropdownMenu.getAttribute('aria-hidden') !== 'true';
            usersDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            usersMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    function closeUsersDropdown() {
        if (usersDropdownMenu) usersDropdownMenu.setAttribute('aria-hidden', 'true');
        if (usersMenuBtn) usersMenuBtn.setAttribute('aria-expanded', 'false');
    }
    if (locationMenuBtn && locationDropdownMenu) {
        locationMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeLocationProductDropdown();
            if (movementDropdownMenu) movementDropdownMenu.setAttribute('aria-hidden', 'true');
            if (movementMenuBtn) movementMenuBtn.setAttribute('aria-expanded', 'false');
            if (customerDropdownMenu) customerDropdownMenu.setAttribute('aria-hidden', 'true');
            if (customerMenuBtn) customerMenuBtn.setAttribute('aria-expanded', 'false');
            const open = locationDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    function closeLocationDropdown() {
        if (locationDropdownMenu) locationDropdownMenu.setAttribute('aria-hidden', 'true');
        if (locationMenuBtn) locationMenuBtn.setAttribute('aria-expanded', 'false');
    }
    if (locationProductMenuBtn && locationProductDropdownMenu) {
        locationProductMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            if (movementDropdownMenu) movementDropdownMenu.setAttribute('aria-hidden', 'true');
            if (movementMenuBtn) movementMenuBtn.setAttribute('aria-expanded', 'false');
            if (customerDropdownMenu) customerDropdownMenu.setAttribute('aria-hidden', 'true');
            if (customerMenuBtn) customerMenuBtn.setAttribute('aria-expanded', 'false');
            const open = locationProductDropdownMenu.getAttribute('aria-hidden') !== 'true';
            locationProductDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            locationProductMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    function closeLocationProductDropdown() {
        if (locationProductDropdownMenu) locationProductDropdownMenu.setAttribute('aria-hidden', 'true');
        if (locationProductMenuBtn) locationProductMenuBtn.setAttribute('aria-expanded', 'false');
    }
    function closeMovementDropdown() {
        if (movementDropdownMenu) movementDropdownMenu.setAttribute('aria-hidden', 'true');
        if (movementMenuBtn) movementMenuBtn.setAttribute('aria-expanded', 'false');
    }
    function closePickingDropdown() {
        if (pickingDropdownMenu) pickingDropdownMenu.setAttribute('aria-hidden', 'true');
        if (pickingMenuBtn) pickingMenuBtn.setAttribute('aria-expanded', 'false');
    }
    function closeHelpDropdown() {
        if (helpDropdownMenu) helpDropdownMenu.setAttribute('aria-hidden', 'true');
        if (helpMenuBtn) helpMenuBtn.setAttribute('aria-expanded', 'false');
    }
    function closeCustomerDropdown() {
        if (customerDropdownMenu) customerDropdownMenu.setAttribute('aria-hidden', 'true');
        if (customerMenuBtn) customerMenuBtn.setAttribute('aria-expanded', 'false');
    }
    if (movementMenuBtn && movementDropdownMenu) {
        movementMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            closePickingDropdown();
            closeHelpDropdown();
            closeCustomerDropdown();
            const open = movementDropdownMenu.getAttribute('aria-hidden') !== 'true';
            movementDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            movementMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (pickingMenuBtn && pickingDropdownMenu) {
        pickingMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            closeMovementDropdown();
            closeHelpDropdown();
            closeCustomerDropdown();
            const open = pickingDropdownMenu.getAttribute('aria-hidden') !== 'true';
            pickingDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            pickingMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (helpMenuBtn && helpDropdownMenu) {
        helpMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            closeMovementDropdown();
            closePickingDropdown();
            closeCustomerDropdown();
            const open = helpDropdownMenu.getAttribute('aria-hidden') !== 'true';
            helpDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            helpMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    if (customerMenuBtn && customerDropdownMenu) {
        customerMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeProductDropdown();
            closeApplicationsDropdown();
            closeUsersDropdown();
            closeApplicationsDropdown();
            closeLocationDropdown();
            closeLocationProductDropdown();
            closeMovementDropdown();
            closePickingDropdown();
            closeHelpDropdown();
            const open = customerDropdownMenu.getAttribute('aria-hidden') !== 'true';
            customerDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
            customerMenuBtn.setAttribute('aria-expanded', !open);
        });
    }
    document.addEventListener('click', (e) => {
        if (e.target.closest('.users-dropdown, .product-dropdown, .applications-dropdown, .location-dropdown, .location-product-dropdown, .movement-dropdown, .picking-dropdown, .help-dropdown, .customer-dropdown')) {
            return;
        }
        closeProductDropdown();
        closeApplicationsDropdown();
        closeUsersDropdown();
        closeLocationDropdown();
        closeLocationProductDropdown();
        closeMovementDropdown();
        closeCustomerDropdown();
        closePickingDropdown();
        closeHelpDropdown();
    });

    handleWarehouseLandingAction();

    // Modal de Item
    document.getElementById('closeModal').addEventListener('click', () => closeItemModal());
    document.getElementById('cancelBtn').addEventListener('click', () => closeItemModal());
    itemForm.addEventListener('submit', handleItemSubmit);
    
    // Modal de Movimentação
    document.getElementById('closeMovementModal').addEventListener('click', () => closeMovementModal());
    document.getElementById('cancelMovementBtn').addEventListener('click', () => closeMovementModal());
    movementForm.addEventListener('submit', handleMovementSubmit);
    
    // Modal de Detalhes
    document.getElementById('closeDetailsModal').addEventListener('click', () => closeDetailsModal());
    
    // Modal de Impressão
    const closePrintModalBtn = document.getElementById('closePrintModal');
    const closePrintBtn = document.getElementById('closePrintBtn');
    const printBtn = document.getElementById('printBtn');
    
    if (closePrintModalBtn) {
        closePrintModalBtn.addEventListener('click', () => window.closePrintModal());
    }
    if (closePrintBtn) {
        closePrintBtn.addEventListener('click', () => window.closePrintModal());
    }
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }
    
    // Botão Search - carrega itens da API com filtros
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearchClick);
    }
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchClick();
    });
    // Filtros aplicados nos itens já carregados (client-side)
    searchInput.addEventListener('input', filterItems);
    if (searchByField) searchByField.addEventListener('change', filterItems);
    filterCategoria.addEventListener('change', filterItems);
    filterStatus.addEventListener('change', filterItems);
    sortBy.addEventListener('change', filterItems);
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        if (searchByField) searchByField.value = 'codigo';
        filterItems();
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === itemModal) closeItemModal();
        if (e.target === movementModal) closeMovementModal();
        if (e.target === detailsModal) closeDetailsModal();
        const printModalEl = document.getElementById('printModal');
        if (e.target === printModalEl) window.closePrintModal();
    });
}

// Retorna os filtros atuais da tela (para Search e para refresh após save/delete/move)
function getCurrentFilters() {
    const term = searchInput.value.trim();
    const searchBy = searchByField ? searchByField.value : 'codigo';
    const byCode = term && searchBy === 'codigo' ? term : undefined;
    const byName = term && searchBy === 'nome' ? term : undefined;
    const byBarcode = term && searchBy === 'barcode' ? term : undefined;
    return {
        codigo: byCode,
        nome: byName,
        barcode: byBarcode,
        categoria: searchBy === 'barcode' ? undefined : (filterCategoria.value || undefined),
        ordenarPor: sortBy.value || 'nome',
        direcao: 'asc'
    };
}

// Exibe o estado inicial da tabela (sem itens carregados)
function showEmptyStateInitial() {
    hasSearched = false;
    items = [];
    itemsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                <i class="fas fa-search"></i>
                <p>Use search or filters and click <strong>Search</strong> to load items.</p>
            </td>
        </tr>
    `;
}

// Clique no botão Search: valida filtros e chama loadItems com parâmetros
function handleSearchClick() {
    const term = searchInput.value.trim();
    const categoria = filterCategoria.value;
    if (!term && !categoria) {
        showError('Please enter a search term or select a category to search.');
        return;
    }
    loadItems(getCurrentFilters());
}

// Carregar estatísticas do servidor (sem carregar a lista de itens)
async function loadStatistics() {
    try {
        const response = await fetch(API_BASE_URL + '/estatisticas');
        const result = await response.json();
        if (result.success && result.data) {
            const d = result.data;
            totalItemsEl.textContent = d.total ?? 0;
            lowStockItemsEl.textContent = (d.estoqueBaixo ?? 0) + (d.esgotado ?? 0);
            totalEntradasEl.textContent = d.entradas ?? 0;
            totalSaidasEl.textContent = d.saidas ?? 0;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        totalItemsEl.textContent = '0';
        lowStockItemsEl.textContent = '0';
        totalEntradasEl.textContent = '0';
        totalSaidasEl.textContent = '0';
    }
}

// Carregar itens do servidor (com filtros opcionais; sem filtros não carrega todos)
async function loadItems(filtros) {
    const params = filtros && (filtros.nome || filtros.codigo || filtros.barcode || filtros.categoria)
        ? filtros
        : getCurrentFilters();
    const hasFilters = params.nome || params.codigo || params.barcode || params.categoria;

    if (!hasFilters) {
        showEmptyStateInitial();
        loadStatistics();
        return;
    }

    try {
        showLoading();
        const query = new URLSearchParams();
        if (params.nome) query.set('nome', params.nome);
        if (params.codigo) query.set('codigo', params.codigo);
        if (params.categoria) query.set('categoria', params.categoria);
        if (params.barcode) query.set('barcode', params.barcode);
        if (params.ordenarPor) query.set('ordenarPor', params.ordenarPor);
        if (params.direcao) query.set('direcao', params.direcao);
        const url = query.toString() ? `${API_BASE_URL}?${query.toString()}` : API_BASE_URL;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            hasSearched = true;
            items = data.data || [];
            displayItems(items);
            loadStatistics();
        } else {
            showError('Error loading items: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading items:', error);
        showError('Error connecting to server. Please check if the server is running.');
        items = [];
        displayItems(items);
        loadStatistics();
    } finally {
        hideLoading();
    }
}

// Exibir itens na tabela
function displayItems(itemsToDisplay) {
    if (itemsToDisplay.length === 0) {
        const message = hasSearched
            ? 'No items found.'
            : 'Use search or filters and click <strong>Search</strong> to load items.';
        const icon = hasSearched ? 'fa-box-open' : 'fa-search';
        itemsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas ${icon}"></i>
                    <p>${message}</p>
                </td>
            </tr>
        `;
        return;
    }

    itemsTableBody.innerHTML = itemsToDisplay.map(item => {
        const status = getItemStatus(item);
        const statusClass = status.toLowerCase().replace(' ', '-');

        return `
            <tr class="item-data-row">
                <td><strong>${item.codigo}</strong></td>
                <td>${item.nome}</td>
                <td>${formatCategory(item.categoria)}</td>
                <td>${item.barcode != null ? item.barcode : '-'}</td>
                <td>
                    <strong>${item.quantidade}</strong>
                    ${item.quantidadeMinima ? `<small style="color: #999; display: block;">Min: ${item.quantidadeMinima}</small>` : ''}
                </td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
            </tr>
            <tr class="item-actions-row">
                <td></td>
                <td colspan="4" class="action-buttons-cell">
                    <div class="action-buttons">
                        <button class="btn-action view" data-action="view" data-item-id="${item.id}" title="View details">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-action print" data-action="print" data-item-id="${item.id}" title="Print report" type="button">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button class="btn-action movement" data-action="move" data-item-id="${item.id}" title="Move stock">
                            <i class="fas fa-exchange-alt"></i> Move
                        </button>
                        <button class="btn-action edit" data-action="edit" data-item-id="${item.id}" title="Edit">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-action delete" data-action="delete" data-item-id="${item.id}" title="Delete">
                            <i class="fas fa-trash"></i> Del.
                        </button>
                    </div>
                </td>
                <td></td>
            </tr>
        `;
    }).join('');
    
    // Event listeners já estão configurados via event delegation, não precisa chamar novamente
}

// Attach event listeners to action buttons using event delegation
let actionButtonHandler = null;
let listenersAttached = false;

function attachActionButtonListeners() {
    // Evitar adicionar múltiplos listeners
    if (listenersAttached) return;
    
    actionButtonHandler = (e) => {
        const button = e.target.closest('.btn-action');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const itemId = button.getAttribute('data-item-id');
        
        if (!action || !itemId) return;
        
        console.log('Button clicked:', action, 'Item ID:', itemId);
        
        switch(action) {
            case 'view':
                viewItem(itemId);
                break;
            case 'print':
                console.log('Calling printReport for item:', itemId);
                if (typeof window.printReport === 'function') {
                    window.printReport(itemId);
                } else {
                    console.error('printReport function not found');
                    alert('Print function not available. Please refresh the page.');
                }
                break;
            case 'move':
                openMovementModal(itemId);
                break;
            case 'edit':
                editItem(itemId);
                break;
            case 'delete':
                deleteItem(itemId);
                break;
        }
    };
    
    itemsTableBody.addEventListener('click', actionButtonHandler);
    listenersAttached = true;
}

// Get item status
function getItemStatus(item) {
    if (item.quantidade === 0) return 'Out of Stock';
    if (item.quantidadeMinima && item.quantidade <= item.quantidadeMinima) return 'Low Stock';
    return 'Available';
}

// Filtrar e ordenar itens
function filterItems() {
    const searchTerm = searchInput.value.toLowerCase();
    const searchBy = searchByField ? searchByField.value : 'codigo';
    const categoriaFilter = filterCategoria.value;
    const statusFilter = filterStatus.value;
    const sortField = sortBy.value;
    
    let filtered = items.filter(item => {
        const itemCode = String(item.codigo || '').toLowerCase();
        const itemName = String(item.nome || '').toLowerCase();
        const itemBarcode = String(item.barcode || '').replace(/\D/g, '');
        const barcodeSearch = searchTerm.replace(/\D/g, '');

        let matchesSearch = !searchTerm;
        if (searchTerm) {
            if (searchBy === 'nome') matchesSearch = itemName.includes(searchTerm);
            else if (searchBy === 'barcode') matchesSearch = itemBarcode === barcodeSearch;
            else matchesSearch = itemCode.includes(searchTerm);
        }
        
        const matchesCategoria = !categoriaFilter || item.categoria === categoriaFilter;
        
        const itemStatus = getItemStatus(item).toLowerCase().replace(/\s+/g, '-');
        const matchesStatus = !statusFilter || itemStatus === statusFilter;
        
        return matchesSearch && matchesCategoria && matchesStatus;
    });
    
    // Ordenar
    filtered.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (sortField === 'quantidade') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else {
            aVal = (aVal || '').toString().toLowerCase();
            bVal = (bVal || '').toString().toLowerCase();
        }
        
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
    });
    
    displayItems(filtered);
}

// Atualizar estatísticas
function updateStatistics() {
    const total = items.length;
    const lowStock = items.filter(item => {
        const status = getItemStatus(item);
        return status === 'Low Stock' || status === 'Out of Stock';
    }).length;
    
    // Simular movimentações do dia (em produção, viria do backend)
    const today = new Date().toISOString().split('T')[0];
    const entradas = items.filter(item => item.ultimaEntrada === today).length || 0;
    const saidas = items.filter(item => item.ultimaSaida === today).length || 0;
    
    totalItemsEl.textContent = total;
    lowStockItemsEl.textContent = lowStock;
    totalEntradasEl.textContent = entradas;
    totalSaidasEl.textContent = saidas;
}

// Abrir modal de item
function openItemModal(itemId = null) {
    currentItemId = itemId;
    const modalTitle = document.getElementById('modalTitle');
    const quantidadeInput = document.getElementById('quantidade');

    if (itemId) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Item';
        const item = items.find(i => i.id === itemId);
        if (item) {
            fillItemForm(item);
        }
        // Quantity só exibição ao editar – não pode ser alterada
        quantidadeInput.readOnly = true;
        quantidadeInput.classList.add('input-readonly');
    } else {
        modalTitle.innerHTML = '<i class="fas fa-box"></i> New Item';
        itemForm.reset();
        quantidadeInput.readOnly = false;
        quantidadeInput.classList.remove('input-readonly');
    }

    itemModal.style.display = 'block';
}

// Fechar modal de item
function closeItemModal() {
    itemModal.style.display = 'none';
    itemForm.reset();
    currentItemId = null;
    clearFormErrors();
    const quantidadeInput = document.getElementById('quantidade');
    quantidadeInput.readOnly = false;
    quantidadeInput.classList.remove('input-readonly');
}

// Preencher formulário com dados do item
function fillItemForm(item) {
    document.getElementById('codigo').value = item.codigo || '';
    document.getElementById('nome').value = item.nome || '';
    document.getElementById('categoria').value = item.categoria || '';
    document.getElementById('barcode').value = item.barcode != null ? String(item.barcode) : '';
    document.getElementById('quantidade').value = item.quantidade || 0;
    document.getElementById('quantidadeMinima').value = item.quantidadeMinima || 0;
    document.getElementById('peso').value = item.peso != null ? item.peso : '';
    document.getElementById('descricao').value = item.descricao || '';
}

// Submeter formulário de item
async function handleItemSubmit(e) {
    e.preventDefault();
    
    const formData = {
        codigo: document.getElementById('codigo').value.trim(),
        nome: document.getElementById('nome').value.trim(),
        categoria: document.getElementById('categoria').value,
        barcode: document.getElementById('barcode').value.trim() || null,
        quantidade: parseInt(document.getElementById('quantidade').value) || 0,
        quantidadeMinima: parseInt(document.getElementById('quantidadeMinima').value) || 0,
        peso: parseFloat(document.getElementById('peso').value) || 0,
        descricao: document.getElementById('descricao').value.trim()
    };
    
    // Validação básica
    if (!validateItemForm(formData)) {
        return;
    }
    
    try {
        showLoading();
        const url = currentItemId ? `${API_BASE_URL}/${currentItemId}` : API_BASE_URL;
        const method = currentItemId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(currentItemId ? 'Item updated successfully!' : 'Item created successfully!');
            closeItemModal();
            loadItems(getCurrentFilters());
        } else {
            showError(data.message || 'Error saving item');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        showError('Error connecting to server');
        // Simular sucesso para demonstração
        if (!currentItemId) {
            formData.id = Date.now().toString();
            items.push(formData);
        } else {
            const index = items.findIndex(i => i.id === currentItemId);
            if (index !== -1) {
                items[index] = { ...items[index], ...formData };
            }
        }
        displayItems(items);
        updateStatistics();
        closeItemModal();
        showSuccess('Item saved successfully! (demo mode)');
    } finally {
        hideLoading();
    }
}

// Validar formulário
function validateItemForm(data) {
    clearFormErrors();
    let isValid = true;
    
    if (!data.codigo || data.codigo.length < 2) {
        showFieldError('codigo', 'Code must have at least 2 characters');
        isValid = false;
    }
    
    if (!data.nome || data.nome.length < 2) {
        showFieldError('nome', 'Name must have at least 2 characters');
        isValid = false;
    }
    
    if (!data.categoria) {
        showFieldError('categoria', 'Select a category');
        isValid = false;
    }

    if (data.barcode && !/^\d{1,20}$/.test(String(data.barcode))) {
        showFieldError('barcode', 'Barcode must contain only digits (max 20)');
        isValid = false;
    }
    
    if (data.quantidade < 0) {
        showFieldError('quantidade', 'Quantity cannot be negative');
        isValid = false;
    }

    if (data.peso < 0) {
        showFieldError('peso', 'Weight cannot be negative');
        isValid = false;
    }
    
    return isValid;
}

// Mostrar erro em campo
function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    const errorEl = document.getElementById(`${fieldName}-error`);
    
    if (field) {
        field.classList.add('error');
    }
    
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

// Limpar erros do formulário
function clearFormErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
    document.querySelectorAll('.form-group.error').forEach(el => {
        el.classList.remove('error');
    });
}

// Visualizar item
async function viewItem(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    currentItem = item;
    const detailsEl = document.getElementById('itemDetails');
    const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
    
    detailsEl.innerHTML = `
        <div class="detail-section">
            <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
            <p><span class="detail-label">Code:</span> ${item.codigo}</p>
            <p><span class="detail-label">Name:</span> ${item.nome}</p>
            <p><span class="detail-label">Barcode:</span> ${item.barcode || '-'}</p>
            <p><span class="detail-label">Category:</span> ${formatCategory(item.categoria)}</p>
            <p><span class="detail-label">Status:</span> <span class="status-badge ${getItemStatus(item).toLowerCase().replace(/\s+/g, '-')}">${getItemStatus(item)}</span></p>
        </div>
        <div class="detail-section">
            <h4><i class="fas fa-boxes"></i> Stock</h4>
            <p><span class="detail-label">Current Quantity:</span> ${item.quantidade}</p>
            <p><span class="detail-label">Minimum Quantity:</span> ${item.quantidadeMinima || 0}</p>
            <p><span class="detail-label">Weight (kg):</span> ${item.peso != null ? item.peso : '-'}</p>
        </div>
        <div class="detail-section product-location" id="productLocationSection">
            <h4><i class="fas fa-map-marker-alt"></i> Product Location</h4>
            <p class="product-location-desc">Locations with situation Full and stat_cd_id = A</p>
            <div id="productLocationContent"><span class="loading-text">Loading...</span></div>
        </div>
        ${item.descricao ? `
        <div class="detail-section">
            <h4><i class="fas fa-align-left"></i> Description</h4>
            <p>${item.descricao}</p>
        </div>
        ` : ''}
    `;
    
    detailsModal.style.display = 'block';

    const contentEl = document.getElementById('productLocationContent');
    const productCode = String(item.codigo || '').trim();
    try {
        const res = await fetch(apiBase + '/api/location-product/by-product-full/' + encodeURIComponent(productCode));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            contentEl.innerHTML = '<p class="error-state">Error loading locations (' + (res.status || '') + ').</p>';
            return;
        }
        const rawList = (data.success && data.data) ? data.data : [];
        const list = rawList.map(r => ({
            locationCode: r.locationCode != null ? r.locationCode : r.location_code,
            quantityCurrent: r.quantityCurrent != null ? r.quantityCurrent : (r.quantity_current ?? 0),
            accessType: r.accessType != null ? r.accessType : (r.access_type ?? '')
        }));
        if (!list.length) {
            contentEl.innerHTML = '<p class="empty-state">No locations (situation Full, stat_cd_id A) for this product.</p>';
        } else {
            contentEl.innerHTML = `
                <table class="product-location-table">
                    <thead><tr><th>Location Code</th><th>Access Type</th><th>Quantity Current</th></tr></thead>
                    <tbody>
                        ${list.map(r => `<tr><td>${r.locationCode}</td><td>${escapeHtml(r.accessType || '-')}</td><td>${r.quantityCurrent}</td></tr>`).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (e) {
        console.error('Error loading product locations:', e);
        contentEl.innerHTML = '<p class="error-state">Error loading locations.</p>';
    }
}

// Fechar modal de detalhes
function closeDetailsModal() {
    detailsModal.style.display = 'none';
    currentItem = null;
}

// Editar item
function editItem(itemId) {
    openItemModal(itemId);
}

// Abrir modal de movimentação
function openMovementModal(itemId) {
    currentItemId = itemId;
    const item = items.find(i => i.id === itemId);
    if (item) {
        currentItem = item;
        document.getElementById('movementTitle').innerHTML = `<i class="fas fa-exchange-alt"></i> Movement - ${item.nome}`;
        movementForm.reset();
        movementModal.style.display = 'block';
    }
}

// Fechar modal de movimentação
function closeMovementModal() {
    movementModal.style.display = 'none';
    movementForm.reset();
    currentItemId = null;
    currentItem = null;
}

// Submeter movimentação
async function handleMovementSubmit(e) {
    e.preventDefault();
    
    const tipo = document.getElementById('movementType').value;
    const quantidade = parseInt(document.getElementById('movementQuantity').value) || 0;
    const motivo = document.getElementById('movementReason').value.trim();
    
    if (!tipo || quantidade <= 0) {
        showError('Please fill all required fields');
        return;
    }
    
    if (!currentItem) {
        showError('Item not found');
        return;
    }
    
    const novaQuantidade = tipo === 'entrada' 
        ? currentItem.quantidade + quantidade
        : currentItem.quantidade - quantidade;
    
    if (novaQuantidade < 0) {
        showError('Insufficient stock quantity');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/${currentItemId}/movement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tipo,
                quantidade,
                motivo
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(`Movement of ${tipo === 'entrada' ? 'entry' : 'exit'} registered successfully!`);
            closeMovementModal();
            loadItems(getCurrentFilters());
        } else {
            showError(data.message || 'Error registering movement');
        }
    } catch (error) {
        console.error('Error registering movement:', error);
        // Simular sucesso para demonstração
        const index = items.findIndex(i => i.id === currentItemId);
        if (index !== -1) {
            items[index].quantidade = novaQuantidade;
            if (tipo === 'entrada') {
                items[index].ultimaEntrada = new Date().toISOString().split('T')[0];
            } else {
                items[index].ultimaSaida = new Date().toISOString().split('T')[0];
            }
        }
        displayItems(items);
        updateStatistics();
        closeMovementModal();
        showSuccess(`Movement registered successfully! (demo mode)`);
    } finally {
        hideLoading();
    }
}

// Excluir item
async function deleteItem(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    if (!confirm(`Are you sure you want to delete the item "${item.nome}"?`)) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/${itemId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Item deleted successfully!');
            loadItems(getCurrentFilters());
        } else {
            showError(data.message || 'Error deleting item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        // Simulate deletion for demo
        items = items.filter(i => i.id !== itemId);
        displayItems(items);
        updateStatistics();
        showSuccess('Item deleted successfully! (demo mode)');
    } finally {
        hideLoading();
    }
}

// Funções auxiliares
function showLoading() {
    // Implementar loading se necessário
}

function hideLoading() {
    // Implementar hide loading se necessário
}

function showSuccess(message) {
    alert(message); // In production, use a toast or better modal
}

function showError(message) {
    alert(message); // In production, use a toast or better modal
}

// Mock data for demonstration
function getMockItems() {
    return [
        {
            id: '1',
            codigo: 'PROD-001',
            nome: 'Dell Inspiron Notebook',
            categoria: 'TAPWARE',
            quantidade: 15,
            quantidadeMinima: 5,
            descricao: 'Dell Inspiron 15 3000 Notebook',
            peso: 2.1
        },
        {
            id: '2',
            codigo: 'PROD-002',
            nome: 'Logitech Mouse',
            categoria: 'CENTRAL',
            quantidade: 2,
            quantidadeMinima: 10,
            descricao: 'Logitech M705 Wireless Mouse',
            peso: 0.2
        },
        {
            id: '3',
            codigo: 'PROD-003',
            nome: 'Basic T-Shirt',
            categoria: 'WAREHOUSE2',
            quantidade: 50,
            quantidadeMinima: 20,
            descricao: 'Basic cotton t-shirt',
            peso: 0.15
        }
    ];
}
