/**
 * Doc-Lint: jeder Pfad in den Texten fuer Agenten und Menschen muss in der Routentabelle stehen.
 *
 *   npm run lint:docs   (Teil von npm test)
 *
 * Quelle der Wahrheit: api/routes/routeTable.ts (per ts-node geladen).
 * Geprueft werden README.md, AISkill.md, ARCHITECTURE.md, mcp/skill.md, .cursor/skills/*\/SKILL.md,
 * mcp/tools/*.ts, mcp/spuren-brief.ts, mcp/werkzeugkasten.ts.
 *
 * Drei Pruefungen:
 *   1. Pfad-Tokens (/k, /api, /kennels, /auth, …) gegen die Tabelle; Platzhalter (:id, <id>, {id}, …)
 *      werden normalisiert. Alt-Pfade (LEGACY_308) nur in Zeilen, die `308` oder `legacy` sagen.
 *   2. Negativliste: alte Muster (/:kennelId, datadogs://, DATADOGS_, dataDogs, /kennel/) —
 *      erlaubt nur in Zeilen, die `308`, `legacy`, `alias` oder `deprecated` sagen.
 *   3. Werkzeugliste in mcp/skill.md ("What you can do — N tools") gegen die name:-Felder in
 *      mcp/tools/*.ts: gleiche Menge, gleiche Zahl.
 *
 * Exit 1 mit Datei:Zeile je Treffer.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const table = require(path.join(root, 'api', 'routes', 'routeTable.ts'));

const PATH_TOKEN = /(^|[\s`('"])(\/(?:k|api|kennels|dogs|account|auth|actions|mcp|static|\.well-known)(?:\/[A-Za-z0-9:._<>{}*-]+)*)/g;
/** Ein Namensraum fuer sich (`/api`, `/k/*`) ist keine Route, sondern die Rede ueber einen Raum. */
const NAMESPACES = new Set(['/k', '/api', '/auth', '/actions', '/static', '/.well-known']);
const LEGACY_LINE = /308|legacy/i;
const NEGATIVE_ALLOWED_LINE = /308|legacy|alias|deprecated/i;
const NEGATIVE = [
    { label: '/:kennelId', re: /\/:kennelId\b/ },
    { label: 'datadogs://', re: /datadogs:\/\//i },
    { label: 'DATADOGS_', re: /\bDATADOGS_[A-Z_]+/ },
    { label: 'dataDogs', re: /\bdataDogs\b/ },
    { label: 'localhost:4300/kennel/', re: /localhost:4300\/kennel\// },
    { label: '/kennel/', re: /(^|[^A-Za-z0-9_-])\/kennel\//i },
];

function listFiles() {
    const files = ['README.md', 'AISkill.md', 'ARCHITECTURE.md', 'mcp/skill.md', 'mcp/spuren-brief.ts', 'mcp/werkzeugkasten.ts'];
    const skillsDir = path.join(root, '.cursor', 'skills');
    if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir)) {
            const f = path.join('.cursor', 'skills', entry, 'SKILL.md');
            if (fs.existsSync(path.join(root, f))) files.push(f);
        }
    }
    for (const entry of fs.readdirSync(path.join(root, 'mcp', 'tools'))) {
        if (entry.endsWith('.ts')) files.push(path.join('mcp', 'tools', entry));
    }
    return files.map((f) => f.split(path.sep).join('/')).filter((f) => fs.existsSync(path.join(root, f)));
}

/** Ein Segment ist ein Platzhalter, wenn es :name, <name>, {name} oder * ist. */
function isPlaceholder(segment) {
    return /^:[A-Za-z_][A-Za-z0-9_]*$/.test(segment) || /^<[^>]+>$/.test(segment) || /^\{[^}]+\}$/.test(segment) || segment === '*';
}

function splitPath(p) {
    return p.replace(/\/+$/, '').split('/').slice(1);
}

/**
 * Ein Text-Pfad trifft ein Tabellen-Muster, wenn jedes Segment gleich ist oder das Tabellen-Segment
 * ein Platzhalter ist; `*` am Ende schluckt den Rest. Platzhalter im Text treffen nur Platzhalter.
 */
function matchesRoute(textPath, routePattern) {
    const t = splitPath(textPath);
    const r = splitPath(routePattern);
    for (let i = 0; i < r.length; i++) {
        if (r[i] === '*') return t.length >= i + 1;
        if (i >= t.length) return false;
        if (isPlaceholder(r[i])) continue;
        if (isPlaceholder(t[i])) return false;
        if (r[i] !== t[i]) return false;
    }
    return t.length === r.length;
}

/** Satzzeichen und Markdown-Reste am Ende eines Tokens gehoeren nicht zum Pfad. */
function trimToken(token) {
    return token.replace(/[.:,;]+$/, '').replace(/\/+$/, '') || '/';
}

function checkPaths(file, lines, errors) {
    const allowed = table.DOCUMENTED_ROUTES;
    const legacy = table.LEGACY_308.filter((p) => p !== table.LEGACY_ROUTE.kennel);
    lines.forEach((line, idx) => {
        PATH_TOKEN.lastIndex = 0;
        let m;
        while ((m = PATH_TOKEN.exec(line)) !== null) {
            const token = trimToken(m[2]);
            if (NAMESPACES.has(token.replace(/\/\*$/, ''))) continue;
            if (allowed.some((r) => matchesRoute(token, r))) continue;
            if (legacy.some((r) => matchesRoute(token, r))) {
                if (LEGACY_LINE.test(line)) continue;
                errors.push(`${file}:${idx + 1}: Alt-Pfad ohne 308/legacy-Hinweis: ${token}`);
                continue;
            }
            errors.push(`${file}:${idx + 1}: Pfad nicht in der Routentabelle: ${token}`);
        }
    });
}

function checkNegatives(file, lines, errors) {
    lines.forEach((line, idx) => {
        if (NEGATIVE_ALLOWED_LINE.test(line)) return;
        for (const n of NEGATIVE) {
            if (n.re.test(line)) errors.push(`${file}:${idx + 1}: altes Muster ${n.label}`);
        }
    });
}

function toolNamesFromCode() {
    const names = new Set();
    const dir = path.join(root, 'mcp', 'tools');
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.ts')) continue;
        const src = fs.readFileSync(path.join(dir, entry), 'utf8');
        const re = /^\s*name:\s*'([a-z][a-z0-9_]*)',/gm;
        let m;
        while ((m = re.exec(src)) !== null) names.add(m[1]);
    }
    return names;
}

/** Die Werkzeugliste in skill.md: vom Kopf "What you can do" bis zur naechsten ##-Ueberschrift. */
function checkSkillToolList(errors) {
    const file = 'mcp/skill.md';
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
    const start = lines.findIndex((l) => /^## What you can do/.test(l));
    if (start < 0) {
        errors.push(`${file}: Abschnitt "## What you can do" fehlt`);
        return;
    }
    let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    if (end < 0) end = lines.length;
    const code = toolNamesFromCode();
    const listed = new Set();
    for (let i = start + 1; i < end; i++) {
        const re = /`([a-z][a-z0-9_]*)`/g;
        let m;
        while ((m = re.exec(lines[i])) !== null) {
            if (code.has(m[1])) listed.add(m[1]);
        }
    }
    for (const name of code) {
        if (!listed.has(name)) errors.push(`${file}:${start + 1}: Werkzeug fehlt in der Liste: ${name}`);
    }
    const count = lines[start].match(/(\d+)\s+tools/);
    if (count && Number(count[1]) !== code.size) {
        errors.push(`${file}:${start + 1}: Kopf nennt ${count[1]} tools, der Code hat ${code.size}`);
    }
}

function main() {
    const errors = [];
    const files = listFiles();
    for (const file of files) {
        const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
        checkPaths(file, lines, errors);
        checkNegatives(file, lines, errors);
    }
    checkSkillToolList(errors);
    if (errors.length) {
        for (const e of errors) console.error(e);
        console.error(`\nlint:docs: ${errors.length} Fehler in ${files.length} Dateien`);
        process.exit(1);
    }
    console.log(`lint:docs: ${files.length} Dateien, alle Pfade in der Routentabelle`);
}

main();
