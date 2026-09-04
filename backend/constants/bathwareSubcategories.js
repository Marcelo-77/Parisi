const BATHWARE_SUBCATEGORIES = ['FLAMINIA', 'TECLA', 'VALDAMA'];

const BATH_SUBCATEGORIES = [
  'LINFA',
  'ELLISSE',
  'ENVY',
  'ELLI',
  'QUADRO',
  'HERMITAGE',
  'BLADE',
  'OVATION',
  'QUASAR',
  'FLOAT',
  'LOOM',
  'SOAK',
  'OVALE',
  'LHOTEL',
  'ROTONDO',
  'LOFT',
  'NETTUNO',
  'QTS',
  'NATURALE',
  'ATOMIC',
  'CURVA',
  'SOTTOVALE',
  'ATLAS',
  'SATURNIA',
  'AQUALINE'
];

const BATHWARE_SUBCATEGORY_LABELS = {
  FLAMINIA: 'Flaminia',
  TECLA: 'Tecla',
  VALDAMA: 'Valdama'
};

const BATH_SUBCATEGORY_LABELS = {
  LINFA: 'Linfa',
  ELLISSE: 'Ellisse',
  ENVY: 'Envy',
  ELLI: 'Elli',
  QUADRO: 'Quadro',
  HERMITAGE: 'Hermitage',
  BLADE: 'Blade',
  OVATION: 'Ovation',
  QUASAR: 'Quasar',
  FLOAT: 'Float',
  LOOM: 'Loom',
  SOAK: 'Soak',
  OVALE: 'Ovale',
  LHOTEL: "L'Hotel",
  ROTONDO: 'Rotondo',
  LOFT: 'Loft',
  NETTUNO: 'Nettuno',
  QTS: 'QTS',
  NATURALE: 'Naturale',
  ATOMIC: 'Atomic',
  CURVA: 'Curva',
  SOTTOVALE: 'Sottovale',
  ATLAS: 'Atlas',
  SATURNIA: 'Saturnia',
  AQUALINE: 'Aqualine'
};

function titleCaseSubcategory(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Normalize subcategory values (first word of Description from Bath LIST, or brand codes).
 */
function normalizeBathwareSubcategory(value) {
  if (value == null || value === '') return null;
  let normalized = String(value).trim().toUpperCase();
  normalized = normalized
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
  return normalized || null;
}

function isValidBathwareSubcategory(value) {
  if (value == null || value === '') return true;
  return Boolean(normalizeBathwareSubcategory(value));
}

function categorySupportsSubcategory(categoria) {
  const category = String(categoria || '').trim().toUpperCase();
  return category === 'BATHWARE' || category === 'BATH';
}

function getSubcategoriesForCategory(categoria) {
  const category = String(categoria || '').trim().toUpperCase();
  if (category === 'BATH') return BATH_SUBCATEGORIES.slice();
  if (category === 'BATHWARE') return BATHWARE_SUBCATEGORIES.slice();
  return [];
}

function formatBathwareSubcategoryLabel(value) {
  const normalized = normalizeBathwareSubcategory(value);
  if (!normalized) return '-';
  return (
    BATHWARE_SUBCATEGORY_LABELS[normalized] ||
    BATH_SUBCATEGORY_LABELS[normalized] ||
    titleCaseSubcategory(normalized)
  );
}

module.exports = {
  BATHWARE_SUBCATEGORIES,
  BATH_SUBCATEGORIES,
  BATHWARE_SUBCATEGORY_LABELS,
  BATH_SUBCATEGORY_LABELS,
  isValidBathwareSubcategory,
  normalizeBathwareSubcategory,
  formatBathwareSubcategoryLabel,
  categorySupportsSubcategory,
  getSubcategoriesForCategory
};
