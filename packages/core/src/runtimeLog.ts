/**
 * Detaillierte Laufzeit-Logs (Configs, Cache-Treffer, TRACK-Zugriffe, fillKennel-Schritte).
 *
 * Standard: **aus** in allen Umgebungen (auch development).
 * Einschalten: `SLOPDOGS_LOG_LEVEL=verbose` oder `SLOPDOGS_VERBOSE=1`.
 * Erzwingen leise: `SLOPDOGS_LOG_LEVEL=quiet` oder `SLOPDOGS_QUIET=1`.
 * Die frueheren Namen `DATADOGS_*` gelten als Alias (siehe envFirst).
 */
export function isRuntimeLogVerbose(): boolean {
    const level = (envFirst('SLOPDOGS_LOG_LEVEL', 'DATADOGS_LOG_LEVEL') || '').toLowerCase().trim();
    if (level === 'verbose' || level === 'debug') return true;
    if (level === 'quiet' || level === 'minimal') return false;
    if (envFirst('SLOPDOGS_VERBOSE', 'DATADOGS_VERBOSE') === '1') return true;
    if (envFirst('SLOPDOGS_QUIET', 'DATADOGS_QUIET') === '1') return false;
    return false;
}

const reportedEnvAliases = new Set<string>();

/**
 * Liest eine Env-Variable unter ihrem neuen Namen, sonst unter dem frueheren (Umbenennung
 * dataDogs -> SlopDogs). Greift der alte Name, erscheint je Name genau eine Logzeile —
 * faellt weg, sobald das Render-Dashboard nur noch `SLOPDOGS_*` traegt.
 */
export function envFirst(newName: string, oldName: string): string | undefined {
    const current = process.env[newName];
    if (current !== undefined && current !== '') return current;
    const legacy = process.env[oldName];
    if (legacy === undefined || legacy === '') return current;
    if (!reportedEnvAliases.has(oldName)) {
        reportedEnvAliases.add(oldName);
        console.warn(`[env] alias in use: ${oldName} -> ${newName}`);
    }
    return legacy;
}
