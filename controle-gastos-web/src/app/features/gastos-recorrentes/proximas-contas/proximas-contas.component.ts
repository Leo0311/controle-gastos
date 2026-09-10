import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';

import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { GrupoMesCalendario, ItemCalendario, formatarDiaMes } from '../proximas-contas';
import { classeStatus, rotuloStatus } from '../../../core/status-conta';
import { GastoService } from '../../../services/gasto.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import {
  PagarContaDialogComponent,
  PagarContaDialogData,
  PagarContaResultado
} from '../../../shared/pagar-conta-dialog/pagar-conta-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';

/** Opções do seletor de janela de meses da agenda. */
const OPCOES_MESES = [1, 3, 6, 12] as const;

/**
 * Aba "Próximas contas" (achado M8). O componente pai carrega a agenda
 * (GET /api/gastos/proximas-contas?meses=N) e monta o `calendario`; aqui fica o
 * seletor de janela de meses (1 / 3 / 6 / 12), a view por mês e as ações de
 * pagamento (item a item e "marcar mês como pago"). Trocar o seletor emite
 * `mesesAlterados` e o pai rebusca só a agenda, com spinner na lista.
 */
@Component({
  selector: 'app-proximas-contas',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './proximas-contas.component.html',
  styleUrls: ['./proximas-contas.component.css', '../aba-comum.css']
})
export class ProximasContasComponent {

  // calendario = os meses da janela atual, já agrupados pelo pai.
  @Input() calendario: GrupoMesCalendario[] = [];
  @Input() carregando = false;
  @Input() erro = false;
  // Janela de meses selecionada (controlada pelo pai, que faz a busca).
  @Input() meses = 1;
  @Output() mesesAlterados = new EventEmitter<number>();
  @Output() tentarNovamente = new EventEmitter<void>();
  // Emitido depois que uma conta (ou um mês) é marcada como paga - o pai recarrega
  // agenda + contadores.
  @Output() contaPaga = new EventEmitter<void>();

  private readonly dialog = inject(MatDialog);
  private readonly gastoService = inject(GastoService);
  private readonly notificacao = inject(NotificacaoService);

  protected readonly opcoesMeses = OPCOES_MESES;
  protected readonly formatarDiaMes = formatarDiaMes;
  protected readonly rotuloStatus = rotuloStatus;
  protected readonly classeStatus = classeStatus;

  onMesesChange(evento: MatButtonToggleChange): void {
    this.mesesAlterados.emit(evento.value);
  }

  // "Marcar como paga" de um item da agenda: abre o diálogo de confirmação (valor
  // previsto + hoje, editáveis) e chama a API. Só faz sentido pra item não pago.
  marcarComoPaga(item: ItemCalendario): void {
    const ref = this.dialog.open<PagarContaDialogComponent, PagarContaDialogData, PagarContaResultado>(
      PagarContaDialogComponent,
      {
        data: { titulo: 'Marcar como paga', descricao: item.descricao, valorPrevisto: item.valor, dataInicial: new Date() },
        width: '420px',
        maxWidth: '95vw'
      }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.pagar(item.id, resultado).subscribe({
        next: () => {
          this.notificacao.sucesso('Pagamento confirmado.');
          this.contaPaga.emit();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  // "Marcar mês como pago": quita de uma vez os itens vencidos e ainda pendentes
  // daquele mês, cada um no valor e na data previstos - sem diálogo por item.
  marcarMesComoPago(grupo: GrupoMesCalendario): void {
    const vencidos = grupo.itens.filter((i) => i.status === 'ATRASADA');
    if (vencidos.length === 0) {
      return;
    }
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Marcar mês como pago',
        mensagem: `Marcar as ${vencidos.length} conta(s) vencida(s) de ${grupo.rotulo} como pagas, cada uma no `
          + 'valor e na data previstos?',
        textoConfirmar: 'Marcar como pagas',
        textoProcessando: 'Marcando…',
        acao: () => forkJoin(vencidos.map((i) => this.gastoService.pagar(i.id, { valor: i.valor, data: i.data })))
      }
    });
    ref.afterClosed().subscribe((feito) => {
      if (!feito) {
        return;
      }
      this.notificacao.sucesso('Contas vencidas do mês marcadas como pagas.');
      this.contaPaga.emit();
    });
  }
}
