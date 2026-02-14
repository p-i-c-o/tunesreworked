export function createIpodConnectionMonitor({
    appState,
    wasm,
    log,
    updateConnectionStatus,
    enableUIIfReady,
    renderTracks,
    renderSidebarPlaylists,
    escapeHtml,
    pollIntervalMs = 3000,
} = {}) {
    let timer = null;
    let busy = false;

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        busy = false;
    }

    async function disconnect(reason = 'Folder no longer accessible') {
        if (!appState?.isConnected) return;

        stop();
        log?.(`iPod disconnected: ${reason}`, 'warning');

        // Best-effort close DB in WASM
        try { wasm?.wasmCall?.('ipod_close_db'); } catch (_) {}

        // Reset app state
        appState.isConnected = false;
        appState.ipodHandle = null;
        appState.tracks = [];
        appState.playlists = [];
        appState.currentPlaylistIndex = -1;
        appState.pendingUploads = [];
        appState.pendingFileDeletes = [];
        appState.selectedTrackIds = [];

        updateConnectionStatus?.(false);
        enableUIIfReady?.({ wasmReady: appState.wasmReady, isConnected: false });

        // Clear UI
        renderTracks?.({ tracks: [], escapeHtml, selectedTrackIds: [] });
        renderSidebarPlaylists?.();
    }

    function start() {
        stop();

        timer = setInterval(async () => {
            if (busy) return;
            if (!appState?.isConnected || !appState?.ipodHandle) return;

            busy = true;
            try {
                // Lightweight probe: does the expected iPod structure still exist?
                const control = await appState.ipodHandle.getDirectoryHandle('iPod_Control', { create: false });
                const itunes = await control.getDirectoryHandle('iTunes', { create: false });
                // Classic devices have iTunesDB; newer ones (Nano5G, etc.) have iTunesCDB instead.
                try {
                    await itunes.getFileHandle('iTunesDB', { create: false });
                } catch {
                    await itunes.getFileHandle('iTunesCDB', { create: false });
                }
            } catch (e) {
                await disconnect(e?.name || e?.message || 'Disconnected');
            } finally {
                busy = false;
            }
        }, pollIntervalMs);
    }

    return { start, stop, disconnect };
}

