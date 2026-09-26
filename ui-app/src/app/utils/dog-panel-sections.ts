import { DogEntry } from '../models/dog-entry.model';

export type DogPanelSectionId = 'code' | 'vm' | 'result' | 'parents' | 'usage' | 'stats' | 'acl';

export interface DogPanelSectionItem {
  id: DogPanelSectionId;
  /** Kurzes Tab-Label (.sd-tab, uppercase per CSS). */
  label: string;
}

/** Tab-Labels pro Bereich (Edit-View). Read-Tracking nur am Graph (Kanten-Overlay). */
export const SECTION_LABEL: Record<DogPanelSectionId, string> = {
  code: 'code',
  vm: 'context',
  result: 'result',
  parents: 'parents',
  usage: 'usage',
  stats: 'stats',
  acl: 'access',
};

/**
 * Der Schluessel, unter dem Liste und `/usage` einen Dog kennen (P4b): lineageId, bei Base-Dogs `base:X`.
 * null, wenn nichts Belastbares da ist (privater redigierter Dog ohne Identitaet).
 */
export function dogInsightKey(dog: DogEntry): string | null {
  if (dog.lineageId) return dog.lineageId;
  if (!dog.codeTs && !dog.serializedDogConfig && !dog.redacted && dog.name && dog.id === dog.name) return `base:${dog.name}`;
  return null;
}

export function buildDogPanelSections(dog: DogEntry): DogPanelSectionItem[] {
  const insight: DogPanelSectionItem[] = dogInsightKey(dog)
    ? [{ id: 'usage', label: SECTION_LABEL.usage }, { id: 'stats', label: SECTION_LABEL.stats }]
    : [];
  // P3.5 Redaction: fremder Dog ohne Leserecht — Ergebnis, Nutzung und Zahlen; kein Code, kein Kontext,
  // keine Rechte. Ein privater (access none) behaelt nur das Ergebnisfeld.
  if (dog.redacted) {
    return [{ id: 'result', label: SECTION_LABEL.result }, ...(dog.access === 'run' ? insight : [])];
  }
  const out: DogPanelSectionItem[] = [];
  if (dog.codeTs) {
    out.push({ id: 'code', label: SECTION_LABEL.code });
  }
  out.push({ id: 'vm', label: SECTION_LABEL.vm });
  out.push({ id: 'result', label: SECTION_LABEL.result });
  if (dog.codeTs) {
    out.push({ id: 'parents', label: SECTION_LABEL.parents });
  }
  out.push(...insight);
  // SerializedDogs and MimicDogs have a lineageId — only those have an ACL.
  // Hunters (BaseDogs) are project-wide, no ACL.
  if (dog.lineageId) {
    out.push({ id: 'acl', label: SECTION_LABEL.acl });
  }
  return out;
}

/**
 * Legacy-Fallback (z. B. wenn kein Dog-Kontext): Result.
 * Bevorzugt {@link getDefaultPanelSection} — mit Code → `code`, sonst `result`.
 */
export const DEFAULT_PANEL_SECTION: DogPanelSectionId = 'result';

/** Standard-Bereich beim Öffnen: Code-Ansicht wenn der Dog TS-Code hat, sonst Result; redacted immer Result. */
export function getDefaultPanelSection(dog: DogEntry): DogPanelSectionId {
  if (dog.redacted) return 'result';
  return dog.codeTs ? 'code' : 'result';
}
