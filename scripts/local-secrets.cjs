'use strict';

/**
 * Lokaler Modus (SLOPDOGS_MODE=local): stellt SESSION_SECRET und KEYSTORE_MASTER_KEY_V1 bereit,
 * damit ein Pi ohne Handarbeit startet. Laeuft per `-r` NACH load-env.cjs; ohne local sofort no-op.
 *
 *   - In process.env gesetzt (Env, .env-Dateien) → unangetastet.
 *   - Sonst aus LOCAL_SECRETS_FILE (Default ~/.slopdogs/local-secrets.env, dotenv-Format).
 *   - Fehlt der Eintrag dort → 32 Zufallsbytes hex erzeugen und an die Datei anhaengen
 *     (Verzeichnis 0700, Datei 0600 — zu offene Rechte werden auf POSIX korrigiert).
 *
 * Erzeugen ist exklusiv: eine Lock-Datei (`<datei>.lock`, flag 'wx') umschliesst Lesen, Erzeugen und
 * Schreiben. Wer das Lock nicht bekommt, wartet und liest danach die Datei des Gewinners — zwei Starts
 * laufen nie mit zwei verschiedenen Master-Keys.
 *
 * Grenze, ausdruecklich: Der Master-Key liegt damit auf demselben Geraet wie das Chiffrat der
 * Key-Store-DB. Das schuetzt nur, wenn die DB allein leckt (Repo, Backup der SQLite-Dateien),
 * nicht gegen jemanden mit Dateizugriff auf dem Pi.
 *
 * Abbruch mit Exit 79 (Konfigurationsfehler des lokalen Modus): Datei liegt im Repo
 * (process.cwd()), ein Wert in der Datei hat das falsche Format, oder ein NEU erzeugter Master-Key
 * traefe auf eine Auth-DB, in der schon Schluessel liegen (die waeren danach unlesbar). Geloggt
 * werden nur Pfad und Name, nie Werte.
 */
if ((process.env.SLOPDOGS_MODE || '').trim() === 'local') {
    const crypto = require('crypto');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dotenv = require('dotenv');

    const EXIT_LOCAL_CONFIG = 79;
    const LOCK_WAIT_MS = 10_000;
    const LOCK_STALE_MS = 60_000;
    const SECRETS = [
        { name: 'SESSION_SECRET', valid: (v) => v.length >= 32, format: 'mindestens 32 Zeichen' },
        { name: 'KEYSTORE_MASTER_KEY_V1', valid: (v) => /^[0-9a-fA-F]{64}$/.test(v), format: 'genau 64 Hex-Zeichen' },
    ];
    const posix = process.platform !== 'win32';

    /** Das gehaltene Lock — ein Abbruch darf es nicht liegen lassen (process.exit ueberspringt finally). */
    let heldLock = null;

    const fail = (message) => {
        console.error(`[local-secrets] ${message}`);
        if (heldLock) fs.rmSync(heldLock, { force: true });
        process.exit(EXIT_LOCAL_CONFIG);
    };

    /** Realpfad des naechsten existierenden Vorfahren + Rest — Symlinks ins Repo fallen so auf. */
    const realish = (p) => {
        let head = p;
        const tail = [];
        while (!fs.existsSync(head)) {
            const parent = path.dirname(head);
            if (parent === head) return p;
            tail.unshift(path.basename(head));
            head = parent;
        }
        return path.join(fs.realpathSync(head), ...tail);
    };

    const isInside = (child, parent) => {
        const norm = (p) => (posix ? p : p.toLowerCase());
        const rel = path.relative(norm(parent), norm(child));
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };

    /** Synchron warten, ohne die CPU zu verbrennen (Preload: es gibt noch keine Event-Loop-Arbeit). */
    const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

    /** Exklusives Lock; ein verwaistes (aelter als LOCK_STALE_MS) wird uebernommen. */
    const withLock = (file, work) => {
        const lock = `${file}.lock`;
        const deadline = Date.now() + LOCK_WAIT_MS;
        for (;;) {
            try {
                fs.closeSync(fs.openSync(lock, 'wx', 0o600));
                heldLock = lock;
                break;
            } catch (err) {
                if (err.code !== 'EEXIST') throw err;
                try {
                    if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true });
                } catch {
                    /* inzwischen weg — naechster Versuch */
                }
                if (Date.now() > deadline) fail(`Lock ${lock} seit ${LOCK_WAIT_MS} ms belegt — laeuft ein zweiter Start?`);
                sleepMs(100);
            }
        }
        try {
            return work();
        } finally {
            fs.rmSync(lock, { force: true });
            heldLock = null;
        }
    };

    /** Datei der Auth-DB (SQLite), wenn sie existiert — relative file:-Pfade gelten wie bei Prisma neben dem Schema. */
    const authDatabaseFile = () => {
        const url = (process.env.AUTH_DATABASE_URL || '').trim();
        const raw = url.startsWith('file:') ? url.slice('file:'.length).split('?')[0] : (process.env.AUTH_DB_PATH || '').trim();
        if (!raw || /^postgres/i.test(url)) return null;
        const file = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), 'store', 'prisma-auth', raw);
        return fs.existsSync(file) ? file : null;
    };

    /** Zahl der gespeicherten Schluessel in der Auth-DB; null, wenn nicht pruefbar. */
    const storedKeyCount = (file) => {
        let DatabaseSync;
        try {
            ({ DatabaseSync } = require('node:sqlite'));
        } catch {
            return null;
        }
        let db;
        try {
            db = new DatabaseSync(file, { readOnly: true });
            const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='UserKey'").get();
            return table ? Number(db.prepare('SELECT COUNT(*) AS n FROM "UserKey"').get().n) : 0;
        } catch {
            return null;
        } finally {
            try { db?.close(); } catch { /* ignore */ }
        }
    };

    const tightenPermissions = (file) => {
        if (!posix) return;
        if ((fs.statSync(file).mode & 0o077) !== 0) {
            fs.chmodSync(file, 0o600);
            console.warn(`[local-secrets] Rechte von ${file} waren fuer Gruppe/Welt offen — auf 0600 gesetzt.`);
        }
    };

    const missing = SECRETS.filter((s) => !(process.env[s.name] || '').trim());
    if (missing.length > 0) {
        const file = path.resolve(
            (process.env.LOCAL_SECRETS_FILE || '').trim() || path.join(os.homedir(), '.slopdogs', 'local-secrets.env'),
        );
        if (isInside(realish(file), realish(process.cwd()))) {
            fail(`LOCAL_SECRETS_FILE ${file} liegt im Repo (${process.cwd()}) — die Schluessel duerfen nie ins Repo. Pfad ausserhalb waehlen.`);
        }
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });

        withLock(file, () => {
            // Unter dem Lock lesen: ein paralleler Start hat die Werte vielleicht gerade geschrieben.
            const exists = fs.existsSync(file);
            const stored = exists ? dotenv.parse(fs.readFileSync(file, 'utf8')) : {};
            if (exists) tightenPermissions(file);

            // Erst alle vorhandenen Werte pruefen, dann erzeugen — kein halber Schreibvorgang.
            for (const secret of missing) {
                const value = (stored[secret.name] || '').trim();
                if (value && !secret.valid(value)) fail(`${secret.name} in ${file} hat das falsche Format (${secret.format}).`);
            }

            const generated = [];
            for (const secret of missing) {
                const value = (stored[secret.name] || '').trim();
                if (value) {
                    process.env[secret.name] = value;
                    console.log(`[local-secrets] ${secret.name} aus Datei ${file}`);
                    continue;
                }
                if (secret.name === 'KEYSTORE_MASTER_KEY_V1') {
                    // Anderes HOME, geloeschte Datei, neuer Pfad: ein neuer Master-Key macht gespeicherte Keys unlesbar.
                    const authDb = authDatabaseFile();
                    const keys = authDb ? storedKeyCount(authDb) : 0;
                    if (keys === null) {
                        console.warn(`[local-secrets] WARNUNG: neuer KEYSTORE_MASTER_KEY_V1, Auth-DB ${authDb} nicht pruefbar — `
                            + 'liegen dort schon Schluessel, sind sie danach unlesbar.');
                    } else if (keys > 0) {
                        fail(`neuer KEYSTORE_MASTER_KEY_V1 waere noetig, aber die Auth-DB ${authDb} haelt ${keys} gespeicherte Schluessel — `
                            + 'sie waeren danach unlesbar. Stimmt LOCAL_SECRETS_FILE bzw. das HOME des Dienstes? Die alte Datei wiederherstellen.');
                    }
                }
                const fresh = crypto.randomBytes(32).toString('hex');
                process.env[secret.name] = fresh;
                generated.push(`${secret.name}=${fresh}`);
                console.log(`[local-secrets] ${secret.name} neu erzeugt → ${file}`);
            }

            if (generated.length === 0) return;
            const block = generated.join('\n') + '\n';
            if (exists) {
                const prefix = fs.readFileSync(file, 'utf8').endsWith('\n') || fs.statSync(file).size === 0 ? '' : '\n';
                fs.appendFileSync(file, prefix + block, { mode: 0o600 });
            } else {
                fs.writeFileSync(file, '# SlopDogs lokaler Modus — erzeugt von scripts/local-secrets.cjs. Nicht ins Repo.\n' + block, {
                    flag: 'wx',
                    mode: 0o600,
                });
            }
            tightenPermissions(file);
        });
    }
}
