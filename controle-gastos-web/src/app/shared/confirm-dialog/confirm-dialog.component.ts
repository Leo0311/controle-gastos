import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

import { NotificacaoService } from '../../core/notificacao.service';

export interface ConfirmDialogData {
  titulo: string;
  mensagem: string;
  /** Rótulo do botão de confirmar (padrão "Confirmar"). */
  textoConfirmar?: string;
  /** Rótulo do botão enquanto `acao` roda (padrão "Processando…"). */
  textoProcessando?: string;
  /**
   * Se fornecida, o diálogo executa esta ação ao confirmar: fica aberto com
   * spinner e os dois botões travados (e `disableClose` contra ESC/backdrop) até
   * terminar. Fecha com `true` no sucesso; no erro, destrava e mostra a mensagem,
   * sem fechar. Sem `acao`, o diálogo só devolve `true`/`false` como antes.
   */
  acao?: () => Observable<unknown>;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {

  private readonly notificacao = inject(NotificacaoService);

  processando = false;

  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  cancelar(): void {
    if (this.processando) {
      return;
    }
    this.dialogRef.close(false);
  }

  confirmar(): void {
    if (this.processando) {
      return;
    }
    if (!this.data.acao) {
      this.dialogRef.close(true);
      return;
    }
    this.processando = true;
    this.dialogRef.disableClose = true;
    this.data.acao().subscribe({
      next: () => this.dialogRef.close(true),
      error: (erro) => {
        this.processando = false;
        this.dialogRef.disableClose = false;
        this.notificacao.erro(this.notificacao.mensagemDeErro(erro));
      }
    });
  }
}
