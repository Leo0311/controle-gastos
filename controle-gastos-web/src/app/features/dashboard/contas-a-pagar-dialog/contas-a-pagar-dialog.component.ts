import { CurrencyPipe } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Gasto } from '../../../models/gasto.model';
import { GastoService } from '../../../services/gasto.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import { hojeIso } from '../../../core/status-conta';
import {
  PagarContaDialogComponent,
  PagarContaDialogData,
  PagarContaResultado
} from '../../../shared/pagar-conta-dialog/pagar-conta-dialog.component';

export interface ContasAPagarDialogData {
  titulo: string;
  instrucao: string;
  gastos: Gasto[];
}

/**
 * Lista contas a pagar (atrasadas ou que vencem hoje - a diferença é só o
 * título/instrução, passados pelo chamador) com uma ação "Marcar como paga" por
 * item, reaproveitando o diálogo de pagamento. Fecha devolvendo `true` se ao
 * menos uma conta foi paga - o Dashboard recarrega nesse caso.
 */
@Component({
  selector: 'app-contas-a-pagar-dialog',
  standalone: true,
  imports: [CurrencyPipe, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './contas-a-pagar-dialog.component.html',
  styleUrl: './contas-a-pagar-dialog.component.css'
})
export class ContasAPagarDialogComponent {

  private readonly dialog = inject(MatDialog);
  private readonly gastoService = inject(GastoService);
  private readonly notificacao = inject(NotificacaoService);

  readonly titulo: string;
  readonly instrucao: string;
  gastos: Gasto[];
  private houvePagamento = false;

  constructor(
    private readonly dialogRef: MatDialogRef<ContasAPagarDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) data: ContasAPagarDialogData
  ) {
    this.titulo = data.titulo;
    this.instrucao = data.instrucao;
    this.gastos = [...data.gastos];
  }

  // "Venceu em 05/10" (atrasada) / "Vence hoje" / "Vence em 20/10" - o mesmo
  // diálogo serve para os dois destaques do Dashboard.
  rotuloVencimento(gasto: Gasto): string {
    const venc = gasto.vencimentoOriginal ?? gasto.data;
    const hoje = hojeIso();
    const formatada = venc.split('-').reverse().join('/');
    if (venc < hoje) {
      return `Venceu em ${formatada}`;
    }
    return venc === hoje ? 'Vence hoje' : `Vence em ${formatada}`;
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
          this.gastos = this.gastos.filter((g) => g.id !== gasto.id);
          this.houvePagamento = true;
          if (this.gastos.length === 0) {
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
