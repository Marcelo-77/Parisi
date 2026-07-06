const { v4: uuidv4 } = require('uuid');

class Funcionario {
  constructor(dados) {
    this.id = dados.id || uuidv4();
    this.nome = dados.nome;
    this.email = dados.email;
    this.password = dados.password || dados.senha || null;
    this.telefone = dados.telefone;
    this.cargo = dados.cargo;
    this.departamento = dados.departamento;
    this.sector = dados.sector || null;
    this.companyId = dados.companyId || null;
    this.companyName = dados.companyName || null;
    this.dataAdmissao = dados.dataAdmissao || new Date().toISOString().split('T')[0];
    this.photo = dados.photo || null;
    this.ativo = dados.ativo !== undefined ? dados.ativo : true;
    this.criadoEm = dados.criadoEm || new Date().toISOString();
    this.atualizadoEm = dados.atualizadoEm || new Date().toISOString();
  }

  // Basic data validation
  validar() {
    const erros = [];

    if (!this.nome || this.nome.trim().length < 2) {
      erros.push('Name must have at least 2 characters');
    }

    if (!this.email || !this.validarEmail(this.email)) {
      erros.push('Email must have a valid format');
    }

    if (!this.password || this.password.length < 6) {
      erros.push('Password must have at least 6 characters');
    }

    if (!this.telefone || this.telefone.trim().length < 10) {
      erros.push('Phone must have at least 10 digits');
    }

    if (!this.cargo || this.cargo.trim().length < 2) {
      erros.push('Position must have at least 2 characters');
    }

    if (!this.departamento || this.departamento.trim().length < 2) {
      erros.push('Department must have at least 2 characters');
    }

    if (!this.companyId) {
      erros.push('Company is required');
    }

    if (this.dataAdmissao && !this.validarData(this.dataAdmissao)) {
      erros.push('Admission date must be in YYYY-MM-DD format');
    }

    return erros;
  }

  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  validarData(data) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(data)) return false;
    
    const dataObj = new Date(data);
    return dataObj instanceof Date && !isNaN(dataObj);
  }

  // Update employee data
  atualizar(dados) {
    const camposPermitidos = ['nome', 'email', 'telefone', 'cargo', 'departamento', 'sector', 'dataAdmissao', 'photo', 'ativo', 'companyId'];
    
    camposPermitidos.forEach(campo => {
      if (dados[campo] !== undefined) {
        this[campo] = dados[campo];
      }
    });
    
    this.atualizadoEm = new Date().toISOString();
  }

  // Convert to simple object
  toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      telefone: this.telefone,
      cargo: this.cargo,
      departamento: this.departamento,
      sector: this.sector || null,
      companyId: this.companyId,
      companyName: this.companyName,
      dataAdmissao: this.dataAdmissao,
      photo: this.photo,
      ativo: this.ativo,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}

module.exports = Funcionario;

