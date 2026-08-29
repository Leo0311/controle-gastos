import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { CategoriaService } from '../../../services/categoria.service';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import {
  GastoRecorrenteFormDialogComponent,
  GastoRecorrenteFormDialogData
} from '../gasto-recorrente-form-dialog/gasto-recorrente-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-gastos-recorrentes',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent
  ],
  templateUrl: './gastos-recorrentes.component.html',
  styleUrl: './gastos-recorrentes.component.css'
})
export class GastosRecorrentesComponent implements OnInit {

  private readonly service = inject(GastoRecorrenteService);
  private readonly parceladaService = inject(CompraParceladaService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  recorrentes: GastoRecorrente[] = [];
  parceladas: CompraParcelada[] = [];
  carregando = false;
  carregandoParceladas = false;

  private categoriasPorId = new Map<number, Categoria>();
  private subcategoriasPorId = new Map<number, Subcategoria>();

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji/nome na listagem */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => { this.subcategoriasPorId = new Map(subcategorias.map((s) => [s.id!, s])); },
      error: () => { /* usado só pro nome na listagem */ }
    });
    this.carregar();
    this.carregarParceladas();
  }

  carregar(): void {
    this.carregando = true;
    this.service.listarTodos().subscribe({
      next: (recorrentes) => {
        this.recorrentes = recorrentes;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar os gastos recorrentes. Verifique se a API está no ar.');
      }
    });
  }

  carregarParceladas(): void {
    this.carregandoParceladas = true;
    this.parceladaService.listarTodos().subscribe({
      next: (parceladas) => {
        this.parceladas = parceladas;
        this.carregandoParceladas = false;
      },
      error: () => {
        this.carregandoParceladas = false;
        this.mostrarErro('Não foi possível carregar as compras parceladas. Verifique se a API está no ar.');
      }
    });
  }

  cancelarParcelada(parcelada: CompraParcelada): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Cancelar compra parcelada',
        mensagem: `Tem certeza que deseja cancelar "${parcelada.descricao}"? `
          + 'As parcelas já vencidas (data igual ou anterior a hoje) não são afetadas - só as parcelas futuras são removidas.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.parceladaService.excluir(parcelada.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Compra parcelada cancelada com sucesso!');
          this.carregarParceladas();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  categoriaLabel(categoriaId: number): string {
    const categoria = this.categoriasPorId.get(categoriaId);
    return categoria ? `${categoria.emoji} ${categoria.nome}` : '';
  }

  subcategoriaLabel(subcategoriaId: number | null | undefined): string {
    return subcategoriaId ? (this.subcategoriasPorId.get(subcategoriaId)?.nome ?? '') : '';
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
          this.mostrarSucesso('Gasto recorrente cadastrado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
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
          this.mostrarSucesso('Gasto recorrente atualizado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  alternarAtivo(recorrente: GastoRecorrente): void {
    this.service.alternarAtivo(recorrente.id!).subscribe({
      next: (atualizado) => {
        this.mostrarSucesso(atualizado.ativo ? 'Recorrência reativada.' : 'Recorrência pausada.');
        this.carregar();
      },
      error: (erro) => this.mostrarErro(this.mensagemErro(erro))
    });
  }

  excluir(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir gasto recorrente',
        mensagem: `Tem certeza que deseja excluir a recorrência "${recorrente.descricao}"? `
          + 'Os gastos já lançados no passado não são afetados - só deixam de ser lançados novos meses.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.service.excluir(recorrente.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto recorrente excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  private mensagemErro(erro: unknown): string {
    const erroHttp = erro as { error?: { erro?: string } };
    return erroHttp?.error?.erro ?? 'Ocorreu um erro inesperado.';
  }

  private mostrarSucesso(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 3000 });
  }

  private mostrarErro(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 5000 });
  }
}
