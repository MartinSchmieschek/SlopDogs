// SlopDogs landing · skin C "Mixtape" (Follie, 2026-09-25). Dog body: renders SlopdogsLandingContent as HTML.
// The only landing look now (no more ?look= switcher, no skins a/b/d — see docs/slopdogs/landing/archive/).
// Tape covers and street posters of the 90s: yellowed cassette inlay, label-maker mono, chapter title cards, a
// tracklist "Side A" for the base dogs, a tape deck with turning reels for the breakout log, covers that flip in.
// Two accents (tape orange, inlay teal) on cream and black.
// v4 rules: English, one thought per screen, room. Every text and list comes from C. <host> is shown as ‹host›.
// Fonts are self-hosted under /static/landing/ (Latin subset, OFL: public/landing/OFL.txt), no font CDN.
// "Already out there" is #sd-live: the lead dog fills its covers from /api/landing (states in PLAN P5).
var C = SlopdogsLandingContent;
if (!C || typeof C !== 'object' || !Array.isArray(C.order)) {
  throw new Error('skin_c (Mixtape): SlopdogsLandingContent is missing or not the content master. Wire the content dog as a required parent of this skin.');
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function hst(s) { return esc(s).replace(/&lt;host&gt;/g, '‹host›'); }
function verse(key) { var v = C.verses && C.verses[key]; if (!v) return ''; return '<p class="vers">' + esc(v.lines.join(' ')) + ' <span>' + esc(v.name) + '</span></p>'; }
function chapter(sec, sub) { return '<div class="ct" id="' + esc(sec.id) + '"><span class="kap">chapter ' + esc(sec.n) + '</span><h2>' + esc(sec.label) + '</h2>' + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>'; }
function lines(x) { var a = Array.isArray(x) ? x : [x]; return a.map(function (l, i) { return '<span class="l"><span' + (i === a.length - 1 && a.length > 1 ? ' class="hi"' : '') + '>' + esc(l) + '</span></span>'; }).join(''); }
function label(t) { return '<span class="lm">' + esc(t) + '</span>'; }
function emblem() {
  return '<svg class="emb" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="ring" d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0"/></defs><circle cx="50" cy="50" r="48" fill="#1b1712"/><circle cx="50" cy="50" r="27" fill="none" stroke="#f0e6c8" stroke-width="2"/><text font-family="Courier Prime,monospace" font-size="9.5" font-weight="700" letter-spacing="2.2" fill="#f0e6c8"><textPath href="#ring">' + esc(String(C.brand.name).toUpperCase()) + ' · ' + esc(String(C.hero.kicker).toUpperCase()) + ' · ' + esc(String((C.hero.tagline || [])[2] || '').toUpperCase()) + ' · </textPath></text><text x="50" y="59" font-family="Pirata One,serif" font-size="27" text-anchor="middle" fill="#ff6a00" stroke="#f0e6c8" stroke-width=".6">SD</text></svg>';
}

var CSS = ''
+ '@font-face{font-family:"Bebas Neue";src:url(/static/landing/bebas-neue.woff2) format("woff2");font-display:swap}'
+ '@font-face{font-family:"Courier Prime";src:url(/static/landing/courier-prime-400.woff2) format("woff2");font-weight:400;font-display:swap}'
+ '@font-face{font-family:"Courier Prime";src:url(/static/landing/courier-prime-700.woff2) format("woff2");font-weight:700;font-display:swap}'
+ '@font-face{font-family:"Pirata One";src:url(/static/landing/pirata-one-sd.woff2) format("woff2");font-display:swap}'
+ ':root{--cream:#f0e6c8;--cream2:#f7f0da;--ink:#1b1712;--muted:#5a5142;--faint:#9c917a;--line:rgba(27,23,18,.18);--org:#ff6a00;--teal:#117f7f;--display:"Bebas Neue","Impact","Arial Narrow",sans-serif;--mono:"Courier Prime","Courier New",monospace;--black:"Pirata One",serif;--gutter:22px;--max:1240px}'
+ '@media(min-width:768px){:root{--gutter:56px}}*{box-sizing:border-box}html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
+ 'html{overflow-x:clip}body{margin:0;background:var(--cream);color:var(--ink);font-family:var(--mono);font-size:1rem;line-height:1.55;overflow-x:hidden}'
+ 'body:before{content:"";position:fixed;inset:0;z-index:70;pointer-events:none;opacity:.12;mix-blend-mode:multiply;background:radial-gradient(120% 100% at 50% 40%,transparent 55%,rgba(90,60,20,.9) 100%)}'
+ 'a{color:inherit;text-decoration:none}:focus-visible{outline:3px solid var(--org);outline-offset:4px}h1,h2,h3{margin:0;font-family:var(--display);font-weight:400;text-transform:uppercase;line-height:.9;letter-spacing:.01em}p{margin:0}'
+ '.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter);width:100%}'
+ '.top{position:sticky;top:0;z-index:20;background:var(--cream);border-bottom:3px solid var(--ink)}.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:64px}'
+ '.mark{display:inline-flex;align-items:center;gap:10px;font-family:var(--display);font-size:1.5rem;text-transform:uppercase;letter-spacing:.03em}.emb{width:42px;height:42px}'
+ '.nav{display:flex;align-items:center;gap:14px;font-size:.76rem;letter-spacing:.1em;text-transform:uppercase}.nav a.lbl:hover{color:var(--org)}'
/* the rack: an ink button in the top bar, on every width (the anchor labels leave on a phone, this stays) */
+ '.nav a.go{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:3px solid var(--ink);background:var(--ink);color:var(--cream);font:1.15rem var(--display);letter-spacing:.06em;box-shadow:3px 3px 0 var(--org)}.nav a.go:hover{background:var(--cream2);color:var(--ink)}'
+ '@media(max-width:700px){.nav .lbl{display:none}}'
/* stage: hidden until <html data-stage="beta"> (see the assembly below). Chip in the top bar, promo sticker in the hero. */
+ '.lm.stg,.stamp{display:none}html[data-stage="beta"] .lm.stg{display:inline-block}html[data-stage="beta"] .stamp{display:block}'
+ '.stg{margin-left:4px;transform:rotate(-2deg);align-self:center}.stg .s{display:none}@media(max-width:700px){.stg .f{display:none}.stg .s{display:inline}}'
+ '.stamp{margin:0 0 30px;max-width:300px}.stamp .st{display:inline-block;transform:rotate(-4deg);border:3px solid var(--ink);background:var(--org);color:var(--ink);padding:5px}.stamp .st .in{display:block;border:1px dashed var(--ink);padding:8px 16px 10px;text-align:center}'
+ '.stamp .k{display:block;font:.62rem var(--mono);letter-spacing:.24em;text-transform:uppercase}.stamp b{display:block;margin-top:2px;font:1.7rem/1 var(--display);font-weight:400;letter-spacing:.05em;text-transform:uppercase}.stamp i{display:block;margin-top:3px;font:italic .72rem var(--mono);letter-spacing:.06em}'
+ '.stamp p{margin-top:14px;font-size:.78rem;line-height:1.5;color:var(--muted);max-width:280px}'
+ '@media(min-width:1000px){.stamp{position:absolute;right:var(--gutter);top:92px;width:290px;margin:0;z-index:2}}'
+ '.btn{display:inline-flex;align-items:center;min-height:50px;padding:0 22px;border:3px solid var(--ink);background:var(--cream2);font:1.3rem var(--display);text-transform:uppercase;letter-spacing:.05em;box-shadow:5px 5px 0 var(--ink);transition:transform .1s,box-shadow .1s}.btn:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--ink)}.btn--org{background:var(--org)}.btn--ink{background:var(--ink);color:var(--cream)}'
+ '.lm{display:inline-block;background:var(--ink);color:var(--cream);padding:3px 8px;font:.66rem var(--mono);letter-spacing:.16em;text-transform:uppercase}'
+ '.ct{background:var(--ink);color:var(--cream);padding:18px var(--gutter);display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 22px}.ct .kap{font:.72rem var(--mono);letter-spacing:.22em;text-transform:uppercase;color:#bfb595}.ct h2{font-size:clamp(1.6rem,5vw,3rem);letter-spacing:.03em}.ct .sub{margin-left:auto;font:.72rem var(--mono);letter-spacing:.06em;color:#bfb595}'
+ '.screen{min-height:92svh;display:grid;align-content:center;padding:72px 0;position:relative}.hero{min-height:100svh;padding:64px 0}'
+ '.no{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:24px}'
+ '.screen h1,.screen .big{font-family:var(--display);text-transform:uppercase;font-size:clamp(3.6rem,15vw,13rem);line-height:.86;max-width:9ch}.big .l{display:block;overflow:hidden}.big .l span{display:inline-block}.hi{color:var(--org);-webkit-text-stroke:2px var(--ink);paint-order:stroke fill}'
+ '.one{margin-top:30px;font-size:clamp(1rem,1.7vw,1.25rem);max-width:32rem;line-height:1.5}.one b{font-weight:700;background:var(--teal);color:var(--cream2);padding:0 5px}'
+ '.el{margin-top:44px}.aside{margin-top:34px;font-size:.78rem;color:var(--faint)}'
+ '.vers{margin-top:26px;font-size:.76rem;color:var(--muted);font-style:italic;max-width:34rem}.vers span{font-style:normal;letter-spacing:.18em;text-transform:uppercase;margin-left:10px;font-size:.64rem;color:var(--teal)}'
+ '.band{overflow:hidden;background:var(--org);color:var(--ink);border-top:3px solid var(--ink);border-bottom:3px solid var(--ink);padding:8px 0}.band div{display:flex;gap:40px;width:max-content;font:clamp(1.3rem,3.6vw,2.2rem) var(--display);text-transform:uppercase;letter-spacing:.06em;animation:band 28s linear infinite;white-space:nowrap}@keyframes band{to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.band div{animation:none}}'
/* inlay frame: a yellowed cassette inlay card */
+ '.inlay{border:3px solid var(--ink);background:var(--cream2);box-shadow:8px 8px 0 var(--ink);max-width:900px}.inlay .head{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:3px solid var(--ink);font:.72rem var(--mono);letter-spacing:.16em;text-transform:uppercase}.inlay .head b{font:1.4rem var(--display);letter-spacing:.06em}'
/* what: chain as track credits */
+ '.chain{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.76rem;letter-spacing:.08em;text-transform:uppercase}.chain .k{padding:10px 14px;border:3px solid var(--ink);background:var(--cream2)}.chain .k.kennel{background:var(--ink);color:var(--cream)}.chain .k.url{background:var(--org)}.chain .a{font:1.6rem var(--display);color:var(--faint)}'
/* packs: tracklist side A */
/* one track: number | title ........ running time, and under it the credit line (the work the AI skips), full width */
+ '.tracks{list-style:none;margin:0;padding:0}.tracks li{display:grid;grid-template-columns:36px 1fr auto;grid-template-areas:"n t len" "n s s";gap:2px 10px;padding:12px 14px;border-bottom:1px solid var(--line);align-items:center;transition:background .3s}.tracks li:last-child{border-bottom:0}.tracks li.on{background:rgba(255,106,0,.18)}.tracks li.yours{background:rgba(17,127,127,.12)}'
+ '.tracks .n{grid-area:n;font:1.7rem var(--display)}.tracks .t{grid-area:t;font:1.15rem var(--display);text-transform:uppercase;letter-spacing:.03em}.tracks .s{grid-area:s;font:.68rem var(--mono);letter-spacing:0;color:var(--muted);line-height:1.4}.tracks .len{grid-area:len;font:.7rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}'
+ '.bars{display:grid;gap:10px;padding:14px 16px;border-top:3px solid var(--ink);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.bars div{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center}.bars i{display:block;height:10px;background:var(--ink);opacity:.3;width:100%;transform-origin:0 50%;animation:grow 1.4s cubic-bezier(.16,1,.3,1) both}.bars .short{background:var(--org);opacity:1;width:18%}@keyframes grow{from{transform:scaleX(0)}}@media(prefers-reduced-motion:reduce){.bars i{animation:none}}'
+ '.tags{display:flex;flex-wrap:wrap;gap:8px;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.tags span{padding:6px 10px;border:2px solid var(--ink);background:var(--cream2)}'
/* faces */
+ '.f-url{padding:12px 16px;font-size:clamp(.85rem,2vw,1.1rem);font-weight:700;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;border-bottom:3px solid var(--ink)}.f-url b{color:var(--org);font-size:.75em;letter-spacing:.14em}.f-url em{font-style:normal;font-weight:400;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--cream2);background:var(--teal);padding:4px 10px}.f-url span{min-width:0;overflow-wrap:anywhere}'
+ '.f-view{position:relative;aspect-ratio:400/220;overflow:hidden;background:#fff}@media(max-width:640px){.f-view{aspect-ratio:auto;min-height:340px}}.pane{position:absolute;inset:0;opacity:0;overflow:auto;transition:opacity .5s}.pane.on{opacity:1}.pane svg{width:100%;height:100%;display:block}'
+ '.sw{padding:14px 16px;display:grid;gap:8px;align-content:start;font-size:clamp(.66rem,1.5vw,.8rem)}.sw-top{display:flex;justify-content:space-between;gap:10px;font-weight:700;padding-bottom:8px;border-bottom:2px solid var(--ink)}.sw-op{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:center;padding:8px 10px;border:2px solid var(--ink);color:var(--muted);background:var(--cream2)}.sw-op b{background:var(--teal);color:var(--cream2);padding:3px 8px;font-weight:700;font-size:.7rem}.sw-op.post b{background:var(--org);color:var(--ink)}.sw-op code{color:var(--ink);font-weight:700}'
+ '.md{padding:20px 22px;color:var(--muted);font-size:clamp(.8rem,1.8vw,1rem);line-height:1.5}.md h4{margin:0 0 8px;font:1.9em var(--display);text-transform:uppercase;color:var(--ink);padding-bottom:6px;border-bottom:2px solid var(--ink)}.md li{margin-left:18px}'
+ '.f-tabs{display:flex;gap:0;border-top:3px solid var(--ink)}.f-tabs span{flex:1;text-align:center;padding:10px 8px;font:1rem var(--display);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);border-right:1px solid var(--line);transition:background .3s,color .3s}.f-tabs span:last-child{border-right:0}.f-tabs span.on{background:var(--ink);color:var(--cream)}'
/* how */
+ '.cmd{display:flex;max-width:760px;border:3px solid var(--ink);background:var(--ink);color:var(--cream);box-shadow:6px 6px 0 var(--org)}.cmd pre{margin:0;padding:16px 18px;font:.86rem/1.6 var(--mono);flex:1 1 auto;min-width:0;overflow:auto;white-space:pre}@media(max-width:640px){.cmd pre{white-space:pre-wrap;overflow-wrap:anywhere}}.cmd pre b{color:var(--org);font-weight:700}'
+ '.cmd button{all:unset;cursor:pointer;min-width:64px;min-height:48px;display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(240,230,200,.3);color:var(--cream);font:.7rem var(--mono);letter-spacing:.14em;text-transform:uppercase}.cmd button:hover{background:var(--org);color:var(--ink)}.connect{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin-top:16px}.addcur{display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:10px 16px;min-height:44px;box-sizing:border-box;border:3px solid var(--ink);background:var(--org);color:var(--ink);font:700 .8rem var(--mono);letter-spacing:.1em;text-transform:uppercase;box-shadow:4px 4px 0 var(--ink)}.addcur:hover{background:var(--ink);color:var(--cream)}.addcur .pl{font-size:1.15em;line-height:1;margin-right:2px}.anyc{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.anyc .ax{font:.62rem var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}.anyc code{font:.78rem var(--mono);color:var(--ink);background:var(--cream2);border:2px solid var(--ink);padding:6px 10px;overflow-wrap:anywhere;min-width:0}.mcopy{all:unset;cursor:pointer;min-height:44px;padding:0 12px;display:inline-flex;align-items:center;border:2px solid var(--ink);background:var(--ink);color:var(--cream);font:.66rem var(--mono);letter-spacing:.12em;text-transform:uppercase}.mcopy:hover{background:var(--org);color:var(--ink)}'
/* breakout: tape deck */
+ '.deck .cassette{padding:14px 16px 0}.cassette svg{width:100%;height:auto;display:block}.reel{transform-origin:center;transform-box:fill-box;animation:spin 3s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.reel{animation:none}}'
+ '.stops{display:grid;gap:10px;padding:14px 16px}@media(min-width:720px){.stops{grid-template-columns:1fr 1fr 1fr}}.stop{border:2px solid var(--ink);padding:12px 14px;min-height:90px;display:grid;align-content:center;gap:6px;background:var(--cream)}.stop .h{font-size:.64rem;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}.stop .v{font-size:.84rem;font-weight:700;word-break:break-all}.stop.live{background:var(--teal);color:var(--cream2);border-color:var(--teal)}.stop.live .h{color:rgba(247,240,218,.7)}'
+ '.dead{padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:10px 16px;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.dead s{text-decoration-color:var(--org);text-decoration-thickness:2px}'
+ '.log{margin:0 16px 16px;border:2px solid var(--ink);padding:12px 16px;font-size:.78rem;line-height:1.7;color:var(--muted);min-height:7em;background:var(--cream2)}.log div{opacity:.25;transition:opacity .4s}.log div.on{opacity:1}.log b{color:var(--faint);font-weight:400;display:inline-block;width:6.5em}.log .live{color:var(--teal);font-weight:700}.nojs .log div{opacity:1}'
/* out: covers */
+ '.covers{display:grid;gap:22px;perspective:1200px;list-style:none;margin:0;padding:0}.covers>li{display:flex}.covers>li>.cv{flex:1 1 auto}.covers>li.ph{opacity:.4}@media(min-width:640px){.covers{grid-template-columns:1fr 1fr}}@media(min-width:1024px){.covers{grid-template-columns:repeat(3,1fr);gap:26px}.covers>li.wide{grid-column:span 2}}'
+ '.grp{margin-top:44px}.grp .no{margin-bottom:22px}.st p{margin-top:30px;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.st .btn{margin-left:14px;min-height:44px;font-size:1.05rem;vertical-align:middle;color:var(--ink);cursor:pointer}'
+ '.cv{position:relative;display:flex;flex-direction:column;gap:10px;padding:18px;border:3px solid var(--ink);background:var(--cream2);box-shadow:6px 6px 0 var(--ink);min-height:230px;transform:rotate(var(--r,0deg)) rotateY(80deg);opacity:0;transition:transform .9s cubic-bezier(.16,1,.3,1),opacity .6s}.cv.in{transform:rotate(var(--r,0deg)) rotateY(0);opacity:1}.nojs .cv{transform:none;opacity:1}'
+ '.covers>li:nth-child(4n+1)>.cv{--r:-1.5deg}.covers>li:nth-child(4n+2)>.cv{--r:1deg}.covers>li:nth-child(4n+3)>.cv{--r:-.5deg}.covers>li:nth-child(4n)>.cv{--r:1.5deg}'
+ '.cv .id{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between;gap:8px}.cv h3{font-size:1.5rem;letter-spacing:.02em}.cv p{color:var(--muted);font-size:.84rem;line-height:1.45;flex:1 1 auto}'
+ '.cv .badge{position:absolute;right:-10px;top:-12px;width:56px;height:56px;border-radius:50%;background:var(--org);border:3px solid var(--ink);display:grid;place-items:center;font-size:1.5rem;transform:rotate(12deg);text-align:center;line-height:1.1}.cv .stars{font-size:.72rem;font-weight:700;letter-spacing:.12em;color:var(--teal)}'
+ '.foot{padding:30px 0 56px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px 28px;font-size:.74rem;color:var(--muted);border-top:3px solid var(--ink)}.foot .vers{margin:0}';

/* ---------- sections ---------- */
/* the promo sticker: only shown under <html data-stage="beta"> (CSS), markup always there */
function stamp() {
  var B = C.stage && C.stage.beta, s = B && B.stamp;
  if (!s) return '';
  return '<aside class="stamp" aria-label="' + esc(B.chip) + '"><span class="st"><span class="in"><span class="k">' + esc(s.kicker) + '</span><b>' + esc(s.title) + '</b><i>' + esc(s.line) + '</i></span></span><p>' + esc(B.text) + '</p></aside>';
}
function hero() {
  var H = C.hero, loc = H.local || {}, rack = H.rack;
  return '<section class="screen hero" aria-labelledby="h1"><div class="wrap">' + stamp() + '<p class="no">' + esc(H.kicker) + ' · ' + esc(H.sign) + ' · ' + label('side a') + '</p>'
    + '<h1 id="h1" class="big">' + lines(String(H.headline).split(' ').length > 2 ? [String(H.headline).split(' ').slice(0, -1).join(' '), String(H.headline).split(' ').slice(-1)[0]] : H.headline) + '</h1>'
    + '<p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el tags">' + (H.tagline || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '<span style="background:var(--ink);color:var(--cream)">' + esc(loc.chip) + '</span></div>'
    + '<div class="el" style="display:flex;flex-wrap:wrap;gap:16px"><a class="btn btn--org" href="#' + esc(C.nav[0] && C.nav[0].anchor) + '">' + esc(C.nav[0] && C.nav[0].label) + '</a>' + (rack ? '<a class="btn" href="' + esc(rack.href) + '">' + esc(rack.label) + '</a>' : '') + '</div>'
    + verse(H.verse) + '</div></section>'
    + '<div class="band" aria-hidden="true"><div>' + (function () { var t = (H.tagline || []).concat([H.headline]); var s = ''; for (var i = 0; i < 4; i++) s += t.map(function (x) { return '<span>' + esc(x) + '</span><span>★</span>'; }).join(''); return s; })() + '</div></div>';
}
var R = {};
R.what = function () {
  var W = C.what;
  return chapter({ id: 'what', n: W.n, label: W.label }, C.brand.name) + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(W.headline) + '</h2><p class="one">' + hst(W.lede) + '</p>'
    + '<div class="el chain" aria-label="chain">' + (W.chain || []).map(function (c, i, a) {
      var next = a[i + 1]; var arrow = next && next.kind !== c.kind ? '<span class="a">→</span>' : (next ? '<span class="a">+</span>' : '');
      return '<span class="k ' + esc(c.kind) + '">' + hst(c.label) + '</span>' + arrow;
    }).join('') + '</div></div></section>';
};
function track(m, i, cls) {
  return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span class="n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span class="t">' + esc(m.name) + '</span><span class="len">' + esc(m.len) + '</span><span class="s">' + esc(m.note) + '</span></li>';
}
R.packs = function () {
  var P = C.packs, mods = P.modules || [];
  return chapter({ id: 'packs', n: P.n, label: P.label }, 'tracklist') + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(String(P.headline).split(/(?<=\.)\s+/)) + '</h2><p class="one">' + hst(P.lede) + '</p>'
    + '<div class="el inlay"><div class="head"><span><b>A</b>&nbsp;&nbsp;side a · ' + esc(P.label) + '</span><span>' + esc(P.footnote) + '</span></div>'
    + '<ol class="tracks" id="rack">' + mods.map(function (m, i) { return track(m, i, i === 0 ? 'on' : ''); }).join('')
    + (P.yours ? track(P.yours, mods.length, 'yours') : '') + '</ol>'
    + '<div class="bars" aria-hidden="true">' + (P.bars || []).map(function (b, i) { return '<div><span>' + esc(b.label) + '</span><i class="' + esc(b.size) + '" style="animation-delay:' + (i * .3) + 's"></i></div>'; }).join('') + '</div></div>'
    + '</div></section>';
};
R.faces = function () {
  var F = C.faces, pv = F.preview || {};
  var panes = (F.items || []).map(function (it, i) {
    var inner = '';
    if (it.key === 'page') inner = '<svg viewBox="0 0 400 220" fill="none"><rect width="400" height="220" fill="#fff"/><rect width="400" height="28" fill="#1b1712"/><circle cx="16" cy="14" r="4" fill="#f0e6c8"/><circle cx="30" cy="14" r="4" fill="#f0e6c8"/><g stroke="#e6dfc9" stroke-width="1.5"><path d="M0 90h400M0 150h400M100 28v192M240 28v192"/></g><path d="M30 180 C120 120,200 200,290 110 S 360 70, 380 80" stroke="#1b1712" stroke-width="3" stroke-dasharray="8 6"/><circle cx="30" cy="180" r="7" fill="#117f7f"/><circle cx="380" cy="80" r="7" fill="#ff6a00"/><text x="200" y="208" font-family="Impact,sans-serif" font-size="14" fill="#1b1712" text-anchor="middle" letter-spacing="1">' + esc(String((pv.page || {}).title || '').toUpperCase()) + '</text></svg>';
    else if (it.key === 'api') inner = '<div class="sw"><div class="sw-top"><span>' + esc(F.example) + '</span><span style="color:var(--faint);font-weight:400">' + hst(it.line) + '</span></div>' + ((pv.api || {}).endpoints || []).map(function (e) { return '<div class="sw-op' + (e.method === 'POST' ? ' post' : '') + '"><b>' + esc(e.method) + '</b><code>' + esc(e.path) + '</code><span>' + esc(e.note) + '</span></div>'; }).join('') + '</div>';
    else inner = '<div class="md">' + ((pv.md || {}).lines || []).map(function (l) { return l.mark === '#' ? '<h4>' + esc(l.text) + '</h4>' : l.mark === '-' ? '<li>' + esc(l.text) + '</li>' : '<p>' + esc(l.text) + '</p>'; }).join('') + '</div>';
    return '<div class="pane' + (i === 0 ? ' on' : '') + '" data-k="' + esc(it.key) + '" data-line="' + hst(it.line) + '" data-suffix="' + esc(it.suffix) + '" aria-hidden="true">' + inner + '</div>';
  }).join('');
  return chapter({ id: 'faces', n: F.n, label: F.label }, 'three sides') + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(String(F.headline).split(/(?<=\.)\s+/)) + '</h2><p class="one">' + hst(F.lede) + '</p>'
    + '<div class="el inlay" id="fc"><div class="f-url"><b>' + esc(F.method) + '</b> <span>' + hst(F.url) + '<span id="fsuf"></span></span> <em id="fline">' + hst((F.items[0] || {}).line) + '</em></div>'
    + '<div class="f-view">' + panes + '</div>'
    + '<div class="f-tabs" aria-hidden="true">' + (F.items || []).map(function (it, i) { return '<span data-k="' + esc(it.key) + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(it.label) + '</span>'; }).join('') + '</div></div>'
    + verse(F.verse) + '</div></section>';
};
R.how = function () {
  var H = C.how, cmd = esc(H.command), hi = esc(H.commandHighlight);
  if (hi) cmd = cmd.replace(hi, '<b>' + hi + '</b>');
  cmd = cmd.replace(/&lt;host&gt;/g, '‹host›');
  var cl = H.clients || {}, connect = '';
  if (cl.cursor || cl.raw) {
    connect = '<div class="connect el">';
    if (cl.cursor) connect += '<a class="addcur" href="' + esc(cl.cursor.deeplink) + '"><span class="pl" aria-hidden="true">+</span>' + esc(cl.cursor.label) + '</a>';
    if (cl.raw) {
      var rawUrl = esc(cl.raw.url).replace(/&lt;host&gt;/g, '‹host›');
      connect += '<span class="anyc"><span class="ax">' + esc(cl.raw.label) + '</span><code id="mcpurl">' + rawUrl + '</code>'
        + '<button type="button" class="mcopy" data-copy="mcpurl" data-idle="' + esc(H.copy.idle) + '" data-done="' + esc(H.copy.done) + '" aria-label="copy url">' + esc(H.copy.idle) + '</button></span>';
    }
    connect += '</div>';
  }
  return chapter({ id: 'how', n: H.n, label: H.label }, 'liner notes') + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(H.headline) + '</h2><p class="one">' + hst(H.lede) + '</p>'
    + '<div class="el cmd"><pre id="cmdtext">' + cmd + '</pre><button type="button" id="copy" data-copy="cmdtext" data-idle="' + esc(H.copy.idle) + '" data-done="' + esc(H.copy.done) + '" aria-label="' + esc(H.copy.idle) + '">' + esc(H.copy.idle) + '</button></div>'
    + connect
    + '<p class="aside">' + esc(H.aside) + '</p>' + verse(H.verse) + '</div></section>';
};
R.breakout = function () {
  var B = C.breakout, first = (B.log || [])[0] || {};
  return chapter({ id: 'breakout', n: B.n, label: B.label }, 'tape deck') + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(B.headline) + '</h2><p class="one">' + hst(B.lede) + '</p>'
    + '<div class="el inlay deck"><div class="head"><span>' + esc(C.brand.name) + ' · ' + esc(B.label) + '</span><span style="color:var(--org)">● rec</span></div>'
    + '<div class="cassette" aria-hidden="true"><svg viewBox="0 0 640 120"><rect x="2" y="2" width="636" height="116" rx="10" fill="#1b1712"/><rect x="60" y="22" width="520" height="76" rx="8" fill="#f0e6c8"/><g class="reel"><circle cx="200" cy="60" r="26" fill="#1b1712"/><circle cx="200" cy="60" r="10" fill="#f0e6c8"/><path d="M200 34v10M200 76v10M174 60h10M216 60h10" stroke="#f0e6c8" stroke-width="4"/></g><g class="reel"><circle cx="440" cy="60" r="26" fill="#1b1712"/><circle cx="440" cy="60" r="10" fill="#f0e6c8"/><path d="M440 34v10M440 76v10M414 60h10M456 60h10" stroke="#f0e6c8" stroke-width="4"/></g><rect x="250" y="44" width="140" height="32" fill="#ff6a00"/><text x="320" y="65" font-family="Impact,sans-serif" font-size="16" fill="#1b1712" text-anchor="middle" letter-spacing="1">' + esc(String(first.who || '').toUpperCase()) + '</text><text x="320" y="16" font-family="Courier Prime,monospace" font-size="10" fill="#f0e6c8" text-anchor="middle" letter-spacing="3">' + esc(String(C.brand.name).toUpperCase()) + ' · ' + esc(String(B.label).toUpperCase()) + '</text></svg></div>'
    + '<div class="stops">' + (B.stops || []).map(function (s) {
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
  return chapter({ id: 'out', n: O.n, label: O.label }, 'covers') + '<section class="screen"><div class="wrap"><h2 class="big">' + lines(O.headline) + '</h2><p class="one">' + hst(O.lede) + '</p>'
    + live(function (l) {
      return '<div class="grp" data-group="' + esc(l.key) + '"><p class="no">' + label(l.label) + '</p><ol class="covers" data-list="' + esc(l.key) + '" data-kind="' + esc(l.kind) + '" data-sizes="' + esc(sizes) + '"></ol><p class="one" data-empty="' + esc(l.key) + '" hidden>' + esc(l.empty) + '</p></div>';
    }, '<li><a class="cv" data-f-href href="/kennels"><span class="badge" aria-hidden="true" data-f="emoji"></span><span class="id"><span data-f="path"></span><span data-f="calls"></span></span><h3 data-f="name"></h3><p data-f="description"></p><span class="stars" data-f="stars"></span></a></li>')
    + (O.more ? '<div class="el"><a class="btn" href="' + esc(O.more.href) + '">' + esc(O.more.label) + '</a></div>' : '')
    + '</div></section>';
};
function footer() {
  var F = C.footer;
  return '<footer class="wrap foot"><span>' + esc(F.line) + ' · <a href="#' + esc(F.commandAnchor) + '">' + esc(F.command) + '</a>' + (F.rack ? ' · <a href="' + esc(F.rack.href) + '" style="text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:var(--org)">' + esc(F.rack.label) + '</a>' : '') + ' · ' + esc(F.tag) + '</span>' + verse(F.verse) + '</footer>';
}

/* ---------- page script (vanilla, quiet) ---------- */
var JS = ''
+ '(function(){var R=matchMedia("(prefers-reduced-motion: reduce)").matches;document.documentElement.className=R?"nojs":"";'
+ 'document.querySelectorAll("[data-copy]").forEach(function(cp){cp.addEventListener("click",function(){var el=document.getElementById(cp.dataset.copy);if(!el)return;var t=el.textContent.replace(/[\\u2039\\u203a]/g,function(c){return c=="\\u2039"?"<":">";});if(navigator.clipboard)navigator.clipboard.writeText(t);cp.textContent=cp.dataset.done;setTimeout(function(){cp.textContent=cp.dataset.idle;},1200);});});'
+ 'if(R)return;'
+ 'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var id=e.target.id;'
+ 'if(id=="fc"){var ps=e.target.querySelectorAll(".pane"),ts=e.target.querySelectorAll(".f-tabs span"),i=0;setInterval(function(){i=(i+1)%ps.length;ps.forEach(function(p,j){p.classList.toggle("on",j==i);});ts.forEach(function(t,j){t.classList.toggle("on",j==i);});document.getElementById("fline").textContent=ps[i].dataset.line;document.getElementById("fsuf").textContent=ps[i].dataset.suffix;},2600);}'
+ 'if(id=="rack"){var ms=e.target.querySelectorAll("li:not(.yours)"),m=0;setInterval(function(){m=(m+1)%ms.length;ms.forEach(function(x,j){x.classList.toggle("on",j==m);});},900);}'
+ 'if(id=="log"){var ls=e.target.querySelectorAll("div"),T=4000;function run(){ls.forEach(function(l){l.classList.remove("on");setTimeout(function(){l.classList.add("on");},(+l.dataset.at)*T);});}run();setInterval(run,T+3500);}'
+ 'if(id=="sd-live"){seen=true;flip();}'
+ '});},{threshold:.25});'
/* covers arrive later (from /api/landing): flip whatever is new once the section was seen */
+ 'var seen=false;function flip(){if(!seen)return;document.querySelectorAll("#sd-live .cv:not(.in)").forEach(function(c,j){setTimeout(function(){c.classList.add("in");},j*110);});}document.addEventListener("sdlanding",flip);'
+ '["fc","rack","log","sd-live"].forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});})();';

/* ---------- assemble ---------- */
/* STAGE FLAG (Void): the page carries the placeholder ‹stage› in <html data-stage="…">, exactly like ‹host›.
   The server (LandingPage.withHost, GET /) swaps it for process.env.SLOPDOGS_STAGE (or '' when unset) before sending;
   kennel output and the static fallback both pass through there, so one string swap serves both. The CSS shows
   .stg (top-bar chip) and .stamp (hero sticker) only under html[data-stage="beta"]; nothing else reads the value. */
var STAGE_MARK = '‹stage›';
var html = '<!DOCTYPE html><html lang="en" data-stage="' + STAGE_MARK + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<title>' + esc(C.meta.title) + '</title><meta name="description" content="' + esc(C.meta.description) + '">'
  + '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(C.meta.title) + '"><meta property="og:description" content="' + esc(C.meta.description) + '"><meta property="og:url" content="https://‹host›/">'
  + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2730%27 fill=%27%231b1712%27/%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2722%27 fill=%27none%27 stroke=%27%23f0e6c8%27 stroke-width=%272%27/%3E%3Ctext x=%2732%27 y=%2741%27 font-family=%27serif%27 font-weight=%27700%27 font-size=%2724%27 text-anchor=%27middle%27 fill=%27%23ff6a00%27%3ESD%3C/text%3E%3C/svg%3E">'
  + '<style>' + CSS + '</style></head><body>'
  + '<header class="top"><div class="wrap"><span style="display:inline-flex;align-items:center;gap:10px"><a class="mark" href="/" aria-label="' + esc(C.brand.name) + '">' + emblem() + esc(C.brand.wordmark) + '</a>'
  + (C.stage && C.stage.beta ? '<span class="lm stg"><span class="f">' + esc(C.stage.beta.chip) + '</span><span class="s">' + esc(C.stage.beta.chipShort) + '</span></span>' : '') + '</span>'
  + '<nav class="nav" aria-label="Navigation">' + (C.nav || []).map(function (n) { return n.href ? '<a class="go" href="' + esc(n.href) + '">' + esc(n.label) + '</a>' : '<a class="lbl" href="#' + esc(n.anchor) + '">' + esc(n.label) + '</a>'; }).join('') + '</nav></div></header>'
  + hero()
  + C.order.map(function (k) { return R[k] ? R[k]() : ''; }).join('')
  + footer()
  + '<' + 'script>' + JS + '<' + '/script></body></html>';
return html;
