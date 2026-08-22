import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoService } from '../../../services/gasto.service';
import { Gasto } from '../../../models/gasto.model';
import { GastoFormDialogComponent, GastoFormDialogData } from '../gasto-form-dialog/gasto-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { exportarGastosCsv } from '../../../core/csv-exporter';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent
  ],
  templateUrl: './gastos.component.html',
  styleUrl: './gastos.component.css'
})
export class GastosComponent implements OnInit {

  readonly colunas = ['id', 'descricao', 'valor', 'categoria', 'data', 'acoes'];
  gastos: Gasto[] = [];
  carregando = false;

  constructor(
    private readonly gastoService: GastoService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        this.gastos = gastos;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar os gastos. Verifique se a API está no ar.');
      }
    });
  }

  novoGasto(): void {
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, Gasto>(GastoFormDialogComponent, {
      data: { gasto: null }
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.cadastrar(resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto cadastrado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  editar(gasto: Gasto): void {
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, Gasto>(GastoFormDialogComponent, {
      data: { gasto }
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.atualizar(gasto.id!, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto atualizado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  excluir(gasto: Gasto): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir gasto',
        mensagem: `Tem certeza que deseja excluir "${gasto.descricao}"?`
      }
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.gastoService.excluir(gasto.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  exportarTodos(): void {
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        if (gastos.length === 0) {
          this.mostrarErro('Nenhum gasto para exportar.');
          return;
        }
        exportarGastosCsv(gastos);
      },
      error: (erro) => this.mostrarErro(this.mensagemErro(erro))
    });
  }

  exportarExibidos(): void {
    if (this.gastos.length === 0) {
      this.mostrarErro('Nenhum gasto para exportar.');
      return;
    }
    exportarGastosCsv(this.gastos);
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
