/**
 * Die Routentabelle als Code — eine Quelle fuer Express, SPA-Handkopie, Doc-Lint und StartupTest.
 *
 * Vier Namensraeume (docs/slopdogs/PLAN.md, 2.1):
 *   /k/…      Ware       — oeffentlich, teilbar, content-type-ehrlich
 *   /api/…    Werkstatt  — CRUD, Laeufe, Export/Import, WebSocket-Hub
 *   /kennels… Buehne     — Angular-SPA (Handkopie: ui-app/src/app/app.routes.ts)
 *   /         Schaufenster
 *
 * Die Handler registrieren AUS dieser Tabelle; `scripts/check-doc-paths.cjs` prueft jeden Pfad in
 * den Texten fuer Agenten und Menschen dagegen; `testRouteTableMatchesExpressStack` prueft, dass
 * Express genau diese Routen kennt. Eine neue Route ohne Tabelleneintrag ist ein Fehler.
 */

/** Ware: der oeffentliche Lauf, seine Doku, seine Spec. */
export const PUBLIC_ROUTE = {
    kennel: '/k/:id',
    docs: '/k/:id/docs',
    openapi: '/k/:id/openapi.json',
} as const;
export const PUBLIC_ROUTES = [PUBLIC_ROUTE.kennel, PUBLIC_ROUTE.docs, PUBLIC_ROUTE.openapi] as const;

/** Buehne: Angular-Routen (`/dogs` seit P6 U5; `/account`, `/login` seit U7; kein `/dogs/:id`, 8.21). */
export const SPA_ROUTES = ['/kennels', '/kennels/:id', '/kennels/:id/edit', '/dogs', '/account', '/login'] as const;

/**
 * Werkstatt, generisch: ConfigRouteHandler bedient kennels und nodes ueber `:subpath`.
 * Die konkreten Formen stehen in API_ROUTES.
 */
export const CONFIG_ROUTE = {
    list: '/api/:subpath',
    byId: '/api/:subpath/:id',
    versions: '/api/:subpath/:id/versions',
    rename: '/api/:subpath/:id/rename',
} as const;

/** Werkstatt, Rechte (P3.5, AclRouteHandler) — fuer kennels und nodes ueber `:subpath`. */
export const ACL_ROUTE = {
    acl: '/api/:subpath/:id/acl',
    transfer: '/api/:subpath/:id/acl/transfer',
    freeze: '/api/:subpath/:id/freeze',
    unfreeze: '/api/:subpath/:id/unfreeze',
} as const;

/** Werkstatt, Einzelrouten mit eigenem Handler. */
export const API_ROUTE = {
    kennelRun: '/api/kennels/:id/run',
    kennelExecute: '/api/kennels/:id/execute',
    /** Sterne (P4): GET/PUT/DELETE. */
    kennelRating: '/api/kennels/:id/rating',
    /** Ranglisten fuer die Landing (P4), vor ConfigRouteHandler registriert. */
    landing: '/api/landing',
    kennelExport: '/api/kennels/:id/export',
    kennelImport: '/api/kennels/import',
    nodesList: '/api/nodes',
    /** Wo ein Dog laeuft (P4b): Kennels, Abhaengige, Abhaengigkeiten — vor ConfigRouteHandler registriert. */
    nodeUsage: '/api/nodes/:id/usage',
    readme: '/api/readme',
    /** Key-Store (P4c): GET (maskiert) und POST — vor ConfigRouteHandler registriert. */
    keys: '/api/keys',
    /** Key-Store (P4c): DELETE; kein GET mit Wert. */
    keyByAlias: '/api/keys/:alias',
    /** Beta (2026-09-26): Status fuer alle — vor ConfigRouteHandler registriert. */
    beta: '/api/beta',
    /** Beta-Keys: GET (maskiert) und POST (Klartext einmal) — nur Admins. */
    betaKeys: '/api/beta/keys',
    /** Beta-Key widerrufen. */
    betaKeyById: '/api/beta/keys/:id',
    /** WebSocket-Upgrade am http.Server (ChannelHub), keine Express-Route. */
    channels: '/api/channels',
} as const;

/** Jede /api-Route in ihrer dokumentierten Form (2.2). Wird je Phase ergaenzt. */
export const API_ROUTES = [
    '/api/kennels',
    '/api/kennels/import',
    '/api/kennels/:id',
    '/api/kennels/:id/versions',
    '/api/kennels/:id/rename',
    '/api/kennels/:id/acl',
    '/api/kennels/:id/acl/transfer',
    '/api/kennels/:id/freeze',
    '/api/kennels/:id/unfreeze',
    '/api/kennels/:id/export',
    '/api/kennels/:id/run',
    '/api/kennels/:id/execute',
    '/api/kennels/:id/rating',
    '/api/nodes',
    '/api/nodes/:id',
    '/api/nodes/:id/versions',
    '/api/nodes/:id/rename',
    '/api/nodes/:id/acl',
    '/api/nodes/:id/acl/transfer',
    '/api/nodes/:id/freeze',
    '/api/nodes/:id/unfreeze',
    '/api/nodes/:id/usage',
    '/api/readme',
    '/api/landing',
    '/api/keys',
    '/api/keys/:alias',
    '/api/beta',
    '/api/beta/keys',
    '/api/beta/keys/:id',
    '/api/channels',
] as const;

/** Alte Pfade, die mit 308 auf ihre neue Adresse zeigen. */
export const LEGACY_ROUTE = {
    docs: '/api/kennels/:id/docs',
    swagger: '/api/kennels/:id/swagger.json',
    /** Alt-Weiche hinter LEGACY_KENNEL_REDIRECT: `/:name` -> `/k/:name`. */
    kennel: '/:name',
} as const;
export const LEGACY_308 = [LEGACY_ROUTE.docs, LEGACY_ROUTE.swagger, LEGACY_ROUTE.kennel] as const;

/** Schaufenster und Legacy-POST auf App-Ebene. */
export const ROOT_ROUTE = {
    landing: '/',
    robots: '/robots.txt',
    legacySave: '/save',
} as const;

/**
 * Maschinenzugang, Auth, Meta — als Router gemountet (Express-Stack sieht nur Middleware).
 * Nur fuer den Doc-Lint; die Router pflegen ihre Pfade selbst.
 */
export const MOUNTED_ROUTES = [
    '/mcp',
    '/actions/openapi.json',
    '/actions/gpt-template',
    '/actions/:tool',
    '/auth/authorize',
    '/auth/token',
    '/auth/revoke',
    '/auth/register',
    '/auth/tokens',
    '/auth/tokens/:jti/revoke',
    '/auth/google/login',
    '/auth/google/callback',
    '/auth/me',
    '/auth/logout',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/static/*',
] as const;

/**
 * Was Express nach dem Aufbau als Route (nicht Middleware) kennen muss — mit den Pfad-Mustern,
 * so wie sie registriert werden. `/` und `/robots.txt` haengen am Frontend-Binder (umgebungsabhaengig).
 */
export const EXPRESS_APP_ROUTES = [
    ...PUBLIC_ROUTES,
    ...Object.values(CONFIG_ROUTE),
    ...Object.values(ACL_ROUTE),
    API_ROUTE.kennelRun,
    API_ROUTE.kennelExecute,
    API_ROUTE.kennelRating,
    API_ROUTE.kennelExport,
    API_ROUTE.kennelImport,
    API_ROUTE.nodesList,
    API_ROUTE.nodeUsage,
    API_ROUTE.readme,
    API_ROUTE.landing,
    API_ROUTE.keys,
    API_ROUTE.keyByAlias,
    API_ROUTE.beta,
    API_ROUTE.betaKeys,
    API_ROUTE.betaKeyById,
    ...LEGACY_308,
    ROOT_ROUTE.legacySave,
] as const;

/** Frontend-Binder-Routen: erscheinen je nach Umgebung zusaetzlich im Stack. */
export const FRONTEND_ROUTES = [ROOT_ROUTE.landing, ROOT_ROUTE.robots] as const;

/** Alle Pfade, die ein Text nennen darf (Doc-Lint). Alt-Pfade nur in Zeilen, die `308` oder `legacy` sagen. */
export const DOCUMENTED_ROUTES = [
    ...PUBLIC_ROUTES,
    ...SPA_ROUTES,
    ...API_ROUTES,
    ...MOUNTED_ROUTES,
    ROOT_ROUTE.robots,
    ROOT_ROUTE.legacySave,
] as const;
