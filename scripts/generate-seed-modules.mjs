/**
 * Splits seed-data/seed.ts into category modules. Run from repo root:
 *   node scripts/generate-seed-modules.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'seed-data', 'seed.ts');
const lines = fs.readFileSync(seedPath, 'utf8').split(/\r?\n/);

function slice(a, b) {
    return lines.slice(a - 1, b).join('\n');
}

function write(p, content) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, content.trimEnd() + '\n', 'utf8');
}

const kennelHeader = `import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
`;

// --- seed-helpers.ts ---
const helpersCore = slice(12, 38)
    .replace(/\basync function kennelExists\b/, 'export async function kennelExists')
    .replace(/\basync function saveKennelSeed\b/, 'export async function saveKennelSeed');

const saveMimicBlock = slice(1048, 1072).replace(/\basync function saveMimic\b/, 'export async function saveMimic');

write(
    path.join(root, 'seed-data', 'seed-helpers.ts'),
    `import { randomUUID } from 'crypto';
import { IStore } from '../store/IStore';
import { SerializedDog, type IMimicDogConfig } from '@slopdogs/core';

${helpersCore}

${saveMimicBlock}
`
);

// --- earth-pulse-code.ts ---
let epStrings = slice(2769, 3006);
epStrings = epStrings
    .replace(/^const EARTH_PULSE_DATA_CODE/m, 'export const EARTH_PULSE_DATA_CODE')
    .replace(/^const EARTH_PULSE_RENDERER_CODE/m, 'export const EARTH_PULSE_RENDERER_CODE');
write(
    path.join(root, 'seed-data', 'earth-pulse-code.ts'),
    `/** Earth Pulse — PulsData / PulsRenderer VM strings (split from seed). */
${epStrings}`
);

// --- seed-default.ts ---
write(
    path.join(root, 'seed-data', 'seed-default.ts'),
    `import { randomUUID } from 'crypto';
import { IStore } from '../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { TalkingDog } from '@slopdogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@slopdogs/dogs-demo';
import { saveKennelSeed } from './seed-helpers';

${slice(46, 144)}
`
);

function kennel(rel, start, end, extraImport = '') {
    write(path.join(root, 'seed-data', 'kennels', rel), `${kennelHeader}${extraImport}${slice(start, end)}`);
}

write(
    path.join(root, 'seed-data', 'kennels', 'transit.ts'),
    `${kennelHeader}${slice(152, 215)}

${slice(1789, 1881)}

${slice(1882, 2026)}
`
);

kennel('markdown.ts', 221, 311);
kennel('compare.ts', 351, 503);
kennel('smart-guide.ts', 504, 843);
kennel('address-lookup.ts', 844, 1046);
kennel('location-dashboard.ts', 1079, 1261);
kennel('geo-weather.ts', 1262, 1788);
kennel('nature-trails.ts', 2027, 2571);

write(
    path.join(root, 'seed-data', 'kennels', 'earth-pulse.ts'),
    `${kennelHeader}import { EARTH_PULSE_DATA_CODE, EARTH_PULSE_RENDERER_CODE } from '../earth-pulse-code';

${slice(2588, 2704)}
`
);

kennel(
    'void-storms.ts',
    2714,
    2767,
    `import { VoidHuntDataCode } from '../VoidHuntData';
import { VoidHuntGalleryCode } from '../VoidHuntGallery';
`
);

const newSeedTs = `// Arr, this be the seeding rite — split across seed-data (see kennels/).
import path from 'path';
import { PrismaStore } from '../store/PrismaStore';
import { IStore } from '../store/IStore';
import { seedSerializedDog, seedKennelConfig } from './seed-default';
import { seedPublicTransportKennel, seedTransitScoutKennel, seedTransitScoutJsonKennel } from './kennels/transit';
import { seedMdReportKennel } from './kennels/markdown';
import { seedCompareKennel } from './kennels/compare';
import { seedSmartGuideKennel } from './kennels/smart-guide';
import { seedAddressLookupKennel } from './kennels/address-lookup';
import { seedLocationDashboardKennel } from './kennels/location-dashboard';
import { seedSunKennel, seedWikiNearbyKennel, seedGeocodingKennel, seedIsochroneKennel, seedAirQualityKennel, seedWeatherKennel, seedWindMapKennel } from './kennels/geo-weather';
import { seedNaturkundlerKennel, seedElevationKennel, seedTrailScoutKennel } from './kennels/nature-trails';
import { seedEarthPulseKennel } from './kennels/earth-pulse';
import { seedVoidStormsKennel } from './kennels/void-storms';

export async function runSeeds(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const seedLineageId = await seedSerializedDog(nodesStore);
    await seedKennelConfig(kennelsStore, seedLineageId);
    await seedPublicTransportKennel(nodesStore, kennelsStore);
    await seedMdReportKennel(nodesStore, kennelsStore);
    await seedWeatherKennel(nodesStore, kennelsStore);
    await seedAirQualityKennel(nodesStore, kennelsStore);
    await seedGeocodingKennel(nodesStore, kennelsStore);
    await seedIsochroneKennel(nodesStore, kennelsStore);
    await seedWikiNearbyKennel(nodesStore, kennelsStore);
    await seedSunKennel(nodesStore, kennelsStore);
    await seedLocationDashboardKennel(nodesStore, kennelsStore);
    await seedAddressLookupKennel(nodesStore, kennelsStore);
    await seedSmartGuideKennel(nodesStore, kennelsStore);
    await seedCompareKennel(nodesStore, kennelsStore);
    await seedWindMapKennel(nodesStore, kennelsStore);
    await seedTransitScoutKennel(nodesStore, kennelsStore);
    await seedTransitScoutJsonKennel(nodesStore, kennelsStore);
    await seedNaturkundlerKennel(nodesStore, kennelsStore);
    await seedEarthPulseKennel(nodesStore, kennelsStore);
    await seedVoidStormsKennel(nodesStore, kennelsStore);
    await seedElevationKennel(nodesStore, kennelsStore);
    await seedTrailScoutKennel(nodesStore, kennelsStore);
}

async function prismaSeedMain(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dbEnv = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
        assertRequiredDbEnv: () => void;
    };
    dbEnv.assertRequiredDbEnv();
    const dbUrl = process.env.DATABASE_URL!.trim();
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);
    if ((nodesStore as { init?: () => Promise<void> }).init) {
        await (nodesStore as any).init();
    }
    if ((kennelsStore as { init?: () => Promise<void> }).init) {
        await (kennelsStore as any).init();
    }
    await runSeeds(nodesStore, kennelsStore);
}

if (require.main === module) {
    prismaSeedMain().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
`;

write(path.join(root, 'seed-data', 'seed.ts'), newSeedTs);

console.log('OK: wrote seed modules under seed-data/ and replaced seed.ts');
