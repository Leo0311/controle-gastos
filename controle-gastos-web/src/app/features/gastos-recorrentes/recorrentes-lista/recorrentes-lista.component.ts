import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import {
  GastoRecorrenteFormDialogComponent,
  GastoRecorrenteFormDialogData
} from '../gasto-recorrente-form-dialog/gasto-recorrente-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { NotificacaoService } from '../../../core/notificacao.service';
import { rotuloCategoria, rotuloSubcategoria } from '../categoria-rotulo';
import { mensagemPausaRecorrente } from '../mensagem-pausa';

/**
 * Aba "Recorrentes" (achado M8: gastos-recorrentes.component.ts, 3 sub-telas num
 * componente só, virou 3). O pai carrega os mapas de categoria/subcategoria e a
 * contagem de lançamentos futuros (da mesma leitura de gastos da aba "Próximas
 * contas") e os passa como input; este componente cuida só da lista de
 * recorrências e das suas ações. Avisa o pai (`recorrenciaAlternada`) quando
 * pausa/reativa uma recorrência, pra ele recarregar a aba "Próximas contas".
 */
@Component({
  selector: 'app-recorrentes-lista',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './recorrentes-lista.component.html',
  styleUrls: ['./recorrentes-lista.component.css', '../aba-comum.css', '../lista-cartoes.css']
})
export class RecorrentesListaComponent implements OnInit {

  @Input() categoriasPorId = new Map<number, Categoria>();
  @Input() subcategoriasPorId = new Map<number, Subcategoria>();
  @Input() lancamentosFuturosPorRecorrente = new Map<number, number>();
  @Output() recorrenciaAlternada = new EventEmitter<void>();

  private readonly service = inject(GastoRecorrenteService);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(NotificacaoService);

  recorrentes: GastoRecorrente[] = [];
  carregando = false;
  erro = false;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = false;
    this.service.listarTodos().subscribe({
      next: (recorrentes) => {
        this.recorrentes = recorrentes;
        this.carregando = false;
      },
      error: () => {
        this.recorrentes = [];
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  lancamentosFuturos(recorrenteId: number | undefined): number {
    return recorrenteId != null ? (this.lancamentosFuturosPorRecorrente.get(recorrenteId) ?? 0) : 0;
  }

  categoriaLabel(categoriaId: number): string {
    return rotuloCategoria(this.categoriasPorId, categoriaId);
  }

  subcategoriaLabel(subcategoriaId: number | null | undefined): string {
    return rotuloSubcategoria(this.subcategoriasPorId, subcategoriaId);
  }

  novoRecorrente(): void {
    this.abrirFormulario(null, 'Gasto recorrente cadastrado com sucesso!');
  }

  editar(recorrente: GastoRecorrente): void {
    this.abrirFormulario(recorrente, 'Gasto recorrente atualizado com sucesso!');
  }

  // O diálogo faz o cadastro/edição por conta própria (com spinner, ver
  // gasto-recorrente-form-dialog) e fecha devolvendo a recorrência já persistida,
  // ou undefined se foi cancelado. Aqui só o aviso e o recarregamento da lista.
  private abrirFormulario(recorrente: GastoRecorrente | null, mensagemSucesso: string): void {
    const ref = this.dialog.open<GastoRecorrenteFormDialogComponent, GastoRecorrenteFormDialogData, GastoRecorrente>(
      GastoRecorrenteFormDialogComponent,
      { data: { recorrente }, width: '480px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((salvo) => {
      if (!salvo) {
        return;
      }
      this.notificacao.sucesso(mensagemSucesso);
      this.carregar();
    });
  }

  alternarAtivo(recorrente: GastoRecorrente): void {
    // Reativar é inócuo (volta a gerar daqui pra frente); pausar tem uma
    // consequência que o chip sozinho não comunica, então confirma antes.
    if (recorrente.ativo) {
      this.confirmarPausa(recorrente);
    } else {
      this.executarAlternarAtivo(recorrente);
    }
  }

  private confirmarPausa(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Pausar recorrência',
        mensagem: mensagemPausaRecorrente(recorrente.descricao, this.lancamentosFuturos(recorrente.id))
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (confirmado) {
        this.executarAlternarAtivo(recorrente);
      }
    });
  }

  private executarAlternarAtivo(recorrente: GastoRecorrente): void {
    this.service.alternarAtivo(recorrente.id!).subscribe({
      next: (atualizado) => {
        this.notificacao.sucesso(atualizado.ativo ? 'Recorrência reativada.' : 'Recorrência pausada.');
        this.carregar();
        // reativar pode lançar o gasto do mês corrente; o pai recarrega o contador
        // e a aba "Próximas contas" pra refletir na hora.
        this.recorrenciaAlternada.emit();
      },
      error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
    });
  }

  excluir(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir recorrência',
        mensagem: `Excluir a recorrência "${recorrente.descricao}" vai remover TODOS os lançamentos gerados `
          + 'por ela (passados e futuros) e a recorrência deixará de existir. Esta ação não pode ser desfeita.',
        textoConfirmar: 'Excluir tudo',
        textoProcessando: 'Excluindo…',
        // O backend apaga os lançamentos e o registro numa transação só (atômico);
        // o diálogo fica com spinner e botões travados até terminar.
        acao: () => this.service.excluir(recorrente.id!)
      }
    });
    ref.afterClosed().subscribe((excluido) => {
      if (!excluido) {
        return;
      }
      this.notificacao.sucesso('Recorrência e todos os lançamentos dela foram excluídos.');
      this.carregar();
      // Os lançamentos removidos somem da aba "Próximas contas" e do contador de
      // "lançamentos futuros já gerados" - o pai recarrega o calendário.
      this.recorrenciaAlternada.emit();
    });
  }
}
