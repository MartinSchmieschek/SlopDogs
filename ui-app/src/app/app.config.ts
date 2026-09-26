import { ApplicationConfig, ErrorHandler, Injectable, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

/**
 * Monaco cancels its pending work when an editor is disposed (a drawer closes, a tab switches) and lets the
 * promise reject with `Canceled` — nothing failed. Every other error goes to the console as before.
 */
@Injectable()
class SdErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    const e = (error as { rejection?: unknown })?.rejection ?? error;
    if ((e as { name?: string; message?: string })?.name === 'Canceled' && (e as { message?: string }).message === 'Canceled') return;
    super.handleError(error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideAnimations(),
    { provide: ErrorHandler, useClass: SdErrorHandler },
  ]
};
