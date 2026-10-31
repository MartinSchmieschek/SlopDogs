// SlopDogs kennel list · script: create fields. The fields of the New kennel sheet: the ID rule live (one URL
// segment, starts with a letter or digit, then "Public address: /k/<id>"), the emoji popover from the presets
// (Esc closes it before the sheet), the visibility radios with private as default.
function kennelsCreateFields(K) {
    var CFG = K.CFG,
        COPY = K.COPY,
        $ = K.$,
        $$ = K.$$,
        d = K.d,
        pattern = new RegExp(CFG.idPattern);
    function problem(v, touched) {
        if (!v) return touched ? COPY.idRequired : null;
        if (v === '.' || v === '..' || !pattern.test(v))
            return /^[._-]/.test(v) && pattern.test('a' + v.slice(1)) ? COPY.idStart : COPY.idHint;
        return null;
    }
    K.createFields = function (layer) {
        var c = function (n) {
            return layer.querySelector('[data-c="' + n + '"]');
        };
        var f = { id: $('#nk-id', layer), emoji: '', touched: false, popLayer: null },
            hint = $('#nk-id-hint', layer),
            grid = c('grid'),
            pop = c('pop'),
            pick = c('emoji');
        CFG.emojis.forEach(function (e) {
            var b = d.createElement('button');
            b.type = 'button';
            b.textContent = e;
            b.dataset.e = e;
            b.setAttribute('aria-label', 'Emoji ' + e);
            b.setAttribute('aria-pressed', 'false');
            grid.appendChild(b);
        });
        f.check = function () {
            var v = f.id.value.trim(),
                p = problem(v, f.touched);
            f.id.setAttribute('aria-invalid', String(!!p));
            hint.classList.toggle('sd-hint--error', !!p);
            hint.textContent = p || (v ? K.t(COPY.publicAt, { id: v }) : COPY.idHint);
            c('submit').disabled = !v || !!p;
        };
        f.taken = function (text) {
            f.id.setAttribute('aria-invalid', 'true');
            hint.textContent = text;
            hint.classList.add('sd-hint--error');
            f.id.focus();
        };
        f.setPop = function (open) {
            pop.hidden = !open;
            pick.setAttribute('aria-expanded', String(open));
            if (open) {
                f.popLayer = K.pushLayer(function () {
                    f.setPop(false);
                    pick.focus();
                });
                (grid.querySelector('[aria-pressed="true"]') || grid.firstChild).focus();
            } else if (f.popLayer) {
                K.popLayer(f.popLayer);
                f.popLayer = null;
            }
        };
        function choose(e) {
            f.emoji = e;
            $('#nk-emoji-now', layer).textContent = e || '🐕';
            c('emoji-note').textContent = COPY.emojiNote[e ? 1 : 0];
            $$('button', grid).forEach(function (b) {
                b.setAttribute('aria-pressed', String(b.dataset.e === e));
            });
            f.setPop(false);
            pick.focus();
        }
        f.id.addEventListener('input', f.check);
        f.id.addEventListener('blur', function () {
            f.touched = true;
            f.check();
        });
        pick.addEventListener('click', function () {
            f.setPop(pop.hidden);
        });
        grid.addEventListener('click', function (ev) {
            var b = ev.target.closest('button');
            if (b) choose(b.dataset.e);
        });
        c('noemoji').addEventListener('click', function () {
            choose('');
        });
        return f;
    };
}
return String(kennelsCreateFields);
