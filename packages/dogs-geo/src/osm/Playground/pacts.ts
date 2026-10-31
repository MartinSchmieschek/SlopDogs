import { createPact } from '@martinschmieschek/slopdogs-core';

export interface PlaygroundQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const PlaygroundQueryPact = createPact<PlaygroundQuery>('PlaygroundQueryProvider', { fromSourceType: 'PlaygroundQuery' });
