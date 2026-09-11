import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { provedoresDeTeste } from '../testing/test-providers';
import { AuthService } from '../services/auth.service';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  function configurar(autenticado: boolean) {
    TestBed.configureTestingModule({
      providers: [
        ...provedoresDeTeste(),
        { provide: AuthService, useValue: { autenticado } }
      ]
    });
  }

  function executarGuard(): boolean {
    return TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never)) as boolean;
  }

  it('deixa passar quando não há sessão', () => {
    configurar(false);

    const resultado = executarGuard();

    expect(resultado).toBe(true);
  });

  it('redireciona pro dashboard e bloqueia quando já há sessão', () => {
    configurar(true);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const resultado = executarGuard();

    expect(resultado).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });
});
