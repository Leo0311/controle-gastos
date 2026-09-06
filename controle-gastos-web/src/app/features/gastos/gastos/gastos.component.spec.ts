import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { GastosComponent } from './gastos.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';

describe('GastosComponent', () => {
  let component: GastosComponent;
  let fixture: ComponentFixture<GastosComponent>;
  let httpMock: HttpTestingController;

  const paginaVazia = { conteudo: [], pagina: 0, totalPaginas: 0, totalItens: 0, ultima: true };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GastosComponent],
      providers: [provedoresDeTeste()]
    }).compileComponents();

    fixture = TestBed.createComponent(GastosComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); // dispara ngOnInit -> carregar()
  });

  afterEach(() => httpMock.verify());

  // Responde tudo que estiver pendente (inclusive a 2ª chamada encadeada de
  // carregar()) com uma resposta neutra, pra o teste partir de um estado limpo.
  function drenarPendentes(): void {
    let pendentes = httpMock.match(() => true);
    while (pendentes.length > 0) {
      for (const req of pendentes) {
        if (!req.cancelled) {
          req.flush(req.request.url.endsWith('/gastos/pagina') ? paginaVazia : []);
        }
      }
      pendentes = httpMock.match(() => true);
    }
  }

  function requisicaoOpcoesCategoria() {
    return httpMock.expectOne((r) => r.url === `${API_BASE_URL}/categorias/com-gastos`);
  }

  function requisicaoPagina() {
    return httpMock.expectOne((r) => r.url === `${API_BASE_URL}/gastos/pagina`);
  }

  it('should create', () => {
    drenarPendentes();
    expect(component).toBeTruthy();
  });

  it('carrega as opções do filtro escopadas no mês/ano atual da tela', () => {
    drenarPendentes();

    component.filtroMes = 5;
    component.filtroAno = 2026;
    component.filtroCategoriaId = null;
    component.carregar();

    const reqOpcoes = requisicaoOpcoesCategoria();
    expect(reqOpcoes.request.params.get('mes')).toBe('5');
    expect(reqOpcoes.request.params.get('ano')).toBe('2026');
    reqOpcoes.flush([{ id: 1, nome: 'Alimentação', emoji: '🍽️' }]);

    requisicaoPagina().flush(paginaVazia);
    expect(component.opcoesCategoriaFiltro.map((c) => c.id)).toEqual([1]);
  });

  it('em "Ver todos os meses" busca as opções sem mês/ano (qualquer período)', () => {
    drenarPendentes();

    component.filtroMes = null;
    component.filtroAno = null;
    component.filtroCategoriaId = null;
    component.carregar();

    const reqOpcoes = requisicaoOpcoesCategoria();
    expect(reqOpcoes.request.params.has('mes')).toBeFalse();
    expect(reqOpcoes.request.params.has('ano')).toBeFalse();
    reqOpcoes.flush([]);

    requisicaoPagina().flush(paginaVazia);
  });

  it('reseta o filtro pra "Todas" quando a categoria filtrada não tem gasto no período recém-selecionado', () => {
    drenarPendentes();

    component.filtroMes = 3;
    component.filtroAno = 2026;
    component.filtroCategoriaId = 99; // categoria sem gasto em março/2026
    component.carregar();

    // Opções do período não incluem a 99 -> filtro deve resetar.
    requisicaoOpcoesCategoria().flush([{ id: 1, nome: 'Alimentação', emoji: '🍽️' }]);
    expect(component.filtroCategoriaId).toBeNull();

    // E a 1ª página é buscada JÁ sem o categoriaId órfão.
    const reqPagina = requisicaoPagina();
    expect(reqPagina.request.params.has('categoriaId')).toBeFalse();
    reqPagina.flush(paginaVazia);
  });

  it('mantém o filtro quando a categoria ainda tem gasto no período', () => {
    drenarPendentes();

    component.filtroMes = 3;
    component.filtroAno = 2026;
    component.filtroCategoriaId = 2;
    component.carregar();

    requisicaoOpcoesCategoria().flush([
      { id: 1, nome: 'Alimentação', emoji: '🍽️' },
      { id: 2, nome: 'Transporte', emoji: '🚗' }
    ]);
    expect(component.filtroCategoriaId).toBe(2);

    const reqPagina = requisicaoPagina();
    expect(reqPagina.request.params.get('categoriaId')).toBe('2');
    reqPagina.flush(paginaVazia);
  });
});
