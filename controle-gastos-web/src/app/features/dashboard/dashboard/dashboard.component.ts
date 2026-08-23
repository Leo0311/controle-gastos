import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChartConfiguration, ChartData, ActiveElement } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { GastoService } from '../../../services/gasto.service';
import { TotalMensal } from '../../../models/gasto.model';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

const CORES_CATEGORIAS = [
  '#3f51b5', '#e91e63', '#009688', '#ff9800', '#9c27b0',
  '#4caf50', '#f44336', '#00bcd4', '#795548', '#607d8b'
];

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const NOMES_MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatCardModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    BaseChartDirective,
    EmptyStateComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {

  readonly meses = NOMES_MESES_COMPLETO.map((nome, i) => ({ valor: i + 1, nome }));
  readonly anos: number[];

  mes = new Date().getMonth() + 1;
  ano = new Date().getFullYear();

  carregando = false;
  periodoDestaque: 'mes' | 'ano' = 'mes';

  totalMesSelecionado = 0;
  totalAnoSelecionado = 0;
  numeroGastosMes = 0;

  pizzaData: ChartData<'doughnut', number[], string> = { labels: [], datasets: [{ data: [] }] };
  readonly pizzaOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (evento, elementos) => {
      const alvo = evento.native?.target as HTMLElement | undefined;
      if (alvo) {
        alvo.style.cursor = elementos.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: { legend: { position: 'bottom' } }
  };

  barrasData: ChartData<'bar', number[], string> = { labels: [], datasets: [{ label: 'Total gasto', data: [] }] };
  readonly barrasOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (evento, elementos) => {
      const alvo = evento.native?.target as HTMLElement | undefined;
      if (alvo) {
        alvo.style.cursor = elementos.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  private totaisMensaisAtuais: TotalMensal[] = [];

  constructor(
    private readonly gastoService: GastoService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    this.carregar();
  }

  onPeriodoChange(evento: MatButtonToggleChange): void {
    this.periodoDestaque = evento.value;
    this.carregar();
  }

  get nomeMesSelecionado(): string {
    return this.meses.find((m) => m.valor === this.mes)?.nome ?? '';
  }

  carregar(): void {
    this.carregando = true;

    const inicioMes = this.formatarData(new Date(this.ano, this.mes - 1, 1));
    const fimMes = this.formatarData(new Date(this.ano, this.mes, 0));
    const inicioAno = `${this.ano}-01-01`;
    const fimAno = `${this.ano}-12-31`;

    // A "Distribuição por categoria" acompanha o período em destaque (mês ou ano
    // selecionado acima), em vez de somar gastos de todos os tempos.
    const inicioResumo = this.periodoDestaque === 'mes' ? inicioMes : inicioAno;
    const fimResumo = this.periodoDestaque === 'mes' ? fimMes : fimAno;

    forkJoin({
      gastosMes: this.gastoService.listarPorPeriodo(inicioMes, fimMes),
      gastosAno: this.gastoService.listarPorPeriodo(inicioAno, fimAno),
      resumo: this.gastoService.resumo(inicioResumo, fimResumo),
      totaisMensais: this.gastoService.totaisMensais(6)
    }).subscribe({
      next: ({ gastosMes, gastosAno, resumo, totaisMensais }) => {
        this.totalMesSelecionado = gastosMes.reduce((soma, g) => soma + g.valor, 0);
        this.numeroGastosMes = gastosMes.length;
        this.totalAnoSelecionado = gastosAno.reduce((soma, g) => soma + g.valor, 0);

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
        this.totaisMensaisAtuais = totaisMensais;

        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.snackBar.open('Não foi possível carregar o dashboard. Verifique se a API está no ar.', 'Fechar', { duration: 5000 });
      }
    });
  }

  irParaGastosMes(): void {
    this.router.navigate(['/gastos'], { queryParams: { mes: this.mes, ano: this.ano } });
  }

  irParaGastosAno(): void {
    this.router.navigate(['/gastos'], { queryParams: { ano: this.ano } });
  }

  onPizzaClick(evento: { active?: object[] }): void {
    const indice = (evento.active as ActiveElement[] | undefined)?.[0]?.index;
    if (indice === undefined) {
      return;
    }
    const categoria = this.pizzaData.labels?.[indice] as string | undefined;
    if (!categoria) {
      return;
    }
    const queryParams = this.periodoDestaque === 'mes'
      ? { mes: this.mes, ano: this.ano, categoria }
      : { ano: this.ano, categoria };
    this.router.navigate(['/gastos'], { queryParams });
  }

  onBarraClick(evento: { active?: object[] }): void {
    const indice = (evento.active as ActiveElement[] | undefined)?.[0]?.index;
    if (indice === undefined) {
      return;
    }
    const total = this.totaisMensaisAtuais[indice];
    if (!total) {
      return;
    }
    this.router.navigate(['/gastos'], { queryParams: { mes: total.mes, ano: total.ano } });
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
