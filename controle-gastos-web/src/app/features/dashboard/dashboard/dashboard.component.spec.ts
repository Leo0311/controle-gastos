import { CurrencyPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardComponent } from './dashboard.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';
import { MESES_ABREV } from '../../../core/meses';
import { TemaService } from '../../../services/tema.service';
import { Categoria } from '../../../models/categoria.model';
import { CategoriaTotal, Gasto, Resumo, TotalDiario, TotalMensal } from '../../../models/gasto.model';
import { MetaMes, MetaRequest } from '../../../models/meta.model';
import { DashboardDetalheDialogData } from '../dashboard-detalhe-dialog/dashboard-detalhe-dialog.component';
import { RendaFormDialogComponent } from '../renda-form-dialog/renda-form-dialog.component';
import { MetaFormDialogComponent } from '../meta-form-dialog/meta-form-dialog.component';
import { ContasAPagarDialogComponent } from '../contas-a-pagar-dialog/contas-a-pagar-dialog.component';

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

  // Drena um 2º ciclo de carregar() completo e bem-sucedido (disparado por
  // reload após fechar um diálogo, ou por trocar mês/ano/período - Lote 2
  // Rodada 2) com o formato CERTO por URL - diferente de drenarRestante (Área
  // G), que tolera `[]` solto pra /resumo porque lá o forkJoin já tinha
  // cancelado/errado essa chamada antes de drenar o resto. Usa match() em vez
  // de expectOne (flushCarregar) pelo mesmo motivo do 2º carregar() da área G:
  // categorias pode resolver do cache do shareReplay sem nova requisição.
  function drenarRecarregamento(): void {
    httpMock.match(() => true).forEach((req) => {
      if (req.cancelled) {
        return;
      }
      const url = req.request.url;
      if (url.endsWith('/metas/mes')) {
        req.flush(metaMesPadrao);
      } else if (url.endsWith('/gastos/resumo')) {
        req.flush(resumoPadrao);
      } else {
        req.flush([]);
      }
    });
  }

  // Espião reaproveitável do MatDialog - Lote 2 (Rodada 1) precisa dele nas
  // áreas D e E (onPizzaClick/onBarraClick abrem DashboardDetalheDialogComponent)
  // e a Rodada 2 (área I) vai reaproveitar pros demais diálogos. MatDialogModule
  // nos imports do componente usa o serviço de verdade (com overlay) - sem
  // espiar, abrir de fato anexaria ao DOM. `ref.afterClosed()` já emite o
  // resultado desejado, pra testar o que o componente faz depois de fechar.
  //
  // `fixture.debugElement.injector.get(MatDialog)`, NÃO `TestBed.inject(MatDialog)`:
  // `MatDialogModule` declara `providers: [MatDialog]` no próprio @NgModule (não é
  // só providedIn:'root'), e o componente standalone importa esse módulo direto -
  // isso cria um injector de ambiente por componente com a SUA PRÓPRIA instância de
  // MatDialog, diferente da que `TestBed.inject` devolve (injector raiz do módulo de
  // teste). Espiar a instância errada faz `this.dialog.open` do componente nunca
  // passar pelo espião - o spy fica "nunca chamado" mesmo com o clique acontecendo.
  function espiarDialogo<TResultado = unknown>(resultadoAoFechar?: TResultado): {
    abrirEspiao: jasmine.Spy;
    ref: jasmine.SpyObj<MatDialogRef<unknown, TResultado>>;
  } {
    const ref = jasmine.createSpyObj<MatDialogRef<unknown, TResultado>>('MatDialogRef', ['afterClosed']);
    ref.afterClosed.and.returnValue(of(resultadoAoFechar as TResultado));
    const abrirEspiao = spyOn(fixture.debugElement.injector.get(MatDialog), 'open').and.returnValue(ref);
    return { abrirEspiao, ref };
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

  // ÁREA E — pizza de distribuição por categoria (montarPizza + onPizzaClick).
  // Maior risco de regressão silenciosa do componente: cor atribuída por
  // POSIÇÃO no resumo (não por identidade da categoria), com "Sem categoria"
  // pulando a paleta sem quebrar nada visível se o índice avançar errado; duas
  // listas paralelas (nomesCategoriaPizza e pizzaData.labels) que precisam
  // continuar alinhadas pro clique acertar a categoria; e uma ordem decrescente
  // que o componente confia vir do backend, sem reconferir.
  describe('gráfico de pizza (distribuição por categoria)', () => {
    // Cores literais de dashboard.component.ts (paleta CORES_CATEGORIAS_RESTANTES
    // e COR_SEM_CATEGORIA) - não exportadas, hardcoded aqui de propósito. Se a
    // paleta mudar, estes valores têm que ser atualizados junto.
    const PRIMEIRA_COR_RESTANTE = '#D95F02'; // laranja queimado (paleta[1])
    const SEGUNDA_COR_RESTANTE = '#E6A817';  // mostarda (paleta[2])
    const COR_SEM_CATEGORIA = '#b8b0a4';

    afterEach(() => {
      // A troca de tema (último teste deste bloco) mexe no DOM/localStorage de
      // verdade via TemaService (singleton providedIn:'root') - sem desfazer,
      // o dark mode vazaria pros próximos testes do arquivo (ou de outro spec
      // rodando na mesma sessão do Karma).
      const tema = TestBed.inject(TemaService);
      if (tema.escuro) {
        tema.alternar();
      }
    });

    it('"Sem categoria" no meio da lista não avança o índice da paleta pras categorias reais seguintes', () => {
      iniciar({
        resumo: {
          porCategoria: [
            { categoriaId: 1, categoria: 'Alimentação', total: 500 },
            { categoriaId: null, categoria: 'Sem categoria', total: 300 },
            { categoriaId: 2, categoria: 'Lazer', total: 200 },
            { categoriaId: 3, categoria: 'Transporte', total: 100 }
          ] as CategoriaTotal[]
        }
      });

      const cores = component.pizzaData.datasets[0].backgroundColor as string[];
      expect(cores[1]).toBe(COR_SEM_CATEGORIA);
      // Se "Sem categoria" tivesse consumido uma posição da paleta por engano,
      // Lazer sairia com SEGUNDA_COR_RESTANTE (paleta[2]) em vez de
      // PRIMEIRA_COR_RESTANTE (paleta[1]) - é exatamente essa regressão que
      // este teste pega.
      expect(cores[2]).toBe(PRIMEIRA_COR_RESTANTE);
      expect(cores[3]).toBe(SEGUNDA_COR_RESTANTE);
    });

    it('a fatia na posição 0 sempre ganha o destaque geométrico, mesmo sem ser a de maior valor (componente confia na ordem do backend, sem reordenar)', () => {
      iniciar({
        resumo: {
          // Deliberadamente NÃO ordenado por total - se o componente reordenasse
          // sozinho, "Grande" (maior valor) ficaria na posição 0; como ele confia
          // na ordem recebida, quem sai destacado é "Pequena" (1ª da lista).
          porCategoria: [
            { categoriaId: 1, categoria: 'Pequena', total: 10 },
            { categoriaId: 2, categoria: 'Grande', total: 1000 }
          ] as CategoriaTotal[]
        }
      });

      const dataset = component.pizzaData.datasets[0];
      expect((dataset.offset as number[])[0]).toBe(14); // OFFSET_FATIA_MAIOR
      expect((dataset.offset as number[])[1]).toBe(0);
      expect((dataset.hoverOffset as number[])[0]).toBe(14 + 6); // + OFFSET_HOVER
      expect((dataset.hoverOffset as number[])[1]).toBe(6);
    });

    it('nomesCategoriaPizza (sem emoji) continua alinhado com pizzaData.labels (com emoji) - clique abre a categoria certa', () => {
      iniciar({
        resumo: {
          porCategoria: [
            { categoriaId: 1, categoria: 'Alimentação', total: 500 },
            { categoriaId: 2, categoria: 'Lazer', total: 200 }
          ] as CategoriaTotal[]
        },
        categorias: [{ id: 1, nome: 'Alimentação', emoji: '🍔' }]
      });

      expect(component.pizzaData.labels).toEqual(['🍔 Alimentação', 'Lazer']);

      const { abrirEspiao } = espiarDialogo();
      component.onPizzaClick({ active: [{ index: 0 }] });

      // O diálogo tem que filtrar pelo texto PURO ("Alimentação"), igual ao
      // gasto.categoria salvo no backend - nunca pelo label com emoji exibido.
      const config = abrirEspiao.calls.mostRecent().args[1];
      expect((config.data as DashboardDetalheDialogData).categoria).toBe('Alimentação');
    });

    it('clique fora de qualquer fatia (active vazio) não abre diálogo nenhum', () => {
      iniciar({ resumo: { porCategoria: [{ categoriaId: 1, categoria: 'Alimentação', total: 500 }] as CategoriaTotal[] } });
      const { abrirEspiao } = espiarDialogo();

      component.onPizzaClick({ active: [] });

      expect(abrirEspiao).not.toHaveBeenCalled();
    });

    it('categoria sem emoji cadastrado cai pro texto puro, sem quebrar o label', () => {
      iniciar({
        resumo: { porCategoria: [{ categoriaId: 99, categoria: 'Órfã', total: 50 }] as CategoriaTotal[] },
        categorias: [] // categoriasPorId fica vazio - lookup não acha o id 99
      });

      expect(component.pizzaData.labels).toEqual(['Órfã']);
    });

    it('troca de tema remonta só a cor da 1ª fatia (azul-petróleo) - as demais e a ordem/labels não mudam', () => {
      iniciar({
        resumo: {
          porCategoria: [
            { categoriaId: 1, categoria: 'Alimentação', total: 500 },
            { categoriaId: 2, categoria: 'Lazer', total: 200 }
          ] as CategoriaTotal[]
        }
      });

      const coresAntes = [...(component.pizzaData.datasets[0].backgroundColor as string[])];
      const labelsAntes = [...(component.pizzaData.labels as string[])];

      TestBed.inject(TemaService).alternar();

      const coresDepois = component.pizzaData.datasets[0].backgroundColor as string[];
      expect(coresDepois[0]).not.toBe(coresAntes[0]); // azul-petróleo troca de tom
      expect(coresDepois[1]).toBe(coresAntes[1]); // resto da paleta é fixo entre temas
      expect(component.pizzaData.labels).toEqual(labelsAntes); // mesma ordem/categorias
    });
  });

  // ÁREA D — gráfico de barras (diário/anual) + onBarraClick. Risco: indexação
  // dia-1/mês-1 (off-by-one), dias/meses sem gasto têm que aparecer como zero
  // (não sumir do array) e onBarraClick precisa abrir o dia/mês certo conforme
  // periodoDestaque - usando a MESMA convenção de índice que
  // construirBarrasDiarias/Anuais usou pra montar o gráfico. Fronteiras de data
  // (dez->jan, fev bissexto) alimentam o tamanho do array diário.
  describe('gráfico de barras (diário/anual) e clique', () => {
    it('dia sem gasto aparece como zero (não some do array) - índice bate com dia-1', () => {
      // mes/ano definidos ANTES de iniciar() pra carregar() já nascer com o
      // período certo (ngOnInit ainda não rodou - 1º detectChanges é o de iniciar()).
      component.mes = 9;
      component.ano = 2026; // setembro/2026, 30 dias
      iniciar({ totaisDiarios: [{ dia: 1, total: 100 }, { dia: 30, total: 50 }] });

      const dados = component.barrasData.datasets[0].data as number[];
      expect(dados.length).toBe(30);
      expect(dados[0]).toBe(100);  // dia 1 -> índice 0
      expect(dados[29]).toBe(50);  // dia 30 (último do mês) -> índice 29
      expect(dados[14]).toBe(0);   // dia 15, sem gasto -> 0, não undefined/sumido
      expect(component.barrasData.labels).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 1)));
    });

    it('dezembro tem 31 dias mesmo com o rollover de mês do Date (fronteira dez/jan)', () => {
      component.mes = 12;
      component.ano = 2026;
      iniciar({ totaisDiarios: [{ dia: 31, total: 77 }] });

      const dados = component.barrasData.datasets[0].data as number[];
      expect(dados.length).toBe(31);
      expect(dados[30]).toBe(77);
    });

    it('fevereiro bissexto tem 29 dias', () => {
      component.mes = 2;
      component.ano = 2024; // bissexto
      iniciar({ totaisDiarios: [{ dia: 29, total: 10 }] });

      const dados = component.barrasData.datasets[0].data as number[];
      expect(dados.length).toBe(29);
      expect(dados[28]).toBe(10);
    });

    it('fevereiro não-bissexto tem 28 dias', () => {
      component.mes = 2;
      component.ano = 2025; // não-bissexto
      iniciar({ totaisDiarios: [] });

      expect((component.barrasData.datasets[0].data as number[]).length).toBe(28);
    });

    it('mês sem gasto no ano aparece como zero - sempre 12 posições, labels Jan-Dez', () => {
      component.periodoDestaque = 'ano';
      iniciar({
        totaisMensaisAno: [{ mes: 1, ano: 2026, total: 300 }, { mes: 12, ano: 2026, total: 150 }],
        semTotaisDiarios: true
      });

      const dados = component.barrasData.datasets[0].data as number[];
      expect(dados.length).toBe(12);
      expect(dados[0]).toBe(300);
      expect(dados[11]).toBe(150);
      expect(dados[5]).toBe(0); // junho, sem gasto
      expect(component.barrasData.labels).toEqual(MESES_ABREV);
    });

    it('onBarraClick com "Destacar mês" ativo abre o dia certo (índice+1)', () => {
      component.mes = 9;
      component.ano = 2026;
      iniciar();
      const { abrirEspiao } = espiarDialogo();

      component.onBarraClick({ active: [{ index: 4 }] }); // 5º dia (índice 4 -> dia 5)

      const config = abrirEspiao.calls.mostRecent().args[1];
      expect(config.data as DashboardDetalheDialogData).toEqual({ mes: 9, ano: 2026, dia: 5, categoria: null });
    });

    it('onBarraClick com "Destacar ano" ativo abre o mês certo (índice 0-11 = Jan-Dez)', () => {
      iniciar();
      component.periodoDestaque = 'ano';
      const { abrirEspiao } = espiarDialogo();

      component.onBarraClick({ active: [{ index: 11 }] }); // dezembro (índice 11 -> mês 12)

      const config = abrirEspiao.calls.mostRecent().args[1];
      expect(config.data as DashboardDetalheDialogData).toEqual({ mes: 12, ano: component.ano, categoria: null });
    });

    it('clique fora de qualquer barra (active vazio) não abre diálogo nenhum', () => {
      iniciar();
      const { abrirEspiao } = espiarDialogo();

      component.onBarraClick({ active: [] });

      expect(abrirEspiao).not.toHaveBeenCalled();
    });
  });

  // ÁREA I (resto) — diálogos de renda/meta/contas-a-pagar. Ao contrário dos
  // diálogos "abre e pronto" (abrirDetalheMes/Ano, já cobertos indiretamente
  // nas áreas D/E), estes têm lógica de verdade depois de fechar: guard de
  // fechar sem valor, e os branches de sucesso (snackbar + reload) x erro
  // (snackbar SEM reload) não podem se confundir - um reload sobrevivendo a um
  // erro esconderia a falha; um sucesso que não recarregasse deixaria o
  // Dashboard com dado desatualizado (a renda/meta nova só aparece depois).
  describe('diálogo de renda mensal (abrirDialogoRenda)', () => {
    it('fechar sem valor (undefined) não chama a API nem mostra snackbar', () => {
      iniciar();
      espiarDialogo<number | undefined>(undefined);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoRenda();

      httpMock.expectNone(`${API_BASE_URL}/usuarios/renda`);
      expect(snackSpy).not.toHaveBeenCalled();
    });

    it('sucesso: snackbar de sucesso + recarrega o Dashboard', () => {
      iniciar();
      const { abrirEspiao } = espiarDialogo<number | undefined>(3000);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoRenda();
      expect(abrirEspiao.calls.mostRecent().args[0]).toBe(RendaFormDialogComponent);

      httpMock.expectOne(`${API_BASE_URL}/usuarios/renda`).flush({ rendaMensal: 3000 });

      expect(snackSpy).toHaveBeenCalledWith(
        'Renda mensal atualizada com sucesso!', 'Fechar', jasmine.objectContaining({ duration: 3000 })
      );
      // Prova de que recarregou: uma nova /resumo aparece na fila.
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`).flush(resumoPadrao);
      drenarRecarregamento();
    });

    it('erro: snackbar de erro, SEM recarregar (branch de sucesso e erro não se confundem)', () => {
      iniciar();
      espiarDialogo<number | undefined>(3000);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoRenda();

      httpMock.expectOne(`${API_BASE_URL}/usuarios/renda`).flush('erro', { status: 500, statusText: 'Erro' });

      expect(snackSpy).toHaveBeenCalledWith(
        'Não foi possível atualizar a renda mensal.', 'Fechar', jasmine.objectContaining({ duration: 5000 })
      );
      // Prova de que NÃO recarregou: nenhuma /resumo nova na fila.
      httpMock.expectNone(`${API_BASE_URL}/gastos/resumo`);
    });
  });

  describe('diálogo de meta de economia (abrirDialogoMeta)', () => {
    const metaRequest: MetaRequest = { mes: 9, ano: 2026, valorMeta: 800 };

    it('fechar sem valor (undefined) não chama a API nem mostra snackbar', () => {
      iniciar();
      espiarDialogo<MetaRequest | undefined>(undefined);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoMeta();

      httpMock.expectNone(`${API_BASE_URL}/metas`);
      expect(snackSpy).not.toHaveBeenCalled();
    });

    it('sucesso: snackbar de sucesso + recarrega o Dashboard', () => {
      iniciar();
      const { abrirEspiao } = espiarDialogo<MetaRequest | undefined>(metaRequest);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoMeta();
      expect(abrirEspiao.calls.mostRecent().args[0]).toBe(MetaFormDialogComponent);

      httpMock.expectOne(`${API_BASE_URL}/metas`).flush({ id: 1, usuarioId: 1, ...metaRequest });

      expect(snackSpy).toHaveBeenCalledWith(
        'Meta de economia definida com sucesso!', 'Fechar', jasmine.objectContaining({ duration: 3000 })
      );
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`).flush(resumoPadrao);
      drenarRecarregamento();
    });

    it('erro: snackbar de erro, SEM recarregar (branch de sucesso e erro não se confundem)', () => {
      iniciar();
      espiarDialogo<MetaRequest | undefined>(metaRequest);
      const snackSpy = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

      component.abrirDialogoMeta();

      httpMock.expectOne(`${API_BASE_URL}/metas`).flush('erro', { status: 500, statusText: 'Erro' });

      expect(snackSpy).toHaveBeenCalledWith(
        'Não foi possível definir a meta.', 'Fechar', jasmine.objectContaining({ duration: 5000 })
      );
      httpMock.expectNone(`${API_BASE_URL}/gastos/resumo`);
    });
  });

  // abrirContasAPagar é privado - chamado através de abrirAtrasadas() aqui (a
  // mesma lógica de reload condicional vale pros 3 irmãos: abrirVenceHoje/
  // abrirAVencer, que só trocam o título/instrução/lista passada).
  describe('diálogo de contas a pagar (abrirContasAPagar via abrirAtrasadas)', () => {
    it('houvePagamento=true recarrega o Dashboard', () => {
      iniciar({ atrasadas: [criarGasto('Condomínio', 500)] });
      const { abrirEspiao } = espiarDialogo<boolean | undefined>(true);

      component.abrirAtrasadas();
      expect(abrirEspiao.calls.mostRecent().args[0]).toBe(ContasAPagarDialogComponent);

      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`).flush(resumoPadrao);
      drenarRecarregamento();
    });

    it('houvePagamento=false NÃO recarrega', () => {
      iniciar({ atrasadas: [criarGasto('Condomínio', 500)] });
      espiarDialogo<boolean | undefined>(false);

      component.abrirAtrasadas();

      httpMock.expectNone(`${API_BASE_URL}/gastos/resumo`);
    });

    it('fechar sem marcar nada (undefined) também NÃO recarrega', () => {
      iniciar({ atrasadas: [criarGasto('Condomínio', 500)] });
      espiarDialogo<boolean | undefined>(undefined);

      component.abrirAtrasadas();

      httpMock.expectNone(`${API_BASE_URL}/gastos/resumo`);
    });
  });

  // ÁREA F — seletor de mês/ano (<mat-select>, ligado direto a carregar() via
  // (selectionChange) no template - sem método próprio) e o toggle de período
  // (onPeriodoChange). Pouca lógica própria: o risco real é os PARÂMETROS que
  // carregar() manda pra API quando mes/ano/periodoDestaque mudam, não o
  // wiring em si (que o template já reduz a uma chamada direta).
  describe('seletor de mês/ano e toggle de período', () => {
    it('mudar mês/ano recarrega com o intervalo início/fim certo (parâmetros de /resumo, /totais-diarios e /totais-mensais-do-ano)', () => {
      iniciar(); // 1º ciclo com mês/ano padrão (corrente)

      // Simula o que o (selectionChange) do <mat-select> faz: só muda os
      // campos e chama carregar() de novo - não há método próprio pra isso.
      component.mes = 3;
      component.ano = 2027;
      component.carregar();

      const reqResumo = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`);
      expect(reqResumo.request.params.get('inicio')).toBe('2027-03-01');
      expect(reqResumo.request.params.get('fim')).toBe('2027-03-31');
      reqResumo.flush(resumoPadrao);

      const reqDiarios = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-diarios`);
      expect(reqDiarios.request.params.get('mes')).toBe('3');
      expect(reqDiarios.request.params.get('ano')).toBe('2027');
      reqDiarios.flush([]);

      const reqAno = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-mensais-do-ano`);
      expect(reqAno.request.params.get('ano')).toBe('2027');
      reqAno.flush([]);

      drenarRecarregamento(); // metas/mes, categorias (talvez cache), atrasadas, venceHoje, aVencer
    });

    it('onPeriodoChange("ano") recarrega SEM pedir totais-diarios', () => {
      iniciar(); // 1º ciclo em "mes" (default) - já consome totais-diarios uma vez

      component.onPeriodoChange({ value: 'ano' } as MatButtonToggleChange);

      expect(component.periodoDestaque).toBe('ano');
      httpMock.expectNone(`${API_BASE_URL}/gastos/totais-diarios`);
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`).flush(resumoPadrao);
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-mensais-do-ano`).flush([]);
      drenarRecarregamento();
    });

    it('onPeriodoChange("mes") volta a pedir totais-diarios', () => {
      component.periodoDestaque = 'ano';
      iniciar({ semTotaisDiarios: true }); // 1º ciclo já em "ano"

      component.onPeriodoChange({ value: 'mes' } as MatButtonToggleChange);

      expect(component.periodoDestaque).toBe('mes');
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-diarios`).flush([]);
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/resumo`).flush(resumoPadrao);
      httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/totais-mensais-do-ano`).flush([]);
      drenarRecarregamento();
    });
  });
});
