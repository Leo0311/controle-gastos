import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of, Subject } from 'rxjs';

import { GastoFormDialogComponent } from './gasto-form-dialog.component';
import { FORMATOS_DATA_PT_BR, PtBrDateAdapter } from '../../../core/pt-br-date-adapter';
import { GastoService } from '../../../services/gasto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import { ConfigService } from '../../../services/config.service';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { Gasto } from '../../../models/gasto.model';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
import { Orcamento } from '../../../models/orcamento.model';
import { CompraParceladaLimites } from '../../../models/config.model';
import { CategoriaFormDialogComponent } from '../../../shared/categoria-form-dialog/categoria-form-dialog.component';
import {
  SubcategoriaFormDialogComponent,
  SubcategoriaFormResultado
} from '../../../shared/subcategoria-form-dialog/subcategoria-form-dialog.component';
import { SugestaoCategoria } from './sugestao-categoria';

const LIMITES = { parcelasMin: 2, parcelasMax: 120, primeiraParcelaMesesAtrasMax: 12, primeiraParcelaMesesFrenteMax: 2 };

function criarComponente(dialogData: unknown = { gasto: null }): GastoFormDialogComponent {
  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: { close: () => {} } },
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      { provide: ConfigService, useValue: { garantirCarregado: () => {}, limitesCompraParcelada: () => LIMITES } },
      { provide: GastoService, useValue: { listarTodos: () => of([]) } },
      { provide: CategoriaService, useValue: { listarVisiveis: () => of([]), listarTodasSubcategorias: () => of([]) } },
      { provide: OrcamentoService, useValue: { listarTodos: () => of([]) } },
      { provide: GastoRecorrenteService, useValue: {} },
      { provide: CompraParceladaService, useValue: {} },
      { provide: NotificacaoService, useValue: { erro: () => {}, mensagemDeErro: () => '' } }
    ]
  });
  // sem detectChanges(): não roda ngOnInit (que dispara os subscribes de carga) -
  // os testes montam o estado que precisam à mão.
  return TestBed.createComponent(GastoFormDialogComponent).componentInstance;
}

// Variante de criarComponente() com BreakpointObserver controlável - só a
// área I (telaPequena$) precisa disso, sem depender de matchMedia real.
function criarComponenteComBreakpoint(matches: boolean): GastoFormDialogComponent {
  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: { close: () => {} } },
      { provide: MAT_DIALOG_DATA, useValue: { gasto: null } },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches }) } },
      { provide: ConfigService, useValue: { garantirCarregado: () => {}, limitesCompraParcelada: () => LIMITES } },
      { provide: GastoService, useValue: { listarTodos: () => of([]) } },
      { provide: CategoriaService, useValue: { listarVisiveis: () => of([]), listarTodasSubcategorias: () => of([]) } },
      { provide: OrcamentoService, useValue: { listarTodos: () => of([]) } },
      { provide: GastoRecorrenteService, useValue: {} },
      { provide: CompraParceladaService, useValue: {} },
      { provide: NotificacaoService, useValue: { erro: () => {}, mensagemDeErro: () => '' } }
    ]
  });
  return TestBed.createComponent(GastoFormDialogComponent).componentInstance;
}

interface HarnessSalvar {
  fixture: ComponentFixture<GastoFormDialogComponent>;
  component: GastoFormDialogComponent;
  dialogRefMock: { close: jasmine.Spy; disableClose: boolean };
  cadastrarRecorrenteSpy: jasmine.Spy;
  cadastrarParceladaSpy: jasmine.Spy;
  notificacaoErroSpy: jasmine.Spy;
}

// Harness dedicado pra salvar()/salvarComLoading (Lote de dívida técnica,
// Rodada 1 - áreas D+E). Ao contrário de criarComponente() acima, ESTE roda
// fixture.detectChanges() de propósito: precisa do ngOnInit de verdade rodando
// pra (a) os validators reativos de recorrente/parcelado (diaDoMes, mesesGerar,
// numeroParcelas, "Data") ligarem sozinhos - senão cada teste teria que chamar
// os métodos privados à mão, como o describe de "validador da Data" já faz -,
// e (b) poder inspecionar o DOM (spinner, [disabled] dos botões) durante o
// loading. Os serviços auxiliares (categoria/subcategoria/orçamento/histórico)
// continuam mockados com `of([])`, então ngOnInit roda sem efeito colateral.
function criarComponenteParaSalvar(dialogData: unknown = { gasto: null }): HarnessSalvar {
  const dialogRefMock = { close: jasmine.createSpy('close'), disableClose: false };
  const cadastrarRecorrenteSpy = jasmine.createSpy('cadastrarRecorrente');
  const cadastrarParceladaSpy = jasmine.createSpy('cadastrarParcelada');
  const notificacaoErroSpy = jasmine.createSpy('erro');

  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      // Precisa do DateAdapter de verdade (mesmo wiring do app.config.ts): ao
      // contrário de criarComponente() acima, este harness roda detectChanges()
      // e o template tem um <input [matDatepicker]>, que injeta DateAdapter no
      // construtor - sem isto, MatDatepickerInput lança "No provider found for
      // DateAdapter" na hora de renderizar.
      { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
      { provide: DateAdapter, useClass: PtBrDateAdapter },
      { provide: MAT_DATE_FORMATS, useValue: FORMATOS_DATA_PT_BR },
      { provide: MatDialogRef, useValue: dialogRefMock },
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      { provide: ConfigService, useValue: { garantirCarregado: () => {}, limitesCompraParcelada: () => LIMITES } },
      { provide: GastoService, useValue: { listarTodos: () => of([]) } },
      { provide: CategoriaService, useValue: { listarVisiveis: () => of([]), listarTodasSubcategorias: () => of([]) } },
      { provide: OrcamentoService, useValue: { listarTodos: () => of([]) } },
      { provide: GastoRecorrenteService, useValue: { cadastrar: cadastrarRecorrenteSpy } },
      { provide: CompraParceladaService, useValue: { cadastrar: cadastrarParceladaSpy } },
      {
        provide: NotificacaoService,
        useValue: { erro: notificacaoErroSpy, mensagemDeErro: (e: unknown) => `mensagem: ${e}` }
      }
    ]
  });

  const fixture = TestBed.createComponent(GastoFormDialogComponent);
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    dialogRefMock,
    cadastrarRecorrenteSpy,
    cadastrarParceladaSpy,
    notificacaoErroSpy
  };
}

function preencherCamposComuns(
  c: GastoFormDialogComponent,
  overrides: Partial<{ descricao: string; valor: number; categoriaId: number }> = {}
): void {
  c.form.patchValue({
    descricao: overrides.descricao ?? 'Gasto teste',
    valor: overrides.valor ?? 100,
    categoriaId: overrides.categoriaId ?? 1
  });
}

function preencherRecorrenteValido(
  c: GastoFormDialogComponent,
  overrides: Partial<{ descricao: string; valor: number; categoriaId: number; diaDoMes: number; mesesGerar: number }> = {}
): void {
  preencherCamposComuns(c, overrides);
  c.form.patchValue({
    recorrente: true,
    diaDoMes: overrides.diaDoMes ?? 5,
    mesesGerar: overrides.mesesGerar ?? 12
  });
}

function preencherParceladaValida(
  c: GastoFormDialogComponent,
  overrides: Partial<{
    descricao: string; valor: number; categoriaId: number; numeroParcelas: number; dataPrimeiraParcela: Date;
  }> = {}
): void {
  preencherCamposComuns(c, overrides);
  c.form.patchValue({
    parcelado: true,
    numeroParcelas: overrides.numeroParcelas ?? 6,
    dataPrimeiraParcela: overrides.dataPrimeiraParcela ?? new Date(2026, 9, 1)
  });
}

// Harness da Rodada 2 (área B - orçamento automático): mesmo espírito de
// criarComponenteParaSalvar (detectChanges() de propósito, pra
// atualizarOpcoesOrcamento reagir de verdade à mudança de "data" via
// valueChanges), mas com OrcamentoService controlável - o harness da Rodada 1
// fixa listarTodos() em `of([])`, que não serve aqui.
function criarComponenteParaOrcamento(
  dialogData: unknown,
  orcamentos: Orcamento[]
): { fixture: ComponentFixture<GastoFormDialogComponent>; component: GastoFormDialogComponent } {
  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
      { provide: DateAdapter, useClass: PtBrDateAdapter },
      { provide: MAT_DATE_FORMATS, useValue: FORMATOS_DATA_PT_BR },
      { provide: MatDialogRef, useValue: { close: () => {}, disableClose: false } },
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      { provide: ConfigService, useValue: { garantirCarregado: () => {}, limitesCompraParcelada: () => LIMITES } },
      { provide: GastoService, useValue: { listarTodos: () => of([]) } },
      { provide: CategoriaService, useValue: { listarVisiveis: () => of([]), listarTodasSubcategorias: () => of([]) } },
      { provide: OrcamentoService, useValue: { listarTodos: () => of(orcamentos) } },
      { provide: GastoRecorrenteService, useValue: {} },
      { provide: CompraParceladaService, useValue: {} },
      { provide: NotificacaoService, useValue: { erro: () => {}, mensagemDeErro: () => '' } }
    ]
  });

  const fixture = TestBed.createComponent(GastoFormDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

// Harness da Rodada 3 (área G - categoria/subcategoria + "+ Nova..."): mesmo
// espírito dos harnesses anteriores (detectChanges() de propósito), com
// CategoriaService controlável (listas iniciais + spies de criar/
// criarSubcategoria). NÃO fornece MatDialog mockado - o componente importa
// MatDialogModule direto (mesmo padrão do dashboard.component.spec.ts), que
// declara `providers: [MatDialog]` no próprio @NgModule; deixar a instância
// real se formar e espiar via fixture.debugElement.injector.get() (ver
// espiarDialogo abaixo) evita a armadilha já documentada no Lote do Dashboard.
function criarComponenteParaCategoria(
  dialogData: unknown,
  categoriasIniciais: Categoria[],
  subcategoriasIniciais: Subcategoria[]
): {
  fixture: ComponentFixture<GastoFormDialogComponent>;
  component: GastoFormDialogComponent;
  criarCategoriaSpy: jasmine.Spy;
  criarSubcategoriaSpy: jasmine.Spy;
} {
  const criarCategoriaSpy = jasmine.createSpy('criar');
  const criarSubcategoriaSpy = jasmine.createSpy('criarSubcategoria');

  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
      { provide: DateAdapter, useClass: PtBrDateAdapter },
      { provide: MAT_DATE_FORMATS, useValue: FORMATOS_DATA_PT_BR },
      { provide: MatDialogRef, useValue: { close: () => {}, disableClose: false } },
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      { provide: ConfigService, useValue: { garantirCarregado: () => {}, limitesCompraParcelada: () => LIMITES } },
      { provide: GastoService, useValue: { listarTodos: () => of([]) } },
      {
        provide: CategoriaService,
        useValue: {
          listarVisiveis: () => of(categoriasIniciais),
          listarTodasSubcategorias: () => of(subcategoriasIniciais),
          criar: criarCategoriaSpy,
          criarSubcategoria: criarSubcategoriaSpy
        }
      },
      { provide: OrcamentoService, useValue: { listarTodos: () => of([]) } },
      { provide: GastoRecorrenteService, useValue: {} },
      { provide: CompraParceladaService, useValue: {} },
      { provide: NotificacaoService, useValue: { erro: () => {}, mensagemDeErro: () => '' } }
    ]
  });

  const fixture = TestBed.createComponent(GastoFormDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, criarCategoriaSpy, criarSubcategoriaSpy };
}

// Adaptado de dashboard.component.spec.ts (espiarDialogo): usa
// fixture.debugElement.injector.get(MatDialog), NÃO TestBed.inject(MatDialog)
// - MatDialogModule declara providers: [MatDialog] no próprio @NgModule, então
// o componente standalone que o importa ganha uma instância PRÓPRIA (injector
// de ambiente por componente), diferente da que TestBed.inject devolveria.
function espiarDialogo<TResultado = unknown>(
  fixture: ComponentFixture<GastoFormDialogComponent>,
  resultadoAoFechar?: TResultado
): { abrirEspiao: jasmine.Spy; ref: jasmine.SpyObj<MatDialogRef<unknown, TResultado>> } {
  const ref = jasmine.createSpyObj<MatDialogRef<unknown, TResultado>>('MatDialogRef', ['afterClosed']);
  ref.afterClosed.and.returnValue(of(resultadoAoFechar as TResultado));
  const abrirEspiao = spyOn(fixture.debugElement.injector.get(MatDialog), 'open').and.returnValue(ref);
  return { abrirEspiao, ref };
}

describe('GastoFormDialogComponent', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('cria', () => {
    expect(criarComponente()).toBeTruthy();
  });

  describe('validador da Data x tipo de lançamento (reorder do form)', () => {
    function setTipoEspecial(c: GastoFormDialogComponent, ativo: boolean): void {
      (c as unknown as { atualizarValidadorData(a: boolean): void }).atualizarValidadorData(ativo);
    }

    it('modo especial (recorrente/parcela) tira o "required" da Data - ela some do form e não pode bloquear o salvar', () => {
      const c = criarComponente();
      c.form.controls.data.setValue(null);
      expect(c.form.controls.data.invalid).toBeTrue();

      setTipoEspecial(c, true);

      expect(c.form.controls.data.valid).toBeTrue();
    });

    it('voltar pro modo avulso restaura o "required" da Data', () => {
      const c = criarComponente();
      setTipoEspecial(c, true);
      setTipoEspecial(c, false);
      c.form.controls.data.setValue(null);

      expect(c.form.controls.data.invalid).toBeTrue();
    });
  });

  describe('aplicarSugestao', () => {
    const subs: Subcategoria[] = [
      { id: 20, nome: 'Supermercado', emoji: '🛒', categoriaId: 5 },
      { id: 21, nome: 'Padaria', emoji: '🥖', categoriaId: 5 }
    ];

    function prepararComSugestao(sub: number | null) {
      const c = criarComponente();
      (c as unknown as { todasSubcategorias: Subcategoria[] }).todasSubcategorias = subs;
      (c as unknown as { sugestaoBruta: unknown }).sugestaoBruta = {
        categoriaId: 5, subcategoriaId: sub, rotulo: 'x'
      };
      c.form.controls.subcategoriaId.enable();
      return c;
    }

    it('sugestão com subcategoria aplica categoria E subcategoria', () => {
      const c = prepararComSugestao(20);

      c.aplicarSugestao();

      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBe(20);
    });

    it('sugestão categoria-só aplica só a categoria e NÃO apaga a subcategoria já escolhida (bug 2)', () => {
      const c = prepararComSugestao(null);
      c.form.controls.categoriaId.setValue(5);
      c.form.controls.subcategoriaId.setValue(21); // usuário escolheu Padaria à mão

      // com o chip escondido nesse estado (bug 1), aplicarSugestao nem deveria
      // rodar - mas mesmo forçando, a subcategoria tem que sobreviver
      c.aplicarSugestao();

      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBe(21);
    });

    it('sugestão categoria-só, sem subcategoria escolhida: aplica a categoria, subcategoria segue nula', () => {
      const c = prepararComSugestao(null);

      c.aplicarSugestao();

      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBeNull();
    });
  });

  describe('recalcularSugestao (plano A do histórico + plano B do dicionário)', () => {
    // Categorias/subcategorias do sistema que o dicionário resolve para "aluguel":
    // entrada { termos: ['aluguel', ...], categoria: 'Moradia', subcategoria: 'Aluguel' }.
    const MORADIA: Categoria = { id: 10, nome: 'Moradia', emoji: '🏠', usuarioId: null };
    const SUB_ALUGUEL: Subcategoria = { id: 100, nome: 'Aluguel', emoji: '🔑', categoriaId: 10, usuarioId: null };
    const SUB_CONDOMINIO: Subcategoria = { id: 101, nome: 'Condomínio', emoji: '🏢', categoriaId: 10, usuarioId: null };

    function comHistorico(gastos: Gasto[]): GastoFormDialogComponent {
      const c = criarComponente();
      const priv = c as unknown as {
        gastosAnteriores: Gasto[];
        todasCategorias: Categoria[];
        todasSubcategorias: Subcategoria[];
        recalcularSugestao(texto: string): void;
        sugestaoBruta: (SugestaoCategoria & { rotulo: string }) | null;
      };
      priv.gastosAnteriores = gastos;
      priv.todasCategorias = [MORADIA];
      priv.todasSubcategorias = [SUB_ALUGUEL, SUB_CONDOMINIO];
      return c;
    }

    function sugestaoApos(c: GastoFormDialogComponent, texto: string): SugestaoCategoria | null {
      const priv = c as unknown as {
        recalcularSugestao(texto: string): void;
        sugestaoBruta: (SugestaoCategoria & { rotulo: string }) | null;
      };
      priv.recalcularSugestao(texto);
      const s = priv.sugestaoBruta;
      return s ? { categoriaId: s.categoriaId, subcategoriaId: s.subcategoriaId } : null;
    }

    it('cenário 1 - histórico já traz categoria+subcategoria: mantém a do histórico, mesmo o dicionário sugerindo outra', () => {
      // "aluguel" sempre lançado como Moradia > Condomínio; o dicionário diria Moradia > Aluguel
      const c = comHistorico([
        { descricao: 'Aluguel', valor: 1500, categoriaId: 10, subcategoriaId: 101, data: '2026-07-01' }
      ]);

      expect(sugestaoApos(c, 'aluguel')).toEqual({ categoriaId: 10, subcategoriaId: 101 });
    });

    it('cenário 2 - histórico só com a categoria: o dicionário completa a subcategoria (Moradia > Aluguel)', () => {
      // gastos antigos de "aluguel" categorizados só como Moradia, sem subcategoria
      const c = comHistorico([
        { descricao: 'Aluguel', valor: 1500, categoriaId: 10, subcategoriaId: null, data: '2026-07-01' }
      ]);

      expect(sugestaoApos(c, 'aluguel')).toEqual({ categoriaId: 10, subcategoriaId: 100 });
    });

    it('cenário 3 - histórico só com a categoria e o dicionário não tem entrada pro termo: mantém a categoria sem subcategoria', () => {
      const c = comHistorico([
        { descricao: 'Xpto mensal', valor: 90, categoriaId: 10, subcategoriaId: null, data: '2026-07-01' }
      ]);

      expect(sugestaoApos(c, 'xpto mensal')).toEqual({ categoriaId: 10, subcategoriaId: null });
    });
  });

  describe('descrição apagada por completo desfaz a sugestão auto-aplicada', () => {
    const subs: Subcategoria[] = [
      { id: 20, nome: 'Supermercado', emoji: '🛒', categoriaId: 5 },
      { id: 21, nome: 'Padaria', emoji: '🥖', categoriaId: 5 }
    ];

    function prepararComSugestaoAplicada(dialogData: unknown = { gasto: null }) {
      const c = criarComponente(dialogData);
      (c as unknown as { todasSubcategorias: Subcategoria[] }).todasSubcategorias = subs;
      (c as unknown as { sugestaoBruta: unknown }).sugestaoBruta = { categoriaId: 5, subcategoriaId: 20, rotulo: 'x' };
      c.form.controls.subcategoriaId.enable();
      c.form.controls.descricao.setValue('mercado do zé');
      c.aplicarSugestao();
      return c;
    }

    function apagarDescricao(c: GastoFormDialogComponent): void {
      c.form.controls.descricao.setValue('');
      (c as unknown as { recalcularSugestao(t: string): void }).recalcularSugestao('');
    }

    it('cenário 1 - sugestão aplicada, sem edição manual depois: apagar a descrição limpa categoria e subcategoria', () => {
      const c = prepararComSugestaoAplicada();
      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBe(20);

      apagarDescricao(c);

      expect(c.form.controls.categoriaId.value).toBeNull();
      expect(c.form.controls.subcategoriaId.value).toBeNull();
    });

    it('cenário 2 - usuário trocou a categoria à mão depois da sugestão: apagar a descrição mantém a escolha', () => {
      const c = prepararComSugestaoAplicada();
      // troca manual de categoria (o mat-select atualiza o control e dispara selectionChange)
      c.form.controls.categoriaId.setValue(9);
      c.onCategoriaChange({ value: 9 } as MatSelectChange);

      apagarDescricao(c);

      expect(c.form.controls.categoriaId.value).toBe(9);
    });

    it('cenário 2b - usuário trocou só a subcategoria à mão: apagar a descrição mantém tudo', () => {
      const c = prepararComSugestaoAplicada();
      c.form.controls.subcategoriaId.setValue(21);
      c.onSubcategoriaChange({ value: 21 } as MatSelectChange);

      apagarDescricao(c);

      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBe(21);
    });

    it('cenário 3 - modo edição: apagar a descrição nunca limpa categoria/subcategoria', () => {
      const gasto = { id: 1, descricao: 'Aluguel', valor: 1500, categoriaId: 5, subcategoriaId: 20, data: '2026-07-01' };
      const c = criarComponente({ gasto });
      // força o estado que dispararia a limpeza se não fosse edição
      (c as unknown as { categoriaAutoPreenchida: SugestaoCategoria | null }).categoriaAutoPreenchida = {
        categoriaId: 5, subcategoriaId: 20
      };
      (c as unknown as { recalcularSugestao(t: string): void }).recalcularSugestao('');

      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.subcategoriaId.value).toBe(20);
    });
  });

  // ÁREA D — salvar(): monta o payload certo pra cada um dos 3 tipos de
  // lançamento (mutuamente exclusivos) e o guard de reentrância. Risco real:
  // 805b7d6 - o branch recorrente deste diálogo "rápido" (Novo gasto) foi
  // implementado por espelhamento do diálogo dedicado e esqueceu o
  // mesesGerar, que o backend exige (1-12) - o formulário validava OK, o
  // POST ia sem o campo, o backend respondia 400 e o erro aparecia na tela
  // de Gastos, depois do diálogo já fechado (quem cadastra é o diálogo, mas
  // quem trata erro do insert avulso sempre foi o componente pai).
  describe('salvar() - monta o payload certo por tipo de lançamento', () => {
    it('branch gasto avulso: trim na descrição, data formatada, fecha o diálogo direto (sem loading)', () => {
      const { component, dialogRefMock } = criarComponenteParaSalvar();
      preencherCamposComuns(component, { descricao: '  Mercado  ', valor: 150.5, categoriaId: 3 });
      // Trava a auto-seleção de orçamento (Área B, fora de escopo aqui) - senão
      // a mudança de "data" logo abaixo recalcula orcamentoId sozinha (sem
      // orçamentos no mock, vira null) e sobrescreve o valor manual do teste.
      component.onOrcamentoSelecionadoManualmente({} as MatSelectChange);
      component.form.patchValue({
        subcategoriaId: 30, orcamentoId: 7,
        data: new Date(2026, 8, 15) // 15/09/2026
      });
      component.form.controls.subcategoriaId.enable();

      component.salvar();

      expect(dialogRefMock.close).toHaveBeenCalledWith({
        tipo: 'gasto',
        gasto: {
          descricao: 'Mercado', valor: 150.5, categoriaId: 3, subcategoriaId: 30,
          data: '2026-09-15', orcamentoId: 7
        }
      });
      // Insert avulso nunca passa por salvarComLoading - fecha na hora, sem loading.
      expect(component.salvando).toBeFalse();
    });

    it('branch recorrente: payload inclui mesesGerar (regressão do bug real 805b7d6)', () => {
      const { component, cadastrarRecorrenteSpy } = criarComponenteParaSalvar();
      cadastrarRecorrenteSpy.and.returnValue(new Subject<GastoRecorrente>()); // nunca resolve - só quer ver a chamada
      preencherRecorrenteValido(component, { descricao: '  Aluguel  ', valor: 1500, categoriaId: 10, diaDoMes: 5, mesesGerar: 12 });

      component.salvar();

      expect(cadastrarRecorrenteSpy).toHaveBeenCalledWith({
        descricao: 'Aluguel', valor: 1500, categoriaId: 10, subcategoriaId: null,
        diaDoMes: 5, orcamentoId: null, mesesGerar: 12
      });
    });

    it('branch parcelada: payload usa valorTotal/numeroParcelas/dataPrimeiraParcela (ISO), com trim na descrição', () => {
      const { component, cadastrarParceladaSpy } = criarComponenteParaSalvar();
      cadastrarParceladaSpy.and.returnValue(new Subject<CompraParcelada>());
      preencherParceladaValida(component, {
        descricao: '  Notebook  ', valor: 3600, categoriaId: 7, numeroParcelas: 6, dataPrimeiraParcela: new Date(2026, 9, 1)
      });

      component.salvar();

      expect(cadastrarParceladaSpy).toHaveBeenCalledWith({
        descricao: 'Notebook', valorTotal: 3600, numeroParcelas: 6, categoriaId: 7, subcategoriaId: null,
        dataPrimeiraParcela: '2026-10-01', orcamentoId: null
      });
    });

    it('clique duplo (2ª chamada de salvar() com a 1ª ainda em voo) não dispara uma 2ª chamada à API', () => {
      const { component, cadastrarRecorrenteSpy } = criarComponenteParaSalvar();
      cadastrarRecorrenteSpy.and.returnValue(new Subject<GastoRecorrente>()); // nunca resolve - fica "em voo"
      preencherRecorrenteValido(component);

      component.salvar(); // 1ª chamada real - salvando vira true dentro de salvarComLoading
      component.salvar(); // "clique duplo" - o guard `if (this.salvando) return;` tem que barrar

      expect(cadastrarRecorrenteSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ÁREA E — salvarComLoading(): trava o diálogo enquanto a chamada está em
  // voo (recorrente/parcelada fazem vários inserts e podem demorar). Risco
  // real: 1810354 - sem essa trava, o diálogo fechava na hora e a chamada
  // corria "nas costas" do usuário, que podia recarregar ou navegar no meio e
  // disparar uma chamada concorrente.
  describe('salvarComLoading() - loading, disableClose, sucesso x erro', () => {
    it('durante o loading: salvando=true, disableClose=true, spinner visível e os dois botões desabilitados', () => {
      const { fixture, component, dialogRefMock, cadastrarRecorrenteSpy } = criarComponenteParaSalvar();
      cadastrarRecorrenteSpy.and.returnValue(new Subject<GastoRecorrente>()); // nunca resolve - fica "em voo"
      preencherRecorrenteValido(component);

      component.salvar();
      fixture.detectChanges();

      expect(component.salvando).toBeTrue();
      expect(dialogRefMock.disableClose).toBeTrue();
      const botoes = fixture.debugElement.queryAll(By.css('button'));
      expect(botoes.length).toBeGreaterThan(0);
      botoes.forEach((botao) => expect(botao.nativeElement.disabled).toBeTrue());
      expect(fixture.debugElement.query(By.css('mat-progress-spinner'))).toBeTruthy();
    });

    it('sucesso: fecha o diálogo devolvendo a entidade recém-criada (tipo "recorrente")', () => {
      const entidadeSalva: GastoRecorrente = {
        id: 42, descricao: 'Aluguel', valor: 1500, categoriaId: 10, subcategoriaId: null, diaDoMes: 5, orcamentoId: null
      };
      const { component, dialogRefMock, cadastrarRecorrenteSpy } = criarComponenteParaSalvar();
      cadastrarRecorrenteSpy.and.returnValue(of(entidadeSalva));
      preencherRecorrenteValido(component);

      component.salvar();

      expect(dialogRefMock.close).toHaveBeenCalledWith({ tipo: 'recorrente', recorrente: entidadeSalva });
    });

    it('parcelada também passa pelo mesmo mecanismo de loading (sucesso fecha com a entidade certa)', () => {
      const entidadeSalva: CompraParcelada = {
        id: 9, descricao: 'Notebook', valorTotal: 3600, numeroParcelas: 6, categoriaId: 7,
        subcategoriaId: null, orcamentoId: null, dataPrimeiraParcela: '2026-10-01'
      };
      const { component, dialogRefMock, cadastrarParceladaSpy } = criarComponenteParaSalvar();
      cadastrarParceladaSpy.and.returnValue(of(entidadeSalva));
      preencherParceladaValida(component);

      component.salvar();

      expect(dialogRefMock.close).toHaveBeenCalledWith({ tipo: 'parcelada', parcelada: entidadeSalva });
    });

    it('erro: diálogo NÃO fecha, destrava salvando/disableClose/botões, mostra a mensagem certa (regressão do bug real 1810354)', () => {
      const chamada$ = new Subject<GastoRecorrente>();
      const { fixture, component, dialogRefMock, cadastrarRecorrenteSpy, notificacaoErroSpy } = criarComponenteParaSalvar();
      cadastrarRecorrenteSpy.and.returnValue(chamada$);
      preencherRecorrenteValido(component);

      component.salvar();
      expect(component.salvando).toBeTrue(); // entrou em loading antes de errar

      chamada$.error('falha de rede');

      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component.salvando).toBeFalse();
      expect(dialogRefMock.disableClose).toBeFalse();
      expect(notificacaoErroSpy).toHaveBeenCalledWith('mensagem: falha de rede');

      fixture.detectChanges();
      const submit = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(submit.nativeElement.disabled).toBeFalse();
    });
  });

  // ÁREA B — orçamento automático (atualizarOpcoesOrcamento). Reescrito do
  // zero em cfde43d depois de 3 bugs relatados (a versão anterior comparava
  // por categoria+mês, sem vínculo explícito) - a lógica atual nunca teve
  // teste unitário desde então. Risco: prioridade específico > geral,
  // recalcula ao mudar categoria/subcategoria/data, e a trava
  // escolhaManualOrcamento (uma vez que o usuário escolhe à mão, ou o gasto
  // já vem de edição, a auto-seleção para de mexer no campo).
  describe('orçamento automático (atualizarOpcoesOrcamento)', () => {
    const ORC_GERAL_ALIMENTACAO: Orcamento = {
      id: 1, categoriaId: 10, subcategoriaId: null, categoria: 'Alimentação', subcategoria: null,
      valorLimite: 800, mes: 9, ano: 2026
    };
    const ORC_ESPECIFICO_SUPERMERCADO: Orcamento = {
      id: 2, categoriaId: 10, subcategoriaId: 100, categoria: 'Alimentação', subcategoria: 'Supermercado',
      valorLimite: 500, mes: 9, ano: 2026
    };
    const ORC_OUTRO_MES: Orcamento = {
      id: 3, categoriaId: 10, subcategoriaId: null, categoria: 'Alimentação', subcategoria: null,
      valorLimite: 800, mes: 10, ano: 2026
    };
    const ORC_LAZER_GERAL: Orcamento = {
      id: 4, categoriaId: 20, subcategoriaId: null, categoria: 'Lazer', subcategoria: null,
      valorLimite: 300, mes: 9, ano: 2026
    };

    it('sem subcategoria escolhida, auto-seleciona o orçamento GERAL da categoria (mesmo mês/ano da data)', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO, ORC_LAZER_GERAL, ORC_OUTRO_MES]);
      component.form.controls.data.setValue(new Date(2026, 8, 15)); // 15/09/2026

      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);

      expect(component.form.controls.orcamentoId.value).toBe(1);
    });

    it('com subcategoria escolhida, o orçamento ESPECÍFICO (categoria+subcategoria) vence sobre o geral', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO, ORC_ESPECIFICO_SUPERMERCADO]);
      component.form.controls.data.setValue(new Date(2026, 8, 15));
      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);
      component.form.controls.subcategoriaId.enable();
      component.form.controls.subcategoriaId.setValue(100);

      component.onSubcategoriaChange({ value: 100 } as MatSelectChange);

      expect(component.form.controls.orcamentoId.value).toBe(2); // específico, não o geral (1)
    });

    it('subcategoria escolhida sem orçamento específico pra ela: cai pro orçamento geral (fallback)', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO]); // só o geral existe
      component.form.controls.data.setValue(new Date(2026, 8, 15));
      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);
      component.form.controls.subcategoriaId.enable();
      component.form.controls.subcategoriaId.setValue(999); // subcategoria sem orçamento próprio

      component.onSubcategoriaChange({ value: 999 } as MatSelectChange);

      expect(component.form.controls.orcamentoId.value).toBe(1); // geral
    });

    it('filtra por mês/ano da data escolhida - orçamento de outro mês não é considerado nem selecionado', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_OUTRO_MES]); // só existe pra outubro
      component.form.controls.data.setValue(new Date(2026, 8, 15)); // setembro
      component.form.controls.categoriaId.setValue(10);

      component.onCategoriaChange({ value: 10 } as MatSelectChange);

      expect(component.opcoesOrcamento).toEqual([]);
      expect(component.form.controls.orcamentoId.value).toBeNull();
    });

    it('opcoesOrcamento ordena o geral antes do específico da mesma categoria', () => {
      // ordem de entrada de propósito invertida (específico primeiro), pra provar que quem ordena é o componente
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_ESPECIFICO_SUPERMERCADO, ORC_GERAL_ALIMENTACAO]);
      component.form.controls.data.setValue(new Date(2026, 8, 15));

      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);

      expect(component.opcoesOrcamento.map((o) => o.id)).toEqual([1, 2]); // geral (1) antes do específico (2)
    });

    it('depois de escolher orçamento manualmente (onOrcamentoSelecionadoManualmente), trocar categoria não sobrescreve a escolha', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO, ORC_LAZER_GERAL]);
      component.form.controls.data.setValue(new Date(2026, 8, 15));
      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);
      expect(component.form.controls.orcamentoId.value).toBe(1); // auto-selecionou o geral de Alimentação

      component.form.controls.orcamentoId.setValue(4); // escolha manual (ex.: usuário prefere vincular a Lazer)
      component.onOrcamentoSelecionadoManualmente({} as MatSelectChange);

      // Trocar a categoria de novo NÃO pode mexer no que foi escolhido à mão.
      component.form.controls.categoriaId.setValue(20);
      component.onCategoriaChange({ value: 20 } as MatSelectChange);

      expect(component.form.controls.orcamentoId.value).toBe(4);
    });

    it('modo edição: respeita o orçamento já vinculado (escolhaManualOrcamento nasce true), nunca auto-seleciona por cima', () => {
      const gasto: Gasto = {
        id: 1, descricao: 'Mercado', valor: 200, categoriaId: 10, subcategoriaId: null,
        orcamentoId: 99, data: '2026-09-01'
      };
      // ORC_GERAL_ALIMENTACAO (id 1) seria o "certo" pela auto-seleção - o vínculo
      // salvo (99) tem que sobreviver mesmo assim.
      const { component } = criarComponenteParaOrcamento({ gasto }, [ORC_GERAL_ALIMENTACAO]);

      expect(component.form.controls.orcamentoId.value).toBe(99);

      component.form.controls.data.setValue(new Date(2026, 8, 20)); // dispara atualizarOpcoesOrcamento de novo

      expect(component.form.controls.orcamentoId.value).toBe(99);
    });

    it('sem categoria escolhida, orcamentoId fica nulo', () => {
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO]);
      component.form.controls.data.setValue(new Date(2026, 8, 15));
      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);
      expect(component.form.controls.orcamentoId.value).toBe(1);

      component.form.controls.categoriaId.setValue(null);
      component.onCategoriaChange({ value: null } as unknown as MatSelectChange);

      expect(component.form.controls.orcamentoId.value).toBeNull();
    });

    it('limpar a data esvazia as opções mas NÃO mexe no orcamentoId já selecionado (comportamento atual - ver nota no código)', () => {
      // atualizarOpcoesOrcamento retorna cedo quando `data` é null (só zera
      // opcoesOrcamento) - o orcamentoId escolhido antes fica como estava. Na
      // prática é inofensivo (o próprio "Data" fica inválido/obrigatório nesse
      // estado no modo avulso, bloqueando o salvar), mas documentado aqui pra
      // não virar surpresa se um dia isso for lido como bug.
      const { component } = criarComponenteParaOrcamento({ gasto: null }, [ORC_GERAL_ALIMENTACAO]);
      component.form.controls.data.setValue(new Date(2026, 8, 15));
      component.form.controls.categoriaId.setValue(10);
      component.onCategoriaChange({ value: 10 } as MatSelectChange);
      expect(component.form.controls.orcamentoId.value).toBe(1);

      component.form.controls.data.setValue(null);

      expect(component.opcoesOrcamento).toEqual([]);
      expect(component.form.controls.orcamentoId.value).toBe(1);
    });
  });

  // ÁREA G — categoria/subcategoria + "+ Nova...". Risco: valor-sentinela
  // (-1) tem que reverter a seleção visível sem reemitir evento (senão
  // reentraria no próprio handler) e abrir o mini-diálogo certo; a entidade
  // criada precisa ser inserida na lista E auto-selecionada de verdade (não só
  // ficar disponível pra próxima abertura); e trocar de categoria tem que
  // limpar uma subcategoria que não pertence mais à categoria nova (órfã).
  describe('categoria/subcategoria: valor-sentinela "+ Nova..." e limpeza de órfã', () => {
    const CATEGORIA_A: Categoria = { id: 1, nome: 'Alimentação', emoji: '🍔' };
    const CATEGORIA_B: Categoria = { id: 2, nome: 'Lazer', emoji: '🎮' };
    const SUB_A1: Subcategoria = { id: 10, nome: 'Supermercado', emoji: '🛒', categoriaId: 1 };
    const SUB_B1: Subcategoria = { id: 20, nome: 'Cinema', emoji: '🎬', categoriaId: 2 };

    it('"+ Nova categoria...": reverte pra categoria anterior SEM reemitir evento, e abre o mini-diálogo certo', () => {
      const { fixture, component, criarCategoriaSpy } = criarComponenteParaCategoria({ gasto: null }, [CATEGORIA_A, CATEGORIA_B], []);
      component.form.controls.categoriaId.setValue(CATEGORIA_A.id!);
      component.onCategoriaChange({ value: CATEGORIA_A.id } as MatSelectChange);
      const { abrirEspiao } = espiarDialogo<Categoria>(fixture, undefined); // usuário cancelou o mini-diálogo

      let emissoes = 0;
      component.form.controls.categoriaId.valueChanges.subscribe(() => emissoes++);

      component.onCategoriaChange({ value: component.NOVA_CATEGORIA } as MatSelectChange);

      expect(component.form.controls.categoriaId.value).toBe(CATEGORIA_A.id!); // reverteu, não ficou -1
      expect(emissoes).toBe(0); // emitEvent:false - não reentra no próprio handler
      expect(abrirEspiao.calls.mostRecent().args[0]).toBe(CategoriaFormDialogComponent);
      expect(criarCategoriaSpy).not.toHaveBeenCalled(); // cancelou - nunca chama a API
    });

    it('"+ Nova subcategoria...": reverte pra subcategoria anterior SEM reemitir evento, e abre o mini-diálogo certo', () => {
      const { fixture, component, criarSubcategoriaSpy } = criarComponenteParaCategoria({ gasto: null }, [CATEGORIA_A], [SUB_A1]);
      component.form.controls.categoriaId.setValue(CATEGORIA_A.id!);
      component.onCategoriaChange({ value: CATEGORIA_A.id } as MatSelectChange);
      component.form.controls.subcategoriaId.setValue(SUB_A1.id!);
      component.onSubcategoriaChange({ value: SUB_A1.id } as MatSelectChange);
      const { abrirEspiao } = espiarDialogo<SubcategoriaFormResultado>(fixture, undefined); // cancelou

      let emissoes = 0;
      component.form.controls.subcategoriaId.valueChanges.subscribe(() => emissoes++);

      component.onSubcategoriaChange({ value: component.NOVA_SUBCATEGORIA } as MatSelectChange);

      expect(component.form.controls.subcategoriaId.value).toBe(SUB_A1.id!);
      expect(emissoes).toBe(0);
      expect(abrirEspiao.calls.mostRecent().args[0]).toBe(SubcategoriaFormDialogComponent);
      expect(criarSubcategoriaSpy).not.toHaveBeenCalled();
    });

    it('criar categoria nova pelo mini-diálogo: insere na lista de opções E auto-seleciona de verdade', () => {
      const preenchidoNoMiniForm: Categoria = { nome: 'Pets', emoji: '🐶' };
      const categoriaCriada: Categoria = { id: 50, nome: 'Pets', emoji: '🐶' };
      const { fixture, component, criarCategoriaSpy } = criarComponenteParaCategoria({ gasto: null }, [CATEGORIA_B], []);
      criarCategoriaSpy.and.returnValue(of(categoriaCriada));
      espiarDialogo<Categoria>(fixture, preenchidoNoMiniForm);

      component.onCategoriaChange({ value: component.NOVA_CATEGORIA } as MatSelectChange);

      expect(criarCategoriaSpy).toHaveBeenCalledWith(preenchidoNoMiniForm);
      expect(component.opcoesCategoria.some((c) => c.id === 50)).toBeTrue(); // entrou na lista
      expect(component.form.controls.categoriaId.value).toBe(50); // auto-selecionada de verdade
    });

    it('criar subcategoria nova pelo mini-diálogo: insere na lista E auto-seleciona de verdade', () => {
      const preenchidoNoMiniForm: SubcategoriaFormResultado = { nome: 'Petiscos', emoji: '🦴' };
      const subcategoriaCriada: Subcategoria = { id: 60, nome: 'Petiscos', emoji: '🦴', categoriaId: CATEGORIA_A.id! };
      const { fixture, component, criarSubcategoriaSpy } = criarComponenteParaCategoria({ gasto: null }, [CATEGORIA_A], []);
      criarSubcategoriaSpy.and.returnValue(of(subcategoriaCriada));
      component.form.controls.categoriaId.setValue(CATEGORIA_A.id!);
      component.onCategoriaChange({ value: CATEGORIA_A.id } as MatSelectChange);
      espiarDialogo<SubcategoriaFormResultado>(fixture, preenchidoNoMiniForm);

      component.onSubcategoriaChange({ value: component.NOVA_SUBCATEGORIA } as MatSelectChange);

      expect(criarSubcategoriaSpy).toHaveBeenCalledWith(CATEGORIA_A.id, preenchidoNoMiniForm);
      expect(component.opcoesSubcategoria.some((s) => s.id === 60)).toBeTrue();
      expect(component.form.controls.subcategoriaId.value).toBe(60);
    });

    it('trocar a categoria limpa a subcategoria órfã (que não existe mais na nova lista)', () => {
      const { component } = criarComponenteParaCategoria({ gasto: null }, [CATEGORIA_A, CATEGORIA_B], [SUB_A1, SUB_B1]);
      component.form.controls.categoriaId.setValue(CATEGORIA_A.id!);
      component.onCategoriaChange({ value: CATEGORIA_A.id } as MatSelectChange);
      component.form.controls.subcategoriaId.setValue(SUB_A1.id!);
      component.onSubcategoriaChange({ value: SUB_A1.id } as MatSelectChange);
      expect(component.form.controls.subcategoriaId.value).toBe(SUB_A1.id!);

      component.form.controls.categoriaId.setValue(CATEGORIA_B.id!);
      component.onCategoriaChange({ value: CATEGORIA_B.id } as MatSelectChange);

      expect(component.form.controls.subcategoriaId.value).toBeNull(); // SUB_A1 não pertence a CATEGORIA_B
      expect(component.opcoesSubcategoria).toEqual([SUB_B1]); // opções já refletem a categoria nova
    });
  });

  // ÁREA C (resto) — validadores condicionais que faltavam (só o toggle da
  // "Data" tinha teste até aqui). diaDoMes/mesesGerar ligam junto com
  // "recorrente"; numeroParcelas/dataPrimeiraParcela ligam junto com
  // "parcelado"; os dois checkboxes são mutuamente exclusivos (marcar um
  // desabilita o outro). mesesGerar é a mesma área do bug real 805b7d6 (§ D) -
  // aqui o que se testa é o VALIDATOR (obrigatório 1-12), não a montagem do
  // payload, que já tem teste de regressão dedicado na Rodada 1.
  describe('validadores condicionais de recorrente/parcelado (resto)', () => {
    it('"Tornar recorrente" liga diaDoMes (1-31) e mesesGerar (1-12) como obrigatórios', () => {
      const { component } = criarComponenteParaSalvar();

      component.form.controls.recorrente.setValue(true);

      component.form.controls.diaDoMes.setValue(0);
      expect(component.form.controls.diaDoMes.invalid).toBeTrue(); // min 1
      component.form.controls.diaDoMes.setValue(32);
      expect(component.form.controls.diaDoMes.invalid).toBeTrue(); // max 31
      component.form.controls.diaDoMes.setValue(15);
      expect(component.form.controls.diaDoMes.valid).toBeTrue();

      component.form.controls.mesesGerar.setValue(0);
      expect(component.form.controls.mesesGerar.invalid).toBeTrue(); // min 1
      component.form.controls.mesesGerar.setValue(13);
      expect(component.form.controls.mesesGerar.invalid).toBeTrue(); // max 12
      component.form.controls.mesesGerar.setValue(12);
      expect(component.form.controls.mesesGerar.valid).toBeTrue();
    });

    it('desmarcar "Tornar recorrente" tira o obrigatório de diaDoMes/mesesGerar', () => {
      const { component } = criarComponenteParaSalvar();
      component.form.controls.recorrente.setValue(true);
      component.form.controls.diaDoMes.setValue(null);
      component.form.controls.mesesGerar.setValue(null);
      expect(component.form.controls.diaDoMes.invalid).toBeTrue();
      expect(component.form.controls.mesesGerar.invalid).toBeTrue();

      component.form.controls.recorrente.setValue(false);

      expect(component.form.controls.diaDoMes.valid).toBeTrue();
      expect(component.form.controls.mesesGerar.valid).toBeTrue();
    });

    it('"Tornar recorrente" desabilita o checkbox "Parcelar compra" (exclusão mútua)', () => {
      const { component } = criarComponenteParaSalvar();

      component.form.controls.recorrente.setValue(true);

      expect(component.form.controls.parcelado.disabled).toBeTrue();
    });

    it('"Parcelar compra" liga numeroParcelas (min/max do config) e dataPrimeiraParcela como obrigatórios', () => {
      const { component } = criarComponenteParaSalvar(); // LIMITES do harness: parcelasMin 2, parcelasMax 120

      component.form.controls.parcelado.setValue(true);

      component.form.controls.numeroParcelas.setValue(1);
      expect(component.form.controls.numeroParcelas.invalid).toBeTrue(); // min 2
      component.form.controls.numeroParcelas.setValue(121);
      expect(component.form.controls.numeroParcelas.invalid).toBeTrue(); // max 120
      component.form.controls.numeroParcelas.setValue(6);
      expect(component.form.controls.numeroParcelas.valid).toBeTrue();

      component.form.controls.dataPrimeiraParcela.setValue(null);
      expect(component.form.controls.dataPrimeiraParcela.invalid).toBeTrue();
    });

    it('desmarcar "Parcelar compra" tira o obrigatório de numeroParcelas/dataPrimeiraParcela', () => {
      const { component } = criarComponenteParaSalvar();
      component.form.controls.parcelado.setValue(true);
      component.form.controls.numeroParcelas.setValue(null);
      component.form.controls.dataPrimeiraParcela.setValue(null);
      expect(component.form.controls.numeroParcelas.invalid).toBeTrue();
      expect(component.form.controls.dataPrimeiraParcela.invalid).toBeTrue();

      component.form.controls.parcelado.setValue(false);

      expect(component.form.controls.numeroParcelas.valid).toBeTrue();
      expect(component.form.controls.dataPrimeiraParcela.valid).toBeTrue();
    });

    it('"Parcelar compra" desabilita o checkbox "Tornar recorrente" (exclusão mútua)', () => {
      const { component } = criarComponenteParaSalvar();

      component.form.controls.parcelado.setValue(true);

      expect(component.form.controls.recorrente.disabled).toBeTrue();
    });
  });

  // ÁREA H — limites de parcela vindos do config (aplicarLimites). Achado
  // durante a análise de risco: aplicarLimites só é chamado UMA VEZ, no
  // construtor, com o snapshot síncrono que configService.limitesCompraParcelada()
  // devolver naquele instante - não há nenhuma assinatura reativa ao signal
  // (ver ConfigService.limitesCompraParceladaSignal) em nenhum outro lugar do
  // componente. Isso significa que o branch defensivo dentro de aplicarLimites
  // ("se já estiver em modo parcela, revalida numeroParcelas") é hoje
  // inalcançável pelo fluxo real: no momento em que o construtor roda, o
  // usuário ainda não teve chance de marcar "Parcelar compra". O comentário
  // do código ("são substituídos assim que o config carrega") só se confirma
  // de fato pro PRÓXIMO diálogo aberto na mesma sessão (o signal, providedIn
  // root, já estaria resolvido) - não para o diálogo que estava aberto quando
  // o GET respondeu. Não é um bug com efeito prático hoje (os padrões
  // hardcoded coincidem de propósito com o backend, achado M3), mas vale
  // documentar - por isso o teste abaixo chama aplicarLimites uma 2ª vez
  // manualmente pra provar que o MECANISMO funciona, mesmo sem nada
  // disparando isso sozinho.
  describe('limites de parcela vindos do config (aplicarLimites)', () => {
    it('aplica parcelasMin/Max e mesesAtrasMax/FrenteMax a partir dos limites recebidos no construtor', () => {
      const { component } = criarComponenteParaSalvar(); // LIMITES do harness: 2/120, 12/2

      expect(component.parcelasMin).toBe(2);
      expect(component.parcelasMax).toBe(120);
      expect(component.mesesAtrasMax).toBe(12);
      expect(component.mesesFrenteMax).toBe(2);
    });

    it('janela minDataPrimeiraParcela/maxDataPrimeiraParcela usa os limites recebidos (não só o padrão)', () => {
      const { component } = criarComponenteParaSalvar();
      const priv = component as unknown as {
        aplicarLimites(l: CompraParceladaLimites): void;
        minDataPrimeiraParcela: Date;
        maxDataPrimeiraParcela: Date;
      };
      const hoje = new Date();

      priv.aplicarLimites({
        parcelasMin: 3, parcelasMax: 24, primeiraParcelaMesesAtrasMax: 6, primeiraParcelaMesesFrenteMax: 1
      });

      const minEsperado = new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate());
      const maxEsperado = new Date(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
      expect(priv.minDataPrimeiraParcela.getTime()).toBe(minEsperado.getTime());
      expect(priv.maxDataPrimeiraParcela.getTime()).toBe(maxEsperado.getTime());
    });

    it('se "Parcelar compra" já está ativo quando aplicarLimites roda de novo, revalida numeroParcelas com os limites novos (mecanismo funciona, mesmo sem nada disparando isso sozinho hoje - ver nota acima)', () => {
      const { component } = criarComponenteParaSalvar();
      const priv = component as unknown as { aplicarLimites(l: CompraParceladaLimites): void };
      component.form.controls.parcelado.setValue(true);
      component.form.controls.numeroParcelas.setValue(50); // válido pros limites padrão do harness (2-120)
      expect(component.form.controls.numeroParcelas.valid).toBeTrue();

      priv.aplicarLimites({
        parcelasMin: 2, parcelasMax: 40, primeiraParcelaMesesAtrasMax: 12, primeiraParcelaMesesFrenteMax: 2
      });

      expect(component.form.controls.numeroParcelas.invalid).toBeTrue(); // 50 > o novo max (40)
    });
  });

  // ÁREA F — modo edição vs. criação + trava de parcela isolada. Risco:
  // patchValue populando o form certo a partir do gasto existente; ehParcela
  // travando descrição/valor/data (categoria/subcategoria/orçamento seguem
  // editáveis - o backend também ignora mudança só nesses 3 campos,
  // GastoService.atualizar); e o round-trip de data escrito à mão
  // (parseDataLocal/formatarDataIso) - mesma classe de risco que já gerou um
  // bug real (b67b6fa) noutro arquivo do projeto. Ali o bug vinha de
  // Date.parse(texto digitado) (ambíguo MM/DD vs DD/MM, interpretação
  // dependente de fuso); aqui o parsing é manual Y-M-D via new Date(ano,
  // mes-1, dia) - sem essa ambiguidade específica -, mas o round-trip nunca
  // tinha teste direto.
  describe('modo edição vs. criação + trava de parcela (ehParcela)', () => {
    it('modo criação: editando e ehParcela ficam false, form com os valores padrão (não populado)', () => {
      const component = criarComponente({ gasto: null });

      expect(component.editando).toBeFalse();
      expect(component.ehParcela).toBeFalse();
      expect(component.form.controls.descricao.value).toBe('');
      expect(component.form.controls.categoriaId.value).toBeNull();
    });

    it('modo edição: patchValue popula o form com os dados do gasto existente', () => {
      const gasto: Gasto = {
        id: 7, descricao: 'Aluguel', valor: 1500, categoriaId: 10, subcategoriaId: 100,
        orcamentoId: 3, data: '2026-09-15'
      };
      const component = criarComponente({ gasto });

      expect(component.editando).toBeTrue();
      expect(component.form.controls.descricao.value).toBe('Aluguel');
      expect(component.form.controls.valor.value).toBe(1500);
      expect(component.form.controls.categoriaId.value).toBe(10);
      expect(component.form.controls.subcategoriaId.value).toBe(100);
      expect(component.form.controls.orcamentoId.value).toBe(3);
      expect(component.form.controls.data.value).toEqual(new Date(2026, 8, 15));
    });

    it('gasto que é uma parcela (compraParceladaId presente): ehParcela=true trava descrição/valor/data', () => {
      const gasto: Gasto = {
        id: 8, descricao: 'Notebook (2/6)', valor: 600, categoriaId: 7, compraParceladaId: 55, data: '2026-10-01'
      };
      const component = criarComponente({ gasto });

      expect(component.ehParcela).toBeTrue();
      expect(component.form.controls.descricao.disabled).toBeTrue();
      expect(component.form.controls.valor.disabled).toBeTrue();
      expect(component.form.controls.data.disabled).toBeTrue();
      // categoria/subcategoria/orçamento continuam editáveis - só os 3 campos acima travam
      expect(component.form.controls.categoriaId.disabled).toBeFalse();
    });

    it('gasto normal em edição (sem compraParceladaId): nenhum campo trava', () => {
      const gasto: Gasto = { id: 9, descricao: 'Mercado', valor: 200, categoriaId: 3, data: '2026-09-10' };
      const component = criarComponente({ gasto });

      expect(component.ehParcela).toBeFalse();
      expect(component.form.controls.descricao.disabled).toBeFalse();
      expect(component.form.controls.valor.disabled).toBeFalse();
      expect(component.form.controls.data.disabled).toBeFalse();
    });

    describe('parseDataLocal/formatarDataIso (round-trip de data escrito à mão)', () => {
      function roundTrip(component: GastoFormDialogComponent, iso: string): string {
        const priv = component as unknown as {
          parseDataLocal(iso: string): Date;
          formatarDataIso(data: Date): string;
        };
        return priv.formatarDataIso(priv.parseDataLocal(iso));
      }

      it('data comum (dois dígitos em mês e dia) faz o round-trip exato', () => {
        const component = criarComponente();
        expect(roundTrip(component, '2026-09-15')).toBe('2026-09-15');
      });

      it('mês e dia de um dígito ficam com zero à esquerda na volta (padStart)', () => {
        const component = criarComponente();
        expect(roundTrip(component, '2026-01-05')).toBe('2026-01-05');
      });

      it('fronteira de fim de ano (31/12) não estoura pro ano seguinte', () => {
        const component = criarComponente();
        expect(roundTrip(component, '2026-12-31')).toBe('2026-12-31');
      });

      it('29 de fevereiro em ano bissexto é uma data válida no round-trip', () => {
        const component = criarComponente();
        expect(roundTrip(component, '2024-02-29')).toBe('2024-02-29');
      });

      it('parseDataLocal constrói em horário local (meia-noite), não UTC - sem o deslocamento de fuso de Date.parse(texto)', () => {
        const component = criarComponente();
        const priv = component as unknown as { parseDataLocal(iso: string): Date };

        const data = priv.parseDataLocal('2026-09-15');

        // Se fosse interpretado como UTC (ex.: só `new Date('2026-09-15')`, sem
        // hora), em fusos negativos (America/Sao_Paulo, UTC-3) o dia LOCAL
        // apareceria como 14, não 15 - a mesma classe de bug de b67b6fa (lá,
        // Date.parse de texto digitado; aqui seria a mesma armadilha se
        // parseDataLocal usasse Date.parse em vez de new Date(ano, mes-1, dia)).
        expect(data.getFullYear()).toBe(2026);
        expect(data.getMonth()).toBe(8); // setembro = índice 8
        expect(data.getDate()).toBe(15);
        expect(data.getHours()).toBe(0);
      });
    });
  });

  // ÁREA I — boilerplate (cancelar, dispensarSugestao, telaPequena$). Risco
  // baixo, mas nenhum tinha teste ainda.
  describe('cancelar(), dispensarSugestao() e telaPequena$ (boilerplate)', () => {
    it('cancelar() fecha o diálogo sem devolver nenhum resultado (não salva nada)', () => {
      const component = criarComponente();
      const dialogRef = TestBed.inject(MatDialogRef);
      spyOn(dialogRef, 'close');

      component.cancelar();

      expect(dialogRef.close).toHaveBeenCalledWith();
    });

    it('dispensarSugestao() esconde o chip, sem reabrir sozinho', () => {
      const component = criarComponente();
      (component as unknown as { sugestaoBruta: unknown }).sugestaoBruta = {
        categoriaId: 5, subcategoriaId: null, rotulo: 'x'
      };
      expect(component.sugestao).not.toBeNull(); // chip visível antes de dispensar

      component.dispensarSugestao();

      expect(component.sugestao).toBeNull();
      // reler de novo, sem mexer em mais nada - continua escondido, não reabre sozinho
      expect(component.sugestao).toBeNull();
    });

    it('telaPequena$ emite true quando o BreakpointObserver reporta Handset', () => {
      const component = criarComponenteComBreakpoint(true);
      let valor: boolean | undefined;

      component.telaPequena$.subscribe((v) => { valor = v; });

      expect(valor).toBeTrue();
    });

    it('telaPequena$ emite false quando o BreakpointObserver reporta desktop', () => {
      const component = criarComponenteComBreakpoint(false);
      let valor: boolean | undefined;

      component.telaPequena$.subscribe((v) => { valor = v; });

      expect(valor).toBeFalse();
    });
  });
});
