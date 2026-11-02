/**
 * GET /api/health (Spur K, 02.11.): oeffentlich, ohne Login, nie gecacht, nur Namen und Versionen. Geprueft wird der
 * Handler, den Express wirklich unter der Route registriert hat — ohne Anfrage-Kontext (kein Login), mit einer
 * Fake-Response:
 *
 * 1. 200, `Cache-Control: no-store`, genau die erlaubten Felder (keine Nutzer, kein Speicher, keine Adressen).
 * 2. version = package.json des Servers, core/typedefs = installierte Pakete, dogs.versions summiert zu dogs.packages,
 *    commit kurz oder null, mode aus dem bekannten Satz.
 */
import * as fs from 'fs';
import * as path from 'path';
import { API_ROUTE } from '../../api/routes/routeTable';
import type { TestResultSink } from './packageCandidates';

const FIELDS = ['ok', 'name', 'version', 'commit', 'core', 'typedefs', 'dogs', 'stage', 'mode', 'uptimeSec'];

/** Die Teile einer Express-Schicht, die der Test liest. */
interface RouteLayer {
    route?: { path?: unknown; methods?: Record<string, boolean>; stack?: Array<{ handle?: unknown }> };
}
type RouteHandle = (req: unknown, res: unknown, next: () => void) => void;

interface HealthBody {
    ok?: unknown;
    name?: unknown;
    version?: unknown;
    commit?: unknown;
    core?: unknown;
    typedefs?: unknown;
    dogs?: { packages?: unknown; versions?: Record<string, unknown> };
    mode?: unknown;
    uptimeSec?: unknown;
}

export class HealthRouteTests {
    constructor(private readonly addResult: TestResultSink) {}

    run(app: unknown): void {
        const testName = 'Spur K: GET /api/health oeffentlich, no-store, nur Versionen';
        try {
            this.cases(app);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    private cases(app: unknown): void {
        const express = app as { router?: { stack?: RouteLayer[] }; _router?: { stack?: RouteLayer[] } } | null;
        const stack: RouteLayer[] = express?.router?.stack ?? express?._router?.stack ?? [];
        const layer = stack.find((l) => l.route?.path === API_ROUTE.health && l.route.methods?.get);
        const handle = layer?.route?.stack?.[0]?.handle;
        if (typeof handle !== 'function') throw new Error('GET /api/health nicht registriert');

        const out: { statusCode: number; body: HealthBody | undefined; headers: Record<string, string> } = {
            statusCode: 0,
            body: undefined,
            headers: {},
        };
        const res = {
            status(code: number) {
                out.statusCode = code;
                return res;
            },
            json(body: HealthBody) {
                out.body = body;
                return res;
            },
            setHeader(name: string, value: string) {
                out.headers[name.toLowerCase()] = value;
            },
        };
        (handle as RouteHandle)({ method: 'GET', url: API_ROUTE.health, query: {}, headers: {}, get: () => undefined }, res, () => {
            throw new Error('Handler reicht weiter (next)');
        });

        const body = out.body;
        if (out.statusCode !== 200 || !body || body.ok !== true) throw new Error(`Antwort ${out.statusCode} ${JSON.stringify(body)}`);
        if (out.headers['cache-control'] !== 'no-store') throw new Error(`Cache-Control: ${out.headers['cache-control']}`);
        const keys = Object.keys(body).sort();
        if (JSON.stringify(keys) !== JSON.stringify([...FIELDS].sort())) throw new Error(`Felder: ${keys.join(', ')}`);
        const text = JSON.stringify(body);
        if (/@|rss|heap|email|user|ip"|address/i.test(text)) throw new Error(`verbotener Inhalt: ${text}`);

        const server = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
        if (body.version !== server.version || body.name !== server.name)
            throw new Error(`version ${body.name}@${body.version} statt ${server.name}@${server.version}`);
        const installed = (name: string) =>
            JSON.parse(fs.readFileSync(require.resolve(`@martinschmieschek/${name}/package.json`), 'utf8')).version as string;
        if (body.core !== installed('slopdogs-core')) throw new Error(`core ${body.core}`);
        if (body.typedefs !== installed('slopdogs-typedefs')) throw new Error(`typedefs ${body.typedefs}`);
        const counted = Object.values(body.dogs?.versions ?? {}).reduce((sum: number, n) => sum + Number(n), 0);
        const packages = Number(body.dogs?.packages);
        if (!(packages > 0) || counted !== packages) throw new Error(`dogs ${JSON.stringify(body.dogs)} (Summe ${counted})`);
        if (body.commit !== null && !/^[0-9a-f]{7}$/.test(String(body.commit))) throw new Error(`commit ${body.commit}`);
        if (!['local', 'dev', 'deployed'].includes(String(body.mode))) throw new Error(`mode ${body.mode}`);
        if (!Number.isInteger(body.uptimeSec) || Number(body.uptimeSec) < 0) throw new Error(`uptimeSec ${body.uptimeSec}`);
    }
}
