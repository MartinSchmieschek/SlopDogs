import { DogEntry, Waves } from '../../models/dog-entry.model';

/** Layout slot = the dog card (`sd-dog-card`, 128×56, P6 U3). */
export const GRAPH_NODE_W = 128;
export const GRAPH_NODE_H = 56;

/** Edge port height: edges dock at the card's top/bottom edge. */
export const GRAPH_NODE_ICON_PX = GRAPH_NODE_H;

/** X offset from the card's left edge to the edge anchor (card centre). */
export const GRAPH_EDGE_ANCHOR_OFFSET_PX = GRAPH_NODE_W / 2;

export function graphEdgeAnchorX(nodeLeftX: number): number {
  return nodeLeftX + GRAPH_EDGE_ANCHOR_OFFSET_PX;
}

/** Oberkante des vertikal zentrierten Icon-Ports (Welt-Y). */
export function graphIconPortTopY(nodeY: number, nodeH: number = GRAPH_NODE_H): number {
  return nodeY + (nodeH - GRAPH_NODE_ICON_PX) / 2;
}

/** Unterkante des Icon-Ports (Welt-Y). */
export function graphIconPortBottomY(nodeY: number, nodeH: number = GRAPH_NODE_H): number {
  return nodeY + (nodeH + GRAPH_NODE_ICON_PX) / 2;
}

/** Horizontal gap between cards in one wave row. */
const COL_GAP = 40;
/** Vertical gap between wave rows (room for the band line); later waves on top. */
const ROW_GAP = 88;
/** Outer margin: left/right leave room for the `wave 01` chip, top/bottom half a row gap. */
const PADDING_X = 96;
const PADDING = ROW_GAP / 2;

const SEP_GAP = 32;
const SEP_ITERATIONS = 32;

/** Zusätzliche Abstoßung nach Überlappungs-Trennung (Mindestabstand der Slot-Mitten). */
const REPEL_MIN_DIST_FACTOR = 0.54;
const REPEL_ITERATIONS = 12;
const REPEL_STRENGTH = 0.38;

export interface PlacedNode {
  id: string;
  dog: DogEntry;
  /** Weltkoordinaten (Top-Left), wie aus dem Auto-Layout oder manuell */
  x: number;
  y: number;
}

export interface EdgeSegment {
  key: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  optional: boolean;
  /** Eindeutige Read-Tracking-Zeilen auf dieser Kante (Liest von + Wird gelesen). */
  readTrackingCount: number;
  /** SVG stroke width of the visible hairline. */
  strokeWidthPx: number;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  edges: EdgeSegment[];
  dogMap: Map<string, DogEntry>;
  contentWidth: number;
  contentHeight: number;
}

/** Für Template: Weltkoordinaten in Canvas-Pixel (oben links min mit Rand) */
export interface RenderNode extends PlacedNode {
  rx: number;
  ry: number;
}

export interface RenderEdge extends EdgeSegment {
  rx1: number;
  ry1: number;
  rx2: number;
  ry2: number;
  pathD: string;
}

export interface GraphViewModel {
  worldNodes: PlacedNode[];
  renderNodes: RenderNode[];
  renderEdges: RenderEdge[];
  dogMap: Map<string, DogEntry>;
  contentWidth: number;
  contentHeight: number;
}

export function cleanParentId(parentId: string): string {
  return parentId.startsWith('base:') ? parentId.substring(5) : parentId;
}

/**
 * parentsRequired speichert oft die Lineage-GUID; Knoten-IDs bei SerializedDogs sind die Version (storageId).
 * Löst Parent-Referenzen auf die tatsächliche Knoten-ID für Kanten auf.
 */
export function resolveParentRefToNodeId(parentRef: string, nodes: PlacedNode[]): string {
  const cleaned = cleanParentId(parentRef);
  if (nodes.some((n) => n.id === cleaned)) return cleaned;
  const byLineage = nodes.find(
    (n) =>
      n.dog.lineageId != null &&
      (n.dog.lineageId === parentRef || n.dog.lineageId === cleaned)
  );
  return byLineage?.id ?? cleaned;
}

function instanceMatchesDogRead(name: string, dog: DogEntry): boolean {
  return dog.name === name || dog.id === name;
}

/**
 * Anzahl eindeutiger Read-Tracking-Zeilen für die gerichtete Kante Parent (`from`) → Kind (`to`).
 */
export function countReadTrackingForEdge(from: DogEntry, to: DogEntry): number {
  let n = 0;
  const rf = to.readFrom;
  if (rf?.length) {
    const seen = new Set<string>();
    for (const r of rf) {
      if (!instanceMatchesDogRead(r.sourceInstanceName, from)) continue;
      const line = `${r.sourceInstanceName} · ${r.propertyPath}`;
      if (seen.has(line)) continue;
      seen.add(line);
      n++;
    }
  }
  const rb = from.readBy;
  if (rb?.length) {
    const seen = new Set<string>();
    for (const r of rb) {
      if (!instanceMatchesDogRead(r.readerInstanceName, to)) continue;
      const line = `${r.readerInstanceName} · ${r.propertyPath}`;
      if (seen.has(line)) continue;
      seen.add(line);
      n++;
    }
  }
  return n;
}

/** Ruled inlay: one hairline per edge, 1.5 px; read tracking shows in the edge panel, not the width. */
const EDGE_STROKE_PX = 1.5;

/**
 * Gleich große AABB: iterativ entlang der kleineren Überlappungsachse trennen.
 */
export function separateOverlappingNodes(
  nodes: PlacedNode[],
  w: number,
  h: number,
  gap: number = SEP_GAP,
  iterations: number = SEP_ITERATIONS
): void {
  const hw = w / 2;
  const hh = h / 2;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x + hw - (a.x + hw);
        const dy = b.y + hh - (a.y + hh);
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const overlapX = w + gap - absDx;
        const overlapY = h + gap - absDy;
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const sign = dx >= 0 ? 1 : -1;
          const shift = overlapX / 2;
          a.x -= sign * shift;
          b.x += sign * shift;
        } else {
          const sign = dy >= 0 ? 1 : -1;
          const shift = overlapY / 2;
          a.y -= sign * shift;
          b.y += sign * shift;
        }
      }
    }
  }
}

/**
 * Mindestabstand der Slot-Mitten — zusätzliche Verdrängung nach der Überlappungs-Trennung.
 */
function repelNodeCenters(nodes: PlacedNode[], w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  const minDist = Math.hypot(w, h) * REPEL_MIN_DIST_FACTOR + SEP_GAP * 0.35;
  for (let it = 0; it < REPEL_ITERATIONS; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ax = a.x + hw;
        const ay = a.y + hh;
        const bx = b.x + hw;
        const by = b.y + hh;
        let dx = bx - ax;
        let dy = by - ay;
        const d = Math.hypot(dx, dy);
        if (d < 1e-4 || d >= minDist) continue;
        const push = (minDist - d) * REPEL_STRENGTH;
        dx /= d;
        dy /= d;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}

/**
 * Kubische Bézier — dominante Richtung waagrecht oder senkrecht (TB-Graph + gleiche Zeile):
 * Kontrollpunkte folgen der stärkeren Achse wie die sichtbare Kante.
 */
function cubicBezierControlPoints(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number
): { cx1: number; cy1: number; cx2: number; cy2: number } {
  const dx = rx2 - rx1;
  const dy = ry2 - ry1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx >= ady && adx >= 1e-6) {
    const stretch = Math.min(100, adx * 0.42);
    const sx = Math.sign(dx) || 1;
    return {
      cx1: rx1 + sx * stretch,
      cy1: ry1,
      cx2: rx2 - sx * stretch,
      cy2: ry2,
    };
  }
  if (ady >= 1e-6) {
    const stretch = Math.min(100, ady * 0.42);
    const sy = Math.sign(dy) || 1;
    return {
      cx1: rx1,
      cy1: ry1 + sy * stretch,
      cx2: rx2,
      cy2: ry2 - sy * stretch,
    };
  }
  return { cx1: rx1, cy1: ry1, cx2: rx2, cy2: ry2 };
}

/**
 * Punkt auf der kubischen Bézier bei t ∈ [0,1] — gleiche Geometrie wie die sichtbare Kante.
 */
export function cubicBezierPointAt(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number,
  t: number
): { x: number; y: number } {
  const { cx1, cy1, cx2, cy2 } = cubicBezierControlPoints(rx1, ry1, rx2, ry2);
  const mt = 1 - t;
  const x =
    mt ** 3 * rx1 +
    3 * mt ** 2 * t * cx1 +
    3 * mt * t ** 2 * cx2 +
    t ** 3 * rx2;
  const y =
    mt ** 3 * ry1 +
    3 * mt ** 2 * t * cy1 +
    3 * mt * t ** 2 * cy2 +
    t ** 3 * ry2;
  return { x, y };
}

export function cubicBezierPathD(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number
): string {
  const { cx1, cy1, cx2, cy2 } = cubicBezierControlPoints(rx1, ry1, rx2, ry2);
  return `M ${rx1} ${ry1} C ${cx1} ${cy1} ${cx2} ${cy2} ${rx2} ${ry2}`;
}

/** Mittelpunkt auf der sichtbaren Kantenkurve (t = 0.5) — Position für z. B. Scheren-Button. */
export function cubicBezierMidpoint(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number
): { x: number; y: number } {
  return cubicBezierPointAt(rx1, ry1, rx2, ry2, 0.5);
}

/**
 * Vertikales Wellen-Layout: **letzte** Welle oben (kleinstes y), erste Welle unten —
 * passt zur typischen Ausführung (Lead oft in späterer Welle, näher am API-Ergebnis).
 * Pro Welle: Knoten nebeneinander, zentriert auf die breiteste Zeile.
 */
export function buildGraphLayout(waves: Waves): GraphLayout {
  const dogMap = new Map<string, DogEntry>();
  const pos = new Map<string, { x: number; y: number }>();

  if (!waves?.length) {
    return {
      nodes: [],
      edges: [],
      dogMap,
      contentWidth: PADDING_X * 2,
      contentHeight: PADDING * 2,
    };
  }

  const numWaves = waves.length;
  const rowWidths = waves.map(wave => {
    if (wave.length === 0) return 0;
    return wave.length * GRAPH_NODE_W + Math.max(0, wave.length - 1) * COL_GAP;
  });
  const maxRowW = Math.max(0, ...rowWidths);

  waves.forEach((wave, w) => {
    const displayRow = numWaves - 1 - w;
    const y = PADDING + displayRow * (GRAPH_NODE_H + ROW_GAP);
    const rowW = rowWidths[w];
    const x0 = PADDING_X + (maxRowW - rowW) / 2;
    wave.forEach((dog, i) => {
      const x = x0 + i * (GRAPH_NODE_W + COL_GAP);
      pos.set(dog.id, { x, y });
      dogMap.set(dog.id, dog);
    });
  });

  const nodes: PlacedNode[] = [...dogMap.entries()].map(([id, dog]) => {
    const p = pos.get(id)!;
    return { id, dog, x: p.x, y: p.y };
  });

  const edges = recomputeEdgeSegments(nodes, waves);

  const contentWidth = PADDING_X * 2 + maxRowW;
  const contentHeight =
    PADDING * 2 + numWaves * GRAPH_NODE_H + Math.max(0, numWaves - 1) * ROW_GAP;

  return { nodes, edges, dogMap, contentWidth, contentHeight };
}

/** Anschlüsse Parent → Kind je nach relativer Lage (TB, LR, schräg). */
function edgeAttachmentPoints(
  p: PlacedNode,
  c: PlacedNode,
  w: number,
  h: number
): { x1: number; y1: number; x2: number; y2: number } {
  const ptcx = p.x + w / 2;
  const ptcy = p.y + h / 2;
  const ctox = c.x + w / 2;
  const ctoy = c.y + h / 2;
  const pax = graphEdgeAnchorX(p.x);
  const cax = graphEdgeAnchorX(c.x);
  const dx = ctox - ptcx;
  const dy = ctoy - ptcy;
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (ctoy < ptcy) {
      return {
        x1: pax,
        y1: graphIconPortTopY(p.y, h),
        x2: cax,
        y2: graphIconPortBottomY(c.y, h),
      };
    }
    return {
      x1: pax,
      y1: graphIconPortBottomY(p.y, h),
      x2: cax,
      y2: graphIconPortTopY(c.y, h),
    };
  }
  if (ctox > ptcx) {
    return { x1: p.x + w, y1: ptcy, x2: c.x, y2: ctoy };
  }
  return { x1: p.x, y1: ptcy, x2: c.x + w, y2: ctoy };
}

/**
 * Kanten aus aktuellen Knotenpositionen (nach Drag).
 */
export function recomputeEdgeSegments(nodes: PlacedNode[], waves: Waves): EdgeSegment[] {
  const pos = new Map(nodes.map(n => [n.id, n]));
  const seenEdge = new Set<string>();
  const edges: EdgeSegment[] = [];

  const pushEdge = (fromId: string, toId: string, optional: boolean) => {
    const ek = `${fromId}|${toId}`;
    if (seenEdge.has(ek)) return;
    seenEdge.add(ek);
    const pN = pos.get(fromId);
    const cN = pos.get(toId);
    if (!pN || !cN) return;
    const { x1, y1, x2, y2 } = edgeAttachmentPoints(pN, cN, GRAPH_NODE_W, GRAPH_NODE_H);
    const readTrackingCount = countReadTrackingForEdge(pN.dog, cN.dog);
    const strokeWidthPx = EDGE_STROKE_PX;
    edges.push({
      key: `${ek}-${optional ? 'opt' : 'req'}`,
      fromId,
      toId,
      x1,
      y1,
      x2,
      y2,
      optional,
      readTrackingCount,
      strokeWidthPx,
    });
  };

  waves.forEach(wave => {
    wave.forEach(dog => {
      (dog.parentsRequired ?? []).forEach(pid => {
        pushEdge(resolveParentRefToNodeId(pid, nodes), dog.id, false);
      });
      (dog.parentsOptional ?? []).forEach(pid => {
        pushEdge(resolveParentRefToNodeId(pid, nodes), dog.id, true);
      });
    });
  });

  return edges;
}

/**
 * Adjazenz Parent → Kinder (gleiche Kanten wie `recomputeEdgeSegments`).
 */
export function buildParentToChildrenMap(waves: Waves): Map<string, Set<string>> {
  const children = new Map<string, Set<string>>();
  const add = (parentId: string, childId: string) => {
    if (!children.has(parentId)) children.set(parentId, new Set());
    children.get(parentId)!.add(childId);
  };
  for (const wave of waves) {
    for (const dog of wave) {
      for (const pid of dog.parentsRequired ?? []) {
        add(cleanParentId(pid), dog.id);
      }
      for (const pid of dog.parentsOptional ?? []) {
        add(cleanParentId(pid), dog.id);
      }
    }
  }
  return children;
}

/**
 * Transitiver Teilbaum ab `childRootId` (inkl.): alle Knoten, die von dort nur „nach rechts“
 * über Eltern→Kind-Kanten erreichbar sind — für „Zweig aus Kennel schneiden“ (B1).
 */
export function collectDescendantBranchNodeIds(waves: Waves, childRootId: string): Set<string> {
  const children = buildParentToChildrenMap(waves);
  const out = new Set<string>();
  const q: string[] = [childRootId];
  while (q.length > 0) {
    const id = q.shift()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) {
      if (!out.has(c)) q.push(c);
    }
  }
  return out;
}

export interface BuildGraphViewModelOptions {
  /** Kennel-Lead-Knoten an den oberen Rand (y = PADDING) schieben — nach manuellem Merge/Separation. */
  leadAnchorTopId?: string | null;
}

function shiftLeadNodesToTopPadding(nodes: PlacedNode[], leadId: string | null): void {
  if (!leadId) return;
  const anchor = nodes.find(n => n.id === leadId);
  if (!anchor) return;
  const deltaY = PADDING - anchor.y;
  for (const n of nodes) {
    n.y += deltaY;
  }
}

/**
 * Nach Layout: Knoten abstossen, Lead erneut an y=PADDING, Kanten neu — wird von {@link VisNetworkComponent} aufgerufen.
 */
export function applyGraphRepulsionAndProjection(
  vm: GraphViewModel,
  waves: Waves,
  leadAnchorTopId: string | null
): GraphViewModel {
  const worldNodes: PlacedNode[] = vm.worldNodes.map(n => ({ ...n }));
  repelNodeCenters(worldNodes, GRAPH_NODE_W, GRAPH_NODE_H);
  shiftLeadNodesToTopPadding(worldNodes, leadAnchorTopId);
  const edges = recomputeEdgeSegments(worldNodes, waves);
  const { renderNodes, renderEdges, contentWidth, contentHeight } = worldToRender(worldNodes, edges);
  return {
    worldNodes,
    renderNodes,
    renderEdges,
    dogMap: vm.dogMap,
    contentWidth,
    contentHeight,
  };
}

/**
 * Wendet manuelle Positionen an, berechnet Kanten und Render-Koordinaten (Bounding Box).
 * @param separate — bei false (z. B. während Drag) keine Kollisionsauflösung.
 */
export function buildGraphViewModel(
  waves: Waves,
  manual: ReadonlyMap<string, { x: number; y: number }>,
  separate = true,
  options?: BuildGraphViewModelOptions
): GraphViewModel | null {
  const base = buildGraphLayout(waves);
  if (!base.nodes.length) return null;

  let worldNodes: PlacedNode[] = base.nodes.map(n => {
    const o = manual.get(n.id);
    return o ? { ...n, x: o.x, y: o.y } : { ...n };
  });

  if (separate) {
    separateOverlappingNodes(worldNodes, GRAPH_NODE_W, GRAPH_NODE_H, SEP_GAP, SEP_ITERATIONS);
  }

  shiftLeadNodesToTopPadding(worldNodes, options?.leadAnchorTopId ?? null);

  const edges = recomputeEdgeSegments(worldNodes, waves);
  const { renderNodes, renderEdges, contentWidth, contentHeight } = worldToRender(
    worldNodes,
    edges
  );

  return {
    worldNodes,
    renderNodes,
    renderEdges,
    dogMap: base.dogMap,
    contentWidth,
    contentHeight,
  };
}

function worldToRender(
  worldNodes: PlacedNode[],
  edges: EdgeSegment[]
): {
  renderNodes: RenderNode[];
  renderEdges: RenderEdge[];
  contentWidth: number;
  contentHeight: number;
} {
  if (worldNodes.length === 0) {
    return {
      renderNodes: [],
      renderEdges: [],
      contentWidth: PADDING_X * 2,
      contentHeight: PADDING * 2,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of worldNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + GRAPH_NODE_W);
    maxY = Math.max(maxY, n.y + GRAPH_NODE_H);
  }

  const sx = minX - PADDING_X;
  const sy = minY - PADDING;

  const renderNodes: RenderNode[] = worldNodes.map(n => ({
    ...n,
    rx: n.x - sx,
    ry: n.y - sy,
  }));

  const renderEdges: RenderEdge[] = edges.map(e => {
    const rx1 = e.x1 - sx;
    const ry1 = e.y1 - sy;
    const rx2 = e.x2 - sx;
    const ry2 = e.y2 - sy;
    return {
      ...e,
      rx1,
      ry1,
      rx2,
      ry2,
      pathD: cubicBezierPathD(rx1, ry1, rx2, ry2),
    };
  });

  const contentWidth = maxX - minX + 2 * PADDING_X;
  const contentHeight = maxY - minY + 2 * PADDING;

  return { renderNodes, renderEdges, contentWidth, contentHeight };
}

/** One horizontal wave band in render (canvas) coordinates (8.22 ruled inlay). */
export interface WaveBand {
  /** Wave index in execution order (0 = first wave, label `wave 01`). */
  waveIndex: number;
  label: string;
  /** Position top to bottom — drives the alternating fill. */
  order: number;
  y0: number;
  y1: number;
}

/**
 * Bands from the current card positions: each wave spans its cards; neighbouring bands meet halfway
 * between them, so they never overlap even after manual drags. Outer bands get half a row gap extra.
 */
export function computeWaveBands(renderNodes: readonly RenderNode[], waves: Waves): WaveBand[] {
  const yById = new Map(renderNodes.map(n => [n.id, n.ry]));
  const raw: Array<{ waveIndex: number; y0: number; y1: number }> = [];
  waves.forEach((wave, waveIndex) => {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const dog of wave) {
      const y = yById.get(dog.id);
      if (y == null) continue;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + GRAPH_NODE_H);
    }
    if (y0 < y1) raw.push({ waveIndex, y0, y1 });
  });
  raw.sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));

  const bands: WaveBand[] = [];
  let prevBottom = -Infinity;
  raw.forEach((r, i) => {
    const next = raw[i + 1];
    const top = i === 0 ? r.y0 - ROW_GAP / 2 : prevBottom;
    let bottom = next ? (r.y1 + next.y0) / 2 : r.y1 + ROW_GAP / 2;
    bottom = Math.max(bottom, top);
    bands.push({
      waveIndex: r.waveIndex,
      label: `wave ${String(r.waveIndex + 1).padStart(2, '0')}`,
      order: i,
      y0: top,
      y1: bottom,
    });
    prevBottom = bottom;
  });
  return bands;
}
