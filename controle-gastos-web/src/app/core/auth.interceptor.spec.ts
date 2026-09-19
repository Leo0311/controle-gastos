import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';

import { provedoresDeTeste } from '../testing/test-providers';
import { AuthService } from '../services/auth.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  function configurar(autenticado: boolean) {
    TestBed.configureTestingModule({
      providers: [
        ...provedoresDeTeste(),
        { provide: AuthService, useValue: { token: null, autenticado, sair: jasmine.createSpy('sair') } }
      ]
    });
  }

  function executar(status: number) {
    const req = new HttpRequest('GET', '/api/qualquer');
    const next = () => throwError(() => new HttpErrorResponse({ status }));

    return TestBed.runInInjectionContext(() =>
      authInterceptor(req, next).subscribe({ error: () => {} })
    );
  }

  it('fecha o diálogo aberto e navega pro /login quando recebe 401 autenticado', fakeAsync(() => {
    configurar(true);
    const dialog = TestBed.inject(MatDialog);
    dialog.open(ConfirmDialogComponent, {
      data: { titulo: 'Confirmar', mensagem: 'Teste' }
    });
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const authService = TestBed.inject(AuthService);

    expect(dialog.openDialogs.length).toBe(1);

    executar(401);
    tick();

    expect(authService.sair).toHaveBeenCalled();
    expect(dialog.openDialogs.length).toBe(0);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  }));

  it('não fecha diálogos nem navega quando o 401 chega sem sessão ativa', () => {
    configurar(false);
    const dialog = TestBed.inject(MatDialog);
    const closeAllSpy = spyOn(dialog, 'closeAll');
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    executar(401);

    expect(closeAllSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('ignora erros que não sejam 401', () => {
    configurar(true);
    const dialog = TestBed.inject(MatDialog);
    const closeAllSpy = spyOn(dialog, 'closeAll');
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    executar(500);

    expect(closeAllSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
