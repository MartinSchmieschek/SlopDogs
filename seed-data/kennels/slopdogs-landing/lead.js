// SlopDogs landing · lead. Takes SlopdogsLandingSkinC (Mixtape, the only look, PLAN 8.19) as the page and
// wires the live part: the host of the page and the rankings from /api/landing with the states
// loading/waking/data/empty/error (PLAN P5). The skin only brings its markup: #sd-live with a card <template>.
// The page script is live() below, shipped as its own source text (ES5, no framework, one request).
var html = typeof SlopdogsLandingSkinC !== 'undefined' ? SlopdogsLandingSkinC : null;
if (!html || typeof html !== 'string') { throw new Error('SlopdogsLanding: kein Skin C geliefert.'); }

/* States: only the block of the current state shows; the rankings show while loading (placeholders) and with data. */
var CSS = ''
+ '#sd-live [data-when]{display:none}'
+ '#sd-live[data-state="loading"] [data-when~="loading"],#sd-live[data-state="waking"] [data-when~="waking"],#sd-live[data-state="empty"] [data-when~="empty"],#sd-live[data-state="error"] [data-when~="error"]{display:block}'
+ '#sd-live[data-state="empty"] [data-group],#sd-live[data-state="error"] [data-group]{display:none}'
+ '#sd-live .ph{pointer-events:none}#sd-live [hidden]{display:none!important}';

/* Page script. Runs in the browser, never here: the lead only ships its source text. */
function live() {
  var d = document, MARK = '‹host›', H = location.host, O = location.origin;
  function withHost(s) { return s.split('https://' + MARK).join(O).split(MARK).join(H); }
  var walk = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT), node;
  while ((node = walk.nextNode())) { if (node.nodeValue.indexOf(MARK) >= 0) node.nodeValue = withHost(node.nodeValue); }
  [].forEach.call(d.querySelectorAll('*'), function (el) {
    [].forEach.call(el.attributes, function (a) { if (a.value.indexOf(MARK) >= 0) el.setAttribute(a.name, withHost(a.value)); });
  });

  var root = d.getElementById('sd-live');
  var tpl = root && root.querySelector('template[data-tpl="card"]');
  if (!root || !tpl || !window.fetch) return;
  function attr(n) { return root.getAttribute(n) || ''; }
  var lists = [].slice.call(root.querySelectorAll('[data-list]'));
  var limit = +attr('data-limit') || 6, api = attr('data-api') || '/api/landing', emoji = attr('data-emoji') || '🐕';
  var nf = new Intl.NumberFormat('en-US'), DELAYS = [2000, 5000, 10000];
  var state, wake, retry, t0, tries, gen = 0;

  function setState(s) {
    state = s;
    root.setAttribute('data-state', s);
    root.setAttribute('aria-busy', s === 'loading' || s === 'waking' ? 'true' : 'false');
  }
  function count(n, many, one) { return nf.format(n) + ' ' + (n === 1 && attr(one) ? attr(one) : attr(many)); }
  function field(card, name, text, title) {
    var el = card.querySelector('[data-f="' + name + '"]');
    if (!el) return;
    var none = text == null || text === '';
    el.textContent = none ? '' : text;
    el.hidden = none;
    if (title) el.title = title;
  }
  function card(list, i, e) {
    var li = tpl.content.firstElementChild.cloneNode(true), sizes = (list.getAttribute('data-sizes') || '').split('|');
    var size = sizes[i % sizes.length], link = li.querySelector('[data-f-href]') || li;
    if (size) li.className = (li.className + ' ' + size).replace(/^\s+|\s+$/g, '');
    if (!e) {
      li.className += ' ph';
      li.setAttribute('aria-hidden', 'true');
      link.removeAttribute('href');
      link.setAttribute('tabindex', '-1');
      [].forEach.call(li.querySelectorAll('[data-f]'), function (el) { el.textContent = ' '; });
      return li;
    }
    var s = e.stats || {};
    if (list.getAttribute('data-kind') === 'dog') {
      var dogName = e.displayName || e.lineageId;
      field(li, 'emoji', e.icon || emoji);
      field(li, 'name', dogName);
      field(li, 'path', attr('data-w-proven'));
      field(li, 'calls', count((s.reuse || {}).kennelsTransitive || 0, 'data-w-reuse', 'data-w-reuse-one'));
      field(li, 'stars', '');
      field(li, 'description', e.description);
      link.setAttribute('href', attr('data-dog-href') + encodeURIComponent(dogName));
      return li;
    }
    var calls = s.calls || {}, rating = s.rating || {};
    field(li, 'emoji', e.emoji || emoji);
    field(li, 'name', e.name || e.lineageId);
    field(li, 'path', String(e.url || '').split('?')[0]);
    field(li, 'calls', count(calls.ranked30d || 0, 'data-w-calls', 'data-w-call'), nf.format(calls.total || 0) + ' total');
    field(li, 'stars', rating.avg == null ? '' : '★ ' + Number(rating.avg).toFixed(1) + ' · ' + nf.format(rating.count || 0));
    field(li, 'description', e.description);
    link.setAttribute('href', e.url);
    return li;
  }
  function fill(data) {
    var any = false;
    lists.forEach(function (list) {
      var key = list.getAttribute('data-list'), items = ((data && data[key]) || []).slice(0, limit);
      var none = root.querySelector('[data-empty="' + key + '"]');
      list.innerHTML = '';
      items.forEach(function (e, i) { list.appendChild(card(list, i, e)); });
      list.hidden = !items.length;
      if (none) none.hidden = !!items.length;
      if (items.length) any = true;
    });
    return any;
  }
  function placeholders() {
    lists.forEach(function (list) {
      var none = root.querySelector('[data-empty="' + list.getAttribute('data-list') + '"]');
      list.innerHTML = '';
      list.hidden = false;
      for (var i = 0; i < 3; i++) list.appendChild(card(list, i, null));
      if (none) none.hidden = true;
    });
  }
  function done() { d.dispatchEvent(new CustomEvent('sdlanding')); }
  function fail() { clearTimeout(wake); setState('error'); }
  /* Every load() starts a new generation; answers of an older one (a second click on "Again") are dropped. */
  function attempt() {
    var mine = gen;
    fetch(api + '?limit=' + limit, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (mine !== gen) return null;
      if (r.status >= 500) throw new Error('retry');
      if (!r.ok) { fail(); return null; }
      return r.json();
    }).then(function (j) {
      if (!j || mine !== gen) return;
      clearTimeout(wake);
      setState(fill(j) ? 'data' : 'empty');
      done();
    }, function () {
      if (mine !== gen) return;
      if (Date.now() - t0 >= 150000) { fail(); return; }
      retry = setTimeout(attempt, tries < DELAYS.length ? DELAYS[tries] : 15000);
      tries++;
    });
  }
  function load() {
    gen += 1;
    clearTimeout(wake);
    clearTimeout(retry);
    t0 = Date.now();
    tries = 0;
    setState('loading');
    placeholders();
    done();
    wake = setTimeout(function () { if (state === 'loading') setState('waking'); }, 2500);
    attempt();
  }
  var again = root.querySelector('[data-retry]');
  if (again) again.addEventListener('click', load);
  load();
}

function inject(page, marker, snippet) {
  var at = page.lastIndexOf(marker);
  return at < 0 ? page : page.slice(0, at) + snippet + page.slice(at);
}
html = inject(html, '</head>', '<style>' + CSS + '</style>');
html = inject(html, '</body>', '<' + 'script>(' + String(live) + ')();<' + '/script>');
return html;
