# Sistema de Cadastro de Funcionários

API REST para gerenciamento de funcionários com operações CRUD completas.

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js (versão 14 ou superior)
- npm ou yarn

### Instalação
```bash
cd backend
npm install
```

### Execução
```bash
# Desenvolvimento (com nodemon)
npm run dev

# Produção
npm start
```

O servidor estará disponível em `http://localhost:3000`

## 📋 Endpoints da API

### Base URL
```
http://localhost:3000/api/funcionarios
```

### 1. Listar Funcionários
**GET** `/api/funcionarios`

**Query Parameters:**
- `ativo` (boolean, opcional): Filtrar por status ativo/inativo
- `departamento` (string, opcional): Filtrar por departamento
- `cargo` (string, opcional): Filtrar por cargo
- `nome` (string, opcional): Filtrar por nome
- `ordenarPor` (string, opcional): Campo para ordenação (nome, cargo, departamento, dataAdmissao, salario)
- `direcao` (string, opcional): Direção da ordenação (asc, desc)

**Exemplo:**
```bash
GET /api/funcionarios?ativo=true&departamento=TI&ordenarPor=nome&direcao=asc
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nome": "João Silva",
      "email": "joao.silva@empresa.com",
      "telefone": "(11) 99999-9999",
      "cargo": "Desenvolvedor",
      "departamento": "TI",
      "salario": 5000,
      "dataAdmissao": "2023-01-15",
      "ativo": true,
      "criadoEm": "2023-12-01T10:00:00.000Z",
      "atualizadoEm": "2023-12-01T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 2. Buscar Funcionário por ID
**GET** `/api/funcionarios/:id`

**Parâmetros:**
- `id` (UUID): ID único do funcionário

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nome": "João Silva",
    "email": "joao.silva@empresa.com",
    "telefone": "(11) 99999-9999",
    "cargo": "Desenvolvedor",
    "departamento": "TI",
    "salario": 5000,
    "dataAdmissao": "2023-01-15",
    "ativo": true,
    "criadoEm": "2023-12-01T10:00:00.000Z",
    "atualizadoEm": "2023-12-01T10:00:00.000Z"
  }
}
```

### 3. Criar Funcionário
**POST** `/api/funcionarios`

**Body (JSON):**
```json
{
  "nome": "João Silva",
  "email": "joao.silva@empresa.com",
  "telefone": "(11) 99999-9999",
  "cargo": "Desenvolvedor",
  "departamento": "TI",
  "salario": 5000,
  "dataAdmissao": "2023-01-15",
  "ativo": true
}
```

**Campos obrigatórios:**
- `nome`: Nome completo (2-100 caracteres)
- `email`: Email válido e único
- `telefone`: Telefone (10-20 caracteres)
- `cargo`: Cargo (2-50 caracteres)
- `departamento`: Departamento (2-50 caracteres)

**Campos opcionais:**
- `salario`: Salário (número positivo)
- `dataAdmissao`: Data no formato YYYY-MM-DD
- `ativo`: Status ativo (boolean, padrão: true)

**Resposta:**
```json
{
  "success": true,
  "message": "Funcionário criado com sucesso",
  "data": {
    "id": "uuid-gerado",
    "nome": "João Silva",
    "email": "joao.silva@empresa.com",
    "telefone": "(11) 99999-9999",
    "cargo": "Desenvolvedor",
    "departamento": "TI",
    "salario": 5000,
    "dataAdmissao": "2023-01-15",
    "ativo": true,
    "criadoEm": "2023-12-01T10:00:00.000Z",
    "atualizadoEm": "2023-12-01T10:00:00.000Z"
  }
}
```

### 4. Atualizar Funcionário (Completo)
**PUT** `/api/funcionarios/:id`

**Body (JSON):** Mesmo formato do POST, todos os campos são obrigatórios.

### 5. Atualizar Funcionário (Parcial)
**PATCH** `/api/funcionarios/:id`

**Body (JSON):** Apenas os campos que deseja atualizar.

**Exemplo:**
```json
{
  "salario": 5500,
  "cargo": "Desenvolvedor Sênior"
}
```

### 6. Desativar Funcionário (Soft Delete)
**DELETE** `/api/funcionarios/:id`

**Resposta:**
```json
{
  "success": true,
  "message": "Funcionário desativado com sucesso",
  "data": {
    "id": "uuid",
    "ativo": false,
    "atualizadoEm": "2023-12-01T10:00:00.000Z"
  }
}
```

### 7. Excluir Funcionário Permanentemente
**DELETE** `/api/funcionarios/:id/permanente`

**Resposta:**
```json
{
  "success": true,
  "message": "Funcionário excluído permanentemente",
  "data": {
    "id": "uuid",
    "nome": "João Silva",
    // ... outros dados
  }
}
```

### 8. Estatísticas
**GET** `/api/funcionarios/estatisticas`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "ativos": 8,
    "inativos": 2,
    "departamentos": {
      "TI": 5,
      "RH": 3,
      "Vendas": 2
    },
    "cargos": {
      "Desenvolvedor": 3,
      "Analista": 2,
      "Gerente": 1
    },
    "salarioMedio": 4500.50
  }
}
```

### 9. Health Check
**GET** `/health`

**Resposta:**
```json
{
  "status": "OK",
  "message": "Servidor funcionando corretamente",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 🔧 Códigos de Status HTTP

- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Dados inválidos
- `404` - Funcionário não encontrado
- `409` - Conflito (email já cadastrado)
- `500` - Erro interno do servidor

## 📝 Exemplos de Uso

### Criar um funcionário
```bash
curl -X POST http://localhost:3000/api/funcionarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Santos",
    "email": "maria.santos@empresa.com",
    "telefone": "(11) 88888-8888",
    "cargo": "Analista",
    "departamento": "RH",
    "salario": 4500
  }'
```

### Buscar funcionários ativos do departamento TI
```bash
curl "http://localhost:3000/api/funcionarios?ativo=true&departamento=TI"
```

### Atualizar salário de um funcionário
```bash
curl -X PATCH http://localhost:3000/api/funcionarios/uuid-do-funcionario \
  -H "Content-Type: application/json" \
  -d '{"salario": 5500}'
```

## 🛡️ Validações

- **Nome**: 2-100 caracteres
- **Email**: Formato válido e único
- **Telefone**: 10-20 caracteres
- **Cargo**: 2-50 caracteres
- **Departamento**: 2-50 caracteres
- **Salário**: Número positivo
- **Data de Admissão**: Formato YYYY-MM-DD
- **ID**: UUID válido

## 🏗️ Estrutura do Projeto

```
backend/
├── models/
│   └── Funcionario.js          # Modelo de dados
├── routes/
│   └── funcionarios.js         # Rotas da API
├── services/
│   └── funcionarioService.js   # Lógica de negócio
├── server.js                   # Servidor principal
├── package.json                # Dependências
└── README.md                   # Documentação
```

## 🔄 Funcionalidades

- ✅ CRUD completo de funcionários
- ✅ Validação de dados
- ✅ Filtros e ordenação
- ✅ Soft delete
- ✅ Estatísticas
- ✅ Health check
- ✅ Tratamento de erros
- ✅ Logs de requisições
- ✅ Segurança com Helmet
- ✅ CORS habilitado

## 🚀 Próximos Passos

- [ ] Integração com banco de dados (PostgreSQL/MongoDB)
- [ ] Autenticação e autorização
- [ ] Upload de fotos
- [ ] Relatórios em PDF
- [ ] Testes automatizados
- [ ] Docker
- [ ] CI/CD

