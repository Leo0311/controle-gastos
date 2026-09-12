import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CompraParceladaDetalheDialogComponent } from './compra-parcelada-detalhe-dialog.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';
import { CompraParceladaDetalhe } from '../../../models/compra-parcelada.model';
import { Gasto } from '../../../models/gasto.model';

describe('CompraParceladaDetalheDialogComponent', () => {
  let component: CompraParceladaDetalheDialogComponent;
  let fixture: ComponentFixture<CompraParceladaDetalheDialogComponent>;
  let httpMock: HttpTestingController;
  let dialogRefEspiado: jasmine.SpyObj<MatDialogRef<CompraParceladaDetalheDialogComponent>>;

  const parcela = (data: string, valor: number, status: 'PAGO' | 'PENDENTE'): Gasto => ({
    descricao: 'Notebook', valor, categoriaId: 1, data, statusPagamento: status, vencimentoOriginal: data
  });

  const detalhePadrao = (overrides: Partial<CompraParceladaDetalhe> = {}): CompraParceladaDetalhe => ({
    id: 42,
    descricao: 'Notebook',
    valorTotal: 400,
    numeroParcelas: 4,
    parcelasLancadas: 4,
    parcelasPagas: 2,
    valorPago: 200,
    valorRestante: 200,
    parcelas: [
      parcela('2026-07-10', 100, 'PAGO'),
      parcela('2026-08-10', 100, 'PAGO'),
      parcela('2026-09-10', 100, 'PENDENTE'),
      parcela('2026-10-10', 100, 'PENDENTE')
    ],
    ...overrides
  });

  beforeEach(async () => {
    dialogRefEspiado = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [CompraParceladaDetalheDialogComponent],
      providers: [
        provedoresDeTeste(),
        { provide: MatDialogRef, useValue: dialogRefEspiado },
        { provide: MAT_DIALOG_DATA, useValue: { compraParceladaId: 42 } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CompraParceladaDetalheDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function requisicaoDetalhe() {
    return httpMock.expectOne((r) => r.url === `${API_BASE_URL}/compras-parceladas/42/detalhe`);
  }

  it('should create e busca o detalhe da compra certa (ID vindo do MAT_DIALOG_DATA)', () => {
    fixture.detectChanges();
    expect(component.carregando).toBeTrue();

    requisicaoDetalhe().flush(detalhePadrao());
    expect(component).toBeTruthy();
    expect(component.carregando).toBeFalse();
    expect(component.detalhe?.id).toBe(42);
  });

  it('erro na chamada liga erro=true e desliga carregando', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush('falha', { status: 500, statusText: 'Erro interno' });

    expect(component.erro).toBeTrue();
    expect(component.carregando).toBeFalse();
    expect(component.detalhe).toBeNull();
  });

  it('"tentar novamente" recupera de um erro anterior', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush('falha', { status: 500, statusText: 'Erro interno' });
    expect(component.erro).toBeTrue();

    component.carregar();
    requisicaoDetalhe().flush(detalhePadrao());

    expect(component.erro).toBeFalse();
    expect(component.detalhe?.id).toBe(42);
  });

  it('parcelamento curto (<=12x) não agrupa por ano', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush(detalhePadrao({ numeroParcelas: 4 }));

    expect(component.agrupaPorAno).toBeFalse();
    expect(component.grupos).toEqual([]);
  });

  it('parcelamento longo (>12x) agrupa por ano', () => {
    // 13 parcelas mensais consecutivas a partir de jan/2026 cruzam pra 2027.
    const parcelasLongas: Gasto[] = Array.from({ length: 13 }, (_, i) => {
      const ano = 2026 + Math.floor(i / 12);
      const mes = String((i % 12) + 1).padStart(2, '0');
      return parcela(`${ano}-${mes}-10`, 100, 'PENDENTE');
    });

    fixture.detectChanges();
    requisicaoDetalhe().flush(detalhePadrao({ numeroParcelas: 13, parcelas: parcelasLongas }));

    expect(component.agrupaPorAno).toBeTrue();
    expect(component.grupos.length).toBeGreaterThan(1);
  });

  it('percentualPago calcula a proporção paga, sem passar de 100', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush(detalhePadrao({ valorTotal: 400, valorPago: 300 }));

    expect(component.percentualPago).toBe(75);
  });

  it('percentualPago não quebra com valorTotal zero', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush(detalhePadrao({ valorTotal: 0, valorPago: 0, parcelas: [] }));

    expect(component.percentualPago).toBe(0);
  });

  it('fechar() fecha o diálogo', () => {
    fixture.detectChanges();
    requisicaoDetalhe().flush(detalhePadrao());

    component.fechar();

    expect(dialogRefEspiado.close).toHaveBeenCalled();
  });
});
