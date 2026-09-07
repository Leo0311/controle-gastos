import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { NotificacaoService } from '../../../core/notificacao.service';
import { rotuloCategoria, rotuloSubcategoria } from '../categoria-rotulo';
import { ResumoStatusConta } from '../../../core/status-conta';

/**
 * Aba "Parceladas" (achado M8). Lista as compras parceladas e permite excluí-las;
 * o cadastro é pelo formulário de novo gasto ("Parcelar compra"), não aqui. Os
 * mapas de categoria/subcategoria vêm do componente pai.
 */
@Component({
  selector: 'app-parceladas-lista',
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
  templateUrl: './parceladas-lista.component.html',
  styleUrls: ['./parceladas-lista.component.css', '../aba-comum.css', '../lista-cartoes.css']
})
export class ParceladasListaComponent implements OnInit {

  @Input() categoriasPorId = new Map<number, Categoria>();
  @Input() subcategoriasPorId = new Map<number, Subcategoria>();
  @Input() statusPorParcelada = new Map<number, ResumoStatusConta>();
  @Output() parceladaAlternada = new EventEmitter<void>();

  private readonly parceladaService = inject(CompraParceladaService);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(NotificacaoService);

  parceladas: CompraParcelada[] = [];
  carregando = false;
  erro = false;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = false;
    this.parceladaService.listarTodos().subscribe({
      next: (parceladas) => {
        this.parceladas = parceladas;
        this.carregando = false;
      },
      error: () => {
        this.parceladas = [];
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  excluirParcelada(parcelada: CompraParcelada): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir compra parcelada',
        mensagem: `Tem certeza que deseja excluir "${parcelada.descricao}"? A compra é removida por completo (ação `
          + 'definitiva, sem reativar) - as parcelas já vencidas (data igual ou anterior a hoje) continuam na '
          + 'listagem de Gastos como histórico, só as parcelas futuras são removidas.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.parceladaService.excluir(parcelada.id!).subscribe({
        next: () => {
          this.notificacao.sucesso('Compra parcelada excluída com sucesso!');
          this.carregar();
          this.parceladaAlternada.emit();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  // Quantas parcelas a compra tem hoje (do backend, contagem agregada). Sem o dado,
  // assume completo pra não sinalizar falso.
  parcelasLancadas(parcelada: CompraParcelada): number {
    return parcelada.parcelasLancadas ?? parcelada.numeroParcelas;
  }

  parcelamentoIncompleto(parcelada: CompraParcelada): boolean {
    return parcelada.parcelasLancadas != null && parcelada.parcelasLancadas < parcelada.numeroParcelas;
  }

  statusBadge(parceladaId: number | undefined): ResumoStatusConta {
    return (parceladaId != null ? this.statusPorParcelada.get(parceladaId) : null)
      ?? { pendentes: 0, atrasadas: 0 };
  }

  temVencidas(parceladaId: number | undefined): boolean {
    return this.statusBadge(parceladaId).atrasadas > 0;
  }

  // "Marcar parcelas vencidas como pagas": quita de uma vez as parcelas vencidas e
  // ainda pendentes, com valor/data previstos - sem confirmar parcela a parcela.
  marcarVencidasComoPagas(parcelada: CompraParcelada): void {
    const atrasadas = this.statusBadge(parcelada.id).atrasadas;
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Marcar parcelas vencidas como pagas',
        mensagem: `Marcar as ${atrasadas} parcela(s) vencida(s) de "${parcelada.descricao}" como pagas, cada `
          + 'uma no valor e na data previstos. As parcelas futuras não são afetadas.',
        textoConfirmar: 'Marcar como pagas',
        textoProcessando: 'Marcando…',
        acao: () => this.parceladaService.pagarVencidas(parcelada.id!)
      }
    });
    ref.afterClosed().subscribe((feito) => {
      if (!feito) {
        return;
      }
      this.notificacao.sucesso('Parcelas vencidas marcadas como pagas.');
      this.carregar();
      this.parceladaAlternada.emit();
    });
  }

  categoriaLabel(categoriaId: number): string {
    return rotuloCategoria(this.categoriasPorId, categoriaId);
  }

  subcategoriaLabel(subcategoriaId: number | null | undefined): string {
    return rotuloSubcategoria(this.subcategoriasPorId, subcategoriaId);
  }
}
