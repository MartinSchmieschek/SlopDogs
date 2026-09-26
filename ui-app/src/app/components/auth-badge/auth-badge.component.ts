import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { escapeLayerWhile } from '../../utils/escape-layers';

/**
 * Top-right badge (6.5 `sd-auth-badge`): signed out a quiet `Sign in` that goes to `/login` with the
 * way back; signed in the avatar and a menu — Account, Keys, Sign out (P6 U7).
 */
@Component({
    selector: 'app-auth-badge',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './auth-badge.component.html',
    styleUrls: ['./auth-badge.component.scss'],
})
export class AuthBadgeComponent implements OnInit {
    private auth = inject(AuthService);
    private router = inject(Router);

    readonly user = this.auth.user;
    readonly isReady = this.auth.isReady;
    readonly menuOpen = signal(false);

    readonly initial = computed(() => {
        const u = this.user();
        if (!u) return '?';
        const src = (u.name?.trim() || u.email).trim();
        return src.charAt(0).toUpperCase();
    });

    async ngOnInit(): Promise<void> {
        await this.auth.refresh();
    }

    toggleMenu(): void {
        this.menuOpen.update((v) => !v);
    }

    closeMenu(): void {
        this.menuOpen.set(false);
    }

    onLogin(): void {
        const here = this.router.url;
        const returnTo = here.startsWith('/login') ? '/kennels' : here;
        void this.router.navigate(['/login'], { queryParams: { returnTo } });
    }

    async onLogout(): Promise<void> {
        await this.auth.logout();
        this.menuOpen.set(false);
        if (this.router.url.startsWith('/account')) void this.router.navigate(['/kennels']);
    }

    constructor() {
        escapeLayerWhile(() => this.menuOpen(), () => this.closeMenu());
    }
}
