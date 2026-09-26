import { API_ORIGIN_INJECTED, API_PREFER_DELIVERY_ORIGIN } from './api-base.inject';

/**
 * Basis für absolute Links (Swagger, window.open). HttpClient nutzt weiter `/api/…` (Proxy bei `ng serve`).
 *
 * **Integration/Production-UI-Build** (`API_PREFER_DELIVERY_ORIGIN` aus inject-ui-api-base.cjs): immer
 * **Auslieferungs-Origin** (`window.location.origin`), außer `PUBLIC_API_BASE_URL` zeigt auf einen
 * **anderen Hostnamen**. Nicht `isDevMode()` — das kann im gebündelten SPA noch true sein.
 *
 * **Development**: gleicher Hostname, anderer Port (ng serve vs Express) → injizierte Backend-URL.
 */
function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function parseInjectedOrigin(raw: string): URL | null {
  try {
    return new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

export function getApiOrigin(): string {
  const raw = API_ORIGIN_INJECTED.trim();

  if (typeof window === 'undefined') {
    return raw ? stripTrailingSlashes(raw) : 'http://localhost:3000';
  }

  const pageUrl = new URL(window.location.href);
  const pageOrigin = stripTrailingSlashes(pageUrl.origin);

  // ── Integration & Production (Build-Zeit-Flag): Basis = Auslieferungs-URL ──
  if (API_PREFER_DELIVERY_ORIGIN) {
    if (!raw) return pageOrigin;
    const injectedUrl = parseInjectedOrigin(raw);
    if (!injectedUrl) return pageOrigin;
    const injHost = injectedUrl.hostname;
    const pageHost = pageUrl.hostname;
    if (isLocalDevHostname(injHost) && !isLocalDevHostname(pageHost)) {
      return pageOrigin;
    }
    if (injHost !== pageHost) {
      return stripTrailingSlashes(injectedUrl.origin);
    }
    return pageOrigin;
  }

  // ── Development: ng serve vs Express (gleicher Host, anderer Port) ──
  if (!raw) {
    return pageOrigin;
  }

  const injectedUrl = parseInjectedOrigin(raw);
  if (!injectedUrl) {
    return pageOrigin;
  }

  const injHost = injectedUrl.hostname;
  const pageHost = pageUrl.hostname;

  if (isLocalDevHostname(injHost) && !isLocalDevHostname(pageHost)) {
    return pageOrigin;
  }

  if (injHost === pageHost) {
    return stripTrailingSlashes(injectedUrl.origin);
  }

  return stripTrailingSlashes(injectedUrl.origin);
}

export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
