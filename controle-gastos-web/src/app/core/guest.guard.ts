import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Inverso do authGuard: protege /login, /cadastro e /esqueci-senha de quem já
// tem sessão válida (navegação direta por URL, aba antiga, botão "voltar" do
// navegador) - sem isto o cabeçalho autenticado e o formulário de auth
// apareciam sobrepostos na mesma tela (achado da varredura Playwright de
// 2026-09-10). Sem sessão, deixa passar normalmente.
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.autenticado) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
