/**
 * ============================================================
 *  WEBSOCKET CHANNEL RETRIEVER — der Pfoertner der Lobby
 * ============================================================
 *  Liest die Channel-Id aus dem QueryRetriever (oder erzeugt
 *  eine frische, wenn keine kam), meldet den Channel beim Hub
 *  an und liefert einen Snapshot des aktuellen Stands:
 *  Teilnehmer + ihre shared-Objekte + Wege zur Live-Verbindung.
 *
 *  Der eigentliche Echtzeit-Verkehr laueft NICHT durch diesen
 *  Hund — der ist der Begruessungs-Schreiberling. WebSockets
 *  uebernimmt der Hub.
 * ============================================================
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import { QueryRetriever } from "../platform/QueryRetriever";
import type { ChannelState, IChannelHub } from "./IChannelHub";

/** Der Query-Parameter der Einladung — derselbe, den der Hub beim Upgrade liest. */
const CHANNEL_PARAM = "channelId";

export class WebSocketChannelRetriever extends Dog<ChannelState> {
    private static hub: IChannelHub | undefined;

    /** Vom Server (main.ts) vor der Hunde-Schmiede einmal gerufen. */
    static initService(hub: IChannelHub): void {
        WebSocketChannelRetriever.hub = hub;
    }

    /**
     * Anweisung an jeden Agenten, der ueber den MCP baut. Der MCP kuendigt sie
     * ungefragt an (initialize) und reicht sie in list_nodes/get_node_schema mit.
     *
     * Warum am Dog und nicht in einer Doku-Datei: genau dieses Wissen fehlte, und
     * Agenten haben sich daraufhin einen eigenen WebSocket in den tsCode gebaut.
     * Am Dog kann es nicht auseinanderlaufen -- wer den Dog aendert, sieht es.
     */
    static readonly mcpGuidance: string =
        'Bau NIEMALS einen eigenen WebSocket in den tsCode (kein `new WebSocket(...)`, keine ws://- oder wss://-Adresse von Hand). '
        + 'Dieser Dog ist die Lobby. Verdrahtung: `extraDogIds: ["base:WebSocketChannelRetriever", "base:QueryRetriever"]` MIT base:-Praefix — '
        + 'der QueryRetriever gehoert dazu, er traegt die Einladung (?channelId=) herein; fehlt er, ergaenzt ihn der Dienst. '
        + 'Im `parentsRequired` des Lead-Dogs dagegen OHNE Praefix als blanker Klassenname "WebSocketChannelRetriever". '
        + 'Im Dog-Code steht er dann als Global bereit und liefert `channelId`, `wsUrl` (Form wss://…/api/channels?channelId=…), `heartbeatSec`, `created`, `peers`, '
        + '`channelParam` ("channelId") und `channelQuery` ("?channelId=…", immer gefuellt, auch bei frisch erzeugter Lobby). '
        + 'Einen fertigen Teilen-Link erzeugt er NICHT — den baut die Seite aus location.origin + location.pathname + channelQuery, damit jeder Kennel seinen eigenen Pfad teilt. '
        + 'Die channelId kommt aus dem ?channelId=-Query oder wird neu erzeugt — erfinde keinen eigenen room-Parameter.';

    constructor() {
        super();
        if (!WebSocketChannelRetriever.hub) {
            throw new Error(
                "WebSocketChannelRetriever: hub not initialised — WebSocketChannelRetriever.initService(hub) muss vor `new WebSocketChannelRetriever()` aufgerufen werden.",
            );
        }
    }

    get name(): string {
        return WebSocketChannelRetriever.name;
    }

    get description(): string {
        return "Lobby-Pfoertner: legt eine Lobby an oder tritt einer bei (channelId aus der Query — dafuer gehoert base:QueryRetriever in den Kennel, der Dienst ergaenzt ihn). Liefert channelId, wsUrl, heartbeatSec, channelParam, channelQuery (Teilen-Link: location.origin + location.pathname + channelQuery) und die aktuellen Teilnehmer mit ihren shared-Objekten.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEAA";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [QueryRetriever];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ChannelState> => {
        const hub = WebSocketChannelRetriever.hub!;

        // Channel-Id aus QueryRetriever lesen (bereits lowercased durch QueryRetriever).
        const queryDog = season.exhausted.find(d => d.name === QueryRetriever.name);
        const query = (queryDog?.collected ?? {}) as Record<string, string>;
        const incomingId = (query[CHANNEL_PARAM.toLowerCase()] ?? "").trim();

        const channelId = incomingId || hub.newChannelId();
        const join = hub.joinOrCreate(channelId);
        const channelQuery = `?${CHANNEL_PARAM}=${encodeURIComponent(channelId)}`;

        // wsUrl: absolut wenn PUBLIC_API_BASE_URL gesetzt ist, sonst relativ (Client setzt
        // Protokoll/Host aus location davor). Den Pfad besitzt der Hub und sonst niemand.
        // Frueher hat der Dog ihn aus WS_PATH nachgebaut — dieselbe Wahrheit an zwei Orten:
        // wer den Hub per Option auf einen anderen Pfad setzt, bekam vom Dog eine tote Adresse,
        // und gemerkt haette man es erst an der fehlschlagenden Live-Verbindung.
        const wsPath = (hub.wsPath() || "/api/channels").replace(/\/$/, "") || "/api/channels";
        const publicBase = (process.env.PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
        const wsUrl = publicBase
            ? publicBase.replace(/^http/, "ws") + wsPath + channelQuery
            : wsPath + channelQuery;

        return {
            channelId,
            created: join.created,
            wsUrl,
            peers: join.peers,
            heartbeatSec: hub.heartbeatSec(),
            channelParam: CHANNEL_PARAM,
            channelQuery,
        };
    };
}
