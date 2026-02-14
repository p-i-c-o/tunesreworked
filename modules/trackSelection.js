export function createTrackSelection({ appState, log } = {}) {
    const state = {
        // Anchor for shift-select
        anchorTrackId: null,
    };

    function isSelectableTrackId(trackId) {
        return Number.isFinite(trackId) && trackId >= 0;
    }

    function getSelectedTrackIds() {
        const ids = appState?.selectedTrackIds || [];
        return Array.isArray(ids) ? ids.filter((n) => Number.isFinite(n)) : [];
    }

    function setSelectedTrackIds(ids) {
        const unique = Array.from(new Set((ids || []).filter((n) => Number.isFinite(n))));
        appState.selectedTrackIds = unique;
        applySelectionToDom();
    }

    function clearSelection() {
        state.anchorTrackId = null;
        setSelectedTrackIds([]);
    }

    function getVisibleTrackIds() {
        const tbody = document.getElementById('trackTableBody');
        if (!tbody) return [];
        const rows = Array.from(tbody.querySelectorAll('tr[data-track-id]'));
        const ids = rows
            .map((row) => Number(row.getAttribute('data-track-id')))
            .filter((n) => Number.isFinite(n));
        return ids;
    }

    function applySelectionToDom() {
        const tbody = document.getElementById('trackTableBody');
        if (!tbody) return;
        const selected = new Set(getSelectedTrackIds());
        for (const row of Array.from(tbody.querySelectorAll('tr'))) {
            const id = Number(row.getAttribute('data-track-id'));
            const isSelected = Number.isFinite(id) && selected.has(id);
            row.classList.toggle('selected', isSelected);
        }
    }

    function ensureTrackSelected(trackId) {
        const id = Number(trackId);
        if (!isSelectableTrackId(id)) return;
        const selected = getSelectedTrackIds();
        if (selected.includes(id)) return;
        state.anchorTrackId = id;
        setSelectedTrackIds([id]);
    }

    function handleRowClick(e) {
        // Ignore clicks on buttons/links inside the row
        if (e.target?.closest?.('button, a, input, select, textarea, label')) return;

        const row = e.target?.closest?.('tr[data-track-id]');
        if (!row) return;

        const clickedId = Number(row.getAttribute('data-track-id'));
        if (!isSelectableTrackId(clickedId)) return;

        const metaOrCtrl = Boolean(e.metaKey || e.ctrlKey);
        const shift = Boolean(e.shiftKey);

        const current = getSelectedTrackIds();
        const currentSet = new Set(current);

        if (shift) {
            const visible = getVisibleTrackIds();
            const anchor = isSelectableTrackId(state.anchorTrackId) ? state.anchorTrackId : clickedId;
            const a = visible.indexOf(anchor);
            const b = visible.indexOf(clickedId);
            if (a === -1 || b === -1) {
                state.anchorTrackId = clickedId;
                setSelectedTrackIds(metaOrCtrl ? [...currentSet, clickedId] : [clickedId]);
                return;
            }
            const [start, end] = a < b ? [a, b] : [b, a];
            const range = visible.slice(start, end + 1);
            state.anchorTrackId = anchor;
            if (metaOrCtrl) {
                for (const id of range) currentSet.add(id);
                setSelectedTrackIds([...currentSet]);
            } else {
                setSelectedTrackIds(range);
            }
            return;
        }

        if (metaOrCtrl) {
            if (currentSet.has(clickedId)) currentSet.delete(clickedId);
            else currentSet.add(clickedId);
            state.anchorTrackId = clickedId;
            setSelectedTrackIds([...currentSet]);
            return;
        }

        state.anchorTrackId = clickedId;
        setSelectedTrackIds([clickedId]);
    }

    function attach() {
        const tbody = document.getElementById('trackTableBody');
        if (!tbody) return;
        if (tbody.dataset.selectionHandler) return;
        tbody.addEventListener('click', handleRowClick);
        tbody.dataset.selectionHandler = 'true';
    }

    function selectAllVisible() {
        const visible = getVisibleTrackIds();
        if (visible.length === 0) {
            log?.('No tracks to select', 'info');
            return;
        }
        state.anchorTrackId = visible[0] ?? null;
        setSelectedTrackIds(visible);
    }

    return {
        attach,
        clearSelection,
        applySelectionToDom,
        getSelectedTrackIds,
        setSelectedTrackIds,
        ensureTrackSelected,
        selectAllVisible,
    };
}

