import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { IAuthState, IUser } from '../models/user.model';
import { apiAbsoluteUrl } from '../config/api-base';

/**
 * Tracks the current user via /auth/me. With sign-in, that is the Google user of the cookie session
 * (/auth/google/login, /auth/logout). In the server's local mode /auth/me answers `mode: 'local'` with the
 * one local user: always signed in, no Google, no tokens. `localMode` tells the UI to hide every way in or out.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);

    private _user = signal<IUser | null>(null);
    private _checked = signal(false);
    private _localMode = signal(false);

    readonly user = this._user.asReadonly();
    readonly isAuthenticated = computed(() => this._user() !== null);
    readonly isReady = this._checked.asReadonly();
    /** The server runs in local mode: the local user is always signed in; login and logout do nothing. */
    readonly localMode = this._localMode.asReadonly();

    /** Loads the current session into the signals. Safe to call multiple times. */
    async refresh(): Promise<void> {
        try {
            const state = await firstValueFrom(this.http.get<IAuthState>('/auth/me'));
            this._user.set(state.authenticated && state.user ? state.user : null);
            this._localMode.set(state.mode === 'local');
        } catch {
            // The mode belongs to the server, not the session: a failed check leaves it as it was.
            this._user.set(null);
        } finally {
            this._checked.set(true);
        }
    }

    /**
     * Redirects to Google; pass returnTo to come back here. Does nothing before /auth/me has answered (nobody is
     * known yet, a signed-in or local user would be sent to Google) and nothing in local mode: the local user is
     * already signed in and the server has no /auth/google there, so there is nowhere to go.
     */
    login(returnTo?: string, betaKey?: string): void {
        if (!this._checked() || this._localMode()) return;
        const target = returnTo ?? window.location.pathname + window.location.search;
        // Closed beta: the key rides along once; the server keeps it for the callback.
        const key = betaKey?.trim();
        const url = apiAbsoluteUrl('/auth/google/login') + '?returnTo=' + encodeURIComponent(target)
            + (key ? '&betaKey=' + encodeURIComponent(key) : '');
        window.location.href = url;
    }

    /** Local mode: no sign-out, the user stays the local one and nothing is sent. */
    async logout(): Promise<void> {
        if (this._localMode()) return;
        try {
            await firstValueFrom(this.http.post('/auth/logout', {}));
        } catch {
            // ignore — even if the request fails, drop the local state
        }
        this._user.set(null);
    }
}
