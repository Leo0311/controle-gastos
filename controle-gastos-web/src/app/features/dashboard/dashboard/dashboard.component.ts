import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { GastoService } from '../../../services/gasto.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

const CORES_CATEGORIAS = [
  '#3f51b5', '#e91e63', '#009688', '#ff9800', '#9c27b0',
  '#4caf50', '#f44336', '#00bcd4', '#795548', '#607d8b'
];

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatCardModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    BaseChartDirective,
    EmptyStateComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {

  carregando = false;
  periodoDestaque: 'mes' | 'ano' = 'mes';

  totalMesAtual = 0;
  totalAnoAtual = 0;
  numeroGastosMes = 0;

  pizzaData: ChartData<'doughnut', number[], string> = { labels: [], datasets: [{ data: [] }] };
  readonly pizzaOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  barrasData: ChartData<'bar', number[], string> = { labels: [], datasets: [{ label: 'Total gasto', data: [] }] };
  readonly barrasOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  constructor(
    private readonly gastoService: GastoService,
    private readonly snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.carregar();
  }

  onPeriodoChange(evento: MatButtonToggleChange): void {
    this.periodoDestaque = evento.value;
  }

  carregar(): void {
    this.carregando = true;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const inicioMes = this.formatarData(new Date(anoAtual, mesAtual - 1, 1));
    const fimMes = this.formatarData(new Date(anoAtual, mesAtual, 0));
    const inicioAno = `${anoAtual}-01-01`;
    const fimAno = `${anoAtual}-12-31`;

    forkJoin({
      gastosMes: this.gastoService.listarPorPeriodo(inicioMes, fimMes),
      gastosAno: this.gastoService.listarPorPeriodo(inicioAno, fimAno),
      resumo: this.gastoService.resumo(),
      totaisMensais: this.gastoService.totaisMensais(6)
    }).subscribe({
      next: ({ gastosMes, gastosAno, resumo, totaisMensais }) => {
        this.totalMesAtual = gastosMes.reduce((soma, g) => soma + g.valor, 0);
        this.numeroGastosMes = gastosMes.length;
        this.totalAnoAtual = gastosAno.reduce((soma, g) => soma + g.valor, 0);

        this.pizzaData = {
          labels: resumo.porCategoria.map(c => c.categoria),
          datasets: [{
            data: resumo.porCategoria.map(c => c.total),
            backgroundColor: resumo.porCategoria.map((_, i) => CORES_CATEGORIAS[i % CORES_CATEGORIAS.length])
          }]
        };

        this.barrasData = {
          labels: totaisMensais.map(t => `${NOMES_MESES[t.mes - 1]}/${t.ano}`),
          datasets: [{
            label: 'Total gasto',
            data: totaisMensais.map(t => t.total),
            backgroundColor: '#3f51b5'
          }]
        };

        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.snackBar.open('Não foi possível carregar o dashboard. Verifique se a API está no ar.', 'Fechar', { duration: 5000 });
      }
    });
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
