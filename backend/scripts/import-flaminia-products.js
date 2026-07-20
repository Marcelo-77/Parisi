/**
 * Carga de produtos a partir de backend/flaminia_new.xlsx
 *
 * Regras:
 * - Se Product (codigo) NAO existir em warehouse_items: INSERT
 *     codigo, nome, barcode, categoria = BATHWARE, subcategoria = FLAMINIA
 * - Se Product JA existir: UPDATE nome, barcode, categoria, subcategoria
 *
 * Uso:
 *   node scripts/import-flaminia-products.js
 *   node scripts/import-flaminia-products.js --file=flaminia_new.xlsx
 *   node scripts/import-flaminia-products.js --dry-run
 */
const path = require('path');
const { runBathwareImport } = require('./import-bathware-products-lib');

runBathwareImport({
  brandLabel: 'Flaminia',
  subcategoria: 'FLAMINIA',
  defaultFile: path.join(__dirname, '..', 'flaminia_new.xlsx')
}).catch((err) => {
  console.error('Erro na carga Flaminia:', err.message);
  process.exit(1);
});
