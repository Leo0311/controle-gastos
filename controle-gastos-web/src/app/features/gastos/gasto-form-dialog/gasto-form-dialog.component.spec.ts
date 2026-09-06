import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
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
import { Subcategoria } from '../../../models/categoria.model';

const LIMITES = { parcelasMin: 2, parcelasMax: 120, primeiraParcelaMesesAtrasMax: 12, primeiraParcelaMesesFrenteMax: 2 };

function criarComponente(): GastoFormDialogComponent {
  TestBed.configureTestingModule({
    imports: [GastoFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: { close: () => {} } },
      { provide: MAT_DIALOG_DATA, useValue: { gasto: null } },
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
});
