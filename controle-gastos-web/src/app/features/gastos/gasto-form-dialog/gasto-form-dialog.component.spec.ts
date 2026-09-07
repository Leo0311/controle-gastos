import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';

import { GastoFormDialogComponent } from './gasto-form-dialog.component';
import { GastoService } from '../../../services/gasto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import { ConfigService } from '../../../services/config.service';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { Gasto } from '../../../models/gasto.model';
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

describe('GastoFormDialogComponent', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('cria', () => {
    expect(criarComponente()).toBeTruthy();
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
});
