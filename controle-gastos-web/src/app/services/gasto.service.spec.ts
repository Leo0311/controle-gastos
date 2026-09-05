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
});
