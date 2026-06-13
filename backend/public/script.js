// Configuração da API
const API_BASE_URL = '/api/funcionarios';

// Elementos do DOM
const form = document.getElementById('funcionarioForm');
const limparBtn = document.getElementById('limparBtn');
const salvarBtn = document.getElementById('salvarBtn');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const fecharModal = document.getElementById('fecharModal');
const fecharErrorModal = document.getElementById('fecharErrorModal');
const errorMessage = document.getElementById('errorMessage');
const funcionarioInfo = document.getElementById('funcionarioInfo');

// Validações em tempo real
const validacoes = {
    nome: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-ZÀ-ÿ\s]+$/,
        message: 'Nome deve conter apenas letras e espaços, entre 2 e 100 caracteres'
    },
    email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Email deve ter um formato válido'
    },
    password: {
        required: true,
        minLength: 6,
        maxLength: 100,
        message: 'Senha deve ter entre 6 e 100 caracteres'
    },
    telefone: {
        required: true,
        minLength: 10,
        maxLength: 20,
        pattern: /^[\d\s\(\)\-\+]+$/,
        message: 'Telefone deve conter apenas números, espaços, parênteses, hífens e +'
    },
    cargo: {
        required: true,
        minLength: 2,
        maxLength: 50,
        message: 'Cargo deve ter entre 2 e 50 caracteres'
    },
    departamento: {
        required: true,
        message: 'Selecione um departamento'
    },
    dataAdmissao: {
        required: false,
        message: 'Data de admissão deve ser válida'
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupFormValidation();
    setDefaultDate();
});

// Configurar event listeners
function setupEventListeners() {
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Limpar formulário
    limparBtn.addEventListener('click', limparFormulario);
    
    // Fechar modais
    fecharModal.addEventListener('click', () => closeModal(successModal));
    fecharErrorModal.addEventListener('click', () => closeModal(errorModal));
    
    // Fechar modal clicando fora
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) closeModal(successModal);
    });
    
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) closeModal(errorModal);
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(successModal);
            closeModal(errorModal);
        }
    });
}

// Configurar validação do formulário
function setupFormValidation() {
    Object.keys(validacoes).forEach(campo => {
        const input = document.getElementById(campo);
        if (input) {
            // Validação em tempo real
            input.addEventListener('blur', () => validateField(campo));
            input.addEventListener('input', () => clearFieldError(campo));
            
            // Formatação especial para telefone
            if (campo === 'telefone') {
                input.addEventListener('input', formatTelefone);
            }
        }
    });
}

// Definir data padrão (hoje)
function setDefaultDate() {
    const dataInput = document.getElementById('dataAdmissao');
    if (dataInput && !dataInput.value) {
        const hoje = new Date().toISOString().split('T')[0];
        dataInput.value = hoje;
    }
}

// Formatar telefone (padrão Austrália, ex: 04 1234 5678)
function formatTelefone(e) {
    let value = e.target.value.replace(/\D/g, '');

    // Converter formato internacional +61 para formato local 0
    if (value.startsWith('61')) {
        value = '0' + value.slice(2);
    }

    // Limitar a 10 dígitos (números australianos)
    value = value.slice(0, 10);

    if (value.length <= 2) {
        // "0" ou "04"
        value = value;
    } else if (value.length <= 6) {
        // "04 1234"
        value = `${value.slice(0, 2)} ${value.slice(2)}`;
    } else if (value.length <= 8) {
        // "04 1234 56"
        value = `${value.slice(0, 2)} ${value.slice(2, 6)} ${value.slice(6)}`;
    } else {
        // "04 1234 5678"
        value = `${value.slice(0, 2)} ${value.slice(2, 6)} ${value.slice(6)}`;
    }

    e.target.value = value;
}

// Validar campo individual
function validateField(campo) {
    const input = document.getElementById(campo);
    const validacao = validacoes[campo];
    const value = input.value.trim();
    
    // Limpar erro anterior
    clearFieldError(campo);
    
    // Validar campo obrigatório
    if (validacao.required && !value) {
        showFieldError(campo, `${getFieldLabel(campo)} é obrigatório`);
        return false;
    }
    
    // Se campo vazio e não obrigatório, é válido
    if (!value && !validacao.required) {
        return true;
    }
    
    // Validar comprimento mínimo
    if (validacao.minLength && value.length < validacao.minLength) {
        showFieldError(campo, `${getFieldLabel(campo)} deve ter pelo menos ${validacao.minLength} caracteres`);
        return false;
    }
    
    // Validar comprimento máximo
    if (validacao.maxLength && value.length > validacao.maxLength) {
        showFieldError(campo, `${getFieldLabel(campo)} deve ter no máximo ${validacao.maxLength} caracteres`);
        return false;
    }
    
    // Validar padrão
    if (validacao.pattern && !validacao.pattern.test(value)) {
        showFieldError(campo, validacao.message);
        return false;
    }
    
    // Validar valor mínimo (para números)
    if (validacao.min !== undefined && parseFloat(value) < validacao.min) {
        showFieldError(campo, `${getFieldLabel(campo)} deve ser maior que ${validacao.min}`);
        return false;
    }
    
    // Validação específica para data
    if (campo === 'dataAdmissao' && value) {
        const data = new Date(value);
        const hoje = new Date();
        if (data > hoje) {
            showFieldError(campo, 'Data de admissão não pode ser futura');
            return false;
        }
    }
    
    return true;
}

// Mostrar erro no campo
function showFieldError(campo, message) {
    const input = document.getElementById(campo);
    const errorElement = document.getElementById(`${campo}-error`);
    const formGroup = input.closest('.form-group');
    
    formGroup.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

// Limpar erro do campo
function clearFieldError(campo) {
    const input = document.getElementById(campo);
    const errorElement = document.getElementById(`${campo}-error`);
    const formGroup = input.closest('.form-group');
    
    formGroup.classList.remove('error');
    errorElement.classList.remove('show');
}

// Obter label do campo
function getFieldLabel(campo) {
    const labels = {
        nome: 'Nome',
        email: 'Email',
        password: 'Senha',
        telefone: 'Telefone',
        cargo: 'Cargo',
        departamento: 'Departamento',
        dataAdmissao: 'Data de Admissão'
    };
    return labels[campo] || campo;
}

// Validar todo o formulário
function validateForm() {
    let isValid = true;
    
    Object.keys(validacoes).forEach(campo => {
        if (!validateField(campo)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Manipular envio do formulário
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validar formulário
    if (!validateForm()) {
        showError('Por favor, corrija os erros no formulário');
        return;
    }
    
    // Preparar dados
    const formData = new FormData(form);
    const photoFile = document.getElementById('photo').files[0];
    let photoBase64 = null;
    
    // Converter foto para base64 se existir
    if (photoFile) {
        photoBase64 = await convertFileToBase64(photoFile);
    }
    
    const dados = {
        nome: formData.get('nome').trim(),
        email: formData.get('email').trim(),
        password: formData.get('password'),
        telefone: formData.get('telefone').trim(),
        cargo: formData.get('cargo').trim(),
        departamento: formData.get('departamento'),
        dataAdmissao: formData.get('dataAdmissao') || null,
        photo: photoBase64,
        ativo: formData.get('ativo') === 'on'
    };
    
    // Enviar dados
    try {
        setLoading(true);
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dados)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showSuccess(result.data);
            limparFormulario();
        } else {
            throw new Error(result.error || 'Erro ao cadastrar funcionário');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

// Mostrar sucesso
function showSuccess(funcionario) {
    const photoHtml = funcionario.photo 
        ? `<div style="text-align: center; margin-bottom: 15px;">
             <img src="${funcionario.photo}" alt="Employee photo" 
                  style="max-width: 150px; max-height: 150px; border-radius: 50%; border: 3px solid #667eea; object-fit: cover;">
           </div>`
        : '';
    
    funcionarioInfo.innerHTML = `
        ${photoHtml}
        <h4><i class="fas fa-user"></i> Dados do Funcionário Cadastrado</h4>
        <p><strong>Nome:</strong> ${funcionario.nome}</p>
        <p><strong>Email:</strong> ${funcionario.email}</p>
        <p><strong>Telefone:</strong> ${funcionario.telefone}</p>
        <p><strong>Cargo:</strong> ${funcionario.cargo}</p>
        <p><strong>Departamento:</strong> ${funcionario.departamento}</p>
        ${funcionario.dataAdmissao ? `<p><strong>Data de Admissão:</strong> ${new Date(funcionario.dataAdmissao).toLocaleDateString('pt-BR')}</p>` : ''}
        <p><strong>Status:</strong> ${funcionario.ativo ? 'Ativo' : 'Inativo'}</p>
        <p><strong>ID:</strong> ${funcionario.id}</p>
    `;
    
    openModal(successModal);
}

// Mostrar erro
function showError(message) {
    errorMessage.textContent = message;
    openModal(errorModal);
}

// Abrir modal
function openModal(modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Fechar modal
function closeModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Definir estado de carregamento
function setLoading(loading) {
    salvarBtn.disabled = loading;
    
    if (loading) {
        salvarBtn.classList.add('loading');
        salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';
    } else {
        salvarBtn.classList.remove('loading');
        salvarBtn.innerHTML = '<i class="fas fa-save"></i> Cadastrar Funcionário';
    }
}

// Limpar formulário
function limparFormulario() {
    form.reset();
    
    // Limpar preview da foto
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    if (photoPreview) {
        photoPreview.style.display = 'none';
        photoPreviewImg.src = '';
    }
    
    // Limpar todos os erros
    Object.keys(validacoes).forEach(campo => {
        clearFieldError(campo);
    });
    
    // Definir data padrão
    setDefaultDate();
    
    // Focar no primeiro campo
    document.getElementById('nome').focus();
}

// Preview da foto
function previewPhoto(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('photoPreviewImg');
    
    if (file) {
        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
            showFieldError('photo', 'Please select an image file');
            event.target.value = '';
            return;
        }
        
        // Validar tamanho (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showFieldError('photo', 'Image size must be less than 5MB');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        clearFieldError('photo');
    } else {
        preview.style.display = 'none';
        previewImg.src = '';
    }
}

// Converter arquivo para base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Utilitários
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

// Verificar se a API está disponível
async function checkAPIHealth() {
    try {
        const response = await fetch('/health');
        const result = await response.json();
        
        if (result.status === 'OK') {
            console.log('✅ API está funcionando corretamente');
        } else {
            console.warn('⚠️ API retornou status inesperado:', result);
        }
    } catch (error) {
        console.error('❌ Erro ao conectar com a API:', error);
        showError('Não foi possível conectar com o servidor. Verifique se a API está rodando na porta 3000.');
    }
}

// Verificar API ao carregar a página
document.addEventListener('DOMContentLoaded', checkAPIHealth);


