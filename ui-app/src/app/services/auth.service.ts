import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { IAuthState, IUser } from '../models/user.model';
import { apiAbsoluteUrl } from '../config/api-base';

/**
 * Tracks the current Google-authenticated user via the cookie session.
 * The MCP gateway exposes /auth/me, /auth/google/login, /auth/logout.
 *
 * Note: when MCP_AUTH_REQUIRED=false on the backend, /auth/me still returns
 * { authenticated: false } because no session is established. The backend
 * treats every request as super-user, so visibility filters are bypassed
 * regardless of the UI's authenticated state.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);

    private _user = signal<IUser | null>(null);
    private _checked = signal(false);

    readonly user = this._user.asReadonly();
    readonly isAuthenticated = computed(() => this._user() !== null);
    readonly isReady = this._checked.asReadonly();

    /** Loads the current session into the signals. Safe to call multiple times. */
    async refresh(): Promise<void> {
        try {
            const state = await firstValueFrom(this.http.get<IAuthState>('/auth/me'));
            this._user.set(state.authenticated && state.user ? state.user : null);
        } catch {
            this._user.set(null);
        } finally {
            this._checked.set(true);
        }
    }

    /** Redirects to Google. After login the user lands on /auth/me by default; pass returnTo to come back here. */
    login(returnTo?: string, betaKey?: string): void {
        const target = returnTo ?? window.location.pathname + window.location.search;
        // Closed beta: the key rides along once; the server keeps it for the callback.
        const key = betaKey?.trim();
        const url = apiAbsoluteUrl('/auth/google/login') + '?returnTo=' + encodeURIComponent(target)
            + (key ? '&betaKey=' + encodeURIComponent(key) : '');
        window.location.href = url;
    }

    async logout(): Promise<void> {
        try {
            await firstValueFrom(this.http.post('/auth/logout', {}));
        } catch {
            // ignore — even if the request fails, drop the local state
        }
        this._user.set(null);
    }
}
