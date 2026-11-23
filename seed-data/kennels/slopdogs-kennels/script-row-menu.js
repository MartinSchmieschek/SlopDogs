// SlopDogs kennel list · script: row menu. Open page ↗, Share link, Docs ↗ | Edit, Export | Delete. A locked Edit
// stays visible, disabled and focusable, with its reason read out (aria-describedby); a maintainer sees the
// maintained note instead. Run-only rows say why Edit and Export are missing; Delete only where K.canDelete.
function kennelsRowMenu(K) {
    var COPY = K.COPY,
        $ = K.$,
        seq = 0;
    K.showMenu = function (btn, k) {
        var menu = $('template[data-tpl="menu"]').content.firstElementChild.cloneNode(true),
            ref = K.refOf(k),
            lock = K.lockOf(k),
            hintId = 'menu-lock-' + ++seq;
        var g = function (n) {
            return menu.querySelector('[data-m="' + n + '"]');
        };
        menu.setAttribute('aria-label', 'Actions for ' + (k.name || ref));
        g('open').href = K.publicPath(k);
        g('docs').href = '/k/' + encodeURIComponent(ref) + '/docs';
        g('edit').href = '/kennels/' + encodeURIComponent(ref);
        if (K.runOnly(k)) {
            ['sep-edit', 'edit', 'lock', 'export', 'sep-del', 'delete'].forEach(function (n) {
                g(n).remove();
            });
            g('runonly').textContent = COPY.runOnly;
        } else {
            g('runonly').remove();
            if (lock) {
                g('edit').setAttribute('aria-disabled', 'true');
                g('edit').removeAttribute('href');
                g('edit').setAttribute('aria-describedby', hintId);
                g('lock').id = hintId;
                g('lock').textContent = lock;
            } else if (K.maintained(k)) {
                g('lock').textContent = COPY.maintainer;
            } else {
                g('lock').remove();
                if (k.myRights && k.myRights.edit === false) g('edit').remove();
            }
            if (!K.canDelete(k)) {
                g('delete').remove();
                g('sep-del').remove();
            }
        }
        menu.addEventListener('click', function (ev) {
            var it = ev.target.closest('[role="menuitem"]');
            if (!it) return;
            if (it.getAttribute('aria-disabled') === 'true') {
                ev.preventDefault();
                return;
            }
            var m = it.dataset.m;
            K.closeMenu(m === 'share' || m === 'export' || m === 'delete');
            if (m === 'open') K.markOpened(ref);
            if (m === 'share') K.share(k);
            if (m === 'export') K.exportBundle(ref);
            if (m === 'delete') K.askDelete(k);
        });
        K.mountMenu(btn, menu, btn.closest('.row'));
    };
}
return String(kennelsRowMenu);
