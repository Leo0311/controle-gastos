import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

/**
 * Providers mínimos p/ montar em teste um componente/serviço standalone do app:
 * HttpClient falso (+ o controller de testing), animações no-op e um Router
 * vazio. Cobre a maioria das telas e serviços, cujo único acoplamento a infra
 * é HttpClient (via um service fino) + Router + Angular Material.
 *
 * Telas com dependências além dessas (Chart.js, CurrencyPipe, tokens de diálogo)
 * espalham isto e acrescentam o que falta no próprio spec.
 */
export function provedoresDeTeste(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideNoopAnimations(),
    provideRouter([])
  ];
}
