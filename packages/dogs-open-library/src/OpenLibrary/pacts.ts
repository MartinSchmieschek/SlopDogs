/**
 * =========================================================================
 *  OPEN LIBRARY PACTS — literary accords with the boundless void
 * =========================================================================
 */

import { createPact } from '@martinschmieschek/slopdogs-core';

/** Query for Open Library book search */
export interface OpenLibraryQuery {
    /** Search query string */
    q: string;
    /** Maximum number of results (defaults to "10") */
    limit?: string;
}

/** The Pact for Open Library queries */
export const OpenLibraryQueryPact = createPact<OpenLibraryQuery>('OpenLibraryQueryProvider', { fromSourceType: 'OpenLibraryQuery' });
