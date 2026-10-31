// SlopDogs kennel list · script: empty. The four empty states of the list: no search hit (+ Clear search), no
// favorites yet (+ Show all), no own kennel (+ Show all), and no tracks at all with + New kennel and the MCP
// command `claude mcp add --transport http slopdogs <origin>/mcp` to copy.
function kennelsEmpty(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY,
        d = K.d;
    function el(tag, cls, text) {
        var e = d.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    }
    K.button = function (text, act, primary) {
        var b = el('button', 'sd-btn' + (primary ? ' sd-btn--primary' : ''), text);
        b.type = 'button';
        b.dataset.act = act;
        return b;
    };
    K.emptyState = function () {
        var box = el('div', 'empty');
        if (S.q || S.fav || S.mine) {
            box.appendChild(el('p', '', S.q ? K.t(COPY.emptySearch, { q: S.q }) : S.fav ? COPY.emptyFav : COPY.emptyMine));
            box.appendChild(K.button(S.q ? COPY.clearSearch : COPY.showAll, 'clear'));
            return box;
        }
        box.appendChild(el('h2', '', COPY.emptyTitle));
        box.appendChild(el('p', 'muted', COPY.emptyLine));
        box.appendChild(K.button(COPY.newKennel, 'new', true));
        var cmd = el('div', 'cmd');
        cmd.appendChild(el('code', '', 'claude mcp add --transport http slopdogs ' + K.absolute(CFG.mcp)));
        var copy = K.button(COPY.copy, 'copy-cmd');
        copy.className = 'sd-btn sd-btn--sm';
        cmd.appendChild(copy);
        box.appendChild(cmd);
        return box;
    };
}
return String(kennelsEmpty);
