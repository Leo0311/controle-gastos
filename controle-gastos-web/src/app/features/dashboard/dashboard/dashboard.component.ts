import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChartConfiguration, ChartData, ActiveElement } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { GastoService } from '../../../services/gasto.service';
import { MetaService } from '../../../services/meta.service';
import { CategoriaService } from '../../../services/categoria.service';
import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { TemaService } from '../../../services/tema.service';
import { MetaMes, MetaRequest } from '../../../models/meta.model';
import { Gasto, TotalDiario } from '../../../models/gasto.model';
import { Categoria } from '../../../models/categoria.model';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import {
  DashboardDetalheDialogComponent,
  DashboardDetalheDialogData
} from '../dashboard-detalhe-dialog/dashboard-detalhe-dialog.component';
import { RendaFormDialogComponent, RendaFormDialogData } from '../renda-form-dialog/renda-form-dialog.component';
import { MetaFormDialogComponent, MetaFormDialogData } from '../meta-form-dialog/meta-form-dialog.component';

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
    MatButtonModule,
    MatCardModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    BaseChartDirective,
    EmptyStateComponent,
    ErroCarregamentoComponent
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
  // Falha ao carregar: mostra um card de erro no lugar dos números/gráficos, em
  // vez de cair pra zeros que pareceriam um mês real sem gastos (ver carregar()).
  erro = false;
  periodoDestaque: 'mes' | 'ano' = 'mes';

  totalMesSelecionado = 0;
  totalAnoSelecionado = 0;
  numeroGastosMes = 0;

  pizzaData: ChartData<'doughnut', number[], string> = { labels: [], datasets: [{ data: [] }] };
  // Não é mais `readonly`: as opções são reconstruídas (nova referência, pra
  // o ng2-charts perceber a mudança e re-renderizar) toda vez que o tema muda,
  // já que a cor padrão do texto do Chart.js (cinza escuro) fica ilegível
  // sobre o fundo escuro do dark mode - ver assinarMudancasDeTema().
  pizzaOptions: ChartConfiguration<'doughnut'>['options'] = this.construirPizzaOptions(false);

  barrasData: ChartData<'bar', number[], string> = { labels: [], datasets: [{ label: 'Total gasto', data: [] }] };
  barrasOptions: ChartConfiguration<'bar'>['options'] = this.construirBarrasOptions(false);

  metaMes: MetaMes | null = null;

  private categoriasPorId = new Map<number, Categoria>();
  // Nomes puros (sem emoji) na mesma ordem de pizzaData.labels - usado pro clique na
  // fatia, já que o rótulo exibido tem o emoji prefixado e não bate mais com
  // gasto.categoria (texto puro) no filtro do dialog de detalhe.
  private nomesCategoriaPizza: string[] = [];

  constructor(
    private readonly gastoService: GastoService,
    private readonly metaService: MetaService,
    private readonly categoriaService: CategoriaService,
    private readonly gastoRecorrenteService: GastoRecorrenteService,
    private readonly temaService: TemaService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    // Reconstrói as opções dos gráficos (cor do texto/eixos/grade) sempre que
    // o tema mudar, pra nunca ficarem ilegíveis no dark mode.
    this.temaService.escuro$.subscribe((escuro) => {
      this.pizzaOptions = this.construirPizzaOptions(escuro);
      this.barrasOptions = this.construirBarrasOptions(escuro);
    });

    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji na legenda do gráfico de pizza */ }
    });
    this.carregar();

    // Verifica e lança gastos recorrentes pendentes do mês, de forma transparente
    // (sem aviso algum) - só recarrega os totais se algo novo foi lançado.
    this.gastoRecorrenteService.lancarPendentes().subscribe({
      next: (lancados) => {
        if (lancados.length > 0) {
          this.carregar();
        }
      },
      error: () => { /* verificação transparente; falha aqui não deve incomodar o usuário */ }
    });
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
    this.erro = false;

    const inicioMes = this.formatarData(new Date(this.ano, this.mes - 1, 1));
    const fimMes = this.formatarData(new Date(this.ano, this.mes, 0));
    const inicioAno = `${this.ano}-01-01`;
    const fimAno = `${this.ano}-12-31`;

    forkJoin({
      gastosMes: this.gastoService.listarPorPeriodo(inicioMes, fimMes),
      gastosAno: this.gastoService.listarPorPeriodo(inicioAno, fimAno),
      // "Distribuição por categoria" sempre reflete o mês/ano selecionado no topo,
      // independente do toggle "Destacar mês"/"Destacar ano" (que só afeta o gráfico
      // de barras abaixo) - resumo do mês, nunca do ano inteiro.
      resumo: this.gastoService.resumo(inicioMes, fimMes),
      // Só busca os totais diários quando realmente vão ser exibidos (toggle "Destacar
      // mês") - evita uma chamada à API sem uso quando o gráfico anual está ativo.
      totaisDiarios: this.periodoDestaque === 'mes'
        ? this.gastoService.totaisDiarios(this.mes, this.ano)
        : of<TotalDiario[]>([]),
      metaMes: this.metaService.metaDoMes(this.mes, this.ano)
    }).subscribe({
      next: ({ gastosMes, gastosAno, resumo, totaisDiarios, metaMes }) => {
        this.totalMesSelecionado = gastosMes.reduce((soma, g) => soma + g.valor, 0);
        this.numeroGastosMes = gastosMes.length;
        this.totalAnoSelecionado = gastosAno.reduce((soma, g) => soma + g.valor, 0);

        this.nomesCategoriaPizza = resumo.porCategoria.map(c => c.categoria);
        this.pizzaData = {
          labels: resumo.porCategoria.map(c => {
            const emoji = c.categoriaId ? this.categoriasPorId.get(c.categoriaId)?.emoji : null;
            return emoji ? `${emoji} ${c.categoria}` : c.categoria;
          }),
          datasets: [{
            data: resumo.porCategoria.map(c => c.total),
            backgroundColor: resumo.porCategoria.map((_, i) => CORES_CATEGORIAS[i % CORES_CATEGORIAS.length])
          }]
        };

        this.barrasData = this.periodoDestaque === 'mes'
          ? this.construirBarrasDiarias(totaisDiarios)
          : this.construirBarrasAnuais(gastosAno);
        this.metaMes = metaMes;

        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  // Um dia (1 até o último dia do mês selecionado) por barra - usado quando
  // "Destacar mês" está ativo. dia=1 corresponde ao índice 0 (ver onBarraClick).
  private construirBarrasDiarias(totaisDiarios: TotalDiario[]): ChartData<'bar', number[], string> {
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    const totalPorDia = new Array(diasNoMes).fill(0);
    totaisDiarios.forEach((t) => { totalPorDia[t.dia - 1] = t.total; });
    return {
      labels: Array.from({ length: diasNoMes }, (_, i) => String(i + 1)),
      datasets: [{ label: 'Total gasto', data: totalPorDia, backgroundColor: '#3f51b5' }]
    };
  }

  // Os 12 meses (Jan-Dez) do ano selecionado - usado quando "Destacar ano" está
  // ativo. Reaproveita gastosAno (já buscado pro card "Total gasto em {{ ano }}"),
  // agregando por mês no cliente em vez de mais uma chamada.
  private construirBarrasAnuais(gastosAno: Gasto[]): ChartData<'bar', number[], string> {
    const totalPorMes = new Array(12).fill(0);
    gastosAno.forEach((g) => {
      const mes = Number(g.data.split('-')[1]);
      totalPorMes[mes - 1] += g.valor;
    });
    return {
      labels: NOMES_MESES,
      datasets: [{ label: 'Total gasto', data: totalPorMes, backgroundColor: '#3f51b5' }]
    };
  }

  abrirDetalheMes(): void {
    this.abrirDetalhe({ mes: this.mes, ano: this.ano, categoria: null });
  }

  abrirDetalheAno(): void {
    this.abrirDetalhe({ mes: null, ano: this.ano, categoria: null });
  }

  onPizzaClick(evento: { active?: object[] }): void {
    const indice = (evento.active as ActiveElement[] | undefined)?.[0]?.index;
    if (indice === undefined) {
      return;
    }
    const categoria = this.nomesCategoriaPizza[indice] as string | undefined;
    if (!categoria) {
      return;
    }
    // A pizza sempre reflete o mês/ano selecionado (ver carregar()), independente do
    // toggle "Destacar mês"/"Destacar ano" - o detalhamento acompanha o mesmo período.
    this.abrirDetalhe({ mes: this.mes, ano: this.ano, categoria });
  }

  onBarraClick(evento: { active?: object[] }): void {
    const indice = (evento.active as ActiveElement[] | undefined)?.[0]?.index;
    if (indice === undefined) {
      return;
    }
    if (this.periodoDestaque === 'mes') {
      // Índice 0 corresponde ao dia 1 do mês selecionado (ver construirBarrasDiarias).
      this.abrirDetalhe({ mes: this.mes, ano: this.ano, dia: indice + 1, categoria: null });
    } else {
      // Índice 0-11 corresponde diretamente a Jan-Dez do ano selecionado (ver
      // construirBarrasAnuais).
      this.abrirDetalhe({ mes: indice + 1, ano: this.ano, categoria: null });
    }
  }

  private abrirDetalhe(data: DashboardDetalheDialogData): void {
    this.dialog.open<DashboardDetalheDialogComponent, DashboardDetalheDialogData>(
      DashboardDetalheDialogComponent,
      { data, width: '640px', maxWidth: '95vw' }
    );
  }

  get progressoMeta():
    { percentualBarra: number; percentualExibido: number; cor: 'verde' | 'amarelo' | 'vermelho'; estourouRenda: boolean }
    | null {
    const meta = this.metaMes;
    if (!meta || meta.rendaMensal == null || meta.valorMeta == null || meta.economiaReal == null) {
      return null;
    }

    // Compara a economia real com o quanto já era esperado ter economizado até
    // hoje (meta distribuída proporcionalmente pelos dias do mês), não com a
    // meta cheia - senão o primeiro dia do mês sempre pareceria "atrasado".
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    const proporcaoEsperada = this.diaDeReferencia(diasNoMes) / diasNoMes;
    const economiaEsperada = meta.valorMeta * proporcaoEsperada;

    let cor: 'verde' | 'amarelo' | 'vermelho';
    if (meta.economiaReal >= economiaEsperada) {
      cor = 'verde';
    } else if (meta.economiaReal >= economiaEsperada * 0.7) {
      cor = 'amarelo';
    } else {
      cor = 'vermelho';
    }

    const percentualExibido = meta.percentualMeta ?? 0;
    // Percentual negativo significa economia real negativa (gastou mais do que a
    // renda inteira, não só não bateu a meta de sobra) - visualmente é "pior que
    // 0%", então a barra deve aparecer cheia (100%, sempre vermelha) para deixar
    // claro que a situação é crítica, em vez de colapsar pra vazia como um
    // Math.max(0, ...) simples faria (parecendo que nada foi gasto).
    const estourouRenda = meta.economiaReal < 0;
    const percentualBarra = estourouRenda ? 100 : Math.min(100, Math.max(0, percentualExibido));

    return { percentualBarra, percentualExibido, cor, estourouRenda };
  }

  abrirDialogoRenda(): void {
    const ref = this.dialog.open<RendaFormDialogComponent, RendaFormDialogData, number>(
      RendaFormDialogComponent,
      { data: { rendaAtual: this.metaMes?.rendaMensal ?? null }, width: '420px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((rendaMensal) => {
      if (rendaMensal == null) {
        return;
      }
      this.metaService.atualizarRenda(rendaMensal).subscribe({
        next: () => {
          this.snackBar.open('Renda mensal atualizada com sucesso!', 'Fechar', { duration: 3000 });
          this.carregar();
        },
        error: () => this.snackBar.open('Não foi possível atualizar a renda mensal.', 'Fechar', { duration: 5000 })
      });
    });
  }

  abrirDialogoMeta(): void {
    const ref = this.dialog.open<MetaFormDialogComponent, MetaFormDialogData, MetaRequest>(
      MetaFormDialogComponent,
      {
        data: {
          mes: this.mes,
          ano: this.ano,
          nomeMes: this.nomeMesSelecionado,
          valorMetaAtual: this.metaMes?.valorMeta ?? null
        },
        width: '420px',
        maxWidth: '95vw'
      }
    );

    ref.afterClosed().subscribe((meta) => {
      if (!meta) {
        return;
      }
      this.metaService.definir(meta).subscribe({
        next: () => {
          this.snackBar.open('Meta de economia definida com sucesso!', 'Fechar', { duration: 3000 });
          this.carregar();
        },
        error: () => this.snackBar.open('Não foi possível definir a meta.', 'Fechar', { duration: 5000 })
      });
    });
  }

  private diaDeReferencia(diasNoMes: number): number {
    const hoje = new Date();
    if (hoje.getFullYear() === this.ano && hoje.getMonth() + 1 === this.mes) {
      return hoje.getDate();
    }
    const inicioMesSelecionado = new Date(this.ano, this.mes - 1, 1);
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return inicioMesSelecionado < inicioMesAtual ? diasNoMes : 0;
  }

  private construirPizzaOptions(escuro: boolean): ChartConfiguration<'doughnut'>['options'] {
    const corTexto = escuro ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (evento, elementos) => {
        const alvo = evento.native?.target as HTMLElement | undefined;
        if (alvo) {
          alvo.style.cursor = elementos.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: { legend: { position: 'bottom', labels: { color: corTexto } } }
    };
  }

  private construirBarrasOptions(escuro: boolean): ChartConfiguration<'bar'>['options'] {
    const corTexto = escuro ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)';
    const corGrade = escuro ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (evento, elementos) => {
        const alvo = evento.native?.target as HTMLElement | undefined;
        if (alvo) {
          alvo.style.cursor = elementos.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: corTexto }, grid: { color: corGrade } },
        x: { ticks: { color: corTexto }, grid: { color: corGrade } }
      }
    };
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
