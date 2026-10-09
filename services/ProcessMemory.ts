// ProcessMemory — was der Prozess und sein Container an Speicher belegen, so wie der OOM-Killer es sieht.
//
// process.memoryUsage() zeigt nur den Augenblick und nur diesen Prozess. Fuer die Jagd nach dem stillen
// Container-Kill braucht es dazu: das Hochwasser seit Start (maxRSS / VmHWM — die Boot-Spitze), die
// Trennung Datei-Seiten gegen anonymen Speicher (malloc-Arenen, Engines; smaps_rollup), die Thread-Zahl
// und die Zaehler der cgroup, nach denen der Container stirbt (sie sehen auch npm/cross-env daneben).
// Linux-Dateien werden einzeln und fehlertolerant gelesen; ausserhalb von Linux sind sie null.
// smaps_rollup laeuft die Seitentabellen ab (Millisekunden) — nur fuer health_check, nie im Waechter-Takt.
import fs from 'fs';
import os from 'os';

const MB = 1024 * 1024;
const KB_PER_MB = 1024;

const round1 = (x: number): number => Math.round(x * 10) / 10;
const bytesToMb = (bytes: number): number => round1(bytes / MB);

export interface ProcessMemorySnapshot {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    arrayBuffersMb: number;
    /** Hoechste RSS seit Prozessstart (process.resourceUsage().maxRSS). */
    maxRssMb: number;
    uptimeSec: number;
}

export interface CgroupMemory {
    version: 1 | 2;
    currentMb: number | null;
    /** Hochwasser der cgroup (v2 memory.peak, v1 max_usage_in_bytes) — null, wenn der Kernel es nicht fuehrt. */
    peakMb: number | null;
    /** Grenze der cgroup — null bei "max"/unbegrenzt. */
    limitMb: number | null;
    /** memory.stat: anonymer Speicher und Datei-Cache (v2: anon/file, v1: rss/cache). */
    anonMb: number | null;
    fileMb: number | null;
    /** memory.events (v2): Grenze erreicht, OOM, OOM-Kills — seit Start der cgroup. */
    events: { max: number; oom: number; oomKill: number } | null;
}

export interface LinuxMemory {
    /** /proc/self/status */
    vmHwmMb: number | null;
    vmRssMb: number | null;
    rssAnonMb: number | null;
    rssFileMb: number | null;
    threads: number | null;
    /** /proc/self/smaps_rollup */
    smapsRssMb: number | null;
    smapsAnonymousMb: number | null;
    smapsPrivateDirtyMb: number | null;
    cgroup: CgroupMemory | null;
    /** cgroup memory.current minus Prozess-RSS: was ausser diesem Prozess im Container liegt (npm, sh, cross-env, Cache). */
    containerMinusRssMb: number | null;
}

/** Laufzeit-Eckdaten, die Arena-Obergrenze und Tokio-Threads bestimmen. */
export interface RuntimeInfo {
    nodeVersion: string;
    availableParallelism: number;
}

type Fields = Map<string, string>;

export class ProcessMemory {
    static snapshot(): ProcessMemorySnapshot {
        const usage = process.memoryUsage();
        return {
            rssMb: bytesToMb(usage.rss),
            heapUsedMb: bytesToMb(usage.heapUsed),
            heapTotalMb: bytesToMb(usage.heapTotal),
            externalMb: bytesToMb(usage.external),
            arrayBuffersMb: bytesToMb(usage.arrayBuffers ?? 0),
            maxRssMb: ProcessMemory.maxRssMb(),
            uptimeSec: Math.round(process.uptime()),
        };
    }

    /** resourceUsage().maxRSS ist in Kilobyte. */
    static maxRssMb(): number {
        return round1(process.resourceUsage().maxRSS / KB_PER_MB);
    }

    static runtime(): RuntimeInfo {
        return { nodeVersion: process.version, availableParallelism: os.availableParallelism() };
    }

    /** Linux-Sicht; auf anderen Systemen null. */
    static linux(): LinuxMemory | null {
        if (process.platform !== 'linux') return null;
        const status = ProcessMemory.readFields('/proc/self/status', ':');
        const rollup = ProcessMemory.readFields('/proc/self/smaps_rollup', ':');
        const kbField = (fields: Fields | null, key: string): number | null => {
            const raw = fields?.get(key);
            const kb = raw ? Number.parseInt(raw, 10) : NaN;
            return Number.isFinite(kb) ? round1(kb / KB_PER_MB) : null;
        };
        const threadsRaw = status?.get('Threads');
        const cgroup = ProcessMemory.cgroup();
        return {
            vmHwmMb: kbField(status, 'VmHWM'),
            vmRssMb: kbField(status, 'VmRSS'),
            rssAnonMb: kbField(status, 'RssAnon'),
            rssFileMb: kbField(status, 'RssFile'),
            threads: threadsRaw ? Number.parseInt(threadsRaw, 10) : null,
            smapsRssMb: kbField(rollup, 'Rss'),
            smapsAnonymousMb: kbField(rollup, 'Anonymous'),
            smapsPrivateDirtyMb: kbField(rollup, 'Private_Dirty'),
            cgroup,
            containerMinusRssMb: cgroup?.currentMb != null ? round1(cgroup.currentMb - bytesToMb(process.memoryUsage().rss)) : null,
        };
    }

    /** cgroup v2 zuerst (Unified Hierarchy), sonst v1; null, wenn keine lesbar ist. */
    static cgroup(): CgroupMemory | null {
        const v2Current = ProcessMemory.readBytes('/sys/fs/cgroup/memory.current');
        if (v2Current !== undefined) {
            return {
                version: 2,
                currentMb: ProcessMemory.mbOrNull(v2Current),
                peakMb: ProcessMemory.mbOrNull(ProcessMemory.readBytes('/sys/fs/cgroup/memory.peak')),
                limitMb: ProcessMemory.mbOrNull(ProcessMemory.readBytes('/sys/fs/cgroup/memory.max')),
                ...ProcessMemory.statOf('/sys/fs/cgroup/memory.stat', 'anon', 'file'),
                events: ProcessMemory.eventsV2(),
            };
        }
        const v1Current = ProcessMemory.readBytes('/sys/fs/cgroup/memory/memory.usage_in_bytes');
        if (v1Current !== undefined) {
            const limit = ProcessMemory.readBytes('/sys/fs/cgroup/memory/memory.limit_in_bytes');
            return {
                version: 1,
                currentMb: ProcessMemory.mbOrNull(v1Current),
                peakMb: ProcessMemory.mbOrNull(ProcessMemory.readBytes('/sys/fs/cgroup/memory/memory.max_usage_in_bytes')),
                // v1 meldet "unbegrenzt" als riesige Zahl nahe 2^63.
                limitMb: limit !== undefined && limit !== null && limit < 2 ** 50 ? bytesToMb(limit) : null,
                ...ProcessMemory.statOf('/sys/fs/cgroup/memory/memory.stat', 'rss', 'cache'),
                events: null,
            };
        }
        return null;
    }

    /** anon/file aus memory.stat ("key value"-Zeilen in Bytes). */
    private static statOf(file: string, anonKey: string, fileKey: string): { anonMb: number | null; fileMb: number | null } {
        const fields = ProcessMemory.readFields(file, ' ');
        const mb = (key: string): number | null => {
            const value = fields ? Number(fields.get(key)) : NaN;
            return Number.isFinite(value) ? bytesToMb(value) : null;
        };
        return { anonMb: mb(anonKey), fileMb: mb(fileKey) };
    }

    private static eventsV2(): CgroupMemory['events'] {
        const fields = ProcessMemory.readFields('/sys/fs/cgroup/memory.events', ' ');
        if (!fields) return null;
        const n = (key: string): number => Number(fields.get(key) ?? 0) || 0;
        return { max: n('max'), oom: n('oom'), oomKill: n('oom_kill') };
    }

    private static mbOrNull(bytes: number | null | undefined): number | null {
        return typeof bytes === 'number' ? bytesToMb(bytes) : null;
    }

    /** undefined = Datei fehlt/unlesbar; null = Inhalt ist keine Zahl (z. B. "max"). */
    private static readBytes(file: string): number | null | undefined {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8').trim();
        } catch {
            return undefined;
        }
        const value = Number(text);
        return Number.isFinite(value) ? value : null;
    }

    /** Zeilen "Key<sep> Wert" als Map; null, wenn die Datei fehlt. */
    private static readFields(file: string, separator: ':' | ' '): Fields | null {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            return null;
        }
        const fields: Fields = new Map();
        for (const line of text.split('\n')) {
            const at = line.indexOf(separator);
            if (at > 0) fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
        }
        return fields;
    }
}
