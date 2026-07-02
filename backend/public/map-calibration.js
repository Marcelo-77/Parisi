(function (global) {
    const CORNER_KEYS = ['tl', 'tr', 'bl', 'br'];
    const CORNER_LABELS = {
        tl: 'I8 (top-left)',
        tr: 'H33 (top-right)',
        bl: 'A49 (bottom)',
        br: 'A72 (bottom-right)'
    };

    function cloneCorners(corners) {
        return {
            tl: { x: corners.tl.x, y: corners.tl.y },
            tr: { x: corners.tr.x, y: corners.tr.y },
            bl: { x: corners.bl.x, y: corners.bl.y },
            br: { x: corners.br.x, y: corners.br.y }
        };
    }

    function createCalibrationStack(container, imageUrl, initialCorners, options) {
        const opts = options || {};
        const corners = cloneCorners(initialCorners || WarehouseMapUtils.DEFAULT_IMAGE_CORNERS);

        container.innerHTML = '';
        const stack = document.createElement('div');
        stack.className = 'map-calibration-stack';

        const img = document.createElement('img');
        img.className = 'map-calibration-image';
        img.alt = 'Warehouse map calibration';
        img.src = imageUrl;

        const overlay = document.createElement('div');
        overlay.className = 'map-calibration-overlay';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'map-calibration-quad');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('class', 'map-calibration-quad-shape');
        svg.appendChild(polygon);
        overlay.appendChild(svg);

        const markerLayer = document.createElement('div');
        markerLayer.className = 'map-calibration-marker-layer';
        overlay.appendChild(markerLayer);

        const handles = {};
        let dragState = null;

        function updateQuad() {
            const points = [
                `${corners.tl.x * 100},${corners.tl.y * 100}`,
                `${corners.tr.x * 100},${corners.tr.y * 100}`,
                `${corners.br.x * 100},${corners.br.y * 100}`,
                `${corners.bl.x * 100},${corners.bl.y * 100}`
            ].join(' ');
            polygon.setAttribute('points', points);
        }

        function updateHandles() {
            CORNER_KEYS.forEach((key) => {
                const handle = handles[key];
                handle.style.left = `${corners[key].x * 100}%`;
                handle.style.top = `${corners[key].y * 100}%`;
            });
            updateQuad();
            if (typeof opts.onChange === 'function') {
                opts.onChange(cloneCorners(corners));
            }
        }

        function onPointerMove(event) {
            if (!dragState) return;
            const rect = stack.getBoundingClientRect();
            const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
            corners[dragState.key] = { x, y };
            updateHandles();
        }

        function onPointerUp() {
            dragState = null;
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        }

        CORNER_KEYS.forEach((key) => {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = `map-calibration-handle map-calibration-handle-${key}`;
            handle.title = CORNER_LABELS[key];
            handle.setAttribute('aria-label', CORNER_LABELS[key]);
            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                dragState = { key };
                handle.setPointerCapture(event.pointerId);
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            });
            handles[key] = handle;
            overlay.appendChild(handle);
        });

        stack.appendChild(img);
        stack.appendChild(overlay);
        container.appendChild(stack);

        img.addEventListener('load', updateHandles);
        if (img.complete) updateHandles();

        function clearPreviewMarkers() {
            markerLayer.querySelectorAll('.warehouse-map-blink-marker').forEach((el) => el.remove());
        }

        function previewMarkers(locationIndex, filterFn) {
            clearPreviewMarkers();
            if (!locationIndex || !locationIndex.locations) return;

            const normalized = WarehouseMapUtils.normalizeLocationIndex(locationIndex);
            normalized.imageCorners = cloneCorners(corners);

            Object.keys(normalized.locations).forEach((code) => {
                if (typeof filterFn === 'function' && !filterFn(code)) return;
                const pos = normalized.locations[code];
                const point = WarehouseMapUtils.getLocationVisualPoint(code, normalized);
                if (!point) return;

                const marker = document.createElement('div');
                marker.className = 'warehouse-map-blink-marker map-calibration-preview-marker';
                const sector = code.charAt(0).toLowerCase();
                if (sector) marker.classList.add(`sector-${sector}`);

                const style = WarehouseMapUtils.locationCircleMarkerStyles(
                    pos.row,
                    pos.col,
                    normalized,
                    code
                );
                marker.style.left = style.left;
                marker.style.top = style.top;
                marker.style.width = style.width;
                marker.style.height = style.height;
                marker.title = code;
                markerLayer.appendChild(marker);
            });
        }

        return {
            getCorners: () => cloneCorners(corners),
            setCorners: (nextCorners) => {
                Object.assign(corners, cloneCorners(nextCorners));
                updateHandles();
            },
            previewMarkers,
            clearPreviewMarkers,
            destroy: () => {
                onPointerUp();
                container.innerHTML = '';
            }
        };
    }

    async function fetchLocationIndex() {
        const response = await fetch('/api/warehouse-map/locations');
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.exists || !data.data) {
            return null;
        }
        return WarehouseMapUtils.normalizeLocationIndex(data.data);
    }

    async function saveImageCorners(corners) {
        const existing = await fetchLocationIndex();
        if (!existing) {
            throw new Error('Location index not found. Upload Excel first to generate coordinates.');
        }

        const payload = {
            ...existing,
            imageCorners: cloneCorners(corners),
            calibrationAnchors: existing.calibrationAnchors || { ...WarehouseMapUtils.DEFAULT_CALIBRATION_ANCHORS }
        };
        delete payload.visualGrid;

        const response = await fetch('/api/warehouse-map/locations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to save calibration.');
        }
        return data;
    }

    global.MapCalibration = {
        createCalibrationStack,
        fetchLocationIndex,
        saveImageCorners
    };
})(window);
