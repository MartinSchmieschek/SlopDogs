// SlopDogs kennel list · script: layers. The Esc stack (popover before sheet before menu), layers with a focus trap
// and focus return to the opener, the dialog (confirm, import, key help), the toast, and the phone search that
// folds open and shut.
function kennelsUi(K) {
    var $ = K.$,
        $$ = K.$$,
        d = K.d,
        timer = null;
    K.layers = [];
    K.pushLayer = function (close) {
        var l = { close: close };
        K.layers.push(l);
        return l;
    };
    K.popLayer = function (l) {
        var i = K.layers.indexOf(l);
        if (i >= 0) K.layers.splice(i, 1);
    };
    function focusables(root) {
        return $$(
            'a[href],button:not([disabled]),input:not([disabled]):not([hidden]),textarea,select,[tabindex]:not([tabindex="-1"])',
            root,
        ).filter(function (e) {
            return !e.closest('[hidden]');
        });
    }
    K.mountLayer = function (layer, first, onClose) {
        var opener = d.activeElement,
            ref = K.pushLayer(close);
        $('#layers').appendChild(layer);
        function close() {
            K.popLayer(ref);
            layer.remove();
            if (onClose) onClose();
            if (opener && opener.focus && d.contains(opener)) opener.focus();
        }
        $$('[data-close]', layer).forEach(function (b) {
            b.addEventListener('click', close);
        });
        layer.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Tab') return;
            var f = focusables(layer);
            if (!f.length) return;
            if (ev.shiftKey && d.activeElement === f[0]) {
                ev.preventDefault();
                f[f.length - 1].focus();
            } else if (!ev.shiftKey && d.activeElement === f[f.length - 1]) {
                ev.preventDefault();
                f[0].focus();
            }
        });
        (first || focusables(layer)[0]).focus();
        return close;
    };
    K.dialog = function (o) {
        var layer = $('template[data-tpl="dialog"]').content.firstElementChild.cloneNode(true),
            ok = $('[data-d="ok"]', layer);
        $('#dlg-title', layer).textContent = o.title;
        $('#dlg-msg', layer).textContent = o.message || '';
        if (o.ok) {
            ok.textContent = o.ok;
            if (o.tone) ok.classList.add(o.tone === 'danger' ? 'sd-btn--danger' : 'sd-btn--primary');
        } else ok.remove();
        if (o.field) $('[data-d="field"]', layer).appendChild(o.field);
        var first = o.onOpen ? o.onOpen(layer) : null;
        var close = K.mountLayer(layer, first || $('.foot [data-close]', layer));
        if (o.ok)
            ok.addEventListener('click', function () {
                o.onOk(close, layer);
            });
        return close;
    };
    K.toast = function (text) {
        var t = $('#toast'),
            p = d.createElement('p');
        t.textContent = '';
        p.className = 'sd-rise';
        p.textContent = text;
        t.appendChild(p);
        clearTimeout(timer);
        timer = setTimeout(function () {
            t.textContent = '';
        }, 4000);
    };
    K.typing = function (el) {
        return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    K.openSearch = function () {
        $('#bar').classList.add('searching');
        $('#q').focus();
    };
    K.closeSearch = function () {
        $('#bar').classList.remove('searching');
    };
    K.keyHelp = function () {
        K.dialog({ title: K.COPY.keysTitle, field: $('template[data-tpl="keys"]').content.cloneNode(true) });
    };
}
return String(kennelsUi);
