const Funcionario = require('../models/Funcionario');
const fs = require('fs').promises;
const path = require('path');

class FuncionarioService {
  constructor() {
    // File to persist data
    this.dataFile = path.join(__dirname, '..', 'data', 'funcionarios.json');
    this.funcionarios = [];
    this.initializeData();
  }

  // Initialize data (load from file or create sample data)
  async initializeData() {
    try {
      await this.loadFromFile();
      console.log(`✅ Data loaded: ${this.funcionarios.length} employees`);
    } catch (error) {
      console.log('📝 Data file not found, creating sample data...');
      this.initializeSampleData();
      await this.saveToFile();
    }
  }

  // Initialize with some sample data
  initializeSampleData() {
    const funcionariosExemplo = [
      {
        nome: 'João Silva',
        email: 'joao.silva@empresa.com',
        telefone: '(11) 99999-9999',
        cargo: 'Desenvolvedor',
        departamento: 'TI',
        salario: 5000,
        dataAdmissao: '2023-01-15'
      },
      {
        nome: 'Maria Santos',
        email: 'maria.santos@empresa.com',
        telefone: '(11) 88888-8888',
        cargo: 'Analista',
        departamento: 'RH',
        salario: 4500,
        dataAdmissao: '2023-03-20'
      }
    ];

    funcionariosExemplo.forEach(dados => {
      const funcionario = new Funcionario(dados);
      this.funcionarios.push(funcionario);
    });
  }

  // Load data from JSON file
  async loadFromFile() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const funcionariosData = JSON.parse(data);
      
      this.funcionarios = funcionariosData.map(dados => new Funcionario(dados));
    } catch (error) {
      throw new Error(`Error loading data: ${error.message}`);
    }
  }

  // Save data to JSON file
  async saveToFile() {
    try {
      // Create directory if it doesn't exist
      const dataDir = path.dirname(this.dataFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Convert employees to JSON format
      const funcionariosData = this.funcionarios.map(funcionario => funcionario.toJSON());
      
      // Save to file
      await fs.writeFile(this.dataFile, JSON.stringify(funcionariosData, null, 2), 'utf8');
      
      console.log(`💾 Data saved: ${this.funcionarios.length} employees`);
    } catch (error) {
      console.error(`❌ Error saving data: ${error.message}`);
      throw new Error(`Error saving data: ${error.message}`);
    }
  }

  // Create new employee
  async criar(dados) {
    const funcionario = new Funcionario(dados);
    const erros = funcionario.validar();
    
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Check if email already exists
    const emailExistente = this.funcionarios.find(f => f.email === funcionario.email);
    if (emailExistente) {
      throw new Error('Email already registered for another employee');
    }

    this.funcionarios.push(funcionario);
    
    // Save to file
    await this.saveToFile();
    
    return funcionario;
  }

  // Find all employees
  buscarTodos(filtros = {}) {
    let funcionarios = [...this.funcionarios];

    // Apply filters
    if (filtros.ativo !== undefined) {
      funcionarios = funcionarios.filter(f => f.ativo === filtros.ativo);
    }

    if (filtros.departamento) {
      funcionarios = funcionarios.filter(f => 
        f.departamento.toLowerCase().includes(filtros.departamento.toLowerCase())
      );
    }

    if (filtros.cargo) {
      funcionarios = funcionarios.filter(f => 
        f.cargo.toLowerCase().includes(filtros.cargo.toLowerCase())
      );
    }

    if (filtros.nome) {
      funcionarios = funcionarios.filter(f => 
        f.nome.toLowerCase().includes(filtros.nome.toLowerCase())
      );
    }

    // Sorting
    if (filtros.ordenarPor) {
      const campo = filtros.ordenarPor;
      const direcao = filtros.direcao || 'asc';
      
      funcionarios.sort((a, b) => {
        if (direcao === 'desc') {
          return b[campo] > a[campo] ? 1 : -1;
        }
        return a[campo] > b[campo] ? 1 : -1;
      });
    }

    return funcionarios;
  }

  // Find employee by ID
  buscarPorId(id) {
    const funcionario = this.funcionarios.find(f => f.id === id);
    if (!funcionario) {
      throw new Error('Employee not found');
    }
    return funcionario;
  }

  // Update employee
  async atualizar(id, dados) {
    const funcionario = this.buscarPorId(id);
    
    // Check if email already exists in another employee
    if (dados.email && dados.email !== funcionario.email) {
      const emailExistente = this.funcionarios.find(f => f.email === dados.email && f.id !== id);
      if (emailExistente) {
        throw new Error('Email already registered for another employee');
      }
    }

    funcionario.atualizar(dados);
    
    // Validate updated data
    const erros = funcionario.validar();
    if (erros.length > 0) {
      throw new Error(`Invalid data: ${erros.join(', ')}`);
    }

    // Save to file
    await this.saveToFile();

    return funcionario;
  }

  // Delete employee (soft delete)
  async excluir(id) {
    const funcionario = this.buscarPorId(id);
    funcionario.ativo = false;
    funcionario.atualizadoEm = new Date().toISOString();
    
    // Save to file
    await this.saveToFile();
    
    return funcionario;
  }

  // Permanently delete employee
  async excluirPermanentemente(id) {
    const index = this.funcionarios.findIndex(f => f.id === id);
    if (index === -1) {
      throw new Error('Employee not found');
    }
    
    const funcionario = this.funcionarios[index];
    this.funcionarios.splice(index, 1);
    
    // Save to file
    await this.saveToFile();
    
    return funcionario;
  }

  // Statistics
  obterEstatisticas() {
    const total = this.funcionarios.length;
    const ativos = this.funcionarios.filter(f => f.ativo).length;
    const inativos = total - ativos;

    const departamentos = {};
    const cargos = {};
    let salarioTotal = 0;
    let salarioMedio = 0;

    this.funcionarios.forEach(f => {
      if (f.ativo) {
        // Contar departamentos
        departamentos[f.departamento] = (departamentos[f.departamento] || 0) + 1;
        
        // Contar cargos
        cargos[f.cargo] = (cargos[f.cargo] || 0) + 1;
        
        // Calcular salário médio
        if (f.salario) {
          salarioTotal += f.salario;
        }
      }
    });

    if (ativos > 0) {
      salarioMedio = salarioTotal / ativos;
    }

    return {
      total,
      ativos,
      inativos,
      departamentos,
      cargos,
      salarioMedio: Math.round(salarioMedio * 100) / 100
    };
  }
}

module.exports = new FuncionarioService();

