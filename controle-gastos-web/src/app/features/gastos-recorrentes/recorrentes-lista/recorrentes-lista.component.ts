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
    const ref = this.dialog.open<GastoRecorrenteFormDialogComponent, GastoRecorrenteFormDialogData, GastoRecorrente>(
      GastoRecorrenteFormDialogComponent,
      { data: { recorrente: null }, width: '480px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.service.cadastrar(resultado).subscribe({
        next: () => {
          this.notificacao.sucesso('Gasto recorrente cadastrado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  editar(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<GastoRecorrenteFormDialogComponent, GastoRecorrenteFormDialogData, GastoRecorrente>(
      GastoRecorrenteFormDialogComponent,
      { data: { recorrente }, width: '480px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.service.atualizar(recorrente.id!, resultado).subscribe({
        next: () => {
          this.notificacao.sucesso('Gasto recorrente atualizado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
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
        titulo: 'Excluir gasto recorrente',
        mensagem: `Tem certeza que deseja excluir a recorrência "${recorrente.descricao}"? `
          + 'Os gastos de meses passados continuam intactos como histórico, mas os gastos a partir de hoje '
          + '(incluindo os já pré-gerados de meses futuros que ainda não venceram) serão removidos.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.service.excluir(recorrente.id!).subscribe({
        next: () => {
          this.notificacao.sucesso('Gasto recorrente excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }
}
