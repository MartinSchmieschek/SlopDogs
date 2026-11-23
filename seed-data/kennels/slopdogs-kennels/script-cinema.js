// SlopDogs kennel list · script: void cinema. The iris on the veil opens the loading video, a click on the error
// text the error video (sd-void-cinema): YouTube in a frame, whisper lines from the last verse, closed by a click
// anywhere, Esc, or the end of the video (IFrame API, loaded on first use; without it closing stays manual).
function kennelsCinema(K) {
    var CFG = K.CFG,
        COPY = K.COPY,
        $ = K.$,
        d = K.d,
        api = null;
    function youtube() {
        if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
        if (api) return api;
        api = new Promise(function (resolve, reject) {
            var prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = function () {
                if (prev) prev();
                resolve(window.YT);
            };
            var tag = d.createElement('script');
            tag.src = CFG.cinema.api;
            tag.async = true;
            tag.onerror = function () {
                api = null;
                reject(new Error('YouTube iframe_api'));
            };
            d.head.appendChild(tag);
        });
        return api;
    }
    K.openCinema = function (kind) {
        var box = $('template[data-tpl="cinema"]').content.firstElementChild.cloneNode(true),
            frame = $('#cinema-yt', box),
            v = K.lastVerse(),
            lines = v ? [v.keyword, v.line1, v.line2] : COPY.whispers,
            url = new URL(kind === 'error' ? CFG.cinema.error : CFG.cinema.loading),
            opener = d.activeElement,
            player = null,
            layer = null;
        url.searchParams.set('enablejsapi', '1');
        url.searchParams.set('origin', location.origin);
        frame.src = url.toString();
        box.setAttribute('aria-label', COPY.cinemaHead);
        $('[data-v="head"]', box).textContent = COPY.cinemaHead;
        lines.forEach(function (line) {
            var p = d.createElement('p');
            p.textContent = line;
            $('[data-v="lines"]', box).appendChild(p);
        });
        function close() {
            if (!layer) return;
            K.popLayer(layer);
            layer = null;
            try {
                if (player) player.destroy();
            } catch {
                /* already gone */
            }
            box.remove();
            if (opener && opener.focus && d.contains(opener)) opener.focus();
        }
        box.addEventListener('click', close);
        d.body.appendChild(box);
        layer = K.pushLayer(close);
        $('[data-v="x"]', box).focus();
        youtube().then(
            function (YT) {
                if (!layer) return;
                player = new YT.Player('cinema-yt', {
                    events: {
                        onStateChange: function (e) {
                            if (e.data === 0) close();
                        },
                    },
                });
            },
            function () {},
        );
    };
}
return String(kennelsCinema);
