import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Snackbars padrão do app e extração da mensagem de erro da API, num só lugar -
 * antes cada tela tinha suas cópias byte a byte de `mostrarSucesso`/`mostrarErro`/
 * `mensagemErro` (achado M5 da auditoria 2026-09-05). Casos fora do padrão
 * (panelClass próprio, snackbar com ação, duração custom) continuam chamando
 * `MatSnackBar` direto na tela.
 */
@Injectable({ providedIn: 'root' })
export class NotificacaoService {

  private readonly snackBar = inject(MatSnackBar);

  mostrar(mensagem: string, duracaoMs = 5000): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: duracaoMs });
  }

  sucesso(mensagem: string): void {
    this.mostrar(mensagem, 3000);
  }

  erro(mensagem: string): void {
    this.mostrar(mensagem, 5000);
  }

  // A API devolve erro no formato { erro: "mensagem em português" } (ver
  // GlobalExceptionHandler no backend); cai num texto genérico se não houver.
  mensagemDeErro(erro: unknown): string {
    const corpo = erro as { error?: { erro?: string } };
    return corpo?.error?.erro ?? 'Ocorreu um erro inesperado.';
  }
}
