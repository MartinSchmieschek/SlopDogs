// SlopDogs kennel list · script: formats. How a row writes its data: counts with thin groups, relative time (en-GB
// date after a week), a chip, and the stars (five outlines on a desktop, compact on a phone, always with a
// screen-reader sentence). Markup here only carries numbers; names never pass through innerHTML.
function kennelsFormat(K) {
    var d = K.d,
        STAR = 'M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z';
    K.fmt = function (n) {
        return Math.round(Number(n) || 0)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };
    K.rel = function (iso) {
        var t = Date.parse(iso);
        if (isNaN(t)) return '—';
        var min = Math.round((Date.now() - t) / 6e4);
        if (min < 1) return 'just now';
        if (min < 60) return min + ' min ago';
        var h = Math.round(min / 60);
        if (h < 24) return h + ' h ago';
        var days = Math.round(h / 24);
        if (days < 8) return days + ' d ago';
        return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    K.chip = function (text, cls) {
        var s = d.createElement('span');
        s.className = 'sd-chip' + (cls ? ' ' + cls : '');
        s.textContent = text;
        return s;
    };
    K.stars = function (el, rt) {
        if (!rt || !(rt.count > 0)) {
            el.classList.add('none');
            el.title = 'no ratings yet';
            el.innerHTML = '<span aria-hidden="true">★ —</span><span class="sr">no ratings yet</span>';
            return;
        }
        var avg = Number(rt.avg).toFixed(1),
            on = Math.round(rt.avg),
            count = Number(rt.count),
            svg = '';
        for (var j = 0; j < 5; j++)
            svg += '<path d="' + STAR + '" transform="translate(' + j * 16 + ' 0)"' + (j < on ? ' class="on"' : '') + '/>';
        el.title = avg + ' of 5 · ' + count + ' rating' + (count === 1 ? '' : 's');
        el.innerHTML = [
            '<svg viewBox="0 0 80 16" width="80" height="16" aria-hidden="true">' + svg + '</svg>',
            '<span aria-hidden="true"><span class="compact">★ </span>' + avg + ' <span class="c">(' + count + ')</span></span>',
            '<span class="sr">rated ' + avg + ' of 5 by ' + count + '</span>',
        ].join('');
    };
}
return String(kennelsFormat);
