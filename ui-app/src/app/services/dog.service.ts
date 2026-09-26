import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { DogInfo, IDogUsage } from '../models/dog.model';
import type { UsageFilter } from './kennel.service';

const CATALOG_TTL_MS = 60_000;

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  id?: string;
}

export interface VersionEntry {
  id: string;
  version: number;
  /** The lineage GUID — binds all incarnations across branches */
  lineageId?: string;
  /** The ancestor from which this incarnation was born */
  parentId?: string | null;
  /** When this incarnation was forged */
  createdAt?: string;
  config: {
    theRun: string;
    lineageId?: string;
    parentId?: string | null;
    displayName?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    [key: string]: any;
  };
}

@Injectable({ providedIn: 'root' })
export class DogService {
  private http = inject(HttpClient);
  private baseUrl = '/api/nodes';

  getAll(kennelId?: string): Observable<ApiResponse<DogInfo[]>> {
    const params = kennelId ? `?kennelId=${encodeURIComponent(kennelId)}` : '';
    return this.http.get<ApiResponse<DogInfo[]>>(`${this.baseUrl}${params}`);
  }

  /**
   * The list without code (`lean=1`, P6 U5): base dogs and dogs in one list, sorted by the server
   * (`proven` = list_nodes' order, 8.26). With `kennelId` only what the kennel does not hold yet.
   */
  getCatalog(
    query: { sort?: string; dir?: 'asc' | 'desc'; kennelId?: string; q?: string; usage?: UsageFilter; minReliability?: number } = {},
  ): Observable<ApiResponse<DogInfo[]>> {
    let params = new HttpParams().set('lean', '1');
    if (query.sort) params = params.set('sort', query.sort);
    if (query.dir) params = params.set('dir', query.dir);
    if (query.q) params = params.set('q', query.q);
    // Aufruf-Filter wie list_nodes (top | never_used | never_worked | failing | dormant) und Zuverlaessigkeit 0..1.
    if (query.usage) params = params.set('usage', query.usage);
    if (query.minReliability !== undefined) params = params.set('minReliability', String(query.minReliability));
    if (query.kennelId) params = params.set('kennelId', query.kennelId);
    return this.http.get<ApiResponse<DogInfo[]>>(this.baseUrl, { params });
  }

  /**
   * The catalog for look-ups by id (the dog inspector's stats tab): one lean request, shared for a
   * minute — a dog's stats move with the 30 s flush, not with every click.
   */
  catalogOnce(): Observable<DogInfo[]> {
    const now = Date.now();
    if (!this.catalogCache || now - this.catalogCache.at > CATALOG_TTL_MS) {
      this.catalogCache = {
        at: now,
        list: this.getCatalog().pipe(
          map((res) => res.data ?? []),
          tap({ error: () => (this.catalogCache = null) }),
          shareReplay({ bufferSize: 1, refCount: false }),
        ),
      };
    }
    return this.catalogCache.list;
  }

  private catalogCache: { at: number; list: Observable<DogInfo[]> } | null = null;

  getById(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /** Wo der Dog laeuft (P4b): Kennels, Abhaengige, Abhaengigkeiten. `id` = lineageId, Version oder `base:X`. */
  getUsage(id: string): Observable<IDogUsage> {
    return this.http.get<IDogUsage>(`${this.baseUrl}/${encodeURIComponent(id)}/usage`);
  }

  getVersions(id: string): Observable<ApiResponse<VersionEntry[]>> {
    return this.http.get<ApiResponse<VersionEntry[]>>(`${this.baseUrl}/${encodeURIComponent(id)}/versions`);
  }

  create(data: {
    displayName?: string;
    baseId?: string;
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl, {
      ...data,
      displayName: data.displayName || data.baseId,
    });
  }

  save(id: string, data: {
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`/save?id=${encodeURIComponent(id)}`, data);
  }

  rename(lineageId: string, displayName: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(lineageId)}/rename`, { displayName });
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
