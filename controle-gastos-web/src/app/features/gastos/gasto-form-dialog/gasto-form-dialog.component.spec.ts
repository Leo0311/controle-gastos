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
});
