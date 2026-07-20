/**
 * Executa as tres cargas Bathware em sequencia (Flaminia, Valdama, Tecla).
 *
 * Uso:
 *   node scripts/import-all-bathware-products.js
 *   node scripts/import-all-bathware-products.js --dry-run
 */
const path = require('path');
const { runBathwareImport } = require('./import-bathware-products-lib');

const BRANDS = [
  { brandLabel: 'Flaminia', subcategoria: 'FLAMINIA', file: 'flaminia_new.xlsx' },
  { brandLabel: 'Valdama', subcategoria: 'VALDAMA', file: 'valdama_new.xlsx' },
  { brandLabel: 'Tecla', subcategoria: 'TECLA', file: 'tecla_new.xlsx' }
];

async function main() {
  const argv = process.argv;
  for (const brand of BRANDS) {
    console.log('\n============================================================');
    await runBathwareImport({
      brandLabel: brand.brandLabel,
      subcategoria: brand.subcategoria,
      defaultFile: path.join(__dirname, '..', brand.file),
      argv
    });
  }
  console.log('\nTodas as cargas Bathware concluidas.');
}

main().catch((err) => {
  console.error('Erro na carga Bathware:', err.message);
  process.exit(1);
});
