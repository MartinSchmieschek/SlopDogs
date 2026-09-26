// Skin D "Neon Alley": renders SlopdogsLandingContent as a full HTML page. Dog body.
// Fonts are self-hosted under /static/landing/ (Latin subset, OFL: public/landing/OFL.txt), no font CDN.
// "Already out there" is #sd-live: the lead dog fills its signs from /api/landing (states in PLAN P5).
var C = SlopdogsLandingContent; var LOOK = 'd';
if (!C || !C.order) throw new Error('skin_d: SlopdogsLandingContent missing. Wire the content dog (landing_content) as parent of this skin.');

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function show(s){return esc(s).replace(/&lt;host&gt;/g,'‹host›').replace(/&lt;name&gt;/g,'‹name›');}
function verse(key,style){var v=C.verses[key];return v?'<p class="verse"'+(style?' style="'+style+'"':'')+'>'+v.lines.map(esc).join('<br>')+'<cite>'+esc(v.name)+'</cite></p>':'';}
function label(sec){return '<p class="k">'+esc(sec.n)+' / '+esc(sec.label)+'</p>';}
function looks(cls,short){return '<nav class="'+cls+'" aria-label="Look">'+C.looks.map(function(l){var on=l.key===LOOK;return '<a href="?'+esc(C.lookParam)+'='+esc(l.key)+'"'+(on?' aria-current="page"':'')+' title="'+esc(l.name)+'"><span>'+esc(l.key)+'</span>'+(short?'':' '+esc(l.name))+'</a>';}).join('')+'</nav>';}
function dud(word){var i=word.search(/[oO]/);if(i<0)return esc(word);return esc(word.slice(0,i))+'<span class="dud">'+esc(word[i])+'</span>'+esc(word.slice(i+1));}

var CSS = `
@font-face{font-family:"Big Shoulders Display";src:url(/static/landing/big-shoulders-display.woff2) format("woff2");font-weight:500 900;font-display:swap}
@font-face{font-family:"Karla";src:url(/static/landing/karla.woff2) format("woff2");font-weight:400 500;font-display:swap}
@font-face{font-family:"Karla";src:url(/static/landing/karla-italic.woff2) format("woff2");font-weight:400;font-style:italic;font-display:swap}
:root{--bg:#0b0a12;--surface:#131120;--fg:#ece7ef;--muted:#a69fb3;--dim:#8a8399;--neon:#ff4d8d;--neon-dim:rgba(255,77,141,.42);--neon-haze:rgba(255,77,141,.10);--core:#fff2f7;--cold:#5ff2e6;--cold-dim:rgba(95,242,230,.4);--cold-haze:rgba(95,242,230,.09);--tube:rgba(255,255,255,.16);--font-display:"Big Shoulders Display","Arial Narrow",sans-serif;--font-body:"Karla",system-ui,sans-serif;--font-mono:ui-monospace,Menlo,Consolas,monospace;--s2:8px;--s3:12px;--s4:16px;--s6:24px;--s8:32px;--s12:48px;--s16:64px;--s24:96px;--gutter:clamp(16px,6vw,96px)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg)}
body{margin:0;overflow-x:hidden;font-family:var(--font-body);font-size:17px;line-height:1.5;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--cold);outline-offset:4px}
h1,h2,h3{margin:0;font-weight:900}
.sign{font-family:var(--font-display);font-weight:900;text-transform:uppercase;letter-spacing:.05em;line-height:.92;color:var(--core);text-shadow:0 0 1px #fff,0 0 7px var(--neon),0 0 22px var(--neon),0 0 64px var(--neon-dim)}
.sign.cold{color:#effffd;text-shadow:0 0 1px #fff,0 0 7px var(--cold),0 0 22px var(--cold),0 0 64px var(--cold-dim)}
.off{color:transparent;-webkit-text-stroke:1px var(--tube);text-shadow:none}
.frame{border:2px solid var(--neon);border-radius:8px;box-shadow:0 0 6px var(--neon-dim),0 0 22px var(--neon-haze),inset 0 0 14px var(--neon-haze)}
.frame.cold{border-color:var(--cold);box-shadow:0 0 6px var(--cold-dim),0 0 22px var(--cold-haze),inset 0 0 14px var(--cold-haze)}
.frame.dead{border-color:var(--tube);box-shadow:none}
.top{position:fixed;inset:0 0 auto 0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:var(--s4);height:56px;padding:0 var(--gutter);font:500 12px/1 var(--font-body);letter-spacing:.16em;text-transform:uppercase;background:linear-gradient(var(--bg) 55%,rgba(11,10,18,0))}
.top a{text-decoration:none;display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);color:var(--muted)}
.top a:hover{color:var(--fg)}
.top .mark{padding-left:0;color:var(--fg)}
.top .right{display:flex;align-items:center}
.looks a{min-width:44px;justify-content:center;gap:6px}
.looks a span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--tube);border-radius:50%;font:700 11px/1 var(--font-display);color:var(--dim)}
.looks a[aria-current] span{border-color:var(--neon);color:var(--core);box-shadow:0 0 6px var(--neon-dim),0 0 12px var(--neon-haze);text-shadow:0 0 6px var(--neon)}
.top .looks a{padding:0 2px}
@media(max-width:639px){.top nav.main{display:none}}
.w{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:var(--s24) var(--gutter);position:relative;max-width:1200px;margin:0 auto}
.w::before{content:"";position:absolute;inset:10% 0;background:radial-gradient(55% 45% at 50% 50%,var(--neon-haze),transparent 70%);pointer-events:none;opacity:0;transition:opacity 1.2s}
.w.lit::before,html:not(.motion) .w::before{opacity:1}
.k{font:400 11px/1.6 var(--font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:0 0 var(--s8)}
.w h2{font-size:clamp(2.6rem,9vw,7rem);max-width:12ch}
.w .lede{font-size:clamp(1rem,1.5vw,1.25rem);line-height:1.5;color:var(--muted);max-width:40ch;margin:var(--s8) auto 0}
.el{margin-top:var(--s12);width:100%;max-width:820px}
.verse{margin:var(--s12) 0 0;font:italic 400 13px/1.7 var(--font-body);color:var(--dim);max-width:34ch}
.verse cite{display:block;font-style:normal;font:400 10px/1 var(--font-mono);letter-spacing:.22em;text-transform:uppercase;margin-top:6px;color:var(--neon)}
.hero{padding-top:calc(var(--s24) + 16px)}
.hero h1,.reflect{font-size:clamp(4.2rem,15vw,13rem);letter-spacing:.06em;line-height:.85;white-space:nowrap}
.dud{display:inline-block}
.hero .lede{color:var(--fg);max-width:36ch}
.hero .tiny{margin:var(--s4) 0 0;font:400 12px/1.6 var(--font-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.reflect{display:block;transform:scaleY(-1) translateY(-8px);opacity:.22;filter:blur(3px);color:var(--neon);-webkit-mask-image:linear-gradient(to bottom,transparent 45%,#000 100%);mask-image:linear-gradient(to bottom,transparent 45%,#000 100%);margin:6px 0 -.45em;pointer-events:none;user-select:none}
.ground{width:min(100%,900px);height:1px;background:linear-gradient(90deg,transparent,var(--tube),transparent);margin-top:-6px}
.two{display:flex;flex-direction:column;gap:var(--s3);align-items:center}
.two .sign{font-size:clamp(2.6rem,9vw,7rem)}
#packs{max-width:1360px}
.rail{overflow-x:auto;scrollbar-width:none;width:100%;max-width:none;scroll-snap-type:x proximity}
.rail::-webkit-scrollbar{display:none}
.plugs{list-style:none;margin:0;padding:24px 0 8px;display:inline-flex;min-width:100%;gap:var(--s3);position:relative;box-sizing:border-box}
.plugs::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--neon);box-shadow:0 0 6px var(--neon),0 0 18px var(--neon-dim)}
.plug{position:relative;flex:0 0 auto;scroll-snap-align:start;padding:10px 14px 9px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:108px}
.plug:first-child{margin-left:auto}.plug:last-child{margin-right:auto}
.plug::before{content:"";position:absolute;left:50%;top:-24px;width:2px;height:24px;background:var(--neon-dim)}
.plug .sign{font-size:clamp(1.2rem,2.2vw,1.7rem);letter-spacing:.1em}
.plug .k{margin:0;font-size:10px;letter-spacing:.14em}
.plug.dead::before{background:var(--tube)}
.plug.dead .k{color:var(--dim)}
.tubes{margin:var(--s8) auto 0;display:grid;gap:var(--s3);width:min(100%,520px);text-align:left}
.tube{display:grid;grid-template-columns:76px 1fr;align-items:center;gap:var(--s3);font:400 11px/1 var(--font-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.tube i{display:block;height:3px;border-radius:3px;background:var(--tube)}
.tube-long i{width:100%}
.tube-short{color:var(--core)}
.tube-short i{width:14%;background:var(--neon);box-shadow:0 0 6px var(--neon),0 0 16px var(--neon-dim)}
.motion .w:not(.lit) .tube-short i{background:var(--tube);box-shadow:none}
.note{margin:var(--s8) 0 0}
.motion .plugs::before{opacity:0;transition:opacity .4s}
.motion .seq.lit .plugs::before{opacity:1}
.url{font-size:clamp(1.45rem,4.2vw,3.4rem);letter-spacing:.04em;text-transform:none;overflow-wrap:anywhere;line-height:1;max-width:none}
.url b{font-weight:900;color:var(--core);text-shadow:0 0 1px #fff,0 0 7px var(--neon),0 0 22px var(--neon)}
.words{display:flex;justify-content:center;flex-wrap:wrap;gap:var(--s3) var(--s6);margin-top:var(--s8);padding:0;list-style:none}
.words button{background:none;border:0;padding:8px 6px;min-height:44px;min-width:44px;cursor:pointer;font-family:var(--font-display);font-weight:900;font-size:clamp(1.6rem,5vw,3rem);text-transform:uppercase;letter-spacing:.12em;line-height:1;transition:opacity .2s}
.words button:hover{opacity:.85}
.faceline{margin:var(--s6) 0 0;font:400 12px/1.6 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);min-height:1.6em}
.faceline b{font-weight:400;color:var(--fg)}
html:not(.js) .words button{color:var(--core);-webkit-text-stroke:0;text-shadow:0 0 1px #fff,0 0 7px var(--neon),0 0 22px var(--neon)}
.cmd{display:flex;flex-wrap:wrap;align-items:stretch;background:var(--surface);text-align:left;max-width:760px;margin-left:auto;margin-right:auto}
.cmd code{flex:1 1 300px;padding:20px 22px;font:500 clamp(13px,1.15vw,15px)/1.6 var(--font-mono);word-break:break-all;white-space:pre-wrap;color:var(--fg)}
.cmd code b{font-weight:500;color:var(--cold)}
.copy{flex:0 0 auto;min-width:96px;min-height:44px;border:0;border-left:2px solid var(--neon);background:transparent;color:var(--neon);font:700 1.05rem/1 var(--font-display);letter-spacing:.22em;text-transform:uppercase;cursor:pointer;padding:0 22px}
.copy:hover{background:var(--neon-haze)}
.aside{margin:var(--s8) 0 0;color:var(--muted);font-size:15px}
.aside::before{content:"";display:inline-block;width:14px;height:2px;background:var(--neon);vertical-align:middle;margin-right:10px;box-shadow:0 0 6px var(--neon)}
.alley{display:flex;flex-direction:column;align-items:center;gap:var(--s12);width:100%;position:relative}
.stop{position:relative;padding:14px 22px;display:inline-flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;max-width:100%}
.stop .k{margin:0;color:var(--muted)}
.stop .sign{font-size:clamp(1.6rem,5vw,3.2rem);letter-spacing:.14em}
.stop.live .sign{font-size:clamp(1.25rem,4.2vw,3rem);letter-spacing:.06em;word-break:break-all;text-transform:none}
.stop.live{border-width:3px}
.stop.dead{position:absolute;right:0;top:calc(50% - 30px);padding:10px 14px;transform:rotate(-4deg)}
.stop.dead .sign{font-size:clamp(1.2rem,3vw,1.9rem);letter-spacing:.2em}
.stop.dead .k{font-size:10px;color:var(--dim)}
.drop{width:1px;height:var(--s8);background:linear-gradient(var(--neon-dim),transparent)}
.motion .seq:not(.lit) :is(.stop,.plug) .sign{color:transparent;-webkit-text-stroke:1px var(--tube);text-shadow:none}
.motion .seq:not(.lit) :is(.stop,.plug).frame{border-color:var(--tube);box-shadow:none}
.motion .seq.lit :is(.stop,.plug){animation:on 1.1s steps(1) both;animation-delay:var(--d,0s)}
.motion .seq.lit :is(.stop,.plug).dead{animation:none}
@media(max-width:767px){.stop.dead{position:static;transform:rotate(-3deg);margin-top:var(--s4)}.alley{gap:var(--s8)}}
.grid{display:grid;grid-template-columns:1fr;gap:var(--s6);width:100%;max-width:1100px;margin:var(--s12) 0 0;padding:0;list-style:none;text-align:left}
.grid>li{display:flex;min-width:0}
.grid>li>.kn{flex:1 1 auto}
.grid>li.ph{opacity:.4}
#sd-live{width:100%;max-width:1100px}
.grp{margin-top:var(--s16)}
.grp .k{margin:0}
.st p{margin:var(--s8) 0 0;font:400 12px/1.6 var(--font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.st .copy{border:2px solid var(--neon);border-radius:8px;margin-left:var(--s4)}
.more{margin-top:var(--s12)}
.more a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s6);text-decoration:none;font:700 1.05rem/1 var(--font-display);letter-spacing:.22em;text-transform:uppercase;color:var(--neon)}
.kn{display:flex;flex-direction:column;justify-content:flex-end;gap:var(--s2);padding:var(--s6);min-height:180px;text-decoration:none;position:relative;transition:transform .3s}
.kn:hover{transform:translateY(-2px)}
.kn .id{font:400 11px/1.4 var(--font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.kn .sign{font-size:clamp(2rem,4.5vw,3.4rem);letter-spacing:.06em;text-shadow:0 0 1px #fff,0 0 6px var(--neon),0 0 18px var(--neon-dim)}
.kn p{margin:0;color:var(--muted);font-size:14px;line-height:1.45;max-width:38ch}
.kn .dogs{font:400 11px/1 var(--font-mono);letter-spacing:.14em;color:var(--dim);margin-top:var(--s2)}
.big>.kn .sign{font-size:clamp(3rem,7vw,5.6rem)}
.grid>li.marquee{border-style:dashed}
.marquee>.kn{flex-direction:row;align-items:center;flex-wrap:wrap;gap:var(--s4) var(--s8);min-height:0}
.marquee>.kn .sign{font-size:clamp(1.8rem,3.5vw,2.6rem)}
.marquee>.kn p{flex:1 1 260px}
@media(min-width:768px){.grid{grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(200px,auto);grid-auto-flow:dense}.grid>li.tall{grid-row:span 2}.tall>.kn{justify-content:flex-start;align-items:center;text-align:center}.tall>.kn .sign{display:block;writing-mode:vertical-rl;text-orientation:mixed;font-size:clamp(3rem,5vw,4.6rem);letter-spacing:.18em;margin:var(--s3) 0}.tall>.kn p{max-width:20ch;text-align:center}.c2{grid-column:span 2}.c4{grid-column:span 4}}
footer{max-width:1200px;margin:0 auto;padding:var(--s16) var(--gutter) var(--s12);display:flex;flex-wrap:wrap;gap:var(--s6) var(--s8);justify-content:space-between;align-items:flex-end;font:400 12px/1.7 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border-top:1px solid rgba(255,255,255,.06)}
footer a{text-decoration:none;display:inline-flex;align-items:center;min-height:44px}
footer a:hover{color:var(--fg)}
footer .looks{display:flex;flex-wrap:wrap;gap:var(--s2);font-size:11px}
.motion .hero h1{animation:flicker 9s linear infinite}
.motion .dud{animation:dud 5s steps(1) infinite}
.motion .w:not(.hero):not(.lit) :is(.sign,.url b){color:transparent;-webkit-text-stroke:1px var(--tube);text-shadow:none}
.motion .w:not(.hero):not(.lit) .frame{border-color:var(--tube);box-shadow:none}
.motion .w.lit .flick{animation:on 1.1s steps(1) both;animation-delay:var(--d,0s)}
@keyframes flicker{0%,91%,94%,97%,100%{opacity:1}92%{opacity:.4}95%{opacity:.7}}
@keyframes dud{0%,28%{opacity:1}29%,33%{opacity:.12}34%,58%{opacity:1}59%,60%{opacity:.12}61%,100%{opacity:1}}
@keyframes on{0%{opacity:.15}9%{opacity:1}13%{opacity:.2}21%{opacity:1}27%{opacity:.3}42%{opacity:1}56%{opacity:.6}62%,100%{opacity:1}}
`;

var JS = `(function(){
var d=document,motion=d.documentElement.classList.contains('motion'),copyT=d.body.getAttribute('data-copy-text').split('|');
d.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=d.querySelector(b.getAttribute('data-copy')).textContent;if(!navigator.clipboard){return}navigator.clipboard.writeText(t).then(function(){b.textContent=copyT[1];setTimeout(function(){b.textContent=copyT[0]},1400)})})});
var faces=d.querySelector('.faces');
if(faces){var tabs=[].slice.call(faces.querySelectorAll('[data-face]')),line=faces.querySelector('.faceline'),suf=d.querySelector('.suffix'),order=tabs.map(function(t){return t.getAttribute('data-face')}),i=0,timer,info=JSON.parse(faces.getAttribute('data-info'));
var show=function(n){tabs.forEach(function(t){var on=t.getAttribute('data-face')===n;t.setAttribute('aria-selected',on?'true':'false');t.className=on?'sign flick':'off'});suf.textContent=info[n][0];line.textContent='';var b=d.createElement('b');b.textContent=info[n][1];line.appendChild(b);i=order.indexOf(n)};
tabs.forEach(function(t){t.addEventListener('click',function(){clearInterval(timer);show(t.getAttribute('data-face'))})});
if(motion){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){clearInterval(timer);timer=setInterval(function(){show(order[(i+1)%order.length])},2800)}else{clearInterval(timer)}})},{threshold:.5}).observe(faces)}}
if(!motion)return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lit');io.unobserve(e.target)}})},{threshold:.3});
d.querySelectorAll('.w:not(.hero)').forEach(function(el){io.observe(el)});
var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lit');so.unobserve(e.target)}})},{threshold:.6});
d.querySelectorAll('.seq').forEach(function(el){so.observe(el)});
setTimeout(function(){d.querySelectorAll('.w,.seq').forEach(function(el){el.classList.add('lit')})},3000);
})();`;

var R = {
  hero: function(){var h=C.hero;
    return '<section class="w hero lit">'+verse(h.verse,'margin:0 0 var(--s8)')+'<h1 class="sign">'+dud(h.sign)+'</h1><span class="sign reflect" aria-hidden="true">'+esc(h.sign)+'</span><span class="ground" aria-hidden="true"></span><p class="lede">'+esc(h.lede)+'</p><p class="tiny">'+h.tagline.map(esc).join(' · ')+'</p></section>';},
  what: function(){var s=C.what;
    return '<section class="w" id="what">'+label(s)+'<h2 class="two">'+s.headline.map(function(l,i){return '<span class="sign flick"'+(i?' style="--d:'+(i*0.5)+'s"':'')+'>'+esc(l)+'</span>';}).join('')+'</h2><p class="lede">'+esc(s.lede)+'</p></section>';},
  packs: function(){var s=C.packs;
    return '<section class="w" id="packs">'+label(s)+'<h2 class="sign flick">'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="el rail seq"><ul class="plugs" aria-label="Base dogs on the rail">'+
      s.modules.map(function(m,i){return '<li class="plug frame" style="--d:'+(Math.round(i*15)/100)+'s"><span class="sign">'+esc(m.name)+'</span><span class="k">'+esc(m.pack)+'</span></li>';}).join('')+
      '<li class="plug frame dead"><span class="sign off">'+esc(s.yours.name)+'</span><span class="k">'+esc(s.yours.note)+'</span></li></ul></div>'+
      '<div class="tubes" aria-label="'+s.bars.map(function(b){return esc(b.label)}).join(' vs ')+'">'+s.bars.map(function(b){return '<div class="tube tube-'+esc(b.size)+'"><span>'+esc(b.label)+'</span><i></i></div>';}).join('')+'</div>'+
      '<p class="k note">'+esc(s.footnote)+' · '+s.attrs.map(esc).join(' · ')+'</p></section>';},
  faces: function(){var s=C.faces,info={};s.items.forEach(function(it){info[it.key]=[it.suffix,it.line];});
    return '<section class="w" id="can">'+label(s)+'<h2 class="url sign cold flick">'+show(s.url)+'<b class="suffix"></b></h2><div class="el faces" data-info="'+esc(JSON.stringify(info))+'"><ul class="words" role="tablist" aria-label="Representation">'+
      s.items.map(function(it,i){return '<li><button type="button" role="tab" aria-selected="'+(i===0)+'" class="'+(i===0?'sign flick':'off')+'" data-face="'+esc(it.key)+'">'+esc(it.short)+'</button></li>';}).join('')+
      '</ul><p class="faceline" aria-live="polite"><b>'+esc(s.items[0].line)+'</b></p></div><p class="lede">'+esc(s.lede)+'</p>'+verse(s.verse)+'</section>';},
  how: function(){var s=C.how,cmd=esc(s.command).replace(esc(s.commandHighlight),'<b>'+esc(s.commandHighlight)+'</b>').replace(/&lt;host&gt;/g,'‹host›');
    return '<section class="w" id="how">'+label(s)+'<h2 class="sign flick">'+esc(s.headline)+'</h2><div class="el cmd frame flick"><code id="cmd">'+cmd+'</code><button class="copy" type="button" data-copy="#cmd">'+esc(s.copy.idle)+'</button></div><p class="lede">'+esc(s.lede)+'</p><p class="aside">'+esc(s.aside)+'</p>'+verse(s.verse)+'</section>';},
  breakout: function(){var s=C.breakout,d=s.dead;
    var stops=s.stops.map(function(x,i){var live=!!x.live,tag=x.href?'a':'div',cls='stop'+(i?' frame':'')+(live?' cold live':''),inner='<span class="k">'+esc(x.label)+'</span><span class="sign'+(live?' cold':'')+'">'+show(x.value)+'</span>';
      return (i?'<span class="drop" aria-hidden="true"></span>':'')+'<'+tag+' class="'+cls+'"'+(x.href?' href="'+esc(x.href)+'"':'')+(i?' style="--d:'+(i===1?'.7':'1.5')+'s"':'')+'>'+inner+'</'+tag+'>';}).join('');
    return '<section class="w" id="demo">'+label(s)+'<h2 class="sign flick">'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="el alley seq">'+stops+
      '<div class="stop frame dead" aria-label="'+esc(d.label)+': '+esc(d.note)+'"><span class="sign off">'+esc(d.label)+'</span><span class="k">'+esc(d.note)+'</span></div></div></section>';},
  out: function(){var s=C.out,cls={wide:'frame tall',big:'big c2',small:'frame',mid:'c2',strip:'frame marquee c4'},sizes=((s.live||{}).sizes||[]).map(function(z){return cls[z]||'frame';}).join('|');
    return '<section class="w" id="out">'+label(s)+'<h2 class="sign flick">'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p>'+
      live(function(l){return '<div class="grp" data-group="'+esc(l.key)+'"><p class="k">'+esc(l.label)+'</p><ol class="grid" data-list="'+esc(l.key)+'" data-kind="'+esc(l.kind)+'" data-sizes="'+esc(sizes)+'"></ol><p class="lede" data-empty="'+esc(l.key)+'" hidden>'+esc(l.empty)+'</p></div>';},
        '<li><a class="kn" data-f-href href="/kennels"><span class="id"><span data-f="emoji" aria-hidden="true"></span> <span data-f="path"></span></span><span class="sign" data-f="name"></span><p data-f="description"></p><span class="dogs"><span data-f="calls"></span> <span data-f="stars"></span></span></a></li>')+
      (s.more?'<p class="more"><a class="frame" href="'+esc(s.more.href)+'">'+esc(s.more.label)+'</a></p>':'')+'</section>';}
};
/* #sd-live: states, one ranking per list, a card <template>; the lead's page script fills it from /api/landing. */
function live(group,card){var L=C.out.live||{},st=L.states||{},w=L.words||{};
  return '<div id="sd-live" data-state="loading" aria-busy="true" data-api="'+esc(L.api)+'" data-limit="'+esc(L.limit)+'" data-emoji="'+esc(L.emoji)+'" data-dog-href="'+esc(L.dogHref)+'" data-w-calls="'+esc(w.calls)+'" data-w-call="'+esc(w.call)+'" data-w-reuse="'+esc(w.reuse)+'" data-w-reuse-one="'+esc(w.reuseOne)+'" data-w-proven="'+esc(w.proven)+'">'+
    '<div class="st" role="status" aria-live="polite">'+['loading','waking','empty'].map(function(k){return '<p data-when="'+k+'">'+esc(st[k])+'</p>';}).join('')+
    '<p data-when="error">'+esc(st.error)+' <button type="button" class="copy" data-retry>'+esc(st.retry)+'</button></p></div>'+
    (L.lists||[]).map(group).join('')+'<template data-tpl="card">'+card+'</template></div>';}

var f=C.footer;
var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(C.meta.title)+'</title><meta name="description" content="'+esc(C.meta.description)+'"><meta name="theme-color" content="#0b0a12">'+
  '<meta property="og:type" content="website"><meta property="og:title" content="'+esc(C.meta.title)+'"><meta property="og:description" content="'+esc(C.meta.description)+'"><meta property="og:url" content="https://‹host›/">'+
  '<script>document.documentElement.className=\'js\'+(matchMedia(\'(prefers-reduced-motion:reduce)\').matches?\'\':\' motion\')<\/script>'+
  '<style>'+CSS+'</style></head>'+
  '<body data-copy-text="'+esc(C.how.copy.idle+'|'+C.how.copy.done)+'"><header class="top"><a class="mark" href="#top">'+esc(C.brand.wordmark)+'</a><div class="right"><nav class="main">'+C.nav.map(function(n){return '<a href="#'+esc(n.anchor)+'">'+esc(n.label)+'</a>';}).join('')+'</nav>'+looks('looks',true)+'</div></header><main id="top">'+
  R.hero()+C.order.map(function(k){return R[k]?R[k]():'';}).join('')+'</main>'+
  '<footer><div><span>'+esc(f.line)+'</span><br><a href="#'+esc(f.commandAnchor)+'">'+esc(f.command)+'</a></div>'+looks('looks')+'<span>'+esc(f.tag)+'</span></footer><script>'+JS+'<\/script></body></html>';
return html;
