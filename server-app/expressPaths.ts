import path from 'path';
import fs from 'fs';

/** Angular-Produktionsbuild (Application-Builder → …/browser), nur wenn index.html existiert. */
export function resolveAngularBrowserDir(serverScriptDir: string): string | null {
    const candidates = [
        path.join(serverScriptDir, '..', 'ui-app', 'dist', 'ui-app', 'browser'),
        path.join(serverScriptDir, 'ui-app', 'dist', 'ui-app', 'browser'),
    ];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    }
    return null;
}

/** `public/` für `/static/*`. Bei `dist/main.js` liegt `serverScriptDir` unter `dist/`. */
export function resolvePublicDir(serverScriptDir: string): string | null {
    const candidates = [path.join(serverScriptDir, 'public'), path.join(serverScriptDir, '..', 'public')];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return null;
}
