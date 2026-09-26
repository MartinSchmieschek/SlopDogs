/**
 * YouTube-Embed braucht enablejsapi=1 (und origin) für die IFrame Player API.
 */
export function ensureYoutubeIframeApiParams(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    if (!u.hostname.includes('youtube.com') || !u.pathname.includes('/embed/')) {
      return embedUrl;
    }
    u.searchParams.set('enablejsapi', '1');
    if (typeof window !== 'undefined' && window.location?.origin) {
      u.searchParams.set('origin', window.location.origin);
    }
    return u.toString();
  } catch {
    return embedUrl;
  }
}

/** YouTube PlayerState — ENDED = 0 */
const YT_ENDED = 0;

type YTApi = {
  Player: new (
    target: string | HTMLElement,
    options: { events?: { onStateChange?: (e: { data: number }) => void } }
  ) => { destroy: () => void };
};

function getYT(): YTApi | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { YT?: YTApi }).YT ?? null;
}

let iframeApiPromise: Promise<void> | null = null;

/** Lädt iframe_api einmalig; resolved wenn YT.Player nutzbar ist. */
export function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (getYT()?.Player) return Promise.resolve();

  iframeApiPromise ??= new Promise<void>((resolve, reject) => {
    const tryResolve = (): boolean => {
      if (getYT()?.Player) {
        resolve();
        return true;
      }
      return false;
    };

    if (tryResolve()) return;

    const w = window as unknown as { onYouTubeIframeAPIReady?: () => void };
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      tryResolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('YouTube iframe_api'));
      document.head.appendChild(tag);
    }

    const poll = window.setInterval(() => {
      if (tryResolve()) window.clearInterval(poll);
    }, 40);
    window.setTimeout(() => window.clearInterval(poll), 12000);
  });

  return iframeApiPromise;
}

/**
 * Bestehendes Embed-iframe mit API verbinden; bei Videoende Callback.
 */
export async function bindYoutubePlayerEnded(
  iframeOrId: HTMLElement | string,
  onEnded: () => void
): Promise<{ destroy: () => void } | null> {
  await loadYoutubeIframeApi();
  const YT = getYT();
  if (!YT?.Player) return null;

  const player = new YT.Player(iframeOrId, {
    events: {
      onStateChange: (e: { data: number }) => {
        if (e.data === YT_ENDED) onEnded();
      },
    },
  });

  return player;
}
