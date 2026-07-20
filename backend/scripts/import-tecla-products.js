/**
 * Carga de produtos a partir de backend/tecla_new.xlsx
 *
 * Regras:
 * - Se Product (codigo) NAO existir em warehouse_items: INSERT
 *     codigo, nome, barcode, categoria = BATHWARE, subcategoria = TECLA
 * - Se Product JA existir: UPDATE nome, barcode, categoria, subcategoria
 *
 * Uso:
 *   node scripts/import-tecla-products.js
 *   node scripts/import-tecla-products.js --file=tecla_new.xlsx
 *   node scripts/import-tecla-products.js --dry-run
 */
const path = require('path');
const { runBathwareImport } = require('./import-bathware-products-lib');

runBathwareImport({
  brandLabel: 'Tecla',
  subcategoria: 'TECLA',
  defaultFile: path.join(__dirname, '..', 'tecla_new.xlsx')
}).catch((err) => {
  console.error('Erro na carga Tecla:', err.message);
  process.exit(1);
});
