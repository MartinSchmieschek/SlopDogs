export interface StackExchangeResult {
    site: string;
    endpoint: string;
    quotaMax?: number;
    quotaRemaining?: number;
    hasMore?: boolean;
    items: unknown[];
}
