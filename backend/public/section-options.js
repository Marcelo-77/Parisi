(function (global) {
    const SECTION_OPTIONS = [
        { value: 'TAPWARE', label: 'Tapware' },
        { value: 'BATHWARE', label: 'BathWare' },
        { value: 'CENTRAL', label: 'Central' },
        { value: 'WAREHOUSE2', label: 'Warehouse2' },
        { value: 'FURNITUREWARE', label: 'Furnitureware' },
        { value: 'DOORWARE', label: 'Doorware' },
        { value: 'OTHER', label: 'Other' }
    ];

    const SECTION_LABELS = SECTION_OPTIONS.reduce((map, item) => {
        map[item.value] = item.label;
        return map;
    }, {});

    function formatSectionLabel(value) {
        const normalized = value != null ? String(value).trim().toUpperCase() : '';
        if (!normalized) return '-';
        return SECTION_LABELS[normalized] || value;
    }

    function buildSectionSelectOptions(config) {
        const options = config || {};
        const includeEmpty = options.includeEmpty !== false;
        const emptyLabel = options.emptyLabel || 'Select section';
        const emptyValue = options.emptyValue != null ? options.emptyValue : '';

        const parts = [];
        if (includeEmpty) {
            parts.push(`<option value="${emptyValue}">${emptyLabel}</option>`);
        }
        SECTION_OPTIONS.forEach((item) => {
            parts.push(`<option value="${item.value}">${item.label}</option>`);
        });
        return parts.join('');
    }

    function populateSectionSelect(selectEl, config) {
        if (!selectEl) return;
        selectEl.innerHTML = buildSectionSelectOptions(config);
    }

    function formatSectorDisplay(value) {
        const normalized = value != null ? String(value).trim() : '';
        if (!normalized) return 'For everyone';
        return formatSectionLabel(normalized);
    }

    global.SectionOptions = {
        SECTION_OPTIONS,
        SECTION_LABELS,
        formatSectionLabel,
        formatSectorDisplay,
        buildSectionSelectOptions,
        populateSectionSelect
    };
})(window);
