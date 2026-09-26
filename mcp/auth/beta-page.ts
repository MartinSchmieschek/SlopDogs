// Die Seite "closed beta" nach dem Google-Login eines noch nicht freigeschalteten Kontos (SLOPDOGS_STAGE=beta, Auth an). Schlicht,
// ohne Framework, im Mixtape-Ton der App (Creme, Tinte, Orange), mobil ohne feste Breite. Das Formular schickt den
// Key zurueck an /auth/google/login — der Rueckweg (returnTo) reist mit, auch aus dem MCP-OAuth-Flow.

import { BetaKeys, type BetaKeyRefusal } from './betaKeys';

export function renderBetaKeyPage(opts: { reason: BetaKeyRefusal; returnTo?: string }): string {
    const text = escapeHtml(BetaKeys.REFUSAL_TEXT[opts.reason]);
    const returnTo = escapeHtml(opts.returnTo ?? '/kennels');
    return [
        '<!DOCTYPE html>',
        '<html lang="en"><head>',
        '<meta charset="utf-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        '<title>SlopDogs — closed beta</title>',
        '<style>',
        'body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;',
        '  background:#f0e6c8;color:#1c1712;font:16px/1.5 ui-monospace,Menlo,Consolas,monospace;}',
        '.card{width:min(420px,100%);border:2px solid #1c1712;background:#f8f1dc;padding:24px;box-sizing:border-box;',
        '  box-shadow:6px 6px 0 #1c1712;}',
        '.chip{display:inline-block;background:#1c1712;color:#f0e6c8;padding:2px 8px;font-size:12px;letter-spacing:.12em;',
        '  text-transform:uppercase;}',
        'h1{font:400 32px/1.1 Impact,"Bebas Neue",sans-serif;text-transform:uppercase;margin:12px 0;}',
        'p{margin:0 0 16px;overflow-wrap:anywhere;}',
        'label{display:block;font-size:13px;margin-bottom:6px;}',
        'input{width:100%;box-sizing:border-box;min-height:44px;padding:8px 12px;font:16px ui-monospace,monospace;',
        '  border:2px solid #1c1712;background:#fff;color:#1c1712;}',
        'button{margin-top:16px;width:100%;min-height:44px;border:2px solid #1c1712;background:#ff6a00;color:#1c1712;',
        '  font:700 16px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;}',
        'button:focus-visible,input:focus-visible{outline:3px solid #0f7f7a;outline-offset:2px;}',
        'a{color:#1c1712;}',
        '</style></head><body>',
        '<form method="GET" action="/auth/google/login" class="card">',
        '<span class="chip">closed beta</span>',
        '<h1>Got a key?</h1>',
        '<p role="alert">', text, '</p>',
        '<p>One key unlocks one Google account, once. After that you sign in without it.</p>',
        '<input type="hidden" name="returnTo" value="', returnTo, '" />',
        '<label for="betaKey">Beta key</label>',
        '<input id="betaKey" name="betaKey" autocomplete="off" autocapitalize="off" spellcheck="false" required />',
        '<button type="submit">Continue with Google</button>',
        '<p style="margin:16px 0 0;font-size:13px"><a href="/">Back to SlopDogs</a></p>',
        '</form></body></html>',
    ].join('');
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
