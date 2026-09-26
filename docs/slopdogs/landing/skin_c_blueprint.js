// Skin C "Blueprint": renders SlopdogsLandingContent as a full HTML page. Dog body.
var C = SlopdogsLandingContent; var LOOK = 'c';
if (!C || !C.order) throw new Error('skin_c: SlopdogsLandingContent missing. Wire the content dog (landing_content) as parent of this skin.');

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function show(s){return esc(s).replace(/&lt;host&gt;/g,'‹host›').replace(/&lt;name&gt;/g,'‹name›');}
function verse(key){var v=C.verses[key];return v?'<p class="verse">'+v.lines.map(esc).join('<br>')+'<cite>'+esc(v.name)+'</cite></p>':'';}
function label(sec){return '<p class="n">'+esc(sec.n)+' / '+esc(sec.label)+'</p>';}
function breakLast(s){var i=s.lastIndexOf(' ');return i<0?esc(s):esc(s.slice(0,i))+'<br>'+esc(s.slice(i+1));}
function looks(cls,short){return '<nav class="'+cls+'" aria-label="Look">'+C.looks.map(function(l){var on=l.key===LOOK;return '<a href="?'+esc(C.lookParam)+'='+esc(l.key)+'"'+(on?' aria-current="page"':'')+' title="'+esc(l.name)+'"><span>'+esc(l.key)+'</span>'+(short?'':' '+esc(l.name))+'</a>';}).join('')+'</nav>';}

var CSS = `
:root{--bg:#f3f4f0;--surface:#e9ebe5;--fg:#10233f;--muted:#4f5c70;--line:#1d3fbf;--line-soft:rgba(29,63,191,.3);--line-faint:rgba(29,63,191,.14);--grid:rgba(16,35,63,.07);--grid-major:rgba(16,35,63,.13);--accent:#b8420e;--accent-glow:rgba(232,86,30,.3);--font-display:"Archivo",system-ui,sans-serif;--font-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s6:24px;--s8:32px;--s12:48px;--s16:64px;--s24:96px;--gutter:clamp(16px,5vw,72px);--ease:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;overflow-x:hidden;font-family:var(--font-display);font-size:17px;line-height:1.5;color:var(--fg);background:linear-gradient(var(--grid-major) 1px,transparent 1px) 0 0/120px 120px,linear-gradient(90deg,var(--grid-major) 1px,transparent 1px) 0 0/120px 120px,linear-gradient(var(--grid) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/24px 24px,var(--bg);-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
h1,h2{font-weight:700;font-stretch:125%;font-variation-settings:"wdth" 125;line-height:1;letter-spacing:-.03em;margin:0;text-wrap:balance}
.top{position:fixed;inset:0 0 auto 0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:var(--s4);padding:0 var(--gutter);height:56px;font:500 12px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;background:linear-gradient(var(--bg) 60%,rgba(243,244,240,0))}
.top a{text-decoration:none;display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3)}
.top .mark{padding-left:0}
.top nav a{color:var(--muted)}
.top nav a:hover{color:var(--fg)}
.top .right{display:flex;align-items:center}
.looks a{color:var(--muted);min-width:44px;justify-content:center}
.looks a span{display:inline-block;border:1px solid var(--line-faint);padding:4px 6px}
.top .looks a{padding:0 2px}
.top .looks a span{font-size:11px}
.looks a[aria-current] span{background:var(--line);color:var(--bg);border-color:var(--line)}
@media(max-width:639px){.top nav.main{display:none}}
.sec{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:var(--s24) var(--gutter);max-width:1440px;margin:0 auto;position:relative}
.n{font:500 12px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 var(--s8);display:flex;align-items:center;gap:var(--s3)}
.n::before{content:"";width:28px;height:1px;background:var(--line)}
h2{font-size:clamp(2.3rem,6.4vw,5.4rem);max-width:13ch}
.lede{font-size:clamp(1.05rem,1.5vw,1.3rem);line-height:1.45;max-width:44ch;color:var(--muted);margin:var(--s6) 0 0}
.fig{margin-top:var(--s12)}
.verse{margin:var(--s8) 0 0;font:italic 400 12px/1.7 var(--font-mono);color:var(--muted);max-width:36ch}
.verse cite{display:block;font-style:normal;letter-spacing:.14em;text-transform:uppercase;font-size:10px;margin-top:4px;color:var(--line)}
.hero{padding-top:calc(var(--s24) + 24px)}
.hero h1{font-size:clamp(3.2rem,12.5vw,10.5rem);letter-spacing:-.04em}
.hero .lede{max-width:38ch;color:var(--fg)}
.hero .tiny{margin:var(--s4) 0 0;font:500 12px/1.6 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.enc{position:relative;display:inline-block;border:1px dashed var(--line-soft);padding:30px 22px 22px;margin-top:var(--s12);align-self:flex-start}
.enc-k,.st-k{position:absolute;top:-7px;left:12px;background:var(--bg);padding:0 6px;font:400 11px/1.1 var(--font-mono);letter-spacing:.06em;color:var(--line);white-space:nowrap}
.chip{display:inline-block;border:1px solid var(--line);background:var(--surface);padding:11px 16px;font:500 13px/1 var(--font-mono)}
.stub{position:absolute;right:0;top:50%;width:min(24vw,140px);height:1px;background:var(--line);transform:translateX(100%)}
.stub::after{content:"";position:absolute;right:-5px;top:-4px;width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 0 var(--accent-glow)}
.motion .stub::after{animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 var(--accent-glow)}70%,100%{box-shadow:0 0 0 14px rgba(232,86,30,0)}}
.chain{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) 0;font:500 13px/1 var(--font-mono)}
.node{border:1px solid var(--line);padding:11px 14px;background:var(--bg);margin-right:-1px}
.node-k{background:var(--surface);padding:15px 18px}
.node-u{border-color:var(--accent);color:var(--accent);padding:15px 18px}
.arrow{width:clamp(28px,6vw,72px);height:1px;background:var(--line);position:relative;margin:0 4px}
.arrow::after{content:"";position:absolute;right:0;top:-3px;border:3px solid transparent;border-left:6px solid var(--line);border-right:0}
.rack{max-width:none}
.mods{overflow-x:auto;scrollbar-width:none;padding-bottom:4px;scroll-snap-type:x proximity}
.mods::-webkit-scrollbar{display:none}
.strip{list-style:none;margin:0;padding:20px var(--s2) 0;display:inline-flex;min-width:100%;gap:var(--s3);border-top:2px solid var(--line);box-sizing:border-box}
.mod{position:relative;flex:0 0 auto;scroll-snap-align:start;border:1px solid var(--line);background:var(--surface);padding:12px 14px 10px;min-width:120px;font:500 13px/1.3 var(--font-mono)}
.mod::before{content:"";position:absolute;left:50%;top:-21px;width:1px;height:20px;background:var(--line)}
.mod::after{content:"";position:absolute;left:calc(50% - 3px);top:-24px;width:5px;height:5px;border-radius:50%;background:var(--line)}
.mod small{display:block;font-weight:400;font-size:11px;color:var(--muted);margin-top:4px;letter-spacing:.04em}
.mod-you{border-style:dashed;background:transparent;border-color:var(--accent);color:var(--accent)}
.mod-you::before{background:var(--accent)}
.mod-you::after{background:var(--bg);border:1px solid var(--accent);width:4px;height:4px}
.bars{margin-top:var(--s8);display:grid;gap:10px;max-width:560px;font:500 12px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.bar{display:grid;grid-template-columns:84px 1fr;align-items:center;gap:var(--s3)}
.bar i{display:block;height:10px;border:1px solid var(--line);background:var(--line-faint)}
.bar-long i{width:100%}
.bar-short i{width:14%;border-color:var(--accent);background:var(--accent)}
.bar-short{color:var(--accent)}
.motion .bar i{width:0;transition:width 1s var(--ease) .35s}
.motion .in .bar-long i{width:100%}
.motion .in .bar-short i{width:14%}
.rack-note{margin:var(--s6) 0 0;font:400 12px/1.6 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.motion .mod{transform:translateY(-12px);opacity:0;transition:transform .7s var(--ease),opacity .4s}
.motion .in .mod{transform:none;opacity:1}
.motion .in .mod:nth-child(2){transition-delay:.08s}.motion .in .mod:nth-child(3){transition-delay:.16s}.motion .in .mod:nth-child(4){transition-delay:.24s}.motion .in .mod:nth-child(5){transition-delay:.32s}.motion .in .mod:nth-child(6){transition-delay:.4s}.motion .in .mod:nth-child(7){transition-delay:.6s}
.faces{border:1px solid var(--line);background:var(--bg);max-width:820px}
.url{display:flex;align-items:center;gap:var(--s3);padding:14px 18px;border-bottom:1px solid var(--line-faint);font:500 clamp(13px,1.3vw,17px)/1.4 var(--font-mono);word-break:break-all}
.url .m{font-size:11px;letter-spacing:.12em;color:var(--line);border:1px solid var(--line-faint);padding:4px 6px;flex:0 0 auto}
.url b{font-weight:500;color:var(--accent)}
.tabs{display:flex;border-bottom:1px solid var(--line-faint)}
.tabs button{flex:1;min-height:44px;border:0;background:none;font:500 12px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);cursor:pointer;position:relative}
.tabs button+button{border-left:1px solid var(--line-faint)}
.tabs button[aria-selected=true]{color:var(--fg);background:var(--surface)}
.tabs button[aria-selected=true]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--line)}
.stage-faces{position:relative;min-height:230px}
.face{padding:var(--s6) var(--s4);font:400 13px/1.7 var(--font-mono)}
.face-head{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--line);margin-bottom:var(--s3)}
.js .face{position:absolute;inset:0;clip-path:inset(0 100% 0 0);transition:clip-path .55s var(--ease)}
.js .faces[data-show=page] .face-page,.js .faces[data-show=api] .face-api,.js .faces[data-show=md] .face-md{clip-path:inset(0 0 0 0)}
html:not(.js) .tabs{display:none}
html:not(.js) .stage-faces{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
html:not(.js) .face+.face{border-left:1px solid var(--line-faint)}
.face-page svg{width:100%;max-width:420px;height:auto;display:block;margin-top:var(--s2)}
.face-page .t{font-family:var(--font-display);font-weight:700;font-stretch:112%;font-variation-settings:"wdth" 112;font-size:1.4rem;letter-spacing:-.02em;line-height:1.1}
.ep{display:grid;grid-template-columns:auto 1fr;gap:6px var(--s3);align-items:baseline;margin:0;padding:0;list-style:none}
.ep b{font-weight:500;font-size:11px;letter-spacing:.1em;padding:3px 6px;border:1px solid var(--line-faint);color:var(--line);text-align:center}
.ep b.p{color:var(--accent);border-color:rgba(184,66,14,.3)}
.ep span span{color:var(--muted);font-size:12px;margin-left:8px}
.md p{margin:0}
.md .h{color:var(--line)}
.md .q{color:var(--muted)}
.cmd{display:flex;flex-wrap:wrap;align-items:stretch;border:1px solid var(--line);background:var(--surface);max-width:760px}
.cmd code{flex:1 1 320px;padding:18px 20px;font:500 clamp(13px,1.1vw,15px)/1.6 var(--font-mono);word-break:break-all;white-space:pre-wrap}
.cmd code b{font-weight:500;color:var(--line)}
.copy{flex:0 0 auto;min-width:88px;min-height:44px;border:0;border-left:1px solid var(--line);background:var(--fg);color:var(--bg);font:500 12px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;padding:0 20px}
.copy:hover{background:var(--line)}
.aside{margin:var(--s12) 0 0;font-size:15px;color:var(--muted);max-width:40ch}
.aside::before{content:"// ";font-family:var(--font-mono);color:var(--line)}
.aside+.verse{margin-top:var(--s4)}
.demo{padding:0}
.stage-wrap{max-width:1440px;margin:0 auto;padding:var(--s16) var(--gutter)}
.motion .demo{height:340vh}
.motion .stage-wrap{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;padding-top:64px;padding-bottom:var(--s8);overflow:hidden}
.motion .stage-wrap>*{flex-shrink:0}
.demo h2{font-size:clamp(1.9rem,4.2vw,3.4rem);max-width:none}
.demo .lede{margin-top:var(--s4)}
.stage{position:relative;margin-top:var(--s8);display:flex;flex-direction:column;gap:var(--s6)}
.st{position:relative;border:1px solid var(--line-soft);background:var(--bg);padding:20px 18px 14px;width:max-content;max-width:100%;transition:border-color .3s,box-shadow .3s}
.st-v{font:500 14px/1.3 var(--font-mono);display:block;word-break:break-all}
.st-local{background:var(--surface);border-style:dashed}
.st-deploy{border-style:dashed;color:var(--muted);opacity:.7}
.st-deploy .st-k{color:var(--muted)}
.st-deploy .st-v{text-decoration:line-through;text-decoration-thickness:1px}
.st-deploy small{display:block;font:400 11px/1 var(--font-mono);margin-top:6px;letter-spacing:.06em}
.st-public{border-color:var(--accent)}
.st-public .st-k{color:var(--accent)}
.st-public a{color:var(--accent);text-decoration:none}
.st-public a:hover{text-decoration:underline}
.st:not(:first-child)::before{content:"";display:block;position:absolute;left:24px;top:calc(-1 * var(--s6) - 1px);height:var(--s6);width:1px;background:var(--line)}
.st-deploy::before{display:none!important}
.wire-svg{display:none}
.motion .st::before{display:none}
.motion .wire-svg{display:block;position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.wire-bg{fill:none;stroke:var(--line-faint);stroke-width:1;stroke-dasharray:3 5}
.wire{fill:none;stroke:var(--line);stroke-width:1.5}
.motion .st-mcp{border-color:var(--line-faint)}
.motion .st-public{border-color:rgba(184,66,14,.25)}
.motion .st-public .st-k,.motion .st-public a{color:#d29a83;transition:color .3s}
.motion .st.on{border-color:var(--line);box-shadow:0 0 0 4px var(--bg),0 0 0 5px var(--line-faint)}
.motion .st-public.on{border-color:var(--accent);box-shadow:0 0 0 4px var(--bg),0 0 0 5px var(--accent-glow)}
.motion .st-public.on .st-k,.motion .st-public.on a{color:var(--accent)}
.motion .stage{display:grid;grid-template-columns:1fr auto 1fr;grid-template-rows:auto auto auto;align-content:space-between;gap:var(--s8);min-height:min(40vh,400px)}
.motion .st-local{grid-column:1;grid-row:1;align-self:start}
.motion .st-deploy{grid-column:3;grid-row:1;justify-self:end;align-self:start}
.motion .st-mcp{grid-column:2;grid-row:2;align-self:center}
.motion .st-public{grid-column:3;grid-row:3;justify-self:end;align-self:end}
@media(max-width:767px){.motion .demo .lede{display:none}.motion .stage{display:flex;flex-direction:column;gap:40px;min-height:0;margin-top:var(--s6)}.motion .st-deploy{align-self:flex-end}.motion .st-mcp,.motion .st-public{align-self:flex-start}}
.log{list-style:none;margin:var(--s6) 0 0;padding:var(--s3) 0 0;border-top:1px solid var(--line-faint);font:400 13px/1.6 var(--font-mono);color:var(--muted)}
.log li b{font-weight:500;color:var(--fg)}
.log li.live,.log li.live b{color:var(--accent)}
.motion .log li{opacity:0;transform:translateX(-6px);transition:opacity .35s,transform .5s var(--ease)}
.motion .log li.on{opacity:1;transform:none}
@media(max-height:640px) and (max-width:767px){.motion .stage-wrap{padding-top:56px}.demo .lede{display:none}.log li{line-height:1.5}}
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:1px;background:var(--line-soft);border:1px solid var(--line-soft);margin-top:var(--s12)}
.k{grid-column:span 12;background:var(--bg);padding:var(--s6) var(--s6) var(--s4);display:flex;flex-direction:column;gap:var(--s3);text-decoration:none;position:relative;min-height:180px;transition:background .25s}
.k:hover{background:var(--surface)}
.k::after{content:"";position:absolute;right:0;bottom:0;width:9px;height:9px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.k-id{font:400 11px/1 var(--font-mono);letter-spacing:.08em;color:var(--line);display:flex;justify-content:space-between;gap:var(--s3)}
.k-id em{font-style:normal;color:var(--muted)}
.k h3{margin:var(--s2) 0 0;font-weight:700;font-stretch:112%;font-variation-settings:"wdth" 112;font-size:clamp(1.5rem,2.4vw,2.2rem);line-height:1.05;letter-spacing:-.02em}
.k p{margin:0;color:var(--muted);font-size:15px;line-height:1.45;max-width:42ch}
.k-foot{margin-top:auto;padding-top:var(--s4);display:flex;justify-content:space-between;align-items:baseline;font:500 12px/1 var(--font-mono);letter-spacing:.06em}
.k-foot span:last-child{color:var(--line)}
.k-wide h3{font-size:clamp(1.8rem,3.6vw,3.2rem)}
@media(min-width:768px){.k-7{grid-column:span 7}.k-5{grid-column:span 5}.k-4{grid-column:span 4}.k-12{grid-column:span 12}.k-12{flex-direction:row;align-items:center;gap:var(--s8);min-height:0}.k-12 h3{margin:0;font-size:1.4rem}.k-12 .k-id{flex-direction:column;gap:6px;min-width:120px}.k-12 p{flex:1}.k-12 .k-foot{margin:0;padding:0;gap:var(--s6)}}
footer{max-width:1440px;margin:0 auto;padding:var(--s16) var(--gutter) var(--s12);display:flex;flex-wrap:wrap;gap:var(--s6) var(--s8);justify-content:space-between;align-items:flex-end;font:400 12px/1.6 var(--font-mono);letter-spacing:.06em;color:var(--muted);border-top:1px solid var(--line-faint)}
footer a{text-decoration:none;display:inline-flex;align-items:center;min-height:44px}
footer a:hover{color:var(--fg)}
footer .verse{margin:0;letter-spacing:0}
footer .looks{display:flex;flex-wrap:wrap;gap:var(--s2);letter-spacing:.1em;text-transform:uppercase;font-size:11px}
footer .looks a{gap:6px}
.motion .r{opacity:0;transform:translateY(22px);transition:opacity .6s,transform .9s var(--ease)}
.motion .r.in{opacity:1;transform:none}
`;

var JS = `(function(){
var d=document,motion=d.documentElement.classList.contains('motion'),copyT=d.body.getAttribute('data-copy-text').split('|');
d.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=d.querySelector(b.getAttribute('data-copy')).textContent;if(!navigator.clipboard){return}navigator.clipboard.writeText(t).then(function(){b.textContent=copyT[1];setTimeout(function(){b.textContent=copyT[0]},1400)})})});
var faces=d.querySelector('.faces');
if(faces){var tabs=[].slice.call(faces.querySelectorAll('[data-face]')),suf=faces.querySelector('.url b'),order=tabs.map(function(t){return t.getAttribute('data-face')}),i=0,timer,sufx=JSON.parse(faces.getAttribute('data-suffix'));
var show=function(n){tabs.forEach(function(t){t.setAttribute('aria-selected',t.getAttribute('data-face')===n?'true':'false')});faces.setAttribute('data-show',n);suf.textContent=sufx[n]||'';i=order.indexOf(n)};
tabs.forEach(function(t){t.addEventListener('click',function(){clearInterval(timer);show(t.getAttribute('data-face'))})});show(order[0]);
if(motion){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){clearInterval(timer);timer=setInterval(function(){show(order[(i+1)%order.length])},3200)}else{clearInterval(timer)}})},{threshold:.4}).observe(faces)}}
if(!motion)return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.18});
d.querySelectorAll('.r').forEach(function(el){io.observe(el)});setTimeout(function(){d.querySelectorAll('.r').forEach(function(el){el.classList.add('in')})},2500);
var demo=d.getElementById('demo');if(!demo)return;
var stage=demo.querySelector('.stage'),svg=stage.querySelector('svg'),wire=svg.querySelector('.wire'),bg=svg.querySelector('.wire-bg'),A=d.getElementById('st-local'),B=d.getElementById('st-mcp'),Cc=d.getElementById('st-public'),logs=[].slice.call(demo.querySelectorAll('.log li')),len=0,p=0,tick=false;
function rel(el,R){var r=el.getBoundingClientRect();return{l:r.left-R.left,t:r.top-R.top,r:r.right-R.left,b:r.bottom-R.top,cy:r.top-R.top+r.height/2}}
function route(){var R=stage.getBoundingClientRect(),a=rel(A,R),b=rel(B,R),c=rel(Cc,R),dd;
if(matchMedia('(min-width:768px)').matches){var m1=(a.r+b.l)/2,m2=(b.r+c.l)/2;dd='M'+a.r+' '+a.cy+'H'+m1+'V'+b.cy+'H'+b.l+'M'+b.r+' '+b.cy+'H'+m2+'V'+c.cy+'H'+c.l}
else{var x1=a.l+24,x2=b.l+24,x3=c.l+24,y1=(a.b+b.t)/2,y2=(b.b+c.t)/2;dd='M'+x1+' '+a.b+'V'+y1+'H'+x2+'V'+b.t+'M'+x2+' '+b.b+'V'+y2+'H'+x3+'V'+c.t}
svg.setAttribute('viewBox','0 0 '+R.width+' '+R.height);wire.setAttribute('d',dd);bg.setAttribute('d',dd);len=wire.getTotalLength();wire.style.strokeDasharray=len;paint()}
function paint(){wire.style.strokeDashoffset=len*(1-p);B.classList.toggle('on',p>=.5);Cc.classList.toggle('on',p>=.985);logs.forEach(function(li){li.classList.toggle('on',p>=parseFloat(li.getAttribute('data-at')))})}
function measure(){var top=demo.getBoundingClientRect().top,total=demo.offsetHeight-innerHeight;p=total>0?Math.min(1,Math.max(0,-top/total)):1;paint()}
function onScroll(){if(!tick){tick=true;requestAnimationFrame(function(){measure();tick=false})}}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',function(){route();measure()});
if(d.fonts&&d.fonts.ready){d.fonts.ready.then(function(){route();measure()})}route();measure();
})();`;

var MAP_SVG = '<svg viewBox="0 0 420 120" aria-hidden="true" focusable="false"><g fill="none" stroke="#1d3fbf" stroke-width="1"><path d="M0 96 C 60 70, 90 110, 150 84 S 240 40, 300 60 S 380 30, 420 44" stroke-width="1.5"/><path d="M0 30 H420 M0 60 H420 M0 90 H420 M105 0 V120 M210 0 V120 M315 0 V120" stroke="rgba(29,63,191,.16)"/><circle cx="300" cy="60" r="26" stroke="rgba(29,63,191,.35)" stroke-dasharray="3 4"/><circle cx="300" cy="60" r="44" stroke="rgba(29,63,191,.2)" stroke-dasharray="3 4"/></g><circle cx="150" cy="84" r="4" fill="#b8420e"/><circle cx="300" cy="60" r="4" fill="#10233f"/><circle cx="372" cy="38" r="4" fill="#10233f"/></svg>';

var R = {
  hero: function(){var h=C.hero;
    return '<section class="sec hero"><p class="n">'+esc(h.kicker)+' · look '+esc(LOOK)+'</p><h1>'+breakLast(h.headline)+'</h1><p class="lede">'+esc(h.lede)+'</p><p class="tiny">'+h.tagline.map(esc).join(' · ')+'</p>'+
      '<div class="enc" aria-hidden="true"><span class="enc-k">'+esc(h.local.label)+'</span><span class="chip">'+esc(h.local.chip)+'</span><span class="stub"></span></div></section>';},
  what: function(){var s=C.what;
    return '<section class="sec r" id="what">'+label(s)+'<h2>'+s.headline.map(esc).join(' ')+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="fig chain" aria-hidden="true">'+
      s.chain.map(function(c){var cls=c.kind==='kennel'?'node node-k':c.kind==='url'?'node node-u':'node';return (c.kind==='dog'?'':'<span class="arrow"></span>')+'<span class="'+cls+'">'+show(c.label)+'</span>';}).join('')+'</div></section>';},
  packs: function(){var s=C.packs;
    return '<section class="sec r" id="packs">'+label(s)+'<h2>'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="fig rack"><div class="mods"><ul class="strip" aria-label="Base dogs on the rail">'+
      s.modules.map(function(m){return '<li class="mod">'+esc(m.name)+'<small>'+esc(m.pack)+'</small></li>';}).join('')+'<li class="mod mod-you">'+esc(s.yours.name)+'<small>'+esc(s.yours.note)+'</small></li></ul></div>'+
      '<div class="bars" aria-label="'+s.bars.map(function(b){return esc(b.label)}).join(' vs ')+'">'+s.bars.map(function(b){return '<div class="bar bar-'+esc(b.size)+'"><span>'+esc(b.label)+'</span><i></i></div>';}).join('')+'</div>'+
      '<p class="rack-note">'+esc(s.footnote)+' · '+s.attrs.map(esc).join(' · ')+'</p></div></section>';},
  faces: function(){var s=C.faces,sufx={};s.items.forEach(function(it){sufx[it.key]=it.suffix;});var pv=s.preview;
    return '<section class="sec r" id="can">'+label(s)+'<h2>'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="fig faces" data-suffix="'+esc(JSON.stringify(sufx))+'">'+
      '<div class="url"><span class="m">'+esc(s.method)+'</span><span>'+show(s.url)+'<b></b></span></div><div class="tabs" role="tablist" aria-label="Representation">'+
      s.items.map(function(it,i){return '<button type="button" role="tab" aria-selected="'+(i===0)+'" data-face="'+esc(it.key)+'">'+esc(it.label)+'</button>';}).join('')+'</div><div class="stage-faces">'+
      '<div class="face face-page"><span class="face-head">'+esc(s.items[0].line)+'</span><span class="t">'+esc(pv.page.title)+'</span>'+MAP_SVG+'</div>'+
      '<div class="face face-api"><span class="face-head">'+esc(s.items[1].line)+'</span><ul class="ep">'+pv.api.endpoints.map(function(e){return '<li><b'+(e.method==='POST'?' class="p"':'')+'>'+esc(e.method)+'</b><span>'+esc(e.path)+' <span>'+esc(e.note)+'</span></span></li>';}).join('')+'</ul></div>'+
      '<div class="face face-md md"><span class="face-head">'+esc(s.items[2].line)+'</span>'+pv.md.lines.map(function(l){return '<p'+(l.mark?'':' class="q"')+'>'+(l.mark?'<span class="h">'+esc(l.mark)+'</span> ':'')+esc(l.text)+'</p>';}).join('')+'</div>'+
      '</div></div>'+verse(s.verse)+'</section>';},
  how: function(){var s=C.how,cmd=esc(s.command).replace(esc(s.commandHighlight),'<b>'+esc(s.commandHighlight)+'</b>');
    return '<section class="sec r" id="how">'+label(s)+'<h2>'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="fig cmd"><code id="cmd">'+cmd+'</code><button class="copy" type="button" data-copy="#cmd">'+esc(s.copy.idle)+'</button></div><p class="aside">'+esc(s.aside)+'</p>'+verse(s.verse)+'</section>';},
  breakout: function(){var s=C.breakout,st={};s.stops.forEach(function(x){st[x.key]=x;});var d=s.dead;
    function station(x){var v=x.href?'<a class="st-v" href="'+esc(x.href)+'">'+show(x.value)+'</a>':'<span class="st-v">'+show(x.value)+'</span>';return '<div class="st st-'+esc(x.key)+'" id="st-'+esc(x.key)+'"><span class="st-k">'+esc(x.label)+'</span>'+v+'</div>';}
    return '<section class="demo" id="demo" aria-labelledby="demo-h"><div class="stage-wrap">'+label(s)+'<h2 id="demo-h">'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="stage">'+
      station(st.local)+'<div class="st st-deploy" aria-label="'+esc(d.label)+': '+esc(d.note)+'"><span class="st-k">'+esc(d.label)+'</span><span class="st-v">'+esc(d.value)+'</span><small>'+esc(d.note)+'</small></div>'+station(st.mcp)+station(st.public)+
      '<svg class="wire-svg" aria-hidden="true" focusable="false"><path class="wire-bg"/><path class="wire"/></svg></div><ol class="log" aria-label="Trace">'+
      s.log.map(function(l){return '<li data-at="'+l.at+'"'+(l.live?' class="live"':'')+'><b>'+esc(l.who)+'</b> › '+show(l.text)+'</li>';}).join('')+'</ol></div></section>';},
  out: function(){var s=C.out,cls={wide:'k-7 k-wide',big:'k-5',small:'k-4',mid:'k-4',strip:'k-12'};
    return '<section class="sec r" id="out">'+label(s)+'<h2>'+esc(s.headline)+'</h2><p class="lede">'+esc(s.lede)+'</p><div class="grid">'+
      s.kennels.map(function(k){var path=s.kennelPath+k.id,shortp=path.length>22?path.slice(0,20)+'…':path;return '<a class="k '+(cls[k.size]||'k-4')+'" href="'+esc(path)+'"><span class="k-id">'+esc(k.id)+' <em>'+esc(k.type)+'</em></span><h3>'+esc(k.title)+'</h3><p>'+esc(k.blurb)+'</p><span class="k-foot"><span>'+k.dogs+' '+esc(s.dogsWord)+'</span><span>'+esc(shortp)+' →</span></span></a>';}).join('')+'</div></section>';}
};

var f=C.footer;
var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(C.meta.title)+'</title><meta name="description" content="'+esc(C.meta.description)+'"><meta name="theme-color" content="#f3f4f0">'+
  '<script>document.documentElement.className=\'js\'+(matchMedia(\'(prefers-reduced-motion:reduce)\').matches?\'\':\' motion\')<\/script>'+
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet"><style>'+CSS+'</style></head>'+
  '<body data-copy-text="'+esc(C.how.copy.idle+'|'+C.how.copy.done)+'"><header class="top"><a class="mark" href="#top">'+esc(C.brand.wordmark)+'</a><div class="right"><nav class="main">'+C.nav.map(function(n){return '<a href="#'+esc(n.anchor)+'">'+esc(n.label)+'</a>';}).join('')+'</nav>'+looks('looks',true)+'</div></header><main id="top">'+
  R.hero()+C.order.map(function(k){return R[k]?R[k]():'';}).join('')+'</main>'+
  '<footer><div><span>'+esc(f.line)+'</span><br><a href="#'+esc(f.commandAnchor)+'">'+esc(f.command)+'</a>'+looks('looks')+'</div>'+verse(f.verse)+'</footer><script>'+JS+'<\/script></body></html>';
return html;
