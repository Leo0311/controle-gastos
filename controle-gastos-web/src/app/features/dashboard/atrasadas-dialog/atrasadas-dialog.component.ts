import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Gasto } from '../../../models/gasto.model';
import { GastoService } from '../../../services/gasto.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import {
  PagarContaDialogComponent,
  PagarContaDialogData,
  PagarContaResultado
} from '../../../shared/pagar-conta-dialog/pagar-conta-dialog.component';

/**
 * Lista as contas atrasadas do usuário (vindas de GET /api/gastos/atrasadas) com
 * uma ação "Marcar como paga" por item, reaproveitando o diálogo de pagamento.
 * Fecha devolvendo `true` se ao menos uma conta foi paga - o Dashboard recarrega
 * nesse caso (pagar pode mover gastos entre meses).
 */
@Component({
  selector: 'app-atrasadas-dialog',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './atrasadas-dialog.component.html',
  styleUrl: './atrasadas-dialog.component.css'
})
export class AtrasadasDialogComponent {

  private readonly dialog = inject(MatDialog);
  private readonly gastoService = inject(GastoService);
  private readonly notificacao = inject(NotificacaoService);

  atrasadas: Gasto[];
  private houvePagamento = false;

  constructor(
    private readonly dialogRef: MatDialogRef<AtrasadasDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) data: Gasto[]
  ) {
    this.atrasadas = [...data];
  }

  marcarComoPaga(gasto: Gasto): void {
    const ref = this.dialog.open<PagarContaDialogComponent, PagarContaDialogData, PagarContaResultado>(
      PagarContaDialogComponent,
      {
        data: {
          titulo: 'Marcar como paga',
          descricao: gasto.descricao,
          valorPrevisto: gasto.valor,
          dataInicial: new Date()
        },
        width: '420px',
        maxWidth: '95vw'
      }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.pagar(gasto.id!, resultado).subscribe({
        next: () => {
          this.notificacao.sucesso('Pagamento confirmado.');
          this.atrasadas = this.atrasadas.filter((g) => g.id !== gasto.id);
          this.houvePagamento = true;
          if (this.atrasadas.length === 0) {
            this.dialogRef.close(true);
          }
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  fechar(): void {
    this.dialogRef.close(this.houvePagamento);
  }
}
