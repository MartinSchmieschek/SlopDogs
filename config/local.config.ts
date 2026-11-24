// Lokale Config (development, lokaler Modus): wie der Betrieb, aber mit allen Base-Dogs (Heimnetz, Demo, …).
// Die Kennel-Abdeckung prueft der Startup-Runner gesondert (bootApplication({ enforceKennelCoverage: true })).
import { defineConfig } from './AppConfig';
import defaultConfig from './default.config';
import { allBaseDogClasses, allPacts } from './dogs/allDogs';

export default defineConfig({
    ...defaultConfig,
    name: 'local',
    dogs: allBaseDogClasses,
    pacts: allPacts,
    requireKennelCoverage: false,
});
