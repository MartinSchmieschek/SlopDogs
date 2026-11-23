// SlopDogs kennel list · script: row. Fills one row from the template: number, emoji, title link
// (/k/<ref>?<defaultQuery>, new tab, "opened last"), chips (run only/private, frozen, maintained, yours, last
// opened), meta, plaque, stars, relative time, favorite flag. Names and texts only via textContent.
function kennelsRow(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY;
    K.buildRow = function (k, i) {
        var el = K.$('template[data-tpl="row"]').content.firstElementChild.cloneNode(true);
        var s = function (n) {
            return el.querySelector('[data-s="' + n + '"]');
        };
        var ref = K.refOf(k),
            title = k.name || ref,
            r = k.myRights || {},
            current = S.lastOpened === ref;
        el.dataset.ref = ref;
        el.style.setProperty('--i', i % CFG.pageSize);
        el.classList.toggle('yours', !!r.own);
        el.classList.toggle('current', current);
        s('no').textContent = String(i + 1).padStart(2, '0');
        s('emoji').textContent = (k.emoji || '').trim() || '🐕';
        var a = s('name');
        a.textContent = title;
        a.href = K.publicPath(k);
        a.title = 'Open the public page in a new tab';
        a.setAttribute('aria-label', title + (current ? ', opened last' : '') + ', public page, opens in a new tab');
        if (current) a.setAttribute('aria-current', 'true');
        var c = s('chips');
        if (K.runOnly(k)) c.appendChild(K.chip(COPY.chip.runOnly));
        else if (k.visibility === 'private') c.appendChild(K.chip(COPY.chip.private));
        if (K.frozen(k)) c.appendChild(K.chip(COPY.chip.frozen, 'sd-chip--frozen'));
        if (K.maintained(k)) c.appendChild(K.chip(COPY.chip.maintained, 'sd-chip--soft'));
        if (r.own) c.appendChild(K.chip(COPY.chip.yours, 'sd-chip--live'));
        if (current) c.appendChild(K.chip(COPY.chip.last));
        var meta = [ref];
        if (Array.isArray(k.dogIds)) meta.push(k.dogIds.length + ' dog' + (k.dogIds.length === 1 ? '' : 's'));
        if (k.description && k.description.trim()) meta.push(k.description.trim());
        s('meta').textContent = meta.join(' · ');
        var st = k.stats;
        if (st && st.calls) {
            var runs = K.fmt(st.calls.ranked30d),
                pl = s('plaque');
            pl.title = runs + ' runs in 30 days · ' + K.fmt(st.calls.ranked) + ' in total';
            pl.innerHTML =
                '<span aria-hidden="true"><span class="g">▷ </span>' + runs + '</span><span class="sr">' + runs + ' runs in 30 days</span>';
        }
        K.stars(s('stars'), st && st.rating);
        var when = k.updatedAt || k.createdAt,
            w = s('when');
        w.dateTime = when || '';
        w.textContent = K.rel(when);
        w.title = when ? new Date(when).toLocaleString('en-GB') : '';
        var f = el.querySelector('.fav'),
            fv = !!k.favorite;
        f.setAttribute('aria-pressed', String(fv));
        f.setAttribute('aria-label', 'Favorite ' + title);
        f.title = fv ? COPY.favOn : COPY.favOff;
        if (S.busy[ref]) f.setAttribute('aria-busy', 'true');
        el.querySelector('.dots').setAttribute('aria-label', 'More for ' + title);
        return el;
    };
}
return String(kennelsRow);
