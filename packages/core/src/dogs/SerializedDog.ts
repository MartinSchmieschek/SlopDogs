/**
 * ~~~ A SPIRIT TRAPPED IN CODE, RUNNING IN A VM SANDBOX ~~~
 *
 * Arr, the SerializedDog be a hound whose very soul is serialized --
 * stored as code in the deep, summoned at runtime into a sandboxed
 * VM realm where it executes its dark purpose. Its parents are bound
 * by ID, its context conjured from the exhausted crew's plunder.
 *
 * Corporeal laws are unwritten, as suns and love retreat.
 * This spirit knows not the world outside its sandbox --
 * only the void-context we grant it, and the code that drives it.
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import { DOG_OOM_MARKER, DOG_TIMEOUT_MARKER, DOG_MEMPRESSURE_MARKER } from "../core/entities/IDogRunObserver";
import { Worker } from "worker_threads";
import { transform as sucraseTransform } from "sucrase";
import { envFirst, isRuntimeLogVerbose } from "../runtimeLog";
import { ILineDoc } from "./lineDocs";

/**
 * ============================================================
 *  VM GLOBAL CAPABILITIES — Infrastruktur statt Daten-Pakt
 * ============================================================
 *  Manche Faehigkeiten -- jsonStore, gleich gelagerte Persistenz-
 *  oder Service-Bruecken -- gehoeren ins VM-Sandkasten-Sein selbst,
 *  nicht in den Parent-Vertrag eines Dogs. Der Server registriert
 *  hier seine globalen Capabilities einmalig beim Boot; jeder
 *  SerializedDog sieht sie additiv neben `fetch` und `console`,
 *  ohne sie als Parent fordern zu muessen.
 *
 *  Die Factory wird bei jedem `runExternalCode`-Aufruf neu befragt --
 *  so kann der Provider entscheiden, frisch zu binden oder einen
 *  Singleton wiederzugeben. Wirft die Factory, wird die Capability
 *  fuer diesen Lauf still uebersprungen (das Sandbox-Land bleibt
 *  navigierbar, nur ein Werkzeug fehlt).
 *
 *  Welle 8: Factories bekommen einen optionalen `ctx`-Parameter
 *  (userId, isSuperUser). Provider, die tenant-scoped sind (z.B.
 *  jsonStore), wrappen ihre Methoden so, dass jeder User sein eigenes
 *  Key-Prefix bekommt; anonyme/super-user-Calls behalten den rohen Key.
 * ============================================================
 */

/**
 * Laufzeit-Kontext, den ein SerializedDog beim Bauen seiner VM-Capabilities
 * an die Factories weiterreicht. KennelRunHandler / MCP setzen das pro Request.
 */
export type VmGlobalCapabilityContext = {
    /** Eingeloggter User -- null/undefined fuer anonyme oder dev-mode Calls. */
    userId?: string | null;
    /** Dev-Mode / Super-User (z.B. MCP_AUTH_REQUIRED=false). */
    isSuperUser?: boolean;
    /** Lineage des laufenden Kennels — Host-Capabilities, die je Kennel freigeben (P4c kennelGrants). */
    kennelLineageId?: string | null;
    /** Owner des laufenden Kennels (Rechte vom Kopf der Lineage). */
    kennelOwnerId?: string | null;
    /**
     * Gesetzt, wenn der Dog dem Runner fremd ist (unterhalb READ, P3.5): solche Dogs bekommen keine
     * Kapazitaeten des Runners. `ownerMayRead`: der Kennel-Owner darf den Code lesen (P4c 8.8).
     */
    foreignDog?: { lineageId: string; ownerMayRead: boolean };
    /**
     * Zustand, den der Server je Lauf anlegt und seine Capabilities teilen (P4c: benutzte Werte fuer
     * den Scrub, Memo der Schluessel). Der Core reicht ihn nur durch — er landet nie im VM-Kontext.
     */
    runState?: object;
};

/**
 * Eine Factory, die fuer einen gegebenen Laufzeit-Kontext ein frisches
 * Bundle von VM-Methoden liefert (z.B. tenant-scoped `jsonStore`).
 */
export type VmGlobalCapabilityFactory = (
    ctx: VmGlobalCapabilityContext,
) => Record<string, any>;

const vmGlobalCapabilities: Map<string, VmGlobalCapabilityFactory> = new Map();
/**
 * Kurzdoku je Capability -- eine Zeile, was das Global im Dog-Code kann.
 * Warum hier und nicht in einer Markdown-Datei: eine VM-Global ist im MCP sonst
 * voellig unsichtbar (sie ist kein Dog, kein Node, kein Tool). Wer sie registriert,
 * beschreibt sie im selben Atemzug -- so kann der MCP sie ungefragt ankuendigen,
 * statt dass ein Agent sie erraten oder sich einen Ersatz bauen muss.
 */
const vmGlobalCapabilityDocs: Map<string, string> = new Map();

/**
 * Eine VM-Global-Capability registrieren. Idempotent unter gleichem Namen --
 * eine zweite Registrierung ueberschreibt die erste.
 *
 * Welle 8: `factory` bekommt jetzt einen `ctx`-Parameter. Bestehende Aufrufe
 * mit Zero-arg-Factories sind weiterhin gueltig (TypeScript laesst optionale
 * Parameter zu); das ctx wird einfach ignoriert.
 */
export function registerVmGlobalCapability(
    name: string,
    factory: VmGlobalCapabilityFactory,
    doc?: string,
): void {
    vmGlobalCapabilities.set(name, factory);
    if (typeof doc === 'string' && doc.trim().length > 0) {
        vmGlobalCapabilityDocs.set(name, doc.trim());
    }
}

/**
 * Was im VM-Sandkasten neben `fetch` und `console` bereitsteht -- Name plus
 * Kurzdoku. Der MCP rendert daraus seinen Werkzeugkasten-Brief, damit eine neue
 * Capability automatisch angekuendigt wird statt in einer Doku zu verrotten.
 */
export function listVmGlobalCapabilities(): Array<{ name: string; doc: string | null }> {
    return [...vmGlobalCapabilities.keys()].map((name) => ({
        name,
        doc: vmGlobalCapabilityDocs.get(name) ?? null,
    }));
}

/**
 * Eine zuvor registrierte VM-Global-Capability entfernen.
 * Liefert true, wenn etwas geloescht wurde.
 */
export function unregisterVmGlobalCapability(name: string): boolean {
    vmGlobalCapabilityDocs.delete(name);
    return vmGlobalCapabilities.delete(name);
}

/** Stufe einer Log-Zeile aus dem Dog-Code. */
export type VmConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * Wohin `console` im Dog-Code schreibt, wenn der Server es so will (P4c, Leck L7): der Worker
 * formatiert die Zeile und schickt sie per Bridge auf den Host, der sie vor der Ausgabe bereinigt.
 * Ohne Senke bleibt `console` im Worker nativ. Kosten: ein RPC je Log-Zeile.
 */
export type VmConsoleSink = (level: VmConsoleLevel, line: string, ctx: VmGlobalCapabilityContext) => void;

let vmConsoleSink: VmConsoleSink | null = null;

/** Die Senke fuer `console` im Dog-Code setzen (null = nativ im Worker). */
export function setVmConsoleSink(sink: VmConsoleSink | null): void {
    vmConsoleSink = sink;
}

/**
 * Private oder lokale Netzadresse? Die Blocklist des Worker-`fetch` (8.9) und der Host-Capability
 * `keys.fetch` (P4c): 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7 — dazu 0/8, ::,
 * fe80::/10 und IPv4 in IPv6 (::ffff:a.b.c.d), die auf dieselben Ziele fuehren. Kein Hostname, nur
 * Adressen. Die Funktion reist als Quelltext in den Worker: keine Abhaengigkeiten, kein Template-String.
 */
export function isPrivateNetworkAddress(address: string): boolean {
    let a = String(address || '').trim().toLowerCase();
    if (a.charAt(0) === '[' && a.charAt(a.length - 1) === ']') a = a.slice(1, -1);
    const zone = a.indexOf('%');
    if (zone >= 0) a = a.slice(0, zone);
    const privateV4 = (v4: string): boolean | null => {
        const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
        if (!m) return null;
        const o1 = Number(m[1]);
        const o2 = Number(m[2]);
        return o1 === 127 || o1 === 10 || o1 === 0
            || (o1 === 172 && o2 >= 16 && o2 <= 31)
            || (o1 === 192 && o2 === 168)
            || (o1 === 169 && o2 === 254);
    };
    const direct = privateV4(a);
    if (direct !== null) return direct;
    if (a.indexOf(':') < 0) return false;
    // IPv6 auf acht Gruppen aufklappen; eine eingebettete IPv4 (::ffff:1.2.3.4) zaehlt als zwei.
    let tail: string | null = null;
    const lastColon = a.lastIndexOf(':');
    if (a.indexOf('.', lastColon) > lastColon) {
        tail = a.slice(lastColon + 1);
        a = a.slice(0, lastColon + 1) + '0:0';
    }
    const halves = a.split('::');
    if (halves.length > 2) return false;
    const head = halves[0] ? halves[0].split(':') : [];
    const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
    const groups = head.concat(new Array(Math.max(0, fill)).fill('0'), rest).map((g) => parseInt(g || '0', 16));
    if (groups.length !== 8 || groups.some((g) => isNaN(g) || g < 0 || g > 0xffff)) return false;
    const zeroUpTo = (n: number): boolean => groups.slice(0, n).every((g) => g === 0);
    if (zeroUpTo(8)) return true;
    if (zeroUpTo(7) && groups[7] === 1) return true;
    if (zeroUpTo(5) && (groups[5] === 0xffff || groups[5] === 0)) {
        const v4 = tail !== null
            ? tail
            : [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.');
        return privateV4(v4) === true;
    }
    if ((groups[0] & 0xfe00) === 0xfc00) return true;
    if ((groups[0] & 0xffc0) === 0xfe80) return true;
    return false;
}

/**
 * Alle registrierten VM-Global-Capabilities zu einem frischen Objekt-Bundle
 * verschmelzen. Factories, die werfen, werden uebersprungen.
 * Welle 8: nimmt optional einen ctx, den jede Factory bekommt.
 */
export function buildVmGlobalCapabilities(
    ctx: VmGlobalCapabilityContext = {},
): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [name, factory] of vmGlobalCapabilities) {
        try {
            out[name] = factory(ctx);
        } catch {
            // Capability dieses Mal nicht verfuegbar -- still ueberspringen.
        }
    }
    return out;
}

/**
 * Aus einem Transpile-Fehler einen machen, mit dem man etwas anfangen kann.
 *
 * sucrase liefert "Unexpected token (1:6982)". Bei einem Dog, dessen Code eine einzige
 * 9000-Zeichen-Zeile ist -- und genau so entsteht generierter Code --, ist das wertlos:
 * niemand findet Zeichen 6982 durch Hinsehen. Wir schneiden die Stelle heraus und markieren
 * sie, damit der Aufrufer den Fehler sieht statt ihn zu suchen.
 */
export function describeTranspileError(source: string, err: any): string {
    const roh = err?.message ?? String(err);
    const m = /\((\d+):(\d+)\)/.exec(roh);
    if (!m) return roh;
    const zeile = Number(m[1]), spalte = Number(m[2]);
    const zeilen = (source || '').split('\n');
    let offset = 0;
    for (let i = 0; i < zeile - 1 && i < zeilen.length; i++) offset += zeilen[i].length + 1;
    offset += spalte;
    if (offset < 0 || offset > (source || '').length) return roh;
    const von = Math.max(0, offset - 80);
    const bis = Math.min(source.length, offset + 80);
    const vor = source.slice(von, offset);
    const nach = source.slice(offset, bis);
    return `${roh}\n  Stelle (Zeichen ${offset}): ${von > 0 ? '…' : ''}${vor}⟪HIER⟫${nach}${bis < source.length ? '…' : ''}`;
}

/**
 * Prueft Dog-Code, OHNE ihn zu speichern oder auszufuehren -- damit kaputter Code gar nicht
 * erst zu einem Dog wird. Frueher fiel das erst im Lauf auf: das Kennel war da, der Lead tot,
 * die oeffentliche Seite lieferte HTTP 200 mit leerem Rumpf. Wer den Dienst benutzt, soll den
 * Fehler beim Schreiben bekommen, nicht als Raetsel danach.
 */
export function checkSerializedDogCode(source: string): { ok: true } | { ok: false; message: string } {
    try {
        sucraseTransform(source || '', { transforms: ['typescript'] });
        return { ok: true };
    } catch (err: any) {
        return { ok: false, message: describeTranspileError(source || '', err) };
    }
}

/** Old-Space-Deckel je Sandbox-Isolate in MB, wenn DOG_WORKER_MAX_HEAP_MB schweigt. */
const DEFAULT_DOG_WORKER_MAX_HEAP_MB = 64;

/**
 * Heap-Deckel eines einzelnen Sandbox-Isolates aus der Umgebung lesen.
 * Nur ein positiver Integer zaehlt; alles andere faellt auf den Default zurueck.
 *
 * Der Wert ist bewusst grosszuegig: gemessen kostet ein gleichzeitiges Isolate
 * 10,80 MB RSS, der Deckel liegt also rund sechsfach darueber. Er soll eine
 * Entgleisung fangen (ein Dog, der eine Antwort unbegrenzt puffert), nicht
 * ehrliche Arbeit abwuergen. Noetig ist er, weil Worker-Heaps AUSSERHALB von
 * --max-old-space-size liegen — der Deckel des Haupt-Isolates greift hier nicht.
 */
function resolveDogWorkerMaxHeapMb(): number {
    const configured = Number(process.env.DOG_WORKER_MAX_HEAP_MB);
    return Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_DOG_WORKER_MAX_HEAP_MB;
}

/**
 * Junge Generation proportional zum Old-Space, aber nie unter 8 und nie ueber 16 MB.
 * Zu klein erzwingt Dauer-Scavenges bei jedem groesseren Parse, zu gross frisst den
 * Deckel schon im Leerlauf auf.
 */
function resolveDogWorkerYoungHeapMb(maxHeapMb: number): number {
    return Math.min(16, Math.max(8, Math.round(maxHeapMb / 4)));
}

/**
 * Globaler Deckel ueber ALLE Laeufe/Requests zusammen: so viele Dog-Isolate duerfen GLEICHZEITIG leben.
 * WAVE_CONCURRENCY deckelt nur INNERHALB eines Laufs — ohne diesen globalen Deckel addieren sich die
 * Isolate mehrerer paralleler Requests ungebremst (je ~DOG_WORKER_MAX_HEAP_MB + Baseline) und sprengen
 * ein 512-MB-Budget: genau der intermittierende OOM. Default auf 512 MB ausgelegt (2 Isolate ~ 160 MB).
 * Mehr RAM -> DOG_WORKER_GLOBAL_LIMIT hochsetzen.
 */
const DEFAULT_DOG_WORKER_GLOBAL_LIMIT = 2;
function resolveDogWorkerGlobalLimit(): number {
    const configured = Number(process.env.DOG_WORKER_GLOBAL_LIMIT);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DOG_WORKER_GLOBAL_LIMIT;
}

let activeDogWorkers = 0;
const dogWorkerWaiters: Array<() => void> = [];

/** Einen globalen Worker-Slot belegen — blockiert (Backpressure), bis einer frei ist. */
async function acquireDogWorkerSlot(): Promise<void> {
    if (activeDogWorkers < resolveDogWorkerGlobalLimit()) {
        activeDogWorkers++;
        return;
    }
    // Kein Slot frei: anstellen. Beim release wird uns ein Slot DIREKT uebergeben (die Zahl bleibt),
    // deshalb hier nicht noch einmal hochzaehlen.
    await new Promise<void>((resolve) => dogWorkerWaiters.push(resolve));
}

/** Einen Slot freigeben — wartet jemand, erbt er ihn direkt (Zahl bleibt), sonst sinkt die Zahl. */
function releaseDogWorkerSlot(): void {
    const next = dogWorkerWaiters.shift();
    if (next) next();
    else activeDogWorkers = Math.max(0, activeDogWorkers - 1);
}

/**
 * Speicher-Waechter (Admission-Guard) — misst die ECHTE Prozess-RSS, bevor ein neues Isolate
 * entsteht, und weist den Lauf mit einem lesbaren Fehler ab, wenn der Container schon am Soft-Limit
 * steht. Das schliesst die Luecke zwischen den beiden vorhandenen Deckeln:
 *   - resourceLimits.maxOldGenerationSizeMb deckelt ein EINZELNES Isolate (ein Fresser).
 *   - der globale Worker-Deckel deckelt die ANZAHL gleichzeitiger Isolate.
 * Beides misst NIE den tatsaechlichen Verbrauch. Haupt-Heap-Aufblaehung, Native-Puffer oder
 * Isolate nahe ihrem Deckel koennen die RSS trotzdem Richtung 512 MB treiben — dann killt der OS
 * den GANZEN Prozess still (502/503 fuer alle). Der Waechter verwandelt diesen stillen Tod in
 * einen einzelnen abgewiesenen Lauf: Backpressure mit Diagnose statt Totalausfall.
 *
 * process.memoryUsage().rss umfasst den gesamten Prozess inkl. aller Worker-Threads (die teilen
 * sich den Adressraum) — also exakt die Zahl, nach der auch der OS-OOM-Killer entscheidet.
 */
const DEFAULT_MEMORY_LIMIT_MB = 512;
function resolveMemoryLimitMb(): number {
    const configured = Number(process.env.MEMORY_LIMIT_MB);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEMORY_LIMIT_MB;
}

/**
 * Schwelle, ab der abgewiesen wird. Explizit via MEMORY_SOFT_LIMIT_MB, sonst 85 % des Budgets —
 * genug Luft, damit zwischen Messung und tatsaechlichem Spawn (Isolate-Baseline ~80 MB) nicht
 * doch der harte Deckel reisst.
 */
function resolveMemorySoftLimitMb(): number {
    const configured = Number(process.env.MEMORY_SOFT_LIMIT_MB);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return Math.round(resolveMemoryLimitMb() * 0.85);
}

/**
 * Der Waechter ist im Betrieb AN, in der Entwicklung AUS. Grund: unter ts-node liegt die RSS
 * dauerhaft bei ~900 MB (Toolchain im selben Prozess) — gegen ein 512-MB-Budget gemessen wuerde
 * er JEDEN Dog abweisen und lokale Laeufe wie StartupTest komplett blockieren. MEMORY_GUARD=1/0
 * ueberschreibt die Automatik in beide Richtungen.
 */
function memoryGuardEnabled(): boolean {
    const flag = process.env.MEMORY_GUARD;
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return process.env.NODE_ENV !== 'development';
}

/**
 * Wirft (mit DOG_MEMPRESSURE_MARKER), wenn vor dem Spawn kein Speicher-Spielraum mehr ist.
 * Bewusst VOR acquireDogWorkerSlot aufgerufen: ein abgewiesener Lauf belegt dann gar keinen
 * globalen Slot. Die Rejection landet wie jeder andere Dog-Fehler in letOut() -> dog.__error,
 * die uebrigen Dogs der Welle laufen weiter.
 */
function assertDogWorkerMemoryHeadroom(storageId: string, name: string): void {
    if (!memoryGuardEnabled()) return;
    const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const softMb = resolveMemorySoftLimitMb();
    if (rssMb < softMb) return;
    throw new Error(
        `SerializedDog ${storageId} ("${name}"): ${DOG_MEMPRESSURE_MARKER} `
        + `(RSS ${rssMb} MB >= soft limit ${softMb} MB of ${resolveMemoryLimitMb()} MB). `
        + `The kennel was not run to avoid an out-of-memory crash of the whole container; retry shortly. `
        + `Tune via MEMORY_SOFT_LIMIT_MB / MEMORY_LIMIT_MB, or lower DOG_WORKER_GLOBAL_LIMIT.`
    );
}

/**
 * Worker source -- a tiny script inlined via `new Worker(code, { eval: true })`.
 * Runs the spirit's incantation inside its own isolate, far from the captain's heart.
 * fetch/console live in the worker realm (fetch behind the private-network blocklist, 8.9;
 * console via the bridge when the server sets a sink, P4c); only structured-clone-safe
 * data crosses the membrane.
 *
 * Worker output passes through JSON.parse(JSON.stringify(...)) to escape the VM realm.
 * Reason: `script.runInContext` returns objects from a foreign V8 realm; Node's
 * structured-clone over postMessage refuses or corrupts those, even when the payload
 * is "just data". JSON-roundtrip strips the realm tag and forces a plain shape.
 * Loss-set: Date -> ISO string, undefined -> dropped, BigInt -> throw,
 * Map/Set/RegExp/functions -> dropped or thrown. Pure data round-trips cleanly.
 */
const SANDBOX_WORKER_SOURCE = `
    const { parentPort } = require('worker_threads');
    const vm = require('vm');
    const dns = require('dns');
    const net = require('net');
    const util = require('util');

    // Sicherheit (Env-Scrub, letzte Garantie): die eigene process.env dieses Workers leeren, BEVOR
    // irgendein Dog-Code laeuft. Node's vm ist kein Sicherheits-Sandkasten -- Dog-Code bricht aus dem
    // VM-Kontext in diesen Worker-Realm aus (fetch.constructor.constructor("return process.env")()) und
    // liest process.env. Der Worker wird beim Start bereits mit env: {} und execArgv: [] entkoppelt (siehe
    // new Worker(...) im Parent); dieser Scrub ist die dritte Schicht und greift auch, falls doch einmal
    // eine Variable hereinkommt. Der Worker liest selbst kein App-Env (worker_threads/vm/dns/net/util sind
    // Built-ins); fetch faellt ohne Proxy-Env auf Direktverbindung -- die Egress-Blocklist unten bleibt
    // davon unberuehrt.
    for (const k of Object.keys(process.env)) { delete process.env[k]; }

    // Sicherheit (Dateisystem/Prozess-Haertung): dem ausgebrochenen Dog den Rueckweg zu require kappen.
    // Der Dog erreicht ueber den Realm-Ausbruch das process dieses Workers und holt sich sonst require
    // zurueck -- ueber process.getBuiltinModule (Node >= 22), process.mainModule.require, process.binding,
    // process._linkedBinding oder process.dlopen -- und daraus fs (inkl. Lesen von /proc/1/environ = die
    // Server-Env als Datei) und child_process (gemessen: writeFileSync UND execSync liefen). Diese Felder
    // werden neutralisiert; danach wird process eingefroren, damit sie nicht wiederhergestellt werden. Der
    // Worker hat seine Built-ins oben bereits geladen und gecacht (worker_threads/vm/dns/net/util) und
    // braucht danach kein require mehr; fetch/dns/net sind in Konsten gebunden.
    // Ehrlich: das ist Haertung, keine echte Grenze. require('fs')/child_process sind damit zu, aber V8 hat
    // weitere Primordials -- echte Isolation braucht isolated-vm / Prozess-Sandbox (Folgeauftrag, R30).
    for (const mk of ['getBuiltinModule', 'binding', '_linkedBinding', 'dlopen', 'mainModule', '_preload_modules']) {
        try { delete process[mk]; } catch (e) { /* non-configurable -- defineProperty faengt es */ }
        try { Object.defineProperty(process, mk, { value: undefined, writable: false, configurable: false, enumerable: false }); } catch (e) { /* schon weg oder nicht ueberschreibbar */ }
    }
    try { Object.freeze(process); } catch (e) { /* nichts weiter zu tun */ }

    // Egress-Blocklist (8.9): der native fetch des Dogs erreicht keine privaten oder lokalen
    // Netze (Container, Postgres, Metadaten-Dienst). Blocklist, keine Allowlist -- jede
    // oeffentliche API bleibt erreichbar. Jede Umleitung wird vor dem naechsten Sprung geprueft.
    const isPrivateNetworkAddress = ${isPrivateNetworkAddress.toString()};
    const nativeFetch = fetch;
    const REDIRECT_STATUS = [301, 302, 303, 307, 308];

    async function assertPublicTarget(href) {
        let url;
        try { url = new URL(href); } catch (e) { return; }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
        const host = url.hostname.replace(/^\\[|\\]$/g, '');
        const addresses = net.isIP(host)
            ? [host]
            : (await dns.promises.lookup(host, { all: true, verbatim: true })).map((r) => r.address);
        if (addresses.length === 0 || addresses.some(isPrivateNetworkAddress)) {
            throw new Error('egress_blocked: ' + url.hostname + ' is a private or local network address');
        }
    }

    async function guardedFetch(input, init) {
        const isRequest = input && typeof input === 'object' && !(input instanceof URL) && typeof input.url === 'string';
        let href = isRequest ? input.url : String(input);
        await assertPublicTarget(href);
        const mode = (init && init.redirect) || (isRequest && input.redirect) || 'follow';
        if (mode !== 'follow') return nativeFetch(input, init);
        let target = input;
        let options = Object.assign({}, init || {}, { redirect: 'manual' });
        for (let hop = 0; hop < 20; hop++) {
            const res = await nativeFetch(target, options);
            const location = res.headers.get('location');
            if (REDIRECT_STATUS.indexOf(res.status) < 0 || !location) return res;
            href = new URL(location, href).href;
            await assertPublicTarget(href);
            const method = String(options.method || (isRequest ? input.method : 'GET') || 'GET').toUpperCase();
            if (res.status === 303 ? method !== 'HEAD' : ((res.status === 301 || res.status === 302) && method === 'POST')) {
                options = Object.assign({}, options, { method: 'GET', body: undefined });
            }
            target = href;
        }
        throw new TypeError('fetch failed: too many redirects');
    }

    // console ueber die Bridge (P4c, L7): die Zeile wird hier formatiert, der Host bereinigt sie
    // vor der Ausgabe. Zaehler/Timer bleiben nativ -- sie tragen nur Labels.
    function makeBridgedConsole(bridge) {
        const levels = { log: 'log', info: 'info', warn: 'warn', error: 'error', debug: 'debug', trace: 'error', dir: 'log', table: 'log' };
        const bridged = Object.create(console);
        const send = (level, args) => {
            let line;
            try { line = util.format.apply(util, args); } catch (e) { line = '[unformattable]'; }
            bridge[level](line).catch(() => undefined);
        };
        for (const name of Object.keys(levels)) {
            bridged[name] = (...args) => send(levels[name], args);
        }
        bridged.assert = (cond, ...args) => { if (!cond) send('error', ['Assertion failed'].concat(args)); };
        return bridged;
    }

    // RPC plumbing for bridge-namespace callbacks. The worker exposes Proxy objects
    // (built from a whitelisted method list) that postMessage their calls back to the
    // main thread, which holds the live functions. Each call gets a unique id; the
    // result-message resolves the matching Promise.
    let nextRpcId = 0;
    const pendingRpc = new Map();

    function makeBridgeProxy(namespace, methods) {
        const proxy = {};
        for (const m of methods) {
            proxy[m] = (...args) => new Promise((resolve, reject) => {
                const id = ++nextRpcId;
                pendingRpc.set(id, { resolve, reject });
                try {
                    parentPort.postMessage({ type: 'rpc:call', id, namespace, method: m, args });
                } catch (err) {
                    pendingRpc.delete(id);
                    reject(err);
                }
            });
        }
        return proxy;
    }

    // The init payload arrives via postMessage (async transport) rather than workerData
    // (sync structured-clone on construction), so any clone failure surfaces here --
    // inside the worker -- with a clear error, not as a cryptic synchronous throw from
    // the Worker constructor. Subsequent messages are rpc:result replies for bridge calls.
    let initFired = false;
    parentPort.on('message', async (msg) => {
        if (msg && msg.type === 'rpc:result') {
            const pending = pendingRpc.get(msg.id);
            if (pending) {
                pendingRpc.delete(msg.id);
                if (msg.error) pending.reject(new Error(msg.error));
                else pending.resolve(msg.value);
            }
            return;
        }
        if (initFired) return;
        initFired = true;
        try {
            const { wrappedCode, contextObj, bridgeNamespaces } = msg;
            const bridges = {};
            for (const entry of (bridgeNamespaces || [])) {
                bridges[entry.namespace] = makeBridgeProxy(entry.namespace, entry.methods);
            }
            const context = vm.createContext({
                ...contextObj,
                ...bridges,
                console: bridges.console ? makeBridgedConsole(bridges.console) : console,
                fetch: guardedFetch,
            });
            const script = new vm.Script(wrappedCode);
            const raw = await script.runInContext(context);
            // Strip realm + non-cloneable via JSON roundtrip.
            // Loss-set: Date, undefined, BigInt, Map, Set, RegExp, functions.
            // Pure data passes through cleanly.
            let safe;
            try {
                safe = raw === undefined ? null : JSON.parse(JSON.stringify(raw));
            } catch (cloneErr) {
                throw new Error('Result not JSON-serializable: ' + (cloneErr && cloneErr.message ? cloneErr.message : String(cloneErr)));
            }
            parentPort.postMessage({ ok: true, result: safe });
        } catch (err) {
            parentPort.postMessage({
                ok: false,
                error: (err && err.message) ? err.message : String(err),
                stack: err && err.stack ? err.stack : undefined,
            });
        }
    });
`;

/**
 * Sanitize the VM context for cross-realm postMessage transport.
 * Every value is JSON-roundtripped per key -- proxies, getters, cross-realm
 * objects, and structurally-non-cloneable shapes all collapse to plain data.
 * Functions / symbols / unserializable values (BigInt, circular) are dropped.
 * Loss-set: Date -> ISO string. Map/Set/RegExp/functions silently lost.
 */
function sanitizeContextForWorker(ctx: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const key of Object.keys(ctx)) {
        const value = ctx[key];
        if (typeof value === 'function' || typeof value === 'symbol') {
            continue;
        }
        // JSON roundtrip per-key -- escapes proxies, cross-realm objects,
        // and silently drops any non-serializable property nested deep.
        try {
            safe[key] = JSON.parse(JSON.stringify(value));
        } catch {
            // Property contains things JSON cannot serialize (BigInt, circular).
            // Drop the whole key rather than risk a structured-clone explosion at postMessage time.
        }
    }
    return safe;
}

/**
 * Input DTO fer update/save operations -- the scroll upon which a spirit's new config is writ.
 */
export interface IUpdateInput {
    /** The spirit's unique identifier in this incarnation — a GUID forged in the void */
    id?: string;
    /** The spirit's lineage mark — a GUID that binds all incarnations across branches */
    lineageId?: string;
    /** The ancestor from which this incarnation was born — null fer the firstborn */
    parentId?: string | null;
    /** The spirit's true name — changeable without shattering the eldritch pacts of kennel and UI */
    displayName?: string;
    /** @deprecated Version number — a relic of the old linear rite, kept only fer the transition */
    version?: number;
    /** Additional eldritch properties, uncharted and unknowable, carried through the abyss */
    [key: string]: any;
}

/**
 * Configuration fer a SerializedDog -- the eldritch blueprint of a spirit vessel.
 * Extends IUpdateInput fer save/update rites.
 */
export interface ISerializedDogConfig extends IUpdateInput {
    /** The incantation to be executed -- the dark code that gives this spirit its purpose in the void */
    theRun: string;
    /** A short sentence describing what this spirit yields -- the discovery surface, searchable by list_nodes */
    description?: string;
    /** Optional line-range annotations over `theRun` (1-based) -- retrievable by id + line via get_node_lines */
    lineDocs?: ILineDoc[];
    /** Optional display sigil (e.g. emoji) fer the UI -- a glyph against the dark */
    icon?: string;
    /** Node IDs of required parent hounds -- sworn oaths that must be fulfilled before this spirit may rise */
    parentsRequired?: string[];
    /** Node IDs of optional parent hounds -- whispers from the deep, heeded only if they be aboard */
    parentsOptional?: string[];
    /** Alternative incantation source (TypeScript) -- mapped to theRun by the carrion hordes of ConfigRouteHandler */
    tsCode?: string;
    /** Alternative incantation source (raw code) -- another path to the same eldritch purpose */
    code?: string;
}

/** A supplier that injects app-specific globals into the VM realm -- the void provides what the core cannot */
export type SerializedDogVmGlobalsSupplier = (
    ctx: Record<string, any>,
    dog: SerializedDog<unknown>,
    /** The kennel (simpleVmContext) or season.exhausted (runExternalCode) -- source hounds fer context */
    sourceDogs: IHuntingDog<unknown>[] | null
) => void;

/**
 * Arr, the SerializedDog -- a spirit trapped in code, summoned from the deep into a sandboxed
 * VM realm where it executes its dark purpose. Its parents are bound by ID, its context
 * conjured from the exhausted crew's plunder. From brooding gulfs are we beheld,
 * by that which bears no name -- yet this spirit runs its incantation regardless.
 * @template T The type of eldritch yield this spirit produces from its sandboxed void
 */
export class SerializedDog<T> extends Dog<T> {

    private _storageId

    /** The spirit's storage identity -- its name in the deep where it sleeps between hunts */
    public get storageId(): string{
        return this._storageId
    }

    /**
     * VM globals suppliers -- set per kennel run by the captain. No global app-enums in the core,
     * fer the core knows only the void, not the world above.
     */
    private vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[] = [];

    /**
     * Bind additional global incantations to the VM context -- injected by the app/KennelRun.
     */
    public setVmGlobalsSuppliers(suppliers: readonly SerializedDogVmGlobalsSupplier[]): void {
        this.vmGlobalsSuppliers = suppliers.length ? [...suppliers] : [];
    }

    /**
     * Per-instance override fer the VM execution timeout (ms). Set by KennelRun
     * from the per-run `vmTimeoutMs` param (Welle 12 Korrektur: Run-Time-Param,
     * not persisted on IKennelConfig). Resolution order in `runExternalCode`:
     *   1. this override (when set + > 0)
     *   2. `process.env.SLOPDOGS_VM_TIMEOUT_MS` (when numeric + > 0)
     *   3. 10000 (10s default)
     */
    private vmTimeoutMsOverride: number | undefined;

    /** Set the per-instance VM execution timeout (ms). Falsy / <=0 clears the override. */
    public setVmTimeoutMs(ms: number | undefined): void {
        if (typeof ms === 'number' && ms > 0) {
            this.vmTimeoutMsOverride = ms;
        } else {
            this.vmTimeoutMsOverride = undefined;
        }
    }

    /**
     * Per-instance capability context (userId / isSuperUser). Set by KennelRun
     * from the captain's request context; passed to every VM-Global-Capability
     * factory so providers (e.g. `jsonStore`) can tenant-scope their bridges.
     */
    private capabilityCtx: VmGlobalCapabilityContext = {};

    /** Set the capability context for this dog's next runs. Empty object = anonymous. */
    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        this.capabilityCtx = ctx ? { ...ctx } : {};
    }

    /** Apply all VM globals suppliers to the context -- let each supplier inscribe its runes */
    private applyVmGlobalsSuppliers(
        ctx: Record<string, any>,
        sourceDogs: IHuntingDog<unknown>[] | null
    ): void {
        for (const supplier of this.vmGlobalsSuppliers) {
            supplier(ctx, this as SerializedDog<unknown>, sourceDogs);
        }
    }

    // Cached yields from required parents -- plunder already claimed, stored fer quick access
    private requiredYieldsContext: Map<string, any> = new Map<string, any>();
    // Reference to the kennel -- so this spirit may find its kin in the crew
    private kennelRef: Array<IHuntingDog<unknown>> | null = null;

    /**
     * Transpiled JS form of `config.theRun`. Cached per instance.
     * The void demands TypeScript, but `vm.Script` only speaks plain JS --
     * sucrase strips the annotations once, then we feast on the cache.
     */
    private _strippedCode?: string;

    /** Drop the cached transpile -- next run will re-strip. */
    private invalidateStrippedCode(): void {
        this._strippedCode = undefined;
    }

    /** Lazily produce the JS form of `theRun`, caching the result. */
    private getRunnableCode(): string {
        if (this._strippedCode !== undefined) return this._strippedCode;
        const source = this.config.theRun || '';
        try {
            this._strippedCode = sucraseTransform(source, {
                transforms: ['typescript'],
            }).code;
        } catch (err: any) {
            throw new Error(
                `SerializedDog ${this.storageId}: TypeScript transpile failed: ${describeTranspileError(source, err)}`
            );
        }
        return this._strippedCode;
    }

    /** Bind this spirit to its kennel -- grant it sight of the other hounds aboard */
    public setKennelRef(kennel: Array<IHuntingDog<unknown>>): void {
        this.kennelRef = kennel;
    }

    /**
     * Build the base context object with standard keys (fetch, console) plus all
     * registered VM-global capabilities (e.g. `jsonStore`). The capabilities are
     * Infrastruktur and always-on -- jeder Dog sieht sie, ohne einen Parent zu
     * deklarieren. fer simpleVmContext (type-defs) sind Capability-Objekte als
     * Methoden-Bundle sichtbar; fer runExternalCode werden sie spaeter erneut
     * gemerged, sodass beide Pfade dieselbe Oberflaeche zeigen.
     */
    protected buildBaseContext(): Record<string, any> {
        return {
            fetch: fetch,
            console: console,
            ...buildVmGlobalCapabilities(this.capabilityCtx),
        };
    }

    /**
     * Find a hound in a crew by its parentId reference — matches by storageId, lineageId, or name.
     * The void cares not which mark ye bear, so long as it be the right one.
     */
    private findParentDog(parentId: string, source: Array<IHuntingDog<unknown>>): IHuntingDog<unknown> | undefined {
        return source.find(dog => {
            if (dog instanceof SerializedDog) {
                const sDog = dog as SerializedDog<unknown>;
                return sDog.storageId === parentId || sDog.lineageId === parentId;
            }
            return dog.name === parentId;
        });
    }

    /**
     * Merge parent dogs into the context -- bind their plunder (or placeholders) as global variables.
     * @param contextObj The base context object to inscribe upon
     * @param parentSource The source of parent hounds (kennelRef or season.exhausted)
     * @param useExhausted If true, uses season.exhausted (runtime); if false, uses kennelRef (type definitions)
     */
    private mergeParentDogsIntoContext(
        contextObj: Record<string, any>,
        parentSource: Array<IHuntingDog<unknown>> | null,
        useExhausted: boolean = false
    ): void {
        if (!parentSource) {
            return;
        }

        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParentIds = [...parentsRequired, ...parentsOptional];

        // Two passes on purpose: every primary name is bound FIRST, aliases only fill the gaps
        // that are left. A primary name must never lose to another dog's alias.
        const boundParents: Array<{ dog: IHuntingDog<unknown>; value: any }> = [];

        allParentIds.forEach((parentId: string) => {
            const parentDog = this.findParentDog(parentId, parentSource);

            if (parentDog) {
                const dogName = parentDog.name;

                if (useExhausted) {
                    // Runtime: only bind if the hound has actually returned with plunder
                    if (parentDog.collected !== undefined) {
                        contextObj[dogName] = parentDog.collected;
                        this.requiredYieldsContext.set(dogName, parentDog.collected);
                        boundParents.push({ dog: parentDog, value: parentDog.collected });
                    }
                } else {
                    // Type definitions: use collected or empty placeholder -- the shape matters, not the substance
                    const placeholder = parentDog.collected || {};
                    contextObj[dogName] = placeholder;
                    boundParents.push({ dog: parentDog, value: placeholder });
                }

                // If the parent carries extra tools for the VM, inscribe them too
                if (typeof parentDog.getVmContextContributions === 'function') {
                    const contributions = parentDog.getVmContextContributions();
                    if (contributions) {
                        Object.assign(contextObj, contributions);
                    }
                }
            }
        });

        this.applyContextAliases(contextObj, boundParents, useExhausted ? this.requiredYieldsContext : undefined);
    }

    /**
     * The simple VM context -- a snapshot of what this spirit can see from within its sandbox.
     * Merges base context, cached parent yields, and kennel-ref parents.
     * The void provides only what is needed, nothing more.
     */
    public get simpleVmContext(): Record<string, any> | undefined{
        // Start with the base tools -- fetch and console, the spirit's lifeline
        const justContext = this.buildBaseContext();

        // Merge previously cached parent yields (from prior runs, if any)
        this.requiredYieldsContext.forEach((value, key) => {
            justContext[key] = value;
        });

        // Merge parent dogs from the kennel -- placeholders fer type definitions
        this.mergeParentDogsIntoContext(justContext, this.kennelRef, false);

        this.applyVmGlobalsSuppliers(justContext, this.kennelRef);

        return justContext;
    }

    /** Required parent classes -- resolved from config IDs against the kennel crew */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        if (!this.kennelRef) {
            return [];
        }

        const parentsRequired = this.config.parentsRequired || [];
        const requiredClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];

        parentsRequired.forEach((parentId: string) => {
            const parentDog = this.findParentDog(parentId, this.kennelRef!);

            if (parentDog) {
                // Extract the constructor -- the dark blueprint of the parent hound
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // Avoid duplicates -- one entry per class in the manifest
                if (!requiredClasses.includes(parentClass)) {
                    requiredClasses.push(parentClass);
                }
            }
        });

        return requiredClasses;
    }

    /** Optional parent classes -- hounds we listen fer but do not demand */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        if (!this.kennelRef) {
            return [];
        }

        const parentsOptional = this.config.parentsOptional || [];
        const optionalClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];

        parentsOptional.forEach((parentId: string) => {
            const parentDog = this.findParentDog(parentId, this.kennelRef!);

            if (parentDog) {
                // Extract the constructor from the optional parent
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // No duplicates allowed aboard
                if (!optionalClasses.includes(parentClass)) {
                    optionalClasses.push(parentClass);
                }
            }
        });

        return optionalClasses;
    }

    /** The spirit's true name — drawn from displayName if inscribed, else transmuted from storageId */
    get name(): string {
        const cfg = this.config as ISerializedDogConfig;
        if (cfg.displayName) {
            return SerializedDog.toCamelCase(cfg.displayName);
        }
        return SerializedDog.toCamelCase(this.storageId);
    }

    /** The spirit's lineage mark — the lineageId that binds all its incarnations across branches */
    get lineageId(): string | undefined {
        return (this.config as ISerializedDogConfig).lineageId;
    }

    /** The spirit's sigil -- an icon from its config, if one was inscribed */
    get icon(): string | undefined {
        const c = this.config as ISerializedDogConfig;
        return typeof c?.icon === 'string' ? c.icon : undefined;
    }

    /**
     * Transmute a name into CamelCase — the spirit's identity in the VM realm must be a valid identifier.
     *
     * Public and static so that the HTTP surface can report the very same binding name
     * (`contextName`) without keeping a second, drifting copy of this transformation.
     */
    public static toCamelCase(input: string): string {
        // Already a valid PascalCase identifier? Leave it untouched.
        if (/^[A-Z][a-zA-Z0-9_]*$/.test(input)) {
            return input;
        }
        // Split on separators; per token preserve PascalCase shape, otherwise capitalize-lowercase.
        return input
            .split(/[-_\s]+/)
            .filter(word => word.length > 0)
            .map(word => /^[A-Z][a-zA-Z0-9]*$/.test(word)
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    /** A key may only enter the VM context when user code could actually spell it. */
    private static readonly IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

    /** Reserved words can never serve as a binding — `declare const default` is a syntax error. */
    private static readonly RESERVED_WORDS = new Set([
        'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function',
        'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
        'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this',
        'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
    ]);

    /**
     * Bind the readable spellings of already-bound parents as ADDITIONAL context keys.
     *
     * `toCamelCase` flattens inner capitals ("mdReportData" -> "Mdreportdata"). Repairing it
     * would rename the parent inside every dog that already uses the mangled spelling, so the
     * mangled name stays the PRIMARY binding (written by the caller before this runs) and only
     * aliases are added on top:
     *   1. `toCamelCase(displayName)` — the name of today, always bound by the caller,
     *   2. the displayName with its first letter capitalized, rest untouched,
     *   3. the raw displayName itself.
     *
     * Collision rule, not negotiable: a key that is already taken is NEVER overwritten. Two dogs
     * can fall on the same alias — the first one wins, the second one keeps its primary name.
     * Otherwise a parent would silently vanish from another dog's context.
     *
     * Aliases 2 and 3 are both held against {@link IDENTIFIER_PATTERN}: the type-def path turns
     * every context key into `declare global { type <key> = ... }`, so a key carrying a space or
     * an arrow would poison Monaco's whole library.
     */
    private applyContextAliases(
        contextObj: Record<string, any>,
        boundParents: Array<{ dog: IHuntingDog<unknown>; value: any }>,
        yieldCache?: Map<string, any>
    ): void {
        for (const { dog, value } of boundParents) {
            const displayName = dog instanceof SerializedDog
                ? (dog.instanceConfig as ISerializedDogConfig)?.displayName
                : undefined;
            const source = typeof displayName === 'string' && displayName.length > 0 ? displayName : dog.name;
            const aliases = [source.charAt(0).toUpperCase() + source.slice(1), source];

            for (const alias of aliases) {
                if (alias === dog.name) continue;
                if (Object.prototype.hasOwnProperty.call(contextObj, alias)) continue;
                if (!SerializedDog.IDENTIFIER_PATTERN.test(alias)) continue;
                if (SerializedDog.RESERVED_WORDS.has(alias)) continue;
                contextObj[alias] = value;
                yieldCache?.set(alias, value);
            }
        }
    }

    /** The raw config of this spirit -- its full blueprint, laid bare */
    public get instanceConfig():any{
        return this.config
    }

    /**
     * Wave-readiness check, instance-aware.
     *
     * The base implementation iterates `this.required` (a class list) and asks "is any
     * exhausted dog of this class present?". That works fer BaseDogs, where each class
     * appears once in the kennel. But every SerializedDog instance shares the same
     * `SerializedDog` constructor — so the de-duplicated `required` list collapses
     * multiple distinct SerializedDog parents into a single class entry. The base
     * check then returns `true` as soon as the FIRST SerializedDog parent finishes,
     * even if other declared SerializedDog parents (perhaps with their own deep
     * dependencies) are still in flight. Result: this dog runs too early, missing
     * globals, scheduled in the wrong wave.
     *
     * Here we walk `parentsRequired` directly and check each declared parent ID
     * against the exhausted crew, matching by storageId/lineageId fer SerializedDogs
     * and by class name fer BaseDogs. Every sworn parent must have returned from the
     * deep before this spirit may rise.
     */
    protected areRequiredParentsReady(season: IHuntingSeason): boolean {
        const parentsRequired = this.config.parentsRequired || [];
        if (parentsRequired.length === 0) return true;

        return parentsRequired.every((parentId: string) => {
            return season.exhausted.some(dog => {
                if (dog instanceof SerializedDog) {
                    const sDog = dog as SerializedDog<unknown>;
                    return sDog.storageId === parentId || sDog.lineageId === parentId;
                }
                return dog.name === parentId;
            });
        });
    }

    /**
     * Override matchesParent fer instance-specific matching by storageId/name.
     * The base isReady logic calls this method -- and fer SerializedDog,
     * we match by specific instance identity, not just class lineage.
     * The parentClass is checked first, then we verify the instance
     * is one of our declared parents. Arr, specificity matters in the deep.
     */
    protected matchesParent(parentClass: (new (...args: any[]) => IHuntingDog<unknown>), instance: IHuntingDog<unknown>): boolean {
        // First, the standard class check -- is it of the right lineage?
        if (!(instance instanceof parentClass)) {
            return false;
        }

        // Fer SerializedDog: verify the specific instance by storageId/name
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParents = [...parentsRequired, ...parentsOptional];

        // If no specific parents declared, the class check alone suffices
        if (allParents.length === 0) {
            return true;
        }

        // Check if this instance be one of our specifically declared parents — by storageId, lineageId, or name
        return allParents.some((parentId: string) => {
            if (instance instanceof SerializedDog) {
                const sDog = instance as SerializedDog<unknown>;
                return sDog.storageId === parentId || sDog.lineageId === parentId;
            }
            return instance.name === parentId;
        });
    }

    /** The yield collector -- delegates to runExternalCode, where the spirit's incantation is executed */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<T> = (season:IHuntingSeason) => {
            return this.runExternalCode(season)
        }

    /**
     * Summon the spirit into existence -- bind its config and storage identity.
     * If theRun be empty, the spirit throws an error upon execution -- a hollow vessel with no purpose.
     */
    constructor(private config:ISerializedDogConfig, private storageIdentifier:string) {
        super();
        this._storageId = storageIdentifier
        if (!this.config.theRun){
            this.config.theRun = `throw new Error("Empty yieldCollector!")`
        }
        this.invalidateStrippedCode();
    }

    /**
     * Uebersetzt einen Worker-Abbruch in eine Meldung, die den schuldigen Dog nennt.
     *
     * Node meldet einen gerissenen Heap-Deckel als nacktes "Worker terminated due to
     * reaching memory limit: JS heap out of memory" — ohne Dog, ohne Limit, ohne
     * Hinweis auf die Stellschraube. Alle anderen Fehler laufen unveraendert durch.
     * Am Fehlerweg selbst aendert das nichts: die Rejection landet wie bisher in
     * letOut(), wird dort zu dog.__error, und die uebrigen Dogs laufen weiter.
     */
    private describeWorkerError(err: Error, maxHeapMb: number): Error {
        const isOutOfMemory =
            (err as NodeJS.ErrnoException)?.code === 'ERR_WORKER_OUT_OF_MEMORY'
            || /reaching memory limit/i.test(err?.message ?? '');

        if (!isOutOfMemory) return err;

        return new Error(
            `SerializedDog ${this.storageId} ("${this.name}"): ${DOG_OOM_MARKER} `
            + `of ${maxHeapMb} MB and was terminated. Raise DOG_WORKER_MAX_HEAP_MB (default `
            + `${DEFAULT_DOG_WORKER_MAX_HEAP_MB}) or let this dog hold less data in memory.`
        );
    }

    /**
     * Execute the spirit's code in a worker-thread sandbox.
     *
     * The void's bargain:
     *  - `theRun` may carry TypeScript syntax; sucrase strips it once, cache holds the JS.
     *  - Execution happens in a `worker_threads.Worker`, isolated from the captain's heart.
     *    A wayward `while(true)` or `process.exit()` cannot drag the server into the deep.
     *  - A timeout (`SLOPDOGS_VM_TIMEOUT_MS`, default 10s) terminates runaway spirits.
     *  - Only structured-clone-safe context crosses the membrane. Methods contributed
     *    either by registered VM-global capabilities (e.g. `jsonStore.get/set/...`,
     *    Welle 7) or by parent dogs cannot survive postMessage as functions, but
     *    Welle 6 plumbs them through a bridge: any context-object whose values are
     *    functions is extracted before sanitize, its method-name whitelist is shipped
     *    to the worker, and each call round-trips via rpc:call / rpc:result. Calls
     *    are async -- user code must `await` the bridge method.
     */
    public async runExternalCode(
    season: IHuntingSeason
  ): Promise<T>  {

        // Transpile (cached) and wrap the user's incantation in an async function.
        // The line break before the closing brace is load-bearing: code that ends in a
        // `// comment` would otherwise swallow `} catch …` and die with "Unexpected end of input".
        // Nothing is prepended, so line numbers in errors still match the dog's own code.
        const runnable = this.getRunnableCode();
        const wrappedCode = `(async () => { try { ${runnable}\n} catch (err) { throw err; } })()`;

        // Build the context -- only declared parents' yields become global variables.
        // (fetch/console are provided inside the worker itself, not crossed via postMessage —
        // fetch behind the private-network blocklist, console via the bridge when a sink is set.)
        // VM-global capabilities (z.B. jsonStore) werden additiv eingestreut -- sie sind
        // Infrastruktur, kein Parent-Vertrag, und damit fuer jeden Dog ohne Deklaration sichtbar.
        // Welle 8: capabilityCtx (userId/isSuperUser) wird in jede Factory durchgereicht,
        // damit tenant-scoped Provider (jsonStore) ihre Keys pro User prefixen koennen.
        // Die Bridge-Extraktion weiter unten erkennt sie automatisch als Funktions-traegende Objekte.
        const contextObj: Record<string, any> = { ...buildVmGlobalCapabilities(this.capabilityCtx) };

        // This dark magic binds exhausted hounds' yields into the VM realm -- safely contained in the void
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParentIds = [...parentsRequired, ...parentsOptional];

        // Two passes on purpose: every primary name is bound FIRST, aliases only fill the gaps
        // that are left. A primary name must never lose to another dog's alias.
        const boundParents: Array<{ dog: IHuntingDog<unknown>; value: any }> = [];

        allParentIds.forEach((parentId: string) => {
            // Find the parent hound by ID in the exhausted crew — matches by storageId, lineageId, or name
            const parentDog = this.findParentDog(parentId, season.exhausted);

            if (parentDog && parentDog.collected !== undefined) {
                const dogName = parentDog.name;
                // Inscribe the parent's plunder as a global variable in the context
                contextObj[dogName] = parentDog.collected;
                this.requiredYieldsContext.set(dogName, parentDog.collected);
                boundParents.push({ dog: parentDog, value: parentDog.collected });
                // Debug: log fer SerializedDog parents
                if (parentDog instanceof SerializedDog && isRuntimeLogVerbose()) {
                    console.log(`[SerializedDog ${this.storageId}] Füge ${dogName} (storageId: ${(parentDog as SerializedDog<unknown>).storageId}) zum Context hinzu`);
                }
                // If the parent carries extra tools for the VM, inscribe them too
                if (typeof parentDog.getVmContextContributions === 'function') {
                    const contributions = parentDog.getVmContextContributions();
                    if (contributions) {
                        Object.assign(contextObj, contributions);
                    }
                }
            } else if (parentDog && parentDog.collected === undefined) {
                if (isRuntimeLogVerbose()) {
                    console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} gefunden, aber collected ist undefined`);
                }
            } else if (isRuntimeLogVerbose()) {
                console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} nicht in exhausted gefunden`);
            }
        });

        this.applyContextAliases(contextObj, boundParents, this.requiredYieldsContext);

        this.applyVmGlobalsSuppliers(contextObj, season.exhausted);

        // Bridge extraction -- VM-context contributions like `jsonStore` arrive as an
        // object whose values are functions. Those cannot survive postMessage's structured
        // clone, so we pluck them out of contextObj BEFORE sanitize and register them as
        // bridge namespaces. The worker receives only the method-name whitelist; each call
        // is round-tripped back to the main thread via rpc:call / rpc:result. Whitelisting
        // is enforced on the main side: any method name not declared in `bridges[ns]` is
        // rejected with "Unknown method" -- the worker cannot conjure new function refs.
        type BridgeMethodMap = Record<string, (...args: any[]) => any>;
        const bridges: Record<string, BridgeMethodMap> = {};
        for (const key of Object.keys(contextObj)) {
            const value = (contextObj as any)[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const methods: BridgeMethodMap = {};
                let hasMethod = false;
                for (const mKey of Object.keys(value)) {
                    const m = value[mKey];
                    if (typeof m === 'function') {
                        methods[mKey] = m.bind(value);
                        hasMethod = true;
                    }
                }
                if (hasMethod) {
                    bridges[key] = methods;
                    // Remove from contextObj so sanitize does not wrestle with a function-bearing object.
                    delete (contextObj as any)[key];
                }
            }
        }
        // console ueber die Bridge, wenn der Server eine Senke gesetzt hat (P4c, L7): der Worker
        // schickt jede formatierte Zeile hierher, die Senke bereinigt sie mit dem Laufkontext.
        const consoleSink = vmConsoleSink;
        if (consoleSink && !bridges.console) {
            const ctx = this.capabilityCtx;
            const line = (level: VmConsoleLevel) => (text: unknown) => {
                consoleSink(level, typeof text === 'string' ? text : String(text), ctx);
            };
            bridges.console = { log: line('log'), info: line('info'), warn: line('warn'), error: line('error'), debug: line('debug') };
        }
        const bridgeNamespaces = Object.keys(bridges).map((ns) => ({
            namespace: ns,
            methods: Object.keys(bridges[ns]),
        }));

        // Drop functions / symbols -- postMessage's structured clone cannot carry them.
        const safeContext = sanitizeContextForWorker(contextObj);

        if (isRuntimeLogVerbose()) {
            console.log(`[SerializedDog ${this.storageId}] Required/Optional Parent IDs:`, allParentIds);
            console.log(`[SerializedDog ${this.storageId}] Context keys (raw):`, Object.keys(contextObj));
            console.log(`[SerializedDog ${this.storageId}] Context keys (worker-safe):`, Object.keys(safeContext));
            if (bridgeNamespaces.length > 0) {
                console.log(`[SerializedDog ${this.storageId}] Bridge namespaces:`, bridgeNamespaces.map(b => `${b.namespace}.{${b.methods.join(',')}}`));
            }
        }

        // Resolution: per-kennel override > env var > default 10s. setVmTimeoutMs()
        // only stores values > 0; env-Number-coercion of NaN / 0 falls through to 10000.
        const timeoutMs =
            this.vmTimeoutMsOverride
            ?? (Number(envFirst('SLOPDOGS_VM_TIMEOUT_MS', 'DATADOGS_VM_TIMEOUT_MS')) || 10_000);

        // Diagnose: probe whether the payload is structured-cloneable BEFORE we hand it to a Worker.
        // If this fails we know it is the context shape (not vm.runInContext output) and we get
        // a clear log instead of a cryptic "could not be cloned" from the Worker constructor.
        let cloneTestError: string | null = null;
        try {
            if (typeof (globalThis as any).structuredClone === 'function') {
                (globalThis as any).structuredClone({ wrappedCode, contextObj: safeContext });
            } else {
                JSON.parse(JSON.stringify({ wrappedCode, contextObj: safeContext }));
            }
        } catch (e: any) {
            cloneTestError = `pre-worker clone test failed: ${e?.message ?? e}`;
        }
        if (cloneTestError) {
            console.error(`[SerializedDog ${this.storageId}] ${cloneTestError}`);
            console.error(`[SerializedDog ${this.storageId}] safeContext keys:`, Object.keys(safeContext));
            for (const k of Object.keys(safeContext)) {
                const v = (safeContext as any)[k];
                let t: string;
                try {
                    t = typeof v + '/' + (Array.isArray(v) ? 'array' : (v === null ? 'null' : Object.prototype.toString.call(v)));
                } catch { t = '<unreadable>'; }
                console.error(`  [${k}]: ${t}`);
            }
            // Throw -- the harvester's letOut() will catch, brand the dog with __error,
            // and WavesConverter surfaces it as `hasError: true`. Returning a string here
            // would mask the failure as a result and leave hasError=false in the snapshot.
            throw new Error(cloneTestError);
        }

        // Speicher-Waechter: misst die echte RSS und weist den Lauf mit Fehler ab, wenn der Container
        // schon am Soft-Limit steht — bevor ein Slot belegt oder ein Isolate erzeugt wird. Wirft es,
        // laeuft weder acquire noch das finally unten (kein Slot-Leck). Siehe assertDogWorkerMemoryHeadroom.
        assertDogWorkerMemoryHeadroom(this.storageId, this.name);

        // Globaler Worker-Deckel: wartet hier, bis ein Isolate-Slot frei ist (Backpressure statt OOM).
        // Freigabe im finally unten — exakt einmal, nachdem der Worker terminiert wurde (settle()).
        await acquireDogWorkerSlot();
        try {
            return await new Promise<T>((resolve, reject) => {
                // No workerData -- payload goes via postMessage AFTER spawn so any clone failure
                // can be caught/reported by us rather than thrown synchronously by the constructor.
                //
                // resourceLimits deckelt das einzelne Isolate: ohne diesen Deckel kann ein
                // einziger entgleister Dog den ganzen Container umbringen, denn Worker-Heaps
                // liegen AUSSERHALB von --max-old-space-size und werden vom Budget des
                // Haupt-Isolates nicht erfasst. Reisst ein Worker das Limit, beendet Node ihn
                // mit ERR_WORKER_OUT_OF_MEMORY — der 'error'-Pfad unten uebersetzt das in eine
                // Meldung, die den schuldigen Dog nennt.
                const maxHeapMb = resolveDogWorkerMaxHeapMb();
                // Sicherheit gegen Env-Exfiltration. Node's vm ist kein Sicherheits-Sandkasten: Dog-Code
                // bricht aus dem VM-Kontext in den Worker-Realm aus (fetch.constructor.constructor(
                // "return process.env")()) und liest process.env. Damit dort keine Server-Geheimnisse
                // (DATABASE_URL, KEYSTORE_MASTER_KEY_V1, GOOGLE_OAUTH_CLIENT_SECRET, MCP_TOKEN_SIGNING_KEY)
                // stehen, wird der Worker dreifach entkoppelt -- gemessen war jede Schicht fuer sich noetig:
                //   - execArgv: [] -- ohne das erbt der Worker die -r-Preloads des Servers, u.a.
                //     "-r ./scripts/load-env.cjs", und laedt die .env-Secrets SELBST erneut in seine env
                //     (env: {} allein genuegt deshalb NICHT -- der Worker fuellt sich sonst wieder).
                //   - env: {} -- ohne das erbt der Worker eine Kopie der Prozess-env des Servers.
                //   - der Env-Scrub oben in SANDBOX_WORKER_SOURCE -- letzte Garantie: leert die eigene
                //     process.env, bevor Dog-Code laeuft, egal wie eine Variable hereinkommt.
                // heap-Deckel und Timeout sind parent-seitig (resolveDogWorkerMaxHeapMb hier, timeoutMs weiter
                // oben) und von alldem unberuehrt.
                // Ehrlich benannt: das schliesst nur das Auslesen der Secrets aus der Env. Der Realm-Ausbruch
                // selbst bleibt moeglich -- require('fs')/child_process oder Netz unter Umgehung von
                // guardedFetch. Echte Isolation braucht eine Prozess-Sandbox / isolated-vm (eigener
                // Folgeauftrag). Siehe auch das bewusste SSRF-Restrisiko R30 in docs/slopdogs/PLAN.md.
                const worker = new Worker(SANDBOX_WORKER_SOURCE, {
                    eval: true,
                    env: {},
                    execArgv: [],
                    resourceLimits: {
                        maxOldGenerationSizeMb: maxHeapMb,
                        maxYoungGenerationSizeMb: resolveDogWorkerYoungHeapMb(maxHeapMb),
                    },
                });

                let settled = false;
                const settle = (fn: () => void) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    worker.terminate().catch(() => undefined);
                    fn();
                };

                const timer = setTimeout(() => {
                    settle(() => reject(new Error(
                        `SerializedDog ${this.storageId}: ${DOG_TIMEOUT_MARKER} ${timeoutMs}ms`
                    )));
                }, timeoutMs);

                // Persistent listener -- rpc:call messages can arrive any number of times
                // before the final {ok,...} / {ok:false,...} result message. The settle()
                // guard ensures we resolve/reject the outer Promise exactly once even though
                // the listener stays attached.
                worker.on('message', async (msg: any) => {
                    if (msg && msg.type === 'rpc:call') {
                        const ns = bridges[msg.namespace];
                        const id = msg.id;
                        try {
                            if (!ns) {
                                throw new Error(`Unknown bridge namespace: ${msg.namespace}`);
                            }
                            const fn = ns[msg.method];
                            if (typeof fn !== 'function') {
                                // Whitelist enforcement -- only registered method names are callable.
                                throw new Error(`Unknown method: ${msg.namespace}.${msg.method}`);
                            }
                            const args = Array.isArray(msg.args) ? msg.args : [];
                            const result = await fn(...args);
                            // JSON-roundtrip the result so it survives postMessage cleanly
                            // (DB rows etc. may carry exotic shapes that structured-clone refuses).
                            let safe: unknown = null;
                            try {
                                safe = result === undefined ? null : JSON.parse(JSON.stringify(result));
                            } catch (cloneErr: any) {
                                throw new Error(`RPC result not serializable: ${cloneErr?.message ?? cloneErr}`);
                            }
                            try {
                                worker.postMessage({ type: 'rpc:result', id, value: safe });
                            } catch {
                                // Worker may have died between call and reply -- nothing to do.
                            }
                        } catch (err: any) {
                            try {
                                worker.postMessage({ type: 'rpc:result', id, error: err?.message ?? String(err) });
                            } catch {
                                // Worker gone -- swallow.
                            }
                        }
                        return;
                    }
                    if (msg && typeof msg.ok === 'boolean') {
                        if (msg.ok) {
                            settle(() => resolve(msg.result as T));
                        } else {
                            const message = msg.error ?? 'unknown sandbox error';
                            settle(() => reject(new Error(message)));
                        }
                    }
                });
                worker.once('error', (err: Error) => {
                    settle(() => reject(this.describeWorkerError(err, maxHeapMb)));
                });
                worker.once('exit', (code: number) => {
                    if (code !== 0) {
                        settle(() => reject(new Error(
                            `SerializedDog ${this.storageId}: sandbox worker exited with code ${code}`
                        )));
                    }
                });

                // Send the payload AFTER Worker is up. Any clone failure here surfaces via the
                // 'error' listener with full diagnostic, not as a synchronous throw that we'd
                // misattribute to the user's code.
                try {
                    worker.postMessage({ wrappedCode, contextObj: safeContext, bridgeNamespaces });
                } catch (postErr: any) {
                    settle(() => reject(new Error(
                        `SerializedDog ${this.storageId}: postMessage failed: ${postErr?.message ?? postErr}`
                    )));
                }
            });
        } catch (err: any) {
            // Re-throw so the harvester's letOut() catches, brands the dog with __error,
            // and WavesConverter surfaces hasError=true via get_snapshot_dog_error.
            // Returning a result string here would mask the failure as a successful yield
            // and leave hasError=false in the snapshot -- the original sin of this method.
            const scriptError = `[SerializedDog ${this.storageId}] Script Error: ${err?.message ?? err}`;
            if (vmConsoleSink) vmConsoleSink('error', scriptError, this.capabilityCtx);
            else console.error(scriptError);
            throw err instanceof Error
                ? err
                : new Error(typeof err === 'string' ? err : String(err));
        } finally {
            releaseDogWorkerSlot();
        }
    }


}
