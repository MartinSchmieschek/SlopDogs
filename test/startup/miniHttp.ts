/**
 * Ein Mini-Express auf 127.0.0.1, Port 0, fuer StartupTests ueber echtes HTTP: echte Kopfzeilen, echte Umleitungen,
 * HEAD wie im Browser — ohne den gebooteten Server und ohne festen Port. Die Identitaet je Anfrage kommt aus
 * Test-Kopfzeilen (`identity()`), nicht aus Cookie oder Token.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthCtx } from '../../mcp/auth/middleware';

export interface MiniReply {
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
}

export class MiniHttp {
    /** Eingeloggt als dieser Nutzer (`<id>@test.invalid`). */
    static readonly USER = 'x-test-user';
    /** Woher der Login kommt (`session` | `bearer` | `local`), Default `session`. */
    static readonly VIA = 'x-test-via';
    /** `1`: der Dev-Super-User ohne Nutzer. */
    static readonly SUPER = 'x-test-super';

    private constructor(
        private readonly server: http.Server,
        private readonly port: number,
    ) {}

    static async start(app: Application): Promise<MiniHttp> {
        const server = await new Promise<http.Server>((resolve, reject) => {
            const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
            listening.once('error', reject);
        });
        return new MiniHttp(server, (server.address() as AddressInfo).port);
    }

    /** `req.ctx` aus den Test-Kopfzeilen: Nutzer, Super-User oder anonym. */
    static identity(): RequestHandler {
        return (req: Request, _res: Response, next: NextFunction) => {
            const userId = req.get(MiniHttp.USER);
            const via = (req.get(MiniHttp.VIA) ?? 'session') as AuthCtx['via'];
            req.ctx = userId
                ? { user: { id: userId, email: `${userId.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false, via }
                : { user: null, isSuperUser: req.get(MiniHttp.SUPER) === '1' };
            next();
        };
    }

    /** Eine Anfrage ohne Keep-Alive; `body` geht als JSON. Folgt keiner Umleitung. */
    request(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<MiniReply> {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const sent =
            payload === undefined
                ? headers
                : { ...headers, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) };
        return new Promise((resolve, reject) => {
            const req = http.request({ host: '127.0.0.1', port: this.port, method, path, headers: sent, agent: false }, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () =>
                    resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
                );
                res.on('error', reject);
            });
            req.on('error', reject);
            if (payload !== undefined) req.write(payload);
            req.end();
        });
    }

    close(): Promise<void> {
        return new Promise((resolve) => this.server.close(() => resolve()));
    }
}
