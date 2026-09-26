/**
 * Auth-Prisma-Client aus store/generated/prisma-auth-client — Pfad relativ zum
 * Projektroot (process.cwd()), damit dist/server-app/main.js nicht nach
 * dist/store/generated sucht.
 */

import path from 'path';
import type { PrismaClient } from './generated/prisma-auth-client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dbEnv = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
    resolveAuthDatabaseUrl: () => string;
};

export function createPrismaAuthClient(): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-auth-client')) as typeof import('./generated/prisma-auth-client');
    // Die URL MUSS ueber resolveAuthDatabaseUrl kommen: nur dort haengt
    // withPostgresPoolLimit das Pool-Budget an. Ohne diesen Override liest der
    // generierte Client `env("AUTH_DATABASE_URL")` direkt aus dem Prozess — und dort
    // steht die von assertRequiredDbEnv gespiegelte ROHE Store-URL ohne Pool-Parameter.
    // Der Auth-Pool fiele auf Prismas Default (num_cpus * 2 + 1) zurueck und die
    // Budget-Rechnung in dbEnv.cjs / .env.example waere Makulatur.
    //
    // Reihenfolge: createPrismaAuthClient() laeuft aus createHttpApplication, also lange
    // nach assertRequiredDbEnv() — das ruft schon scripts/load-env.cjs an JEDEM Entrypoint
    // auf (node -r ./scripts/load-env.cjs …), main.ts ein zweites Mal. Die Spiegelung
    // steht hier also in jedem Fall.
    return new mod.PrismaClient({
        datasources: { db: { url: dbEnv.resolveAuthDatabaseUrl() } },
    });
}
