// Eigene Seiten je Nutzer (Landing `/`, Liste `/kennels`) — der Vertrag zwischen MyPagesService und dem Store
// (Tabelle UserPage). Eine Zeile je Nutzer und Art; lineageId ist die Lineage des gewaehlten Kennels. userId ist die
// Auth-User.id ohne Fremdschluessel, wie bei den Favoriten.

/** Die Arten eigener Seiten: `landing` fuer `/`, `list` fuer `/kennels`. */
export const USER_PAGE_KINDS = ['landing', 'list'] as const;
export type UserPageKind = (typeof USER_PAGE_KINDS)[number];

/** Die gespeicherten Seiten eines Nutzers; fehlt eine Art, gilt dort die Default-Seite. */
export type UserPages = Partial<Record<UserPageKind, string>>;

/** Aenderungen: eine lineageId setzt die Seite, null loescht sie; nicht genannte Arten bleiben, wie sie sind. */
export type UserPageChanges = Partial<Record<UserPageKind, string | null>>;

export function isUserPageKind(value: unknown): value is UserPageKind {
    return (USER_PAGE_KINDS as readonly unknown[]).includes(value);
}

export interface IUserPageStore {
    /** Die Seiten dieses Nutzers — eine Abfrage ueber den Schluessel (userId, kind). */
    readUserPages(userId: string): Promise<UserPages>;
    /** Setzt und loescht die genannten Arten in einer Transaktion. */
    writeUserPages(userId: string, changes: UserPageChanges): Promise<void>;
    /** Kennel-Delete: alle Seiten, die auf diese Lineage zeigen. */
    deleteUserPagesOf(lineageId: string): Promise<void>;
}
