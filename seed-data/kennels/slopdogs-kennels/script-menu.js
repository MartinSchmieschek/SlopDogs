// SlopDogs kennel list · script: menus. One open menu at a time (row menu or account menu): focus on the first
// item, arrows wrap, Home/End jump, Esc closes and returns focus, Tab closes and moves on, Space follows a link;
// the menu flips up when it would run into the bottom bar.
function kennelsMenu(K) {
    var $$ = K.$$,
        d = K.d,
        open = null;
    K.menuOpenFor = function (btn) {
        return !!open && open.btn === btn;
    };
    K.menuContains = function (el) {
        return !!open && (open.menu.contains(el) || open.btn.contains(el));
    };
    K.closeMenu = function (focusBack) {
        if (!open) return;
        var m = open;
        open = null;
        m.menu.remove();
        m.host.classList.remove('menu-on');
        m.btn.setAttribute('aria-expanded', 'false');
        K.popLayer(m.layer);
        if (focusBack) m.btn.focus();
    };
    function keys(ev, items) {
        var i = items.indexOf(d.activeElement);
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            items[(i + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            items[ev.key === 'Home' ? 0 : items.length - 1].focus();
        } else if (ev.key === 'Tab') {
            K.closeMenu(false);
        } else if (ev.key === ' ' && d.activeElement.tagName === 'A') {
            ev.preventDefault();
            d.activeElement.click();
        }
    }
    K.mountMenu = function (btn, menu, host) {
        K.closeMenu(false);
        btn.parentNode.appendChild(menu);
        host.classList.add('menu-on');
        btn.setAttribute('aria-expanded', 'true');
        var rect = menu.getBoundingClientRect(),
            floor = innerHeight - (K.phone() ? 60 : 0) - 8;
        if (rect.bottom > floor && btn.getBoundingClientRect().top - rect.height > 60) menu.classList.add('up');
        var items = $$('[role="menuitem"]', menu);
        open = {
            menu: menu,
            btn: btn,
            host: host,
            layer: K.pushLayer(function () {
                K.closeMenu(true);
            }),
        };
        if (items[0]) items[0].focus();
        menu.addEventListener('keydown', function (ev) {
            keys(ev, items);
        });
    };
}
return String(kennelsMenu);
