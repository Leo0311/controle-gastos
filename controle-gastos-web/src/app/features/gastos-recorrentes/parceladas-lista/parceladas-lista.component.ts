import { Component, Input, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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

  categoriaLabel(categoriaId: number): string {
    return rotuloCategoria(this.categoriasPorId, categoriaId);
  }

  subcategoriaLabel(subcategoriaId: number | null | undefined): string {
    return rotuloSubcategoria(this.subcategoriasPorId, subcategoriaId);
  }
}
