/**
 * Lädt Umgebungsvariablen wie dotenv-flow (spätere Dateien überschreiben frühere):
 *   .env → .env.local → .env.[NODE_ENV] → .env.[NODE_ENV].local
 *
 * Wird per `node -r ./scripts/load-env.cjs …` vor dem Hauptprogramm ausgeführt.
 * NODE_ENV in den npm-Scripts setzen: development | production | integration | …
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = process.cwd();
const nodeEnv = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = nodeEnv;

const files = ['.env', '.env.local', `.env.${nodeEnv}`, `.env.${nodeEnv}.local`];

for (const f of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const r = dotenv.config({ path: p, override: true });
    if (r.error) {
        console.warn(`[load-env] ${f}: ${r.error.message}`);
    }
}

try {
    require('./dbEnv.cjs').assertRequiredDbEnv();
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
