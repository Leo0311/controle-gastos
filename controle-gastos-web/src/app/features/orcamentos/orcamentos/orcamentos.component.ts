import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { OrcamentoService } from '../../../services/orcamento.service';
import { Orcamento, OrcamentoMes } from '../../../models/orcamento.model';
import { OrcamentoFormDialogComponent, OrcamentoFormDialogData } from '../orcamento-form-dialog/orcamento-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-orcamentos',
  standalone: true,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule,
    EmptyStateComponent
  ],
  templateUrl: './orcamentos.component.html',
  styleUrl: './orcamentos.component.css'
})
export class OrcamentosComponent implements OnInit {

  readonly colunas = ['categoria', 'valorLimite', 'percentual', 'status', 'acoes'];

  readonly meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' }
  ];

  readonly anos: number[];

  mes = new Date().getMonth() + 1;
  ano = new Date().getFullYear();

  orcamentos: OrcamentoMes[] = [];
  carregando = false;

  constructor(
    private readonly orcamentoService: OrcamentoService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.orcamentoService.verMes(this.mes, this.ano).subscribe({
      next: (orcamentos) => {
        this.orcamentos = orcamentos;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar os orçamentos. Verifique se a API está no ar.');
      }
    });
  }

  novoOrcamento(): void {
    const ref = this.dialog.open<OrcamentoFormDialogComponent, OrcamentoFormDialogData, Orcamento>(
      OrcamentoFormDialogComponent,
      { data: { mes: this.mes, ano: this.ano }, width: '480px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.orcamentoService.definir(resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Orçamento definido com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  editar(orcamento: OrcamentoMes): void {
    const ref = this.dialog.open<OrcamentoFormDialogComponent, OrcamentoFormDialogData, Orcamento>(
      OrcamentoFormDialogComponent,
      {
        data: {
          mes: this.mes,
          ano: this.ano,
          orcamento: { id: orcamento.id, categoria: orcamento.categoria, valorLimite: orcamento.valorLimite, mes: this.mes, ano: this.ano }
        },
        width: '480px',
        maxWidth: '95vw'
      }
    );

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.orcamentoService.atualizar(orcamento.id, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Orçamento atualizado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  percentualUsado(orcamento: OrcamentoMes): number {
    if (!orcamento.valorLimite || orcamento.valorLimite <= 0) {
      return 0;
    }
    return Math.min(100, (orcamento.gasto / orcamento.valorLimite) * 100);
  }

  percentualExibido(orcamento: OrcamentoMes): number {
    if (!orcamento.valorLimite || orcamento.valorLimite <= 0) {
      return 0;
    }
    return Math.round((orcamento.gasto / orcamento.valorLimite) * 100);
  }

  corProgresso(orcamento: OrcamentoMes): 'ok' | 'atencao' | 'alerta' {
    if (orcamento.ultrapassou) {
      return 'alerta';
    }
    if (orcamento.proximoDoLimite) {
      return 'atencao';
    }
    return 'ok';
  }

  excluir(orcamento: OrcamentoMes): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir orçamento',
        mensagem: `Tem certeza que deseja excluir o orçamento de "${orcamento.categoria}"?`
      }
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.orcamentoService.excluir(orcamento.id).subscribe({
        next: () => {
          this.mostrarSucesso('Orçamento excluído com sucesso!');
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
