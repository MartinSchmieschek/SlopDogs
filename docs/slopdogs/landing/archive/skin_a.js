// SlopDogs landing · skin A "Breakout" (Follie, 2026-09-25). Dog body: renders SlopdogsLandingContent as HTML.
// Night black, one line per screen, one motif: the network boundary a signal crosses. Vanilla JS + SVG only.
// Nothing content-wise is hard-coded here; every text and list comes from C. Placeholder <host> is shown as ‹host›.
// Fonts are self-hosted under /static/landing/ (Latin subset, OFL: public/landing/OFL.txt), no font CDN.
// "Already out there" is #sd-live: the lead dog fills its cards from /api/landing (states in PLAN P5).
var C = SlopdogsLandingContent;
var LOOK = 'a';
if (!C || typeof C !== 'object' || !Array.isArray(C.order)) {
  throw new Error('skin_a (Breakout): SlopdogsLandingContent is missing or not the content master. Wire the content dog as a required parent of this skin.');
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function hst(s) { return esc(s).replace(/&lt;host&gt;/g, '‹host›'); }
function verse(key, cls) { var v = C.verses && C.verses[key]; if (!v) return ''; return '<p class="vers ' + (cls || '') + '">' + esc(v.lines.join(' ')) + ' <span>' + esc(v.name) + '</span></p>'; }
function looks() {
  return '<nav class="looks" aria-label="Look">' + C.looks.map(function (l) {
    var on = l.key === LOOK;
    return '<a href="?' + esc(C.lookParam) + '=' + esc(l.key) + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + esc(l.name) + '</a>';
  }).join('') + '</nav>';
}
function head(sec) { return '<p class="no">' + esc(sec.n) + ' · ' + esc(sec.label) + '</p>'; }
function hl(x) { return Array.isArray(x) ? x.map(function (l, i) { return '<span class="l">' + (i === x.length - 1 ? '<em>' + esc(l) + '</em>' : esc(l)) + '</span>'; }).join('') : esc(x); }

var CSS = ''
+ '@font-face{font-family:"Geist";src:url(/static/landing/geist.woff2) format("woff2");font-weight:500 600;font-display:swap}'
+ '@font-face{font-family:"Geist Mono";src:url(/static/landing/geist-mono.woff2) format("woff2");font-weight:400 500;font-display:swap}'
+ ':root{--bg:#06070a;--fg:#ececec;--muted:#8b8f98;--faint:#4a4e57;--line:rgba(236,236,236,.12);--sig:#39ff7a;--sans:"Geist",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"Geist Mono","JetBrains Mono",Consolas,monospace;--gutter:22px;--max:1240px}'
+ '@media(min-width:768px){:root{--gutter:56px}}'
+ '*{box-sizing:border-box}html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
+ 'body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--sans);font-weight:500;font-size:1.05rem;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}'
+ 'a{color:inherit;text-decoration:none}:focus-visible{outline:2px solid var(--sig);outline-offset:4px}h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.045em;line-height:.95}p{margin:0}'
+ '.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter);width:100%}.mono{font-family:var(--mono);font-weight:400}'
+ '.top{position:fixed;inset:0 0 auto 0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px var(--gutter);background:linear-gradient(rgba(6,7,10,.9),rgba(6,7,10,0))}'
+ '.mark{display:inline-flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.02em}.mark svg{width:20px;height:20px}'
+ '.nav{display:flex;align-items:center;gap:14px;font-size:.9rem;color:var(--muted)}.nav a:hover{color:var(--fg)}'
+ '.looks{display:flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:999px;font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase}'
+ '.looks a{padding:6px 10px;border-radius:999px;color:var(--faint)}.looks a:hover{color:var(--fg)}.looks a.on{background:var(--fg);color:var(--bg)}'
+ '@media(max-width:700px){.nav .lbl{display:none}.looks a{padding:6px 7px}}'
+ '.btn{display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:0 18px;border:1px solid var(--fg);border-radius:999px;font-size:.92rem;font-weight:500;transition:background .15s,color .15s}.btn:hover{background:var(--fg);color:var(--bg)}'
+ '.btn--sig{background:var(--sig);border-color:var(--sig);color:#052012}.btn--sig:hover{background:#7dffa6;border-color:#7dffa6;color:#052012}'
+ '.screen{min-height:100svh;display:grid;align-content:center;padding:120px 0 80px;position:relative;border-top:1px solid var(--line)}.hero{border-top:0}'
+ '.no{font-family:var(--mono);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:28px}'
+ '.screen h1,.screen h2{font-size:clamp(2.5rem,9vw,8rem);max-width:12ch}.screen h2 .l{display:block}.screen h1 em,.screen h2 em{font-style:normal;color:var(--sig)}'
+ '.one{margin-top:30px;font-size:clamp(1.05rem,1.8vw,1.4rem);color:var(--muted);max-width:34rem;line-height:1.45}.one b{color:var(--fg);font-weight:500}'
+ '.el{margin-top:44px}.aside{margin-top:36px;font-family:var(--mono);font-size:.78rem;color:var(--faint)}'
+ '.vers{margin-top:26px;font-family:var(--mono);font-size:.74rem;color:var(--faint);font-style:italic;max-width:34rem}.vers span{font-style:normal;letter-spacing:.16em;text-transform:uppercase;margin-left:10px;font-size:.66rem}'
+ '.tags{display:flex;flex-wrap:wrap;gap:8px;font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}.tags span{padding:7px 11px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}'
/* hero motif */
+ '.motif{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}.motif svg{position:absolute;inset:0;width:100%;height:100%}'
+ '.wall{stroke:var(--fg);stroke-opacity:.35;stroke-width:1.5;stroke-dasharray:6 8}.lbl{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;fill:var(--faint)}'
+ '.trail{stroke:var(--sig);stroke-width:2;fill:none;stroke-dasharray:1 1;animation:draw 6s ease-in-out infinite}@keyframes draw{0%{stroke-dashoffset:1}60%,100%{stroke-dashoffset:0}}'
+ '@media(prefers-reduced-motion:reduce){.trail{animation:none;stroke-dashoffset:0}}'
+ '.chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}'
/* what: chain */
+ '.chain{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-family:var(--mono);font-size:.78rem}.chain .k{padding:9px 13px;border:1px solid var(--line);border-radius:10px;color:var(--muted)}.chain .k.kennel{border-color:var(--fg);color:var(--fg)}.chain .k.url{border-color:var(--sig);color:var(--sig)}.chain .a{color:var(--faint)}'
/* packs */
+ '.plug{max-width:820px;display:grid;gap:24px}.plug-row{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}@media(min-width:640px){.plug-row{grid-template-columns:auto 110px 1fr}}'
+ '.plug-ai{border:1px solid var(--fg);border-radius:10px;padding:14px 16px;font-family:var(--mono);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}'
+ '.wire{display:none;width:100%;height:24px}@media(min-width:640px){.wire{display:block}}.wire path{stroke:var(--sig);stroke-width:2;stroke-dasharray:6 8;animation:wire 1.2s linear infinite}@keyframes wire{to{stroke-dashoffset:-14}}@media(prefers-reduced-motion:reduce){.wire path{animation:none}}'
+ '.rack{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(min-width:560px){.rack{grid-template-columns:repeat(4,1fr)}}'
+ '.mod{position:relative;border:1px solid var(--line);border-radius:10px;padding:12px 12px 12px 26px;font-family:var(--mono);font-size:.76rem;color:var(--faint);transition:color .3s,border-color .3s,background .3s}.mod small{display:block;font-size:.62rem;color:var(--faint);letter-spacing:.04em;margin-top:2px}'
+ '.mod:before{content:"";position:absolute;left:11px;top:16px;width:7px;height:7px;border-radius:50%;background:var(--faint);transition:background .3s,box-shadow .3s}'
+ '.mod.on{color:var(--fg);border-color:var(--sig);background:rgba(57,255,122,.07)}.mod.on:before{background:var(--sig);box-shadow:0 0 10px var(--sig)}'
+ '.mod.yours{border-style:dashed;border-color:var(--fg);color:var(--fg)}.mod.yours:before{background:var(--fg)}'
+ '.bars{display:grid;gap:10px;font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.bars div{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center}.bars i{display:block;height:8px;border-radius:4px;background:var(--faint);opacity:.5;width:100%;transform-origin:0 50%;animation:grow 1.4s cubic-bezier(.16,1,.3,1) both}.bars .short{background:var(--sig);opacity:1;width:18%}@keyframes grow{from{transform:scaleX(0)}}'
+ '@media(prefers-reduced-motion:reduce){.bars i{animation:none}}'
/* faces */
+ '.faces{max-width:660px;display:grid;gap:14px}.f-url{font-family:var(--mono);font-size:clamp(.9rem,2vw,1.2rem);display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}.f-url b{font-weight:400;color:var(--sig);font-size:.75em;letter-spacing:.14em}.f-url em{font-style:normal;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sig);border:1px solid var(--line);border-radius:999px;padding:4px 10px}'
+ '.f-view{position:relative;aspect-ratio:400/220;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0b0d12}.pane{position:absolute;inset:0;opacity:0;transition:opacity .5s}.pane.on{opacity:1}.pane svg{width:100%;height:100%;display:block}'
+ '.sw{padding:14px 16px;display:grid;gap:8px;align-content:start;font-family:var(--mono);font-size:clamp(.66rem,1.5vw,.8rem)}.sw-top{display:flex;justify-content:space-between;gap:10px;color:var(--fg);padding-bottom:8px;border-bottom:1px solid var(--line)}.sw-op{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:center;padding:8px 10px;border:1px solid rgba(57,255,122,.35);border-radius:6px;background:rgba(57,255,122,.07);color:var(--muted)}.sw-op b{background:var(--sig);color:#052012;padding:3px 8px;border-radius:4px;font-weight:600;font-size:.7rem}.sw-op.post{border-color:rgba(236,236,236,.25);background:rgba(236,236,236,.04)}.sw-op.post b{background:#8b8f98;color:#0b0d12}.sw-op code{color:var(--fg)}'
+ '.md{padding:20px 22px;color:var(--muted);font-size:clamp(.8rem,1.8vw,1rem);line-height:1.5}.md h4{margin:0 0 8px;font-size:1.5em;font-weight:600;color:var(--fg);letter-spacing:-.02em;padding-bottom:8px;border-bottom:1px solid var(--line)}.md li{margin-left:18px}'
+ '.f-tabs{display:flex;gap:6px;font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}.f-tabs span{padding:8px 12px;border:1px solid var(--line);border-radius:999px;color:var(--faint);transition:color .3s,border-color .3s}.f-tabs span.on{color:var(--fg);border-color:var(--fg)}'
/* how */
+ '.cmd{display:flex;max-width:760px;border:1px solid var(--line);border-radius:12px;background:#0b0d12;overflow:hidden}.cmd pre{margin:0;padding:16px 18px;font:.86rem/1.6 var(--mono);color:var(--fg);flex:1 1 auto;overflow:auto;white-space:pre}.cmd pre b{color:var(--sig);font-weight:400}'
+ '.cmd button{all:unset;cursor:pointer;min-width:64px;min-height:48px;display:flex;align-items:center;justify-content:center;border-left:1px solid var(--line);color:var(--muted);font:.7rem var(--mono);letter-spacing:.14em;text-transform:uppercase}.cmd button:hover{color:var(--sig);background:rgba(57,255,122,.06)}'
/* breakout */
+ '.bo{max-width:900px;display:grid;gap:18px}.bo-row{display:grid;gap:12px}@media(min-width:720px){.bo-row{grid-template-columns:1fr 1fr 1fr}}'
+ '.stop{border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-height:96px;display:grid;align-content:center;gap:6px}.stop .h{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}.stop .v{font-family:var(--mono);font-size:.86rem;color:var(--fg);word-break:break-all}'
+ '.stop.live{border-color:var(--sig)}.stop.live .v{color:var(--sig)}.stop.live .h:after{content:" · live";color:var(--sig)}'
+ '.dead{display:flex;flex-wrap:wrap;gap:10px 16px;font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}.dead s{text-decoration-color:var(--sig)}'
+ '.log{border:1px solid var(--line);border-radius:12px;padding:12px 16px;font-family:var(--mono);font-size:.78rem;line-height:1.7;color:var(--muted);min-height:7em}.log div{opacity:.25;transition:opacity .4s}.log div.on{opacity:1}.log b{color:var(--faint);font-weight:400;display:inline-block;width:6.5em}.log .live{color:var(--sig)}.log .live b{color:var(--sig)}'
+ '.nojs .log div{opacity:1}'
/* out */
+ '.six{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden;list-style:none;margin:0;padding:0}.six>li{display:grid}.six>li.ph{opacity:.4}@media(min-width:640px){.six{grid-template-columns:1fr 1fr}}@media(min-width:1024px){.six{grid-template-columns:repeat(3,1fr)}.six>li.wide{grid-column:span 2}}'
+ '.grp{margin-top:44px}.grp .no{margin-bottom:18px}.k .stars{font-family:var(--mono);font-size:.74rem;color:var(--sig)}.st p{margin-top:30px;font-family:var(--mono);font-size:.8rem;color:var(--muted)}.st .btn{margin-left:12px;background:none;color:var(--fg);font-family:inherit;cursor:pointer}'
+ '.k{background:var(--bg);padding:24px;display:grid;gap:10px;min-height:190px;align-content:start;transition:background .2s}.k:hover{background:#0c0e14}.k .id{font-family:var(--mono);font-size:.7rem;color:var(--faint);display:flex;justify-content:space-between;gap:8px}.k h3{font-size:1.25rem;font-weight:600;letter-spacing:-.02em}.k p{color:var(--muted);font-size:.92rem;line-height:1.45}'
+ '.foot{padding:40px 0 56px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px 28px;font-family:var(--mono);font-size:.76rem;color:var(--faint);border-top:1px solid var(--line)}.foot a:hover{color:var(--fg)}.foot .vers{margin:0}';

/* ---------- sections ---------- */
function hero() {
  var H = C.hero, loc = H.local || {};
  return '<section class="screen hero" aria-labelledby="h1">'
    + '<div class="motif" aria-hidden="true"><svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">'
    + '<line class="wall" x1="720" y1="0" x2="720" y2="800"/><text class="lbl" x="700" y="60" text-anchor="end">' + esc(loc.label) + '</text><text class="lbl" x="740" y="60">public</text>'
    + '<path id="p1" class="trail" d="M 160 560 C 400 560, 520 430, 720 430 S 980 300, 1100 300" pathLength="1"/>'
    + '<circle r="7" fill="#39ff7a"><animateMotion dur="6s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.6;1" calcMode="linear"><mpath href="#p1"/></animateMotion></circle>'
    + '</svg></div>'
    + '<div class="wrap"><p class="no">' + esc(H.kicker) + ' · ' + esc(H.sign) + '</p>'
    + '<h1 id="h1">' + esc(H.headline) + '</h1>'
    + '<p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el tags">' + (H.tagline || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>'
    + '<div class="el" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center"><a class="btn btn--sig" href="#' + esc(C.nav[0] && C.nav[0].anchor) + '">' + esc(C.nav[0] && C.nav[0].label) + '</a><span class="chip">' + esc(loc.chip) + '</span></div>'
    + verse(H.verse) + '</div></section>';
}
var R = {};
R.what = function () {
  var W = C.what;
  return '<section class="screen" id="what"><div class="wrap">' + head(W) + '<h2>' + hl(W.headline) + '</h2><p class="one">' + hst(W.lede) + '</p>'
    + '<div class="el chain" aria-label="chain">' + (W.chain || []).map(function (c, i, a) {
      var next = a[i + 1]; var arrow = next && next.kind !== c.kind ? '<span class="a">──▶</span>' : (next ? '<span class="a">+</span>' : '');
      return '<span class="k ' + esc(c.kind) + '">' + hst(c.label) + '</span>' + arrow;
    }).join('') + '</div></div></section>';
};
R.packs = function () {
  var P = C.packs;
  return '<section class="screen" id="packs"><div class="wrap">' + head(P) + '<h2>' + esc(P.headline) + '</h2><p class="one">' + hst(P.lede) + '</p>'
    + '<div class="el plug"><div class="plug-row"><div class="plug-ai">' + esc((C.hero.local || {}).chip || 'your AI') + '</div>'
    + '<svg class="wire" viewBox="0 0 110 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 H110"/></svg>'
    + '<div class="rack" id="rack">' + (P.modules || []).map(function (m, i) { return '<span class="mod' + (i === 0 ? ' on' : '') + '">' + esc(m.name) + '<small>' + esc(m.pack) + '</small></span>'; }).join('')
    + (P.yours ? '<span class="mod yours">' + esc(P.yours.name) + '<small>' + esc(P.yours.note) + '</small></span>' : '') + '</div></div>'
    + '<div class="bars" aria-hidden="true">' + (P.bars || []).map(function (b, i) { return '<div><span>' + esc(b.label) + '</span><i class="' + esc(b.size) + '" style="animation-delay:' + (i * .3) + 's"></i></div>'; }).join('') + '</div>'
    + '<div class="tags">' + (P.attrs || []).map(function (a) { return '<span>' + esc(a) + '</span>'; }).join('') + '<span style="color:var(--faint)">' + esc(P.footnote) + '</span></div>'
    + '</div></div></section>';
};
R.faces = function () {
  var F = C.faces, pv = F.preview || {};
  var panes = (F.items || []).map(function (it, i) {
    var inner = '';
    if (it.key === 'page') inner = '<svg viewBox="0 0 400 220" fill="none"><rect width="400" height="220" fill="#0b0d12"/><rect width="400" height="28" fill="#12151c"/><circle cx="16" cy="14" r="4" fill="#2a2e38"/><circle cx="30" cy="14" r="4" fill="#2a2e38"/><g stroke="#1c2029" stroke-width="1.5"><path d="M0 90h400M0 150h400M100 28v192M240 28v192"/></g><path d="M30 180 C120 120,200 200,290 110 S 360 70, 380 80" stroke="#ececec" stroke-width="3" stroke-dasharray="8 6"/><circle cx="30" cy="180" r="7" fill="#39ff7a"/><circle cx="380" cy="80" r="7" fill="#ff5c5c"/><text x="200" y="208" font-family="Geist Mono,monospace" font-size="12" fill="#8b8f98" text-anchor="middle">' + esc((pv.page || {}).title) + '</text></svg>';
    else if (it.key === 'api') inner = '<div class="sw"><div class="sw-top"><span>' + esc(F.example) + '</span><span style="color:var(--faint)">' + hst(it.line) + '</span></div>' + ((pv.api || {}).endpoints || []).map(function (e) { return '<div class="sw-op' + (e.method === 'POST' ? ' post' : '') + '"><b>' + esc(e.method) + '</b><code>' + esc(e.path) + '</code><span>' + esc(e.note) + '</span></div>'; }).join('') + '</div>';
    else inner = '<div class="md">' + ((pv.md || {}).lines || []).map(function (l) { return l.mark === '#' ? '<h4>' + esc(l.text) + '</h4>' : l.mark === '-' ? '<li>' + esc(l.text) + '</li>' : '<p>' + esc(l.text) + '</p>'; }).join('') + '</div>';
    return '<div class="pane' + (i === 0 ? ' on' : '') + '" data-k="' + esc(it.key) + '" data-line="' + hst(it.line) + '" data-suffix="' + esc(it.suffix) + '" aria-hidden="true">' + inner + '</div>';
  }).join('');
  return '<section class="screen" id="faces"><div class="wrap">' + head(F) + '<h2>' + esc(F.headline) + '</h2><p class="one">' + hst(F.lede) + '</p>'
    + '<div class="el faces" id="fc"><div class="f-url"><b>' + esc(F.method) + '</b> <span>' + hst(F.url) + '<span id="fsuf"></span></span> <em id="fline">' + hst((F.items[0] || {}).line) + '</em></div>'
    + '<div class="f-view">' + panes + '</div>'
    + '<div class="f-tabs" aria-hidden="true">' + (F.items || []).map(function (it, i) { return '<span data-k="' + esc(it.key) + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(it.label) + '</span>'; }).join('') + '</div></div>'
    + verse(F.verse) + '</div></section>';
};
R.how = function () {
  var H = C.how, cmd = esc(H.command), hi = esc(H.commandHighlight);
  if (hi) cmd = cmd.replace(hi, '<b>' + hi + '</b>');
  cmd = cmd.replace(/&lt;host&gt;/g, '‹host›');
  return '<section class="screen" id="how"><div class="wrap">' + head(H) + '<h2>' + esc(H.headline) + '</h2><p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el cmd"><pre id="cmdtext">' + cmd + '</pre><button type="button" id="copy" data-idle="' + esc(H.copy.idle) + '" data-done="' + esc(H.copy.done) + '" aria-label="' + esc(H.copy.idle) + '">' + esc(H.copy.idle) + '</button></div>'
    + '<p class="aside">' + esc(H.aside) + '</p>' + verse(H.verse) + '</div></section>';
};
R.breakout = function () {
  var B = C.breakout;
  return '<section class="screen" id="breakout"><div class="wrap">' + head(B) + '<h2>' + esc(B.headline) + '</h2><p class="one">' + hst(B.lede) + '</p>'
    + '<div class="el bo"><div class="bo-row">' + (B.stops || []).map(function (s) {
      var v = s.href ? '<a href="' + esc(s.href) + '">' + hst(s.value) + '</a>' : hst(s.value);
      return '<div class="stop' + (s.live ? ' live' : '') + '"><span class="h">' + esc(s.label) + '</span><span class="v">' + v + '</span></div>';
    }).join('') + '</div>'
    + (B.dead ? '<div class="dead"><s>' + esc(B.dead.label) + '</s><s>' + esc(B.dead.value) + '</s><span>' + esc(B.dead.note) + '</span></div>' : '')
    + '<div class="log" id="log">' + (B.log || []).map(function (l) { return '<div data-at="' + (+l.at || 0) + '"' + (l.live ? ' class="live"' : '') + '><b>' + esc(l.who) + '</b>' + hst(l.text) + '</div>'; }).join('') + '</div>'
    + '</div></div></section>';
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
R.out = function () {
  var O = C.out, sizes = ((O.live || {}).sizes || []).join('|');
  return '<section class="screen" id="out"><div class="wrap">' + head(O) + '<h2>' + esc(O.headline) + '</h2><p class="one">' + hst(O.lede) + '</p>'
    + live(function (l) {
      return '<div class="grp" data-group="' + esc(l.key) + '"><p class="no">' + esc(l.label) + '</p><ol class="six" data-list="' + esc(l.key) + '" data-kind="' + esc(l.kind) + '" data-sizes="' + esc(sizes) + '"></ol><p class="one" data-empty="' + esc(l.key) + '" hidden>' + esc(l.empty) + '</p></div>';
    }, '<li><a class="k" data-f-href href="/kennels"><span class="id"><span data-f="path"></span><span data-f="calls"></span></span><h3><span data-f="emoji" aria-hidden="true"></span> <span data-f="name"></span></h3><p data-f="description"></p><span class="stars" data-f="stars"></span></a></li>')
    + (O.more ? '<div class="el"><a class="btn" href="' + esc(O.more.href) + '">' + esc(O.more.label) + '</a></div>' : '')
    + '</div></section>';
};
function footer() {
  var F = C.footer;
  return '<footer class="wrap foot"><span>' + esc(F.line) + ' · <a href="#' + esc(F.commandAnchor) + '">' + esc(F.command) + '</a> · ' + esc(F.tag) + '</span>' + verse(F.verse) + '</footer>';
}

/* ---------- page script (vanilla, quiet) ---------- */
var JS = ''
+ '(function(){var R=matchMedia("(prefers-reduced-motion: reduce)").matches;document.documentElement.className=R?"nojs":"";'
+ 'if(R){document.querySelectorAll("animateMotion").forEach(function(a){a.remove();});}'
+ 'var cp=document.getElementById("copy");if(cp){cp.addEventListener("click",function(){var t=document.getElementById("cmdtext").textContent.replace(/[\\u2039\\u203a]/g,function(c){return c=="\\u2039"?"<":">";});if(navigator.clipboard)navigator.clipboard.writeText(t);cp.textContent=cp.dataset.done;setTimeout(function(){cp.textContent=cp.dataset.idle;},1200);});}'
+ 'if(R)return;'
+ 'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var id=e.target.id;'
+ 'if(id=="fc"){var ps=e.target.querySelectorAll(".pane"),ts=e.target.querySelectorAll(".f-tabs span"),i=0;setInterval(function(){i=(i+1)%ps.length;ps.forEach(function(p,j){p.classList.toggle("on",j==i);});ts.forEach(function(t,j){t.classList.toggle("on",j==i);});document.getElementById("fline").textContent=ps[i].dataset.line;document.getElementById("fsuf").textContent=ps[i].dataset.suffix;},2600);}'
+ 'if(id=="rack"){var ms=e.target.querySelectorAll(".mod:not(.yours)"),m=0;setInterval(function(){m=(m+1)%ms.length;ms.forEach(function(x,j){x.classList.toggle("on",j==m);});},900);}'
+ 'if(id=="log"){var ls=e.target.querySelectorAll("div"),T=4000;function run(){ls.forEach(function(l){l.classList.remove("on");setTimeout(function(){l.classList.add("on");},(+l.dataset.at)*T);});}run();setInterval(run,T+3500);}'
+ '});},{threshold:.35});["fc","rack","log"].forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});})();';

/* ---------- assemble ---------- */
var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<title>' + esc(C.meta.title) + '</title><meta name="description" content="' + esc(C.meta.description) + '">'
  + '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(C.meta.title) + '"><meta property="og:description" content="' + esc(C.meta.description) + '"><meta property="og:url" content="https://‹host›/">'
  + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 fill=%27%2306070a%27/%3E%3Cpath d=%27M32 6v52%27 stroke=%27%23ececec%27 stroke-width=%273%27 stroke-dasharray=%275 5%27/%3E%3Ccircle cx=%2746%27 cy=%2732%27 r=%277%27 fill=%27%2339ff7a%27/%3E%3C/svg%3E">'
  + '<style>' + CSS + '</style></head><body>'
  + '<header class="top"><a class="mark" href="/" aria-label="' + esc(C.brand.name) + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1v18" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/><circle cx="15" cy="10" r="3.2" fill="#39ff7a"/></svg>' + esc(C.brand.wordmark) + '</a>'
  + '<nav class="nav" aria-label="Navigation">' + (C.nav || []).map(function (n) { return '<a class="lbl" href="#' + esc(n.anchor) + '">' + esc(n.label) + '</a>'; }).join('') + looks() + '</nav></header>'
  + hero()
  + C.order.map(function (k) { return R[k] ? R[k]() : ''; }).join('')
  + footer()
  + '<' + 'script>' + JS + '<' + '/script></body></html>';
return html;
