// SlopDogs landing · skin B "Zine" (Follie, 2026-09-25). Dog body: renders SlopdogsLandingContent as HTML.
// Black-and-white xerox, airy: huge Anton type, lots of paper, one sticker or stamp per section, spray red as the only accent.
// Every text and list comes from C; sticker words are picked from C too. Placeholder <host> is shown as ‹host›.
// Fonts are self-hosted under /static/landing/ (Latin subset, OFL: public/landing/OFL.txt), no font CDN.
// "Already out there" is #sd-live: the lead dog fills its cards from /api/landing (states in PLAN P5).
var C = SlopdogsLandingContent;
var LOOK = 'b';
if (!C || typeof C !== 'object' || !Array.isArray(C.order)) {
  throw new Error('skin_b (Zine): SlopdogsLandingContent is missing or not the content master. Wire the content dog as a required parent of this skin.');
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function hst(s) { return esc(s).replace(/&lt;host&gt;/g, '‹host›'); }
function verse(key) { var v = C.verses && C.verses[key]; if (!v) return ''; return '<p class="vers">' + esc(v.lines.join(' ')) + ' <span>' + esc(v.name) + '</span></p>'; }
function looks() {
  return '<nav class="looks" aria-label="Look">' + C.looks.map(function (l) {
    var on = l.key === LOOK;
    return '<a href="?' + esc(C.lookParam) + '=' + esc(l.key) + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + esc(l.name) + '</a>';
  }).join('') + '</nav>';
}
function head(sec) { return '<p class="no">' + esc(sec.n) + ' · ' + esc(sec.label) + '</p>'; }
function lines(x) { var a = Array.isArray(x) ? x : String(x).split(/(?<=\.)\s+/); return a.map(function (l, i) { return '<span class="l"><span' + (i === a.length - 1 ? ' class="red"' : '') + '>' + esc(l) + '</span></span>'; }).join(''); }
function sticker(t, r, red) { return '<span class="sticker' + (red ? ' sticker--red' : '') + '" style="--r:' + r + 'deg" aria-hidden="true">' + esc(t) + '</span>'; }
function stamp(t, r) { return '<span class="stamp" style="--r:' + r + 'deg" aria-hidden="true">' + esc(t) + '</span>'; }

var CSS = ''
+ '@font-face{font-family:"Anton";src:url(/static/landing/anton.woff2) format("woff2");font-display:swap}'
+ '@font-face{font-family:"IBM Plex Mono";src:url(/static/landing/ibm-plex-mono-400.woff2) format("woff2");font-weight:400;font-display:swap}'
+ '@font-face{font-family:"IBM Plex Mono";src:url(/static/landing/ibm-plex-mono-700.woff2) format("woff2");font-weight:700;font-display:swap}'
+ ':root{--paper:#f4f1ea;--ink:#111;--muted:#5f5c56;--faint:#a49f95;--line:rgba(17,17,17,.16);--red:#ff2a1a;--display:"Anton","Impact","Arial Narrow",sans-serif;--mono:"IBM Plex Mono","Courier New",monospace;--gutter:22px;--max:1240px}'
+ '@media(min-width:768px){:root{--gutter:56px}}*{box-sizing:border-box}html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
+ 'body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--mono);font-size:1rem;line-height:1.55;overflow-x:hidden}'
+ 'body:before{content:"";position:fixed;inset:0;z-index:70;pointer-events:none;opacity:.09;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27%3E%3Cfilter id=%27g%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.8%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix values=%270 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.3 -.2%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23g)%27/%3E%3C/svg%3E")}'
+ 'a{color:inherit;text-decoration:none}:focus-visible{outline:3px solid var(--red);outline-offset:4px}h1,h2{margin:0;font-family:var(--display);font-weight:400;text-transform:uppercase;line-height:.86;letter-spacing:.005em}h3{margin:0}p{margin:0}'
+ '.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter);width:100%}'
+ '.top{position:sticky;top:0;z-index:20;background:var(--paper);border-bottom:2px solid var(--ink)}.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:62px}'
+ '.mark{font-family:var(--display);font-size:1.4rem;text-transform:uppercase;letter-spacing:.02em}.mark i{display:inline-block;width:.45em;height:.45em;border-radius:50%;background:var(--red);vertical-align:.35em;margin-left:2px}'
+ '.nav{display:flex;align-items:center;gap:14px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}.nav a.lbl:hover{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:4px;text-decoration-color:var(--red)}'
+ '.looks{display:flex;border:2px solid var(--ink);font-family:var(--display);font-size:.9rem;letter-spacing:.04em}.looks a{padding:6px 10px;color:var(--faint);border-right:2px solid var(--ink)}.looks a:last-child{border-right:0}.looks a:hover{color:var(--ink)}.looks a.on{background:var(--ink);color:var(--paper)}'
+ '@media(max-width:700px){.nav .lbl{display:none}.looks a{padding:6px 7px;font-size:.8rem}}'
+ '.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border:2px solid var(--ink);background:var(--paper);font:1.15rem var(--display);text-transform:uppercase;letter-spacing:.04em;box-shadow:4px 4px 0 var(--ink);transition:transform .1s,box-shadow .1s}.btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}.btn--ink{background:var(--ink);color:var(--paper)}'
+ '.screen{min-height:100svh;display:grid;align-content:center;padding:96px 0 72px;position:relative;border-top:1px solid var(--line)}.hero{border-top:0}'
+ '.no{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:26px}'
+ '.screen h1,.screen h2{font-size:clamp(3.4rem,14vw,12rem);max-width:9ch}.screen h1 .l,.screen h2 .l{display:block;overflow:hidden}.screen h1 .l span,.screen h2 .l span{display:inline-block}.red{color:var(--red)}'
+ '.one{margin-top:30px;font-size:clamp(1rem,1.7vw,1.3rem);max-width:32rem;line-height:1.5}.one b{font-weight:700;background:var(--ink);color:var(--paper);padding:0 5px}'
+ '.el{margin-top:44px}.aside{margin-top:36px;font-size:.78rem;color:var(--faint)}'
+ '.vers{margin-top:26px;font-size:.74rem;color:var(--faint);font-style:italic;max-width:34rem}.vers span{font-style:normal;letter-spacing:.18em;text-transform:uppercase;margin-left:10px;font-size:.64rem;color:var(--red)}'
+ '.sticker{position:absolute;right:var(--gutter);top:22%;display:inline-block;padding:10px 16px;background:#fff;border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);font:1.3rem var(--display);text-transform:uppercase;letter-spacing:.04em;transform:rotate(var(--r,-4deg));z-index:1}.sticker--red{background:var(--red)}'
+ '.stamp{position:absolute;right:var(--gutter);top:22%;padding:10px 14px;border:3px double var(--red);color:var(--red);font:700 .8rem var(--mono);letter-spacing:.2em;text-transform:uppercase;transform:rotate(var(--r,-8deg));z-index:1;opacity:.9}'
+ '@media(max-width:900px){.sticker,.stamp{position:static;display:inline-block;margin-top:28px}}'
+ '.tags{display:flex;flex-wrap:wrap;gap:8px;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}.tags span{padding:7px 11px;border:2px solid var(--line);color:var(--muted)}'
/* what: chain */
+ '.chain{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}.chain .k{padding:10px 14px;border:2px solid var(--ink);background:#fff}.chain .k.kennel{background:var(--ink);color:var(--paper)}.chain .k.url{background:var(--red)}.chain .a{font:1.6rem var(--display);color:var(--faint)}'
/* packs: bricks */
+ '.plug{max-width:820px;display:grid;gap:26px}.plug-row{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}@media(min-width:640px){.plug-row{grid-template-columns:auto auto 1fr;gap:18px}}'
+ '.plug-ai{border:2px solid var(--ink);padding:14px 16px;font:1.05rem var(--display);text-transform:uppercase;letter-spacing:.04em;background:#fff;box-shadow:4px 4px 0 var(--ink);white-space:nowrap}.plug-hand{display:none;font:2.4rem var(--display);color:var(--red)}@media(min-width:640px){.plug-hand{display:block}}'
+ '.rack{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:560px){.rack{grid-template-columns:repeat(4,1fr)}}'
+ '.brick{position:relative;border:2px solid var(--ink);padding:18px 10px 10px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:#fff;transition:background .3s,color .3s,transform .3s}.brick small{display:block;font-size:.58rem;letter-spacing:.04em;text-transform:none;color:var(--faint);margin-top:2px}'
+ '.brick:before{content:"";position:absolute;left:10px;right:10px;top:6px;height:6px;background:radial-gradient(circle at 6px 3px,var(--ink) 2.5px,transparent 3px) 0 0/16px 6px repeat-x;opacity:.55}'
+ '.brick.on{background:var(--red);color:var(--ink);transform:translate(-2px,-2px);box-shadow:3px 3px 0 var(--ink)}.brick.yours{border-style:dashed;color:var(--ink)}'
+ '.bars{display:grid;gap:10px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.bars div{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center}.bars i{display:block;height:10px;background:var(--ink);opacity:.35;width:100%;transform-origin:0 50%;animation:grow 1.4s cubic-bezier(.16,1,.3,1) both}.bars .short{background:var(--red);opacity:1;width:18%}@keyframes grow{from{transform:scaleX(0)}}@media(prefers-reduced-motion:reduce){.bars i{animation:none}}'
/* faces */
+ '.faces{max-width:660px;display:grid;gap:14px}.f-url{font-size:clamp(.9rem,2vw,1.15rem);font-weight:700;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}.f-url b{color:var(--red);font-size:.75em;letter-spacing:.14em}.f-url em{font-style:normal;font-weight:400;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--paper);background:var(--ink);padding:4px 10px}'
+ '.f-view{position:relative;aspect-ratio:400/220;border:2px solid var(--ink);overflow:hidden;background:#fff;box-shadow:6px 6px 0 var(--ink)}.pane{position:absolute;inset:0;opacity:0;transition:opacity .5s}.pane.on{opacity:1}.pane svg{width:100%;height:100%;display:block}'
+ '.sw{padding:14px 16px;display:grid;gap:8px;align-content:start;font-size:clamp(.66rem,1.5vw,.8rem)}.sw-top{display:flex;justify-content:space-between;gap:10px;font-weight:700;padding-bottom:8px;border-bottom:2px solid var(--ink)}.sw-op{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:center;padding:8px 10px;border:2px solid var(--ink);color:var(--muted);background:var(--paper)}.sw-op b{background:var(--ink);color:var(--paper);padding:3px 8px;font-weight:700;font-size:.7rem}.sw-op.post b{background:var(--red);color:var(--ink)}.sw-op code{color:var(--ink);font-weight:700}'
+ '.md{padding:20px 22px;color:var(--muted);font-size:clamp(.8rem,1.8vw,1rem);line-height:1.5}.md h4{margin:0 0 8px;font:1.9em var(--display);text-transform:uppercase;color:var(--ink);padding-bottom:6px;border-bottom:2px solid var(--ink)}.md li{margin-left:18px}'
+ '.f-tabs{display:flex;gap:6px;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase}.f-tabs span{padding:8px 12px;border:2px solid var(--line);color:var(--faint);transition:color .3s,border-color .3s}.f-tabs span.on{color:var(--ink);border-color:var(--ink);background:#fff}'
/* how */
+ '.cmd{display:flex;max-width:760px;border:3px solid var(--ink);background:var(--ink);color:var(--paper);box-shadow:6px 6px 0 var(--red)}.cmd pre{margin:0;padding:16px 18px;font:.86rem/1.6 var(--mono);flex:1 1 auto;overflow:auto;white-space:pre}.cmd pre b{color:var(--red);font-weight:700}'
+ '.cmd button{all:unset;cursor:pointer;min-width:64px;min-height:48px;display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(244,241,234,.3);color:var(--paper);font:.7rem var(--mono);letter-spacing:.14em;text-transform:uppercase}.cmd button:hover{background:var(--red);color:var(--ink)}'
/* breakout */
+ '.bo{max-width:900px;display:grid;gap:18px}.bo-row{display:grid;gap:12px}@media(min-width:720px){.bo-row{grid-template-columns:1fr 1fr 1fr}}'
+ '.stop{border:2px solid var(--ink);padding:14px 16px;min-height:96px;display:grid;align-content:center;gap:6px;background:#fff}.stop .h{font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}.stop .v{font-size:.86rem;font-weight:700;word-break:break-all}'
+ '.stop.live{background:var(--ink);color:var(--paper)}.stop.live .h{color:#bdb7a9}.stop.live .v{color:var(--red)}'
+ '.dead{display:flex;flex-wrap:wrap;gap:10px 16px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.dead s{text-decoration-color:var(--red);text-decoration-thickness:2px}'
+ '.log{border:2px solid var(--ink);padding:12px 16px;font-size:.78rem;line-height:1.7;color:var(--muted);min-height:7em;background:#fff}.log div{opacity:.25;transition:opacity .4s}.log div.on{opacity:1}.log b{color:var(--faint);font-weight:400;display:inline-block;width:6.5em}.log .live{color:var(--red);font-weight:700}.nojs .log div{opacity:1}'
/* out */
+ '.six{display:grid;border-top:2px solid var(--ink);border-left:1px solid var(--line);list-style:none;margin:0;padding:0}.six>li{display:grid}.six>li.ph{opacity:.4}@media(min-width:640px){.six{grid-template-columns:1fr 1fr}}@media(min-width:1024px){.six{grid-template-columns:repeat(3,1fr)}.six>li.wide{grid-column:span 2}}'
+ '.grp{margin-top:44px}.grp .no{margin-bottom:16px}.k .stars{font-size:.72rem;font-weight:700;letter-spacing:.12em;color:var(--ink)}.st p{margin-top:30px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.st .btn{margin-left:12px;color:var(--ink);cursor:pointer}'
+ '.k{padding:24px 22px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;gap:8px;align-content:start;min-height:200px;transition:background .15s}.k:hover{background:#fff}.k .id{font-size:.68rem;color:var(--faint);display:flex;justify-content:space-between;gap:8px}.k h3{font:1.6rem var(--display);text-transform:uppercase;letter-spacing:.01em}.k p{color:var(--muted);font-size:.86rem;line-height:1.45}'
+ '.foot{padding:36px 0 56px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px 28px;font-size:.74rem;color:var(--muted);border-top:2px solid var(--ink)}.foot .vers{margin:0}';

/* ---------- sections ---------- */
function hero() {
  var H = C.hero, loc = H.local || {};
  return '<section class="screen hero" aria-labelledby="h1"><div class="wrap"><p class="no">' + esc(H.kicker) + ' · ' + esc(H.sign) + '</p>'
    + '<h1 id="h1">' + lines(H.headline) + '</h1>'
    + sticker((H.tagline || [])[0] || H.kicker, -5, true)
    + '<p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el tags">' + (H.tagline || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '<span style="background:#fff;border-color:var(--ink);color:var(--ink)">' + esc(loc.chip) + '</span></div>'
    + '<div class="el" style="display:flex;flex-wrap:wrap;gap:16px"><a class="btn btn--ink" href="#' + esc(C.nav[0] && C.nav[0].anchor) + '">' + esc(C.nav[0] && C.nav[0].label) + '</a>' + (C.nav[1] ? '<a class="btn" href="#' + esc(C.nav[1].anchor) + '">' + esc(C.nav[1].label) + '</a>' : '') + '</div>'
    + verse(H.verse) + '</div></section>';
}
var R = {};
R.what = function () {
  var W = C.what, last = (W.chain || [])[W.chain.length - 1];
  return '<section class="screen" id="what"><div class="wrap">' + head(W) + '<h2>' + lines(W.headline) + '</h2>' + stamp(last ? last.label.replace(/<host>/g, '‹host›') : W.label, -7)
    + '<p class="one">' + hst(W.lede) + '</p>'
    + '<div class="el chain" aria-label="chain">' + (W.chain || []).map(function (c, i, a) {
      var next = a[i + 1]; var arrow = next && next.kind !== c.kind ? '<span class="a">→</span>' : (next ? '<span class="a">+</span>' : '');
      return '<span class="k ' + esc(c.kind) + '">' + hst(c.label) + '</span>' + arrow;
    }).join('') + '</div></div></section>';
};
R.packs = function () {
  var P = C.packs;
  return '<section class="screen" id="packs"><div class="wrap">' + head(P) + '<h2>' + lines(P.headline) + '</h2>' + sticker((P.attrs || []).join(' · '), 3, false)
    + '<p class="one">' + hst(P.lede) + '</p>'
    + '<div class="el plug"><div class="plug-row"><div class="plug-ai">' + esc((C.hero.local || {}).chip || 'your AI') + '</div><div class="plug-hand" aria-hidden="true">→</div>'
    + '<div class="rack" id="rack">' + (P.modules || []).map(function (m, i) { return '<span class="brick' + (i === 0 ? ' on' : '') + '">' + esc(m.name) + '<small>' + esc(m.pack) + '</small></span>'; }).join('')
    + (P.yours ? '<span class="brick yours">' + esc(P.yours.name) + '<small>' + esc(P.yours.note) + '</small></span>' : '') + '</div></div>'
    + '<div class="bars" aria-hidden="true">' + (P.bars || []).map(function (b, i) { return '<div><span>' + esc(b.label) + '</span><i class="' + esc(b.size) + '" style="animation-delay:' + (i * .3) + 's"></i></div>'; }).join('') + '</div>'
    + '<div class="tags"><span>' + esc(P.footnote) + '</span></div></div></div></section>';
};
R.faces = function () {
  var F = C.faces, pv = F.preview || {};
  var panes = (F.items || []).map(function (it, i) {
    var inner = '';
    if (it.key === 'page') inner = '<svg viewBox="0 0 400 220" fill="none"><rect width="400" height="220" fill="#fff"/><rect width="400" height="28" fill="#111"/><circle cx="16" cy="14" r="4" fill="#f4f1ea"/><circle cx="30" cy="14" r="4" fill="#f4f1ea"/><g stroke="#e3dfd4" stroke-width="1.5"><path d="M0 90h400M0 150h400M100 28v192M240 28v192"/></g><path d="M30 180 C120 120,200 200,290 110 S 360 70, 380 80" stroke="#111" stroke-width="3" stroke-dasharray="8 6"/><circle cx="30" cy="180" r="7" fill="#111"/><circle cx="380" cy="80" r="7" fill="#ff2a1a"/><text x="200" y="208" font-family="Impact,sans-serif" font-size="14" fill="#111" text-anchor="middle" letter-spacing="1">' + esc(String((pv.page || {}).title || '').toUpperCase()) + '</text></svg>';
    else if (it.key === 'api') inner = '<div class="sw"><div class="sw-top"><span>' + esc(F.example) + '</span><span style="color:var(--faint);font-weight:400">' + hst(it.line) + '</span></div>' + ((pv.api || {}).endpoints || []).map(function (e) { return '<div class="sw-op' + (e.method === 'POST' ? ' post' : '') + '"><b>' + esc(e.method) + '</b><code>' + esc(e.path) + '</code><span>' + esc(e.note) + '</span></div>'; }).join('') + '</div>';
    else inner = '<div class="md">' + ((pv.md || {}).lines || []).map(function (l) { return l.mark === '#' ? '<h4>' + esc(l.text) + '</h4>' : l.mark === '-' ? '<li>' + esc(l.text) + '</li>' : '<p>' + esc(l.text) + '</p>'; }).join('') + '</div>';
    return '<div class="pane' + (i === 0 ? ' on' : '') + '" data-k="' + esc(it.key) + '" data-line="' + hst(it.line) + '" data-suffix="' + esc(it.suffix) + '" aria-hidden="true">' + inner + '</div>';
  }).join('');
  return '<section class="screen" id="faces"><div class="wrap">' + head(F) + '<h2>' + lines(F.headline) + '</h2>' + stamp(F.method + ' ' + ((F.items || [])[0] || {}).line, -6)
    + '<p class="one">' + hst(F.lede) + '</p>'
    + '<div class="el faces" id="fc"><div class="f-url"><b>' + esc(F.method) + '</b> <span>' + hst(F.url) + '<span id="fsuf"></span></span> <em id="fline">' + hst((F.items[0] || {}).line) + '</em></div>'
    + '<div class="f-view">' + panes + '</div>'
    + '<div class="f-tabs" aria-hidden="true">' + (F.items || []).map(function (it, i) { return '<span data-k="' + esc(it.key) + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(it.label) + '</span>'; }).join('') + '</div></div>'
    + verse(F.verse) + '</div></section>';
};
R.how = function () {
  var H = C.how, cmd = esc(H.command), hi = esc(H.commandHighlight);
  if (hi) cmd = cmd.replace(hi, '<b>' + hi + '</b>');
  cmd = cmd.replace(/&lt;host&gt;/g, '‹host›');
  return '<section class="screen" id="how"><div class="wrap">' + head(H) + '<h2>' + lines(H.headline) + '</h2>' + stamp((C.hero.tagline || [])[2] || H.label, -9)
    + '<p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el cmd"><pre id="cmdtext">' + cmd + '</pre><button type="button" id="copy" data-idle="' + esc(H.copy.idle) + '" data-done="' + esc(H.copy.done) + '" aria-label="' + esc(H.copy.idle) + '">' + esc(H.copy.idle) + '</button></div>'
    + '<p class="aside">' + esc(H.aside) + '</p>' + verse(H.verse) + '</div></section>';
};
R.breakout = function () {
  var B = C.breakout;
  return '<section class="screen" id="breakout"><div class="wrap">' + head(B) + '<h2>' + lines(B.headline) + '</h2>' + sticker(B.dead ? B.dead.note : B.label, 4, false)
    + '<p class="one">' + hst(B.lede) + '</p>'
    + '<div class="el bo"><div class="bo-row">' + (B.stops || []).map(function (s) {
      var v = s.href ? '<a href="' + esc(s.href) + '">' + hst(s.value) + '</a>' : hst(s.value);
      return '<div class="stop' + (s.live ? ' live' : '') + '"><span class="h">' + esc(s.label) + '</span><span class="v">' + v + '</span></div>';
    }).join('') + '</div>'
    + (B.dead ? '<div class="dead"><s>' + esc(B.dead.label) + '</s><s>' + esc(B.dead.value) + '</s><span>' + esc(B.dead.note) + '</span></div>' : '')
    + '<div class="log" id="log">' + (B.log || []).map(function (l) { return '<div data-at="' + (+l.at || 0) + '"' + (l.live ? ' class="live"' : '') + '><b>' + esc(l.who) + '</b>' + hst(l.text) + '</div>'; }).join('') + '</div>'
    + '</div></div></section>';
};
R.out = function () {
  var O = C.out, sizes = ((O.live || {}).sizes || []).join('|');
  return '<section class="screen" id="out"><div class="wrap">' + head(O) + '<h2>' + lines(O.headline) + '</h2>' + sticker(C.footer.tag || O.label, -3, false)
    + '<p class="one">' + hst(O.lede) + '</p>'
    + live(function (l) {
      return '<div class="grp" data-group="' + esc(l.key) + '"><p class="no">' + esc(l.label) + '</p><ol class="six" data-list="' + esc(l.key) + '" data-kind="' + esc(l.kind) + '" data-sizes="' + esc(sizes) + '"></ol><p class="one" data-empty="' + esc(l.key) + '" hidden>' + esc(l.empty) + '</p></div>';
    }, '<li><a class="k" data-f-href href="/kennels"><span class="id"><span data-f="path"></span><span data-f="calls"></span></span><h3><span data-f="emoji" aria-hidden="true"></span> <span data-f="name"></span></h3><p data-f="description"></p><span class="stars" data-f="stars"></span></a></li>')
    + (O.more ? '<div class="el"><a class="btn" href="' + esc(O.more.href) + '">' + esc(O.more.label) + '</a></div>' : '')
    + '</div></section>';
};
/* #sd-live: states, one ranking per list, a card <template>; the lead's page script fills it from /api/landing. */
function live(group, card) {
  var L = C.out.live || {}, st = L.states || {}, w = L.words || {};
  return '<div id="sd-live" data-state="loading" aria-busy="true" data-api="' + esc(L.api) + '" data-limit="' + esc(L.limit) + '" data-emoji="' + esc(L.emoji) + '" data-dog-href="' + esc(L.dogHref) + '" data-w-calls="' + esc(w.calls) + '" data-w-call="' + esc(w.call) + '" data-w-reuse="' + esc(w.reuse) + '" data-w-reuse-one="' + esc(w.reuseOne) + '" data-w-proven="' + esc(w.proven) + '">'
    + '<div class="st" role="status" aria-live="polite">' + ['loading', 'waking', 'empty'].map(function (k) { return '<p data-when="' + k + '">' + esc(st[k]) + '</p>'; }).join('')
    + '<p data-when="error">' + esc(st.error) + ' <button type="button" class="btn" data-retry>' + esc(st.retry) + '</button></p></div>'
    + (L.lists || []).map(group).join('')
    + '<template data-tpl="card">' + card + '</template></div>';
}
function footer() {
  var F = C.footer;
  return '<footer class="wrap foot"><span>' + esc(F.line) + ' · <a href="#' + esc(F.commandAnchor) + '">' + esc(F.command) + '</a> · ' + esc(F.tag) + '</span>' + verse(F.verse) + '</footer>';
}

/* ---------- page script (vanilla, quiet) ---------- */
var JS = ''
+ '(function(){var R=matchMedia("(prefers-reduced-motion: reduce)").matches;document.documentElement.className=R?"nojs":"";'
+ 'var cp=document.getElementById("copy");if(cp){cp.addEventListener("click",function(){var t=document.getElementById("cmdtext").textContent.replace(/[\\u2039\\u203a]/g,function(c){return c=="\\u2039"?"<":">";});if(navigator.clipboard)navigator.clipboard.writeText(t);cp.textContent=cp.dataset.done;setTimeout(function(){cp.textContent=cp.dataset.idle;},1200);});}'
+ 'if(R)return;'
+ 'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var id=e.target.id;'
+ 'if(id=="fc"){var ps=e.target.querySelectorAll(".pane"),ts=e.target.querySelectorAll(".f-tabs span"),i=0;setInterval(function(){i=(i+1)%ps.length;ps.forEach(function(p,j){p.classList.toggle("on",j==i);});ts.forEach(function(t,j){t.classList.toggle("on",j==i);});document.getElementById("fline").textContent=ps[i].dataset.line;document.getElementById("fsuf").textContent=ps[i].dataset.suffix;},2600);}'
+ 'if(id=="rack"){var ms=e.target.querySelectorAll(".brick:not(.yours)"),m=0;setInterval(function(){m=(m+1)%ms.length;ms.forEach(function(x,j){x.classList.toggle("on",j==m);});},900);}'
+ 'if(id=="log"){var ls=e.target.querySelectorAll("div"),T=4000;function run(){ls.forEach(function(l){l.classList.remove("on");setTimeout(function(){l.classList.add("on");},(+l.dataset.at)*T);});}run();setInterval(run,T+3500);}'
+ '});},{threshold:.35});["fc","rack","log"].forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});})();';

/* ---------- assemble ---------- */
var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<title>' + esc(C.meta.title) + '</title><meta name="description" content="' + esc(C.meta.description) + '">'
  + '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(C.meta.title) + '"><meta property="og:description" content="' + esc(C.meta.description) + '"><meta property="og:url" content="https://‹host›/">'
  + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 fill=%27%23f4f1ea%27/%3E%3Ctext x=%2732%27 y=%2746%27 font-family=%27Impact,sans-serif%27 font-size=%2740%27 text-anchor=%27middle%27 fill=%27%23111%27%3ESD%3C/text%3E%3Ccircle cx=%2752%27 cy=%2714%27 r=%278%27 fill=%27%23ff2a1a%27/%3E%3C/svg%3E">'
  + '<style>' + CSS + '</style></head><body>'
  + '<header class="top"><div class="wrap"><a class="mark" href="/" aria-label="' + esc(C.brand.name) + '">' + esc(C.brand.wordmark) + '<i aria-hidden="true"></i></a>'
  + '<nav class="nav" aria-label="Navigation">' + (C.nav || []).map(function (n) { return '<a class="lbl" href="#' + esc(n.anchor) + '">' + esc(n.label) + '</a>'; }).join('') + looks() + '</nav></div></header>'
  + hero()
  + C.order.map(function (k) { return R[k] ? R[k]() : ''; }).join('')
  + footer()
  + '<' + 'script>' + JS + '<' + '/script></body></html>';
return html;
