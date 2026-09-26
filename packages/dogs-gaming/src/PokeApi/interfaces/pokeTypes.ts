export interface PokeApiResult {
    endpoint: string;
    mode: "item" | "list";
    query: string;
    data: unknown;
}
