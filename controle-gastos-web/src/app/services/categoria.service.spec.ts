import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CategoriaService } from './categoria.service';
import { API_BASE_URL } from '../core/api.constants';

describe('CategoriaService', () => {
  let service: CategoriaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CategoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listarComGastos com mês/ano envia ?mes=&ano= (dropdown escopado no período)', () => {
    service.listarComGastos(3, 2026).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/categorias/com-gastos`);
    expect(req.request.params.get('mes')).toBe('3');
    expect(req.request.params.get('ano')).toBe('2026');
    req.flush([]);
  });

  it('listarComGastos sem mês/ano não envia parâmetro nenhum (modo "Ver todos os meses")', () => {
    service.listarComGastos().subscribe();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/categorias/com-gastos`);
    expect(req.request.params.has('mes')).toBeFalse();
    expect(req.request.params.has('ano')).toBeFalse();
    req.flush([]);
  });

  it('listarComGastos com mês/ano nulos (filtro de período limpo) também não envia parâmetro', () => {
    service.listarComGastos(null, null).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/categorias/com-gastos`);
    expect(req.request.params.has('mes')).toBeFalse();
    expect(req.request.params.has('ano')).toBeFalse();
    req.flush([]);
  });
});
