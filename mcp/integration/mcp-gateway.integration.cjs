/**
 * MCP gateway integration test (POST /mcp).
 *
 * Voraussetzung: API läuft (z. B. npm run dev / start:integration).
 *
 *   node mcp/integration/mcp-gateway.integration.cjs
 *   npm run test:mcp:integration
 *
 * Env:
 *   MCP_BASE   — Default http://127.0.0.1:3000
 *   MCP_PATH   — Default /mcp
 *   MCP_BEARER — optional (MCP_AUTH_REQUIRED / Integration)
 *   KENNEL_ID  — Default weather-kennel (Snapshot + execute)
 *
 * Lokal gegen einen Test-Server auf anderem Port: MCP_BASE=http://127.0.0.1:3099 npm run test:mcp:integration
 */
'use strict';

const http = require('http');
const https = require('https');

const MCP_BASE = (process.env.MCP_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const MCP_PATH = process.env.MCP_PATH || '/mcp';
const KENNEL_ID = process.env.KENNEL_ID || 'weather-kennel';
const bearer = process.env.MCP_BEARER || process.env.SLOPDOGS_MCP_BEARER || process.env.DATADOGS_MCP_BEARER || '';

const REQUIRED_TOOLS = [
  'health_check',
  'get_readme',
  'describe_tool',
  'list_kennels',
  'list_nodes',
  'execute_kennel',
  'refresh_kennel_snapshot',
  'wait_for_kennel_snapshot',
  'get_kennel_snapshot_lead_result',
  'get_snapshot_errors',
  // P3.5 Rechte v2
  'grant_access',
  'freeze_entity',
  'unfreeze_entity',
  // Fix-Runde: Dogs loeschen (Lineage oder Version)
  'delete_node',
  // P4c Key-Store (kein Lese-Werkzeug, niemals)
  'set_key',
  'list_keys',
  'delete_key',
];

/**
 * Alte Muster, die ein Agent nicht mehr lesen darf — dieselbe Negativliste wie der Doc-Lint
 * (scripts/check-doc-paths.cjs); Zeilen, die 308/legacy/alias/deprecated sagen, sind erlaubt.
 */
const NEGATIVE_ALLOWED_LINE = /308|legacy|alias|deprecated/i;
const NEGATIVE = [/\/:kennelId\b/, /datadogs:\/\//i, /\bDATADOGS_[A-Z_]+/, /\bdataDogs\b/, /localhost:4300\/kennel\//, /(^|[^A-Za-z0-9_-])\/kennel\//i];

function negativeHits(text) {
  const hits = [];
  String(text || '').split(/\r?\n/).forEach((line, idx) => {
    if (NEGATIVE_ALLOWED_LINE.test(line)) return;
    for (const re of NEGATIVE) if (re.test(line)) hits.push(`${idx + 1}: ${line.trim().slice(0, 80)}`);
  });
  return hits;
}

let rpcId = 0;
const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function parseSseJson(raw) {
  const lines = raw.split(/\r?\n/);
  const dataLines = lines.filter((l) => l.startsWith('data:'));
  if (dataLines.length === 0) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const last = dataLines[dataLines.length - 1].replace(/^data:\s*/, '');
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

function toolTextContent(envelope) {
  const content = envelope?.result?.content;
  if (!Array.isArray(content) || !content[0]) return null;
  const block = content[0];
  if (block.type !== 'text') return null;
  const t = block.text;
  if (typeof t !== 'string') return t;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** `anonymous: true` schickt keinen Bearer — fuer die 401-Probe (P3.5 T7). */
function mcpRequest(method, params, { anonymous = false } = {}) {
  const id = ++rpcId;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const u = new URL(MCP_PATH.replace(/^\//, ''), MCP_BASE + '/');
  const lib = u.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(body),
          ...(bearer && !anonymous ? { Authorization: 'Bearer ' + bearer } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, raw, envelope: parseSseJson(raw) });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Ein GET ohne Umleitungen zu folgen — fuer die Alt-Weiche (308) und /k/:id. */
function httpGet(pathAndQuery) {
  const u = new URL(pathAndQuery, MCP_BASE + '/');
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, raw }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Ein POST mit JSON-Rumpf (mit Bearer) — fuer /actions/<tool>. */
function httpPostJson(pathAndQuery, payload) {
  const u = new URL(pathAndQuery, MCP_BASE + '/');
  const lib = u.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch { /* kein JSON */ }
          resolve({ status: res.statusCode, raw, json });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function mcpCall(toolName, args = {}) {
  const { status, raw, envelope } = await mcpRequest('tools/call', {
    name: toolName,
    arguments: args,
  });
  if (status !== 200) {
    throw new Error(`${toolName}: HTTP ${status} — ${raw.slice(0, 400)}`);
  }
  if (!envelope) {
    throw new Error(`${toolName}: no JSON in response — ${raw.slice(0, 400)}`);
  }
  if (envelope.error) {
    throw new Error(`${toolName}: ${JSON.stringify(envelope.error)}`);
  }
  if (envelope.result?.isError) {
    const t = toolTextContent(envelope);
    throw new Error(`${toolName}: tool error — ${typeof t === 'string' ? t : JSON.stringify(t)}`);
  }
  return toolTextContent(envelope);
}

/** Ein Werkzeug-Aufruf, der den Fehlertext zurueckgibt statt zu werfen — fuer erwartete Fehler. */
async function mcpCallRaw(toolName, args = {}) {
  const { status, raw, envelope } = await mcpRequest('tools/call', { name: toolName, arguments: args });
  return { status, raw, isError: !!envelope?.result?.isError, value: toolTextContent(envelope) };
}

/** Ein Dog-Kennel per build_kennel, einmal ausgefuehrt, danach geloescht; liefert die rohen Antworten. */
async function runProbeKennel(id, tsCode) {
  const raws = [];
  try {
    const built = await mcpCallRaw('build_kennel', { id, name: id, refresh: false, dogs: [{ displayName: 'P4cProbe', tsCode }] });
    raws.push(built.raw);
    if (built.isError) throw new Error(`build_kennel: ${String(built.value).slice(0, 200)}`);
    const exec = await mcpCallRaw('execute_kennel', { id });
    raws.push(exec.raw);
    if (exec.isError) throw new Error(`execute_kennel: ${String(exec.value).slice(0, 200)}`);
    return { result: exec.value, raws };
  } finally {
    try { raws.push((await mcpCallRaw('delete_kennel', { id })).raw); } catch { /* best effort */ }
  }
}

async function keyStoreChecks(toolNames) {
  const readers = toolNames.filter((n) => /^(get|read|show|reveal)_?keys?$/.test(n));
  if (readers.length) fail('keys: no read tool', `tools/list carries ${readers.join(', ')}`);
  else pass('keys: no read tool', `${toolNames.filter((n) => /_keys?$/.test(n)).join(', ')}`);

  const secret = `p4c-it-${require('crypto').randomBytes(16).toString('hex')}`;
  const alias = 'p4cgateway';
  const raws = [];
  try {
    const set = await mcpCallRaw('set_key', { alias, secret, allowedDomains: ['httpbin.org'] });
    raws.push(set.raw);
    if (!bearer) {
      if (set.isError && /^no_identity/.test(String(set.value))) pass('set_key', 'no_identity — super-user mode (dev), T11 needs MCP_BEARER');
      else fail('set_key', `super-user without identity: ${String(set.raw).slice(0, 160)}`);
      return;
    }
    if (set.isError || set.value?.key?.last4 !== secret.slice(-4)) {
      fail('set_key', String(set.raw).slice(0, 200));
      return;
    }
    pass('set_key', `alias ${alias}, last4 ${set.value.key.last4}`);

    const list = await mcpCallRaw('list_keys', {});
    raws.push(list.raw);
    const mine = (list.value?.keys || []).find((k) => k.alias === alias);
    if (!mine || mine.last4 !== secret.slice(-4) || 'secret' in mine) fail('list_keys', String(list.raw).slice(0, 200));
    else pass('list_keys', `masked (last4 ${mine.last4}, domains ${mine.allowedDomains.join(',')})`);

    const dog = [
      `const r = await keys.fetch('https://httpbin.org/anything?k={{key:${alias}}}', { headers: { Authorization: 'Bearer {{key:${alias}}}' } });`,
      'let echoed = null;',
      'try { echoed = JSON.parse(r.body).headers.Authorization; } catch (e) { echoed = String(r.body).slice(0, 80); }',
      'console.log("p4c-gateway echo", echoed);',
      'return { status: r.status, echoed };',
    ].join('\n');
    const run = await runProbeKennel(`p4c-gateway-${Date.now()}`, dog);
    raws.push(...run.raws);
    if (run.result?.status !== 200) fail('keys.fetch via execute_kennel', JSON.stringify(run.result).slice(0, 200));
    else if (run.result.echoed !== 'Bearer [redacted:key]') fail('keys.fetch via execute_kennel', `echo ${run.result.echoed}`);
    else pass('keys.fetch via execute_kennel', `status 200, upstream echo = ${run.result.echoed}`);
  } catch (e) {
    fail('keys', e.message);
  } finally {
    try { raws.push((await mcpCallRaw('delete_key', { alias })).raw); } catch { /* best effort */ }
    const leaks = raws.filter((r) => [secret, encodeURIComponent(secret)].some((s) => String(r).includes(s)));
    if (leaks.length) fail('keys: no plaintext in responses', `${leaks.length} response(s) carry the value`);
    else pass('keys: no plaintext in responses', `${raws.length} responses clean`);
  }
}

async function egressChecks() {
  const targets = ['http://127.0.0.1:9/', 'http://169.254.169.254/latest/meta-data/'];
  const dog = [
    'const out = {};',
    `for (const u of ${JSON.stringify(targets)}) { try { const r = await fetch(u); out[u] = 'reached ' + r.status; } catch (e) { out[u] = String(e.message); } }`,
    "try { out.public = (await fetch('https://example.com/')).status; } catch (e) { out.public = String(e.message); }",
    'return out;',
  ].join('\n');
  try {
    const { result } = await runProbeKennel(`p4c-egress-${Date.now()}`, dog);
    const open = targets.filter((t) => !String(result?.[t]).startsWith('egress_blocked'));
    if (open.length) fail('egress blocklist', open.map((t) => `${t} -> ${result?.[t]}`).join(' | '));
    else if (result?.public !== 200) fail('egress blocklist', `public target: ${result?.public}`);
    else pass('egress blocklist', `127.0.0.1 + 169.254.169.254 blocked, example.com ${result.public}`);
  } catch (e) {
    fail('egress blocklist', e.message);
  }
}

function shallowEqualLead(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ca = a.current;
  const cb = b.current;
  if (!ca || !cb) return false;
  return ca.temperature === cb.temperature && ca.weatherCode === cb.weatherCode;
}

async function run() {
  console.log(`MCP integration → ${MCP_BASE}${MCP_PATH.startsWith('/') ? '' : '/'}${MCP_PATH}`);
  console.log(`Kennel probe: ${KENNEL_ID}\n`);

  // initialize
  try {
    const { status, envelope } = await mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-gateway.integration', version: '1.0' },
    });
    if (status !== 200) {
      fail('initialize', `HTTP ${status}`);
    } else if (!envelope?.result?.serverInfo) {
      fail('initialize', 'missing serverInfo');
    } else {
      const si = envelope.result.serverInfo;
      if (si.name === 'slopdogs') pass('initialize', `${si.name} ${si.version}`);
      else fail('initialize', `serverInfo.name ${si.name} (expected slopdogs)`);
      const instructions = String(envelope.result.instructions || '');
      if (instructions.includes('slopdogs://skill')) pass('initialize instructions', 'names slopdogs://skill');
      else fail('initialize instructions', 'slopdogs://skill missing');
    }
  } catch (e) {
    fail('initialize', e.message);
    throw e;
  }

  // resources: slopdogs://skill + deprecated alias datadogs://skill, same text
  try {
    const { status, envelope } = await mcpRequest('resources/list', {});
    const uris = (envelope?.result?.resources || []).map((r) => r.uri);
    if (status !== 200) {
      fail('resources/list', `HTTP ${status}`);
    } else if (!uris.includes('slopdogs://skill') || !uris.includes('datadogs://skill')) {
      fail('resources/list', `uris: ${uris.join(', ')}`);
    } else {
      pass('resources/list', uris.join(', '));
    }
    const texts = [];
    for (const uri of ['slopdogs://skill', 'datadogs://skill']) {
      const read = await mcpRequest('resources/read', { uri });
      texts.push(read.envelope?.result?.contents?.[0]?.text ?? null);
    }
    if (!texts[0] || texts[0] !== texts[1]) fail('resources/read', 'alias text differs or empty');
    else pass('resources/read', `${texts[0].length} chars, alias identical`);
    const stale = negativeHits(texts[0]);
    if (stale.length) fail('resources/read paths', `old patterns: ${stale.slice(0, 3).join(' | ')}`);
    else pass('resources/read paths', 'no old patterns');
  } catch (e) {
    fail('resources', e.message);
  }

  // tools/list
  let toolNames = [];
  try {
    const { status, envelope } = await mcpRequest('tools/list', {});
    if (status !== 200 || !envelope?.result?.tools) {
      fail('tools/list', `HTTP ${status}`);
    } else {
      toolNames = envelope.result.tools.map((t) => t.name);
      pass('tools/list', `${toolNames.length} tools`);
      const missing = REQUIRED_TOOLS.filter((n) => !toolNames.includes(n));
      if (missing.length) {
        fail('tools/list required', `missing: ${missing.join(', ')}`);
      } else {
        pass('tools/list required', REQUIRED_TOOLS.length + ' core tools');
      }
    }
  } catch (e) {
    fail('tools/list', e.message);
  }

  // health_check
  try {
    const h = await mcpCall('health_check', {});
    if (h?.ok !== true) fail('health_check', JSON.stringify(h));
    else pass('health_check', h.serverTime || 'ok');
  } catch (e) {
    fail('health_check', e.message);
  }

  // get_readme
  try {
    const readme = await mcpCall('get_readme', {});
    if (typeof readme !== 'string' || readme.length < 200) {
      fail('get_readme', 'too short or not text');
    } else {
      pass('get_readme', `${readme.length} chars`);
    }
  } catch (e) {
    fail('get_readme', e.message);
  }

  // describe_tool
  try {
    const d = await mcpCall('describe_tool', { name: 'execute_kennel' });
    if (!d?.name || !d?.inputSchema) fail('describe_tool', 'missing schema');
    else pass('describe_tool', d.name);
  } catch (e) {
    fail('describe_tool', e.message);
  }

  // list_kennels
  let kennels = [];
  try {
    kennels = await mcpCall('list_kennels', {});
    if (!Array.isArray(kennels)) fail('list_kennels', 'not an array');
    else pass('list_kennels', `${kennels.length} packs`);
  } catch (e) {
    fail('list_kennels', e.message);
  }

  const hasProbe = kennels.some((k) => k.lineageId === KENNEL_ID);
  if (kennels.length && !hasProbe) {
    fail('list_kennels probe', `${KENNEL_ID} not visible`);
  } else if (hasProbe) {
    pass('list_kennels probe', KENNEL_ID);
  }

  // list_nodes (first page)
  try {
    const nodes = await mcpCall('list_nodes', {});
    const total = nodes?.total ?? nodes?.nodes?.length;
    if (!nodes?.nodes?.length) fail('list_nodes', 'empty');
    else pass('list_nodes', `page ${nodes.nodes.length}, total ${total ?? '?'}`);
  } catch (e) {
    fail('list_nodes', e.message);
  }

  // P6 4.0: list_nodes carries `pack` like GET /api/nodes -- at least one BaseDog proves it.
  try {
    const nodes = await mcpCall('list_nodes', { type: 'BaseDog', limit: 200 });
    const packed = (nodes?.nodes ?? []).find((n) => typeof n.pack === 'string' && n.pack);
    if (!packed) fail('list_nodes pack', 'no BaseDog carries a pack field');
    else pass('list_nodes pack', `${packed.id} -> ${packed.pack}`);
  } catch (e) {
    fail('list_nodes pack', e.message);
  }

  // build_kennel: die Antwort nennt die Adressen unter /k/ (P3)
  const probeId = `gateway-probe-${Date.now()}`;
  try {
    const built = await mcpCall('build_kennel', {
      id: probeId,
      name: 'Gateway probe',
      refresh: false,
      dogs: [{ displayName: 'GatewayProbe', tsCode: 'return { probe: 1 };' }],
    });
    const urls = `${built?.publicUrl} ${built?.docsUrl} ${built?.openapiUrl}`;
    if (!built || typeof built !== 'object') {
      fail('build_kennel urls', typeof built === 'string' ? built.slice(0, 120) : 'no response');
    } else if (
      built.publicUrl === `/k/${probeId}`
      && /\/docs$/.test(String(built.docsUrl))
      && /\/openapi\.json$/.test(String(built.openapiUrl))
    ) {
      pass('build_kennel urls', urls);
    } else {
      fail('build_kennel urls', urls);
    }
  } catch (e) {
    fail('build_kennel urls', e.message);
  } finally {
    try {
      await mcpCall('delete_kennel', { id: probeId });
    } catch {
      /* Aufraeumen ist best effort */
    }
  }

  // Unbekannte Argumente werden abgewiesen, bevor das Werkzeug laeuft: build_kennel mit `dogIds` (gemeint:
  // extraDogIds) baute frueher still einen Kennel ohne das Gemeinte. MCP und /actions, derselbe Vorschlag.
  const strayId = `gateway-stray-${Date.now()}`;
  try {
    const stray = await mcpCallRaw('build_kennel', {
      id: strayId,
      refresh: false,
      dogIds: ['base:QueryRetriever'],
      dogs: [{ displayName: 'GatewayStray', tsCode: 'return 1;' }],
    });
    const text = String(stray.value);
    const after = await mcpCallRaw('get_kennel', { id: strayId });
    if (!stray.isError || !/"dogIds"/.test(text) || !/did you mean "extraDogIds"/.test(text)) fail('unknown args (mcp)', text.slice(0, 200));
    else if (!after.isError) fail('unknown args (mcp)', 'kennel was built anyway');
    else pass('unknown args (mcp)', text.slice(0, 90));

    const nested = await mcpCallRaw('list_kennels', { serch: 'x' });
    if (!nested.isError || !/did you mean "search"/.test(String(nested.value))) fail('unknown args typo', String(nested.value).slice(0, 160));
    else pass('unknown args typo', 'serch -> search');

    const action = await httpPostJson('/actions/build_kennel', { id: strayId, refresh: false, dogIds: ['base:QueryRetriever'], dogs: [] });
    const unknown = action.json?.unknown?.[0];
    if (action.status !== 400 || action.json?.error !== 'unknown_argument' || unknown?.field !== 'dogIds' || unknown?.suggestion !== 'extraDogIds') {
      fail('unknown args (/actions)', `HTTP ${action.status} ${action.raw.slice(0, 160)}`);
    } else pass('unknown args (/actions)', `400 unknown_argument, ${unknown.field} -> ${unknown.suggestion}`);
  } catch (e) {
    fail('unknown args', e.message);
  } finally {
    try { await mcpCallRaw('delete_kennel', { id: strayId }); } catch { /* best effort */ }
  }

  // execute_kennel mit einem Lead ohne Ergebnis: eine gueltige Antwort {result: null, hint}, kein Schemafehler.
  const emptyLeadId = `gateway-empty-lead-${Date.now()}`;
  try {
    const built = await mcpCallRaw('build_kennel', { id: emptyLeadId, refresh: false, dogs: [{ displayName: 'GatewayEmptyLead', tsCode: 'const nothing = 1;' }] });
    if (built.isError) throw new Error(`build_kennel: ${String(built.value).slice(0, 160)}`);
    const exec = await mcpRequest('tools/call', { name: 'execute_kennel', arguments: { id: emptyLeadId } });
    const value = toolTextContent(exec.envelope);
    if (exec.status !== 200 || exec.envelope?.error || exec.envelope?.result?.isError) fail('execute_kennel empty lead', exec.raw.slice(0, 200));
    else if (!value || value.result !== null || typeof value.hint !== 'string') fail('execute_kennel empty lead', JSON.stringify(value).slice(0, 160));
    else pass('execute_kennel empty lead', 'result null + hint');

    const thrower = await mcpCallRaw('build_kennel', { id: `${emptyLeadId}-throws`, refresh: false, dogs: [{ displayName: 'GatewayThrowingLead', tsCode: "throw new Error('gateway boom');" }] });
    if (thrower.isError) throw new Error(`build_kennel: ${String(thrower.value).slice(0, 160)}`);
    const boom = await mcpRequest('tools/call', { name: 'execute_kennel', arguments: { id: `${emptyLeadId}-throws` } });
    const boomValue = toolTextContent(boom.envelope);
    if (boom.status !== 200 || boom.envelope?.error) fail('execute_kennel throwing lead', boom.raw.slice(0, 200));
    else if (boom.envelope?.result?.isError ? !/gateway boom|Lead failed/.test(String(boomValue)) : boomValue?.result !== null) fail('execute_kennel throwing lead', JSON.stringify(boomValue).slice(0, 160));
    else pass('execute_kennel throwing lead', String(boom.envelope?.result?.isError ? boomValue : 'result null + hint').slice(0, 70));
  } catch (e) {
    fail('execute_kennel empty lead', e.message);
  } finally {
    for (const id of [emptyLeadId, `${emptyLeadId}-throws`]) {
      try { await mcpCallRaw('delete_kennel', { id }); } catch { /* best effort */ }
    }
  }

  // delete_node: eine Versions-GUID nimmt genau eine Version, die lineageId den ganzen Dog; ein zweites Loeschen
  // ist "not found" — kein roher Store-Text. /actions kennt das Werkzeug auch.
  let deleteProbe = null;
  try {
    const created = await mcpCall('create_node', { displayName: `GatewayDeleteProbe${Date.now()}`, tsCode: 'return 1;' });
    deleteProbe = created?.lineageId;
    const v1 = created?.id;
    await mcpCall('save_node', { id: deleteProbe, tsCode: 'return 2;' });
    const one = await mcpCall('delete_node', { id: v1 });
    const left = await mcpCall('get_node_versions', { id: deleteProbe });
    if (one?.scope !== 'version' || one?.versions !== 1 || !Array.isArray(left) || left.length !== 1) {
      fail('delete_node version', `${JSON.stringify(one)} -> ${Array.isArray(left) ? left.length : typeof left} left`);
    } else pass('delete_node version', `${v1} -> 1 version left`);
    const all = await httpPostJson('/actions/delete_node', { id: deleteProbe });
    if (all.status !== 200 || all.json?.result?.scope !== 'lineage') fail('delete_node lineage (/actions)', `HTTP ${all.status} ${all.raw.slice(0, 160)}`);
    else pass('delete_node lineage (/actions)', `scope lineage, ${all.json.result.versions} version(s)`);
    const again = await mcpCallRaw('delete_node', { id: deleteProbe });
    const text = String(again.value);
    if (!again.isError || !/not found/i.test(text) || /prisma|invocation/i.test(text)) fail('delete_node twice', text.slice(0, 160));
    else pass('delete_node twice', text.slice(0, 60));
    deleteProbe = null;
  } catch (e) {
    fail('delete_node', e.message);
  } finally {
    if (deleteProbe) {
      try { await mcpCallRaw('delete_node', { id: deleteProbe }); } catch { /* best effort */ }
    }
  }

  const query = { lat: '50.1109', lng: '8.6821' };

  // snapshot pipeline
  try {
    const refresh = await mcpCall('refresh_kennel_snapshot', { id: KENNEL_ID, query });
    if (refresh?.status !== 'running' && refresh?.status !== 'ok') {
      fail('refresh_kennel_snapshot', JSON.stringify(refresh));
    } else {
      pass('refresh_kennel_snapshot', refresh.status);
    }

    const waited = await mcpCall('wait_for_kennel_snapshot', { id: KENNEL_ID });
    if (!waited?.status || waited.status === 'running') {
      fail('wait_for_kennel_snapshot', JSON.stringify(waited));
    } else {
      pass('wait_for_kennel_snapshot', `${waited.status} (${waited.durationMs ?? '?'} ms)`);
    }

    const errors = await mcpCall('get_snapshot_errors', { id: KENNEL_ID });
    if (Array.isArray(errors) && errors.length > 0) {
      fail('get_snapshot_errors', `${errors.length} error(s)`);
    } else {
      pass('get_snapshot_errors', 'none');
    }

    const snapLead = await mcpCall('get_kennel_snapshot_lead_result', { id: KENNEL_ID });
    if (!snapLead?.leadResult?.current) {
      fail('get_kennel_snapshot_lead_result', 'no lead current');
    } else {
      pass(
        'get_kennel_snapshot_lead_result',
        `${snapLead.leadResult.current.temperature}°C ${snapLead.leadResult.current.weatherDescription || ''}`.trim(),
      );
    }

    const execLead = await mcpCall('execute_kennel', { id: KENNEL_ID, query });
    if (!execLead?.current) {
      fail('execute_kennel', 'no current');
    } else {
      pass('execute_kennel', `${execLead.current.temperature}°C`);
    }

    if (snapLead?.leadResult && execLead && !shallowEqualLead(snapLead.leadResult, execLead)) {
      fail('lead coherence', 'snapshot lead ≠ execute_kennel');
    } else if (snapLead?.leadResult && execLead) {
      pass('lead coherence', 'snapshot ≡ execute');
    }
  } catch (e) {
    fail('snapshot pipeline', e.message);
  }

  // P4 (11): der execute_kennel oben zaehlt sofort — die Liste addiert die ungeflushten Deltas.
  try {
    const byCalls = await mcpCall('list_kennels', { search: KENNEL_ID, sort: 'calls', dir: 'desc' });
    const probe = Array.isArray(byCalls) ? byCalls.find((k) => k.lineageId === KENNEL_ID) : null;
    if (!probe?.stats?.calls) fail('list_kennels stats', 'no stats on the probe');
    else if (probe.stats.calls.ranked >= 1) pass('list_kennels stats', `ranked ${probe.stats.calls.ranked}, ranked30d ${probe.stats.calls.ranked30d}, rating ${JSON.stringify(probe.stats.rating)}`);
    else fail('list_kennels stats', `ranked ${probe.stats.calls.ranked} after execute_kennel`);

    const bare = await mcpCall('list_kennels', {});
    const paged = await mcpCall('list_kennels', { limit: 3 });
    if (!Array.isArray(bare)) fail('list_kennels shapes', 'without limit not a bare array');
    else if (!Array.isArray(paged?.kennels) || typeof paged.total !== 'number' || typeof paged.hasMore !== 'boolean' || paged.kennels.length > 3) {
      fail('list_kennels shapes', `with limit: ${JSON.stringify(paged).slice(0, 160)}`);
    } else pass('list_kennels shapes', `bare ${bare.length}, envelope ${paged.kennels.length}/${paged.total}, hasMore ${paged.hasMore}`);

    const header = await mcpCall('get_kennel', { id: KENNEL_ID });
    if (typeof header?.stats?.calls?.total !== 'number' || !('avg' in (header.stats.rating || {}))) fail('get_kennel stats', JSON.stringify(header?.stats));
    else pass('get_kennel stats', `total ${header.stats.calls.total}`);

    const h = await mcpCall('health_check', {});
    if (typeof h?.stats?.pending !== 'number' || typeof h.stats.dropped !== 'number') fail('health_check stats', JSON.stringify(h?.stats));
    else pass('health_check stats', `pending ${h.stats.pending}, dropped ${h.stats.dropped}, lastFlushError ${h.stats.lastFlushError}`);
  } catch (e) {
    fail('P4 stats', e.message);
  }

  // Feature-Runde: Aufruf-Filter (usage) — der execute_kennel oben hat KENNEL_ID gerufen: unter top ja,
  // unter never_used nein; REST GET /api/kennels liest dieselben Parameter (dieselbe ListQuery).
  try {
    const schema = await mcpCall('describe_tool', { name: 'list_kennels' });
    const usageEnum = schema?.inputSchema?.properties?.usage?.enum || [];
    const top = await mcpCall('list_kennels', { search: KENNEL_ID, usage: 'top' });
    const never = await mcpCall('list_kennels', { search: KENNEL_ID, usage: 'never_used' });
    const inTop = Array.isArray(top) && top.some((k) => k.lineageId === KENNEL_ID);
    const inNever = Array.isArray(never) && never.some((k) => k.lineageId === KENNEL_ID);
    const failing = await mcpCall('list_kennels', { usage: 'failing', sort: 'failures30d', dir: 'desc', limit: 5 });
    const failingOk = Array.isArray(failing?.kennels) && failing.kennels.every((k) => (k.stats?.calls?.leadFailed30d ?? 0) > 0);
    if (usageEnum.join() !== 'top,never_used,never_worked,failing,dormant') fail('list_kennels usage', `enum ${JSON.stringify(usageEnum)}`);
    else if (!inTop || inNever) fail('list_kennels usage', `top ${inTop}, never_used ${inNever}`);
    else if (!failingOk) fail('list_kennels usage', `failing without leadFailed30d: ${JSON.stringify(failing).slice(0, 160)}`);
    else pass('list_kennels usage', `top has ${KENNEL_ID}, never_used not, failing ${failing.kennels.length}/${failing.total}`);

    const rest = await httpGet(`/api/kennels?q=${encodeURIComponent(KENNEL_ID)}&usage=top&limit=5`);
    const restNever = await httpGet(`/api/kennels?q=${encodeURIComponent(KENNEL_ID)}&usage=never_used&limit=5`);
    const body = JSON.parse(rest.raw || '{}');
    const bodyNever = JSON.parse(restNever.raw || '{}');
    const restTop = Array.isArray(body.data) && body.data.some((k) => (k.lineageId || k.id) === KENNEL_ID);
    const restNone = Array.isArray(bodyNever.data) && !bodyNever.data.some((k) => (k.lineageId || k.id) === KENNEL_ID);
    if (rest.status !== 200 || !restTop || !restNone) fail('GET /api/kennels usage', `HTTP ${rest.status}/${restNever.status}, top ${restTop}, never_used clean ${restNone}`);
    else pass('GET /api/kennels usage', `top total ${body.total}, never_used total ${bodyNever.total}`);
  } catch (e) {
    fail('usage filter (kennels)', e.message);
  }

  // P4b (13): derselbe execute_kennel zaehlt auch jeden Dog sofort (ungeflushte Deltas im Memo-Merge);
  // get_node traegt usage mit dem Kennel; list_nodes kennt sort=proven.
  try {
    const schema = await mcpCall('describe_tool', { name: 'list_nodes' });
    const sortEnum = schema?.inputSchema?.properties?.sort?.enum || [];
    if (!sortEnum.includes('proven') || !schema?.inputSchema?.properties?.provenOnly) fail('list_nodes schema', `sort.enum ${JSON.stringify(sortEnum)}`);
    else pass('list_nodes schema', `sort ${sortEnum.join('|')}, provenOnly`);

    const kennel = await mcpCall('get_kennel', { id: KENNEL_ID });
    const crew = new Set(Array.isArray(kennel?.dogIds) ? kennel.dogIds : []);
    const top = await mcpCall('list_nodes', { sort: 'calls30d', dir: 'desc', limit: 5 });
    const nodes = Array.isArray(top?.nodes) ? top.nodes : [];
    const withoutStats = nodes.filter((n) => !n?.stats?.calls || !n?.stats?.proven);
    const ran = nodes.find((n) => (crew.has(n.id) || crew.has(n.lineageId)) && n.stats?.calls?.last30d >= 1);
    if (nodes.length === 0 || withoutStats.length) fail('list_nodes stats', `${nodes.length} nodes, ${withoutStats.length} without stats`);
    else if (!ran) fail('list_nodes stats', `no dog of ${KENNEL_ID} with calls.last30d >= 1 in top 5: ${nodes.map((n) => `${n.id}:${n.stats.calls.last30d}`).join(', ')}`);
    else pass('list_nodes stats', `${ran.id} last30d ${ran.stats.calls.last30d}, ranked30d ${ran.stats.calls.ranked30d}, proven ${ran.stats.proven.score}`);

    if (ran) {
      const detail = await mcpCall('get_node', { id: ran.lineageId || ran.id });
      const usageKennels = (detail?.usage?.kennels || []).map((k) => k.lineageId);
      if (!detail?.stats?.reuse || !usageKennels.includes(KENNEL_ID)) fail('get_node usage', `kennels ${usageKennels.join(', ')}, hidden ${detail?.usage?.hiddenKennels}`);
      else pass('get_node usage', `${usageKennels.length} kennels incl. ${KENNEL_ID}, hidden ${detail.usage.hiddenKennels}, transitive ${detail.stats.reuse.kennelsTransitive}`);
    }

    const h = await mcpCall('health_check', {});
    if (typeof h?.dogStats?.pendingDogs !== 'number' || typeof h.dogStats.referenceRows !== 'number') fail('health_check dogStats', JSON.stringify(h?.dogStats));
    else pass('health_check dogStats', `pendingDogs ${h.dogStats.pendingDogs}, referenceRows ${h.dogStats.referenceRows}`);
  } catch (e) {
    fail('P4b stats', e.message);
  }

  // Feature-Runde: Aufruf-Filter (usage) fuer Dogs — ein Dog des oben gerufenen KENNEL_ID steht unter top,
  // nie unter never_used; failing traegt nur Dogs mit failures30d > 0; GET /api/nodes liest dieselben Parameter.
  try {
    const schema = await mcpCall('describe_tool', { name: 'list_nodes' });
    const props = schema?.inputSchema?.properties || {};
    const kennel = await mcpCall('get_kennel', { id: KENNEL_ID });
    const crew = new Set(Array.isArray(kennel?.dogIds) ? kennel.dogIds : []);
    const top = await mcpCall('list_nodes', { usage: 'top', limit: 200 });
    const ran = (top?.nodes || []).find((n) => crew.has(n.id) || crew.has(n.lineageId) || crew.has(`base:${n.name}`));
    const never = ran ? await mcpCall('list_nodes', { usage: 'never_used', search: ran.displayName || ran.name, limit: 200 }) : null;
    const failing = await mcpCall('list_nodes', { usage: 'failing', sort: 'failures30d', dir: 'desc', limit: 10 });
    const failingOk = (failing?.nodes || []).every((n) => (n.stats?.calls?.failures30d ?? 0) > 0);
    if ((props.usage?.enum || []).join() !== 'top,never_used,never_worked,failing,dormant' || !props.minReliability) fail('list_nodes usage', 'schema without usage/minReliability');
    else if (!ran) fail('list_nodes usage', `no dog of ${KENNEL_ID} under usage=top (${top?.total} dogs)`);
    else if ((never?.nodes || []).some((n) => n.id === ran.id)) fail('list_nodes usage', `${ran.id} listed as never_used`);
    else if (!failingOk || typeof ran.stats?.calls?.failures !== 'number') fail('list_nodes usage', `failing ${JSON.stringify(failing).slice(0, 160)}`);
    else pass('list_nodes usage', `${ran.displayName || ran.name} in top (${top.total}), failing ${failing.total}`);

    const rest = await httpGet('/api/nodes?lean=1&usage=top&limit=5');
    const body = JSON.parse(rest.raw || '{}');
    const restOk = Array.isArray(body.data) && body.data.length > 0 && body.data.every((n) => (n.stats?.calls?.total ?? 0) > 0);
    if (rest.status !== 200 || !restOk) fail('GET /api/nodes usage', `HTTP ${rest.status}, ${JSON.stringify(body).slice(0, 160)}`);
    else pass('GET /api/nodes usage', `top ${body.data.length}/${body.total}`);
  } catch (e) {
    fail('usage filter (dogs)', e.message);
  }

  // P4b: die Landing traegt provenDogs (Array, ggf. leer — das Abzeichen braucht >= 5 Laeufe).
  try {
    const landing = await httpGet('/api/landing');
    const body = JSON.parse(landing.raw || '{}');
    if (landing.status !== 200 || !Array.isArray(body.provenDogs)) fail('landing provenDogs', `HTTP ${landing.status}, ${typeof body.provenDogs}`);
    else if (body.provenDogs.some((d) => !d?.stats?.proven?.badge)) fail('landing provenDogs', 'entry without badge');
    else pass('landing provenDogs', `${body.provenDogs.length} proven dogs`);
  } catch (e) {
    fail('landing provenDogs', e.message);
  }

  // P4 (11.7): die Alt-Weiche antwortet 308 ohne Lauf und ohne Zaehlung; erst der Folge-GET auf
  // /k/<id> zaehlt — genau einmal (stats.calls.total vorher/nachher, Delta-Merge ohne Flush).
  try {
    const before = (await mcpCall('get_kennel', { id: KENNEL_ID }))?.stats?.calls?.total;
    const qs = `?lat=${query.lat}&lng=${query.lng}`;
    const old = await httpGet(`/${KENNEL_ID}${qs}`);
    const afterRedirect = (await mcpCall('get_kennel', { id: KENNEL_ID }))?.stats?.calls?.total;
    if (old.status !== 308 || old.location !== `/k/${KENNEL_ID}${qs}`) {
      fail('legacy 308 counts not', `HTTP ${old.status} -> ${old.location}`);
    } else if (typeof before !== 'number' || afterRedirect !== before) {
      fail('legacy 308 counts not', `total ${before} -> ${afterRedirect}`);
    } else {
      const followed = await httpGet(old.location);
      const after = (await mcpCall('get_kennel', { id: KENNEL_ID }))?.stats?.calls?.total;
      if (followed.status !== 200) fail('legacy 308 counts not', `GET ${old.location}: HTTP ${followed.status}`);
      else if (after !== before + 1) fail('legacy 308 counts not', `total ${before} -> ${after} (expected +1)`);
      else pass('legacy 308 counts not', `308 +0, /k/ +1 (total ${before} -> ${after})`);
    }
  } catch (e) {
    fail('legacy 308 counts not', e.message);
  }

  // P4c T11: set_key per MCP, list_keys maskiert, kein Lese-Werkzeug; ein Kennel mit {{key:…}} laeuft gegen
  // einen oeffentlichen Echo-Dienst (httpbin.org echot den Authorization-Header) — der Wert steht in
  // keiner Antwort. Ohne Bearer (Super-User, dev) hat der Aufrufer keine Identitaet: no_identity.
  await keyStoreChecks(toolNames);

  // 8.9: der native fetch im Dog erreicht keine privaten Netze; ein oeffentliches Ziel geht weiter.
  await egressChecks();

  // P3.5 T7: ohne Token kein MCP, sobald der Server Auth verlangt (mcp.ts: 401 + WWW-Authenticate).
  // Im Super-User-Modus (MCP_AUTH_REQUIRED nicht true, nur dev) antwortet er 200 — das wird benannt.
  try {
    const { status } = await mcpRequest('tools/list', {}, { anonymous: true });
    if (status === 401) pass('anonymous /mcp', '401 (auth required)');
    else if (status === 200) pass('anonymous /mcp', '200 — super-user mode (dev), no auth');
    else fail('anonymous /mcp', `HTTP ${status}`);
  } catch (e) {
    fail('anonymous /mcp', e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length) {
    console.error(`FAILED: ${failed.length}/${results.length} checks`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASSED: ${results.length}/${results.length} checks`);
}

run().catch((e) => {
  console.error('\nFatal:', e.message);
  if (e.code === 'ECONNREFUSED') {
    console.error('API nicht erreichbar — zuerst npm run dev oder npm run start:integration.');
  }
  process.exitCode = 1;
});
