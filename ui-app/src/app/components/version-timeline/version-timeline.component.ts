import {
  Component, Input, Output, EventEmitter,
  OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';

export interface TimelineVersion {
  id: string;
  version: number;
  parentId?: string | null;
  createdAt?: string;
  displayName?: string;
}

interface GNode {
  v: TimelineVersion;
  x: number; y: number;
  col: number; row: number;
}

interface GEdge { x1: number; y1: number; x2: number; y2: number; }

const R = 5;
const CW = 24;
const RH = 22;
const PX = 14;
const PY = 12;

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  template: `
    <div class="vc">
      <div class="vh">
        <span class="vl">versions</span>
      </div>
      <div class="vs">
        <svg [attr.width]="sw" [attr.height]="sh" [attr.viewBox]="'0 0 ' + sw + ' ' + sh"
          preserveAspectRatio="xMinYMid meet">
          @if (trunk) {
            <line [attr.x1]="trunk.x1" [attr.y1]="trunk.y1"
                  [attr.x2]="trunk.x2" [attr.y2]="trunk.y2" class="tl"/>
          }
          @for (e of edges; track $index) {
            <path [attr.d]="ep(e)" class="el"/>
          }
          @for (n of nodes; track n.v.id) {
            <!-- the dot -->
            <circle
              [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="r(n)"
              [class.active]="n.v.id === activeId"
              [class.sel]="n.v.id === selectedVersionId && n.v.id !== activeId"
              class="nd"
              (click)="select(n.v.id)">
              <title>{{ tip(n) }}</title>
            </circle>
            <!-- pin marker (filled ink square) on the node the kennel is pinned to -->
            @if (showPinControls && n.v.id === pinnedVersionId) {
              <rect [attr.x]="n.x - 4" [attr.y]="n.y - r(n) - 12" width="8" height="8"
                class="marker" [class.clickable]="!pinLock"
                (click)="unpin($event)">
                <title>{{ pinLock || 'Pinned. Click to follow the latest version.' }}</title>
              </rect>
            }
          }

          <!-- pin/unpin toggle on selected node (outlined square) -->
          @if (showPinControls && selNode && selNode.v.id !== pinnedVersionId) {
            <rect
              [attr.x]="selNode.x - 4"
              [attr.y]="selNode.y - r(selNode) - 12"
              width="8" height="8"
              class="pa"
              [class.locked]="!!pinLock"
              (click)="togglePin()">
              <title>{{ pinLock || 'Pin this version' }}</title>
            </rect>
          }
        </svg>
      </div>
      @if (info) { <div class="vi">{{ info }}</div> }
    </div>
  `,
  styles: [`
    :host{display:block}
    .vc{padding:var(--s2) var(--s3) var(--s1);background:var(--paper-2);border-top:1px solid var(--line)}
    .vh{display:flex;align-items:center;gap:6px;margin-bottom:3px}
    .vl{font-size:11px;line-height:14px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:var(--ink-2)}
    .vs{overflow:hidden}
    svg{display:block;max-width:100%;height:auto}

    .tl{stroke:var(--line-strong);stroke-width:1.5}
    .el{fill:none;stroke:var(--line-strong);stroke-width:1.5}

    .nd{fill:var(--paper-2);stroke:var(--ink-3);stroke-width:1.5;cursor:pointer;transition:fill var(--dur-fast),stroke var(--dur-fast)}
    .nd:hover{fill:var(--paper-3);stroke:var(--ink)}
    .nd.active{fill:var(--ink);stroke:var(--ink);stroke-width:2}
    .nd.sel{fill:var(--paper-2);stroke:var(--ink);stroke-width:2}

    .marker{fill:var(--ink);pointer-events:none}
    .marker.clickable{pointer-events:all;cursor:pointer}
    .pa{fill:transparent;stroke:var(--ink);stroke-width:1.5;cursor:pointer}
    .pa:hover{fill:var(--accent)}
    .pa.locked{cursor:not-allowed;opacity:.45}
    .pa.locked:hover{fill:transparent}

    .vi{margin-top:4px;font-size:12px;line-height:17px;color:var(--ink-2);text-align:center}
  `]
})
export class VersionTimelineComponent implements OnDestroy, OnChanges {
  @Input() versions: TimelineVersion[] = [];
  @Input() currentVersionId = '';
  @Input() selectedVersionId: string | null = null;
  @Input() pinnedVersionId: string | null = null;
  /** Whether to show pin/unpin controls. Set to false for kennel timelines. */
  @Input() showPinControls = true;
  /** Kennel frozen: pin controls stay visible but inert; the text is the tooltip. */
  @Input() pinLock: string | null = null;
  @Output() versionSelected = new EventEmitter<string>();
  @Output() pinToggled = new EventEmitter<string | null>();

  nodes: GNode[] = [];
  edges: GEdge[] = [];
  trunk: { x1: number; y1: number; x2: number; y2: number } | null = null;
  sw = 60; sh = 30;

  /**
   * The node the kennel actually uses:
   * - If a version is pinned → that version
   * - Otherwise → the currentVersionId (latest loaded by the kennel)
   */
  get activeId(): string {
    return this.pinnedVersionId || this.currentVersionId;
  }

  get selNode(): GNode | null {
    if (!this.selectedVersionId) return null;
    return this.nodes.find(n => n.v.id === this.selectedVersionId) ?? null;
  }

  ngOnChanges(c: SimpleChanges) { if (c['versions']) this.lay(); }

  private lay() {
    const all = this.versions;
    if (!all.length) { this.nodes = []; this.edges = []; this.trunk = null; return; }

    // Sort all versions globally by createdAt — time dictates column position.
    const sorted = [...all].sort((a, b) => this.ts(a) - this.ts(b));

    const colOf = new Map<string, number>();
    sorted.forEach((v, i) => colOf.set(v.id, i));

    const byId = new Map<string, TimelineVersion>();
    all.forEach(v => byId.set(v.id, v));

    const ch = new Map<string, TimelineVersion[]>();
    all.forEach(v => {
      if (v.parentId && byId.has(v.parentId)) {
        const a = ch.get(v.parentId) || [];
        a.push(v);
        ch.set(v.parentId, a);
      }
    });
    ch.forEach(a => a.sort((a, b) => this.ts(a) - this.ts(b)));

    const roots = all.filter(v => !v.parentId || !byId.has(v.parentId))
      .sort((a, b) => this.ts(a) - this.ts(b));

    const rowOf = new Map<string, number>();
    let nextBranch = 1;

    const walk = (v: TimelineVersion, row: number) => {
      rowOf.set(v.id, row);
      (ch.get(v.id) || []).forEach((k, i) => walk(k, i === 0 ? row : nextBranch++));
    };
    roots.forEach((r, i) => walk(r, i === 0 ? 0 : nextBranch++));

    const maxCol = sorted.length - 1;
    const maxRow = Math.max(nextBranch - 1, 0);
    const topPad = PY + 16;

    this.nodes = sorted.map(v => {
      const col = colOf.get(v.id) ?? 0;
      const row = rowOf.get(v.id) ?? 0;
      return { v, col, row, x: PX + col * CW, y: topPad + row * RH };
    });

    const nm = new Map<string, GNode>();
    this.nodes.forEach(n => nm.set(n.v.id, n));

    const t0 = this.nodes.filter(n => n.row === 0);
    this.trunk = t0.length > 1
      ? { x1: t0[0].x, y1: topPad, x2: t0[t0.length - 1].x, y2: topPad }
      : null;

    this.edges = [];
    this.nodes.forEach(n => {
      if (!n.v.parentId || !nm.has(n.v.parentId)) return;
      const pa = nm.get(n.v.parentId)!;
      if (pa.row === 0 && n.row === 0) return;
      this.edges.push({ x1: pa.x, y1: pa.y, x2: n.x, y2: n.y });
    });

    this.sw = Math.max(PX * 2 + maxCol * CW, 50);
    this.sh = topPad + maxRow * RH + PY;
  }

  ep(e: GEdge): string {
    if (e.y1 === e.y2) return `M${e.x1},${e.y1}L${e.x2},${e.y2}`;
    const mx = e.x1 + CW * .4;
    return `M${e.x1},${e.y1}C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;
  }

  r(n: GNode): number {
    return (n.v.id === this.activeId || n.v.id === this.selectedVersionId)
      ? R + 2 : R;
  }

  tip(n: GNode): string {
    const d = this.fd(n.v.createdAt);
    const nm = n.v.displayName || '';
    const fl: string[] = [];
    if (n.v.id === this.activeId) fl.push(this.pinnedVersionId ? 'pinned' : 'latest');
    return `${nm} ${d}${fl.length ? ' (' + fl.join(', ') + ')' : ''}`.trim();
  }

  select(id: string) { this.versionSelected.emit(id); }

  togglePin() {
    if (!this.selectedVersionId || this.pinLock) return;
    this.pinToggled.emit(this.pinnedVersionId === this.selectedVersionId ? null : this.selectedVersionId);
  }

  unpin(e: MouseEvent) {
    e.stopPropagation();
    if (this.pinLock) return;
    this.pinToggled.emit(null);
  }

  get info(): string {
    if (this.selectedVersionId && this.selectedVersionId !== this.activeId) {
      const n = this.nodes.find(x => x.v.id === this.selectedVersionId);
      if (n) return `${n.v.displayName || this.fd(n.v.createdAt)} loaded — saving starts a branch`;
    }
    return '';
  }

  private ts(v: TimelineVersion): number { return v.createdAt ? new Date(v.createdAt).getTime() : 0; }
  private fd(s?: string): string {
    if (!s) return '';
    const d = new Date(s);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  ngOnDestroy() {}
}
