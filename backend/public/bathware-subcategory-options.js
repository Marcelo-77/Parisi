(function (global) {
    const BATHWARE_SUBCATEGORY_OPTIONS = [
        { value: 'FLAMINIA', label: 'Flaminia' },
        { value: 'TECLA', label: 'Tecla' },
        { value: 'VALDAMA', label: 'Valdama' }
    ];

    const BATHWARE_SUBCATEGORY_LABELS = BATHWARE_SUBCATEGORY_OPTIONS.reduce((map, item) => {
        map[item.value] = item.label;
        return map;
    }, {});

    function formatBathwareSubcategoryLabel(value) {
        const normalized = value != null ? String(value).trim().toUpperCase() : '';
        if (!normalized) return '-';
        return BATHWARE_SUBCATEGORY_LABELS[normalized] || value;
    }

    function buildBathwareSubcategorySelectOptions(config) {
        const options = config || {};
        const includeEmpty = options.includeEmpty !== false;
        const emptyLabel = options.emptyLabel || 'Select subcategory';
        const emptyValue = options.emptyValue != null ? options.emptyValue : '';

        const parts = [];
        if (includeEmpty) {
            parts.push(`<option value="${emptyValue}">${emptyLabel}</option>`);
        }
        BATHWARE_SUBCATEGORY_OPTIONS.forEach((item) => {
            parts.push(`<option value="${item.value}">${item.label}</option>`);
        });
        return parts.join('');
    }

    function populateBathwareSubcategorySelect(selectEl, config) {
        if (!selectEl) return;
        selectEl.innerHTML = buildBathwareSubcategorySelectOptions(config);
    }

    global.BathwareSubcategoryOptions = {
        BATHWARE_SUBCATEGORY_OPTIONS,
        BATHWARE_SUBCATEGORY_LABELS,
        formatBathwareSubcategoryLabel,
        buildBathwareSubcategorySelectOptions,
        populateBathwareSubcategorySelect
    };
})(window);
