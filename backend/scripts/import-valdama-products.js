/**
 * Carga de produtos a partir de backend/valdama_new.xlsx
 *
 * Regras:
 * - Se Product (codigo) NAO existir em warehouse_items: INSERT
 *     codigo, nome, barcode, categoria = BATHWARE, subcategoria = VALDAMA
 * - Se Product JA existir: UPDATE nome, barcode, categoria, subcategoria
 *
 * Uso:
 *   node scripts/import-valdama-products.js
 *   node scripts/import-valdama-products.js --file=valdama_new.xlsx
 *   node scripts/import-valdama-products.js --dry-run
 */
const path = require('path');
const { runBathwareImport } = require('./import-bathware-products-lib');

runBathwareImport({
  brandLabel: 'Valdama',
  subcategoria: 'VALDAMA',
  defaultFile: path.join(__dirname, '..', 'valdama_new.xlsx')
}).catch((err) => {
  console.error('Erro na carga Valdama:', err.message);
  process.exit(1);
});
