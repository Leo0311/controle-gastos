import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
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

/**
 * Aba "Próximas contas" (achado M8). O componente pai carrega os gastos e monta o
 * `calendario` (ver proximas-contas.ts); aqui fica só a janela de meses visíveis
 * (uma parcelada de 120x são 120 mat-expansion-panel - renderizar todos de uma
 * vez trava a rolagem), a view e as ações de pagamento (item a item e "marcar mês
 * como pago" para os itens vencidos de um mês).
 */
@Component({
  selector: 'app-proximas-contas',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
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
export class ProximasContasComponent implements OnChanges {

  // calendario = todos os meses (o pai já monta tudo; o agrupamento é no cliente).
  @Input() calendario: GrupoMesCalendario[] = [];
  @Input() carregando = false;
  @Input() erro = false;
  @Output() tentarNovamente = new EventEmitter<void>();
  // Emitido depois que uma conta (ou um mês) é marcada como paga - o pai recarrega
  // os gastos e remonta o calendário/badges.
  @Output() contaPaga = new EventEmitter<void>();

  private readonly dialog = inject(MatDialog);
  private readonly gastoService = inject(GastoService);
  private readonly notificacao = inject(NotificacaoService);

  // calendarioVisivel = só a janela renderizada - não muda tráfego nem tempo de
  // resposta, só o que vai pro DOM.
  calendarioVisivel: GrupoMesCalendario[] = [];
  mesesRestantes = 0;
  proximoBloco = 0;
  private readonly INCREMENTO_MESES = 12;
  private mesesVisiveis = this.INCREMENTO_MESES;

  protected readonly formatarDiaMes = formatarDiaMes;
  protected readonly rotuloStatus = rotuloStatus;
  protected readonly classeStatus = classeStatus;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['calendario']) {
      // Lista nova (primeira carga ou recarga) reinicia a janela nos 12 primeiros
      // meses, igual ao carregarCalendario original.
      this.mesesVisiveis = this.INCREMENTO_MESES;
      this.atualizarJanela();
    }
  }

  // Recorta calendario na janela atual e recalcula quanto ainda falta. Os meses
  // revelados entram DEPOIS do botão (que fica no fim da lista), então a rolagem
  // não pula: o conteúdo acima do ponto de scroll não muda, o botão só desce.
  private atualizarJanela(): void {
    this.calendarioVisivel = this.calendario.slice(0, this.mesesVisiveis);
    this.mesesRestantes = Math.max(0, this.calendario.length - this.mesesVisiveis);
    this.proximoBloco = Math.min(this.INCREMENTO_MESES, this.mesesRestantes);
  }

  verMaisMeses(): void {
    this.mesesVisiveis += this.INCREMENTO_MESES;
    this.atualizarJanela();
  }

  verTodosOsMeses(): void {
    this.mesesVisiveis = this.calendario.length;
    this.atualizarJanela();
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
