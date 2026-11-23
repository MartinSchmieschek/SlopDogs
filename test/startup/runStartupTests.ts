/**
 * Einstieg von `npm run test:startup` (PLAN-DOG-PAKETE P0.1): faehrt den Server ohne listen() hoch,
 * samt Boot-Waechter, baut den Referenzindex, laesst die Startup-Suite laufen (Minimum-Satz und
 * Paket-Kandidaten, danach cleanupTestData) und endet bei jedem Fehler mit Exit 1, sonst 0.
 *
 * Nicht direkt starten: `scripts/run-startup-tests.cjs` legt vorher eigene, frische SQLite-Dateien an
 * und setzt die Umgebung — dev.db und die anderen Entwickler-Datenbanken bleiben unberuehrt.
 */
import { bootApplication, rebuildReferenceIndex, type BootedApplication } from '../../main';
import { Watchpost } from '../../services/Watchpost';
import type { TestResult } from '../../StartupTest';

class StartupTestRun {
    private readonly startedAt = Date.now();

    async execute(): Promise<number> {
        const booted = await bootApplication({ enforceKennelCoverage: true });
        try {
            await rebuildReferenceIndex(booted.refIndex, 0);
            const results = await booted.runStartupSuite();
            return this.report(results);
        } finally {
            await StartupTestRun.release(booted);
        }
    }

    private report(results: TestResult[]): number {
        const failed = results.filter((r) => !r.passed);
        const seconds = ((Date.now() - this.startedAt) / 1000).toFixed(1);
        console.log(
            `[test:startup] ${results.length} Tests gelaufen, ${results.length - failed.length} bestanden, ${failed.length} fehlgeschlagen (${seconds} s)`,
        );
        for (const r of failed) console.log(`[test:startup] FAIL ${r.name}: ${r.error ?? 'ohne Fehlertext'}`);
        if (results.length === 0) {
            console.log('[test:startup] FAIL: kein einziger Test ist gelaufen');
            return 1;
        }
        return failed.length === 0 ? 0 : 1;
    }

    /** Gibt Pools, Zaehler und den Wachposten frei; ein Fehler hier aendert das Testergebnis nicht. */
    private static async release(booted: BootedApplication): Promise<void> {
        await booted.callCounter.stop();
        await Promise.allSettled([booted.store.disconnect(), booted.jsonStorageService.disconnect(), booted.disconnectHttpApplication()]);
        await Watchpost.stopShared();
    }
}

new StartupTestRun().execute().then(
    (code) => process.exit(code),
    (err) => {
        console.error('[test:startup] Boot oder Suite abgebrochen:', err instanceof Error ? err.stack || err.message : err);
        process.exit(1);
    },
);
