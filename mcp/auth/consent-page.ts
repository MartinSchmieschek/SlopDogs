// HTML consent page for OAuth authorization. Plain inline page, no framework,
// matches the SlopDogs visual style (dark + emoji vibes from the kennel UI).

export function renderConsentPage(opts: {
    clientName: string;
    scope: string;
    csrf: string;
}): string {
    const { clientName, scope, csrf } = opts;
    const safeName = escapeHtml(clientName);
    const safeScope = escapeHtml(scope);
    const safeCsrf = escapeHtml(csrf);

    return [
        '<!DOCTYPE html>',
        '<html lang="en"><head>',
        '<meta charset="utf-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        '<title>SlopDogs — Grant access?</title>',
        '<style>',
        'body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
        '  background:radial-gradient(circle at 30% 20%,#1a1a2e 0%,#0a0a14 60%);color:#e8e8f0;',
        '  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}',
        '.card{background:rgba(26,26,46,.85);border:1px solid rgba(255,255,255,.08);',
        '  border-radius:16px;padding:32px;max-width:420px;width:100%;backdrop-filter:blur(8px);',
        '  box-shadow:0 12px 40px rgba(0,0,0,.5);}',
        '.title{font-size:22px;font-weight:600;margin:0 0 12px 0;}',
        '.subtitle{color:#a8a8c0;font-size:14px;margin:0 0 24px 0;line-height:1.5;}',
        '.client{font-weight:600;color:#fff;}',
        '.scope{display:inline-block;background:rgba(120,120,180,.2);border-radius:8px;',
        '  padding:4px 10px;margin:4px 4px 0 0;font-size:12px;color:#d0d0e8;}',
        '.actions{display:flex;gap:12px;margin-top:28px;}',
        '.btn{flex:1;border:none;border-radius:10px;padding:12px;font-size:14px;',
        '  font-weight:600;cursor:pointer;transition:transform .1s,filter .15s;}',
        '.btn:active{transform:translateY(1px);}',
        '.btn-approve{background:linear-gradient(135deg,#5b8def 0%,#3d6bff 100%);color:#fff;}',
        '.btn-approve:hover{filter:brightness(1.1);}',
        '.btn-deny{background:rgba(255,255,255,.08);color:#e8e8f0;}',
        '.btn-deny:hover{background:rgba(255,255,255,.12);}',
        '.foot{margin-top:24px;font-size:11px;color:#8080a0;text-align:center;}',
        '</style></head><body>',
        '<form method="POST" action="/auth/authorize" class="card">',
        '<input type="hidden" name="csrf" value="', safeCsrf, '" />',
        '<h1 class="title">Grant access?</h1>',
        '<p class="subtitle"><span class="client">', safeName, '</span> ',
        'is requesting access to your SlopDogs account. ',
        'It will be able to read and modify Kennels you own.</p>',
        '<div><span class="scope">', safeScope, '</span></div>',
        '<div class="actions">',
        '<button class="btn btn-deny" name="decision" value="deny" type="submit">Deny</button>',
        '<button class="btn btn-approve" name="decision" value="approve" type="submit">Approve</button>',
        '</div>',
        '<p class="foot">You can revoke this access any time at /auth/tokens.</p>',
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
