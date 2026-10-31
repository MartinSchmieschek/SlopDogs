import { createPact } from '@martinschmieschek/slopdogs-core';

export interface TrailQuery {
    lat: string;
    lng: string;
    radius?: string;
    type?: string;
}

export const TrailQueryPact = createPact<TrailQuery>('TrailQueryProvider', { fromSourceType: 'TrailQuery' });
