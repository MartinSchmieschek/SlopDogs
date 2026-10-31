#!/usr/bin/env node
'use strict';

/**
 * Teil von `npm run version-packages`: das Typ-Werkzeug (typedefs/) traegt immer die Version von core.
 * Changesets kennt in diesem Repo nur das Wurzelpaket; der Release-Workflow bricht ab, wenn beide abweichen.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const core = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const file = path.join(root, 'typedefs', 'package.json');
const text = fs.readFileSync(file, 'utf8');
const tool = JSON.parse(text);
if (tool.version === core.version) {
    console.log(`[sync-typedefs-version] typedefs schon auf ${core.version}`);
} else {
    fs.writeFileSync(file, text.replace(`"version": "${tool.version}"`, `"version": "${core.version}"`));
    console.log(`[sync-typedefs-version] typedefs ${tool.version} -> ${core.version}`);
}
