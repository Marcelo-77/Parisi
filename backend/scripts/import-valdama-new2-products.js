/**
 * Carga de produtos a partir de backend/valdama_new2.xlsx
 *
 * Regras:
 * - Se Product (codigo) NAO existir em warehouse_items: INSERT
 *     codigo, nome, barcode, categoria = BATHWARE, subcategoria = VALDAMA
 * - Se Product JA existir: UPDATE nome, barcode, categoria, subcategoria
 *
 * Uso:
 *   node scripts/import-valdama-new2-products.js
 *   node scripts/import-valdama-new2-products.js --file=valdama_new2.xlsx
 *   node scripts/import-valdama-new2-products.js --dry-run
 */
const path = require('path');
const { runBathwareImport } = require('./import-bathware-products-lib');

runBathwareImport({
  brandLabel: 'Valdama (new2)',
  subcategoria: 'VALDAMA',
  defaultFile: path.join(__dirname, '..', 'valdama_new2.xlsx')
}).catch((err) => {
  console.error('Erro na carga Valdama new2:', err.message);
  process.exit(1);
});
