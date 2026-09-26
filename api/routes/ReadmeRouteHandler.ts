// The ReadmeRouteHandler — keeper of the sacred scrolls.
// For those who seek the truth, the README awaits in luminous plain text.
import fs from 'fs';
import path from 'path';

export class ReadmeRouteHandler {
    // Dev (ts-node): rootDir ist der Repo-Root — README.md liegt direkt daneben.
    // Deploy (dist/main.js): rootDir ist dist/, die README wird von tsc NICHT
    // mitkopiert — sie liegt einen Ordner hoeher im Repo-Root. Beide Kandidaten
    // probieren (gleiches Muster wie loadSkill im MCP-Router).
    private candidatePaths: string[];

    constructor(rootDir: string) {
        this.candidatePaths = [
            path.join(rootDir, 'README.md'),
            path.join(rootDir, '..', 'README.md'),
        ];
    }

    registerRoutes(app: any): void {
        app.get('/api/readme', (_req: any, res: any) => this.handleGet(_req, res));
    }

    // GET /api/readme — the project's README, rendered as plain text for those who seek the truth.
    private handleGet(_req: any, res: any): void {
        for (const p of this.candidatePaths) {
            try {
                const content = fs.readFileSync(p, 'utf-8');
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                res.send(content);
                return;
            } catch {
                /* try next candidate */
            }
        }
        res.status(500).json({ error: 'README.md not found' });
    }
}
