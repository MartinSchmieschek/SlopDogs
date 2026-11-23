// SlopDogs kennel list · script: veil. While the first page loads: the skeleton at once, the veil from 3 s with an
// honest clock and progress (ease-out over 120 s, capped at 90 %), the cold-start hint from 10 s, "Still cold" and
// Retry from 150 s, and one verse, remembered for the void cinema (sessionStorage, as the Angular veil does).
function kennelsVeil(K) {
    var S = K.S,
        CFG = K.CFG,
        $ = K.$,
        d = K.d,
        ticking = null;
    K.lastVerse = function () {
        try {
            var v = JSON.parse(sessionStorage.getItem(CFG.verseStore) || 'null');
            return v && typeof v.line1 === 'string' ? v : null;
        } catch {
            return null;
        }
    };
    function pickVerse() {
        var v = K.VERSES[Math.floor(Math.random() * K.VERSES.length)],
            box = $('#veil-verse'),
            name = d.createElement('span');
        box.textContent = v[2] + ' ' + v[3] + ' ';
        name.textContent = v[0];
        box.appendChild(name);
        try {
            sessionStorage.setItem(CFG.verseStore, JSON.stringify({ name: v[0], keyword: v[1], line1: v[2], line2: v[3], iconSrc: '' }));
        } catch {
            /* private mode */
        }
    }
    function tick() {
        var s = (Date.now() - S.startedAt) / 1000,
            shown = s * 1000 >= CFG.veilAfterMs;
        $('#veil').hidden = !shown;
        if (!shown) return;
        var sec = Math.floor(s),
            t = Math.min(s, CFG.progressSpanS) / CFG.progressSpanS,
            still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('#veil-clock').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
        $('#veil-prog').style.width = CFG.progressCap * 100 * (still ? t : 1 - Math.pow(1 - t, 3)) + '%';
        var cold = s >= CFG.coldAfterS;
        $('#veil-cold').hidden = !cold;
        $('#veil-retry').hidden = !cold;
        $('#veil-hint').hidden = cold || s < CFG.hintAfterS;
    }
    K.startVeil = function () {
        if (ticking) return;
        pickVerse();
        tick();
        ticking = setInterval(tick, 500);
    };
    K.stopVeil = function () {
        clearInterval(ticking);
        ticking = null;
        $('#veil').hidden = true;
    };
}
return String(kennelsVeil);
