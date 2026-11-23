// SlopDogs kennel list · states. HTML of the sign-in hint, the error banner (its text opens the void cinema, as
// sd-banner does), and the stage: the list, the skeleton slot, the veil with the tape deck (the left hub is the
// iris), the empty slot, the sentinel for paging, the status line and the version line (SlopdogsKennelsScriptVersion).
var deck =
    '<svg viewBox="0 0 96 56" width="96" height="56" aria-hidden="true">' +
    '<rect x="1" y="1" width="94" height="54" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2"/>' +
    '<rect x="14" y="10" width="68" height="36" fill="none" stroke="var(--ink)" stroke-width="1"/>' +
    '<path d="M30 44 L66 44" stroke="var(--ink)" stroke-width="1"/>' +
    '<g class="reel"><circle cx="30" cy="28" r="14" fill="var(--paper)" stroke="var(--ink)" stroke-width="2"/>' +
    '<path d="M30 17v6M20.5 33.5l5.2-3M39.5 33.5l-5.2-3" stroke="var(--ink)" stroke-width="2"/></g>' +
    '<g class="reel"><circle cx="66" cy="28" r="14" fill="var(--paper)" stroke="var(--ink)" stroke-width="2"/>' +
    '<path d="M66 17v6M56.5 33.5l5.2-3M75.5 33.5l-5.2-3" stroke="var(--ink)" stroke-width="2"/>' +
    '<circle cx="66" cy="28" r="4" fill="var(--ink)"/></g></svg>';
var iris =
    '<button type="button" class="iris" aria-label="void" data-act="iris">' +
    '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="var(--ink)"/></svg></button>';
return [
    '<div class="banner" id="signin-hint" role="status" hidden>',
    '<span class="t">You see the public kennels. Sign in to keep favorites and start your own.</span>',
    '<span class="a"><a class="sd-btn sd-btn--sm" id="signin-hint-link" href="/login?returnTo=%2Fkennels">Sign in</a></span></div>',
    '<div class="banner danger" id="error" role="alert" hidden>',
    '<span class="t cue" id="error-text" role="button" tabindex="0" title="Distant signal" data-act="cinema"></span>',
    '<span class="a"><button type="button" class="sd-btn sd-btn--sm" data-act="retry">Retry</button></span></div>',
    '<div class="stage" id="stage">',
    '<div class="list" id="list" role="list" aria-label="Kennels" aria-busy="false"></div>',
    '<div id="skeleton" aria-hidden="true" hidden></div>',
    '<div class="veil" id="veil" role="status" aria-live="polite" hidden>',
    '<div class="deck">' + deck + iris + '</div>',
    '<p class="head"><span class="lbl">Waking the kennel</span><span class="timer" id="veil-clock">0:03</span></p>',
    '<div class="prog" aria-hidden="true"><span id="veil-prog" style="width:0"></span></div>',
    '<p class="note" id="veil-hint" hidden>Cold starts take up to two minutes.</p>',
    '<p class="note" id="veil-cold" hidden>Still cold. Try again, or come back in a minute.</p>',
    '<button type="button" class="sd-btn sd-btn--sm" data-act="retry" id="veil-retry" hidden>Retry</button>',
    '<p class="verse" id="veil-verse"></p></div>',
    '<div id="empty"></div><div id="sentinel" aria-hidden="true"></div>',
    '<p class="status sd-small" id="status" aria-live="polite"></p>',
    '<p class="status sd-small" id="ver" style="padding-top:0" hidden></p>',
    '</div>',
].join('');
