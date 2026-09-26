export interface ReadTrackingEntry {
  waveIndex: number;
  readerInstanceName: string;
  sourceInstanceName: string;
  propertyPath: string;
}

export interface DogEntry {
  id: string;
  lineageId?: string;
  displayName?: string;
  name: string;
  /** A brief description of what this dog does */
  description?: string;
  /** Bindungsname im VM-Kontext, vom Server geliefert — siehe `SerializedDogInfo.contextName`. */
  contextName?: string;
  icon?: string;
  result: any;
  error?: string;
  codeTs?: string;
  vmContext?: Record<string, any>;
  vmContextTypeDef?: string;
  vmExpectedReturnTypeName?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
  /** Whether this node can be removed from the kennel */
  deletable: boolean;
  editable: boolean;
  mimic: boolean;
  serializedDogConfig?: {
    theRun: string;
    lineageId?: string;
    parentId?: string | null;
    displayName?: string;
    version?: number;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  };
  readFrom?: ReadTrackingEntry[];
  readBy?: ReadTrackingEntry[];
  /** Transitiver Beitrag zum Lead-Ergebnis (nur gesetzt wenn die API Config mitschickt). */
  onLeadDependencyPath?: boolean;
  /** P3.5 (services/wavesRedaction.ts): the caller may not read this dog — no code, no context. */
  redacted?: boolean;
  /** P3.5: set with `redacted` — `run` keeps result and a short error, `none` keeps the identity only. */
  access?: 'read' | 'run' | 'none';
  /** Version of the instance that ran (oldest = 1); redacted RUN nodes carry it, so a pinned foreign dog shows `pinned v7`. */
  version?: number;
  /** Redacted RUN nodes: how far the lineage head is (`v9 available`) and its version GUID to re-pin to. */
  latestVersion?: number;
  latestId?: string;
}

export type Waves = DogEntry[][];
