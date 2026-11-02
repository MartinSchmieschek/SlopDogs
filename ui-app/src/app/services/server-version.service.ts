import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** The fields of `GET /api/health` the footer line needs. */
interface HealthVersion {
  version?: string | null;
  core?: string | null;
  commit?: string | null;
}

/**
 * The running version as one footer line (`v0.2.0-beta.1 · core 0.3.3 · a1b2c3d`), the same line the landing and the
 * kennel list kennel show. Asked once per page load; an empty string when the request fails.
 */
@Injectable({ providedIn: 'root' })
export class ServerVersionService {
  private readonly http = inject(HttpClient);
  private pending: Promise<string> | null = null;

  line(): Promise<string> {
    this.pending ??= firstValueFrom(this.http.get<HealthVersion>('/api/health'))
      .then((h) => (h?.version ? [`v${h.version}`, h.core ? `core ${h.core}` : '', h.commit ?? ''].filter(Boolean).join(' · ') : ''))
      .catch(() => '');
    return this.pending;
  }
}
