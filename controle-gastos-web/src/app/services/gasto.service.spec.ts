import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GastoService } from './gasto.service';
import { API_BASE_URL } from '../core/api.constants';
import { Gasto } from '../models/gasto.model';

describe('GastoService', () => {
  let service: GastoService;
  let httpMock: HttpTestingController;

  const gasto: Gasto = {
    descricao: 'Cafe',
    valor: 5,
    categoriaId: 1,
    subcategoriaId: null,
    data: '2026-09-01',
    orcamentoId: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(GastoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('cadastrar sem opcoes faz POST sem o parametro deduplicar', () => {
    service.cadastrar(gasto).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.has('deduplicar')).toBeFalse();
    req.flush(gasto);
  });

  it('cadastrar com deduplicar: true envia ?deduplicar=true (rede de seguranca do M6)', () => {
    service.cadastrar(gasto, { deduplicar: true }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos`);
    expect(req.request.params.get('deduplicar')).toBe('true');
    req.flush(gasto);
  });

  it('pagar faz PATCH /gastos/{id}/pagar com valor e data', () => {
    service.pagar(42, { valor: 99.9, data: '2026-10-02' }).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos/42/pagar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ valor: 99.9, data: '2026-10-02' });
    req.flush(gasto);
  });

  it('desfazerPagamento faz PATCH /gastos/{id}/desfazer-pagamento', () => {
    service.desfazerPagamento(42).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos/42/desfazer-pagamento`);
    expect(req.request.method).toBe('PATCH');
    req.flush(gasto);
  });

  it('atrasadas faz GET /gastos/atrasadas', () => {
    service.atrasadas().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos/atrasadas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('venceHoje faz GET /gastos/vence-hoje', () => {
    service.venceHoje().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos/vence-hoje`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('proximasContas faz GET /gastos/proximas-contas?meses=N', () => {
    service.proximasContas(3).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/proximas-contas`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('meses')).toBe('3');
    req.flush([]);
  });

  it('statusPorFonte faz GET /gastos/status-por-fonte', () => {
    service.statusPorFonte().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/gastos/status-por-fonte`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
