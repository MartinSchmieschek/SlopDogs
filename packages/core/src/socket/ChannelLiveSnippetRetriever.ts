/**
 * ============================================================
 *  CHANNEL LIVE SNIPPET RETRIEVER — Self-Contained Lobby-HTML
 * ============================================================
 *  Liest den ChannelState seines Eltern-Hundes
 *  (WebSocketChannelRetriever) und backt daraus ein einzelnes,
 *  mobile-friendly HTML-Dokument:
 *
 *    - share-URL prominent + Copy + navigator.share
 *    - eigener Editor fuer das eigene shared-Objekt (JSON)
 *    - Liste der anderen Teilnehmer mit deren shared-Objekten
 *    - WebSocket mit Auto-Reconnect, Heartbeat und Patch-Listener
 *    - window.lobby API fuer eingebettete Page-Scripts
 *
 *  Lead-Yield-Form: { snapshot: ChannelState, live: string }
 *  — der KennelRunHandler waehlt per Accept/Query, was er ausliefert.
 * ============================================================
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import { WebSocketChannelRetriever } from "./WebSocketChannelRetriever";
import type { ChannelState } from "./IChannelHub";

export interface LobbyLeadYield {
    snapshot: ChannelState;
    live: string;
}

export class ChannelLiveSnippetRetriever extends Dog<LobbyLeadYield> {
    get name(): string {
        return ChannelLiveSnippetRetriever.name;
    }

    get description(): string {
        return "Erzeugt aus einem ChannelState ein eigenstaendiges Lobby-HTML mit WebSocket-Client, Heartbeat und Peer-Listing. Lead-Yield: { snapshot, live }.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCE1";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WebSocketChannelRetriever];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<LobbyLeadYield> => {
        const channelDog = season.exhausted.find(d => d.name === WebSocketChannelRetriever.name);
        const snapshot = (channelDog?.collected ?? null) as ChannelState | null;
        if (!snapshot) {
            throw new Error("ChannelLiveSnippetRetriever: ChannelState fehlt — WebSocketChannelRetriever muss als Parent laufen.");
        }
        return { snapshot, live: renderLobbyHtml(snapshot) };
    };
}

/** JSON-Embed in <script> sicher gegen </script>-Escapes machen. */
function safeJson(v: unknown): string {
    return JSON.stringify(v).replace(/</g, "\\u003c");
}

function renderLobbyHtml(state: ChannelState): string {
    const initial = safeJson(state);

    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lobby ${escapeHtml(state.channelId)}</title>
<style>
:root { color-scheme: light dark; --gap: 12px; --radius: 10px; --border: #8884; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.4;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  max-width: 720px;
  margin: 0 auto;
}
header, section { padding: var(--gap); }
.share {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: #88884; padding: var(--gap); border-radius: var(--radius);
}
.share input {
  flex: 1 1 240px; min-width: 0; padding: 10px; font-size: 16px;
  border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: inherit;
}
button {
  padding: 10px 14px; font-size: 16px; border-radius: var(--radius);
  border: 1px solid var(--border); background: transparent; color: inherit;
  min-height: 44px; cursor: pointer;
}
button:active { transform: scale(0.98); }
.created-badge {
  display: inline-block; margin-left: 8px; padding: 2px 8px;
  background: #2a8; color: #fff; border-radius: 999px; font-size: 12px;
}
h1 { font-size: 20px; margin: 0 0 8px; word-break: break-all; }
h2 { font-size: 16px; margin: 18px 0 6px; }
.status { font-size: 13px; opacity: 0.7; }
.status.ok { color: #2a8; }
.status.bad { color: #c44; }
textarea {
  width: 100%; min-height: 120px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 14px; padding: 10px; border-radius: var(--radius);
  border: 1px solid var(--border); background: transparent; color: inherit; resize: vertical;
}
ul.peers { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--gap); }
ul.peers li {
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: var(--gap); background: #8881;
}
ul.peers li.me { outline: 2px solid #2a8; }
.peer-id { font-family: ui-monospace, monospace; font-size: 13px; opacity: 0.8; word-break: break-all; }
.peer-age { font-size: 12px; opacity: 0.6; }
pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.error { color: #c44; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Lobby <span id="channel-id">${escapeHtml(state.channelId)}</span><span id="created-badge" class="created-badge" style="display:${state.created ? "inline-block" : "none"}">neu</span></h1>
  <div class="share">
    <input id="share-url" type="text" readonly aria-label="Share-Link">
    <button id="copy-btn" type="button">Kopieren</button>
    <button id="share-btn" type="button" hidden>Teilen</button>
  </div>
  <p class="status"><span id="conn-status" class="bad">verbinde...</span> &middot; Peers: <span id="peer-count">0</span></p>
</header>

<section>
  <h2>Mein shared-Objekt</h2>
  <textarea id="my-shared" spellcheck="false">{}</textarea>
  <div class="row" style="margin-top:8px">
    <button id="save-btn" type="button">Senden</button>
    <span id="save-status" class="status"></span>
  </div>
  <div id="parse-error" class="error" hidden></div>
</section>

<section>
  <h2>Teilnehmer</h2>
  <ul class="peers" id="peer-list"></ul>
</section>

<script>
(function(){
  const initial = ${initial};
  const STORAGE_KEY = "lobby:peerId:" + initial.channelId;
  const SHARED_KEY  = "lobby:shared:"  + initial.channelId;

  function makePeerId(){
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "p-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  let peerId = sessionStorage.getItem(STORAGE_KEY);
  if (!peerId){ peerId = makePeerId(); sessionStorage.setItem(STORAGE_KEY, peerId); }

  let myShared = {};
  try { const stored = sessionStorage.getItem(SHARED_KEY); if (stored) myShared = JSON.parse(stored); } catch(_) {}

  // peers Map: peerId -> { lastSeen, shared }
  const peers = new Map();
  for (const p of (initial.peers || [])) peers.set(p.peerId, { lastSeen: p.lastSeen, shared: p.shared || {} });
  // Mich selbst in die Liste, damit Map auch mich rendert
  peers.set(peerId, { lastSeen: Date.now(), shared: myShared });

  const listeners = { changed: [], joined: [], left: [] };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const shareInput = $("share-url");
  const copyBtn    = $("copy-btn");
  const shareBtn   = $("share-btn");
  const status     = $("conn-status");
  const peerCount  = $("peer-count");
  const list       = $("peer-list");
  const sharedTA   = $("my-shared");
  const saveBtn    = $("save-btn");
  const saveStatus = $("save-status");
  const parseErr   = $("parse-error");

  // ---------- Share UI ----------
  // Share-URL = aktueller Pfad + ?channelId=... — so teilt jeder Kennel,
  // der den Socket-Dog einbindet, seinen eigenen Pfad. Der Server kennt
  // den Pfad nicht (das waere kennel-spezifisch), darum macht's der Client.
  const sharedQuery = new URLSearchParams(location.search);
  sharedQuery.set("channelId", initial.channelId);
  const absoluteShareUrl = location.origin + location.pathname + "?" + sharedQuery.toString();
  shareInput.value = absoluteShareUrl;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(absoluteShareUrl);
      copyBtn.textContent = "kopiert";
      setTimeout(() => copyBtn.textContent = "Kopieren", 1500);
    } catch(_) {
      shareInput.select();
      document.execCommand && document.execCommand("copy");
    }
  });
  if (navigator.share){
    shareBtn.hidden = false;
    shareBtn.addEventListener("click", () => {
      navigator.share({ title: "Lobby " + initial.channelId, url: absoluteShareUrl }).catch(()=>{});
    });
  }

  // ---------- Editor ----------
  sharedTA.value = JSON.stringify(myShared, null, 2);
  saveBtn.addEventListener("click", () => {
    parseErr.hidden = true; parseErr.textContent = "";
    try {
      const next = JSON.parse(sharedTA.value || "{}");
      if (next === null || typeof next !== "object" || Array.isArray(next)){
        throw new Error("shared muss ein Objekt sein");
      }
      myShared = next;
      sessionStorage.setItem(SHARED_KEY, JSON.stringify(myShared));
      const me = peers.get(peerId) || { lastSeen: Date.now(), shared: {} };
      me.shared = myShared; me.lastSeen = Date.now();
      peers.set(peerId, me);
      sendPatch();
      render();
      saveStatus.textContent = "gesendet";
      setTimeout(() => saveStatus.textContent = "", 1200);
    } catch(e){
      parseErr.hidden = false;
      parseErr.textContent = "JSON-Fehler: " + (e && e.message || e);
    }
  });

  // ---------- Render ----------
  function render(){
    peerCount.textContent = String(peers.size);
    const now = Date.now();
    const items = Array.from(peers.entries())
      .sort(([a],[b]) => a === peerId ? -1 : b === peerId ? 1 : a.localeCompare(b));
    list.innerHTML = "";
    for (const [pid, p] of items){
      const li = document.createElement("li");
      if (pid === peerId) li.className = "me";
      const head = document.createElement("div");
      head.innerHTML =
        '<span class="peer-id">' + escapeHtml(pid) + (pid === peerId ? " (du)" : "") + '</span>'
        + ' <span class="peer-age">' + Math.max(0, Math.round((now - p.lastSeen)/1000)) + 's</span>';
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(p.shared, null, 2);
      li.appendChild(head); li.appendChild(pre);
      list.appendChild(li);
    }
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => (
      {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c]
    ));
  }

  // ---------- WebSocket ----------
  let ws = null;
  let reconnectMs = 500;
  let heartbeatTimer = null;

  function wsUrl(){
    if (initial.wsUrl.startsWith("ws://") || initial.wsUrl.startsWith("wss://")) return initial.wsUrl;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const path = initial.wsUrl.startsWith("/") ? initial.wsUrl : "/" + initial.wsUrl;
    return proto + "//" + location.host + path;
  }

  function setStatus(text, ok){
    status.textContent = text;
    status.className = "status " + (ok ? "ok" : "bad");
  }

  function send(msg){
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  function sendJoin(){
    send({ type: "join", channelId: initial.channelId, peerId: peerId, shared: myShared });
  }
  function sendPatch(){
    send({ type: "patch", channelId: initial.channelId, peerId: peerId, shared: myShared });
  }

  function startHeartbeat(){
    stopHeartbeat();
    const ms = Math.max(5, initial.heartbeatSec || 20) * 1000;
    heartbeatTimer = setInterval(() => send({ type: "ping", peerId: peerId }), ms);
  }
  function stopHeartbeat(){
    if (heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function connect(){
    setStatus("verbinde...", false);
    try { ws = new WebSocket(wsUrl()); }
    catch(e){ setStatus("WS-Fehler", false); scheduleReconnect(); return; }

    ws.addEventListener("open", () => {
      setStatus("verbunden", true);
      reconnectMs = 500;
      sendJoin();
      startHeartbeat();
    });
    ws.addEventListener("message", (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch(_) { return; }
      handle(msg);
    });
    ws.addEventListener("close", () => {
      setStatus("getrennt — neuer Versuch", false);
      stopHeartbeat();
      scheduleReconnect();
    });
    ws.addEventListener("error", () => { try { ws.close(); } catch(_) {} });
  }
  function scheduleReconnect(){
    setTimeout(connect, reconnectMs);
    reconnectMs = Math.min(reconnectMs * 2, 15000);
  }

  function handle(msg){
    if (!msg || typeof msg !== "object") return;
    switch (msg.type){
      case "snapshot": {
        const me = peers.get(peerId);
        peers.clear();
        for (const p of (msg.peers || [])) peers.set(p.peerId, { lastSeen: p.lastSeen, shared: p.shared || {} });
        if (me) peers.set(peerId, me);
        render();
        break;
      }
      case "peer-joined": {
        peers.set(msg.peerId, { lastSeen: Date.now(), shared: msg.shared || {} });
        render();
        listeners.joined.forEach(fn => { try { fn(msg.peerId, msg.shared || {}); } catch(_){} });
        break;
      }
      case "peer-left": {
        peers.delete(msg.peerId);
        render();
        listeners.left.forEach(fn => { try { fn(msg.peerId); } catch(_){} });
        break;
      }
      case "peer-patch": {
        const cur = peers.get(msg.peerId) || { lastSeen: 0, shared: {} };
        cur.shared = msg.shared || {};
        cur.lastSeen = Date.now();
        peers.set(msg.peerId, cur);
        render();
        listeners.changed.forEach(fn => { try { fn(msg.peerId, cur.shared); } catch(_){} });
        break;
      }
      case "pong": break;
    }
  }

  // ---------- Page-Script API ----------
  window.lobby = {
    channelId: initial.channelId,
    peerId: peerId,
    me: () => myShared,
    setMine: (next) => {
      if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("shared muss Objekt sein");
      myShared = next;
      sessionStorage.setItem(SHARED_KEY, JSON.stringify(myShared));
      const me = peers.get(peerId) || { lastSeen: Date.now(), shared: {} };
      me.shared = myShared; me.lastSeen = Date.now(); peers.set(peerId, me);
      sharedTA.value = JSON.stringify(myShared, null, 2);
      sendPatch(); render();
    },
    peers: () => Array.from(peers.entries()).map(([pid, p]) => ({ peerId: pid, lastSeen: p.lastSeen, shared: p.shared })),
    onPeerChanged: (fn) => listeners.changed.push(fn),
    onPeerJoined:  (fn) => listeners.joined.push(fn),
    onPeerLeft:    (fn) => listeners.left.push(fn),
  };

  render();
  connect();

  window.addEventListener("beforeunload", () => {
    try { ws && ws.close(); } catch(_) {}
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as Record<string, string>
    )[c]);
}
