// SlopDogs kennel list · script: auth. Fills the auth slot from /auth/me: anonymous gets Sign in
// (/login?returnTo=here) and the sign-in hint; signed in gets the avatar with the account menu (Account, Keys,
// Sign out); local mode shows "local" without sign in or out. Favorites and + New sign in through Google directly.
function kennelsAuth(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY,
        $ = K.$,
        $$ = K.$$,
        d = K.d,
        shown = null;
    function here() {
        return location.pathname + location.search;
    }
    K.login = function (returnTo) {
        location.assign(CFG.google + encodeURIComponent(returnTo));
    };
    K.renderAuth = function () {
        var key = [S.ready, S.user && S.user.id, S.mode].join('|');
        $('#signin-hint').hidden = !S.ready || !!S.user || S.mode === 'local' || !!S.error;
        $('#signin-hint-link').href = CFG.login + encodeURIComponent(here());
        if (key === shown) return;
        shown = key;
        var who = $('#who');
        who.textContent = '';
        $$('[data-auth-only]').forEach(function (el) {
            el.hidden = !S.user;
        });
        if (!S.ready) return;
        if (!S.user) {
            var a = d.createElement('a');
            a.className = 'sd-btn sd-btn--sm';
            a.textContent = COPY.signIn;
            a.href = CFG.login + encodeURIComponent(here());
            who.appendChild(a);
            return;
        }
        var name = S.user.name || S.user.email || 'local';
        var b = d.createElement('button');
        b.type = 'button';
        b.className = 'sd-btn sd-btn--bare trigger';
        b.dataset.act = 'account';
        b.setAttribute('aria-haspopup', 'menu');
        b.setAttribute('aria-expanded', 'false');
        b.setAttribute('aria-label', 'Account: ' + name);
        b.innerHTML =
            '<span class="avatar" aria-hidden="true"></span><span class="uname"></span><span class="caret" aria-hidden="true">▾</span>';
        b.querySelector('.avatar').textContent = name.charAt(0).toUpperCase();
        b.querySelector('.uname').textContent = name;
        who.appendChild(b);
    };
    function item(tag, text, href) {
        var el = d.createElement(tag);
        el.setAttribute('role', 'menuitem');
        el.tabIndex = -1;
        el.textContent = text;
        if (href) el.href = href;
        else el.type = 'button';
        return el;
    }
    K.accountMenu = function (btn) {
        if (K.menuOpenFor(btn)) return K.closeMenu(true);
        var m = d.createElement('div');
        m.className = 'menu sd-lift sd-rise';
        m.setAttribute('role', 'menu');
        m.setAttribute('aria-label', COPY.account);
        var note = d.createElement('p');
        note.className = 'note sd-small';
        note.textContent = S.mode === 'local' ? COPY.local : S.user.email || '';
        m.appendChild(note);
        m.appendChild(item('a', COPY.account, '/account'));
        m.appendChild(item('a', COPY.keys, '/account?tab=keys'));
        if (S.mode !== 'local') {
            var sep = d.createElement('div');
            sep.setAttribute('role', 'separator');
            m.appendChild(sep);
            var out = item('button', COPY.signOut);
            out.addEventListener('click', function () {
                K.closeMenu(false);
                K.API.logout().then(
                    function () {
                        location.assign('/kennels');
                    },
                    function () {
                        location.assign('/kennels');
                    },
                );
            });
            m.appendChild(out);
        }
        K.mountMenu(btn, m, btn);
    };
}
return String(kennelsAuth);
