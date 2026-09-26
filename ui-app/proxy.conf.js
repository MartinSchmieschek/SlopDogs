/**
 * Dev-Proxy: /api, /save und /k → Backend (PUBLIC_API_BASE_URL oder PORT aus Repo-Root-.env).
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
  '/k': { target, secure: false, changeOrigin: true },
};
