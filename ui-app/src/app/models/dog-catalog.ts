import { isBaseDog, type DogInfo, type IDogStats } from './dog.model';
import type { KennelVisibility } from './kennel-config.model';

/** Filter `group` of the browser (6.4 S6): base and dogs share one list, `base` is a filter. */
export type DogGroup = 'base' | 'dogs' | 'mimic';
/** Filter `owner`: whose dog, and run-only ones (run without read). */
export type DogOwnerFilter = 'everyone' | 'mine' | 'foreign' | 'run-only';
/** The rights chip: what the caller may do with the dog. */
export type DogRight = 'run' | 'read' | 'edit';
export type DogSortKey = 'proven' | 'calls30d' | 'reuse' | 'name';

/**
 * One dog as the browser, the palette and the preview see it (P6 U5): the list entry of
 * `GET /api/nodes?lean=1` reduced to what a row shows and what a kennel stores.
 */
export class DogCatalogEntry {
  private constructor(
    /** Deep link and track key: `base:X`, else the lineageId. */
    readonly key: string,
    /** What goes into a kennel's dogIds: `base:X`, the lineageId — or, run-only, the version GUID (pinned, 8.15). */
    readonly ref: string,
    readonly name: string,
    readonly icon: string,
    readonly description: string,
    readonly group: DogGroup,
    readonly pack: string | null,
    readonly own: boolean,
    readonly right: DogRight,
    readonly version: number | null,
    readonly frozen: boolean,
    readonly stats: IDogStats | undefined,
    readonly raw: DogInfo,
  ) { }

  static from(d: DogInfo, userId: string | null): DogCatalogEntry {
    if (isBaseDog(d)) {
      return new DogCatalogEntry(d.id, d.id, d.name, d.icon?.trim() ?? '', d.description?.trim() ?? '', 'base',
        d.pack ?? null, false, 'run', null, false, d.stats, d);
    }
    const r = d.myRights;
    const readable = r ? r.read : true;
    const right: DogRight = r?.edit ? 'edit' : readable ? 'read' : 'run';
    const lineage = d.lineageId || d.id;
    return new DogCatalogEntry(
      lineage,
      readable ? lineage : d.id,
      d.displayName?.trim() || lineage,
      d.icon?.trim() ?? '',
      d.description?.trim() ?? '',
      d.imitates ? 'mimic' : 'dogs',
      null,
      !!userId && d.ownerId === userId,
      right,
      d.version ?? null,
      !!(d.frozen ?? r?.frozen),
      d.stats,
      d,
    );
  }

  get isBase(): boolean {
    return this.group === 'base';
  }

  /** Foreign and run without read: code stays with its owner, a kennel pins it (8.15). */
  get runOnly(): boolean {
    return !this.isBase && this.right === 'run';
  }

  /** Visibility of a stored dog; base dogs have none. */
  get visibility(): KennelVisibility | null {
    return isBaseDog(this.raw) ? null : this.raw.visibility ?? null;
  }

  get canReadCode(): boolean {
    return !this.isBase && this.right !== 'run';
  }

  get proven(): boolean | null {
    return this.stats ? this.stats.proven.badge : null;
  }

  /** The ids a kennel may already hold this dog under. */
  get kennelRefs(): string[] {
    const out = new Set<string>([this.key, this.ref, this.raw.id]);
    const lineage = (this.raw as { lineageId?: string }).lineageId;
    if (lineage) out.add(lineage);
    return [...out];
  }

  matches(q: string): boolean {
    if (!q) return true;
    const hay = [this.name, this.key, this.description, this.pack ?? ''].join(' ').toLowerCase();
    return hay.includes(q);
  }

  inOwner(filter: DogOwnerFilter): boolean {
    switch (filter) {
      case 'everyone': return true;
      case 'mine': return this.own;
      case 'foreign': return !this.isBase && !this.own;
      case 'run-only': return this.runOnly;
    }
  }
}

/** Client-side order for the palette (the browser asks the server, which sorts the same way). */
export function sortCatalog(list: DogCatalogEntry[], key: DogSortKey): DogCatalogEntry[] {
  const value = (e: DogCatalogEntry): number => {
    const s = e.stats;
    if (!s) return 0;
    if (key === 'proven') return s.proven.score;
    if (key === 'calls30d') return s.calls.ranked30d;
    return s.reuse.kennelsTransitive;
  };
  return [...list].sort((a, b) => {
    if (key !== 'name') {
      const d = value(b) - value(a);
      if (d !== 0) return d;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.key.localeCompare(b.key);
  });
}
