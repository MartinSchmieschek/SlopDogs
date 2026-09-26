/**
 * Rotation des Key-Stores (P4c): verschluesselt jede UserKey-Zeile auf die hoechste konfigurierte
 * Master-Key-Version um (KEYSTORE_MASTER_KEY_V2, …). Batchweise, Host-seitig, ohne Ausgabe eines
 * Klartexts — auf stdout stehen nur Zahlen.
 *
 *   KEYSTORE_MASTER_KEY_V1=<alt> KEYSTORE_MASTER_KEY_V2=<neu> node scripts/rotateKeystore.cjs [--owner <userId>] [--batch <n>]
 *
 * Danach V1 aus der Env nehmen. Zeilen, die mit keinem konfigurierten Key entschluesseln, bleiben
 * unangetastet und werden gezaehlt (failed); keys.fetch meldet fuer sie key_undecryptable.
 */
'use strict';

require('./load-env.cjs');

const fs = require('fs');
const path = require('path');
const { resolveAuthDatabaseUrl } = require('./dbEnv.cjs');

function argValue(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Der Dienst aus dem Build (dist) oder, lokal, direkt aus der TypeScript-Quelle. */
function loadKeyStoreModule(root) {
    const built = path.join(root, 'dist', 'services', 'KeyStoreService.js');
    if (fs.existsSync(built)) return require(built);
    require('ts-node/register');
    return require(path.join(root, 'services', 'KeyStoreService.ts'));
}

async function main() {
    const root = process.cwd();
    const { KeyStoreService, MasterKeyring } = loadKeyStoreModule(root);
    const keyring = MasterKeyring.fromEnv(process.env);
    if (!keyring) {
        console.error('[rotateKeystore] KEYSTORE_MASTER_KEY_V1 fehlt — nichts zu tun.');
        process.exitCode = 1;
        return;
    }
    const { PrismaClient } = require(path.join(root, 'store', 'generated', 'prisma-auth-client'));
    const prisma = new PrismaClient({ datasources: { db: { url: resolveAuthDatabaseUrl() } } });
    try {
        const service = new KeyStoreService(prisma, keyring);
        const batch = Number(argValue('--batch')) || 100;
        const owner = argValue('--owner');
        const result = await service.rotate({ batchSize: batch, ...(owner ? { ownerId: owner } : {}) });
        console.log(`[rotateKeystore] Ziel V${result.target}: ${result.rotated} umgeschluesselt, ${result.failed} nicht entschluesselbar.`);
        if (result.failed > 0) process.exitCode = 2;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    // Nur die Nachricht — ein Stack koennte Zeilenwerte tragen, die hier nichts verloren haben.
    console.error('[rotateKeystore] gescheitert:', err && err.message ? err.message : String(err));
    process.exitCode = 1;
});
