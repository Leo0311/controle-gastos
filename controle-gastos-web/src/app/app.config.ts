import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, isDevMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';

import { FORMATOS_DATA_PT_BR, PtBrDateAdapter } from './core/pt-br-date-adapter';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    // DateAdapter pt-BR (dd/MM/aaaa) - substitui o provideNativeDateAdapter(),
    // cujo parse de texto quebrava ao digitar a data manualmente (ver
    // PtBrDateAdapter).
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: DateAdapter, useClass: PtBrDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: FORMATOS_DATA_PT_BR },
    provideCharts(withDefaultRegisterables()),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
