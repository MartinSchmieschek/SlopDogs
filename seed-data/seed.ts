// Arr, this be the seeding rite — split across seed-data (see kennels/).
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
import { seedSlopdogsLandingKennel } from './kennels/slopdogs-landing';

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
    await seedSlopdogsLandingKennel(nodesStore, kennelsStore);
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
