/**
 * Vertrag der fachlichen JSON-Ablage. Die Implementierung lebt im Serverprozess
 * (services/JsonStorageService.ts) und wird dem Hund per `initService()`
 * untergeschoben — so bleibt core frei von Prisma.
 */
export interface IJsonStorage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T = unknown>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    snapshot(): Promise<Array<{ key: string; value: unknown; updatedAt: number }>>;
}
