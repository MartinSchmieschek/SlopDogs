import zlib from 'zlib';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type Encoding = 'br' | 'gzip';

/**
 * Kompression fuer HTTP-Antworten (brotli vor gzip), ohne Fremdpaket — Node-zlib als Strom zwischen Handler und
 * Socket. Gepackt wird, was Text ist: HTML, JSON, JS, CSS, SVG, Klartext — die gebaute SPA, `public/landing`,
 * `/api/*`, `/k/:id`. Schriften (woff2) und Bilder sind schon gepackt und bleiben, wie sie sind.
 *
 * Nie angefasst: Server-Sent Events (`text/event-stream`, der Stream von POST /mcp — Pakete muessen sofort raus),
 * HEAD, 204/304, Range-Anfragen (206 ueber gepackte Bytes waere falsch), `Cache-Control: no-transform`,
 * Antworten, die schon ein Content-Encoding tragen, und alles unter der Schwelle. Der WebSocket-Hub haengt am
 * http.Server (Upgrade), nicht an Express — er sieht diese Middleware nicht. Content-Type bleibt unangetastet:
 * die Kennel-Ausgabe behaelt ihren ehrlichen Typ, nur die Uebertragung wird kleiner.
 *
 * Env HTTP_COMPRESSION=0 schaltet sie ab (etwa hinter einem Proxy, der selbst packt).
 */
export class ResponseCompression {
    /** Unter dieser Groesse kostet das Packen mehr, als es spart. */
    static readonly THRESHOLD_BYTES = 1024;
    private static readonly COMPRESSIBLE = /^(text\/(?!event-stream)[a-z0-9.+-]+|application\/(json|javascript|x-javascript|xml|manifest\+json|ld\+json|problem\+json|[a-z0-9.-]+\+json|[a-z0-9.-]+\+xml)|image\/svg\+xml)(\s*;|$)/i;

    constructor(
        private readonly brotliQuality = 5,
        private readonly gzipLevel = 6,
    ) {}

    static fromEnv(): ResponseCompression | null {
        const flag = (process.env.HTTP_COMPRESSION || '').trim().toLowerCase();
        return flag === '0' || flag === 'false' || flag === 'off' ? null : new ResponseCompression();
    }

    /** Die Kodierung, die der Client annimmt — brotli bevorzugt; `q=0` schliesst aus. */
    static negotiate(acceptEncoding: string | undefined): Encoding | null {
        if (!acceptEncoding) return null;
        const accepted = new Map<string, number>();
        for (const part of acceptEncoding.toLowerCase().split(',')) {
            const [name, ...params] = part.trim().split(';');
            const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
            accepted.set(name.trim(), q ? Number.parseFloat(q.slice(2)) || 0 : 1);
        }
        const wildcard = accepted.get('*');
        const weight = (name: Encoding) => accepted.get(name) ?? wildcard ?? 0;
        if (weight('br') > 0) return 'br';
        if (weight('gzip') > 0) return 'gzip';
        return null;
    }

    static isCompressible(contentType: unknown): boolean {
        return typeof contentType === 'string' && ResponseCompression.COMPRESSIBLE.test(contentType);
    }

    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction) => {
            const encoding = req.method === 'HEAD' || req.headers.range ? null : ResponseCompression.negotiate(req.get('accept-encoding'));
            if (!encoding) {
                next();
                return;
            }
            this.wrap(res, encoding);
            next();
        };
    }

    private shouldCompress(res: Response, firstChunkBytes: number | null): boolean {
        // Wer writeHead(status, headers) selbst ruft (der MCP-Transport), hat seine Header schon verschickt.
        if (res.headersSent) return false;
        if (res.statusCode === 204 || res.statusCode === 304 || res.statusCode === 206) return false;
        if (res.getHeader('Content-Encoding')) return false;
        if (/no-transform/i.test(String(res.getHeader('Cache-Control') ?? ''))) return false;
        if (!ResponseCompression.isCompressible(res.getHeader('Content-Type'))) return false;
        const declared = Number(res.getHeader('Content-Length'));
        const size = Number.isFinite(declared) && res.getHeader('Content-Length') !== undefined ? declared : firstChunkBytes;
        return size === null || size >= ResponseCompression.THRESHOLD_BYTES;
    }

    private createStream(encoding: Encoding): zlib.BrotliCompress | zlib.Gzip {
        return encoding === 'br'
            ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: this.brotliQuality } })
            : zlib.createGzip({ level: this.gzipLevel });
    }

    /**
     * Ersetzt write/end der Antwort. Die Entscheidung faellt beim ersten Byte (dann stehen Status und Header fest):
     * packen oder unveraendert durchreichen. Beim Packen fliesst alles durch einen zlib-Strom; der Gegendruck des
     * Sockets haelt den Strom an (drain).
     */
    private wrap(res: Response, encoding: Encoding): void {
        const originalWrite = res.write.bind(res) as (...args: any[]) => boolean;
        const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
        let stream: zlib.BrotliCompress | zlib.Gzip | null = null;
        let decided = false;

        const toBuffer = (chunk: any, enc?: any): Buffer | null => {
            if (chunk === undefined || chunk === null || typeof chunk === 'function') return null;
            return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof enc === 'string' ? (enc as BufferEncoding) : 'utf8');
        };

        const decide = (firstChunkBytes: number | null): void => {
            if (decided) return;
            decided = true;
            // Vary an jede Antwort, die gepackt sein koennte — sonst reicht ein Cache die gepackte Fassung an einen
            // Client weiter, der sie nicht versteht.
            if (ResponseCompression.isCompressible(res.getHeader('Content-Type'))) appendVary(res);
            if (!this.shouldCompress(res, firstChunkBytes)) return;
            res.removeHeader('Content-Length');
            res.setHeader('Content-Encoding', encoding);
            const zipped = this.createStream(encoding);
            zipped.on('data', (data: Buffer) => {
                if (!originalWrite(data)) zipped.pause();
            });
            zipped.on('end', () => originalEnd());
            zipped.on('error', (err) => {
                console.error('[ResponseCompression]', err);
                res.destroy(err);
            });
            res.on('drain', () => zipped.resume());
            // Ein Quell-Strom (express.static, sendFile) wartet nach `write() === false` auf 'drain' an der Antwort —
            // voll ist dann aber der zlib-Puffer, nicht der Socket.
            zipped.on('drain', () => res.emit('drain'));
            stream = zipped;
        };

        (res as any).write = (chunk: any, enc?: any, cb?: any): boolean => {
            const buffer = toBuffer(chunk, enc);
            decide(null);
            if (!stream) return originalWrite(chunk, enc, cb);
            if (!buffer) return true;
            return stream.write(buffer, typeof enc === 'function' ? enc : cb);
        };

        (res as any).end = (chunk?: any, enc?: any, cb?: any): Response => {
            const buffer = toBuffer(chunk, enc);
            decide(buffer ? buffer.length : 0);
            if (!stream) return originalEnd(chunk, enc, cb);
            const done = typeof chunk === 'function' ? chunk : typeof enc === 'function' ? enc : cb;
            if (typeof done === 'function') res.once('finish', done);
            if (buffer) stream.end(buffer);
            else stream.end();
            return res;
        };
    }
}

/** `Vary: Accept-Encoding` dazu, ohne ein vorhandenes Vary (Origin) zu verlieren. */
function appendVary(res: Response): void {
    if (res.headersSent) return;
    const current = String(res.getHeader('Vary') ?? '');
    if (current === '*' || /(^|,)\s*accept-encoding\s*(,|$)/i.test(current)) return;
    res.setHeader('Vary', current ? `${current}, Accept-Encoding` : 'Accept-Encoding');
}
