/**
 * Centralized Application State
 * 
 * Single source of truth for app state, with getters/setters
 * and optional change listeners for reactive updates.
 */

export function createAppState(initialState = {}) {
    const state = {
        ipodHandle: null,
        isConnected: false,
        tracks: [],
        playlists: [],
        currentPlaylistIndex: -1, // -1 means "All Tracks"
        wasmReady: false,
        pendingUploads: [], // queued files to be processed on sync
        pendingFileDeletes: [], // relative FS paths to delete on next sync
        selectedTrackIds: [], // numeric track indices selected in the UI
        ...initialState,
    };

    const listeners = new Set();

    function get(key) {
        return state[key];
    }

    function set(key, value) {
        const oldValue = state[key];
        state[key] = value;
        
        // Notify listeners of change
        if (oldValue !== value) {
            listeners.forEach(fn => fn(key, value, oldValue));
        }
    }

    function getState() {
        return { ...state };
    }

    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // Convenience getters/setters for common state
    return {
        get,
        set,
        getState,
        subscribe,

        // iPod connection
        get ipodHandle() { return state.ipodHandle; },
        set ipodHandle(v) { set('ipodHandle', v); },

        get isConnected() { return state.isConnected; },
        set isConnected(v) { set('isConnected', v); },

        // Tracks
        get tracks() { return state.tracks; },
        set tracks(v) { set('tracks', v); },

        // Playlists
        get playlists() { return state.playlists; },
        set playlists(v) { set('playlists', v); },

        get currentPlaylistIndex() { return state.currentPlaylistIndex; },
        set currentPlaylistIndex(v) { set('currentPlaylistIndex', v); },

        // WASM
        get wasmReady() { return state.wasmReady; },
        set wasmReady(v) { set('wasmReady', v); },

        // Upload queue
        get pendingUploads() { return state.pendingUploads; },
        set pendingUploads(v) { set('pendingUploads', v); },

        // Deferred file deletions
        get pendingFileDeletes() { return state.pendingFileDeletes; },
        set pendingFileDeletes(v) { set('pendingFileDeletes', v); },

        // Track selection
        get selectedTrackIds() { return state.selectedTrackIds; },
        set selectedTrackIds(v) { set('selectedTrackIds', v); },
    };
}
