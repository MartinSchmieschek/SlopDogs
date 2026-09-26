/** Normalize an Express route param to a single string (Express 5 wildcard params are string[]). */
export function paramString(value: string | string[] | undefined): string {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
