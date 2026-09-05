import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoService } from '../../../services/gasto.service';
import { MetaService } from '../../../services/meta.service';
import { CategoriaService } from '../../../services/categoria.service';
import { Categoria } from '../../../models/categoria.model';
import { ComparacaoCategoria, RankingCategoria, RankingCategorias } from '../../../models/analise.model';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { MESES_OPCOES } from '../../../core/meses';
import { emojiDaCategoria } from '../../../core/categoria-emoji';

// Categoria que sozinha consome esse percentual (ou mais) da renda mensal recebe
// destaque visual de alerta - ver consomeMuitoDaRenda().
const LIMIAR_ALERTA_RENDA = 30;

@Component({
  selector: 'app-analises',
  standalone: true,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './analises.component.html',
  styleUrl: './analises.component.css'
})
export class AnalisesComponent implements OnInit {

  readonly meses = MESES_OPCOES;
  readonly anos: number[];

  mes = new Date().getMonth() + 1;
  ano = new Date().getFullYear();

  carregando = false;
  // Falha ao carregar: um único estado de erro no lugar de TUDO - antes, ranking
  // nulo + comparação vazia faziam a tela mostrar dois empty-states conflitantes
  // ("Nenhum gasto neste mês." e "Nenhum gasto nos dois meses.") ao mesmo tempo.
  erro = false;
  ranking: RankingCategorias | null = null;
  comparacao: ComparacaoCategoria[] = [];
  nomeMesAnterior = '';
  anoAnterior = 0;
  // Nula quando o usuário ainda não cadastrou a renda mensal (feature de Metas de
  // Economia) - nesse caso o alerta de "categoria consumindo % alto da renda" fica
  // omitido (ver consomeMuitoDaRenda), sem quebrar o resto da tela.
  rendaMensal: number | null = null;

  private categoriasPorId = new Map<number, Categoria>();

  constructor(
    private readonly gastoService: GastoService,
    private readonly metaService: MetaService,
    private readonly categoriaService: CategoriaService
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji na listagem */ }
    });
    this.carregar();
  }

  get nomeMesSelecionado(): string {
    return this.meses.find((m) => m.valor === this.mes)?.nome ?? '';
  }

  carregar(): void {
    this.carregando = true;
    this.erro = false;
    forkJoin({
      ranking: this.gastoService.rankingCategorias(this.mes, this.ano),
      comparacao: this.gastoService.comparacaoMensal(this.mes, this.ano),
      meta: this.metaService.metaDoMes(this.mes, this.ano)
    }).subscribe({
      next: ({ ranking, comparacao, meta }) => {
        this.ranking = ranking;
        this.comparacao = comparacao.categorias;
        this.nomeMesAnterior = this.meses.find((m) => m.valor === comparacao.mesAnterior)?.nome ?? '';
        this.anoAnterior = comparacao.anoAnterior;
        this.rendaMensal = meta.rendaMensal;
        this.carregando = false;
      },
      error: () => {
        // Zera os dados do mês anterior antes de mostrar o erro (senão o subtítulo
        // renderizaria "... vs /0" junto do estado de erro).
        this.ranking = null;
        this.comparacao = [];
        this.nomeMesAnterior = '';
        this.anoAnterior = 0;
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  categoriaEmoji(categoriaId: number | null): string {
    return emojiDaCategoria(this.categoriasPorId, categoriaId);
  }

  consomeMuitoDaRenda(categoria: RankingCategoria): boolean {
    if (!this.rendaMensal || this.rendaMensal <= 0) {
      return false;
    }
    return (categoria.total / this.rendaMensal) * 100 > LIMIAR_ALERTA_RENDA;
  }

  percentualDaRenda(categoria: RankingCategoria): number {
    if (!this.rendaMensal || this.rendaMensal <= 0) {
      return 0;
    }
    return Math.round((categoria.total / this.rendaMensal) * 100);
  }
}
