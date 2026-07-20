const BATHWARE_SUBCATEGORIES = ['FLAMINIA', 'TECLA', 'VALDAMA'];

const BATHWARE_SUBCATEGORY_LABELS = {
  FLAMINIA: 'Flaminia',
  TECLA: 'Tecla',
  VALDAMA: 'Valdama'
};

function isValidBathwareSubcategory(value) {
  if (value == null || value === '') return true;
  return BATHWARE_SUBCATEGORIES.includes(String(value).trim().toUpperCase());
}

function normalizeBathwareSubcategory(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toUpperCase();
  return BATHWARE_SUBCATEGORIES.includes(normalized) ? normalized : null;
}

module.exports = {
  BATHWARE_SUBCATEGORIES,
  BATHWARE_SUBCATEGORY_LABELS,
  isValidBathwareSubcategory,
  normalizeBathwareSubcategory
};
