import { Component, OnInit, inject } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { forkJoin } from 'rxjs';

import { CategoriaService } from '../../../services/categoria.service';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import {
  CategoriaFormDialogComponent,
  CategoriaFormDialogData
} from '../../../shared/categoria-form-dialog/categoria-form-dialog.component';
import {
  SubcategoriaFormDialogComponent,
  SubcategoriaFormDialogData,
  SubcategoriaFormResultado
} from '../../../shared/subcategoria-form-dialog/subcategoria-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    EmptyStateComponent
  ],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.css'
})
export class CategoriasComponent implements OnInit {

  private readonly categoriaService = inject(CategoriaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  categorias: Categoria[] = [];
  private subcategoriasPorCategoria = new Map<number, Subcategoria[]>();
  carregando = false;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    forkJoin({
      categorias: this.categoriaService.listarVisiveis(),
      subcategorias: this.categoriaService.listarTodasSubcategorias()
    }).subscribe({
      next: ({ categorias, subcategorias }) => {
        this.categorias = categorias;
        this.subcategoriasPorCategoria = new Map();
        for (const subcategoria of subcategorias) {
          const lista = this.subcategoriasPorCategoria.get(subcategoria.categoriaId) ?? [];
          lista.push(subcategoria);
          this.subcategoriasPorCategoria.set(subcategoria.categoriaId, lista);
        }
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar as categorias. Verifique se a API está no ar.');
      }
    });
  }

  subcategoriasDe(categoriaId: number): Subcategoria[] {
    return this.subcategoriasPorCategoria.get(categoriaId) ?? [];
  }

  novaCategoria(): void {
    const ref = this.dialog.open<CategoriaFormDialogComponent, CategoriaFormDialogData, Categoria>(
      CategoriaFormDialogComponent,
      { data: { categoria: null }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.criar(resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Categoria criada com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  editarCategoria(categoria: Categoria): void {
    const ref = this.dialog.open<CategoriaFormDialogComponent, CategoriaFormDialogData, Categoria>(
      CategoriaFormDialogComponent,
      { data: { categoria }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.atualizar(categoria.id!, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Categoria atualizada com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  excluirCategoria(categoria: Categoria): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir categoria',
        mensagem: `Tem certeza que deseja excluir a categoria "${categoria.nome}"? `
          + 'Isso também exclui as subcategorias dela.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.categoriaService.excluir(categoria.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Categoria excluída com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  novaSubcategoria(categoria: Categoria): void {
    const ref = this.dialog.open<SubcategoriaFormDialogComponent, SubcategoriaFormDialogData, SubcategoriaFormResultado>(
      SubcategoriaFormDialogComponent,
      { data: { categoriaNome: categoria.nome, subcategoria: null }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.criarSubcategoria(categoria.id!, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Subcategoria criada com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  editarSubcategoria(categoria: Categoria, subcategoria: Subcategoria): void {
    const ref = this.dialog.open<SubcategoriaFormDialogComponent, SubcategoriaFormDialogData, SubcategoriaFormResultado>(
      SubcategoriaFormDialogComponent,
      { data: { categoriaNome: categoria.nome, subcategoria }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.atualizarSubcategoria(subcategoria.id!, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Subcategoria atualizada com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  excluirSubcategoria(subcategoria: Subcategoria): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir subcategoria',
        mensagem: `Tem certeza que deseja excluir a subcategoria "${subcategoria.nome}"?`
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.categoriaService.excluirSubcategoria(subcategoria.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Subcategoria excluída com sucesso!');
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
