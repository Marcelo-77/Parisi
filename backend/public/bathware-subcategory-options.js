(function (global) {
    const BATHWARE_SUBCATEGORY_OPTIONS = [
        { value: 'FLAMINIA', label: 'Flaminia' },
        { value: 'TECLA', label: 'Tecla' },
        { value: 'VALDAMA', label: 'Valdama' }
    ];

    const BATH_SUBCATEGORY_OPTIONS = [
        { value: 'LINFA', label: 'Linfa' },
        { value: 'ELLISSE', label: 'Ellisse' },
        { value: 'ENVY', label: 'Envy' },
        { value: 'ELLI', label: 'Elli' },
        { value: 'QUADRO', label: 'Quadro' },
        { value: 'HERMITAGE', label: 'Hermitage' },
        { value: 'BLADE', label: 'Blade' },
        { value: 'OVATION', label: 'Ovation' },
        { value: 'QUASAR', label: 'Quasar' },
        { value: 'FLOAT', label: 'Float' },
        { value: 'LOOM', label: 'Loom' },
        { value: 'SOAK', label: 'Soak' },
        { value: 'OVALE', label: 'Ovale' },
        { value: 'LHOTEL', label: "L'Hotel" },
        { value: 'ROTONDO', label: 'Rotondo' },
        { value: 'LOFT', label: 'Loft' },
        { value: 'NETTUNO', label: 'Nettuno' },
        { value: 'QTS', label: 'QTS' },
        { value: 'NATURALE', label: 'Naturale' },
        { value: 'ATOMIC', label: 'Atomic' },
        { value: 'CURVA', label: 'Curva' },
        { value: 'SOTTOVALE', label: 'Sottovale' },
        { value: 'ATLAS', label: 'Atlas' },
        { value: 'SATURNIA', label: 'Saturnia' },
        { value: 'AQUALINE', label: 'Aqualine' }
    ];

    const ALL_SUBCATEGORY_LABELS = {};
    BATHWARE_SUBCATEGORY_OPTIONS.concat(BATH_SUBCATEGORY_OPTIONS).forEach((item) => {
        ALL_SUBCATEGORY_LABELS[item.value] = item.label;
    });

    function titleCase(value) {
        return String(value || '')
            .toLowerCase()
            .split(/[_\s-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function normalizeSubcategory(value) {
        return value != null
            ? String(value).trim().toUpperCase().replace(/['’]/g, '')
            : '';
    }

    function formatBathwareSubcategoryLabel(value) {
        const normalized = normalizeSubcategory(value);
        if (!normalized) return '-';
        return ALL_SUBCATEGORY_LABELS[normalized] || titleCase(normalized);
    }

    function optionsForCategory(categoria) {
        const category = String(categoria || '').trim().toUpperCase();
        if (category === 'BATH') return BATH_SUBCATEGORY_OPTIONS.slice();
        if (category === 'BATHWARE') return BATHWARE_SUBCATEGORY_OPTIONS.slice();
        // Default: all known options (filters / legacy)
        return BATHWARE_SUBCATEGORY_OPTIONS.concat(BATH_SUBCATEGORY_OPTIONS);
    }

    function categoryHasSubcategories(categoria) {
        const category = String(categoria || '').trim().toUpperCase();
        return category === 'BATHWARE' || category === 'BATH';
    }

    function buildBathwareSubcategorySelectOptions(config) {
        const options = config || {};
        const includeEmpty = options.includeEmpty !== false;
        const emptyLabel = options.emptyLabel || 'Select subcategory';
        const emptyValue = options.emptyValue != null ? options.emptyValue : '';
        const extraValues = Array.isArray(options.extraValues) ? options.extraValues : [];
        const baseOptions = optionsForCategory(options.category);

        const known = new Map(baseOptions.map((item) => [item.value, item.label]));
        extraValues.forEach((raw) => {
            const value = normalizeSubcategory(raw);
            if (value && !known.has(value)) {
                known.set(value, formatBathwareSubcategoryLabel(value));
            }
        });

        const parts = [];
        if (includeEmpty) {
            parts.push(`<option value="${emptyValue}">${emptyLabel}</option>`);
        }
        Array.from(known.entries())
            .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
            .forEach(([value, label]) => {
                parts.push(`<option value="${value}">${label}</option>`);
            });
        return parts.join('');
    }

    function populateBathwareSubcategorySelect(selectEl, config) {
        if (!selectEl) return;
        const current = selectEl.value;
        selectEl.innerHTML = buildBathwareSubcategorySelectOptions(config);
        if (current) {
            selectEl.value = current;
            if (selectEl.value !== current) {
                const option = document.createElement('option');
                option.value = current;
                option.textContent = formatBathwareSubcategoryLabel(current);
                selectEl.appendChild(option);
                selectEl.value = current;
            }
        }
    }

    global.BathwareSubcategoryOptions = {
        BATHWARE_SUBCATEGORY_OPTIONS,
        BATH_SUBCATEGORY_OPTIONS,
        BATHWARE_SUBCATEGORY_LABELS: BATHWARE_SUBCATEGORY_OPTIONS.reduce((map, item) => {
            map[item.value] = item.label;
            return map;
        }, {}),
        formatBathwareSubcategoryLabel,
        buildBathwareSubcategorySelectOptions,
        populateBathwareSubcategorySelect,
        categoryHasSubcategories,
        optionsForCategory
    };
})(window);
