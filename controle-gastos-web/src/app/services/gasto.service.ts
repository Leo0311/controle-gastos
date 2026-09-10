import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Gasto, PaginaGastos, Resumo, StatusPorFonte, TotalDiario, TotalMensal } from '../models/gasto.model';
import { ComparacaoMensal, RankingCategorias } from '../models/analise.model';

@Injectable({
  providedIn: 'root'
})
export class GastoService {

  private readonly baseUrl = `${API_BASE_URL}/gastos`;

  constructor(private readonly http: HttpClient) { }

  listarTodos(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(this.baseUrl);
  }

  // Listagem paginada da tela de Gastos. mes/ano/categoriaId são filtros
  // opcionais; só entram na query string quando definidos.
  listarPaginado(opcoes: {
    page: number;
    size?: number;
    mes?: number | null;
    ano?: number | null;
    categoriaId?: number | null;
  }): Observable<PaginaGastos> {
    let params = new HttpParams()
      .set('page', opcoes.page)
      .set('size', opcoes.size ?? 50);
    if (opcoes.mes) {
      params = params.set('mes', opcoes.mes);
    }
    if (opcoes.ano) {
      params = params.set('ano', opcoes.ano);
    }
    if (opcoes.categoriaId) {
      params = params.set('categoriaId', opcoes.categoriaId);
    }
    return this.http.get<PaginaGastos>(`${this.baseUrl}/pagina`, { params });
  }

  buscarPorId(id: number): Observable<Gasto> {
    return this.http.get<Gasto>(`${this.baseUrl}/${id}`);
  }

  // deduplicar: só a importação de planilha passa true. Faz o backend recusar com
  // 409 uma linha idêntica (mesma descrição/valor/data) a um gasto já cadastrado -
  // rede de segurança do achado M6, além da detecção que a importação já faz no
  // cliente. O "Novo gasto" manual não passa e continua aceitando gastos iguais.
  cadastrar(gasto: Gasto, opcoes?: { deduplicar?: boolean }): Observable<Gasto> {
    const options = opcoes?.deduplicar
      ? { params: new HttpParams().set('deduplicar', true) }
      : {};
    return this.http.post<Gasto>(this.baseUrl, gasto, options);
  }

  atualizar(id: number, gasto: Gasto): Observable<Gasto> {
    return this.http.put<Gasto>(`${this.baseUrl}/${id}`, gasto);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Confirma o pagamento de um gasto de recorrência/parcela (também serve pra
  // editar um pagamento já feito). Pagar fora do vencimento move o gasto de mês
  // nos totais (regime de caixa).
  pagar(id: number, pagamento: { valor: number; data: string }): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.baseUrl}/${id}/pagar`, pagamento);
  }

  // Desfaz o pagamento: status volta a PENDENTE e a data volta ao vencimento original.
  desfazerPagamento(id: number): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.baseUrl}/${id}/desfazer-pagamento`, {});
  }

  // Contas atrasadas do usuário (PENDENTE com vencimento no passado, qualquer mês).
  atrasadas(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.baseUrl}/atrasadas`);
  }

  // Contas que vencem hoje (PENDENTE, vencimento hoje) - disjunto de atrasadas().
  venceHoje(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.baseUrl}/vence-hoje`);
  }

  // Contas a vencer nos próximos 3 dias (PENDENTE, vencimento entre hoje+1 e
  // hoje+3) - disjunto de venceHoje() e de atrasadas().
  aVencer(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.baseUrl}/a-vencer`);
  }

  // Agenda da aba "Próximas contas": recorrência/parcela ainda não pagas dentro da
  // janela de `meses` meses contando o mês corrente como o primeiro (meses=1 -> só o
  // mês corrente), mais TODAS as atrasadas. meses: 1..12 (o backend rejeita fora do
  // range). Substitui o antigo listarTodos() nessa tela.
  proximasContas(meses: number): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.baseUrl}/proximas-contas`, {
      params: new HttpParams().set('meses', meses)
    });
  }

  // Contadores por recorrência e por compra parcelada (pendentes/atrasadas/futuros)
  // para os badges das abas Recorrentes e Parceladas.
  statusPorFonte(): Observable<StatusPorFonte[]> {
    return this.http.get<StatusPorFonte[]>(`${this.baseUrl}/status-por-fonte`);
  }

  listarPorCategoria(categoria: string): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.baseUrl}/categoria/${categoria}`);
  }

  listarPorPeriodo(inicio: string, fim: string): Observable<Gasto[]> {
    const params = new HttpParams().set('inicio', inicio).set('fim', fim);
    return this.http.get<Gasto[]>(`${this.baseUrl}/periodo`, { params });
  }

  resumo(inicio: string, fim: string): Observable<Resumo> {
    const params = new HttpParams().set('inicio', inicio).set('fim', fim);
    return this.http.get<Resumo>(`${this.baseUrl}/resumo`, { params });
  }

  totaisMensais(meses = 6): Observable<TotalMensal[]> {
    const params = new HttpParams().set('meses', meses);
    return this.http.get<TotalMensal[]>(`${this.baseUrl}/totais-mensais`, { params });
  }

  totaisDiarios(mes: number, ano: number): Observable<TotalDiario[]> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<TotalDiario[]>(`${this.baseUrl}/totais-diarios`, { params });
  }

  rankingCategorias(mes: number, ano: number): Observable<RankingCategorias> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<RankingCategorias>(`${this.baseUrl}/ranking-categorias`, { params });
  }

  comparacaoMensal(mes: number, ano: number): Observable<ComparacaoMensal> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<ComparacaoMensal>(`${this.baseUrl}/comparacao-mensal`, { params });
  }
}
