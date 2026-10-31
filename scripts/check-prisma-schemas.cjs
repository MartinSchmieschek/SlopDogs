'use strict';

/**
 * Drift-Pruefung der Prisma-Schemas (P1.4): jedes Modell der Teil-Schemas (Cache, JSON-Storage,
 * Auth) muss im jeweiligen Haupt-Schema 1:1 stehen — SQLite gegen store/prisma/schema.prisma,
 * Postgres gegen store/prisma/schema.postgres.prisma.
 *
 * Warum das Pflicht ist: im Single-DB-Betrieb legt nur das Haupt-Schema die Tabellen an
 * (run-prisma-sync.cjs), und der Store-Client wird zur Laufzeit auf die Client-Typen der
 * Teil-Schemas gecastet (store/SharedPrismaClients.ts). Weicht ein Modell ab, droppt der Push
 * eine Spalte, die der Teil-Client erwartet, oder der Cast verspricht Felder, die es nicht gibt.
 *
 * Verglichen wird je Modell der Block zwischen `model X {` und `}` ohne Kommentare, mit
 * zusammengezogenem Whitespace. Das Haupt-Schema darf zusaetzliche Modelle fuehren.
 * Exit 0 = alles gleich, Exit 1 = Abweichung (mit Liste).
 *
 * Aufruf: node scripts/check-prisma-schemas.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCHEMA_PAIRS = [
    {
        main: 'store/prisma/schema.prisma',
        parts: ['store/prisma-cache/schema.prisma', 'store/prisma-json-storage/schema.prisma', 'store/prisma-auth/schema.prisma'],
    },
    {
        main: 'store/prisma/schema.postgres.prisma',
        parts: [
            'store/prisma-cache/schema.postgres.prisma',
            'store/prisma-json-storage/schema.postgres.prisma',
            'store/prisma-auth/schema.postgres.prisma',
        ],
    },
];

class PrismaSchemaModels {
    /** @param {string} relativePath */
    constructor(relativePath) {
        this.relativePath = relativePath;
        /** @type {Map<string, string>} Modellname -> normalisierter Block */
        this.models = new Map();
        /** @type {string[]} */
        this.duplicates = [];
        this.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
    }

    /** @param {string} source */
    parse(source) {
        const lines = source.split(/\r?\n/).map(PrismaSchemaModels.stripComment);
        let name = null;
        let body = [];
        for (const line of lines) {
            if (name === null) {
                const head = /^\s*model\s+(\w+)\s*\{\s*$/.exec(line);
                if (head) {
                    name = head[1];
                    body = [];
                }
                continue;
            }
            if (/^\s*\}\s*$/.test(line)) {
                if (this.models.has(name)) this.duplicates.push(name);
                this.models.set(name, body.join('\n'));
                name = null;
                continue;
            }
            const normalized = PrismaSchemaModels.normalize(line);
            if (normalized) body.push(normalized);
        }
        if (name !== null) throw new Error(`${this.relativePath}: model ${name} ohne schliessende Klammer`);
    }

    /** Entfernt `//`-Kommentare ausserhalb von Anfuehrungszeichen. */
    static stripComment(line) {
        let inString = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && line[i - 1] !== '\\') inString = !inString;
            if (!inString && ch === '/' && line[i + 1] === '/') return line.slice(0, i);
        }
        return line;
    }

    /** Whitespace zusammenziehen, um Klammern und Kommas ganz entfernen. */
    static normalize(line) {
        return line
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\s*([,()[\]])\s*/g, '$1');
    }
}

class PrismaSchemaDriftCheck {
    /** @returns {string[]} Abweichungen, leer = gleich */
    run() {
        const problems = [];
        for (const pair of SCHEMA_PAIRS) {
            const main = new PrismaSchemaModels(pair.main);
            for (const dup of main.duplicates) problems.push(`${pair.main}: model ${dup} steht doppelt`);
            for (const partPath of pair.parts) {
                const part = new PrismaSchemaModels(partPath);
                for (const dup of part.duplicates) problems.push(`${partPath}: model ${dup} steht doppelt`);
                for (const [name, block] of part.models) {
                    const mainBlock = main.models.get(name);
                    if (mainBlock === undefined) {
                        problems.push(`${pair.main}: model ${name} fehlt (aus ${partPath})`);
                    } else if (mainBlock !== block) {
                        problems.push(
                            `${pair.main}: model ${name} weicht von ${partPath} ab\n${PrismaSchemaDriftCheck.diff(block, mainBlock)}`,
                        );
                    }
                }
            }
        }
        return problems;
    }

    /** Zeilen, die nur auf einer Seite stehen — reicht, um die Abweichung zu finden. */
    static diff(partBlock, mainBlock) {
        const partLines = partBlock.split('\n');
        const mainLines = mainBlock.split('\n');
        const onlyPart = partLines.filter((l) => !mainLines.includes(l)).map((l) => `    Teil:  ${l}`);
        const onlyMain = mainLines.filter((l) => !partLines.includes(l)).map((l) => `    Haupt: ${l}`);
        const lines = [...onlyPart, ...onlyMain];
        return lines.length ? lines.join('\n') : '    (gleiche Zeilen, andere Reihenfolge)';
    }
}

const problems = new PrismaSchemaDriftCheck().run();
if (problems.length) {
    console.error(`[check-prisma-schemas] ${problems.length} Abweichung(en) — Haupt- und Teil-Schemas gleich halten:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}
const modelCount = SCHEMA_PAIRS.reduce((n, pair) => n + pair.parts.reduce((m, p) => m + new PrismaSchemaModels(p).models.size, 0), 0);
console.log(`[check-prisma-schemas] ok: ${modelCount} Teil-Modelle stimmen mit den Haupt-Schemas ueberein (SQLite und Postgres).`);
