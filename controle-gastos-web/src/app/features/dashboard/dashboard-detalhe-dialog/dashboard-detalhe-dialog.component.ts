import { Component, Inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoService } from '../../../services/gasto.service';
import { Gasto } from '../../../models/gasto.model';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

const NOMES_MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export interface DashboardDetalheDialogData {
  mes: number | null;
  ano: number;
  categoria: string | null;
}

@Component({
  selector: 'app-dashboard-detalhe-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    EmptyStateComponent
  ],
  templateUrl: './dashboard-detalhe-dialog.component.html',
  styleUrl: './dashboard-detalhe-dialog.component.css'
})
export class DashboardDetalheDialogComponent implements OnInit {

  readonly colunas = ['descricao', 'valor', 'categoria', 'data'];
  gastos: Gasto[] = [];
  carregando = true;

  constructor(
    private readonly gastoService: GastoService,
    private readonly router: Router,
    private readonly dialogRef: MatDialogRef<DashboardDetalheDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DashboardDetalheDialogData
  ) { }

  ngOnInit(): void {
    const [inicio, fim] = this.intervalo();
    this.gastoService.listarPorPeriodo(inicio, fim).subscribe({
      next: (gastos) => {
        this.gastos = this.data.categoria
          ? gastos.filter((g) => (g.categoria ?? '').trim().toLowerCase() === this.data.categoria!.trim().toLowerCase())
          : gastos;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
      }
    });
  }

  get titulo(): string {
    const periodo = this.data.mes ? `${NOMES_MESES_COMPLETO[this.data.mes - 1]}/${this.data.ano}` : `${this.data.ano}`;
    return this.data.categoria ? `${periodo} · ${this.data.categoria}` : periodo;
  }

  get total(): number {
    return this.gastos.reduce((soma, g) => soma + g.valor, 0);
  }

  fechar(): void {
    this.dialogRef.close();
  }

  irParaGastos(): void {
    const queryParams: Record<string, string | number> = { ano: this.data.ano };
    if (this.data.mes) {
      queryParams['mes'] = this.data.mes;
    }
    if (this.data.categoria) {
      queryParams['categoria'] = this.data.categoria;
    }
    this.dialogRef.close();
    this.router.navigate(['/gastos'], { queryParams });
  }

  private intervalo(): [string, string] {
    if (this.data.mes) {
      const inicio = new Date(this.data.ano, this.data.mes - 1, 1);
      const fim = new Date(this.data.ano, this.data.mes, 0);
      return [this.formatarData(inicio), this.formatarData(fim)];
    }
    return [`${this.data.ano}-01-01`, `${this.data.ano}-12-31`];
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
