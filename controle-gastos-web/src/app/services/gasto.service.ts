import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Gasto, Resumo, TotalMensal } from '../models/gasto.model';
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

  buscarPorId(id: number): Observable<Gasto> {
    return this.http.get<Gasto>(`${this.baseUrl}/${id}`);
  }

  cadastrar(gasto: Gasto): Observable<Gasto> {
    return this.http.post<Gasto>(this.baseUrl, gasto);
  }

  atualizar(id: number, gasto: Gasto): Observable<Gasto> {
    return this.http.put<Gasto>(`${this.baseUrl}/${id}`, gasto);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
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

  rankingCategorias(mes: number, ano: number): Observable<RankingCategorias> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<RankingCategorias>(`${this.baseUrl}/ranking-categorias`, { params });
  }

  comparacaoMensal(mes: number, ano: number): Observable<ComparacaoMensal> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<ComparacaoMensal>(`${this.baseUrl}/comparacao-mensal`, { params });
  }
}
