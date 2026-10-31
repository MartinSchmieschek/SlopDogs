#!/usr/bin/env node
/**
 * Prettier-Pruefung mit Ausgangsliste (.prettier-baseline.json).
 *
 * Prettier kennt keine eingebaute Baseline. Dieses Skript prueft alle Dateien, die `prettier .`
 * erfassen wuerde (git ls-files ohne .gitignore/.prettierignore, nur Dateien mit Prettier-Parser),
 * und duldet genau die unformatierten Dateien, die in der Ausgangsliste stehen.
 *
 *   node scripts/format-check.cjs           (--check, Standard; npm run format:check)
 *     Exit 1, wenn eine Datei unformatiert ist, die nicht in der Liste steht, oder wenn ein
 *     Listeneintrag inzwischen formatiert ist bzw. nicht mehr existiert. So schrumpft die Liste
 *     zwingend mit jeder formatierten Datei.
 *   node scripts/format-check.cjs --update  (npm run format:baseline)
 *     Nimmt formatierte und verschwundene Dateien aus der Liste. Nur verkleinern: neue
 *     unformatierte Dateien werden nicht aufgenommen, der Lauf scheitert dann weiter. Gedacht
 *     nach `prettier --write` (npm run format).
 *   node scripts/format-check.cjs --init
 *     Schreibt die Liste aus dem aktuellen Stand neu, auch groesser. Nur bewusst einsetzen
 *     (erstes Anlegen, Bestand neu aufnehmen); neue Dateien vorher mit prettier --write formatieren.
 *
 * Eine leere Liste bleibt als [] stehen; eine fehlende Datei gilt als leere Liste.
 *
 * Optionen (.prettierrc.json), gemessen am Bestand als kleinster Formatierungs-Diff:
 * 4 Leerzeichen (YAML 2), einfache Anfuehrungszeichen, printWidth 140, trailingComma all.
 * endOfLine auto: unter Windows (core.autocrlf) liegen die Dateien mit CRLF vor, in der CI mit LF;
 * die Pruefung muss auf beiden gleich ausfallen. embeddedLanguageFormatting off: Template-Strings
 * tragen Dog-Code und HTML, die Prettier nie umschreiben darf.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const prettier = require('prettier');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = '.prettier-baseline.json';
const BASELINE_PATH = path.join(ROOT, BASELINE_FILE);
const IGNORE_PATHS = [path.join(ROOT, '.gitignore'), path.join(ROOT, '.prettierignore')];

class FormatBaselineCheck {
    /** @param {'check' | 'update' | 'init'} mode */
    constructor(mode) {
        this.mode = mode;
    }

    async run() {
        const files = await this.collectFiles();
        const { unformatted, unreadable } = await this.findUnformatted(files);
        const baseline = this.readBaseline();
        const baselineSet = new Set(baseline);
        const unformattedSet = new Set(unformatted);

        const added = unformatted.filter((file) => !baselineSet.has(file));
        const stale = baseline.filter((file) => !unformattedSet.has(file));

        if (this.mode === 'init') {
            this.writeBaseline(unformatted);
            console.log(`format-check: ${BASELINE_FILE} neu geschrieben, ${unformatted.length} Dateien geduldet.`);
            return this.reportUnreadable(unreadable);
        }

        if (this.mode === 'update' && stale.length > 0) {
            this.writeBaseline(baseline.filter((file) => unformattedSet.has(file)));
            console.log(`format-check: ${stale.length} Dateien aus ${BASELINE_FILE} genommen.`);
        }

        let failed = this.reportUnreadable(unreadable) !== 0;
        if (added.length > 0) {
            failed = true;
            console.error(`format-check: ${added.length} Dateien sind nicht formatiert und stehen nicht in ${BASELINE_FILE}:`);
            for (const file of added) console.error(`  ${file}`);
            console.error('Formatieren: npx prettier --write <datei>');
        }
        if (this.mode === 'check' && stale.length > 0) {
            failed = true;
            console.error(`format-check: ${stale.length} Eintraege in ${BASELINE_FILE} sind formatiert oder existieren nicht mehr:`);
            for (const file of stale) console.error(`  ${file}`);
            console.error('Aus der Baseline nehmen: npm run format:baseline');
        }
        if (!failed) {
            const tolerated = this.mode === 'update' ? baseline.length - stale.length : baseline.length;
            console.log(`format-check: ${files.length} Dateien geprueft, ${tolerated} aus der Baseline geduldet.`);
        }
        return failed ? 1 : 0;
    }

    /** Alle Dateien, die `prettier .` erfassen wuerde: von git bekannt, nicht ignoriert, mit Parser. */
    async collectFiles() {
        const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        })
            .split('\0')
            .filter(Boolean);
        const unique = [...new Set(listed)].filter((file) => fs.existsSync(path.join(ROOT, file)));
        const files = [];
        for (const file of unique) {
            const info = await prettier.getFileInfo(path.join(ROOT, file), { ignorePath: IGNORE_PATHS });
            if (!info.ignored && info.inferredParser) files.push(file);
        }
        return files.sort(compareCodePoints);
    }

    async findUnformatted(files) {
        const unformatted = [];
        const unreadable = [];
        for (const file of files) {
            const absolute = path.join(ROOT, file);
            try {
                const options = (await prettier.resolveConfig(absolute, { editorconfig: true })) || {};
                const source = fs.readFileSync(absolute, 'utf8');
                if (!(await prettier.check(source, { ...options, filepath: absolute }))) unformatted.push(file);
            } catch (error) {
                unreadable.push(`${file}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
            }
        }
        return { unformatted, unreadable };
    }

    reportUnreadable(unreadable) {
        if (unreadable.length === 0) return 0;
        console.error(`format-check: ${unreadable.length} Dateien konnte Prettier nicht lesen:`);
        for (const line of unreadable) console.error(`  ${line}`);
        return 1;
    }

    readBaseline() {
        if (!fs.existsSync(BASELINE_PATH)) return [];
        const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
        if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
            throw new Error(`${BASELINE_FILE} muss eine Liste von Dateipfaden sein.`);
        }
        return parsed;
    }

    writeBaseline(files) {
        fs.writeFileSync(BASELINE_PATH, JSON.stringify([...files].sort(compareCodePoints), null, 2) + '\n', 'utf8');
    }
}

/** Sortierung unabhaengig von der Locale, damit die Liste unter Windows und in der CI gleich aussieht. */
function compareCodePoints(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
}

function parseMode(argv) {
    const flags = argv.slice(2);
    const known = { '--check': 'check', '--update': 'update', '--init': 'init' };
    const unknown = flags.filter((flag) => !(flag in known));
    if (unknown.length > 0 || flags.length > 1) {
        throw new Error(`Aufruf: node scripts/format-check.cjs [--check | --update | --init] (erhalten: ${flags.join(' ')})`);
    }
    return flags.length === 0 ? 'check' : known[flags[0]];
}

function fail(error) {
    console.error(`format-check: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
}

Promise.resolve()
    .then(() => new FormatBaselineCheck(parseMode(process.argv)).run())
    .then((code) => {
        process.exitCode = code;
    }, fail);
