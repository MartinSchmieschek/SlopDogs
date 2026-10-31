/**
 * Dev-Proxy: /api, /save, /k, /auth, /static und die Kennel-Liste /kennels → Backend (PUBLIC_API_BASE_URL oder PORT aus
 * Repo-Root-.env).
 *
 * Vite vergleicht einfache Schluessel per startsWith — `/k` naehme sonst auch `/kennels/<ref>` (den Editor) mit.
 * Deshalb sind `/k` und `/kennels` Regex-Schluessel (Anfang `^`, gegen Pfad samt Query): `/k` nur als eigenes
 * Segment, `/kennels` nur exakt (Spur K: die Kennel-Liste als Kennel). Faellt der Kennel aus, leitet das Backend
 * auf `/kennels?spa=1` um; das bleibt hier bei ng serve (Angular-Liste) — kein Kreis.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'development';
for (const f of ['.env', '.env.local', `.env.${nodeEnv}`, `.env.${nodeEnv}.local`]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
}

const port = process.env.PORT || 3000;
let target = `http://127.0.0.1:${port}`;
const pub = (process.env.PUBLIC_API_BASE_URL || '').trim();
if (pub) {
  try {
    target = new URL(pub).origin;
  } catch {
    /* unverändert */
  }
}

module.exports = {
  '/api': { target, secure: false, changeOrigin: true },
  '/save': { target, secure: false, changeOrigin: true },
  '^/k([/?]|$)': { target, secure: false, changeOrigin: true },
  '/auth': { target, secure: false, changeOrigin: true },
  // Fonts and files of the kennel pages (public/ under /static), e.g. /static/landing/*.woff2 for /kennels.
  '/static': { target, secure: false, changeOrigin: true },
  '^/kennels/?([?].*)?$': {
    target,
    secure: false,
    changeOrigin: true,
    bypass: (req) => (/[?&]spa=1(&|$)/.test(req.url || '') ? req.url : undefined),
  },
};
