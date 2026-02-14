export function createTrackOps({
    appState,
    wasm,
    paths,
    log,
    logWasmError,
    refreshCurrentView,
    loadPlaylists,
} = {}) {
    async function deleteTrackInternal(trackId, { confirmOnce = true, refresh = true, logSuccess = true } = {}) {
        if (confirmOnce && !confirm('Are you sure you want to delete this track?')) return false;

        // Grab the file path before removing the track (indexes shift after delete).
        const track = wasm.wasmGetJson('ipod_get_track_json', trackId);
        const ipodPath = track?.ipod_path;
        const relFsPath = ipodPath ? paths.toRelFsPathFromIpodDbPath(ipodPath) : null;

        const result = wasm.wasmCallWithError('ipod_remove_track', trackId);
        if (result !== 0) return false;

        // Defer the actual file delete until the next "Sync iPod".
        if (relFsPath) {
            appState.pendingFileDeletes = [...(appState.pendingFileDeletes || []), relFsPath];
            log?.(`Marked for deletion on next sync: ${relFsPath}`, 'info');
        }

        if (refresh) await refreshCurrentView();
        if (logSuccess) log?.(`Deleted track ID: ${trackId}`, 'success');
        return true;
    }

    async function deleteTrack(trackId) {
        await deleteTrackInternal(trackId, { confirmOnce: true, refresh: true, logSuccess: true });
    }

    async function deleteTracks(trackIds) {
        const ids = Array.from(new Set((trackIds || []).map(Number))).filter(Number.isFinite);
        if (ids.length === 0) return;

        if (!confirm(`Delete ${ids.length} track(s)?\n\nNote: the actual music files will be deleted from the iPod on the next “Sync iPod”.`)) {
            return;
        }

        // Delete from highest index to lowest so indices don't shift under us.
        const sorted = [...ids].sort((a, b) => b - a);
        let okCount = 0;
        for (const id of sorted) {
            const ok = await deleteTrackInternal(id, { confirmOnce: false, refresh: false, logSuccess: false });
            if (ok) okCount++;
        }

        await refreshCurrentView();
        log?.(`Deleted ${okCount}/${ids.length} track(s)`, okCount === ids.length ? 'success' : 'warning');
    }

    async function addTrackToPlaylist(trackId, playlistIndex) {
        const playlists = appState.playlists;
        if (playlistIndex < 0 || playlistIndex >= playlists.length) {
            log?.('Invalid playlist index', 'error');
            return;
        }
        const playlist = playlists[playlistIndex];
        if (playlist.is_master) {
            log?.('Cannot add tracks to master playlist directly', 'warning');
            return;
        }

        const result = wasm.wasmCall('ipod_playlist_add_track', playlistIndex, trackId);
        if (result === 0) {
            await loadPlaylists();
            log?.(`Added track to playlist: ${playlist.name}`, 'success');
        } else {
            logWasmError?.('Failed to add track');
        }
    }

    async function addTracksToPlaylist(trackIds, playlistIndex) {
        const ids = Array.from(new Set((trackIds || []).map(Number))).filter(Number.isFinite);
        if (ids.length === 0) return;

        const playlists = appState.playlists;
        if (playlistIndex < 0 || playlistIndex >= playlists.length) {
            log?.('Invalid playlist index', 'error');
            return;
        }
        const playlist = playlists[playlistIndex];
        if (playlist.is_master) {
            log?.('Cannot add tracks to master playlist directly', 'warning');
            return;
        }

        let okCount = 0;
        for (const tid of ids) {
            const result = wasm.wasmCall('ipod_playlist_add_track', playlistIndex, tid);
            if (result === 0) okCount++;
        }

        await loadPlaylists();
        log?.(`Added ${okCount}/${ids.length} track(s) to playlist: ${playlist.name}`, okCount === ids.length ? 'success' : 'warning');
    }

    async function removeTrackFromPlaylist(trackId) {
        const idx = appState.currentPlaylistIndex;
        const playlists = appState.playlists;
        if (idx < 0 || idx >= playlists.length) {
            log?.('No playlist selected', 'warning');
            return;
        }
        const playlist = playlists[idx];
        if (playlist.is_master) {
            log?.('Cannot remove tracks from master playlist', 'warning');
            return;
        }
        if (!confirm(`Remove this track from "${playlist.name}"?`)) return;

        const result = wasm.wasmCall('ipod_playlist_remove_track', idx, trackId);
        if (result !== 0) {
            logWasmError?.('Failed to remove track');
            return;
        }

        await refreshCurrentView();
        log?.(`Removed track from playlist: ${playlist.name}`, 'success');
    }

    async function removeTracksFromPlaylist(trackIds) {
        const ids = Array.from(new Set((trackIds || []).map(Number))).filter(Number.isFinite);
        if (ids.length === 0) return;

        const idx = appState.currentPlaylistIndex;
        const playlists = appState.playlists;
        if (idx < 0 || idx >= playlists.length) {
            log?.('No playlist selected', 'warning');
            return;
        }
        const playlist = playlists[idx];
        if (playlist.is_master) {
            log?.('Cannot remove tracks from master playlist', 'warning');
            return;
        }
        if (!confirm(`Remove ${ids.length} track(s) from "${playlist.name}"?`)) return;

        let okCount = 0;
        for (const tid of ids) {
            const result = wasm.wasmCall('ipod_playlist_remove_track', idx, tid);
            if (result === 0) okCount++;
        }

        await refreshCurrentView();
        log?.(`Removed ${okCount}/${ids.length} track(s) from playlist: ${playlist.name}`, okCount === ids.length ? 'success' : 'warning');
    }

    return {
        deleteTrack,
        deleteTracks,
        addTrackToPlaylist,
        addTracksToPlaylist,
        removeTrackFromPlaylist,
        removeTracksFromPlaylist
    };
}

