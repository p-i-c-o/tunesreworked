// FLAC -> ALAC (M4A) transcoding via ffmpeg.wasm (Vite + npm).
//
// Notes:
// - This is CPU + memory heavy; run only during Sync.
// - We load ffmpeg.wasm lazily on first use.
// - ffmpeg core is served from /public/ffmpeg (same-origin) to avoid worker import issues.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

async function loadFfmpegInstance(ffmpeg) {
    // Vite note from ffmpeg.wasm docs: use the ESM build of @ffmpeg/core.
    // We serve those files from /public/ffmpeg (same origin).
    await ffmpeg.load({
        // toBlobURL is used to bypass worker import restrictions.
        coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
        // Multithread core requires a dedicated worker script.
        workerURL: await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript'),
    });
    return ffmpeg;
}

function computeThreadsPerJob(concurrency) {
    const hc = Number(globalThis.navigator?.hardwareConcurrency || 0);
    if (!Number.isFinite(hc) || hc <= 0) return 0; // let ffmpeg decide
    // Leave 1 core for UI/event loop; split remaining cores across jobs.
    const usable = Math.max(1, hc - 1);
    return Math.max(1, Math.floor(usable / Math.max(1, concurrency)));
}

function replaceExtension(name, newExtWithDot) {
    const base = String(name || 'track').replace(/\.[^/.]+$/, '');
    return `${base}${newExtWithDot}`;
}

export async function transcodeFlacToAlacM4a(file, { onProgress, onLog } = {}) {
    // Back-compat single-instance behavior:
    // Create an isolated instance each call (safe but slower). Most callers should
    // instead use createTranscodePool({ concurrency: 2 }).
    const ffmpeg = await loadFfmpegInstance(new FFmpeg());
    return await transcodeWithInstance(ffmpeg, file, { onProgress, onLog, threads: 0 });
}

async function transcodeWithInstance(ffmpeg, file, { onProgress, onLog, threads = 0 } = {}) {
    // Capture logs so failures are debuggable (rc=1 is otherwise opaque).
    const logLines = [];

    const logHandler = ({ type, message }) => {
        if (typeof message === 'string' && message) {
            logLines.push(`[${type}] ${message}`);
            if (logLines.length > 200) logLines.shift();
        }
        if (typeof onLog === 'function') {
            try { onLog({ type, message }); } catch (_) {}
        }
    };
    const progressHandler = ({ progress, time }) => {
        if (typeof onProgress === 'function') {
            try { onProgress({ progress, time }); } catch (_) {}
        }
    };

    ffmpeg.on('log', logHandler);
    ffmpeg.on('progress', progressHandler);

    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputName = `input-${jobId}.flac`;
    const outputName = `output-${jobId}.m4a`;

    try {
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Equivalent to: ffmpeg -i track.flac -acodec alac track.m4a
        //
        // IMPORTANT: Many FLACs contain embedded cover art as an "attached picture" stream.
        // If we don't constrain stream mapping, ffmpeg may try to encode that picture as video
        // (e.g. h264) into the output container, which fails for iPod/MP4 audio-only output.
        //
        // Force audio-only output:
        // -map 0:a:0 : pick first audio stream only
        // -vn/-sn/-dn: disable video/subtitle/data
        // -c:a alac   : encode ALAC
        // -threads N  : cap per-job threads (avoid oversubscription when running 2 jobs)
        // -map_metadata 0 : preserve tags where possible
        const rc = await ffmpeg.exec([
            '-i', inputName,
            '-map', '0:a:0',
            '-vn', '-sn', '-dn',
            '-map_metadata', '0',
            '-c:a', 'alac',
            '-threads', String(threads || 0),
            outputName
        ]);
        if (rc !== 0) {
            const tail = logLines.slice(-40).join('\n');
            throw new Error(`ffmpeg exited with code ${rc}\n\nffmpeg log tail:\n${tail}`);
        }

        const data = await ffmpeg.readFile(outputName); // Uint8Array
        const outFile = new File([data], replaceExtension(file?.name || 'track.flac', '.m4a'), { type: 'audio/mp4' });
        return outFile;
    } finally {
        // Best-effort cleanup to reduce memory in the ffmpeg FS.
        try { await ffmpeg.deleteFile(inputName); } catch (_) {}
        try { await ffmpeg.deleteFile(outputName); } catch (_) {}
        try { ffmpeg.off('log', logHandler); } catch (_) {}
        try { ffmpeg.off('progress', progressHandler); } catch (_) {}
    }
}

export function createTranscodePool({ concurrency = 2 } = {}) {
    const size = Math.max(1, Math.floor(concurrency));
    const slots = Array.from({ length: size }, () => ({
        ffmpeg: null,
        loading: null,
        busy: false,
    }));

    async function getSlot(i) {
        const slot = slots[i];
        if (slot.ffmpeg?.loaded) return slot;
        if (slot.loading) {
            await slot.loading;
            return slot;
        }
        slot.ffmpeg = new FFmpeg();
        slot.loading = (async () => {
            await loadFfmpegInstance(slot.ffmpeg);
            slot.loading = null;
        })();
        await slot.loading;
        return slot;
    }

    async function acquire() {
        // spin-wait with backoff; pool is tiny so this is fine
        // eslint-disable-next-line no-constant-condition
        while (true) {
            for (let i = 0; i < slots.length; i++) {
                if (!slots[i].busy) {
                    slots[i].busy = true;
                    await getSlot(i);
                    return { slot: slots[i], release: () => { slots[i].busy = false; } };
                }
            }
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    async function transcodeFlacToAlacM4aPooled(file, { onProgress, onLog } = {}) {
        const { slot, release } = await acquire();
        const threads = computeThreadsPerJob(size);
        try {
            return await transcodeWithInstance(slot.ffmpeg, file, { onProgress, onLog, threads });
        } finally {
            release();
        }
    }

    return {
        transcodeFlacToAlacM4a: transcodeFlacToAlacM4aPooled,
        concurrency: size,
    };
}

