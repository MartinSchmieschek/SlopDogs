import {
  Component, Input, Output, EventEmitter,
  ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy,
  computed, signal
} from '@angular/core';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { EdgeReadPropsOverlayComponent } from '../edge-read-props-overlay/edge-read-props-overlay.component';
import { SdDogCardComponent } from '../sd-dog-card/sd-dog-card.component';
import {
  buildGraphViewModel,
  applyGraphRepulsionAndProjection,
  computeWaveBands,
  cubicBezierMidpoint,
  GRAPH_NODE_H,
  GRAPH_NODE_W,
  type RenderNode,
} from './graph-layout';
import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';

/** Dot grid pitch of the ruled inlay (8.22). */
const GRID_PX = 24;

/**
 * Dependency graph on the canvas "ruled inlay" (P6 U3, 8.22): dot grid and wave bands under SVG
 * hairline edges and `sd-dog-card` nodes; shared pan/zoom, cards draggable unless read-only or frozen.
 */
@Component({
  selector: 'app-vis-network',
  standalone: true,
  imports: [EdgeReadPropsOverlayComponent, SdDogCardComponent],
  template: `
    <div
      class="viewport"
      #viewport
      [class.panning]="isPanning"
      [style.background-size]="gridSize()"
      [style.background-position]="gridPos()"
      (pointerdown)="onViewportPointerDown($event)"
      (pointermove)="onViewportPointerMove($event)"
      (pointerup)="onViewportPointerUp($event)"
      (pointercancel)="onViewportPointerUp($event)"
      (wheel)="onWheel($event)">
      <div class="bands" aria-hidden="true">
        @for (b of bandsVp(); track b.waveIndex) {
          <div class="band" [class.alt]="b.order % 2 === 1" [class.first]="b.order === 0"
            [style.top.px]="b.top" [style.height.px]="b.height">
            <span class="sd-chip band-chip">{{ b.label }}</span>
          </div>
        }
      </div>
      @if (viewModel(); as vm) {
        <div
          class="canvas"
          [style.transform]="canvasTransform()"
          [style.width.px]="vm.contentWidth"
          [style.height.px]="vm.contentHeight">
          <svg class="edge-svg" [attr.width]="vm.contentWidth" [attr.height]="vm.contentHeight" aria-hidden="true">
            @for (e of vm.renderEdges; track e.key) {
              <g class="edge" [class.opt]="e.optional">
                <path class="hit" [attr.d]="e.pathD" />
                <path class="line" [attr.d]="e.pathD" [attr.stroke-width]="e.strokeWidthPx" />
              </g>
            }
          </svg>
          @for (n of vm.renderNodes; track n.id) {
            <div
              class="node-slot"
              [class.draggable]="canDrag()"
              [class.dragging]="draggingNodeId() === n.id"
              [style.width.px]="nodeW"
              [style.height.px]="nodeH"
              [style.left.px]="n.rx"
              [style.top.px]="n.ry"
              role="button"
              tabindex="0"
              [attr.aria-label]="n.dog.displayName || n.dog.name"
              (pointerdown)="onNodePointerDown($event, n)"
              (click)="onNodeClick(n.dog, $event)"
              (keydown.enter)="dogSelected.emit(n.dog)"
              (keydown.space)="$event.preventDefault(); dogSelected.emit(n.dog)">
              <sd-dog-card [dog]="n.dog" [selected]="isNodeSelected(n.id)" [lead]="isNodeLead(n.id)" />
              @if (commentForNode(n.id); as cmt) {
                <span class="node-comment" role="img" [attr.aria-label]="cmt" [title]="cmt">¶</span>
              }
            </div>
          }
          @for (slot of edgeCommentSlots(); track slot.key) {
            @if (readOnly) {
              <span class="mark" role="img" [attr.aria-label]="slot.comment"
                [style.left.px]="slot.left" [style.top.px]="slot.top" [title]="slot.comment">¶</span>
            } @else {
              <button
                type="button"
                class="tool tool--pin"
                [class.tool--has]="!!slot.comment"
                [style.left.px]="slot.left"
                [style.top.px]="slot.top"
                [disabled]="!!mutationLock"
                [title]="commentTitle(slot.comment)"
                [attr.aria-label]="slot.comment ? 'Edit comment' : 'Add comment'"
                (pointerdown)="$event.stopPropagation()"
                (click)="onEdgeCommentClick($event, slot.fromId, slot.toId)">{{ slot.comment ? '¶' : '+' }}</button>
            }
          }
          @for (s of edgeCutSlots(); track s.key) {
            <div class="cut" [style.left.px]="s.left" [style.top.px]="s.top">
              <div class="cut-bar" (pointerdown)="$event.stopPropagation()">
                @if (s.readFromPaths.length > 0 || s.readByPaths.length > 0) {
                  <button
                    type="button"
                    class="tool"
                    [class.tool--on]="edgeReadsExpandedKey() === s.key"
                    [attr.aria-expanded]="edgeReadsExpandedKey() === s.key"
                    title="Read tracking (reads from / read by)"
                    aria-label="Read tracking"
                    (click)="toggleEdgeReadsPanel(s.key, $event)">⌕</button>
                }
                @if (!readOnly) {
                  <button
                    type="button"
                    class="tool"
                    [disabled]="!!mutationLock"
                    [title]="mutationLock || 'Remove this branch from the kennel'"
                    aria-label="Remove this branch from the kennel"
                    (click)="onBranchCutClick(s, $event)">{{ scissors }}</button>
                }
              </div>
              @if (edgeReadsExpandedKey() === s.key && (s.readFromPaths.length > 0 || s.readByPaths.length > 0)) {
                <div class="reads" (pointerdown)="$event.stopPropagation()">
                  <div class="reads-wing reads-wing--l">
                    @if (s.readFromPaths.length > 0) {
                      <app-edge-read-props-overlay variant="edge" title="Reads from" [paths]="s.readFromPaths" />
                      <span class="arrow" aria-hidden="true">{{ s.arrowTowardTo }}</span>
                    }
                  </div>
                  <div class="reads-wing">
                    @if (s.readByPaths.length > 0) {
                      <span class="arrow" aria-hidden="true">{{ s.arrowTowardFrom }}</span>
                      <app-edge-read-props-overlay variant="edge" title="Read by" [paths]="s.readByPaths" />
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .viewport { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none;
      user-select: none; cursor: grab; background-color: var(--paper);
      background-image: radial-gradient(circle, var(--grid) 1px, transparent 1.5px); }
    .viewport.panning { cursor: grabbing; }
    .bands { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
    .band { position: absolute; left: 0; right: 0; display: flex; align-items: center;
      border-top: 1px dashed var(--line-strong); }
    .band.first { border-top: 0; }
    .band.alt { background: color-mix(in srgb, var(--paper-2) 70%, transparent); }
    .band-chip { margin-left: 8px; }
    .canvas { position: relative; z-index: 1; transform-origin: 0 0; will-change: transform; }
    .edge-svg { position: absolute; left: 0; top: 0; z-index: 0; pointer-events: none; overflow: visible; }
    .edge path { fill: none; stroke-linecap: round; }
    .edge .hit { stroke: transparent; stroke-width: 10; pointer-events: stroke; }
    .edge .line { stroke: var(--line-strong); }
    .edge.opt .line { stroke-dasharray: 6 4; }
    .edge:hover .line { stroke: var(--ink); }
    .node-slot { position: absolute; z-index: 1; cursor: pointer; touch-action: none; }
    .node-slot.draggable { cursor: move; }
    .node-slot.dragging { cursor: grabbing; z-index: 4; }
    .node-slot:focus-visible { outline: none; }
    .node-slot:focus-visible sd-dog-card { outline: 3px solid var(--focus); outline-offset: 2px; }
    .node-comment, .mark { position: absolute; width: 16px; height: 16px; display: flex; align-items: center;
      justify-content: center; background: var(--ink); color: var(--paper); font: 700 11px/1 var(--font-mono); }
    .node-comment { right: -6px; bottom: -6px; z-index: 2; }
    .mark { z-index: 2; transform: translate(-50%, -50%); }
    /* Invisible hit-area extension (WCAG target size): grows the tappable area without moving the
       visual center or changing the marker's rendered size. */
    .node-comment::before, .mark::before { content: ''; position: absolute; inset: -4px; }
    @media (pointer: coarse) {
      .node-comment::before, .mark::before { inset: -14px; }
    }
    .tool { width: 22px; height: 22px; padding: 0; margin: 0; display: inline-flex; align-items: center;
      justify-content: center; border: 1px solid var(--ink); border-radius: 0; background: var(--paper-2);
      color: var(--ink); font: 700 12px/1 var(--font-mono); cursor: pointer; }
    .tool:hover:not(:disabled) { background: var(--paper-3); }
    .tool:disabled { opacity: .45; cursor: not-allowed; }
    .tool--on { background: var(--ink); color: var(--paper); }
    .tool--on:hover:not(:disabled) { background: var(--ink); }
    .tool--pin { position: absolute; z-index: 2; transform: translate(-50%, -50%); width: 18px; height: 18px;
      border-color: var(--line-strong); color: var(--ink-2); }
    /* Invisible hit-area extension (WCAG target size): 18px visual box reaches 24px (44px on touch)
       tappable area; left/top keep positioning the same center. */
    .tool--pin::before { content: ''; position: absolute; inset: -3px; }
    @media (pointer: coarse) {
      .tool--pin::before { inset: -13px; }
    }
    .tool--has { border-color: var(--ink); background: var(--ink); color: var(--paper); }
    .tool--has:hover:not(:disabled) { background: var(--ink-2); }
    .cut { position: absolute; z-index: 3; transform: translate(-50%, -50%); display: flex; flex-direction: column;
      align-items: center; gap: 6px; pointer-events: none; }
    .cut-bar { display: flex; gap: 4px; pointer-events: auto; }
    .reads { pointer-events: auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px;
      width: min(92vw, 36rem); padding: 8px; background: var(--paper-2); border: 2px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink); }
    .reads-wing { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .reads-wing--l { justify-content: flex-end; }
    .arrow { flex: none; font: 700 16px/1 var(--font-mono); color: var(--ink); }
  `]
})
export class VisNetworkComponent implements OnChanges, OnDestroy {
  @ViewChild('viewport') viewportRef!: ElementRef<HTMLElement>;
  @Input() waves: Waves = [];
  @Input() selectedDog: DogEntry | null = null;
  @Input() flatDogs: DogEntry[] = [];
  /** Card click (without drag): open the dog inspector. */
  @Output() dogSelected = new EventEmitter<DogEntry>();
  /** Kept for the viewer; no internal trigger since the graph node fan is gone. */
  @Output() dogSectionEdit = new EventEmitter<{ dog: DogEntry; section: DogPanelSectionId }>();
  @Output() dogDeleted = new EventEmitter<string>();
  /** Edge parent → child: drop the subtree from the child on from `dogIds`. The viewer confirms. */
  @Output() branchCutRequested = new EventEmitter<{ fromId: string; toId: string }>();
  /** Initial layout from the parent: Map<instanceId, {x, y}>, merged into manualPositions. */
  @Input() initialNodePositions: Map<string, { x: number; y: number }> | null = null;
  /** Node comments shown as a badge — Map<instanceId, comment>. */
  @Input() nodeComments: Map<string, string> | null = null;
  /** Edge comments — Map<"fromInstanceId|toInstanceId", comment>. */
  @Input() edgeComments: Map<string, string> | null = null;
  /** Emitted after a real drag: snapshot of manualPositions. */
  @Output() nodePositionsChanged = new EventEmitter<Map<string, { x: number; y: number }>>();
  /** Click on an edge comment button → parent opens the editor. */
  @Output() edgeCommentRequested = new EventEmitter<{ fromId: string; toId: string }>();
  /** First entry of kennel.dogIds — the lead card. */
  @Input() kennelLeadDogIdsSlot: string | null = null;
  /** With app-graph-canvas-scale: pointer deltas are corrected by 1/scale. */
  @Input() canvasScale = 1;
  /** Reader without edit: no drag, no scissors, no "add comment"; existing comments as plain markers. */
  @Input() readOnly = false;
  /** Frozen kennel: no drag; scissors and comment buttons stay visible but disabled with this title. */
  @Input() mutationLock: string | null = null;

  readonly nodeW = GRAPH_NODE_W;
  readonly nodeH = GRAPH_NODE_H;
  /** Scissors with VS15: text presentation, never the emoji. */
  readonly scissors = '✂︎';

  private readonly wavesRef = signal<Waves>([]);
  /** Manual world coordinates (top-left), override the auto layout per node id. */
  readonly manualPositions = signal<Map<string, { x: number; y: number }>>(new Map());
  private readonly selectedRef = signal<DogEntry | null>(null);
  /** Edge whose read-tracking panel is open. */
  readonly edgeReadsExpandedKey = signal<string | null>(null);
  private readonly flatDogsRef = signal<DogEntry[]>([]);

  viewModel = computed(() => {
    const base = buildGraphViewModel(this.wavesRef(), this.manualPositions(), !this.draggingNodeId(), {
      leadAnchorTopId: this.resolveLeadGraphNodeId(),
    });
    if (!base) return null;
    if (this.draggingNodeId()) return base;
    return applyGraphRepulsionAndProjection(base, this.wavesRef(), this.resolveLeadGraphNodeId());
  });

  panX = signal(0);
  panY = signal(0);
  zoom = signal(1);
  isPanning = false;
  private panGrab: { sx: number; sy: number; px: number; py: number } | null = null;

  draggingNodeId = signal<string | null>(null);
  private nodeDragLast: { cx: number; cy: number } | null = null;
  private nodeDragSuppressedClick = false;
  private readonly onDocPointerMove = (e: PointerEvent) => this.onNodePointerMoveDoc(e);
  private readonly onDocPointerUp = (e: PointerEvent) => this.onNodePointerUpDoc(e);

  canvasTransform = computed(() => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`);
  /** Dot grid follows pan and zoom. */
  gridSize = computed(() => `${GRID_PX * this.zoom()}px ${GRID_PX * this.zoom()}px`);
  gridPos = computed(() => `${this.panX()}px ${this.panY()}px`);

  /** Wave bands in viewport coordinates, full width, under edges and cards. */
  bandsVp = computed(() => {
    const vm = this.viewModel();
    if (!vm) return [];
    const z = this.zoom();
    const py = this.panY();
    return computeWaveBands(vm.renderNodes, this.wavesRef()).map(b => ({
      ...b,
      top: py + b.y0 * z,
      height: (b.y1 - b.y0) * z,
    }));
  });

  canDrag(): boolean {
    return !this.readOnly && !this.mutationLock;
  }

  commentForNode(id: string): string | null {
    return this.nodeComments?.get(id) ?? null;
  }

  commentTitle(comment: string): string {
    if (this.mutationLock) return comment ? `${comment}\n${this.mutationLock}` : this.mutationLock;
    return comment || 'Add comment';
  }

  /** One comment slot per edge (set or empty), offset from the midpoint so it clears the scissors. */
  edgeCommentSlots = computed(() => {
    const vm = this.viewModel();
    if (!vm) return [] as Array<{ key: string; left: number; top: number; fromId: string; toId: string; comment: string }>;
    return vm.renderEdges
      .map(e => {
        const mid = cubicBezierMidpoint(e.rx1, e.ry1, e.rx2, e.ry2);
        const comment = this.edgeComments?.get(`${e.fromId}|${e.toId}`) ?? '';
        return { key: e.key, left: mid.x + 18, top: mid.y + 18, fromId: e.fromId, toId: e.toId, comment };
      })
      .filter(s => !this.readOnly || !!s.comment);
  });

  onEdgeCommentClick(event: MouseEvent, fromId: string, toId: string) {
    event.stopPropagation();
    if (this.readOnly || this.mutationLock) return;
    this.edgeCommentRequested.emit({ fromId, toId });
  }

  /** Scissors at the edge midpoint (off the lead path only); reads along this edge with direction arrows. */
  edgeCutSlots = computed(() => {
    const vm = this.viewModel();
    if (!vm) return [];
    const map = vm.dogMap;
    const rnById = new Map(vm.renderNodes.map(n => [n.id, n]));
    return vm.renderEdges
      .filter(e => edgeShowsBranchCutForOffLeadPath(map.get(e.fromId), map.get(e.toId)))
      .map(e => {
        const mid = cubicBezierMidpoint(e.rx1, e.ry1, e.rx2, e.ry2);
        const fromDog = map.get(e.fromId);
        const toDog = map.get(e.toId);
        const fromRn = rnById.get(e.fromId);
        const toRn = rnById.get(e.toId);
        let arrowTowardTo = '↓';
        let arrowTowardFrom = '↑';
        if (fromRn && toRn) {
          arrowTowardTo = flowArrow(mid.x, mid.y, toRn.rx + GRAPH_NODE_W / 2, toRn.ry + GRAPH_NODE_H / 2);
          arrowTowardFrom = flowArrow(mid.x, mid.y, fromRn.rx + GRAPH_NODE_W / 2, fromRn.ry + GRAPH_NODE_H / 2);
        }
        return {
          key: e.key,
          left: mid.x,
          top: mid.y,
          fromId: e.fromId,
          toId: e.toId,
          readFromPaths: fromDog && toDog ? readFromLinesAlongEdge(fromDog, toDog) : [],
          readByPaths: fromDog && toDog ? readByLinesAlongEdge(fromDog, toDog) : [],
          arrowTowardTo,
          arrowTowardFrom,
        };
      })
      .filter(s => !this.readOnly || s.readFromPaths.length > 0 || s.readByPaths.length > 0);
  });

  ngOnChanges(changes: SimpleChanges) {
    this.selectedRef.set(this.selectedDog);
    this.flatDogsRef.set(this.flatDogs ?? []);
    if (changes['waves']) {
      this.wavesRef.set(this.waves ?? []);
      this.edgeReadsExpandedKey.set(null);
      const baseIds = new Set((this.waves ?? []).flat().map(d => d.id));
      const pruned = new Map<string, { x: number; y: number }>();
      // Seed manualPositions from the parent's persisted layout when waves arrive.
      if (this.initialNodePositions) {
        for (const [id, pos] of this.initialNodePositions) {
          if (baseIds.has(id)) pruned.set(id, pos);
        }
      }
      for (const [id, pos] of this.manualPositions()) {
        if (baseIds.has(id) && !pruned.has(id)) pruned.set(id, pos);
      }
      this.manualPositions.set(pruned);
      if (baseIds.size > 0) {
        setTimeout(() => this.fitView(), 0);
      } else {
        this.panX.set(0);
        this.panY.set(0);
        this.zoom.set(1);
      }
    } else if (changes['initialNodePositions'] && this.initialNodePositions) {
      const baseIds = new Set((this.waves ?? []).flat().map(d => d.id));
      const merged = new Map<string, { x: number; y: number }>();
      for (const [id, pos] of this.initialNodePositions) {
        if (baseIds.has(id)) merged.set(id, pos);
      }
      // Preserve in-flight drags that haven't yet been emitted.
      for (const [id, pos] of this.manualPositions()) {
        if (baseIds.has(id) && !merged.has(id)) merged.set(id, pos);
      }
      this.manualPositions.set(merged);
    }
  }

  ngOnDestroy() {
    this.detachNodeDragListeners();
  }

  private detachNodeDragListeners() {
    document.removeEventListener('pointermove', this.onDocPointerMove);
    document.removeEventListener('pointerup', this.onDocPointerUp);
    document.removeEventListener('pointercancel', this.onDocPointerUp);
  }

  private canvasScaleInv(): number {
    const s = this.canvasScale;
    return s > 0 ? 1 / s : 1;
  }

  isNodeSelected(id: string): boolean {
    return this.selectedRef()?.id === id;
  }

  isNodeLead(graphNodeId: string): boolean {
    const slot = this.kennelLeadDogIdsSlot;
    if (!slot) return false;
    const dog = this.viewModel()?.dogMap.get(graphNodeId);
    return graphNodeIdMatchesKennelDogId(graphNodeId, slot, dog?.lineageId);
  }

  /** Graph node id of the kennel lead (dogIds[0]), anchored at the top. */
  private resolveLeadGraphNodeId(): string | null {
    const slot = this.kennelLeadDogIdsSlot;
    if (!slot) return null;
    const flat = (this.wavesRef() ?? []).flat();
    const d = flat.find(dog => graphNodeIdMatchesKennelDogId(dog.id, slot, dog.lineageId));
    return d?.id ?? null;
  }

  onNodePointerDown(e: PointerEvent, n: RenderNode) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.nodeDragSuppressedClick = false;
    if (!this.canDrag()) return;
    e.preventDefault();
    this.draggingNodeId.set(n.id);
    this.nodeDragLast = { cx: e.clientX, cy: e.clientY };
    document.addEventListener('pointermove', this.onDocPointerMove, { passive: false });
    document.addEventListener('pointerup', this.onDocPointerUp);
    document.addEventListener('pointercancel', this.onDocPointerUp);
  }

  private onNodePointerMoveDoc(e: PointerEvent) {
    if (!this.draggingNodeId() || !this.nodeDragLast) return;
    e.preventDefault();
    const z = this.zoom();
    const inv = this.canvasScaleInv();
    const dx = ((e.clientX - this.nodeDragLast.cx) * inv) / z;
    const dy = ((e.clientY - this.nodeDragLast.cy) * inv) / z;
    if (Math.hypot(dx * z, dy * z) > 4) {
      this.nodeDragSuppressedClick = true;
    }
    this.nodeDragLast = { cx: e.clientX, cy: e.clientY };
    const vm = this.viewModel();
    if (!vm) return;
    const id = this.draggingNodeId()!;
    const wn = vm.worldNodes.find(x => x.id === id);
    if (!wn) return;
    const next = new Map(this.manualPositions());
    const cur = next.get(id) ?? { x: wn.x, y: wn.y };
    next.set(id, { x: cur.x + dx, y: cur.y + dy });
    this.manualPositions.set(next);
  }

  private onNodePointerUpDoc(_e: PointerEvent) {
    const draggedId = this.draggingNodeId();
    // Only a real drag settles the layout — otherwise every click would re-separate and emit.
    const didDrag = this.nodeDragSuppressedClick;
    this.detachNodeDragListeners();
    this.draggingNodeId.set(null);
    this.nodeDragLast = null;
    if (draggedId && didDrag) {
      const base = buildGraphViewModel(this.wavesRef(), this.manualPositions(), true, {
        leadAnchorTopId: this.resolveLeadGraphNodeId(),
      });
      const vm = base
        ? applyGraphRepulsionAndProjection(base, this.wavesRef(), this.resolveLeadGraphNodeId())
        : null;
      if (vm?.worldNodes.length) {
        const m = new Map<string, { x: number; y: number }>();
        for (const n of vm.worldNodes) m.set(n.id, { x: n.x, y: n.y });
        this.manualPositions.set(m);
        this.nodePositionsChanged.emit(new Map(m));
      }
    }
  }

  onNodeClick(dog: DogEntry, e: MouseEvent) {
    e.stopPropagation();
    if (this.nodeDragSuppressedClick) {
      this.nodeDragSuppressedClick = false;
      return;
    }
    this.dogSelected.emit(dog);
  }

  toggleEdgeReadsPanel(slotKey: string, ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.edgeReadsExpandedKey.update(cur => (cur === slotKey ? null : slotKey));
  }

  onBranchCutClick(s: { fromId: string; toId: string }, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    if (this.readOnly || this.mutationLock) return;
    this.edgeReadsExpandedKey.set(null);
    this.branchCutRequested.emit({ fromId: s.fromId, toId: s.toId });
  }

  onViewportPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.node-slot') || t.closest('.cut') || t.closest('.tool')) return;
    this.edgeReadsExpandedKey.set(null);
    this.isPanning = true;
    this.panGrab = { sx: e.clientX, sy: e.clientY, px: this.panX(), py: this.panY() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  onViewportPointerMove(e: PointerEvent) {
    if (!this.isPanning || !this.panGrab) return;
    e.preventDefault();
    const g = this.panGrab;
    const inv = this.canvasScaleInv();
    this.panX.set(g.px + (e.clientX - g.sx) * inv);
    this.panY.set(g.py + (e.clientY - g.sy) * inv);
  }

  onViewportPointerUp(_e: PointerEvent) {
    this.isPanning = false;
    this.panGrab = null;
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const z = this.zoom();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    this.zoom.set(Math.min(2.5, Math.max(0.3, z * factor)));
  }

  private fitView() {
    const vm = this.viewModel();
    const vp = this.viewportRef?.nativeElement;
    if (!vm || !vp) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (vw < 8 || vh < 8) return;
    const cw = vm.contentWidth;
    const ch = vm.contentHeight;
    // The wave chips sit at the left viewport edge: the cards start right of them at any zoom.
    const chips = 88;
    const aw = Math.max(8, vw - chips);
    const z = Math.min(aw / cw, vh / ch, 1) * 0.95;
    const nz = Math.max(0.35, Math.min(2.5, z));
    this.zoom.set(nz);
    this.panX.set(chips + (aw - cw * nz) / 2);
    this.panY.set((vh - ch * nz) / 2);
  }
}

function instanceMatchesDog(name: string, dog: DogEntry): boolean {
  return dog.name === name || dog.id === name;
}

/** `to` reads from `from` along this edge (readFrom on the target). */
function readFromLinesAlongEdge(from: DogEntry, to: DogEntry): string[] {
  const readFrom = to.readFrom;
  if (!readFrom?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of readFrom) {
    if (!instanceMatchesDog(r.sourceInstanceName, from)) continue;
    const line = `${r.sourceInstanceName} · ${r.propertyPath}`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/** `from` is read by `to` along this edge (readBy on the source). */
function readByLinesAlongEdge(from: DogEntry, to: DogEntry): string[] {
  const readBy = from.readBy;
  if (!readBy?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of readBy) {
    if (!instanceMatchesDog(r.readerInstanceName, to)) continue;
    const line = `${r.readerInstanceName} · ${r.propertyPath}`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/** Text arrow from the edge midpoint toward a target point (dominant axis). */
function flowArrow(mx: number, my: number, tx: number, ty: number): string {
  const dx = tx - mx;
  const dy = ty - my;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? '↓' : '↑';
  return dx >= 0 ? '→' : '←';
}

/**
 * Scissors only on edges not fully on the lead result path —
 * both ends `onLeadDependencyPath === true` means the edge stays.
 */
function edgeShowsBranchCutForOffLeadPath(from: DogEntry | undefined, to: DogEntry | undefined): boolean {
  return !(from?.onLeadDependencyPath === true && to?.onLeadDependencyPath === true);
}
