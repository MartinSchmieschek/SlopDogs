import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SdVoidCinemaComponent } from './components/sd-void-cinema/sd-void-cinema.component';
import { AuthBadgeComponent } from './components/auth-badge/auth-badge.component';
import { SdToastComponent } from './components/sd-toast/sd-toast.component';
import { SdConfirmComponent } from './components/sd-confirm/sd-confirm.component';
import { SdShortcutsComponent } from './components/sd-shortcuts/sd-shortcuts.component';
import { ConfirmService } from './services/confirm.service';

/** The shell: auth badge, the page, and the app-wide layers — toast, the asked dialog, key help, void cinema. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SdVoidCinemaComponent, AuthBadgeComponent, SdToastComponent, SdConfirmComponent, SdShortcutsComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly confirm = inject(ConfirmService);
}
