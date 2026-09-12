import { CurrencyPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardComponent } from './dashboard.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';
import { Categoria } from '../../../models/categoria.model';
import { Gasto, Resumo, TotalDiario, TotalMensal } from '../../../models/gasto.model';
import { MetaMes } from '../../../models/meta.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;

  const resumoPadrao: Resumo = { totalGeral: 0, quantidadeGastos: 0, porCategoria: [] };
  const metaMesPadrao: MetaMes = {
    rendaMensal: null, totalGasto: 0, economiaReal: null, metaId: null, valorMeta: null, percentualMeta: null
  };

  const criarGasto = (descricao: string, valor = 10): Gasto => ({
    descricao, valor, categoriaId: 1, data: '2026-09-01'
  });

  // O ngOnInit dispara 2 fluxos HTTP concorrentes: carregar() (forkJoin de 8
  // chamadas) e, à parte, o POST de "lançar pendentes" (throttlado dentro do
  // service, mas sempre disparado no teste porque cada teste recria o singleton
  // com estado zerado). Este bloco de helpers responde os dois de forma
  // controlável - cada teste só sobrescreve o que importa pro que está
  // verificando, o resto sai com um default neutro.
  interface RespostasCarregar {
    resumo?: Partial<Resumo>;
    totaisMensaisAno?: TotalMensal[];
    totaisDiarios?: TotalDiario[];
    semTotaisDiarios?: boolean; // true quando periodoDestaque === 'ano' (não pede totais-diarios)
    metaMes?: Partial<MetaMes>;
    categorias?: Categoria[];
    atrasadas?: Gasto[];
    venceHoje?: Gasto[];
    aVencer?: Gasto[];
    lancados?: Gasto[]; // resultado do POST lancar-pendentes; length>0 dispara um 2º carregar()
  }

  function flushLancamentoAutomatico(lancados: Gasto[]): void {
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos-recorrentes/lancar-pendentes`).flush(lancados);
    if (lancados.length > 0) {
      // Lançou algo -> o component chama carregar() de novo. Nenhum teste do
      // Lote 1 verifica esse 2º ciclo (isso é a Área J, fora de escopo) - só
      // drena com defaults neutros pra não vazar requisição pendente.
      flushCarregar({});
    }
  }

  function flushCarregar(respostas: RespostasCarregar): void {
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`)
      .flush({ ...resumoPadrao, ...respostas.resumo });
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-mensais-do-ano`)
      .flush(respostas.totaisMensaisAno ?? []);
    if (!respostas.semTotaisDiarios) {
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-diarios`)
        .flush(respostas.totaisDiarios ?? []);
    }
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/metas/mes`)
      .flush({ ...metaMesPadrao, ...respostas.metaMes });
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/categorias`)
      .flush(respostas.categorias ?? []);
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/atrasadas`)
      .flush(respostas.atrasadas ?? []);
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/vence-hoje`)
      .flush(respostas.venceHoje ?? []);
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/a-vencer`)
      .flush(respostas.aVencer ?? []);
  }

  // Dispara ngOnInit (via detectChanges) e resolve os 8 HTTP da inicialização
  // (forkJoin do carregar() + o POST de lançamento automático) de uma vez.
  function iniciar(respostas: RespostasCarregar = {}): void {
    fixture.detectChanges();
    flushLancamentoAutomatico(respostas.lancados ?? []);
    flushCarregar(respostas);
  }

  // Forçar erro num dos membros do forkJoin (Área G) faz o subscribe ir pro
  // error. Na prática só sobra a chamada de categorias (ver
  // CategoriaService.listarVisiveis: shareReplay com refCount:false mantém a
  // chamada HTTP viva mesmo com o forkJoin cancelando as outras) - as demais já
  // são canceladas pelo próprio forkJoin. Drena o que sobrar com o default
  // certo por URL (nunca `null` solto: categorias é cacheada por shareReplay -
  // um `null` flushado aqui fica preso no cache e quebra `categorias.map(...)`
  // dentro do carregar() seguinte, convertendo um teste em falso-negativo).
  function drenarRestante(): void {
    httpMock.match(() => true).forEach((req) => {
      if (!req.cancelled) {
        req.flush(req.request.url.endsWith('/metas/mes') ? metaMesPadrao : []);
      }
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provedoresDeTeste(),
        provideCharts(withDefaultRegisterables()),
        CurrencyPipe
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    iniciar();
    expect(component).toBeTruthy();
  });

  describe('título do card de alerta', () => {
    const gasto = (descricao: string) => ({ descricao, valor: 10, categoriaId: 1, data: '2026-09-01' });

    it('com 1 conta, nomeia a conta', () => {
      iniciar();
      component.atrasadas = [gasto('Condomínio')];
      expect(component.tituloAtrasadas).toBe('1 conta atrasada: Condomínio');

      component.venceHoje = [gasto('Netflix')];
      expect(component.tituloVenceHoje).toBe('1 conta vence hoje: Netflix');

      component.aVencer = [gasto('Internet')];
      expect(component.tituloAVencer).toBe('1 conta a vencer: Internet');
    });

    it('com mais de 1 conta, texto genérico (sem nomes)', () => {
      iniciar();
      component.atrasadas = [gasto('a'), gasto('b')];
      expect(component.tituloAtrasadas).toBe('2 contas atrasadas');

      component.venceHoje = [gasto('a'), gasto('b'), gasto('c')];
      expect(component.tituloVenceHoje).toBe('3 contas vencem hoje');

      component.aVencer = [gasto('a'), gasto('b')];
      expect(component.tituloAVencer).toBe('2 contas a vencer');
    });
  });

  // ÁREA A — cálculo dos totais/resumo. O endpoint mudou em 3f0ae73
  // (Dashboard passou a usar /resumo e /totais-mensais-do-ano agregados em vez
  // de baixar os gastos e somar no cliente) e só foi verificado manualmente no
  // navegador até aqui - estes testes cobrem a agregação de fato.
  describe('carregamento de totais agregados (resumo/totais-mensais-do-ano)', () => {
    it('total e quantidade do mês vêm direto do resumo, sem reprocessar no cliente', () => {
      iniciar({ resumo: { totalGeral: 4539.90, quantidadeGastos: 37 } });

      expect(component.totalMesSelecionado).toBe(4539.90);
      expect(component.numeroGastosMes).toBe(37);
    });

    it('total do ano é a soma dos totais mensais já agregados pelo backend', () => {
      iniciar({
        totaisMensaisAno: [
          { mes: 1, ano: 2026, total: 100 },
          { mes: 2, ano: 2026, total: 250.5 },
          { mes: 3, ano: 2026, total: 0 }
        ]
      });

      expect(component.totalAnoSelecionado).toBe(350.5);
    });

    it('ano sem nenhum gasto soma 0 (reduce em lista vazia não quebra nem vira NaN)', () => {
      iniciar({ totaisMensaisAno: [] });

      expect(component.totalAnoSelecionado).toBe(0);
    });

    it('total do mês (resumo) e total do ano (totais-mensais-do-ano) vêm de fontes independentes', () => {
      iniciar({
        resumo: { totalGeral: 999, quantidadeGastos: 5 },
        totaisMensaisAno: [{ mes: 1, ano: 2026, total: 111 }]
      });

      expect(component.totalMesSelecionado).toBe(999);
      expect(component.totalAnoSelecionado).toBe(111);
    });
  });

  // ÁREA G — reação a erro de API. resumo/totaisMensaisAno/metaMes não têm
  // catchError (diferente de categorias/atrasadas/venceHoje/aVencer, que
  // seguem com lista vazia se falharem) - um erro neles derruba o forkJoin
  // inteiro.
  describe('reação a erro de API', () => {
    it('erro numa chamada sem catchError (ex.: resumo) liga erro=true e desliga carregando', () => {
      fixture.detectChanges();
      flushLancamentoAutomatico([]);

      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`)
        .flush('falha', { status: 500, statusText: 'Erro interno' });
      drenarRestante();

      expect(component.erro).toBeTrue();
      expect(component.carregando).toBeFalse();
    });

    it('"tentar novamente" (chamar carregar() de novo) recupera de um erro anterior', () => {
      fixture.detectChanges();
      flushLancamentoAutomatico([]);
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`)
        .flush('falha', { status: 500, statusText: 'Erro interno' });
      drenarRestante();
      expect(component.erro).toBeTrue();

      component.carregar();
      // expectOne (usado em flushCarregar) não localiza corretamente as
      // requisições dessa 2ª rodada quando uma delas (categorias) resolveu do
      // cache do shareReplay em vez de bater na rede - match() genérico não
      // tem esse problema, então o 2º carregar() é drenado assim.
      httpMock.match(() => true).forEach((req) => {
        const url = req.request.url;
        if (url.endsWith('/gastos/resumo')) {
          req.flush({ ...resumoPadrao, totalGeral: 100, quantidadeGastos: 2 });
        } else if (url.endsWith('/metas/mes')) {
          req.flush(metaMesPadrao);
        } else {
          req.flush([]);
        }
      });

      expect(component.erro).toBeFalse();
      expect(component.carregando).toBeFalse();
      expect(component.totalMesSelecionado).toBe(100);
    });
  });

  // ÁREA B — os 3 cards de alerta (atrasada/vence-hoje/a-vencer). A
  // coexistência dos 3 foi uma decisão deliberada (commits 1ef61db/5e69081),
  // verificada até aqui só manualmente no navegador a cada mudança.
  describe('cards de contas atrasada/vence-hoje/a-vencer', () => {
    it('cada card soma os valores da própria lista (não conta itens nem pega só o primeiro)', () => {
      iniciar({
        atrasadas: [criarGasto('Condomínio', 500), criarGasto('Luz', 200)],
        venceHoje: [criarGasto('Internet', 100)],
        aVencer: [criarGasto('Água', 80), criarGasto('Gás', 40), criarGasto('Streaming', 30)]
      });

      expect(component.totalAtrasadas).toBe(700);
      expect(component.totalVenceHoje).toBe(100);
      expect(component.totalAVencer).toBe(150);
    });

    it('os 3 cards coexistem com dado próprio, sem um pisar no do outro', () => {
      iniciar({
        atrasadas: [criarGasto('Condomínio', 500)],
        venceHoje: [criarGasto('Internet', 100)],
        aVencer: [criarGasto('Água', 80)]
      });

      expect(component.atrasadas.map((g) => g.descricao)).toEqual(['Condomínio']);
      expect(component.venceHoje.map((g) => g.descricao)).toEqual(['Internet']);
      expect(component.aVencer.map((g) => g.descricao)).toEqual(['Água']);
    });

    it('card sem nenhuma conta fica com lista e total zerados, sem quebrar os outros', () => {
      iniciar({
        atrasadas: [criarGasto('Condomínio', 500)],
        venceHoje: [],
        aVencer: []
      });

      expect(component.totalVenceHoje).toBe(0);
      expect(component.venceHoje).toEqual([]);
      expect(component.totalAVencer).toBe(0);
      expect(component.aVencer).toEqual([]);
      // o card com conta não deve ser afetado pelos vizinhos vazios
      expect(component.totalAtrasadas).toBe(500);
    });
  });

  // ÁREA C — progressoMeta (cor/percentual/estourouRenda). A lógica pura mais
  // densa do componente e, até aqui, sem nenhum teste. mes/ano fixados num mês
  // já encerrado (jan/2020) fazem diaDeReferencia() sempre devolver o mês
  // inteiro (proporcaoEsperada = 1), deixando os limiares de cor
  // determinísticos independente do dia em que a suíte rodar.
  describe('progresso da meta de economia (progressoMeta)', () => {
    beforeEach(() => {
      iniciar();
      component.mes = 1;
      component.ano = 2020;
    });

    it('sem rendaMensal definida, não há progresso a mostrar', () => {
      component.metaMes = {
        rendaMensal: null, totalGasto: 0, economiaReal: null, metaId: null, valorMeta: null, percentualMeta: null
      };

      expect(component.progressoMeta).toBeNull();
    });

    it('com renda definida mas sem meta ainda, não há progresso a mostrar', () => {
      component.metaMes = {
        rendaMensal: 5000, totalGasto: 1000, economiaReal: null, metaId: null, valorMeta: null, percentualMeta: null
      };

      expect(component.progressoMeta).toBeNull();
    });

    it('economia real igual ou maior que a meta (mês inteiro decorrido) => verde', () => {
      component.metaMes = {
        rendaMensal: 5000, totalGasto: 4000, economiaReal: 1000, metaId: 1, valorMeta: 1000, percentualMeta: 100
      };

      expect(component.progressoMeta?.cor).toBe('verde');
      expect(component.progressoMeta?.estourouRenda).toBeFalse();
    });

    it('economia real entre 70% e 100% da meta esperada => amarelo', () => {
      component.metaMes = {
        rendaMensal: 5000, totalGasto: 4200, economiaReal: 800, metaId: 1, valorMeta: 1000, percentualMeta: 80
      };

      expect(component.progressoMeta?.cor).toBe('amarelo');
    });

    it('economia real abaixo de 70% da meta esperada => vermelho', () => {
      component.metaMes = {
        rendaMensal: 5000, totalGasto: 4500, economiaReal: 500, metaId: 1, valorMeta: 1000, percentualMeta: 50
      };

      expect(component.progressoMeta?.cor).toBe('vermelho');
    });

    it('economia real negativa (gastou mais que a renda inteira) => estourouRenda com barra cheia', () => {
      component.metaMes = {
        rendaMensal: 3000, totalGasto: 3200, economiaReal: -200, metaId: 1, valorMeta: 500, percentualMeta: -40
      };

      expect(component.progressoMeta?.estourouRenda).toBeTrue();
      expect(component.progressoMeta?.percentualBarra).toBe(100);
      expect(component.progressoMeta?.cor).toBe('vermelho');
    });
  });
});
